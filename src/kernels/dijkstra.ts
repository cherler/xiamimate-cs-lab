/**
 * 内核：Dijkstra 最短路（数据结构 · 图）
 * 轴：step —— 每步是"选一个最近未确定点"或"松弛一条边"
 *
 * 图用现有的 entities 表达，没有新增顶层概念：
 *   { type:'node', id:'A' }
 *   { type:'edge', id:'A-B', attrs:{ from:'A', to:'B', w:4 } }
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type DijkstraState = {
  i: number
  /** 本步动作 */
  act: 'pick' | 'relax' | 'skip' | 'done'
  /** 本步选中/正在松弛的点 */
  at: string
  /** relax 时的目标点 */
  to: string
  dist: Record<string, number>
  prev: Record<string, string | null>
  settled: string[]
  /** 本步是否真的更新了距离 */
  improved: boolean
  log: string
}

export const DIJKSTRA_VISIBLE = [
  'i', 'act', 'at', 'to', 'dist', 'prev', 'settled', 'improved', 'log',
] as const

const INF = Number.POSITIVE_INFINITY
const fmt = (v: number) => (v === INF ? '∞' : String(v))

type Frame = Omit<DijkstraState, 'i'>

export const dijkstraKernel: Kernel<DijkstraState> = {
  kind: 'dijkstra',

  compile(doc: SimDocument): CompiledModel<DijkstraState> {
    const source = str(doc.params, 'source')
    const directed = num(doc.params, 'directed') === 1

    const nodes = doc.entities.filter(e => e.type === 'node').map(e => e.id)
    const edges = doc.entities.filter(e => e.type === 'edge').map(e => ({
      from: str(e.attrs, 'from'), to: str(e.attrs, 'to'), w: num(e.attrs, 'w'),
    }))

    const adj: Record<string, { to: string; w: number }[]> = {}
    for (const n of nodes) adj[n] = []
    for (const e of edges) {
      adj[e.from]?.push({ to: e.to, w: e.w })
      if (!directed) adj[e.to]?.push({ to: e.from, w: e.w })
    }
    for (const n of nodes) adj[n].sort((x, y) => x.to.localeCompare(y.to))

    // 一次算完，step() 按下标取 —— 与 sweep/compare 同样的做法
    const frames: Frame[] = []
    const dist: Record<string, number> = {}
    const prev: Record<string, string | null> = {}
    for (const n of nodes) { dist[n] = n === source ? 0 : INF; prev[n] = null }
    const settled: string[] = []

    const snap = (f: Partial<Frame> & { act: Frame['act']; log: string }): Frame => ({
      at: '', to: '', dist: { ...dist }, prev: { ...prev }, settled: [...settled],
      improved: false, ...f,
    })

    for (let round = 0; round < nodes.length; round++) {
      let u: string | null = null
      for (const n of nodes) if (!settled.includes(n) && (u === null || dist[n] < dist[u])) u = n
      if (u === null || dist[u] === INF) {
        frames.push(snap({ act: 'done', log: '剩余顶点均不可达，算法结束' }))
        break
      }
      settled.push(u)
      frames.push(snap({
        act: 'pick', at: u,
        log: `选出未确定点中距离最小的 ${u}（d=${fmt(dist[u])}），确定其最短路`,
      }))

      for (const { to: v, w } of adj[u]) {
        if (settled.includes(v)) {
          frames.push(snap({ act: 'skip', at: u, to: v, log: `${u}→${v}：${v} 已确定，跳过` }))
          continue
        }
        const cand = dist[u] + w
        if (cand < dist[v]) {
          const old = dist[v]
          dist[v] = cand; prev[v] = u
          frames.push(snap({
            act: 'relax', at: u, to: v, improved: true,
            log: `松弛 ${u}→${v}：${fmt(dist[u])}+${w}=${cand} < ${fmt(old)}，更新为 ${cand}，前驱记为 ${u}`,
          }))
        } else {
          frames.push(snap({
            act: 'relax', at: u, to: v,
            log: `松弛 ${u}→${v}：${fmt(dist[u])}+${w}=${cand} ≥ ${fmt(dist[v])}，不更新`,
          }))
        }
      }
    }
    if (frames.length === 0 || frames[frames.length - 1].act !== 'done')
      frames.push(snap({ act: 'done', log: '全部顶点已确定最短路' }))

    return {
      axis: { kind: 'step', label: '操作序号' },
      initial: () => ({
        i: -1, act: 'pick', at: '', to: '',
        dist: Object.fromEntries(nodes.map(n => [n, n === source ? 0 : INF])),
        prev: Object.fromEntries(nodes.map(n => [n, null])),
        settled: [], improved: false, log: '',
      }),
      describe: s => s.log,
      step(prev2) {
        const base = prev2 ?? this.initial()
        const i = base.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}
