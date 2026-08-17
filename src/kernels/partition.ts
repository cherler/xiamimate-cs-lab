/**
 * 内核：动态分区分配（操作系统 · 内存管理）
 * 轴：step —— 每步是一次申请或释放
 *
 * 四种放置策略的差别全在「从哪儿开始找、按什么标准挑」：
 *   首次适应  从头找第一个够大的 —— 低地址越用越碎
 *   最佳适应  挑最小的够用分区 —— 留下大量小到没用的外碎片
 *   最坏适应  挑最大的分区 —— 大分区很快被切光
 *   邻近适应  从上次的位置接着找 —— 碎片分布更均匀，但大分区也保不住
 *
 * 释放时要**合并相邻空闲区**，这是这个内容里最容易漏的一步。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/** 一个分区 */
export type Block = { start: number; size: number; owner: string }

export type PartState = {
  i: number
  blocks: Block[]
  /** 本步动作 */
  act: 'alloc' | 'free' | 'fail'
  /** 本步涉及的作业名与大小 */
  job: string
  size: number
  /** 本步选中的分区起址；−1 表示没选上 */
  at: number
  /** 分配时考察过的空闲分区起址 */
  scanned: number[]
  /** 释放时合并了哪几块 */
  merged: number
  /** 外碎片：小于最小申请量的空闲块总和 */
  external: number
  freeTotal: number
  log: string
}

export const PART_VISIBLE = [
  'i', 'blocks', 'act', 'job', 'size', 'at', 'scanned', 'merged', 'external', 'freeTotal', 'log',
] as const

export const partitionKernel: Kernel<PartState> = {
  kind: 'partition',

  compile(doc: SimDocument): CompiledModel<PartState> {
    const algorithm = str(doc.params, 'algorithm')
    const total = num(doc.params, 'memorySize')
    /** 请求序列：{ type:'req', id:'作业1', attrs:{ size, free } } —— free=1 表示释放 */
    const reqs = doc.entities.filter(e => e.type === 'req').map(e => ({
      id: e.id,
      size: Number(e.attrs.size ?? 0),
      isFree: Number(e.attrs.free ?? 0) === 1,
    }))

    const FRAG = 8      // 小于这个的空闲块算外碎片（教材常用的"不可再分配"门限）

    const initial = (): PartState => ({
      i: -1, blocks: [{ start: 0, size: total, owner: '' }],
      act: 'alloc', job: '', size: 0, at: -1, scanned: [], merged: 0,
      external: 0, freeTotal: total, log: '',
    })

    /** 邻近适应要记住上次找到哪儿 —— 存进状态，不能藏在闭包里（标准 2） */
    let lastAt = 0

    return {
      axis: { kind: 'step', label: '请求序号' },
      initial,
      describe: s => s.log,

      step(prev) {
        const base = prev ?? initial()
        const i = base.i + 1
        if (i >= reqs.length) return null

        const req = reqs[i]
        const blocks: Block[] = base.blocks.map(b => ({ ...b }))
        const scanned: number[] = []
        let act: PartState['act'] = req.isFree ? 'free' : 'alloc'
        let at = -1
        let merged = 0
        let log: string

        if (req.isFree) {
          const k = blocks.findIndex(b => b.owner === req.id)
          if (k < 0) {
            act = 'fail'
            log = `释放 ${req.id}：内存里没有这个作业 —— 忽略`
          } else {
            at = blocks[k].start
            blocks[k].owner = ''
            //  合并相邻空闲区 —— 最容易漏的一步
            let lo = k, hi = k
            while (lo > 0 && blocks[lo - 1].owner === '') lo--
            while (hi < blocks.length - 1 && blocks[hi + 1].owner === '') hi++
            merged = hi - lo
            if (merged > 0) {
              const size = blocks.slice(lo, hi + 1).reduce((s, b) => s + b.size, 0)
              blocks.splice(lo, hi - lo + 1, { start: blocks[lo].start, size, owner: '' })
            }
            log = `释放 ${req.id}（起址 ${at}，${blocks.find(b => b.start <= at)!.size} KB）`
              + (merged > 0
                ? ` → 与相邻的 ${merged} 个空闲区合并成一块大的`
                : ` → 左右都不是空闲区，不合并`)
          }
        } else {
          //  找一个够大的空闲分区
          const frees = blocks
            .map((b, k) => ({ b, k }))
            .filter(x => x.b.owner === '' && x.b.size >= req.size)
          let pick: { b: Block; k: number } | undefined

          if (algorithm === '首次适应') {
            for (const f of blocks.filter(b => b.owner === '')) {
              scanned.push(f.start)
              if (f.size >= req.size) break
            }
            pick = frees[0]
          } else if (algorithm === '最佳适应') {
            for (const f of blocks.filter(b => b.owner === '')) scanned.push(f.start)
            pick = frees.slice().sort((a, b) => (a.b.size - b.b.size) || (a.b.start - b.b.start))[0]
          } else if (algorithm === '最坏适应') {
            for (const f of blocks.filter(b => b.owner === '')) scanned.push(f.start)
            pick = frees.slice().sort((a, b) => (b.b.size - a.b.size) || (a.b.start - b.b.start))[0]
          } else {
            //  邻近适应：从上次的位置往后绕一圈
            const n = blocks.length
            const startIdx = blocks.findIndex(b => b.start >= lastAt)
            for (let j = 0; j < n; j++) {
              const idx = ((startIdx < 0 ? 0 : startIdx) + j) % n
              if (blocks[idx].owner !== '') continue
              scanned.push(blocks[idx].start)
              if (blocks[idx].size >= req.size) { pick = { b: blocks[idx], k: idx }; break }
            }
          }

          if (!pick) {
            act = 'fail'
            log = `${req.id} 申请 ${req.size} KB：找遍所有空闲区都装不下 —— 分配失败`
              + `（空闲总量 ${blocks.filter(b => b.owner === '').reduce((s, b) => s + b.size, 0)} KB，`
              + `但被切得太碎，这就是**外碎片**）`
          } else {
            const k = blocks.indexOf(pick.b)
            at = pick.b.start
            lastAt = at + req.size
            const rest = pick.b.size - req.size
            if (rest > 0) {
              blocks.splice(k, 1,
                { start: at, size: req.size, owner: req.id },
                { start: at + req.size, size: rest, owner: '' })
            } else {
              blocks[k] = { start: at, size: req.size, owner: req.id }
            }
            const WHY: Record<string, string> = {
              首次适应: '从低地址往上找到的第一个够大的',
              最佳适应: '所有够大的里面最小的那个',
              最坏适应: '所有空闲区里最大的那个',
              邻近适应: `从上次分配的位置往后找到的第一个够大的`,
            }
            log = `${req.id} 申请 ${req.size} KB：考察空闲区 ${scanned.join('、')} → `
              + `按${algorithm}选中起址 ${at} 的分区（${WHY[algorithm]}），`
              + (rest > 0 ? `切走 ${req.size} KB，剩 ${rest} KB 仍空闲` : `正好用完`)
          }
        }

        const freeBlocks = blocks.filter(b => b.owner === '')
        const freeTotal = freeBlocks.reduce((s, b) => s + b.size, 0)
        const external = freeBlocks.filter(b => b.size < FRAG).reduce((s, b) => s + b.size, 0)

        return {
          state: {
            i, blocks, act, job: req.id, size: req.size, at, scanned, merged,
            external, freeTotal, log,
          },
          done: i === reqs.length - 1,
        }
      },
    }
  },
}
