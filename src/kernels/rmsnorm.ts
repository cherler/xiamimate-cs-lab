/**
 * 内核：RMSNorm 归一化（Transformer 与 LLM 原理）
 * 轴：step —— 平方→均值→RMS→逐维除以 RMS→乘可学习增益 g
 *
 * Transformer 每个子层前都要归一化，否则数值忽大忽小、训练不稳。
 * LayerNorm：先减均值再除标准差，再缩放平移。RMSNorm 更简：**不减均值**，
 *   只用均方根 RMS = sqrt(mean(x²)) 把向量缩放到单位尺度，再乘一个可学习增益 g（每维一个）。
 *   x̂ᵢ = xᵢ / RMS · gᵢ。少一次求均值、少一组偏置参数，效果却相当 —— 所以 LLaMA、Qwen 等都用它。
 *
 * 值全部现算：RMS、归一化后每维、以及"归一化后 RMS=1"都可核对。状态可 JSON 往返（验收标准 2）。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type RmsNormState = {
  i: number
  x: number[]              // 输入向量
  gain: number[]           // 可学习增益 g
  sq: number[]             // 各维平方（逐步填）
  meanSq: number           // 均方
  rms: number              // 均方根
  cursor: number           // 逐维归一化到第几维（-1=还在算 RMS）
  out: (number | null)[]   // 归一化后（未到的为 null）
  outRms: number           // 归一化后向量的 RMS（应=1，未乘 gain 时）
  phase: 'square' | 'rms' | 'normalize' | 'done'
  log: string
}

export const RMSNORM_VISIBLE = [
  'i', 'x', 'gain', 'sq', 'meanSq', 'rms', 'cursor', 'out', 'outRms', 'phase', 'log',
] as const

type Frame = Omit<RmsNormState, 'i'>
const r3 = (v: number) => Math.round(v * 1000) / 1000

const X = [2, -4, 1, 3]
const GAIN = [1, 1, 1, 1]

export const rmsnormKernel: Kernel<RmsNormState> = {
  kind: 'rmsnorm',

  compile(doc: SimDocument): CompiledModel<RmsNormState> {
    const d = X.length
    const gm = doc.params.gain
    const gain = (typeof gm === 'string' && gm === '放大末维') ? [1, 1, 1, 2] : GAIN

    const sqAll = X.map(v => v * v)
    const meanSq = sqAll.reduce((a, b) => a + b, 0) / d
    const rms = Math.sqrt(meanSq)

    const frames: Frame[] = []

    // 1) 平方（一次性展示）
    frames.push({
      x: X, gain, sq: sqAll.map(r3), meanSq: r3(meanSq), rms: r3(rms), cursor: -1,
      out: Array(d).fill(null), outRms: 0, phase: 'square',
      log: `**平方**：每维平方 [${sqAll.map(r3).join('、')}]，均方 = 和 ÷ ${d} = **${r3(meanSq)}**。`,
    })
    // 2) RMS
    frames.push({
      x: X, gain, sq: sqAll.map(r3), meanSq: r3(meanSq), rms: r3(rms), cursor: -1,
      out: Array(d).fill(null), outRms: 0, phase: 'rms',
      log: `**均方根 RMS** = √均方 = √${r3(meanSq)} = **${r3(rms)}**。注意：RMSNorm **不减均值**（这是它比 LayerNorm 省的地方）。`,
    })
    // 3) 逐维归一化
    const out: (number | null)[] = Array(d).fill(null)
    for (let k = 0; k < d; k++) {
      const norm = X[k] / rms
      out[k] = r3(norm * gain[k])
      const filled = out.slice(0, k + 1) as number[]
      const rawNorm = filled.map((_, j) => X[j] / rms)   // 未乘 gain 的归一化值
      const curRms = Math.sqrt(rawNorm.reduce((a, b) => a + b * b, 0) / rawNorm.length)
      frames.push({
        x: X, gain, sq: sqAll.map(r3), meanSq: r3(meanSq), rms: r3(rms), cursor: k,
        out: out.slice(), outRms: r3(curRms), phase: 'normalize',
        log: `第 ${k} 维：x̂ = ${X[k]} ÷ ${r3(rms)} × g(${gain[k]}) = **${r3(norm * gain[k])}**。` +
          (k === d - 1 ? `全部归一化完，未乘增益时向量 RMS = **${r3(curRms)}**（正好为 1，这就是"归一化"）。` : ''),
      })
    }
    // 4) done
    const finalRaw = X.map(v => v / rms)
    const finalRms = Math.sqrt(finalRaw.reduce((a, b) => a + b * b, 0) / d)
    frames.push({
      x: X, gain, sq: sqAll.map(r3), meanSq: r3(meanSq), rms: r3(rms), cursor: d,
      out: out.slice(), outRms: r3(finalRms), phase: 'done',
      log: `RMSNorm 完成：x̂ = x / RMS · g。归一化把向量拉到**单位均方根**（RMS=1），再由增益 g 逐维缩放。` +
        `比 LayerNorm 少一次求均值、少一组偏置 —— LLaMA、Qwen 等主流模型都用它。`,
    })

    const base0: Frame = {
      x: X, gain, sq: [], meanSq: 0, rms: 0, cursor: -1,
      out: Array(d).fill(null), outRms: 0, phase: 'square', log: '',
    }

    return {
      axis: { kind: 'step', label: '归一化步' },
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
