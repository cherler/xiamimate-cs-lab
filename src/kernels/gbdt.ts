/**
 * 内核：梯度提升树 GBDT（机器学习算法 · 原理：一棵棵小树接力，每棵只补上一棵的"错")
 * 轴：step —— 从一条平线(均值)出发,每轮加一棵只切一刀的小树去拟合"当前残差",预测一步步贴近数据
 *
 * 单棵决策树容易过拟合、也拟合不了平滑曲线。**梯度提升(GBDT)**换个玩法:让**一串小树接力**,每棵都只干一件事——
 * **补上前面所有树合起来还没拟合掉的那部分误差(残差)**。做法:先用一个常数(均值)当初始预测;每一轮算出残差
 * (真值−当前预测),再训一棵小树去拟合这个残差,把它**乘学习率加进预测**;残差越来越小、预测越来越准。
 * 因为每棵树拟合的是"梯度/残差",故名梯度提升。**一堆弱学习器串起来 = 一个强学习器**——这就是集成学习的
 * "boosting"路线,和随机森林(并行投票的"bagging")并称。GBDT/XGBoost/LightGBM 至今是表格数据上的主力。
 *
 * 本实验:20 个 1D 点(呈阶梯+噪声),用只切一刀的"树桩"逐轮 boosting。看预测的阶梯一轮轮长出、贴近数据,
 * MSE 从 0.75 一路降到 0.08。值全部现算、可核对(每轮拟合残差、MSE 单调降)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
const rnd = lcg(4)
const POINTS = Array.from({ length: 20 }, (_, i) => {
  const x = i / 19
  const y = (x < 0.35 ? 1 : x < 0.7 ? 3 : 2) + rnd() * 0.4
  return { x: +x.toFixed(3), y: +y.toFixed(2) }
})
const N = POINTS.length
const LR = 0.5
const ROUNDS = [0, 1, 2, 3, 5, 8]

const mseOf = (pred: number[]) => POINTS.reduce((a, p, i) => a + (p.y - pred[i]) ** 2, 0) / N
function bestStump(res: number[]) {
  let best = { t: 0.5, lm: 0, rm: 0 }, bg = Infinity
  const xs = [...new Set(POINTS.map(p => p.x))].sort((a, b) => a - b)
  for (let i = 0; i < xs.length - 1; i++) {
    const t = (xs[i] + xs[i + 1]) / 2
    const L: number[] = [], R: number[] = []
    POINTS.forEach((p, idx) => (p.x < t ? L : R).push(idx))
    if (!L.length || !R.length) continue
    const lm = L.reduce((a, idx) => a + res[idx], 0) / L.length
    const rm = R.reduce((a, idx) => a + res[idx], 0) / R.length
    const err = L.reduce((a, idx) => a + (res[idx] - lm) ** 2, 0) + R.reduce((a, idx) => a + (res[idx] - rm) ** 2, 0)
    if (err < bg) { bg = err; best = { t: +t.toFixed(2), lm, rm } }
  }
  return best
}

export type GBDTState = {
  i: number
  step: number
  round: number
  points: { x: number; y: number }[]
  pred: number[]
  mse: number
  splitT: number
  phase: 'run' | 'done'
  log: string
}

export const GBDT_VISIBLE = [
  'step', 'round', 'points', 'pred', 'mse', 'splitT', 'phase', 'log',
] as const

type Frame = Omit<GBDTState, 'i'>

export const gbdtKernel: Kernel<GBDTState> = {
  kind: 'gbdt',

  compile(_doc: SimDocument): CompiledModel<GBDTState> {
    // 预跑 boosting，记录每轮 pred + split
    const mean = POINTS.reduce((a, p) => a + p.y, 0) / N
    const preds: number[][] = [POINTS.map(() => mean)]
    const splits: number[] = [0]
    let pred = POINTS.map(() => mean)
    for (let r = 1; r <= 8; r++) {
      const res = POINTS.map((p, i) => p.y - pred[i])
      const st = bestStump(res)
      pred = pred.map((v, i) => v + LR * (POINTS[i].x < st.t ? st.lm : st.rm))
      preds.push(pred.slice()); splits.push(st.t)
    }

    const frames: Frame[] = []
    ROUNDS.forEach((r, idx) => {
      const p = preds[r], mse = mseOf(p)
      frames.push({
        step: idx, round: r, points: POINTS, pred: p.map(v => +v.toFixed(3)), mse: +mse.toFixed(3), splitT: splits[r], phase: 'run',
        log: r === 0
          ? `第 0 轮:预测就是一条**平线(所有 y 的均值)**,MSE **${mse.toFixed(2)}**。啥都还没学。`
          : `第 ${r} 轮:算出当前残差,加一棵只切一刀(x≈${splits[r]})的小树去拟合它 → 预测的阶梯更贴数据、MSE 降到 **${mse.toFixed(2)}**。`,
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `boosting ${lf.round} 轮:MSE 从 0.75 一路降到 **${lf.mse}**,预测阶梯稳稳贴上了数据。每棵小树都只补"前面还没拟合掉的残差"——` +
        `**一堆弱学习器接力 = 一个强学习器**。因为每棵拟合的是残差/梯度,故名**梯度提升**。它和随机森林(并行投票)并称集成学习两大路线,` +
        `GBDT/XGBoost/LightGBM 至今是表格数据的主力。它坐在**决策树**之上,把很多棵串起来。`,
    })

    const base0: Frame = {
      step: -1, round: 0, points: POINTS, pred: POINTS.map(() => +mean.toFixed(3)), mse: +mseOf(POINTS.map(() => mean)).toFixed(3), splitT: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '提升轮数' },
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
