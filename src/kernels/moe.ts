/**
 * 内核：FFN 与 MoE 路由（Transformer 与 LLM 原理）
 * 轴：step —— 逐个 token 走路由：router 打分 → softmax → 选 top-k 专家 → 归一化门控 → 累计每专家负载
 *
 * Transformer 每层除了注意力，还有个 FFN（前馈网络），参数量通常最大（见「参数量与显存」）。
 * 稠密 FFN：每个 token 都过同一个大 FFN，全部参数都要算。
 * MoE（专家混合）：把大 FFN 拆成 E 个小专家，router 给每个 token 打分、只选 top-k 个专家来算：
 *   门控 = softmax(router 分数)，取最高的 k 个、再归一化 → 输出 = Σ 门控ᵢ·专家ᵢ(x)。
 * 于是**参数量随专家数 E 涨，但每个 token 只算 k 个专家**（活跃参数 ∝ k/E）——
 * 这就是"总参数几百 B、推理却只激活几十 B"的来历。代价是负载可能不均，需要均衡。
 *
 * 值全部现算：门控权重每 token 和为 1、top-k 选择、每专家负载都可核对。状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type MoeState = {
  i: number
  experts: number          // E
  topk: number             // k
  tokens: string[]
  cursor: number           // 当前路由到第几个 token（-1=未开始）
  logits: number[]         // 当前 token 的 router 分数
  gates: number[]          // softmax 后的完整门控
  chosen: number[]         // 选中的 top-k 专家下标
  chosenGates: number[]    // 归一化后的门控（仅 top-k）
  load: number[]           // 每个专家累计接了几个 token
  activeFrac: number       // k / E
  phase: 'route' | 'done'
  log: string
}

export const MOE_VISIBLE = [
  'i', 'experts', 'topk', 'tokens', 'cursor', 'logits', 'gates', 'chosen', 'chosenGates', 'load', 'activeFrac', 'phase', 'log',
] as const

type Frame = Omit<MoeState, 'i'>

const TOKENS = ['猫', '追', '老', '鼠']
//  每个 token 对 E=4 个专家的 router 分数（固定，便于手核；刻意造出负载不均）
const LOGITS: number[][] = [
  [3.0, 1.0, 2.0, 0.0],  // 猫 → 专家 0,2
  [2.5, 0.5, 2.0, 1.0],  // 追 → 专家 0,2
  [0.0, 2.0, 1.0, 3.0],  // 老 → 专家 3,1
  [2.0, 0.0, 3.0, 1.0],  // 鼠 → 专家 2,0
]

function softmax(xs: number[]): number[] {
  const mx = Math.max(...xs)
  const ex = xs.map(x => Math.exp(x - mx))
  const s = ex.reduce((a, b) => a + b, 0)
  return ex.map(e => e / s)
}

export const moeKernel: Kernel<MoeState> = {
  kind: 'moe',

  compile(doc: SimDocument): CompiledModel<MoeState> {
    const experts = 4
    const topk = Math.max(1, Math.min(experts, num(doc.params, 'topk') || 2))
    const N = TOKENS.length
    const activeFrac = topk / experts

    const frames: Frame[] = []
    const load = Array(experts).fill(0)

    for (let t = 0; t < N; t++) {
      const logits = LOGITS[t]
      const gates = softmax(logits)
      //  取 top-k（按门控从大到小，index 小的优先破平）
      const order = gates.map((g, e) => ({ g, e })).sort((a, b) => (b.g - a.g) || (a.e - b.e))
      const chosen = order.slice(0, topk).map(o => o.e).sort((a, b) => a - b)
      const sel = chosen.map(e => gates[e])
      const selSum = sel.reduce((a, b) => a + b, 0)
      const chosenGates = sel.map(g => g / selSum)  // top-k 内归一化
      chosen.forEach(e => { load[e] += 1 })
      frames.push({
        experts, topk, tokens: TOKENS, cursor: t, logits, gates, chosen, chosenGates,
        load: load.slice(), activeFrac, phase: 'route',
        log: `token「${TOKENS[t]}」：router 打分 softmax 后选门控最高的 **${topk}** 个专家 —— ` +
          chosen.map((e, idx) => `专家${e}(${Math.round(chosenGates[idx] * 100)}%)`).join('、') +
          `。只算这 ${topk}/${experts} 个专家，其余跳过。`,
      })
    }

    const maxLoad = Math.max(...load)
    const minLoad = Math.min(...load)
    frames.push({
      experts, topk, tokens: TOKENS, cursor: N, logits: [], gates: [], chosen: [], chosenGates: [],
      load: load.slice(), activeFrac, phase: 'done',
      log: `${N} 个 token 路由完：每个只激活 **${topk}/${experts}** 个专家（活跃参数 ${Math.round(activeFrac * 100)}%）。` +
        `负载 [${load.join('、')}] —— ${maxLoad === minLoad ? '正好均衡' : `最忙专家接了 ${maxLoad} 个、最闲 ${minLoad} 个，不均衡就要做负载均衡`}。` +
        `参数随专家数涨，算力只随 k 涨 —— 这就是 MoE 又大又省的秘密。`,
    })

    const base0: Frame = {
      experts, topk, tokens: TOKENS, cursor: -1, logits: [], gates: [], chosen: [], chosenGates: [],
      load: Array(experts).fill(0), activeFrac, phase: 'route', log: '',
    }

    return {
      axis: { kind: 'step', label: '路由' },
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
