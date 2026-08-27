/**
 * 内核：PagedAttention —— KV 缓存的分页管理（大模型推理栈）
 * 轴：step —— 每步是一次"某请求又生成了一批 token，需要 KV 空间"
 *
 * vLLM 的核心创新，本质就是**把操作系统的分页搬到 KV 缓存上**：
 *   - KV 不再要求**连续**存放，而是切成固定大小的**块（page）**。
 *   - 每个请求一张**块表（block table）**，把它的逻辑块号映射到物理块号 —— 就是**页表**。
 *   - 需要新空间就从**空闲块池**里拿一块，拿到哪块都行 —— 消灭了连续分配的**外碎片**。
 *
 * 所以这一屏直接复用 408 的三个内核的概念：
 *   页表（vm）· 页面置换的物理块（page）· 位示图的空闲块管理（bitmap）· 动态分区的外碎片（partition）。
 *
 * 教学关键：两个请求**交错**生成，物理块就会被交错占用 ——
 * 请求 A 拿到物理块 0、2、4（**不连续**），照样正确。这正是分页相对连续分配的胜利。
 *
 * 状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/** 一个物理块的占用：属于谁、是该请求的第几个逻辑块 */
export type Block = { owner: string; logical: number } | null

export type PagedState = {
  i: number
  blockSize: number
  totalBlocks: number
  /** 物理块池：null=空闲 */
  blocks: Block[]
  /** 块表：reqId → [物理块号…]（下标即逻辑块号） */
  tables: Record<string, number[]>
  /** 各请求当前的 token 数 */
  lens: Record<string, number>
  /** 本步涉及的请求、物理块 */
  req: string
  focus: number
  freeCount: number
  act: 'alloc' | 'append' | 'free' | 'done'
  log: string
}

export const PAGED_VISIBLE = [
  'i', 'blockSize', 'totalBlocks', 'blocks', 'tables', 'lens', 'req', 'focus', 'freeCount', 'act', 'log',
] as const

type Frame = Omit<PagedState, 'i'>

//  驱动脚本：谁、这一步加几个 token。交错是故意的 —— 好让物理块非连续。
type Ev = { req: string; add: number } | { free: string }
const SCHEDULES: Record<string, Ev[]> = {
  '两请求交错': [
    { req: 'A', add: 4 }, { req: 'B', add: 4 }, { req: 'A', add: 4 },
    { req: 'B', add: 2 }, { req: 'A', add: 1 }, { free: 'B' }, { req: 'A', add: 3 },
  ],
  '一请求增长': [
    { req: 'A', add: 3 }, { req: 'A', add: 3 }, { req: 'A', add: 3 }, { req: 'A', add: 4 },
  ],
  '释放后复用': [
    { req: 'A', add: 8 }, { req: 'B', add: 4 }, { free: 'A' }, { req: 'C', add: 6 },
  ],
}

export const pagedKernel: Kernel<PagedState> = {
  kind: 'paged',

  compile(doc: SimDocument): CompiledModel<PagedState> {
    const blockSize = num(doc.params, 'blockSize') || 4
    const totalBlocks = num(doc.params, 'totalBlocks') || 8
    const sched = SCHEDULES[String(doc.params.schedule ?? '两请求交错')] ?? SCHEDULES['两请求交错']

    const blocks: Block[] = new Array(totalBlocks).fill(null)
    const tables: Record<string, number[]> = {}
    const lens: Record<string, number> = {}
    const frames: Frame[] = []

    const clone = (): Block[] => blocks.map(b => (b ? { ...b } : null))
    const cloneTables = () => Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, [...v]]))
    const freeCount = () => blocks.filter(b => b === null).length
    const put = (f: Partial<Frame> & { act: Frame['act']; log: string; req: string }) =>
      frames.push({
        blockSize, totalBlocks, blocks: clone(), tables: cloneTables(), lens: { ...lens },
        focus: -1, freeCount: freeCount(), ...f,
      })

    const firstFree = () => blocks.indexOf(null)

    for (const ev of sched) {
      if ('free' in ev) {
        const r = ev.free
        const owned = tables[r] ?? []
        for (const pb of owned) blocks[pb] = null
        delete tables[r]; delete lens[r]
        put({ act: 'free', req: r, focus: -1,
          log: `请求 ${r} 结束 → 它占的 ${owned.length} 个物理块（${owned.join('、')}）全部**归还空闲池**，别的请求马上能用` })
        continue
      }
      const { req: r, add } = ev
      tables[r] ??= []; lens[r] ??= 0
      let remaining = add
      //  先把当前最后一块没填满的部分填掉
      const filledInLast = lens[r] % blockSize
      if (filledInLast !== 0 && tables[r].length > 0) {
        const space = blockSize - filledInLast
        const use = Math.min(space, remaining)
        lens[r] += use; remaining -= use
        put({ act: 'append', req: r, focus: tables[r][tables[r].length - 1],
          log: `请求 ${r} 生成 ${use} 个 token → 填进当前物理块 ${tables[r][tables[r].length - 1]} 的剩余槽（现 ${lens[r]} token）` })
      }
      //  还不够就一块块新分配
      while (remaining > 0) {
        const pb = firstFree()
        if (pb < 0) {
          put({ act: 'append', req: r, focus: -1,
            log: `请求 ${r} 还要空间，但**空闲块池空了**（${totalBlocks} 块全占）—— 真实系统此时触发抢占/换出` })
          break
        }
        const logical = tables[r].length
        blocks[pb] = { owner: r, logical }
        tables[r].push(pb)
        const use = Math.min(blockSize, remaining)
        lens[r] += use; remaining -= use
        const contiguous = tables[r].length > 1 && pb !== tables[r][tables[r].length - 2] + 1
        put({ act: 'alloc', req: r, focus: pb,
          log: `请求 ${r} 需要新空间 → 从空闲池分配**物理块 ${pb}**（它的逻辑块 ${logical}）`
            + (contiguous ? ` —— 注意它和上一块**不连续**，块表照样能对上，分页不在乎` : '') })
      }
    }

    put({ act: 'done', req: '', focus: -1,
      log: `处理完毕：${totalBlocks - freeCount()} / ${totalBlocks} 块在用。`
        + `KV 分页让每个请求的块**想放哪放哪**，从根上避免了连续分配的外碎片` })

    return {
      axis: { kind: 'step', label: '分配步骤' },
      initial: () => ({
        i: -1, blockSize, totalBlocks, blocks: new Array(totalBlocks).fill(null),
        tables: {}, lens: {}, req: '', focus: -1, freeCount: totalBlocks, act: 'alloc', log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
