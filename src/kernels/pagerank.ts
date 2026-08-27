/**
 * 内核：PageRank 网页排名（机器学习算法 · 原理：重要性顺着链接流动,被重要页面链到的页面也重要)
 * 轴：step —— 每个网页一个 rank(重要性分),幂迭代:每一轮,每个页面把自己的 rank 平分给它链出的页面;
 *      收到越多、来源越重要,分就越高。反复迭代直到稳定。Google 起家的算法,本质是图上的随机游走稳态。
 *
 * 网页海量,怎么排"哪个更重要"?PageRank 的洞见:**一个页面的重要性,取决于有多少、以及多重要的页面链接到它**——
 * 重要页面的"投票"更值钱。数学上是**幂迭代**:每个页面把自己当前的 rank **平分**给它链出去的页面(链接=投票);
 * 每个页面的新 rank = 各方投来的分之和,再混入一点"随机跳转"(阻尼 d=0.85,防止陷进死循环)。反复迭代,rank 收敛到稳定值。
 * 它等价于一个"随机上网者"无穷点击后停在各页的概率——图上随机游走的稳态分布。
 *
 * 本实验:4 个网页 A/B/C/D 互相链接。初始 rank 各 0.25,看幂迭代每轮把重要性顺着箭头流动、重新分配,
 * 几轮后收敛:**C 最高**(三个页面链到它)、A 紧随、B 次之、D 最低(没人链它)。每轮的 rank 都可手算核对。PageRank 是搜索引擎、影响力分析、推荐的基石。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Pt = { x: number; y: number }
const NODES = ['A', 'B', 'C', 'D']
const POS: Pt[] = [{ x: 0.28, y: 0.26 }, { x: 0.76, y: 0.26 }, { x: 0.52, y: 0.8 }, { x: 0.12, y: 0.72 }]
const OUT: Record<string, string[]> = { A: ['B', 'C'], B: ['C'], C: ['A'], D: ['A', 'C'] }
const EDGES: [number, number][] = [[0, 1], [0, 2], [1, 2], [2, 0], [3, 0], [3, 2]]
const N = 4, D = 0.85, ITERS = 6
const r3 = (x: number) => Math.round(x * 1000) / 1000
const inl: Record<string, string[]> = {}; NODES.forEach(n => (inl[n] = [])); for (const u in OUT) for (const v of OUT[u]) inl[v].push(u)

export type PageRankState = {
  i: number
  step: number
  pos: Pt[]
  edges: [number, number][]
  nodes: string[]
  rank: number[]               // 当前各页 rank
  prev: number[]               // 上一轮
  iter: number
  d: number
  ranked: { name: string; r: number }[]
  phase: 'run' | 'done'
  log: string
}

export const PAGERANK_VISIBLE = ['step', 'pos', 'edges', 'nodes', 'rank', 'prev', 'iter', 'd', 'ranked', 'phase', 'log'] as const
type Frame = Omit<PageRankState, 'i'>

export const pagerankKernel: Kernel<PageRankState> = {
  kind: 'pagerank',
  compile(_doc: SimDocument): CompiledModel<PageRankState> {
    const frames: Frame[] = []
    let r = NODES.map(() => 1 / N)
    const sorted = (arr: number[]) => NODES.map((n, i) => ({ name: n, r: arr[i] })).sort((a, b) => b.r - a.r)
    frames.push({
      step: 0, pos: POS, edges: EDGES, nodes: NODES, rank: r.slice(), prev: r.slice(), iter: 0, d: D, ranked: sorted(r), phase: 'run',
      log: `4 个网页 A/B/C/D 互相链接(箭头=链接=投票)。初始:每页 rank = 1/4 = **0.25**。PageRank:重要性顺着链接流动,被重要页面链到的也重要。`,
    })
    for (let it = 1; it <= ITERS; it++) {
      const prev = r.slice()
      const nr = NODES.map(n => {
        let s = 0
        for (const u of inl[n]) s += prev[NODES.indexOf(u)] / OUT[u].length
        return r3((1 - D) / N + D * s)
      })
      r = nr
      frames.push({
        step: frames.length, pos: POS, edges: EDGES, nodes: NODES, rank: r.slice(), prev, iter: it, d: D, ranked: sorted(r), phase: 'run',
        log: `第 ${it} 轮:每个页面把上一轮的 rank **平分**给它链出的页面,收方求和、再混入随机跳转(×${D})。→ ${NODES.map((n, k) => `${n}=${r[k]}`).join('、')}。`,
      })
    }
    const fin = sorted(r)
    frames.push({
      step: frames.length, pos: POS, edges: EDGES, nodes: NODES, rank: r.slice(), prev: r.slice(), iter: ITERS, d: D, ranked: fin, phase: 'done',
      log: `**收敛**:排名 ${fin.map(x => `${x.name}(${x.r})`).join(' > ')}。**${fin[0].name} 最高**——三个页面链到它、且来源本身重要;D 最低(没人链它)。` +
        `PageRank=重要性顺链接流动的**幂迭代**,等价于"随机上网者"无穷点击后停在各页的概率(图上随机游走稳态)。阻尼 d=0.85 混入随机跳转防死循环。它是搜索引擎排序、影响力分析、推荐的基石。`,
    })
    const base0: Frame = { step: -1, pos: POS, edges: EDGES, nodes: NODES, rank: NODES.map(() => 1 / N), prev: NODES.map(() => 1 / N), iter: 0, d: D, ranked: sorted(NODES.map(() => 1 / N)), phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '迭代' },
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
