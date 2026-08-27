/**
 * 内核：二分查找（经典算法 · 原理：有序=每问一次砍掉一半）
 * 轴：step —— 在一个有序数组里找目标，每步看中点、把搜索区间对半砍，直到命中
 *
 * 二分查找是"分治 + 有序"的最小样板:数组**排好序**后,查一个数不用一个个扫。看**正中间**那个:
 * 目标比它大就只可能在**右半**、比它小只可能在**左半**——一次比较就**砍掉一半**候选。区间 [lo,hi] 反复对折,
 * 每步搜索范围减半,所以只需 **log₂n** 次比较就能在百万个里定位(n=10⁶ 也就 20 步)。
 * 这就是"有序结构 + 每次排除一半"的威力,数据库索引(B+树)、版本二分定位 bug、猜数游戏,底子都是它。
 *
 * 本实验:13 个有序数,找目标 **63**。看 [lo,hi] 区间每步对半砍、mid 指针跳,几步命中。
 * 值全部现算、可核对(每步 mid=(lo+hi)/2、比较方向、区间减半、≤log₂13≈4 步)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const ARR = [3, 7, 12, 18, 25, 31, 42, 55, 63, 71, 80, 88, 95]
const TARGET = 63

export type BinSearchState = {
  i: number
  step: number
  arr: number[]
  target: number
  lo: number; hi: number; mid: number
  cmp: string                // 'hit' | 'go-right' | 'go-left'
  found: number              // 命中下标（-1 未定）
  compares: number
  phase: 'run' | 'done'
  log: string
}

export const BINSEARCH_VISIBLE = [
  'step', 'arr', 'target', 'lo', 'hi', 'mid', 'cmp', 'found', 'compares', 'phase', 'log',
] as const

type Frame = Omit<BinSearchState, 'i'>

export const binsearchKernel: Kernel<BinSearchState> = {
  kind: 'binsearch',

  compile(_doc: SimDocument): CompiledModel<BinSearchState> {
    const frames: Frame[] = []
    let lo = 0, hi = ARR.length - 1, compares = 0, found = -1

    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      compares++
      const v = ARR[mid]
      const cmp = v === TARGET ? 'hit' : v < TARGET ? 'go-right' : 'go-left'
      frames.push({
        step: frames.length, arr: ARR, target: TARGET, lo, hi, mid, cmp, found: cmp === 'hit' ? mid : -1, compares, phase: 'run',
        log: `第 ${compares} 次比较:区间 [${lo},${hi}],看正中间 arr[${mid}]=**${v}**。` +
          (cmp === 'hit' ? `正好等于 ${TARGET}——**命中**!` :
            cmp === 'go-right' ? `${v} < ${TARGET},目标只可能在**右半**,lo=${mid + 1}。` :
              `${v} > ${TARGET},目标只可能在**左半**,hi=${mid - 1}。`),
      })
      if (cmp === 'hit') { found = mid; break }
      if (cmp === 'go-right') lo = mid + 1; else hi = mid - 1
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done', found,
      log: `只用 **${compares}** 次比较,就在 ${ARR.length} 个数里定位了 ${TARGET}(下标 ${found})。每次比较**砍掉一半**候选——` +
        `所以是 **log₂n**:百万个数也只要 ~20 步。这就是"有序 + 每次排除一半"的威力,B+树索引、二分定位 bug、猜数游戏都靠它。`,
    })

    const base0: Frame = {
      step: -1, arr: ARR, target: TARGET, lo: 0, hi: ARR.length - 1, mid: -1, cmp: '', found: -1, compares: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '比较次数' },
      initial: () => ({ i: -1, ...base0 }),
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
