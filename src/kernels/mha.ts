/**
 * 内核：多头注意力 MHA / MQA / GQA（Transformer 与 LLM 原理）
 * 轴：step —— 逐个 query 头，指明它读哪个 KV 头；末尾算 KV 缓存省了多少
 *
 * 注意力分成多个"头"并行做，每个头看一种关系。三种变体差在**KV 头怎么共享**：
 *   MHA：每个 query 头配一个自己的 KV 头（h 个 KV 头）—— 表达力最强，KV 缓存最大。
 *   MQA：所有 query 头共享 1 个 KV 头 —— KV 缓存最小，但可能掉点。
 *   GQA：query 头分成 g 组，每组共享一个 KV 头（g 个 KV 头）—— 折中，现在主流。
 * KV 缓存大小 ∝ KV 头数，所以从 MHA 到 GQA 到 MQA，KV 缓存一路变小 ——
 * 这正是"KV 缓存吃显存"催生 GQA/MQA 的原因，直接接上「参数量与显存」那一屏。
 *
 * 值全部现算。状态可 JSON 往返（验收标准 2）。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type MhaState = {
  i: number
  variant: 'MHA' | 'MQA' | 'GQA'
  heads: number          // query 头数
  kvHeads: number        // KV 头数
  /** 每个 query 头读的 KV 头下标 */
  map: number[]
  /** 本步高亮的 query 头 */
  focus: number
  /** KV 缓存相对 MHA 的比例 */
  kvRatio: number
  act: 'assign' | 'done'
  log: string
}

export const MHA_VISIBLE = [
  'i', 'variant', 'heads', 'kvHeads', 'map', 'focus', 'kvRatio', 'act', 'log',
] as const

type Frame = Omit<MhaState, 'i'>

export const mhaKernel: Kernel<MhaState> = {
  kind: 'mha',

  compile(doc: SimDocument): CompiledModel<MhaState> {
    const variant = (str(doc.params, 'variant') || 'GQA') as MhaState['variant']
    const heads = num(doc.params, 'heads') || 8
    const kvHeads = variant === 'MHA' ? heads : variant === 'MQA' ? 1 : Math.max(1, num(doc.params, 'groups') || 2)
    //  每个 query 头映射到哪个 KV 头（GQA 按组均分）
    const perGroup = Math.ceil(heads / kvHeads)
    const map = Array.from({ length: heads }, (_, q) => Math.min(kvHeads - 1, Math.floor(q / perGroup)))
    const kvRatio = kvHeads / heads

    const frames: Frame[] = []
    const base = (): Frame => ({ variant, heads, kvHeads, map, focus: -1, kvRatio, act: 'assign', log: '' })

    for (let q = 0; q < heads; q++) {
      frames.push({ ...base(), focus: q,
        log: `query 头 ${q} 读 **KV 头 ${map[q]}**` +
          (variant === 'MHA' ? `（MHA：一对一，每个头独占）`
            : variant === 'MQA' ? `（MQA：所有 query 头都读这唯一的 KV 头）`
              : `（GQA：第 ${map[q]} 组共享这个 KV 头）`) })
    }

    frames.push({ ...base(), focus: -1, act: 'done',
      log: `${variant}：${heads} 个 query 头、**${kvHeads}** 个 KV 头。KV 缓存是 MHA 的 **${Math.round(kvRatio * 100)}%**` +
        (variant === 'MHA' ? ' —— 最大，表达力最强'
          : variant === 'MQA' ? ' —— 最小，省显存但可能掉点'
            : ' —— 折中，主流选择') })

    return {
      axis: { kind: 'step', label: '头分配' },
      initial: () => ({ i: -1, ...base(), focus: -1, log: '' }),
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
