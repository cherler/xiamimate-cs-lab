/**
 * 内核：Flash Decode（大模型推理 · 原理：解码时怎么把长 KV 拆开并行、压低时延）
 * 轴：step —— 把一个 query 对 N 个 key 的注意力，按 KV 拆成 C 块并行算，再用 online-softmax 合并
 * 参数：chunks（拆几块 C）—— 改了立即重跑，看时延随 C 降、答案不变
 *
 * FlashAttention 在 **prefill** 时按 **query** 切块并行(几百上千个 query 一起算,GPU 吃得饱)。可 **decode** 每步
 * 只有 **1 个 query**、却要对**一长串 KV**(几万个历史 token)做注意力——只切 query 就只有 1 份活、GPU 闲着,
 * 时延被这条长 KV 拖住。**Flash Decode** 换个切法:把 **KV/序列维**切成 C 块,C 块**并行**各算一份"局部注意力"
 * (局部最大 mᶜ、局部和 lᶜ、局部加权输出 oᶜ),再用 **online softmax** 把 C 份局部结果**无损合并**成全局结果。
 * 于是时延从"顺序扫 N 个 key"降到"并行 N/C"——长上下文解码的关键提速。合并公式和 FlashAttention 同源
 * (拿全局最大 M 重新缩放各块的 exp),数学上**和一次性 softmax 完全相等**(不是近似)。
 *
 * 本实验:1 个 query 对 N=8 个 key,拆成 C 块(默认 4)。逐块算局部 (mᶜ,lᶜ,oᶜ)、再合并。
 * 值全部现算、可核对(合并结果 == 一次性 softmax·V、时延 ~N/C)。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const SCORES = [2.0, 1.0, 3.0, 0.5, 2.5, 1.5, 0.0, 2.2]   // q·k（8 个 key 的打分）
const VALS = [1, 2, 3, 4, 5, 6, 7, 8]
const N = SCORES.length

type Part = { mc: number; lc: number; oc: number; keys: number[] }

export type FlashDecodeState = {
  i: number
  step: number
  n: number
  chunks: number
  chunkSize: number
  phase: 'chunk' | 'combine' | 'done'
  curChunk: number           // 当前算到第几块（chunk 阶段）
  parts: Part[]              // 已算出的局部结果
  M: number                  // 全局最大（combine 后）
  L: number                  // 全局归一
  output: number             // 合并输出
  fullOutput: number         // 一次性 softmax·V（对照）
  seqLatency: number         // 顺序时延 ~N
  parLatency: number         // 并行时延 ~N/C
  log: string
}

export const FLASHDECODE_VISIBLE = [
  'step', 'n', 'chunks', 'chunkSize', 'phase', 'curChunk', 'parts', 'M', 'L', 'output', 'fullOutput', 'seqLatency', 'parLatency', 'log',
] as const

type Frame = Omit<FlashDecodeState, 'i'>

function fullSoftmax(): number {
  const m = Math.max(...SCORES); const e = SCORES.map(s => Math.exp(s - m)); const Z = e.reduce((a, b) => a + b, 0)
  return e.reduce((a, x, i) => a + x * VALS[i], 0) / Z
}

export const flashdecodeKernel: Kernel<FlashDecodeState> = {
  kind: 'flashdecode',

  compile(doc: SimDocument): CompiledModel<FlashDecodeState> {
    let C = Math.round(num(doc.params, 'chunks') || 4)
    if (![2, 4, 8].includes(C)) C = 4
    const chunkSize = N / C
    const full = fullSoftmax()
    const frames: Frame[] = []

    // 逐块算局部 (mc, lc, oc)
    const parts: Part[] = []
    for (let c = 0; c < C; c++) {
      const s = SCORES.slice(c * chunkSize, (c + 1) * chunkSize)
      const v = VALS.slice(c * chunkSize, (c + 1) * chunkSize)
      const keys = Array.from({ length: chunkSize }, (_, k) => c * chunkSize + k)
      const mc = Math.max(...s)
      const e = s.map(x => Math.exp(x - mc))
      const lc = e.reduce((a, b) => a + b, 0)
      const oc = e.reduce((a, x, i) => a + x * v[i], 0)
      parts.push({ mc: +mc.toFixed(3), lc: +lc.toFixed(3), oc: +oc.toFixed(3), keys })
      frames.push({
        step: c, n: N, chunks: C, chunkSize, phase: 'chunk', curChunk: c,
        parts: parts.map(p => ({ ...p })), M: 0, L: 0, output: 0, fullOutput: +full.toFixed(4),
        seqLatency: N, parLatency: N / C,
        log: `第 ${c + 1}/${C} 块（key ${keys[0]}–${keys[keys.length - 1]}）**并行**算局部:` +
          `最大 mᶜ=${mc.toFixed(2)}、和 lᶜ=${lc.toFixed(2)}、加权 oᶜ=${oc.toFixed(2)}。各块互不依赖、同时算。`,
      })
    }

    // 合并
    const M = Math.max(...parts.map(p => p.mc))
    const L = parts.reduce((a, p) => a + p.lc * Math.exp(p.mc - M), 0)
    const O = parts.reduce((a, p) => a + p.oc * Math.exp(p.mc - M), 0)
    const output = O / L
    frames.push({
      step: C, n: N, chunks: C, chunkSize, phase: 'combine', curChunk: -1,
      parts: parts.map(p => ({ ...p })), M: +M.toFixed(3), L: +L.toFixed(3), output: +output.toFixed(4), fullOutput: +full.toFixed(4),
      seqLatency: N, parLatency: N / C,
      log: `**合并**:取全局最大 M=${M.toFixed(2)},把各块 exp(mᶜ−M) 重新缩放再相加 → 输出 = O/L = **${output.toFixed(4)}**` +
        `，和一次性 softmax·V=${full.toFixed(4)} **完全相等**（online softmax、无损）。`,
    })

    frames.push({
      step: C + 1, n: N, chunks: C, chunkSize, phase: 'done', curChunk: -1,
      parts: parts.map(p => ({ ...p })), M: +M.toFixed(3), L: +L.toFixed(3), output: +output.toFixed(4), fullOutput: +full.toFixed(4),
      seqLatency: N, parLatency: N / C,
      log: `decode 每步只有 1 个 query、却要扫 ${N} 个 KV。Flash Decode 把 KV 切 **${C}** 块并行、再用 online softmax 无损合并:` +
        `时延从顺序 ~${N} 降到并行 **~${N / C}**,答案和一次性 softmax 分毫不差。这就是长上下文**解码提速**的关键——` +
        `prefill 切 query、decode 切 KV,合并公式和 FlashAttention 同源。把 chunks 调大,看时延再降。`,
    })

    const base0: Frame = {
      step: -1, n: N, chunks: C, chunkSize, phase: 'chunk', curChunk: -1, parts: [], M: 0, L: 0, output: 0,
      fullOutput: +full.toFixed(4), seqLatency: N, parLatency: N / C, log: '',
    }

    return {
      axis: { kind: 'step', label: 'KV 分块' },
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
