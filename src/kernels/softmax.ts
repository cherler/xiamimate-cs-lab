/**
 * 内核：softmax 与温度（机器学习基础 · 大模型原理）
 * 轴：step —— logits → 除温度 → 逐个 exp → 求和 → 归一化 → 分布
 *
 * softmax 把一串任意实数（logits）压成一个概率分布：每个都取 exp、再除以总和。
 * 大模型每吐一个字，都是对下一个 token 的 logits 做 softmax，再按概率采样。
 *
 * **温度 T** 是采样最常调的旋钮，本质是"softmax 之前先把 logits 除以 T"：
 *   T 小（→0）：差距被放大，分布变尖 —— 越接近只选最大的那个（贪心）。
 *   T 大（>1）：差距被压平，分布变均匀 —— 越随机、越有创造性。
 * 用**熵**量化这件事：T 越大熵越大。
 *
 * 值全部按公式现算。为数值稳定，exp 前先减去最大 logit（不改结果，教材同款技巧）。
 * 状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type SoftmaxState = {
  i: number
  phase: 'logits' | 'scale' | 'exp' | 'norm' | 'done'
  tokens: string[]
  logits: number[]
  T: number
  /** logits / T */
  scaled: number[]
  /** exp(scaled − max) */
  exps: number[]
  sumExp: number
  probs: number[]
  entropy: number
  /** 本步高亮的 token 下标（-1 表示整体） */
  focus: number
  log: string
}

export const SOFTMAX_VISIBLE = [
  'i', 'phase', 'tokens', 'logits', 'T', 'scaled', 'exps', 'sumExp', 'probs', 'entropy', 'focus', 'log',
] as const

type Frame = Omit<SoftmaxState, 'i'>

//  预置：一串候选下一个 token 的 logits（"今天天气真___"）
const PRESETS: Record<string, { tokens: string[]; logits: number[] }> = {
  '天气续写': { tokens: ['好', '不错', '热', '冷', '糟', '一般'], logits: [3.2, 2.4, 1.6, 0.9, 0.2, 1.1] },
  '接近平局': { tokens: ['A', 'B', 'C', 'D'], logits: [2.0, 1.9, 1.8, 1.7] },
  '一枝独秀': { tokens: ['是', '否', '也许', '不知'], logits: [4.5, 1.0, 0.6, 0.3] },
}

const entropyOf = (p: number[]) => -p.reduce((s, x) => s + (x > 0 ? x * Math.log2(x) : 0), 0)

export const softmaxKernel: Kernel<SoftmaxState> = {
  kind: 'softmax',

  compile(doc: SimDocument): CompiledModel<SoftmaxState> {
    const T = num(doc.params, 'temperature') || 1
    const preset = PRESETS[String(doc.params.logits ?? '天气续写')] ?? PRESETS['天气续写']
    const tokens = preset.tokens
    const logits = preset.logits

    const scaled = logits.map(x => x / T)
    const mx = Math.max(...scaled)
    const exps = scaled.map(x => Math.exp(x - mx))
    const sumExp = exps.reduce((a, b) => a + b, 0)
    const probs = exps.map(e => e / sumExp)
    const entropy = entropyOf(probs)

    const frames: Frame[] = []
    const base = (phase: Frame['phase']): Frame => ({
      phase, tokens, logits, T, scaled: [], exps: [], sumExp: 0, probs: [], entropy: 0, focus: -1, log: '',
    })

    frames.push({ ...base('logits'),
      log: `模型对每个候选 token 打了一个分（**logit**）：${tokens.map((t, k) => `${t}=${logits[k]}`).join('、')}。logit 不是概率，可正可负、加起来也不为 1` })

    frames.push({ ...base('scale'), scaled,
      log: T === 1
        ? `温度 T=1 → logit 除以 1 不变。温度就是"softmax 之前先把 logit 除以 T"`
        : `温度 T=${T} → 每个 logit **除以 ${T}**：${scaled.map(x => x.toFixed(2)).join('、')}。${T < 1 ? 'T<1 把差距放大，分布会更尖' : 'T>1 把差距压平，分布会更均匀'}` })

    frames.push({ ...base('exp'), scaled, exps, sumExp,
      log: `每个都取 **exp**（先减最大值保数值稳定，不改结果），再求和 = ${sumExp.toFixed(3)}。exp 把负数也变正、把大的拉得更大` })

    frames.push({ ...base('norm'), scaled, exps, sumExp, probs, entropy,
      log: `**归一化**：每个 prob = exp ÷ 总和 → ${tokens.map((t, k) => `${t} ${(probs[k] * 100).toFixed(0)}%`).join('、')}。现在加起来正好是 1，成了概率分布` })

    frames.push({ ...base('done'), scaled, exps, sumExp, probs, entropy,
      log: `分布出来了，熵 = ${entropy.toFixed(2)} bit。${T < 1 ? '低温分布尖 —— 越接近贪心，只选最可能的' : T > 1 ? '高温分布平 —— 越随机、越有创造性' : '基准温度。调高更随机、调低更确定'}` })

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({ i: -1, ...base('logits'), log: '' }),
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
