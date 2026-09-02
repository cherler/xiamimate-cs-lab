/**
 * 内核：D* Lite · 增量式重规划 —— 机器人在会变的地图里,发现新障碍后只"局部修复"旧计划、而不是从头重搜(具身智能 · 运动规划 / 面试八股)
 * 轴：step —— 引子(增量重规划) → 初次规划(算出每格 cost-from-start 的 g 值 + 最短路) → 障碍出现在路上 → 增量修复(只重算受影响的少数格、复用其余) → 和"从头重搜"对比展开数 → 收尾。
 *
 * 机器人常在**部分已知/动态**的地图里走:边走边用传感器发现新障碍。每次发现都**从头 A* / Dijkstra 重搜**太浪费。**D* Lite(Koenig & Likhachev)** 是增量式重规划:改动只让**局部**失效,只修那一小块。核心两量:
 *   · **g(s)**:已知的从起点到 s 的最优代价;· **rhs(s)**:一步前瞻 = min_邻居(g(邻居)+边权)(起点 rhs=0)。
 *   · **局部一致**:g(s)=rhs(s);边权一变(障碍出现),受影响格 **g≠rhs(不一致)**、进优先队列,只**重算这些不一致格及其下游**、其余 g 值**照旧复用**。
 * 本例 7×5 栅格、起点(0,2)→终点(6,2)、四连通权 1(此处启发式 h=0、即增量 Dijkstra;加 h>0 就是 A* 制导的 D* Lite)。
 * 初次规划算出整张 g 表、最短路直穿第 2 行(代价 6、展开 35 格);**(3,2) 突然变障碍** → 只有 (3,2)/(4,2)/(5,2)/(6,2) 这 4 格受影响、增量修复**只展开 6 格**、新路绕第 3 行(代价 8);而**从头重搜要展开 34 格**——地图越大、改动越局部,这个优势越夸张。g/rhs/展开全真算、可手核。连「A* / RRT / SLAM(边走边建图)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type V2 = [number, number]
type Cell = number | null   // null = 障碍
export type DStarState = {
  i: number
  step: number
  stage: 'intro' | 'initial' | 'change' | 'repair' | 'compare' | 'done'
  W: number; H: number
  start: V2; goal: V2; block: V2
  grid: Cell[][]              // 当前展示的 g 表（cost-from-start；null=障碍）
  path: V2[]                  // 当前最短路
  obstacleOn: boolean         // 障碍是否已放
  changed: string[]           // 增量修复中 g 值变了的格（高亮）
  gGoal: number
  expInit: number; expInc: number; expFull: number; reused: number
  showChanged: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<DStarState, 'i'>

const W = 7, H = 5
const START: V2 = [0, 2], GOAL: V2 = [6, 2], BLOCK: V2 = [3, 2]
const INF = 1e9
const key = (x: number, y: number) => `${x},${y}`

// D* Lite / LPA*（h=0 → 增量 Dijkstra），返回一次求解后的 g 表与展开数；支持增量
function makeSearch() {
  const blocked = new Set<string>()
  const g: Record<string, number> = {}, rhs: Record<string, number> = {}
  let U: [string, number][] = []
  const inb = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && !blocked.has(key(x, y))
  const succ = (x: number, y: number): V2[] => ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as V2[]).filter(([a, b]) => inb(a, b))
  const G = (k: string) => (k in g ? g[k]! : INF), R = (k: string) => (k in rhs ? rhs[k]! : INF)
  const km = (x: number, y: number) => Math.min(G(key(x, y)), R(key(x, y)))
  const uFind = (k: string) => U.findIndex(e => e[0] === k)
  const uIns = (x: number, y: number) => { const k = key(x, y), i = uFind(k), e: [string, number] = [k, km(x, y)]; if (i >= 0) U[i] = e; else U.push(e); U.sort((a, b) => a[1] - b[1]) }
  const uRem = (k: string) => { const i = uFind(k); if (i >= 0) U.splice(i, 1) }
  const upd = (x: number, y: number) => { const k = key(x, y); if (!(x === START[0] && y === START[1])) { let b = INF; for (const [px, py] of succ(x, y)) b = Math.min(b, G(key(px, py)) + 1); rhs[k] = b } uRem(k); if (G(k) !== R(k)) uIns(x, y) }
  let exp = 0
  const csp = () => { exp = 0; let guard = 0; while (U.length && guard++ < 9999) { const [k] = U.shift()!; exp++; const [x, y] = k.split(',').map(Number) as V2; if (G(k) > R(k)) { g[k] = R(k); for (const [sx, sy] of succ(x, y)) upd(sx, sy) } else { g[k] = INF; upd(x, y); for (const [sx, sy] of succ(x, y)) upd(sx, sy) } } }
  const init = () => { for (const kk in g) delete g[kk]; for (const kk in rhs) delete rhs[kk]; U = []; rhs[key(...START)] = 0; uIns(...START) }
  const gridOf = (): Cell[][] => { const out: Cell[][] = []; for (let y = 0; y < H; y++) { const r: Cell[] = []; for (let x = 0; x < W; x++) r.push(blocked.has(key(x, y)) ? null : (G(key(x, y)) >= INF ? INF : G(key(x, y)))); out.push(r) } return out }
  const pathOf = (): V2[] => { let c: V2 = [...GOAL]; const p: V2[] = [[...c]]; let gd = 0; while (!(c[0] === START[0] && c[1] === START[1]) && gd++ < 99) { let best: V2 | null = null, bv = INF; for (const [sx, sy] of succ(...c)) { if (G(key(sx, sy)) < bv) { bv = G(key(sx, sy)); best = [sx, sy] } } if (!best) break; c = best; p.push([...best]) } return p.reverse() }
  return { blocked, g, rhs, uRem, upd, csp, init, gridOf, pathOf, G, get exp() { return exp }, block: (x: number, y: number) => { blocked.add(key(x, y)); g[key(x, y)] = INF; rhs[key(x, y)] = INF; uRem(key(x, y)); for (const [nx, ny] of ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as V2[])) if (inb(nx, ny)) upd(nx, ny) } }
}

export const dstarliteKernel: Kernel<DStarState> = {
  kind: 'dstarlite',
  compile(_doc: SimDocument): CompiledModel<DStarState> {
    const s = makeSearch()
    s.init(); s.csp()
    const gBefore = s.gridOf(), pathBefore = s.pathOf(), expInit = s.exp, gGoalBefore = s.G(key(...GOAL))
    const gBeforeMap: Record<string, number> = {}; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) gBeforeMap[key(x, y)] = s.G(key(x, y))
    // 增量：放障碍
    s.block(...BLOCK); s.csp()
    const gAfter = s.gridOf(), pathAfter = s.pathOf(), expInc = s.exp, gGoalAfter = s.G(key(...GOAL))
    const changed: string[] = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = key(x, y); if (gBeforeMap[k] !== s.G(k)) changed.push(k) }
    // 从头重搜的展开数（对比）
    const s2 = makeSearch(); s2.block(...BLOCK); s2.init(); s2.csp(); const expFull = s2.exp
    const reused = W * H - 1 - changed.length  // 可达格里没变、直接复用的数量

    const frames: Frame[] = []
    const b0 = { W, H, start: START, goal: GOAL, block: BLOCK, gGoal: gGoalBefore, expInit, expInc, expFull, reused, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; grid: Cell[][]; path: V2[]; obstacleOn: boolean; changed: string[]; showChanged: boolean; gGoal: number; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', grid: gBefore, path: [], obstacleOn: false, changed: [], showChanged: false, gGoal: gGoalBefore,
      focus: 'D* Lite：地图变了就"局部修复"旧计划、而不是从头重搜。核心=g/rhs + 增量修复',
      log: `**D* Lite：增量式重规划——地图变了,只修一小块**\n机器人常在**部分已知/动态**的地图里走,边走边用传感器**发现新障碍**。每发现一次就**从头 A*/Dijkstra 重搜**太浪费。**D* Lite** 只让改动**局部失效、只修那一小块**。核心两个量:\n· **g(s)**:已知的**从起点到 s 的最优代价**;\n· **rhs(s)**:一步前瞻 = min_邻居(g(邻居)+边权)(起点 rhs=0);\n· **局部一致** = g(s)=rhs(s);边权一变,受影响格 **g≠rhs(不一致)** → 进优先队列、只重算这些格及其下游,其余 g **照旧复用**。\n本例 ${W}×${H} 栅格、起点(${START})→终点(${GOAL})、四连通(此处 h=0=增量 Dijkstra)。先看初次规划。`,
    })

    push({
      stage: 'initial', grid: gBefore, path: pathBefore, obstacleOn: false, changed: [], showChanged: false, gGoal: gGoalBefore,
      focus: `初次规划:算出每格的 g 值(从起点的最优代价)、最短路直穿第 2 行、代价 ${gGoalBefore}(展开 ${expInit} 格)`,
      log: `**① 初次规划:算出整张 g 表 + 最短路**\n从起点 (${START}) 出发,用优先队列把每格的 **g 值(从起点到该格的最优代价)** 都算出来(表里每个数就是走到那格最少几步)。到终点的 **g(goal)=${gGoalBefore}**、最短路**直穿第 2 行**:${pathBefore.map(p => `(${p})`).join('→')}。\n这一趟展开了 **${expInit} 个格子**。地图此刻还没有 (${BLOCK}) 那个障碍。`,
    })

    const bg = gBefore.map(r => [...r]); bg[BLOCK[1]]![BLOCK[0]] = null
    push({
      stage: 'change', grid: bg, path: pathBefore, obstacleOn: true, changed: [], showChanged: false, gGoal: gGoalBefore,
      focus: `传感器发现 (${BLOCK}) 变成障碍——正好在路上!它和依赖它的格子变得"局部不一致(g≠rhs)"`,
      log: `**② 变化:障碍出现在路上**\n机器人往前走,传感器发现 **(${BLOCK}) 变成了障碍**——**正好在刚才那条路上**!这条路断了。\n此刻:(${BLOCK}) 不可通行(g→∞),而**依赖它的邻居**(原来经它才最优的格子,如 (4,2))发现"我的 rhs(一步前瞻)和 g 对不上了"——变得**局部不一致(g≠rhs)**。D* Lite 只把**这些不一致的格**放进优先队列,准备局部修。**不重搜整张图**。`,
    })

    push({
      stage: 'repair', grid: gAfter, path: pathAfter, obstacleOn: true, changed, showChanged: true, gGoal: gGoalAfter,
      focus: `增量修复:只重算受影响的 ${changed.length} 格(高亮)、其余复用;新路绕第 3 行、代价 ${gGoalAfter}(只展开 ${expInc} 格)`,
      log: `**③ 增量修复:只动受影响的少数格**\n从队列里取不一致的格、更新它们的 g,涟漪只往**下游**传:本例只有 **${changed.length} 个格**的 g 变了(高亮)——(${BLOCK}) 变障碍,(4,2) 从 4→6、(5,2) 从 5→7、(6,2) 从 6→8(现在都得绕道)。**左半张图(第 0-2 列)的 g 值完全没变、直接复用**。\n修完:新最短路**绕第 3 行**过去:${pathAfter.map(p => `(${p})`).join('→')}、代价 **g(goal)=${gGoalAfter}**。这一趟**只展开了 ${expInc} 个格子**。`,
    })

    push({
      stage: 'compare', grid: gAfter, path: pathAfter, obstacleOn: true, changed, showChanged: true, gGoal: gGoalAfter,
      focus: `增量修复展开 ${expInc} 格 vs 从头重搜 ${expFull} 格;${reused} 格 g 值原样复用。地图越大、改动越局部,优势越夸张`,
      log: `**④ 对比:增量 vs 从头重搜**\n· **从头重搜**(把地图当全新、重跑一遍):展开 **${expFull} 个格**;\n· **D* Lite 增量修复**:只展开 **${expInc} 个格**(≈${Math.round(expFull / Math.max(1, expInc) * 10) / 10}× 少)、**${reused} 个格的 g 值原样复用**。\n本例栅格小、差距已经很明显;**真实机器人在大地图上探索**,每发现一个障碍改动的只是极小一块——从头重搜要几万格、增量修复可能几十格,**这就是 D* Lite 的价值**(火星车、动态环境导航都用它)。`,
    })

    push({
      stage: 'done', grid: gAfter, path: pathAfter, obstacleOn: true, changed, showChanged: true, gGoal: gGoalAfter, phase: 'done',
      focus: `D* Lite:g/rhs + 局部一致,边权变→只修不一致格及下游、复用其余;比从头重搜省很多。连 A*/RRT/SLAM`,
      log: `**小结:D* Lite = 增量式重规划**\n· **两个量**:g(从起点最优代价)、rhs(一步前瞻 min 邻居 g+边权);**局部一致 g=rhs**;\n· **变化处理**:边权一变,受影响格 g≠rhs(不一致)→优先队列→**只重算这些格及下游、其余复用**;\n· **本例**:障碍出现 → 只 ${changed.length} 格变、增量修复展开 ${expInc} 格(从头要 ${expFull})、新路代价 ${gGoalBefore}→${gGoalAfter}。\n**为什么重要**:机器人边走边建图/发现障碍(接「SLAM」),用 D* Lite **不必每步从头重规划**、只局部修复,省下巨量计算——是**动态/未知环境导航**(火星车、移动机器人)的标准。**连**:「A*」(它的启发式基础,h>0 就是 A* 制导的 D* Lite)、「RRT/RRT-Connect」(采样式规划,栅格 D* Lite 是搜索式)、「SLAM」(边走边更新地图触发重规划)。**面试延伸**:g 与 rhs、局部一致/过一致/欠一致、优先队列 key、D* Lite vs LPA*(前者起点会动、多个 km 项)、D* Lite vs A*(增量 vs 从头)、增量 Dijkstra、真实用途(field D*、动态导航)。参考:Koenig & Likhachev 2002。`,
    })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, grid: gBefore, path: [], obstacleOn: false, changed: [], showChanged: false, gGoal: gGoalBefore, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '重规划步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: st => st.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
