/**
 * 内核：矩阵乘法 C = A·B（机器学习基础 · 一切的地基）
 * 轴：step —— 逐个输出格 C[i][j]：把 A 的第 i 行和 B 的第 j 列点积，边乘边加
 *
 * 神经网络里几乎每一步都是矩阵乘：注意力的 Q·Kᵀ、FFN 的 W·x、LM 头的投影……
 * 规则：A[M×K] · B[K×N] = C[M×N]，**A 的列数必须等于 B 的行数**（内维 K 对上）。
 * 每个输出格 C[i][j] = Σ_k A[i][k]·B[k][j]（一行点一列）。总运算量 = 2·M·N·K 次浮点。
 * FlashAttention 分块、张量并行切矩阵，都是在**切这个乘法**而不改结果 —— 所以它是那些的地基。
 *
 * 值全部现算：每格 = 一行点一列，可核对（C[0][0]=1·7+2·9+3·11=58）。状态可 JSON 往返（验收标准 2）。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type MatmulState = {
  i: number
  A: number[][]            // M×K
  B: number[][]            // K×N
  M: number; K: number; N: number
  /** 当前算的输出格 */
  row: number; col: number
  /** 该格点积的逐项 [a,b,a*b] */
  terms: { a: number; b: number; prod: number }[]
  value: number            // 该格结果
  /** 已算出的 C（未到的为 null） */
  C: (number | null)[][]
  flops: number            // 累计浮点运算次数
  totalFlops: number       // 2·M·N·K
  phase: 'cell' | 'done'
  log: string
}

export const MATMUL_VISIBLE = [
  'i', 'A', 'B', 'M', 'K', 'N', 'row', 'col', 'terms', 'value', 'C', 'flops', 'totalFlops', 'phase', 'log',
] as const

type Frame = Omit<MatmulState, 'i'>

const A = [[1, 2, 3], [4, 5, 6]]      // 2×3
const B = [[7, 8], [9, 10], [11, 12]] // 3×2

export const matmulKernel: Kernel<MatmulState> = {
  kind: 'matmul',

  compile(_doc: SimDocument): CompiledModel<MatmulState> {
    const M = A.length, K = A[0].length, N = B[0].length
    const total = 2 * M * N * K
    const frames: Frame[] = []
    const C: (number | null)[][] = Array.from({ length: M }, () => Array(N).fill(null))
    let flops = 0

    for (let i = 0; i < M; i++) {
      for (let j = 0; j < N; j++) {
        const terms = Array.from({ length: K }, (_, k) => ({ a: A[i][k], b: B[k][j], prod: A[i][k] * B[k][j] }))
        const value = terms.reduce((s, t) => s + t.prod, 0)
        C[i][j] = value
        flops += 2 * K   // K 次乘 + K 次加
        frames.push({
          A, B, M, K, N, row: i, col: j, terms, value,
          C: C.map(r => r.slice()), flops, totalFlops: total, phase: 'cell',
          log: `C[${i}][${j}] = A 第 ${i} 行 · B 第 ${j} 列 = ` +
            terms.map(t => `${t.a}×${t.b}`).join(' + ') + ` = **${value}**。（内维 K=${K} 对上才能乘）`,
        })
      }
    }

    frames.push({
      A, B, M, K, N, row: M - 1, col: N - 1, terms: [], value: 0,
      C: C.map(r => r.slice()), flops, totalFlops: total, phase: 'done',
      log: `${M}×${K} · ${K}×${N} = ${M}×${N}，每格是一行点一列。共 **${total}** 次浮点运算（2·M·N·K）。` +
        `注意力的 Q·Kᵀ、FFN 的 W·x 都是这个乘法；FlashAttention 分块、张量并行切矩阵，切的都是它。`,
    })

    const base0: Frame = {
      A, B, M, K, N, row: -1, col: -1, terms: [], value: 0,
      C: Array.from({ length: M }, () => Array(N).fill(null)), flops: 0, totalFlops: total, phase: 'cell', log: '',
    }

    return {
      axis: { kind: 'step', label: '输出格' },
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
