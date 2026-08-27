/**
 * 内核：自注意力手算（Transformer 与 LLM 原理）
 * 轴：step —— 逐个查询 token：算分数 Q·K → 缩放 softmax → 加权求和 V
 *
 * 自注意力是 Transformer 的心脏。每个 token 都带三个向量：
 *   Q（query，我想找什么）· K（key，我能被什么找到）· V（value，我携带的信息）。
 * 一个查询 token i 要更新自己，就问"我该关注谁"：
 *   ① 分数 score[i][j] = Q_i · K_j / √d —— 和每个 token 的 key 做点积（缩放防饱和）
 *   ② 权重 w[i][:] = softmax(score[i][:]) —— 变成一个和为 1 的"注意力分配"
 *   ③ 输出 out_i = Σ_j w[i][j] · V_j —— 按注意力加权汇总所有 value
 * 注意力矩阵一行 = 一个查询对所有 key 的关注分配，逐行长出来。
 *
 * 形态参照 poloclub/transformer-explainer（MIT，形态可参考）：注意力矩阵热力图 +
 * 查询→键的连线，但改成 cs-lab 的"逐步、可手算、可验证"：Q/K/V 用 2 维小向量，点积能心算。
 *
 * 值全部按公式现算（softmax 前减最大值保数值稳定）。状态可 JSON 往返（验收标准 2）。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type AttnState = {
  i: number
  tokens: string[]
  Q: number[][]
  K: number[][]
  V: number[][]
  /** 当前查询 token 下标 */
  qi: number
  /** 当前查询对各 key 的原始分数（已缩放） */
  scores: number[]
  /** 注意力权重矩阵，逐行填（未填的行为空数组） */
  attn: number[][]
  /** 当前查询的输出向量 */
  out: number[]
  /** 已算出的输出（逐行） */
  outs: number[][]
  phase: 'setup' | 'score' | 'softmax' | 'sum' | 'done'
  log: string
}

export const ATTN_VISIBLE = [
  'i', 'tokens', 'Q', 'K', 'V', 'qi', 'scores', 'attn', 'out', 'outs', 'phase', 'log',
] as const

type Frame = Omit<AttnState, 'i'>

//  一小段话的 Q/K/V（2 维，点积能心算）。已投影好 —— 投影本身是另一个话题。
const SENTENCES: Record<string, { tokens: string[]; Q: number[][]; K: number[][]; V: number[][] }> = {
  '它爱吃鱼': {
    tokens: ['它', '爱', '吃', '鱼'],
    Q: [[1, 0], [1, 1], [0, 1], [1, 1]],
    K: [[1, 0], [0, 1], [1, 1], [2, 1]],
    V: [[1, 0], [0, 1], [1, 1], [2, 0]],
  },
  '猫追老鼠': {
    tokens: ['猫', '追', '老', '鼠'],
    Q: [[1, 0], [1, 1], [0, 1], [1, 1]],
    K: [[2, 0], [1, 1], [0, 1], [1, 2]],
    V: [[1, 1], [1, 0], [0, 1], [2, 1]],
  },
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)
const softmax = (v: number[]) => {
  const m = Math.max(...v)
  const e = v.map(x => Math.exp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map(x => x / s)
}

export const attentionKernel: Kernel<AttnState> = {
  kind: 'attention',

  compile(doc: SimDocument): CompiledModel<AttnState> {
    const s = SENTENCES[str(doc.params, 'sentence')] ?? SENTENCES['它爱吃鱼']
    const { tokens, Q, K, V } = s
    const n = tokens.length
    const d = Q[0].length
    const sq = Math.sqrt(d)

    const frames: Frame[] = []
    const attn: number[][] = tokens.map(() => [])
    const outs: number[][] = tokens.map(() => [])
    const base = (phase: Frame['phase']): Frame => ({
      tokens, Q, K, V, qi: -1, scores: [], attn: attn.map(r => [...r]), out: [], outs: outs.map(r => [...r]), phase, log: '',
    })

    frames.push({ ...base('setup'),
      log: `每个 token 有三个向量：**Q**（要找什么）· **K**（能被谁找到）· **V**（携带的信息）。下面逐个查询：它该关注谁` })

    for (let i = 0; i < n; i++) {
      const scores = K.map(k => dot(Q[i], k) / sq)
      frames.push({ ...base('score'), qi: i, scores,
        log: `查询「**${tokens[i]}**」：拿它的 Q 和每个 token 的 K 做点积再除以 √${d} → 分数 [${scores.map(x => x.toFixed(2)).join(', ')}]。分数越高越相关` })

      const w = softmax(scores)
      attn[i] = w
      frames.push({ ...base('softmax'), qi: i, scores,
        log: `对分数做 **softmax** → 注意力权重 [${w.map(x => (x * 100).toFixed(0) + '%').join(', ')}]。「${tokens[i]}」最关注「**${tokens[w.indexOf(Math.max(...w))]}**」` })

      const out = V[0].map((_, dd) => w.reduce((sum, wj, j) => sum + wj * V[j][dd], 0))
      outs[i] = out
      frames.push({ ...base('sum'), qi: i, scores, out,
        log: `**加权求和**：按注意力权重汇总所有 V → 「${tokens[i]}」的新表示 = [${out.map(x => x.toFixed(2)).join(', ')}]。它已经"看过"全句、融入了最相关 token 的信息` })
    }

    frames.push({ ...base('done'),
      log: `${n} 个 token 各自算完注意力。整张矩阵每一行是"一个查询对全句的关注分配" —— 这就是自注意力：每个词都根据全局重新理解自己` })

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({ i: -1, ...base('setup'), attn: tokens.map(() => []), outs: tokens.map(() => []), log: '' }),
      describe: st => st.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
