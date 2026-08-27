/**
 * 内核：√d 缩放（大模型推理 · 原理：为什么注意力要除以 √d_k）
 * 轴：step —— 逐个增大维度 d，看「不缩放」vs「÷√d」两条 softmax 怎么变
 *
 * 注意力分数 Q·K 是 **d 个乘积之和**。设 Q、K 每一维独立、均值 0、方差 1，则每个乘积均值 0、方差 1，
 * d 个独立项相加 → **Var(Q·K) = d**（方差可加，正是大数定理那套 i.i.d. 累加）。
 * 于是 logits 的标准差 ~ √d：d 一大，最相关那个 key 的分数就把别人甩开 √d 那么多，
 * softmax 变成**近似 one-hot**（熵→0，一头独大），梯度也随之消失——训不动。
 * 除以 **√d_k** 正好把方差拉回 1、标准差回 1，softmax 重新"软"起来，这就是《Attention Is All You Need》
 * 里那句 "we scale the dot products by 1/√d_k" 的原因。
 *
 * 本实验：固定 4 个 key 的"真实相似度" base=[1.5,1,0.5,0]（理解成缩放后该有的 logit）。
 * 在维度 d 下，原始 Q·K ≈ base×√d（方差随 d 涨）。逐步增大 d：
 *   不缩放 softmax(base×√d) —— 随 d 增大迅速塌成 one-hot（熵→0）；
 *   ÷√d   softmax(base)     —— 与 d 无关，恒定"软"。
 * 值全部现算、可核对：Var=d、缩放后分布不随 d 变、不缩放熵随 d 单调降。状态可 JSON 往返。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type ScaleState = {
  i: number
  step: number
  d: number
  sqrtd: number
  base: number[]                 // 4 个 key 的"真实相似度"（=缩放后的 logit）
  rawLogits: number[]            // 不缩放的原始 logit = base×√d
  unscaled: number[]             // 不缩放 softmax 概率
  scaled: number[]               // ÷√d 后 softmax 概率（=softmax(base)，恒定）
  variance: number               // Var(Q·K) = d
  entU: number                   // 不缩放的熵（bit）
  entS: number                   // 缩放的熵（bit）
  maxU: number                   // 不缩放最大概率（饱和指标）
  phase: 'run' | 'done'
  log: string
}

export const SCALE_VISIBLE = [
  'step', 'd', 'sqrtd', 'base', 'rawLogits', 'unscaled', 'scaled',
  'variance', 'entU', 'entS', 'maxU', 'phase', 'log',
] as const

type Frame = Omit<ScaleState, 'i'>

const BASE = [1.5, 1.0, 0.5, 0.0]
const D_VALUES = [4, 16, 64, 256, 1024]

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs)
  const es = xs.map(x => Math.exp(x - m))
  const s = es.reduce((a, b) => a + b, 0)
  return es.map(e => e / s)
}
function entropy(ps: number[]): number {
  return -ps.reduce((h, p) => h + (p > 1e-12 ? p * Math.log2(p) : 0), 0)
}

export const scaleKernel: Kernel<ScaleState> = {
  kind: 'scale',

  compile(_doc: SimDocument): CompiledModel<ScaleState> {
    const frames: Frame[] = []
    const scaledProbs = softmax(BASE)          // 与 d 无关
    const entS = entropy(scaledProbs)

    D_VALUES.forEach((d, step) => {
      const sqrtd = Math.sqrt(d)
      const rawLogits = BASE.map(b => b * sqrtd)
      const unscaled = softmax(rawLogits)
      const entU = entropy(unscaled)
      const maxU = Math.max(...unscaled)
      frames.push({
        step, d, sqrtd,
        base: BASE, rawLogits: rawLogits.map(x => +x.toFixed(2)),
        unscaled: unscaled.map(x => +x.toFixed(4)),
        scaled: scaledProbs.map(x => +x.toFixed(4)),
        variance: d, entU: +entU.toFixed(3), entS: +entS.toFixed(3), maxU: +maxU.toFixed(4),
        phase: 'run',
        log: `维度 d=${d}：Q·K 方差 = **${d}**，标准差 √d = **${sqrtd.toFixed(1)}**。` +
          `不缩放 → 原始 logit = base×√d = [${rawLogits.map(x => x.toFixed(1)).join(', ')}]，` +
          `softmax 最大概率 **${(maxU * 100).toFixed(1)}%**、熵 **${entU.toFixed(2)}** bit` +
          (maxU > 0.9 ? '（已塌成近似 one-hot，梯度要消失了）' : '') + '。' +
          `÷√d 后 = softmax(base)，熵恒 **${entS.toFixed(2)}** bit，**不随 d 变**。`,
      })
    })

    frames.push({
      step: D_VALUES.length - 1, d: D_VALUES[D_VALUES.length - 1], sqrtd: Math.sqrt(D_VALUES[D_VALUES.length - 1]),
      base: BASE, rawLogits: BASE.map(b => +(b * Math.sqrt(D_VALUES[D_VALUES.length - 1])).toFixed(2)),
      unscaled: softmax(BASE.map(b => b * Math.sqrt(D_VALUES[D_VALUES.length - 1]))).map(x => +x.toFixed(4)),
      scaled: scaledProbs.map(x => +x.toFixed(4)),
      variance: D_VALUES[D_VALUES.length - 1], entU: +entropy(softmax(BASE.map(b => b * Math.sqrt(D_VALUES[D_VALUES.length - 1])))).toFixed(3),
      entS: +entS.toFixed(3), maxU: +Math.max(...softmax(BASE.map(b => b * Math.sqrt(D_VALUES[D_VALUES.length - 1])))).toFixed(4),
      phase: 'done',
      log: `从 d=4 到 d=1024：Q·K 方差从 4 涨到 1024（∝d），**不缩放**的 softmax 熵一路塌到 ~0——` +
        `最相关那个 key 独吞概率、其余趋 0，softmax 饱和，梯度也跟着消失。**÷√d** 把方差永远拉回 1，` +
        `熵恒定、分布不随维度变。这就是为什么注意力要除以 **√d_k**——不是玄学，是"d 个 i.i.d. 项相加、方差累加"的必然。`,
    })

    const base0: Frame = {
      step: -1, d: 0, sqrtd: 0, base: BASE, rawLogits: [], unscaled: [], scaled: scaledProbs.map(x => +x.toFixed(4)),
      variance: 0, entU: 0, entS: +entS.toFixed(3), maxU: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '维度 d' },
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
