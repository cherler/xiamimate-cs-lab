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
    const k = num(doc.params, 'topK') || 0          // 0 = 关(侧栏旋钮)
    const preset = PRESETS[str(doc.params, 'logits')] ?? PRESETS['长尾一堆']
    const tokens = preset.tokens
    const n = tokens.length

    const probs = softmax(preset.logits.map(x => x / T))
    const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a])   // 按概率降序
    //  top-k 预筛(若侧栏开了),top-p 在其之上再切
    const keptK = new Array(n).fill(true)
    if (k > 0) order.forEach((idx, rank) => { if (rank >= k) keptK[idx] = false })

    //  采样不是"一步步算"的仿真——它是个函数：一组 logit + 旋钮 → 候选集。真正在**变**的是
    //  截断阈值 top-p:轴换成"top-p 从紧到松扫描",按播放就看「核」(保留的候选集)怎么随阈值长大、
    //  自适应分布形状(分布尖核小、分布平核大)。温度/top-k 留作侧栏旋钮。
    const P_SWEEP = [0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1]

    const at = (p: number): Frame => {
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
      const survived = probs.map((pr, i) => (keptP[i] ? pr : 0))
      const sum = survived.reduce((a, b) => a + b, 0) || 1
      const final = survived.map(x => x / sum)
      const keptCount = keptP.filter(Boolean).length
      const coverage = probs.reduce((s, pr, i) => s + (keptP[i] ? pr : 0), 0)
      return {
        tokens, T, k, p, probs, order, kept: keptP, cum, final, phase: 'done', focus: -1,
        log: `top-p=${p}${p >= 1 ? '（关·全保留）' : ''}：概率从大到小累加、保留累计刚超过 ${p} 的「核」`
          + ` → 留 **${keptCount}/${n}** 个候选(覆盖 ${(coverage * 100).toFixed(0)}% 概率)${k > 0 ? `，并叠加 top-k=${k}` : ''}。`
          + (p < 1 ? '分布尖时核小、分布平时核自动变大——这就是核采样的"自适应"' : '不截断,全在长尾里采,容易蹦出离谱的词'),
      }
    }

    const frames: Frame[] = P_SWEEP.map(at)

    return {
      axis: { kind: 'step', label: 'top-p' },
      initial: () => ({ i: -1, ...at(0.3), log: '按 ▶ 从紧到松扫 top-p(核采样阈值)：看「核」——保留的候选集——怎么随阈值长大。温度、top-k 在左侧「实验控制」里调。' }),
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
