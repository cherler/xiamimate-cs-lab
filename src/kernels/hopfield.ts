/**
 * 内核：注意力=联想记忆（大模型推理 · 原理：注意力为什么能"检索"）
 * 轴：step —— 用一个残缺的 query 反复做一次注意力检索，看它怎么"回忆"出完整的存储模式
 *
 * 2020 年证明了：注意力的更新规则**就是**连续 Hopfield 网络的检索步。也就是说，注意力本质是一个
 * **可微的、按内容寻址的联想记忆**：把若干模式存成 keys，用 query 去检索，softmax 的"锐度"β（=1/温度）
 *   β 大 → **精确检索**：query 只要落在某个存储模式的"吸引域"里，就被拉回那个完整模式（即使 query 残缺）；
 *   β 小 → 软混合：检索出几个模式的加权平均。
 * 一步 Hopfield 更新 = 一次注意力：weights = softmax(β · query·keys)，output = Σ weights·patterns。
 * 把 output 当新 query 再来一次，很快收敛到最相似的那个存储模式——这就是"联想记忆"，也是注意力能
 * "从上下文里回忆相关信息"的底。存储容量随维度**指数级**。
 *
 * 本实验：存 4 个 8 位 ±1 模式（当"记忆"）。query = 第 0 个模式**翻了 2 位**（残缺输入）。固定 β，反复检索：
 *   看 query 一步步被"清理"回完整的模式 0，注意力权重从分散收敛到 one-hot（认定就是模式 0）。
 * 值全部现算、可核对：收敛到重叠最高的模式、权重→one-hot、输出符号与模式 0 一致。状态可 JSON 往返。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type HopfieldState = {
  i: number
  step: number
  beta: number
  patterns: number[][]         // 4 个存储模式，每个 8 位 ±1
  query: number[]              // 当前 query（连续）
  querySign: number[]          // query 的符号（±1，便于和模式比对）
  weights: number[]            // 对 4 个模式的检索权重
  best: number                 // 权重最大的模式下标
  matchBits: number            // querySign 与模式 0 相同的位数（/8）
  converged: boolean
  phase: 'run' | 'done'
  log: string
}

export const HOPFIELD_VISIBLE = [
  'step', 'beta', 'patterns', 'query', 'querySign', 'weights', 'best', 'matchBits', 'converged', 'phase', 'log',
] as const

type Frame = Omit<HopfieldState, 'i'>

const N = 8
const PATTERNS = [
  [1, -1, -1, 1, 1, -1, -1, 1],   // P0
  [1, 1, 1, 1, -1, -1, -1, -1],   // P1
  [1, -1, 1, -1, 1, -1, 1, -1],   // P2
  [-1, -1, -1, -1, 1, 1, 1, 1],   // P3
]
const BETA = 6
// query = P0 翻 2 位（第 1、5 位）
const QUERY0 = [1, 1, -1, 1, 1, 1, -1, 1]

const dot = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k], 0)
const sign = (x: number) => (x >= 0 ? 1 : -1)
function softmax(xs: number[]) {
  const m = Math.max(...xs); const es = xs.map(x => Math.exp(x - m)); const s = es.reduce((a, b) => a + b, 0)
  return es.map(e => e / s)
}

export const hopfieldKernel: Kernel<HopfieldState> = {
  kind: 'hopfield',

  compile(_doc: SimDocument): CompiledModel<HopfieldState> {
    const frames: Frame[] = []
    let query = QUERY0.slice()
    let prevBest = -1, stable = 0

    for (let step = 0; step < 6; step++) {
      const scores = PATTERNS.map(p => BETA * dot(query, p) / N)
      const weights = softmax(scores)
      const best = weights.indexOf(Math.max(...weights))
      const querySign = query.map(sign)
      const matchBits = querySign.reduce((c, b, k) => c + (b === PATTERNS[0][k] ? 1 : 0), 0)
      const converged = weights[best] > 0.9 && matchBits === N
      frames.push({
        step, beta: BETA,
        patterns: PATTERNS.map(p => p.slice()), query: query.map(x => +x.toFixed(2)), querySign,
        weights: weights.map(w => +w.toFixed(3)), best, matchBits, converged, phase: 'run',
        log: `第 ${step} 步检索：权重 = [${weights.map(w => (w * 100).toFixed(0) + '%').join(', ')}]，` +
          `最像 **模式 ${best}**（${(weights[best] * 100).toFixed(0)}%）。` +
          `当前 query 与模式 0 相同 **${matchBits}/${N}** 位` +
          (converged ? `——已回忆出完整的模式 0，权重收敛到 one-hot。` : matchBits < N ? `（还残缺，继续检索）。` : `。`),
      })
      // Hopfield 更新：output = Σ weights·patterns，当作新 query
      const output = Array.from({ length: N }, (_, k) => PATTERNS.reduce((s, p, i) => s + weights[i] * p[k], 0))
      query = output.map(sign)   // 离散 Hopfield：取符号当新 query，模式近正交 → 权重能收敛到 one-hot
      if (best === prevBest && frames[frames.length - 1].converged) { stable++; if (stable >= 1) break }
      prevBest = best
    }

    const lastF = frames[frames.length - 1]
    frames.push({
      ...lastF, phase: 'done',
      log: `从一个翻了 2 位的残缺 query 出发，${frames.length - 1} 步注意力检索就把它"回忆"回了完整的模式 0，` +
        `权重从分散收敛到 one-hot（认定=模式 0）。这就是**注意力=联想记忆**：一次注意力就是一步 Hopfield 检索，` +
        `query 只要落进某个存储模式的吸引域，就被拉回那个完整模式。这是注意力能"从上下文回忆相关信息"的底，` +
        `而存储容量随维度指数级——正对上「高维近正交」那条。`,
    })

    const base0: Frame = {
      step: -1, beta: BETA, patterns: PATTERNS.map(p => p.slice()), query: QUERY0.slice(), querySign: QUERY0.slice(),
      weights: [0.25, 0.25, 0.25, 0.25], best: 0, matchBits: N - 2, converged: false, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '检索步' },
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
