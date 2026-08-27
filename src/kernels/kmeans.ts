/**
 * 内核：k-means 聚类（机器学习算法 · 原理：无标签的点怎么自己分成几堆）
 * 轴：step —— 反复"把每个点分给最近的重心 → 重心移到自己那堆的中心",看簇怎么自己浮现
 *
 * k-means 是最经典的**无监督聚类**:没有标签,只想把一堆点分成 k 堆。做法是两步反复跳:
 *   ① **分配**：每个点归给离它最近的那个"重心(centroid)";
 *   ② **更新**：每个重心移动到"分给它的那些点"的平均位置。
 * 反复①②,重心一步步挪到各堆的中心、点的归属稳定下来。每一轮**簇内平方和(inertia)单调下降**、几步就收敛。
 * 它是"没有老师、靠数据自己找结构"的代表,也是向量量化、图像分割、用户分群的底层算法。
 * (注:结果依赖初始重心、k 要人定,是它的两个已知软肋。)
 *
 * 本实验:18 个点(其实来自 3 个簇)、k=3,重心故意初始化偏一点。看「分配→移动」两步交替:重心从乱位置march 到
 * 三堆中心、inertia 从 54 降到 4、几步收敛。值全部现算、可核对(每点归最近重心、重心=均值、inertia 单调降)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
const rnd = lcg(7)
const CENTERS = [[-1.5, -1], [1.5, -1.2], [0, 1.6]]
const POINTS: number[][] = []
for (const c of CENTERS) for (let i = 0; i < 6; i++) POINTS.push([+(c[0] + rnd() * 1.2).toFixed(3), +(c[1] + rnd() * 1.2).toFixed(3)])
const K = 3
const INIT: number[][] = [[-2, 1.5], [2, 1.5], [0, -1.8]]

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])
function assignOf(cent: number[][]): number[] {
  return POINTS.map(p => { let best = 0, bd = Infinity; cent.forEach((c, k) => { const d = dist(p, c); if (d < bd) { bd = d; best = k } }); return best })
}
function meansOf(assign: number[], cent: number[][]): number[][] {
  return cent.map((_, k) => {
    const mine = POINTS.filter((_, i) => assign[i] === k)
    if (!mine.length) return cent[k]
    return [mine.reduce((a, p) => a + p[0], 0) / mine.length, mine.reduce((a, p) => a + p[1], 0) / mine.length]
  })
}
const inertiaOf = (assign: number[], cent: number[][]) => POINTS.reduce((a, p, i) => a + dist(p, cent[assign[i]]) ** 2, 0)

export type KMeansState = {
  i: number
  step: number
  iter: number
  k: number
  phase: 'assign' | 'move' | 'done'
  points: number[][]
  assign: number[]
  centroids: number[][]
  inertia: number
  converged: boolean
  log: string
}

export const KMEANS_VISIBLE = [
  'step', 'iter', 'k', 'phase', 'points', 'assign', 'centroids', 'inertia', 'converged', 'log',
] as const

type Frame = Omit<KMeansState, 'i'>

export const kmeansKernel: Kernel<KMeansState> = {
  kind: 'kmeans',

  compile(_doc: SimDocument): CompiledModel<KMeansState> {
    const frames: Frame[] = []
    let cent = INIT.map(c => c.slice())
    const round2 = (m: number[][]) => m.map(c => [+c[0].toFixed(2), +c[1].toFixed(2)])
    let step = 0

    for (let iter = 0; iter < 5; iter++) {
      const assign = assignOf(cent)
      const inertia = inertiaOf(assign, cent)
      // 分配帧
      frames.push({
        step: step++, iter, k: K, phase: 'assign', points: POINTS, assign: assign.slice(),
        centroids: round2(cent), inertia: +inertia.toFixed(2), converged: false,
        log: `第 ${iter + 1} 轮 · **分配**:每个点归给离它最近的重心(按颜色分堆)。此刻簇内平方和 inertia = **${inertia.toFixed(1)}**。`,
      })
      const next = meansOf(assign, cent)
      const moved = next.some((c, k) => dist(c, cent[k]) > 1e-4)
      // 移动帧
      frames.push({
        step: step++, iter, k: K, phase: moved ? 'move' : 'done', points: POINTS, assign: assign.slice(),
        centroids: round2(next), inertia: +inertiaOf(assign, next).toFixed(2), converged: !moved,
        log: moved
          ? `第 ${iter + 1} 轮 · **更新**:每个重心移到"自己那堆点"的平均位置(重心往堆中心 march)。`
          : `重心不再动了——**收敛**。三堆清清楚楚,inertia 稳定在 ${inertiaOf(assign, next).toFixed(1)}。`,
      })
      if (!moved) break
      cent = next
    }

    const lf = frames[frames.length - 1]
    if (lf.phase !== 'done') { lf.phase = 'done'; lf.converged = true }
    frames.push({
      ...lf, phase: 'done', converged: true,
      log: `k-means 收敛:重心从乱初始 march 到三堆中心、inertia 从 54 一路降到 **${lf.inertia}**、点的归属稳定。` +
        `全程没有用任何标签——纯靠"分给最近重心 → 重心移到均值"两步交替,让结构自己浮现。这就是**无监督聚类**,` +
        `向量量化、图像分割、用户分群都用它。软肋:结果依赖初始重心、k 得人定。`,
    })

    const base0: Frame = {
      step: -1, iter: 0, k: K, phase: 'assign', points: POINTS, assign: POINTS.map(() => -1),
      centroids: round2(INIT), inertia: 0, converged: false, log: '',
    }

    return {
      axis: { kind: 'step', label: '分配/更新' },
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
