/**
 * 内核：KV 缓存（大模型推理 · 内存与调度）
 * 轴：step —— 逐个 token 生成，对比"有缓存 / 无缓存"各要算多少次 K/V
 *
 * 自回归解码：每生成一个新 token，注意力都要用到**前面所有 token 的 K 和 V**。
 *   无缓存：每步都把前缀里每个 token 的 K/V 重算一遍 → 第 j 步要算 j+1 次 → 总量 ~L²/2。
 *   有缓存：把已算过的 K/V 存起来，每步只算**新 token 那一个** → 每步 +1 → 总量 = L。
 * 代价是显存：缓存大小 ∝ 已生成的序列长度（KV 对数），越长越吃显存 ——
 * 这正是 PagedAttention / GQA / KV 卸载都在省的那块（直接接上「参数量与显存」）。
 *
 * 值全部现算。状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type KvCacheState = {
  i: number
  phase: 'prefill' | 'decode' | 'done'
  /** 已在序列里的 token（含刚生成的） */
  seq: string[]
  /** 本步新算的 K/V 个数 */
  computed: number
  /** 无缓存时本步要重算的 K/V 个数 */
  recomputed: number
  /** 缓存里现有的 K/V 对数（= 当前序列长度） */
  cacheSize: number
  /** 有缓存累计算了多少次 K/V */
  cumCached: number
  /** 无缓存累计算了多少次 K/V */
  cumNaive: number
  /** 末步：有缓存省了百分之多少 */
  savedPct: number
  act: 'prefill' | 'gen' | 'done'
  log: string
}

export const KVCACHE_VISIBLE = [
  'i', 'phase', 'seq', 'computed', 'recomputed', 'cacheSize', 'cumCached', 'cumNaive', 'savedPct', 'act', 'log',
] as const

type Frame = Omit<KvCacheState, 'i'>

const TOKENS = ['深', '度', '学', '习', '真', '有', '意', '思']

export const kvcacheKernel: Kernel<KvCacheState> = {
  kind: 'kvcache',

  compile(doc: SimDocument): CompiledModel<KvCacheState> {
    const prompt = Math.max(1, num(doc.params, 'prompt') || 2)
    const total = Math.max(prompt + 1, num(doc.params, 'total') || 6)
    const L = Math.min(total, TOKENS.length)
    const p = Math.min(prompt, L - 1)

    const frames: Frame[] = []
    let cumCached = 0
    let cumNaive = 0

    // 预填充：一次把 prompt 里 p 个 token 的 K/V 都算出来（有/无缓存这步一样）
    cumCached += p
    cumNaive += p
    frames.push({
      phase: 'prefill', seq: TOKENS.slice(0, p),
      computed: p, recomputed: p, cacheSize: p,
      cumCached, cumNaive, savedPct: 0, act: 'prefill',
      log: `**预填充**：把提示词里 ${p} 个 token 的 K/V 一次算完，存进缓存。这步有没有缓存都一样。`,
    })

    // 解码：逐个生成，缓存版只算 1 个，无缓存版重算整段
    for (let j = p; j < L; j++) {
      const curLen = j + 1
      cumCached += 1          // 有缓存：只算新 token
      cumNaive += curLen      // 无缓存：整段 K/V 重算
      frames.push({
        phase: 'decode', seq: TOKENS.slice(0, curLen),
        computed: 1, recomputed: curLen, cacheSize: curLen,
        cumCached, cumNaive, savedPct: 0, act: 'gen',
        log: `**解码第 ${j - p + 1} 步**：生成「${TOKENS[j]}」。有缓存只算它 **1** 个 K/V；` +
          `无缓存要把前 ${curLen} 个 token 的 K/V **全部重算**。缓存现在存 ${curLen} 对。`,
      })
    }

    const savedPct = cumNaive > 0 ? Math.round((1 - cumCached / cumNaive) * 100) : 0
    frames.push({
      phase: 'done', seq: TOKENS.slice(0, L),
      computed: 0, recomputed: 0, cacheSize: L,
      cumCached, cumNaive, savedPct, act: 'done',
      log: `**算完了**：生成 ${L} 个 token，有缓存共算 **${cumCached}** 次 K/V，无缓存要 **${cumNaive}** 次 —— ` +
        `缓存省了 **${savedPct}%** 的计算。代价：缓存要占 ${L} 对 K/V 的显存，序列越长占得越多。`,
    })

    const base0: Frame = {
      phase: 'prefill', seq: [], computed: 0, recomputed: 0, cacheSize: 0,
      cumCached: 0, cumNaive: 0, savedPct: 0, act: 'prefill', log: '',
    }

    return {
      axis: { kind: 'step', label: '生成步' },
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
