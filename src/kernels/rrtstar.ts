/**
 * 内核：RRT* · 渐近最优采样规划 —— 在 RRT 上加「选最优父节点 + 重连」两步，让树随采样收敛到最短路（具身智能 · 运动规划 / 面试八股）
 * 轴：step —— 引子(RRT 只找到一条、不最优) → 采样+找邻域 → 选父(邻域里挑代价最小的父,不是最近的) → 重连(把邻居改接到新点、若更省) → 对比 RRT → 收尾。
 *
 * RRT 每步把新点接到**最近**的树节点——能快速找到**一条**可行路,但**不最优**(接最近≠代价最小)。**RRT\*** 改两处:
 *   ① **选父(choose parent)**:新点 x_new 在**半径 r 邻域**内,选让"起点→x_new 代价 = cost[邻居]+dist"**最小**的邻居当父(不是几何最近的);
 *   ② **重连(rewire)**:加完 x_new 后,再看邻域里每个邻居——若"经过 x_new"到它更省(cost[x_new]+dist < cost[邻居]),就把它**改接到 x_new**、降低其代价。
 * 这两步让树随采样数→∞ **渐近收敛到最优路**(邻域半径按 (log n / n)^{1/d} 收缩)。param 选 RRT\*(两步) / RRT(只接最近) 对比代价。本例 x_new 代价 RRT=9、RRT\*=6、邻居 B 被重连 8→7。全现算。连「RRT/A* 寻路/轨迹规划」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Algo = 'star' | 'plain'
export type Node = { id: string; x: number; y: number; cost: number; parent: string | null }
export type Nbr = { id: string; dist: number; viaCost: number }
export type RRTSState = {
  i: number
  step: number
  stage: 'intro' | 'sample' | 'chooseparent' | 'rewire' | 'compare' | 'done'
  algo: Algo
  algoLabel: string
  nodes: Node[]
  xnew: { x: number; y: number }
  radius: number
  neighbors: Nbr[]
  nearestId: string; rrtCost: number
  chosenParent: string; starCost: number
  rewired: { id: string; oldCost: number; newCost: number }[]
  showSample: boolean; showParent: boolean; showRewire: boolean; showCompare: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<RRTSState, 'i'>

// 已有树:S 起点、A、B(B 是绕了远路来的、代价虚高)
const BASE: Node[] = [
  { id: 'S', x: 0, y: 0, cost: 0, parent: null },
  { id: 'A', x: 4, y: 0, cost: 4, parent: 'S' },
  { id: 'B', x: 3, y: 2, cost: 8, parent: 'S' },
]
const XNEW = { x: 4, y: 2 }
const RADIUS = 3
const r2 = (x: number) => Math.round(x * 100) / 100
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

export const rrtstarKernel: Kernel<RRTSState> = {
  kind: 'rrtstar',
  compile(doc: SimDocument): CompiledModel<RRTSState> {
    const algo: Algo = String(doc.params?.algo ?? 'RRT*').includes('RRT*') || !String(doc.params?.algo ?? '').includes('只') ? 'star' : 'plain'
    const algoLabel = algo === 'star' ? 'RRT*(选父+重连)' : 'RRT(只接最近)'

    // 邻域(半径 r 内)
    const neighbors: Nbr[] = BASE.filter(n => dist(n, XNEW) <= RADIUS).map(n => ({ id: n.id, dist: r2(dist(n, XNEW)), viaCost: r2(n.cost + dist(n, XNEW)) }))
    // 最近(RRT)
    const nearest = neighbors.slice().sort((a, b) => a.dist - b.dist)[0]!
    const rrtCost = nearest.viaCost
    // 选父(RRT*):邻域里 viaCost 最小
    const best = neighbors.slice().sort((a, b) => a.viaCost - b.viaCost)[0]!
    const chosenParent = best.id, starCost = best.viaCost
    // 重连:邻居经 x_new 更省则改接
    const rewired: { id: string; oldCost: number; newCost: number }[] = []
    for (const n of BASE) {
      if (n.id === chosenParent) continue
      const d = dist(n, XNEW)
      if (d <= RADIUS && starCost + d < n.cost) rewired.push({ id: n.id, oldCost: r2(n.cost), newCost: r2(starCost + d) })
    }

    // 生成节点集(含 x_new)——按算法决定父与代价、及重连
    const mkNodes = (final: boolean): Node[] => {
      const ns = BASE.map(n => ({ ...n }))
      const xn: Node = { id: 'N', x: XNEW.x, y: XNEW.y, cost: algo === 'star' ? starCost : rrtCost, parent: algo === 'star' ? chosenParent : nearest.id }
      if (final && algo === 'star') for (const rw of rewired) { const t = ns.find(n => n.id === rw.id)!; t.cost = rw.newCost; t.parent = 'N' }
      return [...ns, xn]
    }

    const frames: Frame[] = []
    const b0 = { algo, algoLabel, nodes: mkNodes(false), xnew: XNEW, radius: RADIUS, neighbors, nearestId: nearest.id, rrtCost: r2(rrtCost), chosenParent, starCost: r2(starCost), rewired, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showSample: boolean; showParent: boolean; showRewire: boolean; showCompare: boolean; nodes?: Node[]; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showSample: false, showParent: false, showRewire: false, showCompare: false, nodes: BASE.map(n => ({ ...n })),
      focus: `RRT 只找到一条可行路、不最优;RRT* 加「选父+重连」两步→渐近收敛最优。算法：${algoLabel}`,
      log: `**RRT\*:让采样规划从"能到"升级到"最优"**\n「RRT」每步把新点接到树上**最近**的节点——能很快找到**一条**可行路,但**接最近 ≠ 代价最小**,得到的路往往绕、不最优。\n**RRT\*** 在同一个采样框架上加**两步**,让树随采样**渐近收敛到最短路**:\n· **① 选父**:新点在邻域里选**代价最小**的父(不是最近的);\n· **② 重连**:加完新点后,把邻域里"经过新点更省"的邻居**改接到新点**。\n本例:已有树 S(起点,cost 0)、A(4,0,cost 4)、B(3,2,cost 8、绕远路来的);采样新点 x_new=(${XNEW.x},${XNEW.y})、邻域半径 r=${RADIUS}。当前 **${algoLabel}**。` })

    push({
      stage: 'sample', showSample: true, showParent: false, showRewire: false, showCompare: false,
      focus: `采样 x_new=(${XNEW.x},${XNEW.y})、找半径 ${RADIUS} 内的邻域:${neighbors.map(n => `${n.id}(dist ${n.dist})`).join('、')}`,
      log: `**① 采样 + 找邻域**\n采样到自由点 **x_new=(${XNEW.x},${XNEW.y})**。找它**半径 r=${RADIUS}** 内的所有树节点(邻域):\n${neighbors.map(n => `· ${n.id}: 距离 ${n.dist}`).join('\n')}。\n(RRT 只关心其中**最近**的那个 → **${nearest.id}**(dist ${nearest.dist});RRT\* 要看**整个邻域**。)` })

    push({
      stage: 'chooseparent', showSample: true, showParent: true, showRewire: false, showCompare: false, nodes: mkNodes(false),
      focus: `选父:比邻域每个 "起点→x_new 代价 = cost[邻居]+dist"，选最小 → ${chosenParent}(代价 ${b0.starCost})，非最近的 ${nearest.id}`,
      log: `**② 选最优父节点(choose parent)**\n对邻域里每个邻居,算"从起点经它到 x_new"的总代价 = **cost[邻居] + dist(邻居, x_new)**:\n${neighbors.map(n => `· 经 ${n.id}: cost ${BASE.find(b => b.id === n.id)!.cost} + dist ${n.dist} = **${n.viaCost}**`).join('\n')}。\n**选代价最小的 → 父 = ${chosenParent}、x_new 代价 = ${b0.starCost}**。\n注意:几何**最近**的是 ${nearest.id}(dist ${nearest.dist})、RRT 会接它(代价 ${b0.rrtCost});但 RRT\* 发现**经 ${chosenParent} 更省**(${b0.starCost} < ${b0.rrtCost})——这就是"选父"省下的。` })

    push({
      stage: 'rewire', showSample: true, showParent: true, showRewire: true, showCompare: false, nodes: mkNodes(true),
      focus: rewired.length ? `重连:邻居经 x_new 更省则改接 → ${rewired.map(r => `${r.id} ${r.oldCost}→${r.newCost}`).join('、')}` : `重连:本例无邻居可改善`,
      log: `**③ 重连(rewire)**\n加完 x_new(代价 ${b0.starCost})后,反过来看邻域里每个邻居:若**经过 x_new**到它更省(cost[x_new]+dist < 它当前 cost),就把它**改接到 x_new**:\n${BASE.filter(n => n.id !== chosenParent && dist(n, XNEW) <= RADIUS).map(n => { const d = r2(dist(n, XNEW)); const via = r2(starCost + d); return `· ${n.id}: 当前 cost ${n.cost}，经 x_new = ${b0.starCost}+${d}=${via} ${via < n.cost ? `< ${n.cost} → **改接、代价降到 ${via}**` : `≥ ${n.cost}，不变`}`; }).join('\n')}。\n${rewired.length ? `**${rewired.map(r => r.id).join('、')} 被重连、代价下降**——新点不但自己找到便宜父,还让邻居搭便车变便宜。` : '本例没有邻居能靠 x_new 变便宜。'}这一步是 RRT\* 持续优化已有树的关键。` })

    push({
      stage: 'compare', showSample: true, showParent: true, showRewire: true, showCompare: true, nodes: mkNodes(true),
      focus: `对比:RRT 接最近 ${nearest.id}、x_new 代价 ${b0.rrtCost}、不重连;RRT* 选父 ${chosenParent}、代价 ${b0.starCost}${rewired.length ? `、还重连 ${rewired.map(r => r.id).join('、')}` : ''}`,
      log: `**④ RRT vs RRT\*(同一个 x_new)**\n· **RRT**:接几何最近的 **${nearest.id}** → x_new 代价 = **${b0.rrtCost}**;**不做重连**,已有节点代价不变。\n· **RRT\***:选父 **${chosenParent}** → x_new 代价 = **${b0.starCost}**(省 ${r2(rrtCost - starCost)});${rewired.length ? `重连让 ${rewired.map(r => `${r.id}(${r.oldCost}→${r.newCost})`).join('、')} 也变便宜。` : '本例无重连。'}\n单这一步 RRT\* 就更省;随着采样越来越多,选父+重连不断"抄近道",整棵树的路径**渐近逼近最优**——这是 RRT\* 和 RRT 的本质差别(RRT 只保证概率完备、找到一条;RRT\* 还渐近最优)。` })

    push({
      stage: 'done', showSample: true, showParent: true, showRewire: true, showCompare: true, nodes: mkNodes(true), phase: 'done',
      focus: `收尾:RRT*=RRT+选父+重连→渐近最优;半径按 (log n/n)^{1/d} 收缩;连 RRT/A*/轨迹优化`,
      log: `**小结:RRT\* = RRT + 选父 + 重连**\n· **选父(choose parent)**:新点在邻域选**代价最小**的父(不是最近的);\n· **重连(rewire)**:把邻域里"经新点更省"的邻居改接到新点。\n这两步让树**随采样渐近收敛到最优路**(而 RRT 只保证概率完备、找到**一条**)。邻域半径 r 随节点数 n 按 **(γ·log n / n)^{1/d}** 收缩(保证渐近最优又不至于每步查太多邻居)。\n**代价**:每步要查邻域、算多条代价、还可能重连——比 RRT 慢、每步开销大。工程折中:RRT\*、Informed RRT\*(找到初解后只在椭球内采样加速收敛)、RRT\*-Connect 等。\n**连到别的课**:是「RRT」的最优化升级;和「A\* 寻路」都求最优路(A* 在离散栅格上、RRT\* 在连续空间采样);求出的路还要「轨迹规划」平滑成可执行轨迹。面试延伸:RRT vs RRT\*(完备 vs 最优)、选父/重连、邻域半径为何收缩、Informed RRT\*、和 PRM\* 的关系。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, nodes: BASE.map(n => ({ ...n })), showSample: false, showParent: false, showRewire: false, showCompare: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'RRT* 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
