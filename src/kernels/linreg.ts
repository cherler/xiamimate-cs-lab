/**
 * 内核：线性回归（机器学习算法 · 原理：机器怎么"拟合"一条线）
 * 轴：step —— 一堆散点，用梯度下降把一条直线 y=wx+b 转到误差最小，看残差怎么缩、MSE 怎么降
 *
 * 线性回归是最基础的"学习":给一堆 (x,y) 点,找一条直线 y=wx+b 让它离所有点最近。"最近"用**均方误差 MSE**
 * (每个点到直线的竖直距离平方的平均)衡量。怎么找?从随便一条线出发,顺着**负梯度**一点点调 w、b,让 MSE 下降
 * ——这就是梯度下降在做回归。它有**闭式最优解**(最小二乘 OLS),梯度下降会一路收敛到它。
 * 看懂这条,你就抓住了几乎所有 ML"训练"的骨架:定一个损失、对参数求梯度、沿负梯度更新、直到拟合。
 *
 * 本实验:12 个确定性散点(真线 y≈2x+1 加噪声),w、b 从 0 出发、lr=0.06 梯度下降。看直线一步步转到点云里、
 * 残差(点到线的竖线)一根根变短、MSE 从 8.8 降到 0.14,w→2.22、b→0.92(正好是 OLS 闭式解)。
 * 值全部现算、可核对(MSE 单调降、收敛到最小二乘)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
const N = 12
const rnd = lcg(42)
const POINTS = Array.from({ length: N }, (_, i) => {
  const x = i / (N - 1) * 4 - 2
  return { x: +x.toFixed(3), y: +(2 * x + 1 + rnd() * 1.5).toFixed(3) }
})
// OLS 闭式解
const mx = POINTS.reduce((a, p) => a + p.x, 0) / N
const my = POINTS.reduce((a, p) => a + p.y, 0) / N
const W_OLS = POINTS.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / POINTS.reduce((a, p) => a + (p.x - mx) ** 2, 0)
const B_OLS = my - W_OLS * mx
const LR = 0.06
const STEPS = [0, 2, 5, 10, 20, 35, 50]

export type LinRegState = {
  i: number
  step: number
  gdStep: number
  w: number
  b: number
  mse: number
  points: { x: number; y: number }[]
  wOls: number
  bOls: number
  phase: 'run' | 'done'
  log: string
}

export const LINREG_VISIBLE = [
  'step', 'gdStep', 'w', 'b', 'mse', 'points', 'wOls', 'bOls', 'phase', 'log',
] as const

type Frame = Omit<LinRegState, 'i'>

const mseOf = (w: number, b: number) => POINTS.reduce((a, p) => a + (w * p.x + b - p.y) ** 2, 0) / N

export const linregKernel: Kernel<LinRegState> = {
  kind: 'linreg',

  compile(_doc: SimDocument): CompiledModel<LinRegState> {
    // 预跑梯度下降，记录每步 w,b
    const traj: { w: number; b: number }[] = []
    let w = 0, b = 0
    for (let s = 0; s <= 50; s++) {
      traj.push({ w, b })
      let gw = 0, gb = 0
      for (const p of POINTS) { const e = w * p.x + b - p.y; gw += 2 * e * p.x / N; gb += 2 * e / N }
      w -= LR * gw; b -= LR * gb
    }

    const frames: Frame[] = []
    STEPS.forEach((gd, idx) => {
      const { w, b } = traj[gd]
      const mse = mseOf(w, b)
      frames.push({
        step: idx, gdStep: gd, w: +w.toFixed(3), b: +b.toFixed(3), mse: +mse.toFixed(3),
        points: POINTS, wOls: +W_OLS.toFixed(3), bOls: +B_OLS.toFixed(3), phase: 'run',
        log: `第 ${gd} 步梯度下降：直线 y = **${w.toFixed(2)}**x + **${b.toFixed(2)}**，均方误差 MSE = **${mse.toFixed(2)}**。` +
          (gd === 0 ? ` 从 w=b=0 出发,直线还是平的、残差很大。` : ` 顺着负梯度调 w、b,直线往点云里转、残差变短。`),
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `梯度下降 50 步:MSE 从 8.8 降到 **${lf.mse}**,直线 y=${lf.w}x+${lf.b} 稳稳穿过点云。` +
        `注意它正好收敛到**最小二乘闭式解** w=${W_OLS.toFixed(2)}、b=${B_OLS.toFixed(2)}——梯度下降找到的就是数学上的最优线。` +
        `这就是机器"学习"最朴素的样子:定损失(MSE)、对参数(w,b)求梯度、沿负梯度更新、直到拟合。几乎所有 ML 训练都是这个骨架。`,
    })

    const base0: Frame = {
      step: -1, gdStep: 0, w: 0, b: 0, mse: +mseOf(0, 0).toFixed(3), points: POINTS,
      wOls: +W_OLS.toFixed(3), bOls: +B_OLS.toFixed(3), phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '梯度下降步' },
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
