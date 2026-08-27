/**
 * 内核：快速排序 Quicksort（经典算法 · 原理：选个基准，比它小的甩左边、大的甩右边，分而治之）
 * 轴：step —— Lomuto 分区:每个区间挑末元素当 pivot,一趟扫描把 <pivot 的收到左、≥pivot 的留右,
 *      pivot 落到正中的分界位(从此锁定=最终位置),再对左右两段递归。
 *
 * 快排是**分治**的代表作:排一个区间时,先挑一个**基准 pivot**,做一趟 **partition(分区)**——
 * 把比 pivot 小的都甩到左边、不小于的留右边;这一趟结束,pivot 就落到了它**最终该在的位置**
 * (左边全比它小、右边全不小于它),从此**永久锁定**。然后对 pivot 左、右两段**各自递归**同样地做,
 * 段越切越短,直到长度 1(天然有序),整个数组就排好了。
 *
 * 平均 O(n log n)、原地(不需额外数组)、常数因子小——是实践中最快的通用排序,C++ sort / 各语言库底子都有它。
 * 本实验:7 个数 [5,2,8,1,9,3,7]。看 pivot(琥珀)、扫描指针 j(蓝)一趟趟把小的收左、pivot 归位(绿=锁定),
 * 再切成左右两段递归。每步的比较、交换、pivot 落点都可对着核对,结果 [1,2,3,5,7,8,9]。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const INIT = [5, 2, 8, 1, 9, 3, 7]

export type QuickSortState = {
  i: number
  step: number
  arr: number[]
  n: number
  lo: number; hi: number       // 当前区间
  pivotVal: number             // 本区间基准值（-1=非分区态）
  iPtr: number                 // <pivot 区的右边界
  jPtr: number                 // 扫描指针 / 本步作用位
  swapWith: number             // 交换的另一端（-1=无）
  act: string                  // 'pivot'|'grow'|'swap'|'keep'|'place'|'single'|'done'
  locked: boolean[]            // 已归位（最终位置）
  sortedCount: number
  phase: 'run' | 'done'
  log: string
}

export const QUICKSORT_VISIBLE = [
  'step', 'arr', 'n', 'lo', 'hi', 'pivotVal', 'iPtr', 'jPtr', 'swapWith', 'act', 'locked', 'sortedCount', 'phase', 'log',
] as const

type Frame = Omit<QuickSortState, 'i'>

export const quicksortKernel: Kernel<QuickSortState> = {
  kind: 'quicksort',

  compile(_doc: SimDocument): CompiledModel<QuickSortState> {
    const arr = INIT.slice()
    const N = arr.length
    const locked = Array(N).fill(false)
    const frames: Frame[] = []
    const cnt = () => locked.filter(Boolean).length

    const push = (extra: Partial<Frame>) => frames.push({
      step: frames.length, arr: arr.slice(), n: N, lo: 0, hi: N - 1, pivotVal: -1,
      iPtr: -1, jPtr: -1, swapWith: -1, act: '', locked: locked.slice(), sortedCount: cnt(),
      phase: 'run', log: '', ...extra,
    })

    // 显式栈：先处理左段（后 push 左 → 先 pop）
    const stack: [number, number][] = [[0, N - 1]]
    while (stack.length) {
      const [lo, hi] = stack.pop()!
      if (lo > hi) continue
      if (lo === hi) {
        locked[lo] = true
        push({ act: 'single', lo, hi, jPtr: lo, log: `区间只剩 1 个数(#${lo}=${arr[lo]})——天然有序,**直接归位**。` })
        continue
      }
      const pivot = arr[hi]
      let i = lo - 1
      push({ act: 'pivot', lo, hi, pivotVal: pivot, jPtr: hi, iPtr: i, log: `新区间 [${lo},${hi}],挑**末元素 ${pivot} 当基准**。扫描:比 ${pivot} 小的收到左边。` })
      for (let j = lo; j < hi; j++) {
        if (arr[j] < pivot) {
          i++
          if (i !== j) {
            ;[arr[i], arr[j]] = [arr[j], arr[i]]
            push({ act: 'swap', lo, hi, pivotVal: pivot, iPtr: i, jPtr: j, swapWith: i, log: `${arr[i]} < ${pivot} → 换到左区,和 #${i} 交换。<区扩到 #${i}。` })
          } else {
            push({ act: 'grow', lo, hi, pivotVal: pivot, iPtr: i, jPtr: j, log: `${arr[j]} < ${pivot} → 本就在左区边界,**并入<区**(原地),<区扩到 #${i}。` })
          }
        } else {
          push({ act: 'keep', lo, hi, pivotVal: pivot, iPtr: i, jPtr: j, log: `${arr[j]} ≥ ${pivot} → 不动,留在右边。` })
        }
      }
      const p = i + 1
      ;[arr[p], arr[hi]] = [arr[hi], arr[p]]
      locked[p] = true
      push({ act: 'place', lo, hi, pivotVal: pivot, iPtr: i, jPtr: p, swapWith: hi, log: `扫描完:基准 ${pivot} 和分界位 #${p} 对调 → ${pivot} **归位**(左边全比它小、右边全不小于)。此位永久锁定。` })
      stack.push([p + 1, hi])
      stack.push([lo, p - 1])
    }

    push({
      act: 'done', jPtr: -1, phase: 'done',
      log: `**排序完成**:[${arr.join(',')}]。分而治之——每趟 partition 让一个基准归位、把问题切成左右两段各自递归,段越切越短到 1。` +
        `平均 O(n log n)、原地、常数小,是实践中最快的通用排序(C++ sort、各语言库底子都是它)。`,
    })

    const base0: Frame = {
      step: -1, arr: INIT.slice(), n: N, lo: 0, hi: N - 1, pivotVal: -1, iPtr: -1, jPtr: -1, swapWith: -1,
      act: '', locked: Array(N).fill(false), sortedCount: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '分区/归位' },
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
