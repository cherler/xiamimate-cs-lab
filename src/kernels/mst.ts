/**
 * 内核：最小生成树（数据结构 · 图）
 * 轴：step
 *
 * Prim    从一个点长出去：每次选「连接已选集合与未选集合」的最小边
 * Kruskal 从最小的边开始：边按权排序逐条考察，成环就丢掉
 *
 * 两者选出的边集可能不同（权值相等时），但**总权值一定相同** ——
 * 这条性质比记住"哪条边先被选"更值得验。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type MstState = {
  i: number
  /** 已选入生成树的边 id */
  chosen: string[]
  /** 已并入的顶点（Prim 用） */
  inTree: string[]
  /** 本步考察的边 */
  edge: string
  /** 本步的结论 */
  act: 'consider' | 'take' | 'skip' | 'done'
  /** Kruskal 的并查集：顶点 → 所属集合代表 */
  find: Record<string, string>
  weight: number
  log: string
}

export const MST_VISIBLE =
  ['i', 'chosen', 'inTree', 'edge', 'act', 'find', 'weight', 'log'] as const

type Frame = Omit<MstState, 'i'>

export const mstKernel: Kernel<MstState> = {
  kind: 'mst',

  compile(doc: SimDocument): CompiledModel<MstState> {
    const algorithm = str(doc.params, 'algorithm')
    const start = str(doc.params, 'start')
    const nodes = doc.entities.filter(e => e.type === 'node').map(e => e.id)
    const edges = doc.entities.filter(e => e.type === 'edge').map(e => ({
      id: e.id, from: str(e.attrs, 'from'), to: str(e.attrs, 'to'), w: num(e.attrs, 'w'),
    }))

    const frames: Frame[] = []
    let chosen: string[] = []
    let weight = 0
    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) => frames.push({
      chosen: [...chosen], inTree: [], edge: '', find: {}, weight, ...f,
    })

    if (algorithm === 'Prim') {
      const inTree = new Set<string>([start])
      put({ act: 'consider', inTree: [...inTree],
        log: `Prim：从顶点 ${start} 出发，此时树里只有它一个` })

      while (inTree.size < nodes.length) {
        //  候选：一端在树里、另一端不在的所有边
        const cand = edges.filter(e =>
          (inTree.has(e.from) && !inTree.has(e.to)) || (inTree.has(e.to) && !inTree.has(e.from)))
        if (cand.length === 0) {
          put({ act: 'done', inTree: [...inTree], log: '图不连通，剩下的顶点长不进来' })
          break
        }
        //  权相同取 id 字典序小的，保证可复现
        cand.sort((a, b) => (a.w - b.w) || a.id.localeCompare(b.id))
        const pick = cand[0]
        const grew = inTree.has(pick.from) ? pick.to : pick.from

        put({ act: 'consider', inTree: [...inTree], edge: pick.id,
          log: `候选边：${cand.map(e => `${e.id}(${e.w})`).join('、')}`
            + ` → 最小的是 ${pick.id}（权 ${pick.w}）` })

        inTree.add(grew)
        chosen.push(pick.id)
        weight += pick.w
        put({ act: 'take', inTree: [...inTree], edge: pick.id, weight,
          log: `选入 ${pick.id}（${pick.from}–${pick.to}，权 ${pick.w}），`
            + `顶点 ${grew} 并入树；当前总权 ${weight}` })
      }
      put({ act: 'done', inTree: [...inTree], weight,
        log: `Prim 完成：选了 ${chosen.length} 条边，总权值 ${weight}`
          + `（n 个顶点的生成树恰好 n−1 条边）` })
    } else {
      // ── Kruskal：并查集判环 ──────────────────────────
      const parent: Record<string, string> = {}
      for (const n of nodes) parent[n] = n
      const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])))

      const sorted = [...edges].sort((a, b) => (a.w - b.w) || a.id.localeCompare(b.id))
      put({ act: 'consider', find: { ...parent },
        log: `Kruskal：先把所有边按权值升序排好 → `
          + sorted.map(e => `${e.id}(${e.w})`).join('、') })

      for (const e of sorted) {
        const ra = find(e.from), rb = find(e.to)
        if (ra === rb) {
          put({ act: 'skip', edge: e.id, find: { ...parent },
            log: `考察 ${e.id}（${e.from}–${e.to}，权 ${e.w}）：两端已在同一集合 → `
              + `加进去会成环，丢弃` })
          continue
        }
        parent[ra] = rb
        chosen.push(e.id)
        weight += e.w
        put({ act: 'take', edge: e.id, find: { ...parent }, weight,
          log: `考察 ${e.id}（${e.from}–${e.to}，权 ${e.w}）：两端分属不同集合 → `
            + `选入并合并集合；当前总权 ${weight}` })
        if (chosen.length === nodes.length - 1) break
      }
      put({ act: 'done', find: { ...parent }, weight,
        log: `Kruskal 完成：选了 ${chosen.length} 条边，总权值 ${weight}` })
    }

    return {
      axis: { kind: 'step', label: '操作序号' },
      initial: () => ({
        i: -1, chosen: [], inTree: [], edge: '', act: 'consider',
        find: {}, weight: 0, log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}
