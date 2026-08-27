/**
 * 内核：k-近邻 k-NN（机器学习算法 · 原理：不训练，直接"看邻居投票"来分类）
 * 轴：step —— 一个待分类的点，把离它最近的邻居一个个找出来投票，看类别怎么定
 * 参数：k（看几个最近邻）—— 改了立即重跑，看 k 变大票数怎么变、判断会不会翻
 *
 * k-NN 是最"懒"的分类器:**根本不训练**。要判一个新点属于哪类,就找离它**最近的 k 个已知点**,让它们**投票**,
 * 票多的类别就是答案。全部力气都花在"预测时按距离找最近邻"上。它极其直观,也点破了一个道理:
 * 很多"智能"其实就是**按相似度检索 + 多数表决**(和注意力、联想记忆一脉:近的权重大)。
 * 参数 k 是它的灵魂:**k 小→敏感**(容易被个别噪声点带偏、边界毛糙)、**k 大→平滑**(更稳,但可能糊掉细节)。
 * 在类别边界附近,同一个点会随 k 变大而**改判**——这正是"偏差-方差"权衡的直观版。
 *
 * 本实验:两类各 8 个点(A/B),一个落在边界附近的待判点。逐个揭示最近邻、累计投票。你会看到 k=1 判 A、
 * k=3 翻成 B、k=7 又翻回 A——判断随 k 摇摆。值全部现算、可核对(距离排序、票数、多数表决)。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

function lcg(seed: number) {
  let x = seed >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 - 0.5 }
}
const rnd = lcg(11)
const CLASS_A = Array.from({ length: 8 }, () => [-0.9 + rnd() * 1.6, rnd() * 2])
const CLASS_B = Array.from({ length: 8 }, () => [0.9 + rnd() * 1.6, rnd() * 2])
const POINTS = [
  ...CLASS_A.map(p => ({ x: +p[0].toFixed(3), y: +p[1].toFixed(3), c: 0 })),
  ...CLASS_B.map(p => ({ x: +p[0].toFixed(3), y: +p[1].toFixed(3), c: 1 })),
]
const QUERY = { x: -0.1, y: -0.3 }
const d = (p: { x: number; y: number }) => Math.hypot(p.x - QUERY.x, p.y - QUERY.y)
const SORTED = POINTS.map((p, idx) => ({ ...p, idx, dist: +d(p).toFixed(3) })).sort((a, b) => a.dist - b.dist)

export type KNNState = {
  i: number
  step: number
  k: number
  seen: number               // 已揭示几个邻居
  query: { x: number; y: number }
  points: { x: number; y: number; c: number }[]
  neighbors: { idx: number; c: number; dist: number }[]   // 已揭示的最近邻（含全体点下标）
  voteA: number
  voteB: number
  predict: number            // 0=A 1=B（-1 未定）
  phase: 'run' | 'done'
  log: string
}

export const KNN_VISIBLE = [
  'step', 'k', 'seen', 'query', 'points', 'neighbors', 'voteA', 'voteB', 'predict', 'phase', 'log',
] as const

type Frame = Omit<KNNState, 'i'>

export const knnKernel: Kernel<KNNState> = {
  kind: 'knn',

  compile(doc: SimDocument): CompiledModel<KNNState> {
    let K = Math.round(num(doc.params, 'k') || 3)
    if (![1, 3, 5, 7].includes(K)) K = 3
    const frames: Frame[] = []

    for (let n = 1; n <= K; n++) {
      const nn = SORTED.slice(0, n)
      const voteA = nn.filter(x => x.c === 0).length
      const voteB = n - voteA
      const predict = voteA > voteB ? 0 : voteB > voteA ? 1 : -1
      frames.push({
        step: n - 1, k: K, seen: n, query: QUERY, points: POINTS,
        neighbors: nn.map(x => ({ idx: x.idx, c: x.c, dist: x.dist })),
        voteA, voteB, predict, phase: 'run',
        log: `找第 ${n} 近的邻居(距离 ${nn[n - 1].dist})——它属于 **${nn[n - 1].c === 0 ? 'A' : 'B'}** 类。` +
          `到目前最近 ${n} 个:A **${voteA}** 票、B **${voteB}** 票 → 暂判 **${predict === 0 ? 'A' : predict === 1 ? 'B' : '平'}**。`,
      })
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `k=${K}:最近 ${K} 个邻居投票 A ${lf.voteA} : B ${lf.voteB} → 判 **${lf.predict === 0 ? 'A' : 'B'}**。` +
        `k-NN 不训练,靠"按距离找最近邻 + 多数表决"当场分类。这个点在**边界附近**,把 k 从 1 调到 7,判断会 A→B→A 来回翻——` +
        `**k 小敏感(边界毛糙)、k 大平滑(更稳但糊细节)**,正是偏差-方差权衡的直观版。它和注意力"近的权重大"一脉相承。`,
    })

    const base0: Frame = {
      step: -1, k: K, seen: 0, query: QUERY, points: POINTS, neighbors: [], voteA: 0, voteB: 0, predict: -1, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '第几近邻' },
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
