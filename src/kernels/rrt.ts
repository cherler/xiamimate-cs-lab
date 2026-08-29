/**
 * 内核：RRT 运动规划 · 采样式避障真仿真 —— 随机长树探索空间、绕开障碍、连到终点（具身智能 · 运动规划）
 * 轴：step —— 反复：随机采一个点 → 找树上最近的节点 → 朝采样点迈一步 → 撞障碍就丢弃、否则加为新节点，直到够到终点再回溯出路径
 *
 * 机器人/机械臂要从起点到终点、还得绕开障碍,这是**运动规划**。**RRT(快速探索随机树)** 是最经典的采样式规划:
 *   ① 在空间里**随机采样**一个点(偶尔直接采终点=goal bias,加速收敛);
 *   ② 找**树上离它最近**的已有节点;
 *   ③ 从那个节点朝采样点**迈一步(step)**得到新点;
 *   ④ 这一步若**撞障碍或出界就丢弃**,否则把新点加进树(连一条边);
 *   ⑤ 新点离终点足够近 → **连上终点**,沿父指针**回溯**出一条从起点到终点的路径。
 * 树像根系一样朝空白处快速蔓延、自动绕开障碍。它**概率完备**(采样够多迟早找到路)但**不最优**(路径歪歪扭扭,要后处理或用 RRT*)。
 * 本例 10×10 世界、中央障碍、起点(1,1)→终点(9,9):用固定种子的伪随机(可复现)长出一棵 11 节点的树、绕过障碍、8 段路径。
 * 采样/最近点/迈步/碰撞判定全真算,树逐节点长出来、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100

type Pt = { x: number; y: number }
type Node = { x: number; y: number; parent: number }
type Rect = { x0: number; y0: number; x1: number; y1: number }
export type RRTState = {
  i: number
  step: number
  phase: 'intro' | 'grow' | 'done'
  op: 'intro' | 'extend' | 'reject' | 'reach' | 'summary'
  W: number
  start: Pt
  goal: Pt
  goalR: number
  obstacles: Rect[]
  nodes: Node[]              // 树（累积）
  sample: Pt | null         // 本步采样点
  nearest: number           // 最近节点下标
  newNode: Pt | null        // 迈步得到的新点（加入时）
  goalward: boolean         // 本步是否朝终点采样
  rejected: number          // 累计丢弃次数
  reason: string            // 丢弃原因
  path: number[] | null     // 最终路径的节点下标序列
  found: boolean
  focus: string
  log: string
}
type Frame = Omit<RRTState, 'i'>

const W = 10, STEP = 1.6, GOAL_R = 1.6, GOAL_BIAS = 0.25, SEED = 1
const START: Pt = { x: 1, y: 1 }, GOAL: Pt = { x: 9, y: 9 }
const OBS: Rect[] = [{ x0: 2.5, y0: 3, x1: 7, y1: 6.5 }]

const inObs = (x: number, y: number) => OBS.some(o => x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1)
const edgeHits = (a: Pt, b: Pt) => { for (let t = 0; t <= 1; t += 0.2) { if (inObs(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return true } return false }

export const rrtKernel: Kernel<RRTState> = {
  kind: 'rrt',
  compile(_doc: SimDocument): CompiledModel<RRTState> {
    const frames: Frame[] = []
    const snap = (n: Node[]) => n.map(x => ({ ...x }))
    const push = (f: Omit<Frame, 'step' | 'W' | 'start' | 'goal' | 'goalR' | 'obstacles'>) =>
      frames.push({ step: frames.length, W, start: START, goal: GOAL, goalR: GOAL_R, obstacles: OBS, ...f })

    // 固定种子伪随机（LCG）→ 树可复现、可测
    let s = SEED >>> 0
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff }

    const nodes: Node[] = [{ x: START.x, y: START.y, parent: -1 }]
    let rejected = 0, found = -1

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', nodes: snap(nodes), sample: null, nearest: -1, newNode: null, goalward: false, rejected: 0, reason: '', path: null, found: false,
      focus: 'RRT：随机采样 → 最近点迈一步 → 撞障碍丢弃 → 长树到终点',
      log: `**RRT 运动规划：随机长树避障**\n从起点到终点、绕开障碍。RRT 反复做五件事：\n① 随机**采样**一个点（偶尔直接采终点，加速）；② 找树上**最近节点**；③ 朝采样点**迈一步**；④ **撞障碍/出界就丢弃**；⑤ 够到终点 → 连上、**回溯出路径**。\n${W}×${W} 世界、中央障碍、起点(${START.x},${START.y})→终点(${GOAL.x},${GOAL.y})。看树怎么绕过障碍长过去。`,
    })

    // —— 主循环 ——
    for (let it = 0; it < 200 && found < 0; it++) {
      const goalward = rnd() < GOAL_BIAS
      const sx = r2(goalward ? GOAL.x : rnd() * W)
      const sy = r2(goalward ? GOAL.y : rnd() * W)
      // 最近节点
      let ni = 0, nd = 1e9
      nodes.forEach((n, idx) => { const d = Math.hypot(n.x - sx, n.y - sy); if (d < nd) { nd = d; ni = idx } })
      const nn = nodes[ni]!
      const dx = sx - nn.x, dy = sy - nn.y, L = Math.hypot(dx, dy) || 1
      const nx = r2(nn.x + (dx / L) * STEP), ny = r2(nn.y + (dy / L) * STEP)
      const sample: Pt = { x: sx, y: sy }

      let reason = ''
      if (nx < 0 || nx > W || ny < 0 || ny > W) reason = '出界'
      else if (inObs(nx, ny) || edgeHits(nn, { x: nx, y: ny })) reason = '撞障碍'

      if (reason) {
        rejected += 1
        push({
          phase: 'grow', op: 'reject', nodes: snap(nodes), sample, nearest: ni, newNode: null, goalward, rejected, reason, path: null, found: false,
          focus: `采样${goalward ? '(朝终点)' : ''} → 最近#${ni} 迈一步 → ${reason}，丢弃（累计丢 ${rejected}）`,
          log: `**丢弃：这一步${reason}**\n采样点 (${sx}, ${sy})${goalward ? '（直接采终点）' : ''}，树上最近是节点 #${ni} (${nn.x}, ${nn.y})。朝它迈一步到 (${nx}, ${ny}) —— **${reason}**，这一步作废、不加进树（累计丢弃 ${rejected} 次）。\n${reason === '撞障碍' ? '边穿过了障碍矩形 → 碰撞检测拦下。RRT 就是这样自动绕开障碍：撞的方向长不出去，树只往空白处蔓延。' : '越出边界。'}`,
        })
        continue
      }

      // 加节点
      nodes.push({ x: nx, y: ny, parent: ni })
      const newIdx = nodes.length - 1
      const reachGoal = Math.hypot(nx - GOAL.x, ny - GOAL.y) < GOAL_R
      if (reachGoal) found = newIdx

      if (!reachGoal) {
        push({
          phase: 'grow', op: 'extend', nodes: snap(nodes), sample, nearest: ni, newNode: { x: nx, y: ny }, goalward, rejected, reason: '', path: null, found: false,
          focus: `采样${goalward ? '(朝终点)' : ''} → 从最近#${ni} 迈一步 → 加节点#${newIdx} (${nx}, ${ny})`,
          log: `**扩展：加节点 #${newIdx}**\n采样点 (${sx}, ${sy})${goalward ? '（朝终点）' : ''} → 最近节点 #${ni} (${nn.x}, ${nn.y}) → 朝它迈一步 step=${STEP} 到 **(${nx}, ${ny})**，没撞障碍 → 连一条边、加进树（现 ${nodes.length} 个节点）。树往这个方向长了一节。`,
        })
      } else {
        // 回溯路径
        const path: number[] = []; let c = found
        while (c >= 0) { path.unshift(c); c = nodes[c]!.parent }
        push({
          phase: 'done', op: 'summary', nodes: snap(nodes), sample, nearest: ni, newNode: { x: nx, y: ny }, goalward, rejected, reason: '', path, found: true,
          focus: `节点#${newIdx} (${nx}, ${ny}) 够到终点！回溯出 ${path.length - 1} 段路径`,
          log: `**到达终点！**\n新节点 #${newIdx} (${nx}, ${ny}) 离终点 (${GOAL.x},${GOAL.y}) 小于 ${GOAL_R} → 连上终点。沿父指针**回溯**：路径 = ${path.join(' → ')}（共 **${path.length - 1} 段**）。\n\n**要点**：RRT 用"随机采样 + 最近点迈一步 + 碰撞丢弃"让树像根系一样朝空白蔓延、自动绕开障碍，最后回溯出一条路。它**概率完备**（采样够多迟早找到）但**不最优**（路径歪、要后处理平滑，或用 **RRT\\*** 边长树边改接父节点求近似最优）。关键旋钮：step（大跑得快但易穿细缝、小更精细）、goal bias（偏向终点采样加速收敛）、碰撞检测（这里点+边采样判矩形，真实用胶囊体/凸包）。高维（机械臂关节空间 6/7 维）也照样用——这正是采样式规划打败网格法(维度爆炸)的地方。配合前面的 IK（把路径点转成关节角）、PID（跟踪路径）就能让机械臂避障抓取。本例固定种子保证可复现；换种子树长得不一样但都能到终点。丢弃 ${rejected} 次、留 ${nodes.length} 个节点。`,
        })
      }
    }

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, W, start: START, goal: GOAL, goalR: GOAL_R, obstacles: OBS, nodes: [{ x: START.x, y: START.y, parent: -1 }], sample: null, nearest: -1, newNode: null, goalward: false, rejected: 0, reason: '', path: null, found: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '采样步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
