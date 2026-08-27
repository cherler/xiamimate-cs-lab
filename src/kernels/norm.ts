/**
 * 内核：归一化 BatchNorm / LayerNorm（深度学习算法 · 原理：把一批激活拉成零均值单位方差,谁沿谁的轴)
 * 轴：step —— 一张 样本×特征 的激活表。**批归一化**沿"样本(批)"这条轴、给每个**特征(列)**做归一化;
 *      **层归一化**沿"特征"这条轴、给每个**样本(行)**做归一化。都是 (x−μ)/σ,差别只在**沿哪条轴**算 μ、σ。
 *      参数可切 BatchNorm/LayerNorm,改了立即重跑。
 *
 * 深层网络里,每层激活的分布会随训练乱漂(internal covariate shift),让优化变难、收敛变慢。**归一化**把激活
 * **拉回零均值、单位方差**(x̂ = (x−μ)/√(σ²+ε)),再乘可学的缩放 γ、加偏移 β 还网络自由度。关键分歧在**沿哪条轴统计**:
 * **BatchNorm** 对**每个特征**、在**一个 mini-batch 的所有样本**上算 μ、σ——依赖 batch,训练/推理行为不同、小 batch 不稳,多见于 CNN;
 * **LayerNorm** 对**每个样本**、在**它自己所有特征**上算——不依赖 batch、对序列长度稳,是 Transformer/RNN 的标配(RMSNorm 是它省掉减均值的简化)。
 *
 * 本实验:4 样本 × 3 特征的激活表。切 BatchNorm 就沿列(每个特征跨 4 样本)归一化——特征恰好都 σ=2,归一化成 ±1;
 * 切 LayerNorm 就沿行(每个样本跨 3 特征)归一化。每个 μ、σ、归一化值都可手算核对,一眼看清"谁沿谁的轴"。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const M = [[2, 3, 1], [2, 7, 5], [6, 3, 5], [6, 7, 1]]   // 4 样本(行) × 3 特征(列)
const ROWS = M.length, COLS = M[0].length
const r3 = (x: number) => Math.round(x * 1000) / 1000
const stats = (a: number[]): [number, number] => {
  const m = a.reduce((s, x) => s + x, 0) / a.length
  const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length
  return [r3(m), r3(Math.sqrt(v))]
}

export type NormState = {
  i: number
  step: number
  mat: number[][]
  kindName: string             // '批归一化' | '层归一化'
  axis: string                 // 'col'(BatchNorm) | 'row'(LayerNorm)
  out: (number | null)[][]     // 归一化输出，逐条填
  slice: number                // 当前处理的列或行索引（-1=未开始/收官）
  vals: number[]               // 当前切片的原始值
  mu: number; sigma: number
  phase: 'run' | 'done'
  log: string
}

export const NORM_VISIBLE = [
  'step', 'mat', 'kindName', 'axis', 'out', 'slice', 'vals', 'mu', 'sigma', 'phase', 'log',
] as const

type Frame = Omit<NormState, 'i'>

export const normKernel: Kernel<NormState> = {
  kind: 'norm',

  compile(doc: SimDocument): CompiledModel<NormState> {
    const kindName = String(doc.params?.kind ?? '批归一化')
    const isBatch = kindName !== '层归一化'
    const axis = isBatch ? 'col' : 'row'
    const out: (number | null)[][] = M.map(row => row.map(() => null))
    const frames: Frame[] = []
    const n = isBatch ? COLS : ROWS

    for (let k = 0; k < n; k++) {
      const vals = isBatch ? M.map(r => r[k]) : M[k].slice()
      const [mu, sigma] = stats(vals)
      const normed = vals.map(x => r3((x - mu) / (sigma || 1)))
      if (isBatch) normed.forEach((v, r) => (out[r][k] = v))
      else normed.forEach((v, c) => (out[k][c] = v))
      frames.push({
        step: frames.length, mat: M, kindName, axis, out: out.map(r => r.slice()), slice: k, vals, mu, sigma, phase: 'run',
        log: `${isBatch ? `**特征 f${k + 1}**(第 ${k + 1} 列),在 ${ROWS} 个样本上` : `**样本 s${k + 1}**(第 ${k + 1} 行),在 ${COLS} 个特征上`}` +
          `算:μ=${mu}、σ=${sigma}。归一化 (x−μ)/σ → [${normed.join(', ')}]。`,
      })
    }

    frames.push({
      step: frames.length, mat: M, kindName, axis, out: out.map(r => r.slice()), slice: -1, vals: [], mu: 0, sigma: 0, phase: 'done',
      log: `**${kindName}完成**:每${isBatch ? '个特征沿"样本"轴' : '个样本沿"特征"轴'}拉成零均值、单位方差。` +
        `${isBatch ? 'BatchNorm 依赖一个 batch 的统计——训练/推理不同、小 batch 不稳,多见于 CNN' : 'LayerNorm 只看样本自己、不依赖 batch——对序列长度稳,是 Transformer/RNN 的标配(RMSNorm 是它省掉减均值的简化)'}。` +
        `都是 (x−μ)/√(σ²+ε),再乘可学 γ、加 β 还自由度。差别只在**沿哪条轴统计**。切上面的参数看另一种。`,
    })

    const base0: Frame = {
      step: -1, mat: M, kindName, axis, out: M.map(r => r.map(() => null)), slice: -1, vals: [], mu: 0, sigma: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: isBatch ? '特征(列)' : '样本(行)' },
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
