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
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本的矩阵是**由 4 个奇异分量搭出来的**（σ=[10,5,2,1]），秩本来就只有 4。
 * 于是"低秩近似很好用"这件事**是被构造出来的**，不是被验证出来的 —— 跟 PCA 那一屏
 * 只演"成功的样子"是同一类毛病。而 LoRA 能不能用，**全看那条奇异值谱长什么样**：
 *
 *   · 谱**陡降**（σ ∝ 1/i²）—— 前两三个分量就吃掉九成能量，低秩近似大杀四方；
 *   · 谱**平坦**（随机矩阵那样）—— 想留住九成能量得留几乎满秩，**低秩近似一点忙都帮不上**，
 *     "压缩比"甚至会小于 1（存 U、V 比直接存原矩阵还费）。
 *
 * 补厚就补这条：谱的形状做成旋钮，再把**参数量**和**压缩比**摆上屏幕。
 * 于是"LoRA 为什么行"有了准确的答案 —— **不是低秩这件事有魔法，是权重更新的谱恰好是陡降的**。
 * 谱一平，同一套数学立刻什么也省不下来。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

//  三种奇异值谱：形状决定低秩近似有没有用
const SPECTRA: Record<string, (i: number, n: number) => number> = {
  '陡降（σ ∝ 1/i²）': i => 10 / (i * i),
  '缓降（σ ∝ 1/i）': i => 10 / i,
  //  近似随机矩阵的谱：Marchenko–Pastur 下方阵的奇异值大致铺在 [0, 2√n]，这里用一条平缓的线近似
  '平坦（随机矩阵）': (i, n) => 10 * (1 - 0.6 * (i - 1) / n),
}

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
//  确定性正交单位向量组（Gram-Schmidt），可复现
function orthoSet(seed: number, n: number, count: number): number[][] {
  const r = lcg(seed)
  const vs: number[][] = []
  for (let i = 0; i < count; i++) {
    let v = Array.from({ length: n }, () => r())
    for (const u of vs) { const d = v.reduce((a, x, j) => a + x * u[j], 0); v = v.map((x, j) => x - d * u[j]) }
    const nn = Math.sqrt(v.reduce((a, x) => a + x * x, 0)); v = v.map(x => x / nn)
    vs.push(v)
  }
  return vs
}
const frob = (M: number[][]) => Math.sqrt(M.flat().reduce((a, x) => a + x * x, 0))

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
  //  ── 补厚 ──
  spectrum: string
  ratio: number             // 压缩比 = d² / (2·d·k)；**小于 1 就是白忙**
  rFor90: number            // 要留住 90% 能量，秩得开到多少
  rFor99: number
  worthIt: boolean          // 达到 90% 能量时还压得下来吗（ratio > 1）
  phase: 'run' | 'done'
  log: string
}

export const LOWRANK_VISIBLE = [
  'step', 'rank', 'n', 'sigmas', 'original', 'approx', 'error', 'energyPct',
  'fullParams', 'lowrankParams', 'spectrum', 'ratio', 'rFor90', 'rFor99', 'worthIt', 'phase', 'log',
] as const

type Frame = Omit<LowRankState, 'i'>

export const lowrankKernel: Kernel<LowRankState> = {
  kind: 'lowrank',

  compile(doc: SimDocument): CompiledModel<LowRankState> {
    const spectrum = doc.params.spectrum === undefined ? '陡降（σ ∝ 1/i²）' : str(doc.params, 'spectrum')
    const N = doc.params.size === undefined ? 8 : num(doc.params, 'size')
    const gen = SPECTRA[spectrum] ?? SPECTRA['陡降（σ ∝ 1/i²）']
    //  ⚠️ 满秩：不再"由 4 个分量搭出来"。谱的形状由旋钮定，秩本身永远是 N。
    const SIGMAS = Array.from({ length: N }, (_, k) => +gen(k + 1, N).toFixed(4))

    const U = orthoSet(999, N, N)
    const Vv = orthoSet(2024, N, N)
    const rankK = (k: number): number[][] =>
      Array.from({ length: N }, (_, i2) =>
        Array.from({ length: N }, (_, j2) => SIGMAS.slice(0, k).reduce((a, s2, t) => a + s2 * U[t][i2] * Vv[t][j2], 0)))
    const A = rankK(N)
    const normA = frob(A)

    //  能量按奇异值平方累计（Eckart–Young：误差 = √(丢掉那些 σ²)）
    const totalE = SIGMAS.reduce((a, s2) => a + s2 * s2, 0)
    const energyAt = (k: number) => 100 * Math.sqrt(SIGMAS.slice(0, k).reduce((a, s2) => a + s2 * s2, 0) / totalE)
    const firstK = (pct: number) => {
      for (let k = 1; k <= N; k++) if (energyAt(k) >= pct) return k
      return N
    }
    const rFor90 = firstK(90), rFor99 = firstK(99)
    //  ⚠️ 压缩比 = d²/(2dk) = d/(2k)。k 超过 d/2 就 **小于 1** —— 存 U、V 比直接存原矩阵还费。
    const ratioAt = (k: number) => N / (2 * k)
    const worthIt = ratioAt(rFor90) > 1

    const frames: Frame[] = []
    const round2 = (M: number[][]) => M.map(r => r.map(x => +x.toFixed(2)))

    for (let k = 1; k <= N; k++) {
      const Ak = rankK(k)
      const err = frob(A.map((row, i2) => row.map((x, j2) => x - Ak[i2][j2])))
      const energyPct = energyAt(k)
      const ratio = ratioAt(k)
      frames.push({
        step: k - 1, rank: k, n: N, sigmas: SIGMAS.slice(),
        original: round2(A), approx: round2(Ak), error: +err.toFixed(3), energyPct: +energyPct.toFixed(1),
        fullParams: N * N, lowrankParams: 2 * N * k,
        spectrum, ratio: +ratio.toFixed(2), rFor90, rFor99, worthIt, phase: 'run',
        log: `秩 **k=${k}**：只留前 ${k} 个奇异分量（σ=${SIGMAS.slice(0, Math.min(k, 4)).join(', ')}${k > 4 ? ' …' : ''}）。`
          + `重建误差 = √(丢掉的 σ²) = **${err.toFixed(2)}**，保留能量 **${energyPct.toFixed(1)}%**。`
          + `　参数：原 ${N * N} 个 → 低秩 2·d·k = **${2 * N * k}** 个，压缩比 **${ratio.toFixed(2)}×**`
          + (ratio < 1 ? `　⚠️ **小于 1 —— 存 U、V 比直接存原矩阵还费，这时候低秩近似是白忙**。` : `。`),
      })
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `这条谱是「${spectrum}」，${N}×${N} 的矩阵**满秩**（不是搭出来的低秩矩阵）。`
        + `　要留住 **90%** 的能量，秩得开到 **${rFor90}**（压缩比 ${ratioAt(rFor90).toFixed(2)}×）；`
        + `要 99% 得开到 **${rFor99}**（${ratioAt(rFor99).toFixed(2)}×）。`
        + (worthIt
          ? `　**能量集中在前几个大奇异值上**，所以留很小的 k 就够像 —— 这就是 **LoRA** 的原理：`
            + `微调不动整块 d×d 权重，只加一个低秩更新 ΔW=B·A（秩 r≪d），只训 2·d·r 个参数。`
            + `　⚠️ 但这不是低秩这件事有魔法。把「奇异值谱」拧到**平坦（随机矩阵）**再看同一套数学。`
          : `　⚠️ **这一档低秩近似帮不上忙**：谱是平的，能量摊在所有分量上，`
            + `想留住 90% 就得留 ${rFor90}/${N} 的秩，压缩比只有 ${ratioAt(rFor90).toFixed(2)}×`
            + `${ratioAt(rFor90) < 1 ? '（**小于 1，等于白忙**）' : ''}。`
            + `　所以 **LoRA 能用，靠的不是"低秩"这个数学工具，而是一个经验事实：`
            + `大模型微调时的权重更新 ΔW，它的谱确实是陡降的。** 谱一平，同一套数学立刻什么都省不下来。`)
        + `　（Eckart–Young 定理：前 k 个分量拼出来的 A_k，是所有秩-k 矩阵里最接近 A 的；`
        + `误差正好等于被丢掉那些奇异值的平方和开根 —— 屏幕上那个误差就是这么来的。）`,
    })

    const base0: Frame = {
      step: -1, rank: 0, n: N, sigmas: SIGMAS.slice(), original: round2(A),
      approx: Array.from({ length: N }, () => new Array(N).fill(0)),
      error: +normA.toFixed(3), energyPct: 0, fullParams: N * N, lowrankParams: 0,
      spectrum, ratio: 0, rFor90, rFor99, worthIt, phase: 'run', log: '',
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
