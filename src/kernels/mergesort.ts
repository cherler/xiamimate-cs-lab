/**
 * 内核：归并排序 Merge Sort（经典算法 · 原理：分到不能再分，再两两有序地合并回去）
 * 轴：step —— 自底向上:先把数组看成一堆长度 1 的有序段,一轮轮把相邻两段**归并**成更长的有序段,
 *      每次归并=比两段的**队首**、把小的先取走,直到整段有序;段宽 1→2→4→… 翻倍直到覆盖全数组。
 *
 * 归并排序是**分治**的另一面:快排是"先分区再递归",归并是"分到底再合并"。把数组不断对半拆,
 * 拆到每段只剩 1 个(天然有序);然后**两两归并**——合并两个**已排好**的段时,只需比较各自的队首、
 * 把较小的先放进输出,一趟线性扫描就能把两段拼成一个更长的有序段。合并的段越来越长,直到整个数组有序。
 *
 * 它稳定(相等元素不换序)、最坏也稳稳 **O(n log n)**(共 log n 轮、每轮扫 n),代价是要一块额外缓冲区。
 * 外部排序(数据大到装不下内存,分块排好再多路归并)、稳定排序需求、链表排序,都靠它。
 * 本实验:7 个数 [5,2,8,1,9,3,7]。看长度 1 的段两两归并成 2、再成 4…每次比队首取小的,拼出 [1,2,3,5,7,8,9]。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const INIT = [5, 2, 8, 1, 9, 3, 7]

export type MergeSortState = {
  i: number
  step: number
  arr: number[]
  n: number
  width: number                // 本轮段宽（归并前每段的长度）
  lo: number; mid: number; hi: number   // 当前归并的两段：[lo,mid) 与 [mid,hi)
  li: number; rj: number       // 两段各自的队首指针（绝对下标）
  out: number[]                // 本段归并的输出缓冲
  took: number                 // 本步取走的值（-1=本段完成）
  from: string                 // 'L' | 'R' | ''
  focus: number                // 本步取走元素的原下标
  act: string                  // 'emit' | 'drain' | 'done'
  phase: 'run' | 'done'
  log: string
}

export const MERGESORT_VISIBLE = [
  'step', 'arr', 'n', 'width', 'lo', 'mid', 'hi', 'li', 'rj', 'out', 'took', 'from', 'focus', 'act', 'phase', 'log',
] as const

type Frame = Omit<MergeSortState, 'i'>

export const mergesortKernel: Kernel<MergeSortState> = {
  kind: 'mergesort',

  compile(_doc: SimDocument): CompiledModel<MergeSortState> {
    const arr = INIT.slice()
    const N = arr.length
    const frames: Frame[] = []

    const push = (extra: Partial<Frame>) => frames.push({
      step: frames.length, arr: arr.slice(), n: N, width: 1, lo: 0, mid: 0, hi: 0, li: -1, rj: -1,
      out: [], took: -1, from: '', focus: -1, act: '', phase: 'run', log: '', ...extra,
    })

    for (let w = 1; w < N; w *= 2) {
      for (let lo = 0; lo < N; lo += 2 * w) {
        const mid = Math.min(lo + w, N), hi = Math.min(lo + 2 * w, N)
        if (mid >= hi) continue   // 落单的段，本轮不动
        const left = arr.slice(lo, mid), right = arr.slice(mid, hi)
        let i = 0, j = 0
        const out: number[] = []
        const emit = (val: number, from: string, focus: number, act: string) => {
          out.push(val)
          push({
            width: w, lo, mid, hi, li: lo + i, rj: mid + j, out: out.slice(), took: val, from, focus, act,
            log: (from === 'L' ? `左段队首 ${val}` : `右段队首 ${val}`) +
              (act === 'drain' ? `——另一段空了,${from === 'L' ? '左' : '右'}段剩下的直接接上。` :
                ` ${from === 'L' ? '≤' : '<'} 另一段队首 → **取小的**放进输出。`),
          })
        }
        while (i < left.length && j < right.length) {
          if (left[i] <= right[j]) { emit(left[i], 'L', lo + i, 'emit'); i++ }
          else { emit(right[j], 'R', mid + j, 'emit'); j++ }
        }
        while (i < left.length) { emit(left[i], 'L', lo + i, 'drain'); i++ }
        while (j < right.length) { emit(right[j], 'R', mid + j, 'drain'); j++ }
        for (let k = 0; k < out.length; k++) arr[lo + k] = out[k]
        push({
          width: w, lo, mid, hi, li: mid, rj: hi, out: out.slice(), took: -1, from: '', focus: -1, act: 'done',
          log: `两段归并完成 → [${out.join(',')}]。段宽 ${w} 的两段拼成了宽 ${out.length} 的有序段。`,
        })
      }
    }

    push({
      act: 'done', phase: 'done', out: arr.slice(),
      log: `**排序完成**:[${arr.join(',')}]。分到长度 1、再两两归并回去——合并两个有序段只需比队首取小的,一趟线性。` +
        `稳定、最坏也 O(n log n)(log n 轮×每轮扫 n),代价是额外缓冲。外部排序、稳定排序、链表排序都靠它。`,
    })

    const base0: Frame = {
      step: -1, arr: INIT.slice(), n: N, width: 1, lo: 0, mid: 0, hi: 0, li: -1, rj: -1,
      out: [], took: -1, from: '', focus: -1, act: '', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '归并' },
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
