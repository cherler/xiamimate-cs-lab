/**
 * 内核：线性注意力（大模型推理 · 原理：把 O(N²) 的注意力压成 O(N)、KV 缓存压成常数）
 * 轴：step —— 逐步拉长序列 N，看标准 softmax 注意力的算量/显存怎么爆，线性注意力怎么稳住
 *
 * 标准注意力 = softmax(QKᵀ)·V：要先算 N×N 的注意力矩阵，**算量 O(N²)**；自回归生成还要把每个 token 的
 * K、V 都存下来(**KV 缓存 O(N)**、随上下文线性增长)。上下文一长，算量和显存都顶不住。
 * 线性注意力换个核函数 φ，把 softmax(QKᵀ)V 近似成 **φ(Q)·(φ(K)ᵀ·V)**——**利用矩阵乘法结合律**先算括号里的
 * φ(K)ᵀ·V(一个 d×d 的"状态"矩阵，概括了全部历史)，再让 φ(Q) 去乘它。于是:
 *   · 算量 O(N·d²)：随 N **线性**，不再平方;
 *   · 显存 O(d²)：一个**固定大小**的状态,和序列多长无关——**告别不断膨胀的 KV 缓存**;
 *   · 解码变成 **RNN 式递推**：每来一个 token 就更新固定状态、O(1)/步、常数显存。
 * 代价:φ 不是精确的 softmax、是近似，长序列时用算量/显存换一点精度。交叉点在 **N=d**：N 短 softmax 更省、
 * N 一长线性完胜(N=32768 时算量差 512×、显存差 1000×)。这是长上下文推理引擎绕不开的一条路。
 *
 * 本实验:头维度 d=64,把序列 N 从 64 拉到 32768。值全部现算、可核对(算量 2N²d vs 2Nd²、显存 2Nd vs d²+d)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const D = 64
const N_VALUES = [64, 128, 512, 2048, 8192, 32768]

export type LinAttnState = {
  i: number
  step: number
  d: number
  n: number
  smFlops: number            // softmax 算量 2·N²·d
  linFlops: number           // 线性 算量 2·N·d²
  ratio: number              // smFlops / linFlops
  kvMem: number              // KV 缓存 2·N·d（随 N 长）
  stateMem: number           // 线性状态 d²+d（恒定）
  crossoverN: number         // 交叉点 = d
  histN: number[]
  histSm: number[]
  histLin: number[]
  phase: 'run' | 'done'
  log: string
}

export const LINATTN_VISIBLE = [
  'step', 'd', 'n', 'smFlops', 'linFlops', 'ratio', 'kvMem', 'stateMem', 'crossoverN', 'histN', 'histSm', 'histLin', 'phase', 'log',
] as const

type Frame = Omit<LinAttnState, 'i'>

const fmt = (x: number) => x >= 1e9 ? (x / 1e9).toFixed(1) + 'G' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'K' : `${x}`

export const linattnKernel: Kernel<LinAttnState> = {
  kind: 'linattn',

  compile(_doc: SimDocument): CompiledModel<LinAttnState> {
    const frames: Frame[] = []
    const histN: number[] = [], histSm: number[] = [], histLin: number[] = []

    N_VALUES.forEach((n, step) => {
      const smFlops = 2 * n * n * D
      const linFlops = 2 * n * D * D
      const kvMem = 2 * n * D
      const stateMem = D * D + D
      const ratio = smFlops / linFlops
      histN.push(n); histSm.push(smFlops); histLin.push(linFlops)
      frames.push({
        step, d: D, n, smFlops, linFlops, ratio: +ratio.toFixed(1), kvMem, stateMem, crossoverN: D,
        histN: histN.slice(), histSm: histSm.slice(), histLin: histLin.slice(), phase: 'run',
        log: `序列 **N=${n}**：softmax 算量 2N²d = **${fmt(smFlops)}**，线性 2Nd² = **${fmt(linFlops)}**` +
          `（差 **${ratio.toFixed(0)}×**）。KV 缓存 ${fmt(kvMem)}（随 N 长），线性状态 ${fmt(stateMem)}（恒定）。` +
          (n <= D ? ` N≤d，softmax 还更省。` : ` N>d，线性完胜。`),
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `N 从 64 拉到 32768:softmax 算量 O(N²) 爆到 ${fmt(lf.smFlops)}、KV 缓存涨到 ${fmt(lf.kvMem)};` +
        `线性注意力靠**结合律**先算 φ(K)ᵀ·V 那个 d×d 状态,算量 O(N) 只 ${fmt(lf.linFlops)}(差 ${lf.ratio}×)、` +
        `状态**恒定** ${fmt(lf.stateMem)}——**告别膨胀的 KV 缓存**,解码变成 RNN 式递推、O(1)/步。交叉点在 N=d=${D}:` +
        `短序列 softmax 省、长序列线性完胜。代价是 φ 近似 softmax、拿一点精度换算量与显存。这是长上下文推理引擎绕不开的一条路。`,
    })

    const base0: Frame = {
      step: -1, d: D, n: 0, smFlops: 0, linFlops: 0, ratio: 0, kvMem: 0, stateMem: D * D + D, crossoverN: D,
      histN: [], histSm: [], histLin: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '序列长度 N' },
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
