/**
 * 内核：Johnson–Lindenstrauss 引理（线代 · 原理：高维能"压扁"到低维还几乎不丢距离）
 * 轴：step —— 把 256 维的点用随机矩阵投到越来越高的低维 K，看两两距离保得越来越准
 *
 * Johnson–Lindenstrauss(JL)引理:N 个高维点，只要投影到 **k ~ O(log N / ε²)** 维(一个**随机**线性投影),
 * 就能把所有两两距离**保持在 (1±ε) 倍**以内——**和原始维度 D 无关**,只跟点数 N 和精度 ε 有关。
 * 惊人之处:几百上千维可以压到几十维,几何结构(谁离谁近)几乎原样保留。这就是随机投影降维、近似最近邻(ANN)、
 * 特征哈希、以及"嵌入维度不用很大也够用"的理论支撑;也和 LoRA/低秩、高维近正交是一家(高维很"空"、可压)。
 *
 * 本实验:6 个 256 维随机点,用高斯随机矩阵(每列除以 √K 保范数)投到 K=16→32→64→128 维。看 15 对点的
 * "低维距离 / 高维距离"越来越贴近 1、最大偏差从 ~31% 收到 ~11%——**投影维度 K 越大,距离保得越准**。
 * 值全部现算、可核对(确定性伪随机、可复现;距离比→1、偏差随 K 降)。
 *
 * ## 2026-09-08 补厚（用户：「继续打磨实验加厚」）
 *
 * 原来 D=256、N=6 **全写死**，只有 K 在扫。可 JL 这条引理最惊人的那句话是
 * 「所需维度 **与原始维度 D 无关**，只跟点数 N 和精度 ε 有关」——
 * **D 和 N 都不能动，这句话就完全没法验证**，只能当口号背。
 *
 * 现在 D 和 N 都是旋钮，于是两件事能亲手试：
 *   · **把 D 从 64 拧到 1024**（点数不变）：偏差曲线**几乎不动** —— "与 D 无关"是真的；
 *   · **把 N 从 6 拧到 200**（维度不变）：偏差**明显变大** —— 要保的点对多了
 *     （N=6 只有 15 对，N=200 有 19900 对），同样的 K 就保不住那么准了。
 * 另外把**理论所需维度** k ≈ 8·ln N/ε² 也算出来摆在旁边，让"够不够"有个尺子。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const K_VALUES = [16, 32, 64, 128]

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 }
}
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()) }
const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, j) => s + (x - b[j]) * (x - b[j]), 0))


export type JLState = {
  i: number
  step: number
  d: number
  k: number
  n: number
  ratios: number[]           // 各对：低维距离 / 高维距离
  avgRatio: number
  maxDev: number             // 最大 |ratio − 1|
  /** 要保住的点对数 = N(N−1)/2 —— JL 的界跟它有关，跟 D 无关 */
  pairs: number
  /** 每个 K 的 [K, 最大偏差]，画那条"K 越大越准"的曲线 */
  devCurve: [number, number][]
  /** 理论上要把最大偏差压到当前这个 ε，大约需要多少维：k ≈ 8·ln N / ε² */
  kNeeded: number
  phase: 'run' | 'done'
  log: string
}

export const JL_VISIBLE = [
  'step', 'd', 'k', 'n', 'pairs', 'ratios', 'avgRatio', 'maxDev', 'devCurve', 'kNeeded', 'phase', 'log',
] as const

type Frame = Omit<JLState, 'i'>

export const jlKernel: Kernel<JLState> = {
  kind: 'jl',

  compile(doc: SimDocument): CompiledModel<JLState> {
    const D = doc.params.dim === undefined ? 256 : num(doc.params, 'dim')
    const N = doc.params.points === undefined ? 6 : num(doc.params, 'points')

    //  N 个 D 维随机点（确定性、可复现）
    const rp = lcg(7)
    const POINTS: number[][] = Array.from({ length: N }, () => Array.from({ length: D }, () => gauss(rp)))
    //  高维两两距离。点对数 = N(N−1)/2 —— JL 的界只跟它（和 ε）有关，跟 D 无关
    const HI: number[] = []
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) HI.push(dist(POINTS[i], POINTS[j]))
    const PAIRS = HI.length

    const frames: Frame[] = []
    //  先把每个 K 的最大偏差都算出来，好画曲线、也好跟理论界对照
    const per = K_VALUES.map(k => {
      const rq = lcg(99)      // 每个 K 用同源随机，便于对比；可复现
      const P: number[][] = Array.from({ length: k }, () => Array.from({ length: D }, () => gauss(rq) / Math.sqrt(k)))
      const proj = POINTS.map(p => P.map(row => row.reduce((a, x, j) => a + x * p[j], 0)))
      const ratios: number[] = []
      let idx = 0
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { ratios.push(dist(proj[i], proj[j]) / HI[idx]); idx++ }
      const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length
      const maxDev = Math.max(...ratios.map(r => Math.abs(r - 1)))
      return { k, ratios, avg, maxDev }
    })
    const devCurve = per.map(x => [x.k, +x.maxDev.toFixed(3)] as [number, number])

    per.forEach((r, step) => {
      const { k, ratios, avg, maxDev } = r
      //  经典形式的 JL 界：k ≥ 8·ln N / ε²（把 ε 取成当前实测的最大偏差）
      const kNeeded = maxDev > 0 ? Math.ceil(8 * Math.log(Math.max(2, N)) / (maxDev * maxDev)) : 0
      frames.push({
        step, d: D, k, n: N, pairs: PAIRS,
        //  点多的时候只展示前 40 对，否则一屏摆不下
        ratios: ratios.slice(0, 40).map(x => +x.toFixed(3)),
        avgRatio: +avg.toFixed(3), maxDev: +maxDev.toFixed(3), devCurve, kNeeded, phase: 'run',
        log: `投到 **K=${k}** 维（从 ${D} 维压下来）：${PAIRS} 对点的"低维距离/高维距离"平均 **${avg.toFixed(3)}**，`
          + `最大偏差 **${(maxDev * 100).toFixed(1)}%**。K 越大，距离保得越准。`,
      })
    })

    const lf = frames[frames.length - 1]
    const d0 = devCurve[0][1], dN = devCurve[devCurve.length - 1][1]
    frames.push({
      ...lf, phase: 'done',
      //  ⚠️ 这些数**现算**。原来写死成「从 ~31% 收到…」，D/N 一能调就是假话。
      log: `K 从 ${K_VALUES[0]} 加到 ${K_VALUES[K_VALUES.length - 1]}：最大偏差从 **${(d0 * 100).toFixed(1)}%** `
        + `收到 **${(dN * 100).toFixed(1)}%**、平均比≈1 —— **${D} 维的 ${N} 个点压到几十维，两两距离几乎原样保留**。`
        + `这就是 Johnson–Lindenstrauss：所需维度 k~O(log N/ε²)，**与原始维度 D 无关**，只看点数 N 和精度 ε。`
        + `　两个旋钮就是用来验这句话的：把 **D 从 64 拧到 1024**（点数不变），这条偏差曲线**几乎不动**；`
        + `而把 **N 从 6 拧到 200**（维度不变），偏差**明显变大** —— 要保住的点对从 15 涨到 19900，`
        + `同样的 K 自然更吃力。`
        + `　随机投影降维、近似最近邻、特征哈希都靠它；也和 LoRA/低秩、高维近正交一家 —— 高维很"空"、可压。`,
    })

    const base0: Frame = {
      step: -1, d: D, k: 0, n: N, pairs: PAIRS, ratios: [], avgRatio: 0, maxDev: 0,
      devCurve, kNeeded: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '投影维度 K' },
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
