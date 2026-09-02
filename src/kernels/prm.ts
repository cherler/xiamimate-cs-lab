/**
 * 内核：PRM 概率路图 · 多查询采样规划 —— 先撒点连成一张无碰路图，再在图上搜路；建一次路图、答多次查询（具身智能 · 运动规划 / 面试八股）
 * 轴：step —— 引子(两阶段/多查询) → 采样自由构型(节点) → 连 k 近邻(边要碰撞检测、穿障的丢掉) → 查询(起终点接入+图搜索) → 结局(够密连通/太稀断开) → 收尾。
 *
 * 和 RRT(单查询、朝一个目标长树)不同,PRM 是**多查询**:①**建图(learning)**:在自由空间随机采样 N 个构型当节点,每个连 k 近邻——但**边要碰撞检测、穿过障碍的边丢掉**(碰撞检测是最贵的一步);②**查询(query)**:把起点/终点接入路图,再用 Dijkstra/A* 在图上搜最短路。
 *   建一次路图可**反复回答不同起终点**的查询(适合固定环境、多次规划)。**难点=窄通道/采样密度**:采样太稀路图会**断开**、找不到路。param 选采样密度(够密连通 / 太稀断开)。节点/边碰撞/最短路全现算。连「RRT(单查询)/A*·Dijkstra(图搜索)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Dens = 'dense' | 'sparse'
type Pt = { id: string; x: number; y: number }
export type PrmEdge = { a: string; b: string; len: number; blocked: boolean }
export type PrmState = {
  i: number
  step: number
  stage: 'intro' | 'sample' | 'connect' | 'query' | 'outcome' | 'done'
  dens: Dens
  densLabel: string
  nodes: Pt[]
  obstacle: { x0: number; y0: number; x1: number; y1: number }
  edges: PrmEdge[]           // 候选边(含 blocked 标记)
  roadmap: PrmEdge[]         // 无碰路图边
  path: string[]; pathLen: number; connected: boolean
  showSample: boolean; showConnect: boolean; showQuery: boolean; showOut: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PrmState, 'i'>

const OBS = { x0: 4, y0: 1, x1: 6, y1: 4 }
const ALL: Pt[] = [
  { id: 'S', x: 1, y: 2.5 }, { id: 'A', x: 3, y: 4 }, { id: 'B', x: 3, y: 1 },
  { id: 'C', x: 5, y: 5 }, { id: 'D', x: 7, y: 4 }, { id: 'G', x: 9, y: 2.5 },
]
const CAND: [string, string][] = [['S', 'A'], ['S', 'B'], ['A', 'B'], ['A', 'C'], ['C', 'D'], ['D', 'G'], ['B', 'D']]
const r2 = (x: number) => Math.round(x * 100) / 100
const dist = (a: Pt, b: Pt) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
// 线段是否穿过障碍矩形:沿段采样 20 点看有没有落进框内
function hits(a: Pt, b: Pt, o: typeof OBS): boolean {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t
    if (x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) return true
  }
  return false
}

export const prmKernel: Kernel<PrmState> = {
  kind: 'prm',
  compile(doc: SimDocument): CompiledModel<PrmState> {
    const dens: Dens = String(doc.params?.density ?? '够密').includes('稀') ? 'sparse' : 'dense'
    const densLabel = dens === 'dense' ? '够密(连通)' : '太稀(断开)'
    const nodes = dens === 'dense' ? ALL : ALL.filter(n => n.id !== 'C')   // 太稀:丢掉过顶的连接点 C
    const idset = new Set(nodes.map(n => n.id))
    const at = (id: string) => nodes.find(n => n.id === id)!

    const edges: PrmEdge[] = CAND.filter(([a, b]) => idset.has(a) && idset.has(b)).map(([a, b]) => {
      const blocked = hits(at(a), at(b), OBS)
      return { a, b, len: r2(dist(at(a), at(b))), blocked }
    })
    const roadmap = edges.filter(e => !e.blocked)

    // Dijkstra S→G
    const adj: Record<string, [string, number][]> = {}
    for (const n of nodes) adj[n.id] = []
    for (const e of roadmap) { adj[e.a]!.push([e.b, e.len]); adj[e.b]!.push([e.a, e.len]) }
    const D: Record<string, number> = {}, prev: Record<string, string | null> = {}
    for (const n of nodes) { D[n.id] = Infinity; prev[n.id] = null }
    D['S'] = 0
    const Q = new Set(nodes.map(n => n.id))
    while (Q.size) {
      let u: string | null = null, best = Infinity
      for (const id of Q) if (D[id]! < best) { best = D[id]!; u = id }
      if (u == null) break
      Q.delete(u)
      for (const [v, w] of adj[u]!) if (Q.has(v) && D[u]! + w < D[v]!) { D[v] = D[u]! + w; prev[v] = u }
    }
    const connected = D['G']! < Infinity
    const path: string[] = []
    if (connected) { let c: string | null = 'G'; while (c) { path.unshift(c); c = prev[c] } }
    const pathLen = connected ? r2(D['G']!) : 0

    const frames: Frame[] = []
    const b0 = { dens, densLabel, nodes, obstacle: OBS, edges, roadmap, path, pathLen, connected, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showSample: boolean; showConnect: boolean; showQuery: boolean; showOut: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    const blockedE = edges.filter(e => e.blocked)
    push({
      stage: 'intro', showSample: false, showConnect: false, showQuery: false, showOut: false,
      focus: `PRM=两阶段(建路图+查询)、多查询;和 RRT(单查询长树)不同。采样密度：${densLabel}`,
      log: `**PRM 概率路图:先修一张"路网"、再在上面找路**\n和「RRT」(朝一个目标长一棵树、**单查询**)不同,PRM 是**多查询**——**建一次路图、反复答不同起终点**的查询,适合固定环境反复规划。两阶段:\n· **建图(learning)**:自由空间随机采样一堆构型当节点,每个连 k 近邻;\n· **查询(query)**:起点/终点接入路图,再用 Dijkstra/A\* 搜最短路。\n本例 2D:一个障碍矩形挡在中间,节点 ${nodes.map(n => n.id).join('、')}。当前采样 **${densLabel}**。` })

    push({
      stage: 'sample', showSample: true, showConnect: false, showQuery: false, showOut: false,
      focus: `采样:在自由空间撒 ${nodes.length} 个无碰构型当节点(避开障碍)`,
      log: `**① 采样(建图第一步)**\n在自由空间(避开障碍)随机撒 **${nodes.length}** 个构型当路图节点:${nodes.map(n => `${n.id}(${n.x},${n.y})`).join('、')}。\n采样点必须无碰(落在障碍里的丢掉)。**采样越密、路图越可能连通**,但计算也越多——这个密度是 PRM 的核心权衡。${dens === 'sparse' ? '(本次太稀:少了障碍上方的连接点 C。)' : ''}` })

    push({
      stage: 'connect', showSample: true, showConnect: true, showQuery: false, showOut: false,
      focus: `连边:每节点连 k 近邻,但边要碰撞检测——穿过障碍的丢掉(${blockedE.length} 条被挡)`,
      log: `**② 连 k 近邻 + 碰撞检测(最贵的一步)**\n每个节点尝试连它的 k 个近邻,但**每条边都要碰撞检测**:线段穿过障碍的**丢掉**。\n候选边 ${edges.length} 条,其中 **${blockedE.length} 条被障碍挡掉**:${blockedE.map(e => `${e.a}-${e.b}(穿障)`).join('、') || '无'}。\n保留的无碰路图边(${roadmap.length} 条):${roadmap.map(e => `${e.a}-${e.b}(${e.len})`).join('、')}。\n**边的碰撞检测是 PRM 最耗时的部分**(节点多、每对都要查)。${blockedE.length ? `注意 ${blockedE[0]!.a}-${blockedE[0]!.b} 这条本来最短、却被障碍挡住,只能绕。` : ''}` })

    push({
      stage: 'query', showSample: true, showConnect: true, showQuery: true, showOut: false,
      focus: connected ? `查询:起点 S、终点 G 接入路图 → Dijkstra 搜最短路 = ${path.join('→')}(长 ${pathLen})` : `查询:S、G 接入路图 → Dijkstra 发现两端不连通、无路`,
      log: `**③ 查询(在路图上搜路)**\n把起点 **S**、终点 **G** 接入路图(连到最近的可见节点),再用 **Dijkstra/A\*** 在图上搜最短路。\n${connected
        ? `找到:**${path.join(' → ')}**,总长 **${pathLen}**。因为最短的 B-D 被障碍挡了,路径**绕过障碍上方**(经 C)。`
        : `**搜不到!** 路图里 S 这边 {${nodes.filter(n => ['S', 'A', 'B'].includes(n.id)).map(n => n.id).join(',')}} 和 G 那边 {${nodes.filter(n => ['D', 'G'].includes(n.id)).map(n => n.id).join(',')}} **断成两块**——中间的桥(过障碍上方)因为缺了采样点连不上。`}` })

    push({
      stage: 'outcome', showSample: true, showConnect: true, showQuery: true, showOut: true,
      focus: connected ? `连通:同一张路图能反复答不同查询(多查询);本次 S→G = ${pathLen}` : `断开:采样太稀→路图不连通→找不到路(要加采样、尤其窄通道)`,
      log: `**④ 结局:${connected ? '连通、找到路' : '断开、找不到路'}**\n${connected
        ? `路图连通,S→G 最短路 = **${path.join('→')}**(${pathLen})。**关键优势——多查询**:这张路图建好后,换任何起终点(比如 A→D)都能**直接复用**、再搜一次图就行,不用重建。这是 PRM 相对 RRT(单查询、每次重长树)的最大价值。`
        : `采样太稀,路图在障碍附近**断开**,S 和 G 不连通、**找不到路**。这不是没有路、是**路图没覆盖到**——解法是**加采样**(尤其在障碍附近/窄通道多撒点)。这正是 PRM 的核心难点:**窄通道**采样概率低、容易漏。`}` })

    push({
      stage: 'done', showSample: true, showConnect: true, showQuery: true, showOut: true, phase: 'done',
      focus: `收尾:PRM=采样+连k近邻(碰撞检测)+图搜索;多查询;难点窄通道;连 RRT(单查询)/Dijkstra/A*`,
      log: `**小结:PRM = 建路图 + 图搜索,多查询**\n· **建图**:采样自由构型当节点、连 k 近邻、**边碰撞检测**(最贵)丢掉穿障的;· **查询**:起终点接入、Dijkstra/A\* 搜最短路。\n**vs RRT**:RRT **单查询**(朝一个目标长树、用完即弃)、增量、适合一次性/高维;PRM **多查询**(建一次路图答多次)、适合**固定环境反复规划**。都概率完备。\n**难点=窄通道**:窄通道采样概率低、路图容易在那里断开(本例太稀就断了)。对策:**加采样**、**窄通道采样**(桥采样 bridge sampling、高斯采样)、**PRM\***(渐近最优版、连接半径随 n 收缩)。\n**连到别的课**:和「RRT/RRT\*」同属采样规划(单/多查询之分);查询阶段的图搜索就是「A\* 寻路」/Dijkstra;找到的路还要「梯形速度曲线/轨迹规划」配速度才能执行。面试延伸:PRM vs RRT(多/单查询)、碰撞检测为何最贵、窄通道问题与桥采样、PRM\*、和 A* 的关系。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showSample: false, showConnect: false, showQuery: false, showOut: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'PRM 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
