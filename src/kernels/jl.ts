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
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const D = 256
const N = 6
const K_VALUES = [16, 32, 64, 128]

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 }
}
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()) }
const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, j) => s + (x - b[j]) * (x - b[j]), 0))

// 固定的 N 个高维点（可复现）
const rp = lcg(7)
const POINTS: number[][] = Array.from({ length: N }, () => Array.from({ length: D }, () => gauss(rp)))
// 高维两两距离
const HI: number[] = []
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) HI.push(dist(POINTS[i], POINTS[j]))

export type JLState = {
  i: number
  step: number
  d: number
  k: number
  n: number
  ratios: number[]           // 各对：低维距离 / 高维距离
  avgRatio: number
  maxDev: number             // 最大 |ratio − 1|
  phase: 'run' | 'done'
  log: string
}

export const JL_VISIBLE = [
  'step', 'd', 'k', 'n', 'ratios', 'avgRatio', 'maxDev', 'phase', 'log',
] as const

type Frame = Omit<JLState, 'i'>

export const jlKernel: Kernel<JLState> = {
  kind: 'jl',

  compile(_doc: SimDocument): CompiledModel<JLState> {
    const frames: Frame[] = []

    K_VALUES.forEach((k, step) => {
      const rq = lcg(99)      // 每个 K 用同源随机,便于对比;可复现
      const P: number[][] = Array.from({ length: k }, () => Array.from({ length: D }, () => gauss(rq) / Math.sqrt(k)))
      const proj = POINTS.map(p => P.map(row => row.reduce((a, x, j) => a + x * p[j], 0)))
      const ratios: number[] = []
      let idx = 0
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { ratios.push(dist(proj[i], proj[j]) / HI[idx]); idx++ }
      const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length
      const maxDev = Math.max(...ratios.map(r => Math.abs(r - 1)))
      frames.push({
        step, d: D, k, n: N, ratios: ratios.map(r => +r.toFixed(3)),
        avgRatio: +avg.toFixed(3), maxDev: +maxDev.toFixed(3), phase: 'run',
        log: `投到 **K=${k}** 维(从 ${D} 维压下来):${ratios.length} 对点的"低维距离/高维距离"平均 **${avg.toFixed(3)}**，` +
          `最大偏差 **${(maxDev * 100).toFixed(0)}%**。K 越大,距离保得越准。`,
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `K 从 16 加到 128:距离最大偏差从 ~31% 收到 **${(lf.maxDev * 100).toFixed(0)}%**、平均比≈1——` +
        `**${D} 维的点压到几十维,两两距离几乎原样保留**。这就是 Johnson–Lindenstrauss:所需维度 k~O(log N/ε²)、` +
        `**与原始维度 D 无关**,只看点数 N 和精度 ε。随机投影降维、近似最近邻、特征哈希都靠它;` +
        `也和 LoRA/低秩、高维近正交一家——高维很"空"、可压。`,
    })

    const base0: Frame = {
      step: -1, d: D, k: 0, n: N, ratios: [], avgRatio: 0, maxDev: 0, phase: 'run', log: '',
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
