/**
 * 内核：强化学习 · 值迭代（机器学习算法 · 原理：靠 Bellman 更新把"未来总回报"从终点倒推回每一步,学出最优策略)
 * 轴：**扫描轮 sweep** —— 走迷宫(带墙):只有终点 +1。价值初始全 0,每轮对每格做一次 **Bellman 更新**
 *      V(s)=max_a[R + γ·V(s')],价值从终点像波纹一样**一圈圈往外传**,几轮后收敛。跟着价值升高的方向走=最优策略。
 *
 * 这里加深的是"倒推"本身:前一版把每格价值直接写成 **γ^曼哈顿距离**(=偷看了终点坐标、还假设没有墙),
 * 和"试错、不用提前知道地图"的叙述**自相矛盾**。现在做**真的值迭代**:V 初始全 0,每轮扫全图、每格取
 * **max_a[即时奖励 + γ×邻居价值]**,价值靠**相邻传播**长出来——遇到**墙**会自动**绕过去**(此时价值 ≠ γ^曼哈顿,
 * 而是 γ^绕墙真实步数),这正是"距离公式"给不出、只有真迭代才有的东西。每格价值都可手算核对(γ^到终点最短路)。
 *
 * 本实验:5×4 网格,终点 +1、γ=0.9,中间竖一堵墙(留个缺口)。看价值从终点一轮轮扩散、绕过墙,策略箭头随之指向终点。
 * RL 是 AlphaGo、机器人控制、推荐、大模型 RLHF 的底子。值迭代=有模型的规划;Q-learning=同一套 Bellman、但从经验里免模型地学。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const W = 5, H = 4
const GOAL: [number, number] = [4, 1]
const START: [number, number] = [0, 2]
const GAMMA = 0.9
//  竖墙:第 2 列的 row0/1/2 是墙(row3 留缺口),逼着绕下面走。
const WALLS = new Set(['2,0', '2,1', '2,2'])
const r3 = (x: number) => Math.round(x * 1000) / 1000
const idx = (c: number, r: number) => c + r * W
const isWall = (c: number, r: number) => WALLS.has(`${c},${r}`)
const inGrid = (c: number, r: number) => c >= 0 && c < W && r >= 0 && r < H
const walkable = (c: number, r: number) => inGrid(c, r) && !isWall(c, r)
const NB: [number, number, string][] = [[1, 0, '→'], [-1, 0, '←'], [0, 1, '↓'], [0, -1, '↑']]

export type QLearnState = {
  i: number
  step: number
  w: number; h: number
  goal: [number, number]; start: [number, number]
  gamma: number
  walls: string[]
  value: (number | null)[]     // 每格价值（迭代中，墙=null）
  policy: (string | null)[]    // 每格贪心策略箭头
  sweep: number                // 当前是第几轮 Bellman 扫描
  sweeps: number               // 收敛用了几轮
  converged: boolean
  changed: number              // 本轮有几格价值变了（收敛=0）
  path: string[]
  phase: 'run' | 'done'
  log: string
}

export const QLEARN_VISIBLE = ['step', 'w', 'h', 'goal', 'start', 'gamma', 'walls', 'value', 'policy', 'sweep', 'sweeps', 'converged', 'changed', 'path', 'phase', 'log'] as const
type Frame = Omit<QLearnState, 'i'>

//  贪心策略:朝价值最高的可走邻居;终点=★
function greedy(V: (number | null)[]): (string | null)[] {
  const pol: (string | null)[] = Array(W * H).fill(null)
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (isWall(c, r)) continue
    if (c === GOAL[0] && r === GOAL[1]) { pol[idx(c, r)] = '★'; continue }
    let bestV = -Infinity, bestDir = ''
    for (const [dc, dr, sym] of NB) {
      const nc = c + dc, nr = r + dr
      if (!walkable(nc, nr)) continue
      const v = V[idx(nc, nr)] ?? 0
      if (v > bestV) { bestV = v; bestDir = sym }
    }
    pol[idx(c, r)] = bestV > 0 ? bestDir : null
  }
  return pol
}

export const qlearnKernel: Kernel<QLearnState> = {
  kind: 'qlearn',
  compile(_doc: SimDocument): CompiledModel<QLearnState> {
    const wallsArr = [...WALLS]
    const mkVal = (V: number[]): (number | null)[] => V.map((v, k) => isWall(k % W, Math.floor(k / W)) ? null : r3(v))
    const frames: Frame[] = []

    //  V 初始全 0,终点固定为 1(终止态)。Jacobi 值迭代。
    let V = Array(W * H).fill(0); V[idx(...GOAL)] = 1
    frames.push({
      step: 0, w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, walls: wallsArr,
      value: mkVal(V), policy: greedy(mkVal(V)), sweep: 0, sweeps: 0, converged: false, changed: 0, path: [], phase: 'run',
      log: `5×4 走迷宫(灰=墙),只有**终点(★)有 +1**、γ=0.9。价值**初始全 0**,智能体不知道路。开始一轮轮做 **Bellman 更新**:V(s)=max_a[奖励 + γ·邻居价值]。`,
    })

    let sweep = 0
    while (sweep < 30) {
      sweep++
      const nV = V.slice()
      let changed = 0
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (isWall(c, r) || (c === GOAL[0] && r === GOAL[1])) continue
        let best = 0
        for (const [dc, dr] of NB) { const nc = c + dc, nr = r + dr; if (walkable(nc, nr)) best = Math.max(best, GAMMA * V[idx(nc, nr)]) }
        if (r3(best) !== r3(V[idx(c, r)])) changed++
        nV[idx(c, r)] = best
      }
      V = nV
      const done = changed === 0
      frames.push({
        step: frames.length, w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, walls: wallsArr,
        value: mkVal(V), policy: greedy(mkVal(V)), sweep, sweeps: sweep, converged: done, changed, path: [], phase: 'run',
        log: done
          ? `**第 ${sweep} 轮**:没有格子的价值再变(changed=0)→ **收敛**。价值满全图,每格 = γ^到终点最短路(绕墙)。`
          : `**第 ${sweep} 轮 Bellman 扫描**:价值向外扩一圈,本轮 **${changed}** 格更新。挨着终点的先变 0.9,再外一圈 0.81…遇墙就绕。`,
      })
      if (done) break
    }
    const sweeps = sweep

    //  最优路径:从起点跟贪心策略走
    const pol = greedy(mkVal(V))
    const path: string[] = []; let [cc, cr] = START; let guard = 0
    while (!(cc === GOAL[0] && cr === GOAL[1]) && guard++ < 50) {
      path.push(`${cc},${cr}`); const dir = pol[idx(cc, cr)]
      if (dir === '→') cc++; else if (dir === '←') cc--; else if (dir === '↓') cr++; else if (dir === '↑') cr--; else break
    }
    path.push(`${GOAL[0]},${GOAL[1]}`)
    frames.push({
      step: frames.length, w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, walls: wallsArr,
      value: mkVal(V), policy: pol, sweep: sweeps, sweeps, converged: true, changed: 0, path, phase: 'done',
      log: `**学好了**(${sweeps} 轮收敛):价值靠 Bellman 从终点一圈圈传满全图、**绕过了墙**;每格策略=往价值最高的邻居走。` +
        `从起点(0,2,价值 ${r3(V[idx(...START)])})跟箭头走 = 最优路线(${path.length - 1} 步,绕墙比曼哈顿 5 步更长——这正是"距离公式"给不出、只有真迭代才有的)。` +
        `没人教、靠 Bellman 倒推自己学出策略。值迭代=有模型规划;Q-learning=同一套 Bellman、但从经验免模型地学。是 AlphaGo/机器人/RLHF 的底子。`,
    })

    const base0: Frame = {
      step: -1, w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, walls: wallsArr,
      value: mkVal(Array(W * H).fill(0)), policy: Array(W * H).fill(null), sweep: 0, sweeps: 0, converged: false, changed: 0, path: [], phase: 'run', log: '',
    }
    return {
      axis: { kind: 'step', label: 'Bellman 扫描轮' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const j = b.i + 1
        if (j >= frames.length) return null
        return { state: { i: j, ...frames[j]! }, done: j === frames.length - 1 }
      },
    }
  },
}
