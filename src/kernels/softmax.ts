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
import { type SimDocument } from '../core/document.ts'
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
    const preset = PRESETS[String(doc.params.logits ?? '天气续写')] ?? PRESETS['天气续写']
    const tokens = preset.tokens
    const logits = preset.logits

    //  softmax 不是"一步步算"的仿真——它是个函数：logits + 温度 → 分布。
    //  真正在**变化**的是温度：轴换成"温度从低到高扫描"，按播放就看同一串 logit 的分布
    //  从尖(低温、接近贪心)变平(高温、更随机)、熵一路升高。这才是"一个状态在发生变化"。
    const T_SWEEP = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5]   // 低温(尖)→高温(平)，含基准 T=1

    const at = (T: number): Frame => {
      const scaled = logits.map(x => x / T)
      const mx = Math.max(...scaled)
      const exps = scaled.map(x => Math.exp(x - mx))
      const sumExp = exps.reduce((a, b) => a + b, 0)
      const probs = exps.map(e => e / sumExp)
      const entropy = entropyOf(probs)
      const maxP = Math.max(...probs)
      const top = tokens[probs.indexOf(maxP)]
      return {
        phase: 'done', tokens, logits, T, scaled, exps, sumExp, probs, entropy, focus: -1,
        log: `温度 T=${T}${T < 1 ? '（低温）' : T > 1 ? '（高温）' : '（基准）'}：每个 logit 除以 ${T} 再 softmax → 最大概率 **${(maxP * 100).toFixed(0)}%**「${top}」、熵 **${entropy.toFixed(2)} bit**。`
          + (T < 1 ? '差距被放大、分布尖，越接近只选最大（贪心、确定）' : T > 1 ? '差距被压平、分布匀，越随机、越有创造性' : '原始差距，基准分布'),
      }
    }

    const frames: Frame[] = T_SWEEP.map(at)

    return {
      axis: { kind: 'step', label: '温度 T' },
      initial: () => ({ i: -1, ...at(1), log: '按 ▶ 从低温到高温扫描温度：同一串 logit，看分布从尖变平、熵一路升高。温度就是 softmax 之前先把 logit 除以 T。' }),
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
