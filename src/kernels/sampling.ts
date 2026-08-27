/**
 * 内核：采样解码旋钮台（Transformer 与 LLM 原理）
 * 轴：step —— softmax → 按概率排序 → top-k 截断 → top-p 截断 → 重新归一化 → 采样分布
 *
 * 大模型每吐一个字，先对下一个 token 的 logits 做 softmax（温度 T 控随机性），
 * 再用两把"截断刀"把长尾砍掉，只在剩下的候选里随机采：
 *   top-k：只保留概率最高的 k 个，其余置 0。
 *   top-p（核采样）：把概率从大到小累加，保留累计刚超过 p 的那一小撮（"核"）。
 * 砍完再重新归一化成一个概率分布，从里面采样。
 *
 * 复用「排序」（按概率降序）和「softmax 与温度」。值全部按公式现算。
 * 状态可 JSON 往返（验收标准 2）。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type SamplingState = {
  i: number
  tokens: string[]
  T: number
  k: number
  p: number
  /** softmax 后的概率 */
  probs: number[]
  /** 按概率降序的 token 下标 */
  order: number[]
  /** 每个 token 是否被保留 */
  kept: boolean[]
  /** 排序后每个位置的累计概率（top-p 用） */
  cum: number[]
  /** 归一化后的最终采样概率 */
  final: number[]
  phase: 'softmax' | 'sort' | 'topk' | 'topp' | 'renorm' | 'done'
  /** 本步高亮：排序后的位置 */
  focus: number
  log: string
}

export const SAMPLING_VISIBLE = [
  'i', 'tokens', 'T', 'k', 'p', 'probs', 'order', 'kept', 'cum', 'final', 'phase', 'focus', 'log',
] as const

type Frame = Omit<SamplingState, 'i'>

const PRESETS: Record<string, { tokens: string[]; logits: number[] }> = {
  '长尾一堆': { tokens: ['好', '棒', '妙', '行', '嗯', '呃', '唔', '哦'], logits: [3.4, 2.6, 2.2, 1.4, 0.9, 0.5, 0.2, 0.0] },
  '两强争锋': { tokens: ['是', '否', '也许', '不知', '随便'], logits: [3.0, 2.8, 1.0, 0.6, 0.3] },
}

const softmax = (v: number[]) => {
  const m = Math.max(...v)
  const e = v.map(x => Math.exp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map(x => x / s)
}

export const samplingKernel: Kernel<SamplingState> = {
  kind: 'sampling',

  compile(doc: SimDocument): CompiledModel<SamplingState> {
    const T = num(doc.params, 'temperature') || 1
    const k = num(doc.params, 'topK') || 0          // 0 = 关
    const p = num(doc.params, 'topP') || 1          // 1 = 关
    const preset = PRESETS[str(doc.params, 'logits')] ?? PRESETS['长尾一堆']
    const tokens = preset.tokens
    const n = tokens.length

    const probs = softmax(preset.logits.map(x => x / T))
    //  按概率降序
    const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a])

    const frames: Frame[] = []
    const base = (phase: Frame['phase']): Frame => ({
      tokens, T, k, p, probs, order, kept: new Array(n).fill(true), cum: [], final: [], phase, focus: -1, log: '',
    })

    frames.push({ ...base('softmax'),
      log: `先 softmax（温度 T=${T}）→ 概率分布。长尾里那些低概率 token 加起来也不少，直接采容易蹦出离谱的词` })

    frames.push({ ...base('sort'),
      log: `把候选**按概率从高到低排序**：${order.map(i => tokens[i]).join(' > ')}。截断刀都在这个顺序上切` })

    //  top-k：保留前 k 个
    const keptK = new Array(n).fill(true)
    if (k > 0) order.forEach((idx, rank) => { if (rank >= k) keptK[idx] = false })
    frames.push({ ...base('topk'), kept: [...keptK],
      log: k > 0
        ? `**top-k = ${k}**：只留概率最高的 ${k} 个（${order.slice(0, k).map(i => tokens[i]).join(' ')}），其余全砍掉`
        : `**top-k 关闭**（k=0）：不按个数截断` })

    //  top-p：在（经过 top-k 的）排序上累加，保留累计刚超 p 的一撮
    const cum: number[] = []
    const keptP = [...keptK]
    let acc = 0, crossed = false
    order.forEach((idx) => {
      if (!keptK[idx]) { cum.push(acc); return }
      if (crossed) { keptP[idx] = false; cum.push(acc); return }
      acc += probs[idx]
      cum.push(acc)
      if (acc >= p) crossed = true      // 加到刚超过 p，这个留下，之后的砍掉
    })
    frames.push({ ...base('topp'), kept: [...keptP], cum,
      log: p < 1
        ? `**top-p = ${p}**：概率从大到小累加，保留累计刚超过 ${p} 的那一小撮（"核"）—— 分布尖时只留一两个，分布平时自动多留几个`
        : `**top-p 关闭**（p=1）：不按累计概率截断` })

    //  重新归一化
    const survived = probs.map((pr, i) => (keptP[i] ? pr : 0))
    const sum = survived.reduce((a, b) => a + b, 0) || 1
    const final = survived.map(x => x / sum)
    frames.push({ ...base('renorm'), kept: [...keptP], cum, final,
      log: `**重新归一化**：把留下的概率除以它们的总和，重新凑成和为 1 的分布 → 就在这里面随机采一个 token` })

    const keptCount = keptP.filter(Boolean).length
    frames.push({ ...base('done'), kept: [...keptP], cum, final,
      log: `最终从 **${keptCount}** 个候选里采样（原本 ${n} 个）。温度调随机性、top-k/top-p 砍长尾 —— 三个旋钮一起决定"下一个字有多稳 / 多野"` })

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({ i: -1, ...base('softmax'), log: '' }),
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
