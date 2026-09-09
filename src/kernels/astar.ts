/**
 * 内核：A* 寻路（经典算法 · f = g + w·h，已走代价 + 到终点的估计）
 * 轴：step —— 每步从开放集里挑 f 最小的格展开
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本一张地图、一个启发、一个权重，从头顺到尾。
 * 而它自己的注释里写着三句话：
 *   「只要 h 不高估（admissible），A* 找到的就是最短路」
 *   「h=0 时 A* 退化成 Dijkstra」
 *   「比 Dijkstra 少展开很多格」
 * **三句一句都没在屏幕上兑现过。** 只演成功的样子，等于没演。
 *
 * 这一版把这三句变成三个可以拨的旋钮，并且把"可采纳"这件事**暴力验出来**：
 *
 * ① **权重 w 一个旋钮，四种算法**：f = g + w·h。
 *    w=0 就是 **Dijkstra**（只看已走代价，四面均匀铺开）；w=1 是标准 **A***；
 *    w>1 是**加权 A***（快，但 w·h 可能高估 → **可能找不到最短路**）。
 * ② **可采纳性是量出来的，不是引用的**：反向 BFS 先算出每一格到终点的**真实**最短距离，
 *    再逐格比 w·h 有没有超过它。超了多少、超在哪一格，屏幕上直接读。
 *    然后把它跟"这一趟找到的路是不是最短"并排 —— **定理的两头同时摆着**。
 * ③ **凹形陷阱**那张图专门演 h 的坏处：启发把搜索一头拽进死胡同，
 *    展开格数反而比 Dijkstra 还多。**"启发总是更快"是错的。**
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  地图
// ═══════════════════════════════════════════════════════════════

export const ASTAR_W = 11
export const ASTAR_H = 7
export const ASTAR_START: [number, number] = [0, 3]
export const ASTAR_GOAL: [number, number] = [10, 3]

const M_OPEN = '开阔无墙'
const M_WALL = '一堵墙（留缺口）'
const M_TRAP = '凹形陷阱（开口朝起点）'
const M_SWAMP = '沼泽（穿过去贵、绕开便宜）'
export const ASTAR_MAPS = [M_OPEN, M_WALL, M_TRAP, M_SWAMP] as const

/*  ⭐ **沼泽这一档是为了让"高估 → 找不到最短路"真的发生。**
    前三张图上，w 拉到 5 也照样找到最短路 —— 因为均匀代价的 4 邻域网格上曼哈顿是**一致**启发，
    任何单调靠近终点的路长度都正好等于曼哈顿距离，也就是最优。**在那种图上根本构造不出反例。**
    只把定理写在旁白里、屏幕上永远不出事，那句话就等于没讲。

    加上地形代价之后就不一样了：g 记的是**代价**不是步数。穿过沼泽步数少但代价高，
    绕开步数多但便宜。w 一大，f 被 h 主导，搜索一头扎进沼泽 —— **路更贵了**。
    游戏寻路里的"地形权重"正是这么回事。 */
const SWAMP_COST = 4
const swampCells = () => {
  const out: string[] = []
  for (let c = 4; c <= 6; c++) for (let r = 2; r <= 4; r++) out.push(`${c},${r}`)
  return out
}

/** 权重 w：f = g + w·h。0=Dijkstra、1=标准 A*、>1=加权 A*（可能高估） */
export const ASTAR_WEIGHTS = [0, 1, 1.4, 5] as const

const HH_MANHATTAN = '曼哈顿（紧）'
const HH_EUCLID = '欧氏（松）'
export const ASTAR_HEURISTICS = [HH_MANHATTAN, HH_EUCLID] as const

function wallsOf(map: string): string[] {
  if (map === M_OPEN || map === M_SWAMP) return []
  if (map === M_WALL) {
    //  竖墙在 c=5，上面 5 行是墙、底下两行是缺口
    return [0, 1, 2, 3, 4].map(r => `5,${r}`)
  }
  /*  凹形陷阱：一个开口朝**起点**的 C 形。启发一路把搜索往右拽，
      于是它径直钻进袋子里，撞到底才发现要退出来绕行。 */
  const w: string[] = []
  for (let r = 1; r <= 5; r++) w.push(`8,${r}`)          //  袋底（竖）
  for (let c = 4; c <= 8; c++) { w.push(`${c},1`); w.push(`${c},5`) }   //  上下两条臂
  return [...new Set(w)]
}

const key = (c: number, r: number) => `${c},${r}`

// ═══════════════════════════════════════════════════════════════

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
  act: string
  expanded: number
  /** 地图上的墙 */
  walls: string[]
  mapName: string
  weight: number
  hName: string
  /** 每一格到终点的**真实**最短距离（反向 BFS 算的），用来验可采纳性 */
  trueDist: Record<string, number>
  /** w·h 有没有在任何一格上超过真实距离；超了多少、超在哪 */
  admissible: boolean
  maxOver: number
  overAt: string
  /** 这一趟走出来的路的**代价**、步数，以及真正的最小代价 */
  pathLen: number
  steps: number
  optimalLen: number
  optimal: boolean
  /** 代价 > 1 的格子（沼泽），以及它们的单格代价 */
  swamp: string[]
  swampCost: number
  /** 同一张地图上，各个 w 各展开了多少格、找到的路多长 —— 静默跑出来的对照 */
  sweep: { w: number; expanded: number; pathLen: number; steps: number; optimal: boolean; admissible: boolean }[]
  /** 可走的格子总数（Dijkstra 最多展开这么多） */
  freeCells: number
  phase: 'run' | 'done'
  log: string
}

export const ASTAR_VISIBLE = [
  'step', 'cur', 'curG', 'curH', 'curF', 'closed', 'open', 'gMap', 'fMap', 'path', 'act', 'expanded',
  'walls', 'mapName', 'weight', 'hName', 'trueDist', 'admissible', 'maxOver', 'overAt',
  'pathLen', 'steps', 'optimalLen', 'optimal', 'swamp', 'swampCost', 'sweep', 'freeCells', 'phase', 'log',
] as const

type Frame = Omit<AStarState, 'i'>

export const astarKernel: Kernel<AStarState> = {
  kind: 'astar',

  compile(doc: SimDocument): CompiledModel<AStarState> {
    const mapName = String(doc.params.map ?? M_WALL)
    const weight = Number(doc.params.weight ?? 1)
    const hName = String(doc.params.h ?? HH_MANHATTAN)

    const walls = wallsOf(mapName)
    const wallSet = new Set(walls)
    const inb = (c: number, r: number) => c >= 0 && c < ASTAR_W && r >= 0 && r < ASTAR_H && !wallSet.has(key(c, r))

    /*  ⚠️ **g 记的是代价，不是步数。** 沼泽档里每一格的代价不一样 ——
        这是让"高估 → 走冤枉路"能真的发生的前提（见上面 M_SWAMP 那段注释）。
        h 仍然按曼哈顿/欧氏算，也就是"每步至少 1"的乐观估计，所以 w=1 时它仍然可采纳。 */
    const swamp = new Set(mapName === M_SWAMP ? swampCells() : [])
    const costAt = (c: number, r: number) => (swamp.has(key(c, r)) ? SWAMP_COST : 1)

    /** 原始启发（w=1 时的 h）。曼哈顿在 4 邻域网格上是**紧**的、欧氏更松（估得更小）。 */
    const h0 = (c: number, r: number) => {
      const dc = Math.abs(c - ASTAR_GOAL[0]), dr = Math.abs(r - ASTAR_GOAL[1])
      return hName === HH_EUCLID ? Math.hypot(dc, dr) : dc + dr
    }
    const hW = (c: number, r: number) => weight * h0(c, r)

    /*  ⭐ **反向 Dijkstra：每一格到终点的真实最小代价。**
        "h 不高估"这句话的定义就是拿它来比的 —— 有了它，可采纳性不用引用定理，逐格量。
        ⚠️ 用 Dijkstra 不用 BFS：沼泽档的边权不是 1，BFS 给出的是步数不是代价，
        拿步数当"真实距离"去验可采纳性会**放过**真正的高估。 */
    const trueDist: Record<string, number> = {}
    {
      const pq: { c: number; r: number; d: number }[] = [{ c: ASTAR_GOAL[0], r: ASTAR_GOAL[1], d: 0 }]
      const seen = new Set<string>()
      while (pq.length) {
        pq.sort((a, b) => a.d - b.d)
        const { c, r, d } = pq.shift()!
        const k = key(c, r)
        if (seen.has(k)) continue
        seen.add(k); trueDist[k] = d
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc, nr = r + dr
          if (!inb(nc, nr) || seen.has(key(nc, nr))) continue
          //  反向走：从 (nc,nr) 迈到 (c,r) 要付 (c,r) 的代价
          pq.push({ c: nc, r: nr, d: d + costAt(c, r) })
        }
      }
    }
    const optimalLen = trueDist[key(...ASTAR_START)] ?? -1
    const freeCells = Object.keys(trueDist).length

    /*  可采纳性：**逐格**比 w·h 和真实距离。到不了终点的格子不算（那里 h 怎么估都无所谓）。 */
    let maxOver = 0, overAt = ''
    for (const k of Object.keys(trueDist)) {
      const [c, r] = k.split(',').map(Number)
      const over = hW(c, r) - trueDist[k]
      if (over > maxOver + 1e-9) { maxOver = over; overAt = k }
    }
    const admissible = maxOver <= 1e-9

    /** 跑一趟 A*。`emit` 给了就每展开一格出一帧。 */
    function search(w: number, emit?: (info: {
      cur: [number, number]; curG: number; curH: number; expanded: number
      closed: string[]; open: string[]; g: Record<string, number>; f: Record<string, number>
      isGoal: boolean
    }) => void) {
      const hw = (c: number, r: number) => w * h0(c, r)
      const g: Record<string, number> = {}, f: Record<string, number> = {}
      const parent: Record<string, string> = {}
      const closed = new Set<string>(), openSet = new Set<string>()
      const open: { c: number; r: number; f: number }[] = []
      const sk = key(...ASTAR_START)
      g[sk] = 0; f[sk] = hw(...ASTAR_START)
      open.push({ c: ASTAR_START[0], r: ASTAR_START[1], f: f[sk] }); openSet.add(sk)
      let expanded = 0, goalKey = ''

      while (open.length) {
        //  平局时挑 h 小的（离终点近的）先展开 —— 定死，别让结果依赖排序稳定性
        open.sort((a, b) => a.f - b.f || h0(a.c, a.r) - h0(b.c, b.r) || a.c - b.c || a.r - b.r)
        const cur = open.shift()!
        const ck = key(cur.c, cur.r)
        if (closed.has(ck)) continue
        closed.add(ck); openSet.delete(ck)
        expanded++
        const isGoal = cur.c === ASTAR_GOAL[0] && cur.r === ASTAR_GOAL[1]
        if (!isGoal) {
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nc = cur.c + dc, nr = cur.r + dr, nk = key(nc, nr)
            if (!inb(nc, nr) || closed.has(nk)) continue
            const ng = g[ck] + costAt(nc, nr)
            if (g[nk] === undefined || ng < g[nk]) {
              g[nk] = ng; f[nk] = ng + hw(nc, nr); parent[nk] = ck
              open.push({ c: nc, r: nr, f: f[nk] }); openSet.add(nk)
            }
          }
        }
        emit?.({
          cur: [cur.c, cur.r], curG: g[ck], curH: h0(cur.c, cur.r), expanded,
          closed: [...closed], open: [...openSet], g: { ...g }, f: { ...f }, isGoal,
        })
        if (isGoal) { goalKey = ck; break }
      }
      const path: string[] = []
      let k2: string | undefined = goalKey
      while (k2) { path.unshift(k2); k2 = parent[k2] }
      //  路的**代价**（不是步数）—— 沼泽档里这两个数不一样，而 A* 优化的是代价
      return { expanded, path, pathLen: goalKey ? g[goalKey] : -1, steps: path.length ? path.length - 1 : -1 }
    }

    /*  同一张地图、同一个 h，把四个 w 各静默跑一遍（只计数、不出帧）——
        "h=0 就是 Dijkstra""加权 A* 更快但可能不是最短路"这两句话的证据都在这一列里。 */
    const sweep = ASTAR_WEIGHTS.map(w => {
      const rr = search(w)
      let over = 0
      for (const k of Object.keys(trueDist)) {
        const [c, r] = k.split(',').map(Number)
        over = Math.max(over, w * h0(c, r) - trueDist[k])
      }
      return { w, expanded: rr.expanded, pathLen: rr.pathLen, steps: rr.steps, optimal: rr.pathLen === optimalLen, admissible: over <= 1e-9 }
    })
    const dij = sweep.find(s => s.w === 0)!

    const frames: Frame[] = []
    const shared = {
      walls, mapName, weight, hName, trueDist, admissible, maxOver: +maxOver.toFixed(3), overAt,
      optimalLen, sweep, freeCells, swamp: [...swamp], swampCost: SWAMP_COST,
    }
    const run = search(weight, info => {
      frames.push({
        ...shared, step: frames.length, cur: info.cur, curG: info.curG,
        curH: +h0(info.cur[0], info.cur[1]).toFixed(2), curF: +(info.curG + weight * h0(info.cur[0], info.cur[1])).toFixed(2),
        closed: info.closed, open: info.open, gMap: info.g, fMap: info.f, path: [],
        act: info.isGoal ? 'goal' : 'expand', expanded: info.expanded,
        pathLen: -1, steps: -1, optimal: false, phase: 'run',
        log: info.isGoal
          ? `取到**终点** (${info.cur[0]},${info.cur[1]})！g=${info.curG}（走了 ${info.curG} 步）、h=0。开始回溯路径。`
          : `展开 f 最小的格 (${info.cur[0]},${info.cur[1]})：g=${info.curG}、h=${h0(info.cur[0], info.cur[1]).toFixed(2)}、` +
            `**f = g + ${weight}×h = ${(info.curG + weight * h0(info.cur[0], info.cur[1])).toFixed(2)}**。` +
            `移入关闭集，把可走的邻居加进开放集（已展开 ${info.expanded} 格）。`,
      })
    })

    const pct = (n: number) => `${((n / freeCells) * 100).toFixed(0)}%`
    const sweepText = sweep.map(s =>
      `w=${s.w}${s.w === 0 ? '(Dijkstra)' : s.w === 1 ? '(标准 A*)' : ''}：展开 ${s.expanded} 格、代价 ${s.pathLen}${s.optimal ? '' : ' ✗不是最优'}`).join('\n')

    frames.push({
      ...shared, step: frames.length, cur: ASTAR_GOAL,
      curG: run.pathLen, curH: 0, curF: run.pathLen,
      closed: [...new Set(frames.length ? frames[frames.length - 1].closed : [])],
      open: frames.length ? frames[frames.length - 1].open : [],
      gMap: frames.length ? frames[frames.length - 1].gMap : {},
      fMap: frames.length ? frames[frames.length - 1].fMap : {},
      path: run.path, act: 'done', expanded: run.expanded,
      pathLen: run.pathLen, steps: run.steps, optimal: run.pathLen === optimalLen, phase: 'done',
      log: `**找到了**：路的代价 **${run.pathLen}**（走了 ${run.steps} 步），展开 **${run.expanded}** 格（这张图一共 ${freeCells} 个可走的格，占 ${pct(run.expanded)}）。\n\n` +
        `真正的最小代价是 **${optimalLen}**（另外用一次反向 Dijkstra 算出来的真值）—— ` +
        (run.pathLen === optimalLen ? `这一趟**找到了最优路**。` : `⚠️ **这一趟没找到最优路，多花了 ${+(run.pathLen - optimalLen).toFixed(2)} 的代价。**`) + `\n\n` +
        `**可采纳性（逐格实测）**：反向 Dijkstra 给出了每一格到终点的真实最小代价，拿 w·h 逐格去比 —— ` +
        (admissible
          ? `**一格都没超过**，这个 w·h 是**可采纳**的。定理说可采纳就保证最短路，屏幕上这一趟正好印证了。`
          : `**在 (${overAt}) 这一格超了 ${maxOver.toFixed(2)}**（w·h 高估了到终点的代价），所以它**不可采纳** —— ` +
            `定理的保证在这里就不成立了，而这一趟${run.pathLen === optimalLen ? '**碰巧**还是找到了最优路 —— **不保证 ≠ 一定错**' : '**确实走了冤枉路**'}。`) + `\n\n` +
        `**同一张图，四个权重各跑一遍**（静默、只计数）：\n${sweepText}\n\n` +
        `**w=0 就是 Dijkstra**：不看终点在哪，四面均匀铺开，展开 ${dij.expanded} 格（${pct(dij.expanded)}）。` +
        (sweep.find(s => s.w === 1)!.expanded < dij.expanded
          ? `标准 A*（w=1）只展开 ${sweep.find(s => s.w === 1)!.expanded} 格 —— **h 把搜索拽向了终点**。`
          : `⚠️ 而标准 A*（w=1）展开了 ${sweep.find(s => s.w === 1)!.expanded} 格，**并不比它少**：` +
            `这张图上启发把搜索一头拽进了死胡同，绕出来的代价全白花。**"有启发总是更快"是错的。**`),
    })

    const base0: Frame = {
      ...shared, step: -1, cur: ASTAR_START, curG: 0,
      curH: +h0(...ASTAR_START).toFixed(2), curF: +hW(...ASTAR_START).toFixed(2),
      closed: [], open: [key(...ASTAR_START)],
      gMap: { [key(...ASTAR_START)]: 0 }, fMap: { [key(...ASTAR_START)]: +hW(...ASTAR_START).toFixed(2) },
      path: [], act: '', expanded: 0, pathLen: -1, steps: -1, optimal: false, phase: 'run', log: '',
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
