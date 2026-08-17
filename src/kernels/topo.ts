/**
 * 内核：拓扑排序与关键路径（数据结构 · 图 / AOE 网）
 * 轴：step
 *
 * topo     每次取一个入度为 0 的顶点输出，再把它的出边删掉
 * critical AOE 网求关键路径：先正推 ve，再逆推 vl，最后 e == l 的活动就是关键活动
 *
 * 关键路径那部分是 408 里出错率最高的内容之一，
 * 原因就是 ve/vl 两个方向容易搞反 —— 所以这里把两趟分开走。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type TopoState = {
  i: number
  phase: 'topo' | 've' | 'vl' | 'activity' | 'done'
  /** 当前各顶点入度 */
  indeg: Record<string, number>
  /** 已输出的拓扑序列 */
  order: string[]
  /** 本步处理的顶点 */
  at: string
  /** 事件最早/最迟发生时间 */
  ve: Record<string, number>
  vl: Record<string, number>
  /** 活动的最早/最迟开始时间；key 是边 id */
  ee: Record<string, number>
  el: Record<string, number>
  /** 关键活动 */
  critical: string[]
  log: string
}

export const TOPO_VISIBLE = [
  'i', 'phase', 'indeg', 'order', 'at', 've', 'vl', 'ee', 'el', 'critical', 'log',
] as const

type Frame = Omit<TopoState, 'i'>

export const topoKernel: Kernel<TopoState> = {
  kind: 'topo',

  compile(doc: SimDocument): CompiledModel<TopoState> {
    const operation = str(doc.params, 'operation')     // 'topo' | 'critical'
    const nodes = doc.entities.filter(e => e.type === 'node').map(e => e.id)
    const edges = doc.entities.filter(e => e.type === 'edge').map(e => ({
      id: e.id, from: str(e.attrs, 'from'), to: str(e.attrs, 'to'), w: num(e.attrs, 'w'),
    }))

    const frames: Frame[] = []
    const indeg: Record<string, number> = {}
    for (const n of nodes) indeg[n] = 0
    for (const e of edges) indeg[e.to] = (indeg[e.to] ?? 0) + 1

    const ve: Record<string, number> = {}
    const vl: Record<string, number> = {}
    const ee: Record<string, number> = {}
    const el: Record<string, number> = {}
    const order: string[] = []

    const put = (f: Partial<Frame> & { phase: Frame['phase']; log: string }) => frames.push({
      indeg: { ...indeg }, order: [...order], at: '',
      ve: { ...ve }, vl: { ...vl }, ee: { ...ee }, el: { ...el },
      critical: [], ...f,
    })

    // ── 拓扑排序（两种模式都要先做，关键路径依赖它的顺序）──
    const deg = { ...indeg }
    put({ phase: 'topo', indeg: { ...deg },
      log: `初始入度：${nodes.map(n => `${n}:${deg[n]}`).join('  ')}` })

    const q = nodes.filter(n => deg[n] === 0).sort()
    while (q.length > 0) {
      const n = q.shift()!
      order.push(n)
      const outs = edges.filter(e => e.from === n)
      for (const e of outs) {
        deg[e.to]--
        if (deg[e.to] === 0) q.push(e.to)
      }
      q.sort()
      put({
        phase: 'topo', indeg: { ...deg }, order: [...order], at: n,
        log: `输出入度为 0 的 ${n}，删掉它的 ${outs.length} 条出边`
          + (outs.length ? ` → ${outs.map(e => `${e.to} 入度降为 ${deg[e.to]}`).join('、')}` : '')
          + `；当前序列 ${order.join(' ')}`,
      })
    }
    const acyclic = order.length === nodes.length
    if (!acyclic) {
      put({ phase: 'done', order: [...order],
        log: `还有 ${nodes.length - order.length} 个顶点入度不为 0 —— 图中存在环，不存在拓扑序列` })
    }

    if (operation === 'critical' && acyclic) {
      // ── 正推 ve：事件最早发生时间 ──────────────────
      for (const n of nodes) ve[n] = 0
      put({ phase: 've', log: `按拓扑序正推 ve：源点 ve = 0，其余取「所有前驱 ve + 边权」的最大值` })
      for (const n of order) {
        const ins = edges.filter(e => e.to === n)
        if (ins.length > 0) ve[n] = Math.max(...ins.map(e => ve[e.from] + e.w))
        put({
          phase: 've', at: n, ve: { ...ve },
          log: ins.length === 0
            ? `${n} 没有前驱 → ve(${n}) = 0`
            : `ve(${n}) = max(${ins.map(e => `ve(${e.from})+${e.w}=${ve[e.from] + e.w}`).join(', ')}) = ${ve[n]}`
              + ` —— 取最大是因为所有前置活动都完成了才能开始`,
        })
      }

      // ── 逆推 vl：事件最迟发生时间 ──────────────────
      const total = ve[order[order.length - 1]]
      for (const n of nodes) vl[n] = total
      put({ phase: 'vl', ve: { ...ve }, vl: { ...vl },
        log: `工程总工期 = 汇点的 ve = ${total}；按拓扑逆序推 vl，`
          + `汇点 vl = ve = ${total}，其余取「所有后继 vl − 边权」的最小值` })
      for (let k = order.length - 1; k >= 0; k--) {
        const n = order[k]
        const outs = edges.filter(e => e.from === n)
        if (outs.length > 0) vl[n] = Math.min(...outs.map(e => vl[e.to] - e.w))
        put({
          phase: 'vl', at: n, ve: { ...ve }, vl: { ...vl },
          log: outs.length === 0
            ? `${n} 没有后继 → vl(${n}) = ve(${n}) = ${vl[n]}`
            : `vl(${n}) = min(${outs.map(e => `vl(${e.to})−${e.w}=${vl[e.to] - e.w}`).join(', ')}) = ${vl[n]}`
              + ` —— 取最小是因为不能拖累任何一个后继`,
        })
      }

      // ── 活动的 e 与 l ──────────────────────────────
      const crit: string[] = []
      put({ phase: 'activity', ve: { ...ve }, vl: { ...vl },
        log: `逐条算活动：e = 起点的 ve，l = 终点的 vl − 边权；e == l 的就是关键活动` })
      for (const e of edges) {
        ee[e.id] = ve[e.from]
        el[e.id] = vl[e.to] - e.w
        const isCrit = ee[e.id] === el[e.id]
        if (isCrit) crit.push(e.id)
        put({
          phase: 'activity', at: e.id, ve: { ...ve }, vl: { ...vl },
          ee: { ...ee }, el: { ...el }, critical: [...crit],
          log: `活动 ${e.id}（${e.from}→${e.to}，耗时 ${e.w}）：`
            + `e = ve(${e.from}) = ${ee[e.id]}，l = vl(${e.to}) − ${e.w} = ${el[e.id]}`
            + `，时间余量 ${el[e.id] - ee[e.id]}`
            + (isCrit ? ' → **关键活动**，一点都不能拖' : ' → 有余量，不是关键活动'),
        })
      }
      put({
        phase: 'done', ve: { ...ve }, vl: { ...vl }, ee: { ...ee }, el: { ...el }, critical: [...crit],
        log: `关键路径由 ${crit.join('、')} 组成，总工期 ${total}`
          + ` —— 缩短任何一条非关键活动都不会让工期变短`,
      })
    } else if (acyclic) {
      put({ phase: 'done', order: [...order],
        log: `拓扑排序完成：${order.join(' → ')}` })
    }

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({
        i: -1, phase: 'topo', indeg: {}, order: [], at: '',
        ve: {}, vl: {}, ee: {}, el: {}, critical: [], log: '',
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
