/**
 * 内核：快速选择 Quickselect —— 找第 K 大不用全排序，平均 O(n)（算法 · 项目实战 / 求职）
 * 轴：step —— 每轮 partition 定一个 pivot 的最终位置，只往"目标所在的那一侧"递归
 *
 * "求第 K 大 / Top-K"如果全排序是 O(n㏒n)。**Quickselect** 借快排的 partition，但每轮**只递归一侧**：
 *   partition 把 pivot 放到它排序后的最终位置 P；
 *   · P == 目标位置 → 就是它，返回；
 *   · P > 目标 → 答案在左半 → 只递归左；· P < 目标 → 只递归右。
 * 因为每轮丢掉一半、只处理另一半，平均复杂度 T(n)=T(n/2)+O(n)=**O(n)**（快排是两侧都递归=O(n㏒n)）。
 * 本例 [7,2,9,4,5,1,8] 找第 3 大 → 升序第 n-k=4 位。3 轮 partition 收敛到 A[4]=7。
 * 值:每轮 pivot 落位、递归哪侧都可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const INIT = [7, 2, 9, 4, 5, 1, 8]
const K = 3   // 第 3 大

export type QSelState = {
  i: number
  step: number
  op: 'intro' | 'round' | 'found'
  round: number
  arr: number[]
  lo: number
  hi: number
  pivot: number
  pivotIdx: number         // partition 后 pivot 的最终下标（-1 未 partition）
  target: number           // 目标下标（升序第 n-K 位）
  decision: 'left' | 'right' | 'found' | ''
  answer: number
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<QSelState, 'i'>

export const quickselectKernel: Kernel<QSelState> = {
  kind: 'quickselect',
  compile(_doc: SimDocument): CompiledModel<QSelState> {
    const A = [...INIT]
    const n = A.length
    const target = n - K
    const frames: Frame[] = []
    const show = (a: number[]) => `[${a.join(' ')}]`
    const push = (f: Omit<Frame, 'step' | 'arr' | 'target'>) => frames.push({ step: frames.length, arr: [...A], target, ...f })

    push({ op: 'intro', round: 0, lo: 0, hi: n - 1, pivot: -1, pivotIdx: -1, decision: '', answer: -1, phase: 'run', focus: '找第 K 大不用全排序：partition + 只递归一侧',
      log: `**快速选择 Quickselect**\n求第 ${K} 大，全排序要 O(n㏒n)。Quickselect 借快排的 **partition**，但每轮**只递归一侧** → 平均 **O(n)**。\n数组 ${show(A)}，找第 **${K}** 大 = 升序第 **${target}** 位（0 基）。看它怎么一轮轮逼近。` })

    let lo = 0, hi = n - 1, round = 0
    while (true) {
      round++
      const pivot = A[hi]!; let i = lo - 1
      for (let j = lo; j < hi; j++) { if (A[j]! <= pivot) { i++;[A[i], A[j]] = [A[j]!, A[i]!] } }
      i++;[A[i], A[hi]] = [A[hi]!, A[i]!]
      const decision: QSelState['decision'] = i === target ? 'found' : i > target ? 'left' : 'right'
      push({ op: decision === 'found' ? 'found' : 'round', round, lo, hi, pivot, pivotIdx: i, decision, answer: decision === 'found' ? A[i]! : -1, phase: decision === 'found' ? 'done' : 'run',
        focus: `第 ${round} 轮：pivot=${pivot} 落在下标 ${i}，${decision === 'found' ? '正好是目标 → 命中' : decision === 'left' ? `${i} > 目标 ${target} → 只递归左半` : `${i} < 目标 ${target} → 只递归右半`}`,
        log: `**第 ${round} 轮 · partition**\n在窗口 [${lo}, ${hi}] 上，以 **${pivot}**（末元素）为 pivot 划分：≤pivot 的挪到左边。\n结果 ${show(A)}，pivot **${pivot}** 落到它的最终位置 **下标 ${i}**。\n比目标下标 ${target}：${i === target ? `**相等 → 就是它！第 ${K} 大 = ${A[i]}**` : i > target ? `${i} > ${target} → 目标在**左半**，下轮只搜 [${lo}, ${i - 1}]（右半整个丢掉，这就是省下的一半）。` : `${i} < ${target} → 目标在**右半**，下轮只搜 [${i + 1}, ${hi}]。`}` })
      if (decision === 'found') break
      if (decision === 'left') hi = i - 1; else lo = i + 1
    }

    const last = frames[frames.length - 1]!
    last.log += `\n\n**小结**：Quickselect = partition 定 pivot 位置 + **只递归目标所在的一侧**。平均 O(n)（快排两侧都递归=O(n㏒n)）；最坏 O(n²)（pivot 每次极端），随机选 pivot 或用中位数的中位数可保证 O(n)。求第 K 大 / Top-K、找中位数都用它——比"全排序再取第 K 个"快一个量级。面试讲：和快排的区别（只递归一侧）、复杂度怎么来的、最坏情况怎么避免。`

    const base0: Frame = { op: 'intro', step: -1, round: 0, arr: [...INIT], lo: 0, hi: n - 1, pivot: -1, pivotIdx: -1, target, decision: '', answer: -1, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '选择轮' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
