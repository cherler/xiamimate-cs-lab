/**
 * 内核：A* 寻路（经典算法 · 原理：f=g+h,已走代价 + 到终点的乐观估计,优先探"看起来最有希望"的格）
 * 轴：step —— 网格上从起点找到终点。每步从**开放集**里挑 f=g+h 最小的格**展开**:g=从起点已走的步数、
 *      h=到终点的曼哈顿距离(乐观估计、永不高估)。展开=把它移进**关闭集**、把邻居加进开放集,直到取到终点。
 *
 * A* 是带**启发**的最短路搜索,BFS/Dijkstra 的聪明版。Dijkstra 只看**已走代价 g**,四面八方均匀铺开;
 * A* 额外加一个**启发 h**——对"从这里到终点还要多远"的乐观估计(这里用曼哈顿距离,墙都当不存在,故永不高估)。
 * 用 **f = g + h** 排序开放集:g 保证不贪近路走冤枉、h 把搜索**拽向终点**。只要 h 不高估(admissible),A* 找到的就是**最短路**,
 * 而且比 Dijkstra 少展开很多格。h=0 时 A* 退化成 Dijkstra。
 *
 * 本实验:8×5 网格,起点在左、终点在右,中间一堵墙(留个缺口)。看 A* 先沿着 h 的指引直扑终点(f=7),
 * 撞墙后被迫绕行(f=9),从缺口穿过、到达终点。每格的 g/h/f 都可手算核对,共展开 19 格、最短路 9 步。游戏 NPC 寻路、地图导航都用它。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export const ASTAR_W = 8
export const ASTAR_H = 5
export const ASTAR_WALLS = ['4,0', '4,1', '4,2']
export const ASTAR_START: [number, number] = [0, 2]
export const ASTAR_GOAL: [number, number] = [7, 2]

export type AStarState = {
  i: number
  step: number
  cur: [number, number]
  curG: number; curH: number; curF: number
  closed: string[]
  open: string[]
  gMap: Record<string, number>
  fMap: Record<string, number>
  path: string[]
  act: string                  // 'expand' | 'goal' | 'done'
  expanded: number
  phase: 'run' | 'done'
  log: string
}

export const ASTAR_VISIBLE = [
  'step', 'cur', 'curG', 'curH', 'curF', 'closed', 'open', 'gMap', 'fMap', 'path', 'act', 'expanded', 'phase', 'log',
] as const

type Frame = Omit<AStarState, 'i'>

const key = (c: number, r: number) => `${c},${r}`
const H = (c: number, r: number) => Math.abs(c - ASTAR_GOAL[0]) + Math.abs(r - ASTAR_GOAL[1])

export const astarKernel: Kernel<AStarState> = {
  kind: 'astar',

  compile(_doc: SimDocument): CompiledModel<AStarState> {
    const wallSet = new Set(ASTAR_WALLS)
    const inb = (c: number, r: number) => c >= 0 && c < ASTAR_W && r >= 0 && r < ASTAR_H && !wallSet.has(key(c, r))

    const g: Record<string, number> = {}
    const f: Record<string, number> = {}
    const parent: Record<string, string> = {}
    const closed = new Set<string>()
    const openSet = new Set<string>()
    const open: { c: number; r: number; f: number }[] = []

    const sk = key(...ASTAR_START)
    g[sk] = 0; f[sk] = H(...ASTAR_START)
    open.push({ c: ASTAR_START[0], r: ASTAR_START[1], f: f[sk] }); openSet.add(sk)

    const frames: Frame[] = []
    let expanded = 0
    let goalKey = ''

    while (open.length) {
      open.sort((a, b) => a.f - b.f || H(b.c, b.r) - H(a.c, a.r))
      const cur = open.shift()!
      const ck = key(cur.c, cur.r)
      if (closed.has(ck)) continue
      closed.add(ck); openSet.delete(ck)
      expanded++
      const isGoal = cur.c === ASTAR_GOAL[0] && cur.r === ASTAR_GOAL[1]
      const curG = g[ck], curH = H(cur.c, cur.r)

      if (!isGoal) {
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = cur.c + dc, nr = cur.r + dr, nk = key(nc, nr)
          if (!inb(nc, nr) || closed.has(nk)) continue
          const ng = g[ck] + 1
          if (g[nk] === undefined || ng < g[nk]) {
            g[nk] = ng; f[nk] = ng + H(nc, nr); parent[nk] = ck
            open.push({ c: nc, r: nr, f: f[nk] }); openSet.add(nk)
          }
        }
      }

      frames.push({
        step: frames.length, cur: [cur.c, cur.r], curG, curH, curF: curG + curH,
        closed: [...closed], open: [...openSet], gMap: { ...g }, fMap: { ...f }, path: [],
        act: isGoal ? 'goal' : 'expand', expanded, phase: 'run',
        log: isGoal
          ? `取到**终点** (${cur.c},${cur.r})!g=${curG}(走了 ${curG} 步)、h=0,f=${curG}。开始回溯路径。`
          : `展开 f 最小的格 (${cur.c},${cur.r}):g=${curG}、h=${curH}、**f=${curG + curH}**。移入关闭集,把可走的邻居加进开放集。`,
      })
      if (isGoal) { goalKey = ck; break }
    }

    // 回溯路径
    const path: string[] = []
    let curk: string | undefined = goalKey
    while (curk) { path.unshift(curk); curk = parent[curk] }

    frames.push({
      step: frames.length, cur: ASTAR_GOAL, curG: g[goalKey], curH: 0, curF: g[goalKey],
      closed: [...closed], open: [...openSet], gMap: { ...g }, fMap: { ...f }, path: path.slice(),
      act: 'done', expanded, phase: 'done',
      log: `**最短路找到**:${path.length - 1} 步(${path.join(' → ')})。A* 用 f=g+h 排序:g 防走冤枉、h(曼哈顿,永不高估)把搜索拽向终点——` +
        `只展开了 ${expanded} 格就找到最优解,比 Dijkstra(只看 g、四面均匀铺)省很多。h 不高估就保证最短路;h=0 就退化成 Dijkstra。游戏寻路、地图导航都靠它。`,
    })

    const base0: Frame = {
      step: -1, cur: ASTAR_START, curG: 0, curH: H(...ASTAR_START), curF: H(...ASTAR_START),
      closed: [], open: [sk], gMap: { [sk]: 0 }, fMap: { [sk]: H(...ASTAR_START) }, path: [],
      act: '', expanded: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '展开格' },
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
