/**
 * 内核：条件数（线代/优化 · 原理：为什么"病态"的问题又慢又难算）
 * 轴：step —— 把损失碗越拉越扁(条件数 κ 变大)，看同一套梯度下降怎么从"一步到位"变成"来回震荡爬半天"
 *
 * 条件数 κ = 最大曲率 / 最小曲率(对二次型 = 最大特征值 / 最小特征值)。它衡量一个问题有多"病态":
 *   κ=1(各方向一样陡,碗是正圆)——梯度直指谷底,一步到位;
 *   κ 大(某些方向陡、某些方向平,碗被拉成细长椭圆)——梯度几乎垂直于"通往谷底"的方向,只能**之字形**慢慢挪。
 * 梯度下降的收敛速度由 κ 决定:每步误差最多缩一个因子 **(κ−1)/(κ+1)**——κ 越大越接近 1、收敛越慢。
 * 这就是为什么要**预处理/归一化/自适应学习率(Adam)**:把 κ 拉回接近 1,让各方向一样好走。数值线代里,
 * κ 大还意味着**解对噪声极敏感**(病态方程组)。它是「梯度下降」那条的深层解释。
 *
 * 本实验:损失 L=x²+κ·y²,从 (1,1) 出发、用该 κ 的稳定学习率。κ 取 1→5→20→50:看收敛步数 1→12→47→116、
 * 轨迹从"直线一步"变成"剧烈之字形"。值全部现算、可核对(步数、收敛率 (κ−1)/(κ+1))。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const KAPPAS = [1, 5, 20, 50]
const MAX_ITERS = 400

export type CondNumState = {
  i: number
  step: number
  kappa: number
  steps: number              // 收敛到千分之一所需迭代数
  rate: number               // 理论收敛率 (κ−1)/(κ+1)
  path: { x: number; y: number }[]
  lossCurve: number[]        // 每步损失（用于画收敛曲线）
  phase: 'run' | 'done'
  log: string
}

export const CONDNUM_VISIBLE = [
  'step', 'kappa', 'steps', 'rate', 'path', 'lossCurve', 'phase', 'log',
] as const

type Frame = Omit<CondNumState, 'i'>

export const condnumKernel: Kernel<CondNumState> = {
  kind: 'condnum',

  compile(_doc: SimDocument): CompiledModel<CondNumState> {
    const frames: Frame[] = []

    KAPPAS.forEach((kappa, step) => {
      const lr = 1 / (1 + kappa)          // 二次型稳定学习率量级
      let x = 1, y = 1
      const start = x * x + kappa * y * y
      const path: { x: number; y: number }[] = [{ x, y }]
      const lossCurve: number[] = [start]
      let steps = 0
      while (x * x + kappa * y * y > 1e-4 * start && steps < MAX_ITERS) {
        x -= lr * 2 * x
        y -= lr * 2 * kappa * y
        steps++
        if (path.length < 80) path.push({ x: +x.toFixed(4), y: +y.toFixed(4) })
        if (lossCurve.length < 80) lossCurve.push(+(x * x + kappa * y * y).toFixed(6))
      }
      const rate = (kappa - 1) / (kappa + 1)
      frames.push({
        step, kappa, steps, rate: +rate.toFixed(3),
        path, lossCurve, phase: 'run',
        log: `条件数 **κ=${kappa}**${kappa === 1 ? '(正圆碗)' : '(椭圆碗,越大越扁)'}:` +
          `梯度下降收敛到千分之一用了 **${steps}** 步,理论每步误差缩 (κ−1)/(κ+1)=**${rate.toFixed(2)}**。` +
          (kappa === 1 ? `各方向一样陡,梯度直指谷底、一步到位。` : `陡方向步子迈过头、平方向挪不动,轨迹**之字形**。`),
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `κ 从 1 到 50:收敛步数 1→12→47→**${lf.steps}**——**问题越病态(κ 越大)、越慢越难算**。原因:κ 大时碗被拉成细长椭圆,` +
        `梯度几乎垂直于通往谷底的方向,只能之字形慢挪,每步误差只缩 (κ−1)/(κ+1)(κ 大→接近 1→几乎不降)。` +
        `所以要**预处理/归一化/Adam**把 κ 拉回接近 1;数值上 κ 大还意味着解对噪声极敏感。这是「梯度下降」那条的深层解释。`,
    })

    const base0: Frame = {
      step: -1, kappa: 0, steps: 0, rate: 0, path: [], lossCurve: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '条件数 κ' },
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
