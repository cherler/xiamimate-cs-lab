/**
 * 内核：Roofline 性能建模（大模型推理 · 计算与访存）
 * 轴：step —— 逐个批大小：算 算术强度 AI=FLOPs/字节 → 和机器脊点比 → 判定算力/带宽瓶颈 → 可达性能
 *
 * 一个 kernel 快不快，不只看它要算多少（FLOPs），还看它要搬多少数据（字节）。
 *   算术强度 AI = FLOPs / 字节（每搬一字节能算几次）。
 *   机器有两个上限：峰值算力 P（FLOP/s）、峰值带宽 B（字节/s）。脊点 = P/B（FLOP/字节）。
 *   可达性能 = min(P, AI·B)。AI < 脊点 → 卡在带宽（memory-bound）；AI > 脊点 → 卡在算力（compute-bound）。
 * 大模型**解码**是矩阵×向量：权重读一遍只用一次，AI≈1，深陷带宽瓶颈 → 这就是"解码慢在搬权重"、
 * 也是 KV 缓存、连续批处理、FlashAttention 都在做的事：把 AI 抬高、往算力屋顶靠。批越大 AI 越高。
 *
 * 值全部现算：AI、脊点、瓶颈、可达性能、算力利用率都由公式定，可核对。状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type RooflineState = {
  i: number
  d: number                // 模型维度（权重矩阵 d×d）
  peakTFLOPs: number       // 峰值算力 TFLOP/s
  bwTBs: number            // 峰值带宽 TB/s
  ridge: number            // 脊点 = P/B（FLOP/字节）
  batch: number            // 当前批大小
  flops: number            // 本次 FLOPs
  bytes: number            // 本次搬运字节
  ai: number               // 算术强度 FLOPs/字节
  bound: 'memory' | 'compute'
  attainTFLOPs: number     // 可达性能 TFLOP/s
  util: number             // 占峰值算力比例
  points: { batch: number; ai: number; attain: number }[]  // 已走过的点
  phase: 'point' | 'done'
  log: string
}

export const ROOFLINE_VISIBLE = [
  'i', 'd', 'peakTFLOPs', 'bwTBs', 'ridge', 'batch', 'flops', 'bytes', 'ai', 'bound', 'attainTFLOPs', 'util', 'points', 'phase', 'log',
] as const

type Frame = Omit<RooflineState, 'i'>

const BATCHES = [1, 4, 16, 64, 128]

export const rooflineKernel: Kernel<RooflineState> = {
  kind: 'roofline',

  compile(doc: SimDocument): CompiledModel<RooflineState> {
    const d = Math.max(1024, num(doc.params, 'd') || 4096)
    //  典型 fp16 加速卡：峰值算力 312 TFLOP/s、带宽 2 TB/s
    const peak = 312e12       // FLOP/s
    const bw = 2e12           // 字节/s
    const ridge = peak / bw   // = 156 FLOP/字节
    const bytesW = 2          // fp16

    const frames: Frame[] = []
    const points: { batch: number; ai: number; attain: number }[] = []

    for (const b of BATCHES) {
      //  y = W·X，W:[d×d]，X:[d×b] —— 权重固定，批 b 复用同一份权重
      const flops = 2 * d * d * b
      const bytes = bytesW * (d * d + d * b + d * b)  // 读 W + 读 X + 写 Y
      const ai = flops / bytes
      const bound: RooflineState['bound'] = ai < ridge ? 'memory' : 'compute'
      const attain = Math.min(peak, ai * bw)  // FLOP/s
      const attainT = attain / 1e12
      const util = attain / peak
      points.push({ batch: b, ai: Math.round(ai * 100) / 100, attain: Math.round(attainT) })
      frames.push({
        d, peakTFLOPs: peak / 1e12, bwTBs: bw / 1e12, ridge: Math.round(ridge),
        batch: b, flops, bytes, ai: Math.round(ai * 100) / 100, bound,
        attainTFLOPs: Math.round(attainT), util: Math.round(util * 1000) / 1000,
        points: points.map(p => ({ ...p })), phase: 'point',
        log: `批 ${b}：AI = FLOPs/字节 = **${(ai).toFixed(1)}**（脊点 ${Math.round(ridge)}）→ ` +
          `${ai < ridge ? '**卡带宽**（memory-bound）' : '**卡算力**（compute-bound）'}。` +
          `可达 ${Math.round(attainT)} TFLOP/s，只用到峰值算力的 **${Math.round(util * 100)}%**。`,
      })
    }

    const last = frames[frames.length - 1]
    frames.push({
      ...last, phase: 'done',
      log: `批从 1 到 128，AI 从 ~1 涨到 ~120，算力利用率从 <1% 爬到 ${Math.round(last.util * 100)}%。` +
        `解码单条（批 1）AI≈1、深陷带宽瓶颈 —— 这就是"解码慢在搬权重"。把批做大（连续批处理）、复用 KV（缓存）、少搬中间量（FlashAttention），都是在把 AI 往右推、贴近算力屋顶。`,
    })

    const base0: Frame = {
      d, peakTFLOPs: peak / 1e12, bwTBs: bw / 1e12, ridge: Math.round(ridge),
      batch: 0, flops: 0, bytes: 0, ai: 0, bound: 'memory', attainTFLOPs: 0, util: 0,
      points: [], phase: 'point', log: '',
    }

    return {
      axis: { kind: 'step', label: '批大小' },
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
