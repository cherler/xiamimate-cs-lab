/**
 * 内核：二叉堆 Heap（经典算法 · 原理：一棵"父永远≥子"的完全二叉树，堆顶永远是最大）
 * 轴：step —— 把乱序数组 sift-down 成最大堆，再取一次堆顶(最大值)、把末尾补上再下沉复原
 *
 * 堆是优先队列的标准实现:一棵**完全二叉树**,满足**堆序**——每个父节点都 ≥ 它的两个孩子(最大堆)。
 * 于是**堆顶(根)永远是全体最大**,取最大 O(1) 看、O(log n) 移除。它还能**紧凑地压进一个数组**:
 * 下标 i 的孩子就在 2i+1、2i+2,父亲在 (i-1)/2——不用指针,纯下标算。
 *
 * 核心操作是 **sift-down(下沉)**:一个节点若比孩子小,就和**更大的那个孩子**交换、一路沉到位。
 * **建堆**=从最后一个非叶节点起、倒着对每个节点 sift-down,O(n) 就能把乱序数组整成堆。
 * **取最大**=把堆顶和末尾对调、堆大小减一(最大值就排到了数组尾),再对新堆顶 sift-down 复原——
 * 反复做就是**堆排序**。
 *
 * 本实验:7 个数 [3,9,2,1,7,5,8]。先建最大堆(看节点一个个下沉),再取一次堆顶 9(排到尾),
 * 补位后再下沉复原。树形 + 数组双视图,每步的父子比较、交换、堆序都可对着核对。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const INIT = [3, 9, 2, 1, 7, 5, 8]

export type HeapState = {
  i: number
  step: number
  arr: number[]
  heapN: number         // 仍在堆内的元素个数（其余在尾部已排序）
  node: number          // 当前下沉的节点
  child: number         // 参与比较/交换的孩子（-1=到位）
  act: string           // 'sift' | 'settle' | 'extract' | 'done'
  stage: string         // 'build' | 'extract'
  sortedFrom: number    // 数组下标 ≥ 此值的都是已排出的最大值
  phase: 'run' | 'done'
  log: string
}

export const HEAP_VISIBLE = [
  'step', 'arr', 'heapN', 'node', 'child', 'act', 'stage', 'sortedFrom', 'phase', 'log',
] as const

type Frame = Omit<HeapState, 'i'>

export const heapKernel: Kernel<HeapState> = {
  kind: 'heap',

  compile(_doc: SimDocument): CompiledModel<HeapState> {
    const arr = INIT.slice()
    const N = arr.length
    const frames: Frame[] = []
    const nm = (i: number) => `${arr[i]}(#${i})`

    const push = (extra: Partial<Frame>) => frames.push({
      step: frames.length, arr: arr.slice(), heapN: N, node: -1, child: -1, act: '', stage: 'build',
      sortedFrom: N, phase: 'run', log: '', ...extra,
    })

    const siftDown = (i: number, n: number, stage: string, sortedFrom: number) => {
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2
        let m = i
        if (l < n && arr[l] > arr[m]) m = l
        if (r < n && arr[r] > arr[m]) m = r
        if (m === i) {
          push({
            node: i, child: -1, act: 'settle', stage, heapN: n, sortedFrom,
            log: `节点 ${nm(i)} 已 ≥ 它的孩子${l < n ? `(${arr[l]}${r < n ? '、' + arr[r] : ''})` : '(无孩子)'}——**到位**,不用再沉。`,
          })
          break
        }
        const childVal = arr[m]
        ;[arr[i], arr[m]] = [arr[m], arr[i]]
        push({
          node: m, child: i, act: 'sift', stage, heapN: n, sortedFrom,
          log: `节点 ${arr[m]}(现#${i}) 比更大的孩子 ${childVal} 小 → **交换**,${childVal} 上浮、${arr[m]} 继续往下沉到 #${m}。`,
        })
        i = m
      }
    }

    // 建堆：从最后一个非叶节点倒着 sift-down
    push({ act: 'settle', node: -1, log: `起点:乱序数组 [${arr.join(',')}]。从最后一个非叶节点 #${Math.floor(N / 2) - 1} 起,倒着把每个节点 sift-down,整成最大堆。` })
    for (let i = Math.floor(N / 2) - 1; i >= 0; i--) siftDown(i, N, 'build', N)

    push({ act: 'settle', node: 0, stage: 'build', log: `**最大堆建成**:[${arr.join(',')}]。每个父都 ≥ 孩子,堆顶 ${arr[0]} 就是全体最大。` })

    // 取最大一次：堆顶↔末尾，堆大小减一，再 sift-down 复原
    const maxVal = arr[0]
    ;[arr[0], arr[N - 1]] = [arr[N - 1], arr[0]]
    push({
      act: 'extract', node: 0, child: N - 1, stage: 'extract', heapN: N - 1, sortedFrom: N - 1,
      log: `**取最大**:堆顶 ${maxVal} 和末尾 ${arr[N - 1]}(原#0) 对调 → ${maxVal} 排到数组尾(就位)。堆缩到 ${N - 1} 个,新堆顶暂时是 ${arr[0]},需要下沉复原。`,
    })
    siftDown(0, N - 1, 'extract', N - 1)

    push({
      act: 'done', node: 0, stage: 'extract', heapN: N - 1, sortedFrom: N - 1, phase: 'done',
      log: `**复原完成**:新堆 [${arr.slice(0, N - 1).join(',')}],堆顶 ${arr[0]} 是剩下的最大;${maxVal} 已排到尾。` +
        `反复"取顶→补位→下沉"就是**堆排序**(O(n log n))。堆=优先队列的标配:任务调度、Dijkstra、Top-K、合并 K 路有序流,都靠它 O(log n) 拿最值。`,
    })

    const base0: Frame = {
      step: -1, arr: INIT.slice(), heapN: N, node: -1, child: -1, act: '', stage: 'build', sortedFrom: N, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '下沉/取顶' },
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
