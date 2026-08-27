/**
 * 内核：感知机 Perceptron（深度学习算法 · 原理：一个神经元靠"错了就纠"学出一条分界线）
 * 轴：step —— 平面上两类点,感知机=一条线 w·x+b=0。逐点检查:分对了不动,分错了就把线朝该点**纠一下**
 *      (w += y·x, b += y),一轮轮扫,直到某一整轮**零错误**——线就学好了(数据线性可分时保证收敛)。
 *
 * 感知机是神经网络的**最小单元**:给输入各配一个权重 w、加个偏置 b,算 w·x+b,看正负判类别——
 * 几何上就是一条**分界线**(高维是超平面)。它怎么"学"?**错了就纠**:遇到一个分错的点,
 * 把权重朝"下次能分对它"的方向挪一点(w += y·x、b += y,y=±1 是真实类别)。反复扫所有点,
 * 只要两类**线性可分**,感知机收敛定理保证有限步内学到一条能全分对的线。
 *
 * 本实验:6 个点(3 正 3 负)。看那条线从"乱猜"开始,每遇到一个分错的点就纠一下、慢慢转到位,
 * 5 次更新后某一轮零错误 → 收敛,w=(-3,2)、b=1。每步的 score=w·x+b、更新量都可手算核对。
 * 它是逻辑回归、SVM、乃至整个深度网络里每个神经元的祖先——只是激活换成了硬阈值 sign。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Pt = { x: [number, number]; y: number }
const PTS: Pt[] = [
  { x: [1, 2], y: 1 }, { x: [2, 3], y: 1 }, { x: [2, 4], y: 1 },
  { x: [3, 2], y: -1 }, { x: [4, 3], y: -1 }, { x: [4, 1], y: -1 },
]

export type PerceptronState = {
  i: number
  step: number
  pts: Pt[]
  w: [number, number]
  b: number
  prevW: [number, number]
  prevB: number
  pass: number
  ptIdx: number                // 当前检查的点（-1=收敛帧）
  score: number
  ok: boolean
  updated: boolean
  updates: number
  act: string                  // 'check' | 'converged' | 'done'
  phase: 'run' | 'done'
  log: string
}

export const PERCEPTRON_VISIBLE = [
  'step', 'pts', 'w', 'b', 'prevW', 'prevB', 'pass', 'ptIdx', 'score', 'ok', 'updated', 'updates', 'act', 'phase', 'log',
] as const

type Frame = Omit<PerceptronState, 'i'>

export const perceptronKernel: Kernel<PerceptronState> = {
  kind: 'perceptron',

  compile(_doc: SimDocument): CompiledModel<PerceptronState> {
    const frames: Frame[] = []
    let w: [number, number] = [0, 0]
    let b = 0, updates = 0

    for (let pass = 0; pass < 12; pass++) {
      let mistakes = 0
      for (let idx = 0; idx < PTS.length; idx++) {
        const p = PTS[idx]
        const score = w[0] * p.x[0] + w[1] * p.x[1] + b
        const pred = score > 0 ? 1 : -1
        const ok = pred === p.y
        const prevW: [number, number] = [w[0], w[1]]
        const prevB = b
        if (!ok) {
          w = [w[0] + p.y * p.x[0], w[1] + p.y * p.x[1]]
          b = b + p.y
          updates++; mistakes++
        }
        frames.push({
          step: frames.length, pts: PTS, w: [w[0], w[1]], b, prevW, prevB, pass, ptIdx: idx,
          score, ok, updated: !ok, updates, act: 'check', phase: 'run',
          log: `第 ${pass + 1} 轮 · 点 (${p.x.join(',')}) 真实类 ${p.y > 0 ? '正' : '负'}:score = w·x+b = ${score}。` +
            (ok ? `符号对 → **分对了**,不动。`
              : `符号错(判成${score > 0 ? '正' : '负'}) → **纠**:w 加 ${p.y > 0 ? '+' : '−'}(${p.x.join(',')})、b ${p.y > 0 ? '+1' : '−1'} → w=(${w.join(',')})、b=${b}。`),
        })
      }
      if (mistakes === 0) {
        frames.push({
          step: frames.length, pts: PTS, w: [w[0], w[1]], b, prevW: [w[0], w[1]], prevB: b, pass: pass + 1, ptIdx: -1,
          score: 0, ok: true, updated: false, updates, act: 'converged', phase: 'run',
          log: `第 ${pass + 1} 轮:6 个点**全部分对、零更新** → **收敛**!学到的线 w=(${w.join(',')})、b=${b}。`,
        })
        break
      }
    }

    frames.push({
      step: frames.length, pts: PTS, w: [w[0], w[1]], b, prevW: [w[0], w[1]], prevB: b, pass: -1, ptIdx: -1,
      score: 0, ok: true, updated: false, updates, act: 'done', phase: 'done',
      log: `**学好了**:一条线 w=(${w.join(',')})、b=${b} 把两类点全分开,共 ${updates} 次更新。` +
        `感知机=一个神经元:w·x+b 判正负、"错了就纠"地学。它是逻辑回归、SVM 和整个深度网络里每个神经元的祖先(激活换成 sign)。` +
        `只对线性可分才收敛——不可分(如异或)得靠多层、非线性激活,那就是多层感知机/神经网络。`,
    })

    const base0: Frame = {
      step: -1, pts: PTS, w: [0, 0], b: 0, prevW: [0, 0], prevB: 0, pass: 0, ptIdx: -1,
      score: 0, ok: true, updated: false, updates: 0, act: '', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '逐点检查/纠正' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b2 = prev ?? this.initial()
        const idx = b2.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
