/**
 * 内核：张量并行 Tensor Parallel（大模型推理 · 计算并行）
 * 轴：step —— 把一个矩阵乘 Y=X·W 的权重 W 按列切给 G 张 GPU，各算一片 Y，再拼回来
 *
 * 一个大矩阵乘大到单卡装不下 / 算不快时，把它切到多张 GPU 上分头算 —— 这就是张量并行。
 * 列并行：W[K×N] 按列切成 G 份，第 g 张卡拿 W 的一段列 → 算出 Y 的对应一段列（Y_g = X·W_g）。
 *   各卡只存 1/G 的 W、只算 1/G 的乘法；最后 all-gather 把各段 Y 拼成完整 Y。
 * 关键：拼起来和单卡整算**完全一样**（就像 FlashAttention 分块）—— 切的是矩阵乘，不改结果。
 * 每卡显存、算力都降到 1/G，代价是最后要跨卡通信（拼接/求和）。
 *
 * 值全部现算：各卡 Y 片 = X·W_g，拼接 == 单卡 Y，可核对。状态可 JSON 往返（验收标准 2）。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type TensorParState = {
  i: number
  X: number[]              // 1×K（一个 token 的激活）
  W: number[][]            // K×N
  K: number; N: number; G: number
  /** 当前算的 GPU 下标（-1=还没开始，G=进入拼接） */
  gpu: number
  /** 该卡负责的列区间 [lo,hi) */
  cols: [number, number]
  /** 该卡算出的 Y 片 */
  shard: number[]
  /** 已拼好的完整 Y（未算的为 null） */
  Y: (number | null)[]
  /** 单卡整算的参照 */
  full: number[]
  /** 每卡显存/算力占比 */
  fraction: number
  phase: 'compute' | 'gather' | 'done'
  log: string
}

export const TENSORPAR_VISIBLE = [
  'i', 'X', 'W', 'K', 'N', 'G', 'gpu', 'cols', 'shard', 'Y', 'full', 'fraction', 'phase', 'log',
] as const

type Frame = Omit<TensorParState, 'i'>

const X = [1, 2, 3]
const W = [
  [1, 0, 2, 1],
  [0, 1, 1, 2],
  [2, 1, 0, 1],
]

export const tensorparKernel: Kernel<TensorParState> = {
  kind: 'tensorpar',

  compile(doc: SimDocument): CompiledModel<TensorParState> {
    const K = W.length, N = W[0].length
    const G = Math.max(1, Math.min(N, num(doc.params, 'gpus') || 2))
    const per = Math.ceil(N / G)
    const dot = (x: number[], col: number) => x.reduce((s, xk, k) => s + xk * W[k][col], 0)
    const full = Array.from({ length: N }, (_, j) => dot(X, j))
    const fraction = 1 / G

    const frames: Frame[] = []
    const Y: (number | null)[] = Array(N).fill(null)

    for (let g = 0; g < G; g++) {
      const lo = g * per, hi = Math.min(lo + per, N)
      const shard: number[] = []
      for (let j = lo; j < hi; j++) { Y[j] = full[j]; shard.push(full[j]) }
      frames.push({
        X, W, K, N, G, gpu: g, cols: [lo, hi], shard, Y: Y.slice(), full, fraction, phase: 'compute',
        log: `GPU ${g}：拿 W 的第 ${lo}~${hi - 1} 列（1/${G} 的权重），算 Y 的对应片 = [${shard.join('、')}]。` +
          `只存 1/${G} 的 W、只算 1/${G} 的乘法。`,
      })
    }

    frames.push({
      X, W, K, N, G, gpu: G, cols: [0, N], shard: [], Y: Y.slice(), full, fraction, phase: 'gather',
      log: `**all-gather**：把 ${G} 张卡各自的 Y 片拼成完整 Y = [${full.join('、')}]。这一步要跨卡通信。`,
    })
    frames.push({
      X, W, K, N, G, gpu: G, cols: [0, N], shard: [], Y: Y.slice(), full, fraction, phase: 'done',
      log: `拼出来的 Y = [${full.join('、')}]，和单卡整算**完全一样**。每卡显存、算力都降到 **1/${G}**，代价是最后 all-gather 的跨卡通信 —— 切的是矩阵乘，不改结果。`,
    })

    const base0: Frame = {
      X, W, K, N, G, gpu: -1, cols: [0, 0], shard: [], Y: Array(N).fill(null), full, fraction, phase: 'compute', log: '',
    }

    return {
      axis: { kind: 'step', label: '并行步' },
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
