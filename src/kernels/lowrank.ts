/**
 * 内核：低秩近似 / SVD → LoRA（线代 · 原理：为什么"低秩"能省参数还不太掉精度）
 * 轴：step —— 逐步提高保留的秩 k，用前 k 个奇异分量重建一个矩阵，看误差怎么掉、能量怎么攒
 *
 * 任何矩阵都能拆成一串"奇异分量"的叠加:A = Σ σ_i·u_i·v_iᵀ，奇异值 σ_i 从大到小排。
 * 大部分"信息"集中在前几个大 σ 上——只留前 k 个(低秩近似 A_k)，就用 **2·d·k** 个数近似了原来的 **d²** 个数，
 * 而且 Eckart–Young 定理保证:A_k 是所有秩-k 矩阵里最接近 A 的，重建误差(Frobenius)= √(Σ_{i>k} σ_i²)=被丢掉那些奇异值。
 * 这就是 **LoRA** 的原理:微调大模型时，不去改整块 d×d 权重，而是给它加一个**低秩**更新 ΔW=B·A(秩 r≪d)，
 * 只训 2·d·r 个参数——省显存、省算力、还能存很多套"技能包"。图像压缩、PCA、推荐系统降维,底子也都是它。
 *
 * 本实验:一个 8×8 矩阵由 4 个奇异分量搭成(σ=[10,5,2,1])。逐步把秩 k 从 1 提到 4:看重建越来越像原图、
 * 误差 5.48→2.24→1.0→0(=被丢的奇异值)、保留能量 88%→98%→99.6%→100%。值全部现算、可核对。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const N = 8
const SIGMAS = [10, 5, 2, 1]

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
// 确定性正交单位向量组（Gram-Schmidt），可复现
function orthoSet(seed: number): number[][] {
  const r = lcg(seed)
  const vs: number[][] = []
  for (let i = 0; i < SIGMAS.length; i++) {
    let v = Array.from({ length: N }, () => r())
    for (const u of vs) { const d = v.reduce((a, x, j) => a + x * u[j], 0); v = v.map((x, j) => x - d * u[j]) }
    const n = Math.hypot(...v); v = v.map(x => x / n)
    vs.push(v)
  }
  return vs
}
const U = orthoSet(999)
const Vv = orthoSet(2024)
const frob = (M: number[][]) => Math.sqrt(M.flat().reduce((a, x) => a + x * x, 0))
function rankK(k: number): number[][] {
  return Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => SIGMAS.slice(0, k).reduce((a, s, t) => a + s * U[t][i] * Vv[t][j], 0)))
}
const A = rankK(SIGMAS.length)
const normA = frob(A)

export type LowRankState = {
  i: number
  step: number
  rank: number
  n: number
  sigmas: number[]
  original: number[][]
  approx: number[][]
  error: number             // Frobenius 重建误差
  energyPct: number         // 保留能量 %
  fullParams: number        // d²
  lowrankParams: number     // 2·d·k
  phase: 'run' | 'done'
  log: string
}

export const LOWRANK_VISIBLE = [
  'step', 'rank', 'n', 'sigmas', 'original', 'approx', 'error', 'energyPct', 'fullParams', 'lowrankParams', 'phase', 'log',
] as const

type Frame = Omit<LowRankState, 'i'>

export const lowrankKernel: Kernel<LowRankState> = {
  kind: 'lowrank',

  compile(_doc: SimDocument): CompiledModel<LowRankState> {
    const frames: Frame[] = []
    const round2 = (M: number[][]) => M.map(r => r.map(x => +x.toFixed(2)))

    SIGMAS.forEach((_, idx) => {
      const k = idx + 1
      const Ak = rankK(k)
      const err = frob(A.map((row, i) => row.map((x, j) => x - Ak[i][j])))
      const kept = Math.sqrt(SIGMAS.slice(0, k).reduce((a, s) => a + s * s, 0))
      const energyPct = 100 * kept / normA
      frames.push({
        step: idx, rank: k, n: N, sigmas: SIGMAS.slice(),
        original: round2(A), approx: round2(Ak), error: +err.toFixed(3), energyPct: +energyPct.toFixed(1),
        fullParams: N * N, lowrankParams: 2 * N * k, phase: 'run',
        log: `秩 **k=${k}**：只留前 ${k} 个奇异分量(σ=${SIGMAS.slice(0, k).join(',')})。` +
          `重建误差 = √(丢掉的 σ²) = **${err.toFixed(2)}**，保留能量 **${energyPct.toFixed(1)}%**。` +
          `参数:原 ${N * N} 个 → 低秩只需 2·d·k = **${2 * N * k}** 个。`,
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `秩从 1 提到 4:重建误差 5.48→2.24→1.0→**0**(=被丢的奇异值)、保留能量 88%→98%→99.6%→**100%**。` +
        `关键:**信息集中在前几个大奇异值上**，留前 2 个就 98% 像。这就是 **LoRA**:微调不动整块 d×d 权重，` +
        `而是加个低秩更新 ΔW=B·A(秩 r≪d)，只训 2·d·r 个参数——省显存、省算力、能存很多套技能包。` +
        `图像压缩、PCA、推荐降维底子也都是它(Eckart–Young:低秩近似里 A_k 最优)。`,
    })

    const base0: Frame = {
      step: -1, rank: 0, n: N, sigmas: SIGMAS.slice(), original: round2(A),
      approx: Array.from({ length: N }, () => new Array(N).fill(0)),
      error: +normA.toFixed(3), energyPct: 0, fullParams: N * N, lowrankParams: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '保留秩 k' },
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
