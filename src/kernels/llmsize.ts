/**
 * 内核：参数量与显存计算器（Transformer 与 LLM 原理）
 * 轴：step —— 逐块拆参数：embedding → 每层注意力 → 每层 FFN → ×层数 → 总数 → 权重显存 → KV 缓存
 *
 * 回答两个每天被问、却没人算给你看的问题：
 *   「7B 为什么要 14G 显存」—— 70 亿参数 × 每个 2 字节（fp16）= 140 亿字节 ≈ 14 GB。
 *   「KV 缓存吃多少」—— 2（K 和 V）× 层数 × 序列长 × d_model × 字节 × 批大小。
 *
 * 参数量按标准 Transformer 结构现算，能和公布值对上（GPT-2 small ≈ 124M）：
 *   embedding = vocab × d
 *   每层注意力 = 4 d²（Q/K/V/O 四个投影）
 *   每层 FFN   = 2 · ffn倍 · d²（升维 + 降维两个矩阵）
 *   总数 = embedding + 层数 ×（每层注意力 + 每层 FFN）
 *
 * 复用「IEEE 754 浮点」的 dtype 概念：fp32=4 / fp16=2 / int8=1 字节。
 * 状态可 JSON 往返（验收标准 2）。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type LlmSizeState = {
  i: number
  L: number; d: number; h: number; ffn: number; vocab: number
  bytes: number; dtype: string; seq: number; batch: number
  /** 累加中的参数量分块 */
  embed: number
  attnPerLayer: number
  ffnPerLayer: number
  total: number
  weightBytes: number
  kvBytes: number
  phase: 'embed' | 'attn' | 'ffn' | 'total' | 'weight' | 'kv' | 'done'
  log: string
}

export const LLMSIZE_VISIBLE = [
  'i', 'L', 'd', 'h', 'ffn', 'vocab', 'bytes', 'dtype', 'seq', 'batch',
  'embed', 'attnPerLayer', 'ffnPerLayer', 'total', 'weightBytes', 'kvBytes', 'phase', 'log',
] as const

type Frame = Omit<LlmSizeState, 'i'>

//  预置配置：算出来要和公布值对得上
const PRESETS: Record<string, { L: number; d: number; h: number; ffn: number; vocab: number }> = {
  'GPT-2 (124M)': { L: 12, d: 768, h: 12, ffn: 4, vocab: 50257 },
  'GPT-2 Medium (350M)': { L: 24, d: 1024, h: 16, ffn: 4, vocab: 50257 },
  '7B 级': { L: 32, d: 4096, h: 32, ffn: 4, vocab: 32000 },
}
const DBYTES: Record<string, number> = { fp32: 4, fp16: 2, int8: 1 }

const humanN = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(2) + ' B' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' M' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' K' : String(n)
//  显存按十进制（GB = 1e9 字节）—— 模型大小惯例这么报，也是"参数量×字节数"的直接读法
const humanB = (b: number) => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(0) + ' MB' : (b / 1e3).toFixed(0) + ' KB'

export const llmSizeKernel: Kernel<LlmSizeState> = {
  kind: 'llmsize',

  compile(doc: SimDocument): CompiledModel<LlmSizeState> {
    const p = PRESETS[str(doc.params, 'model')] ?? PRESETS['GPT-2 (124M)']
    const { L, d, h, ffn, vocab } = p
    const dtype = str(doc.params, 'dtype') || 'fp16'
    const bytes = DBYTES[dtype] ?? 2
    const seq = num(doc.params, 'seq') || 2048
    const batch = 1

    const embed = vocab * d
    const attnPerLayer = 4 * d * d
    const ffnPerLayer = 2 * ffn * d * d
    const total = embed + L * (attnPerLayer + ffnPerLayer)
    const weightBytes = total * bytes
    const kvBytes = 2 * L * seq * d * bytes * batch

    const frames: Frame[] = []
    const base = (phase: Frame['phase']): Frame => ({
      L, d, h, ffn, vocab, bytes, dtype, seq, batch,
      embed: 0, attnPerLayer: 0, ffnPerLayer: 0, total: 0, weightBytes: 0, kvBytes: 0, phase,
      log: '',
    })

    frames.push({ ...base('embed'), embed,
      log: `**词嵌入**：vocab ${vocab.toLocaleString()} × d_model ${d} = **${humanN(embed)}** 个参数。每个 token 先变成一个 ${d} 维向量` })

    frames.push({ ...base('attn'), embed, attnPerLayer,
      log: `**每层注意力**：Q/K/V/O 四个投影，各 ${d}×${d} → 4 × d² = **${humanN(attnPerLayer)}**` })

    frames.push({ ...base('ffn'), embed, attnPerLayer, ffnPerLayer,
      log: `**每层 FFN**：升维 + 降维两个矩阵，2 × ${ffn} × d² = **${humanN(ffnPerLayer)}**。FFN 通常是参数大头` })

    frames.push({ ...base('total'), embed, attnPerLayer, ffnPerLayer, total,
      log: `**总参数**：embedding + ${L} 层 ×（注意力 + FFN）= ${humanN(embed)} + ${L} × ${humanN(attnPerLayer + ffnPerLayer)} = **${humanN(total)}**` })

    frames.push({ ...base('weight'), embed, attnPerLayer, ffnPerLayer, total, weightBytes,
      log: `**权重显存**：${humanN(total)} 参数 × 每个 ${bytes} 字节（${dtype}）= **${humanB(weightBytes)}**。` +
        (total > 5e9 && bytes === 2 ? '这就是"7B 级要十几 G 显存"的由来 —— 参数量 × 2 字节' : `换 fp32 翻倍、int8 减半，量化就是在这里省显存`) })

    frames.push({ ...base('kv'), embed, attnPerLayer, ffnPerLayer, total, weightBytes, kvBytes,
      log: `**KV 缓存**：2（K 和 V）× ${L} 层 × 序列 ${seq} × d ${d} × ${bytes} 字节 = **${humanB(kvBytes)}**。这是**每序列**的额外显存，序列越长、并发越多，吃得越猛` })

    frames.push({ ...base('done'), embed, attnPerLayer, ffnPerLayer, total, weightBytes, kvBytes,
      log: `合计：权重 ${humanB(weightBytes)} + KV（长 ${seq}）${humanB(kvBytes)}。**权重是固定开销，KV 随并发和序列长线性涨** —— 这就是推理显存的两大块` })

    return {
      axis: { kind: 'step', label: '拆解步骤' },
      initial: () => ({ i: -1, ...base('embed'), embed: 0, log: '' }),
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
