/**
 * 内核：中心极限定理（机器学习基础 · 原理：为什么高斯分布到处都是）
 * 轴：step —— 逐步增大「每次平均多少个样本」m，看样本均值的分布怎么从平的变成钟形
 *
 * 中心极限定理(CLT)：不管原始分布长什么样(只要方差有限)，把 m 个独立同分布样本**平均**，
 * 当 m 增大，这个**均值的分布**就越来越接近**高斯(正态)分布**——而且均值的标准差按 **1/√m** 缩(接大数定理)。
 * 这就是为什么高斯分布在自然界、在深度学习里无处不在：任何"许多小随机因素相加"的量，天然趋向高斯。
 * 权重初始化、噪声假设、误差项、注意力打分的近似分析，背后都是它。
 *
 * 本实验用最"不像高斯"的**均匀分布 U[0,1]**(平的)当原始分布，逐步把 m 取 1→2→4→8→32：
 * 每个 m 跑 T=20000 次独立试验(每次=m 个均匀样本的平均)，把均值**标准化** z=(mean−0.5)/(σ/√m) 后做直方图，
 * 叠上标准正态曲线。看它从 m=1 的**平顶**(均匀本身)一步步长成 m=32 的**钟形**。
 * 值全部现算、可核对(确定性伪随机，可复现)：样本 std≈σ/√m(∝1/√m)、超额峰度→0(=高斯)、直方图贴合正态曲线。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// 均匀分布 U[0,1]：均值 0.5、方差 1/12、标准差 σ=1/√12
const SIGMA = 1 / Math.sqrt(12)   // ≈0.288675

export type CltState = {
  i: number
  step: number
  m: number                     // 每次平均的样本数
  trials: number                // 独立试验次数 T
  std: number                   // 样本均值的标准差（≈σ/√m）
  theoStd: number               // 理论 σ/√m
  exKurt: number                // 超额峰度（→0 = 高斯；均匀=−1.2）
  bins: { z: number; density: number; gauss: number }[]  // 标准化直方图 + 正态叠加
  phase: 'run' | 'done'
  log: string
}

export const CLT_VISIBLE = [
  'step', 'm', 'trials', 'std', 'theoStd', 'exKurt', 'bins', 'phase', 'log',
] as const

type Frame = Omit<CltState, 'i'>

const M_VALUES = [1, 2, 4, 8, 32]
const TRIALS = 20000
const B = 17                    // 直方图柱数
const LO = -3.4, HI = 3.4       // 标准化 z 的窗口
const W = (HI - LO) / B         // 柱宽

function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 0x100000000 }
}
const gaussPdf = (z: number) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)

export const cltKernel: Kernel<CltState> = {
  kind: 'clt',

  compile(_doc: SimDocument): CompiledModel<CltState> {
    const frames: Frame[] = []

    M_VALUES.forEach((m, step) => {
      const rand = lcg(20240824 + m * 7919)   // 每个 m 独立 seed，可复现
      const theoStd = SIGMA / Math.sqrt(m)
      const means: number[] = []
      const counts = new Array(B).fill(0)
      for (let t = 0; t < TRIALS; t++) {
        let s = 0
        for (let k = 0; k < m; k++) s += rand()
        const mean = s / m
        means.push(mean)
        const z = (mean - 0.5) / theoStd
        const bi = Math.floor((z - LO) / W)
        if (bi >= 0 && bi < B) counts[bi]++
      }
      // 样本统计
      const mu = means.reduce((a, b) => a + b, 0) / TRIALS
      const v = means.reduce((a, x) => a + (x - mu) * (x - mu), 0) / TRIALS
      const std = Math.sqrt(v)
      const m4 = means.reduce((a, x) => a + (x - mu) ** 4, 0) / TRIALS
      const exKurt = m4 / (v * v) - 3
      const bins = counts.map((c, k) => {
        const z = LO + (k + 0.5) * W
        return { z: +z.toFixed(2), density: +(c / (TRIALS * W)).toFixed(3), gauss: +gaussPdf(z).toFixed(3) }
      })
      frames.push({
        step, m, trials: TRIALS,
        std: +std.toFixed(4), theoStd: +theoStd.toFixed(4), exKurt: +exKurt.toFixed(3),
        bins, phase: 'run',
        log: `每次平均 **${m}** 个均匀样本、跑 ${TRIALS} 次：均值 std = **${std.toFixed(4)}**（理论 σ/√m=${theoStd.toFixed(4)}），` +
          `超额峰度 = **${exKurt.toFixed(2)}**（0=高斯，均匀本身=−1.2）。` +
          (m === 1 ? `m=1 就是均匀分布本身——**平顶**，离高斯最远。` : `直方图正从平顶往**钟形**靠。`),
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `从 m=1 到 m=32：原始是最不像高斯的**均匀分布**，可只要把 ${M_VALUES[M_VALUES.length - 1]} 个一平均，` +
        `均值分布就长成了**钟形**——超额峰度从 −1.2 一路奔向 0（=高斯）。同时均值 std 按 **σ/√m** 缩（∝1/√m，接大数定理）。` +
        `这就是**中心极限定理**：许多独立小随机因素相加，天然趋向高斯。这正是为什么高斯分布在自然界和深度学习里` +
        `无处不在——权重初始化、噪声假设、误差项、注意力打分的近似分析，背后都是它。`,
    })

    const base0: Frame = {
      step: -1, m: 0, trials: TRIALS, std: 0, theoStd: 0, exKurt: 0,
      bins: Array.from({ length: B }, (_, k) => { const z = LO + (k + 0.5) * W; return { z: +z.toFixed(2), density: 0, gauss: +gaussPdf(z).toFixed(3) } }),
      phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '平均样本数 m' },
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
