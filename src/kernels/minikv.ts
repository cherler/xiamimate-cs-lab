/**
 * 内核：迷你 KV 存储（后端 · 组合式 mini-项目 · 把零件拼成系统）
 * 轴：step —— put/get 一路走完 WAL → memtable → SSTable → 布隆，五个零件协同
 *
 * 这不是又一个孤立知识点,而是把前面学的零件**拼成一个真能跑的迷你数据库**——面试里能讲的「我造过 X」:
 *   写(put):① 先写 **WAL** 日志(持久性,崩溃能恢复) → ② 存进内存 **memtable**(跳表,有序、极快)
 *          → ③ memtable 满了整块顺序刷成不可变 **SSTable**(LSM),同时把键放进 **布隆过滤器**。
 *   读(get):① 先问 **布隆**「这键可能在吗」——说"不在"就直接返回,连磁盘都不查(省 I/O);
 *          说"可能在"再 ② 查 memtable(新数据) → ③ 从新到旧查各 SSTable。
 *   多机时用 **一致性哈希** 把键分到不同节点。
 * 这就是 LevelDB/RocksDB/Cassandra 的骨架。本实验一条流水演示全部五个零件怎么咬合。值可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Entry = [string, number]

export type MiniKVState = {
  i: number
  step: number
  wal: string[]
  memtable: Entry[]
  sstables: Entry[][]
  bloom: string[]        // 已插入的键（简化的布隆成员）
  op: string             // 'put'|'get'|'flush'|'done'
  key: string; val: number
  result: string         // get 的结果
  bloomHit: boolean      // 本次 get 布隆是否命中
  foundIn: string        // 'memtable'|'SSTable1'|...|'none'
  phase: 'run' | 'done'
  log: string
}

export const MINIKV_VISIBLE = ['step', 'wal', 'memtable', 'sstables', 'bloom', 'op', 'key', 'val', 'result', 'bloomHit', 'foundIn', 'phase', 'log'] as const

type Frame = Omit<MiniKVState, 'i'>
const CAP = 3
type Op = { kind: 'put'; k: string; v: number } | { kind: 'get'; k: string }
const OPS: Op[] = [
  { kind: 'put', k: 'a', v: 1 },
  { kind: 'put', k: 'b', v: 2 },
  { kind: 'put', k: 'c', v: 3 },
  { kind: 'put', k: 'd', v: 4 },
  { kind: 'get', k: 'a' },
  { kind: 'get', k: 'z' },
]

export const minikvKernel: Kernel<MiniKVState> = {
  kind: 'minikv',
  compile(_doc: SimDocument): CompiledModel<MiniKVState> {
    const frames: Frame[] = []
    const wal: string[] = []
    let memtable: Entry[] = []
    const sstables: Entry[][] = []
    const bloom: string[] = []
    const snap = (o: Partial<Frame> & { op: string; log: string }) => frames.push({
      step: frames.length, wal: [...wal], memtable: memtable.map(e => [...e] as Entry), sstables: sstables.map(s => s.map(e => [...e] as Entry)),
      bloom: [...bloom], key: '', val: -1, result: '', bloomHit: false, foundIn: '', phase: 'run', ...o,
    })
    for (const op of OPS) {
      if (op.kind === 'put') {
        wal.push(`PUT ${op.k}=${op.v}`)
        memtable.push([op.k, op.v]); memtable.sort((a, b) => a[0] < b[0] ? -1 : 1)
        bloom.push(op.k)
        let log = `**put(${op.k}, ${op.v})**：① 先写 WAL 日志(持久) → ② 存进 memtable(现 ${memtable.length}/${CAP}) → 布隆记下键 ${op.k}。`
        let doFlush = memtable.length >= CAP
        snap({ op: 'put', key: op.k, val: op.v, log })
        if (doFlush) {
          sstables.push([...memtable])
          snap({ op: 'flush', key: op.k, val: op.v, log: `memtable 满(${CAP}) → ③ 整块顺序刷成 **SSTable${sstables.length}** [${memtable.map(e => e[0]).join(',')}]，memtable 清空。` })
          memtable = []
        }
      } else {
        const inBloom = bloom.includes(op.k)
        if (!inBloom) {
          snap({ op: 'get', key: op.k, result: '不存在', bloomHit: false, foundIn: 'none', log: `**get(${op.k})**：① 问布隆——键 ${op.k} **一定不在**(布隆的"没有"是可靠的) → 直接返回"不存在"，**连磁盘都不查**，省掉一次 I/O。` })
        } else {
          const inMem = memtable.find(e => e[0] === op.k)
          let foundIn = '', result = ''
          if (inMem) { foundIn = 'memtable'; result = String(inMem[1]) }
          else {
            for (let s = sstables.length - 1; s >= 0; s--) {
              const hit = sstables[s]!.find(e => e[0] === op.k)
              if (hit) { foundIn = `SSTable${s + 1}`; result = String(hit[1]); break }
            }
          }
          snap({ op: 'get', key: op.k, result, bloomHit: true, foundIn, log: `**get(${op.k})**：① 布隆说"可能在" → ② 查 memtable(没有) → ③ 从新到旧查 SSTable → 在 **${foundIn}** 命中，返回 **${op.k}=${result}**。` })
        }
      }
    }
    frames.push({
      step: frames.length, wal: [...wal], memtable: memtable.map(e => [...e] as Entry), sstables: sstables.map(s => s.map(e => [...e] as Entry)),
      bloom: [...bloom], op: 'done', key: '', val: -1, result: '', bloomHit: false, foundIn: '', phase: 'done',
      log: `**迷你 KV 跑通了**：一条 put/get 流水把五个零件咬合起来——WAL 保证不丢、memtable(跳表)吃写、LSM 顺序刷盘、布隆挡住不存在的键、（多机时）一致性哈希分片。这就是 LevelDB/RocksDB 的骨架。面试讲这个项目：先讲写路径为什么快(内存+顺序刷)、再讲读路径为什么用布隆(挡住无效磁盘查)、再讲 WAL 怎么保证持久性——一套讲下来，"懂原理"就变成了"造过系统"。`,
    })
    const base0: Frame = { step: -1, wal: [], memtable: [], sstables: [], bloom: [], op: '', key: '', val: -1, result: '', bloomHit: false, foundIn: '', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '操作' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
