/**
 * 内核：主成分分析 PCA（机器学习算法 · 原理：找数据"最铺开"的方向，把高维压成低维）
 * 轴：step —— 一团拉长的点云，找出方差最大的主轴，把点投影上去，看 2D 怎么压成 1D 还几乎不丢信息
 *
 * 一堆高维数据里,各维往往**相关**、真正"有效"的维度没那么多。PCA 就是找数据**方差最大的那个方向**(主成分 PC1)——
 * 沿这个方向点铺得最开、信息最多;再找与它正交、次大方差的 PC2……把点**投影**到前几个主成分上,就用更少的维度
 * 保住了大部分信息。数学上:主成分=**协方差矩阵的特征向量**,对应特征值=那个方向上的方差;特征值越大越该留。
 * 这就是降维:去冗余、抓主轴。它是可视化高维数据、压缩、去噪、以及和 LoRA/低秩同源的"抓主方向"思想的底。
 *
 * 本实验:14 个沿对角线拉长的 2D 点。算协方差、取最大特征向量当 PC1(约 33°方向)、把点投影上去:
 * PC1 保留 **96%** 方差——2D 压到 1D 只丢 4%。值全部现算、可核对(主轴=特征向量、投影、方差占比)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
const rnd = lcg(3)
const RAW = Array.from({ length: 14 }, () => { const t = rnd() * 4, n = rnd() * 0.9; return [t * 0.85 - n * 0.5, t * 0.5 + n * 0.85] })
const N = RAW.length
const MX = RAW.reduce((a, p) => a + p[0], 0) / N
const MY = RAW.reduce((a, p) => a + p[1], 0) / N
const POINTS = RAW.map(p => ({ x: +p[0].toFixed(3), y: +p[1].toFixed(3) }))
// 协方差 + 2×2 特征分解
let ca = 0, cb = 0, cd = 0
for (const p of RAW) { const dx = p[0] - MX, dy = p[1] - MY; ca += dx * dx; cb += dx * dy; cd += dy * dy }
ca /= N; cb /= N; cd /= N
const tr = ca + cd, det = ca * cd - cb * cb
const L1 = tr / 2 + Math.sqrt(tr * tr / 4 - det), L2 = tr / 2 - Math.sqrt(tr * tr / 4 - det)
let VX = cb, VY = L1 - ca; const NN = Math.hypot(VX, VY) || 1; VX /= NN; VY /= NN
const ANGLE = Math.round(Math.atan2(VY, VX) * 180 / Math.PI)
const VAR1 = +(100 * L1 / (L1 + L2)).toFixed(1)
// 投影点
const PROJ = RAW.map(p => { const t = (p[0] - MX) * VX + (p[1] - MY) * VY; return { x: +(MX + t * VX).toFixed(3), y: +(MY + t * VY).toFixed(3) } })

export type PCAState = {
  i: number
  step: number
  phase: 'cloud' | 'axis' | 'project' | 'done'
  points: { x: number; y: number }[]
  mean: { x: number; y: number }
  pc1: { x: number; y: number }
  angle: number
  proj: { x: number; y: number }[]
  var1: number
  log: string
}

export const PCA_VISIBLE = [
  'step', 'phase', 'points', 'mean', 'pc1', 'angle', 'proj', 'var1', 'log',
] as const

type Frame = Omit<PCAState, 'i'>

export const pcaKernel: Kernel<PCAState> = {
  kind: 'pca',

  compile(_doc: SimDocument): CompiledModel<PCAState> {
    const mean = { x: +MX.toFixed(3), y: +MY.toFixed(3) }
    const pc1 = { x: +VX.toFixed(3), y: +VY.toFixed(3) }
    const frames: Frame[] = [
      { step: 0, phase: 'cloud', points: POINTS, mean, pc1, angle: ANGLE, proj: [], var1: VAR1,
        log: `14 个 2D 点,明显**沿对角线拉长**(两个坐标相关)。PCA 想问:哪个方向,点铺得最开、信息最多?` },
      { step: 1, phase: 'axis', points: POINTS, mean, pc1, angle: ANGLE, proj: [], var1: VAR1,
        log: `算协方差矩阵、取**最大特征向量**当主成分 PC1(约 **${ANGLE}°**方向)——这就是**方差最大**的方向,` +
          `对应特征值 ${L1.toFixed(2)} 就是这个方向上的方差(比另一方向 ${L2.toFixed(2)} 大得多)。` },
      { step: 2, phase: 'project', points: POINTS, mean, pc1, angle: ANGLE, proj: PROJ, var1: VAR1,
        log: `把每个点**投影**到 PC1 轴上(垂线落下)——原来的 2D 坐标,现在用"在这条轴上的位置"这**一个数**就近似表示了。` },
      { step: 3, phase: 'done', points: POINTS, mean, pc1, angle: ANGLE, proj: PROJ, var1: VAR1,
        log: `PC1 保留了 **${VAR1}%** 的方差——**2D 压到 1D 只丢 ${(100 - VAR1).toFixed(1)}%**。这就是降维:找数据的主轴、去冗余,` +
          `用更少维度保住大部分信息。主成分=协方差的特征向量、特征值=该方向方差、越大越该留。它是高维可视化、压缩、去噪的底,` +
          `和 LoRA/低秩"抓主方向"是一家。`,
      },
    ]

    const base0: Frame = {
      step: -1, phase: 'cloud', points: POINTS, mean, pc1, angle: ANGLE, proj: [], var1: VAR1, log: '',
    }

    return {
      axis: { kind: 'step', label: '降维步骤' },
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
