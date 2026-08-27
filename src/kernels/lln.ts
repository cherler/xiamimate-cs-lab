/**
 * 内核：大数定理 / 蒙特卡洛（机器学习基础 · 原理：为什么"多采样就准"）
 * 轴：step —— 逐步增大撒点数 n，用蒙特卡洛估 π，看估计怎么收敛、误差怎么随 1/√n 缩
 *
 * 大数定理：独立同分布样本的**均值**，随样本数 n 增大**收敛到期望**；而估计的**误差随 √n 缩小**
 * （标准误 ∝ 1/√n，来自方差可加——n 个独立项相加、方差涨 n 倍、std 涨 √n，均值的 std 就 ∝ 1/√n）。
 * 这是采样、蒙特卡洛、dropout、MoE 路由"平均下来对"的底：单次随机不可靠，多次平均就稳。
 *
 * 经典演示——蒙特卡洛估 π：在单位正方形里随机撒 n 个点，落进 1/4 圆(x²+y²≤1)的比例 × 4 ≈ π。
 * 逐步把 n 从 50 加到 12800。**单条随机路径太吵**，说明不了"1/√n"，所以每个 n 跑 T=40 次**独立**试验、
 * 报告 **RMS 误差**（√(均方误差)）。理论上单次估计 4·p̂ 的方差 = 16·p(1-p)/n（p=π/4），于是
 * RMS 误差 ≈ 4·√(p(1-p)) / √n ≈ **1.64/√n**——所以 **RMS误差×√n ≈ 1.64 恒定**，把"误差∝1/√n"钉死。
 * 场上同时展示第 0 次试验的散点(可视化)。值全部现算、可核对（确定性伪随机，可复现）。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const PI = Math.PI

export type LlnState = {
  i: number
  step: number
  n: number                    // 每次试验的撒点数
  trials: number               // 独立试验次数 T
  estimate: number             // 第 0 次试验的 π 估计（与散点一致）
  meanEst: number              // T 次估计的均值（≈π，体现无偏）
  rmsError: number             // T 次的 RMS 误差 = √(mean((est-π)²))
  rmsErrSqrtN: number          // RMS误差×√n（≈1.64 恒定，体现 1/√n）
  inside: number               // 第 0 次试验落进 1/4 圆的点数
  points: { x: number; y: number; in: boolean }[]  // 第 0 次试验的散点（截断展示）
  phase: 'run' | 'done'
  log: string
}

export const LLN_VISIBLE = [
  'step', 'n', 'trials', 'estimate', 'meanEst', 'rmsError', 'rmsErrSqrtN', 'inside', 'points', 'phase', 'log',
] as const

type Frame = Omit<LlnState, 'i'>

const N_VALUES = [50, 200, 800, 3200, 12800]
const TRIALS = 40    // 每个 n 的独立试验次数
const SHOW_MAX = 400 // 散点最多画这么多（大 n 只抽样展示）

function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0x100000000 }
}

export const llnKernel: Kernel<LlnState> = {
  kind: 'lln',

  compile(_doc: SimDocument): CompiledModel<LlnState> {
    const frames: Frame[] = []

    N_VALUES.forEach((n, step) => {
      const ests: number[] = []
      let firstInside = 0
      let firstPoints: { x: number; y: number; in: boolean }[] = []
      for (let t = 0; t < TRIALS; t++) {
        const rand = lcg(20240824 + t * 2654435761)  // 每次独立 seed，可复现
        let inside = 0
        const points: { x: number; y: number; in: boolean }[] = []
        const showEvery = Math.max(1, Math.floor(n / SHOW_MAX))
        for (let k = 0; k < n; k++) {
          const x = rand(), y = rand()
          const isIn = x * x + y * y <= 1
          if (isIn) inside++
          if (t === 0 && k % showEvery === 0 && points.length < SHOW_MAX) points.push({ x: +x.toFixed(3), y: +y.toFixed(3), in: isIn })
        }
        ests.push(4 * inside / n)
        if (t === 0) { firstInside = inside; firstPoints = points }
      }
      const estimate = ests[0]
      const meanEst = ests.reduce((a, b) => a + b, 0) / TRIALS
      const rmsError = Math.sqrt(ests.reduce((a, e) => a + (e - PI) * (e - PI), 0) / TRIALS)
      const rmsErrSqrtN = rmsError * Math.sqrt(n)
      frames.push({
        step, n, trials: TRIALS,
        estimate: +estimate.toFixed(4), meanEst: +meanEst.toFixed(4),
        rmsError: +rmsError.toFixed(4), rmsErrSqrtN: +rmsErrSqrtN.toFixed(2),
        inside: firstInside, points: firstPoints, phase: 'run',
        log: `每次撒 **${n}** 点、跑 ${TRIALS} 次独立试验：均值估计 **${meanEst.toFixed(3)}**（≈π，无偏），` +
          `RMS 误差 = **${rmsError.toFixed(3)}**，RMS误差×√n = **${rmsErrSqrtN.toFixed(2)}**。` +
          `n 越大误差越小，而 ×√n 后≈常数——误差按 1/√n 缩。（散点=第 0 次试验，π≈${estimate.toFixed(3)}）`,
      })
    })

    const lastN = N_VALUES[N_VALUES.length - 1]
    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `从 50 点到 ${lastN} 点：均值估计始终 ≈3.14159（无偏），RMS 误差一路变小。关键看 **RMS误差×√n ≈ 1.64 恒定**` +
        `——理论值 4·√(p(1−p))≈1.64（p=π/4）。这就是"误差 ∝ 1/√n"：样本翻 4 倍、误差才减半。大数定理 + 方差可加的` +
        `直接体现，也是采样、蒙特卡洛、dropout、MoE 路由"多次平均就稳"的底：单次随机不可靠，n 个独立样本一平均、方差缩 n 倍。`,
    })

    const base0: Frame = {
      step: -1, n: 0, trials: TRIALS, estimate: 0, meanEst: 0, rmsError: 0, rmsErrSqrtN: 0, inside: 0, points: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '撒点数 n' },
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
