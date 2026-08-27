/**
 * 内核：缩放点积 + causal mask（Transformer 与 LLM 原理）
 * 轴：step —— 逐个查询行 i：raw = Q·K → 除 √d → 打 causal 掩码 → softmax → 权重
 *
 * 两件让注意力"能训练、能生成"的小事：
 *   1) 除 √d：点积会随维度 d 变大，太大时 softmax 落进饱和区（一个≈1、其余≈0，梯度几乎为 0）。
 *      除以 √d 把分数拉回合适量程，softmax 不至于过尖 —— d 越大、除得越多。
 *   2) causal mask：自回归生成时第 i 个词只能看 ≤ i 的词。把 j>i 的分数设为 −∞，
 *      softmax 后它们权重恰好为 0 —— 注意力矩阵变成下三角。
 *
 * 值全部现算：softmax 权重每行和为 1，被掩掉的位恰为 0，可核对。状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type ScaledMaskState = {
  i: number
  d: number
  scale: number            // √d
  causal: boolean
  tokens: string[]
  row: number              // 当前查询行
  raw: number[]            // 该行 Q·K 原始分数
  scaled: number[]         // 除 √d 后
  weights: number[]        // softmax 后（掩掉的为 0）
  /** 已算出的下三角权重矩阵（逐行长出） */
  matrix: number[][]
  /** 该行最大权重（越高越尖/越饱和） */
  peak: number
  /** 同一行若不除 √d 的最大权重，用于对比饱和 */
  peakUnscaled: number
  phase: 'row' | 'done'
  log: string
}

export const SCALEDMASK_VISIBLE = [
  'i', 'd', 'scale', 'causal', 'tokens', 'row', 'raw', 'scaled', 'weights', 'matrix', 'peak', 'peakUnscaled', 'phase', 'log',
] as const

type Frame = Omit<ScaledMaskState, 'i'>

const TOKENS = ['它', '爱', '吃', '鱼']
//  固定 Q·K 原始分数矩阵（R[i][j] = 第 i 个查询对第 j 个键）
const R = [
  [4, 2, 6, 1],
  [2, 5, 3, 4],
  [6, 3, 8, 2],
  [1, 4, 2, 5],
]

function softmax(xs: number[]): number[] {
  const valid = xs.filter(x => Number.isFinite(x))
  const mx = valid.length ? Math.max(...valid) : 0
  const ex = xs.map(x => (Number.isFinite(x) ? Math.exp(x - mx) : 0))
  const sum = ex.reduce((a, b) => a + b, 0)
  return ex.map(e => (sum > 0 ? e / sum : 0))
}

export const scaledmaskKernel: Kernel<ScaledMaskState> = {
  kind: 'scaledmask',

  compile(doc: SimDocument): CompiledModel<ScaledMaskState> {
    const N = TOKENS.length
    const d = Math.max(1, num(doc.params, 'd') || 4)
    const scale = Math.sqrt(d)
    const causal = (num(doc.params, 'causal') ?? 1) !== 0

    const frames: Frame[] = []
    const matrix: number[][] = []

    for (let i = 0; i < N; i++) {
      const raw = R[i].slice()
      const scaled = raw.map((x, j) => (causal && j > i ? -Infinity : x / scale))
      const weights = softmax(scaled)
      //  对照：不除 √d（scale=1）同样掩码下的权重，看饱和
      const scaledU = raw.map((x, j) => (causal && j > i ? -Infinity : x))
      const weightsU = softmax(scaledU)
      const peak = Math.max(...weights)
      const peakUnscaled = Math.max(...weightsU)
      matrix.push(weights.slice())
      frames.push({
        d, scale, causal, tokens: TOKENS, row: i,
        raw, scaled: scaled.map(x => (Number.isFinite(x) ? x : NaN)), weights,
        matrix: matrix.map(r => r.slice()), peak, peakUnscaled, phase: 'row',
        log: `第 ${i} 行「${TOKENS[i]}」：原始分数除 √${d}=${scale.toFixed(2)}` +
          (causal ? `，再把 j>${i} 的未来位掩成 −∞（权重 0）` : '（未开因果掩码）') +
          ` → softmax。最大权重 ${(peak * 100).toFixed(0)}%` +
          (d > 1 ? `；若不除 √d 会到 ${(peakUnscaled * 100).toFixed(0)}%（更饱和）` : '') + '。',
      })
    }

    const anyRow = frames[frames.length - 1]
    frames.push({
      ...anyRow, phase: 'done', row: N - 1,
      log: `注意力矩阵${causal ? '成下三角（每个词只看自己和前文）' : '全满（双向）'}，每行 softmax 和为 1。` +
        `除 √${d} 让分布不过尖 —— d 越大越关键，否则 softmax 饱和、梯度消失、模型学不动。`,
    })

    const base0: Frame = {
      d, scale, causal, tokens: TOKENS, row: -1,
      raw: [], scaled: [], weights: [], matrix: [], peak: 0, peakUnscaled: 0, phase: 'row', log: '',
    }

    return {
      axis: { kind: 'step', label: '查询行' },
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
