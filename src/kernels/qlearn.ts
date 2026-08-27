/**
 * 内核：强化学习 Q-learning（机器学习算法 · 原理：靠试错拿奖励,把"未来总回报"倒推回每一步,学出最优策略)
 * 轴：step —— 走迷宫:只有终点有 +1 奖励。智能体反复试错,用 Bellman 规则把奖励**从终点一圈圈倒推**回来——
 *      每个格子的**价值**=从这出发能拿到的未来总奖励(每远一步打 γ=0.9 折)。跟着价值升高的方向走=最优策略。
 *
 * 强化学习:智能体在环境里**试错**,做对了给奖励、做错了给惩罚,目标是学会拿最多奖励的**策略**。难点在**奖励是延迟的**——
 * 走迷宫只有到终点才 +1,中间每步都没反馈,怎么知道哪步走对了?**Q-learning** 的答案:给每个"状态"估一个**价值**
 * (从这出发未来能拿到的总回报),用 **Bellman 规则**更新:一个格子的价值 = 走一步的即时奖励 + γ×下一格的价值。
 * 于是终点的 +1 顺着这条规则**一圈圈倒推**开:挨着终点的格子价值 0.9、再外一圈 0.81…每远一步打 γ 折。学好后,
 * 站在任意格子,**往价值最高的邻居走**就是最优路线。Q-learning 靠反复走迷宫、用这条规则更新,**不需要提前知道地图**。
 *
 * 本实验:5×4 网格,终点 +1、γ=0.9。看价值从终点像波纹一样倒推出来(0.9→0.81→0.729→…),策略箭头随之指向终点。
 * 每格价值=0.9^到终点步数,可手算核对。RL 是 AlphaGo、机器人控制、推荐、大模型 RLHF 的底子——求职大热门。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const W = 5, H = 4
const GOAL: [number, number] = [4, 1]
const START: [number, number] = [0, 2]
const GAMMA = 0.9
const r3 = (x: number) => Math.round(x * 1000) / 1000
const dist = (c: number, r: number) => Math.abs(c - GOAL[0]) + Math.abs(r - GOAL[1])
const maxDist = Math.max(...Array.from({ length: W * H }, (_, i) => dist(i % W, Math.floor(i / W))))
const policyDir = (c: number, r: number): string => {
  if (c === GOAL[0] && r === GOAL[1]) return '★'
  const dc = GOAL[0] - c, dr = GOAL[1] - r
  if (Math.abs(dc) >= Math.abs(dr) && dc !== 0) return dc > 0 ? '→' : '←'
  return dr > 0 ? '↓' : '↑'
}

export type QLearnState = {
  i: number
  step: number
  w: number; h: number
  goal: [number, number]; start: [number, number]
  gamma: number
  value: (number | null)[]     // 每格价值（逐环揭开）
  policy: (string | null)[]    // 每格策略箭头
  ring: number                 // 本步揭开的"到终点距离"环
  path: string[]               // 最优路径（收官显示）
  phase: 'run' | 'done'
  log: string
}

export const QLEARN_VISIBLE = ['step', 'w', 'h', 'goal', 'start', 'gamma', 'value', 'policy', 'ring', 'path', 'phase', 'log'] as const
type Frame = Omit<QLearnState, 'i'>

export const qlearnKernel: Kernel<QLearnState> = {
  kind: 'qlearn',
  compile(_doc: SimDocument): CompiledModel<QLearnState> {
    const frames: Frame[] = []
    const value: (number | null)[] = Array(W * H).fill(null)
    const policy: (string | null)[] = Array(W * H).fill(null)
    const setRing = (d: number) => {
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (dist(c, r) === d) { value[c + r * W] = d === 0 ? 1 : r3(Math.pow(GAMMA, d)); policy[c + r * W] = policyDir(c, r) }
      }
    }
    frames.push({
      step: 0, w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, value: value.slice(), policy: policy.slice(), ring: -1, path: [], phase: 'run',
      log: `5×4 走迷宫:只有**终点(★)有 +1 奖励**,其余都 0。智能体不知道该怎么走,只能**试错**。Q-learning 要学的是每个格子的**价值**——从这出发未来能拿到的总回报。`,
    })
    setRing(0)
    frames.push({
      step: 1, w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, value: value.slice(), policy: policy.slice(), ring: 0, path: [], phase: 'run',
      log: `终点本身:拿到 +1。价值从这里开始,像波纹一样往外**倒推**。`,
    })
    for (let d = 1; d <= maxDist; d++) {
      setRing(d)
      frames.push({
        step: frames.length, w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, value: value.slice(), policy: policy.slice(), ring: d, path: [], phase: 'run',
        log: `离终点 **${d}** 步的格子:价值 = 即时奖励(0) + γ×下一格价值 = 0.9×${r3(Math.pow(GAMMA, d - 1))} = **${r3(Math.pow(GAMMA, d))}**(=γ^${d})。策略箭头指向价值更高的邻居——朝终点走。`,
      })
    }
    // 最优路径
    const path: string[] = []; let [cc, cr] = START
    while (!(cc === GOAL[0] && cr === GOAL[1])) { path.push(`${cc},${cr}`); const dir = policyDir(cc, cr); if (dir === '→') cc++; else if (dir === '←') cc--; else if (dir === '↓') cr++; else cr-- }
    path.push(`${GOAL[0]},${GOAL[1]}`)
    frames.push({
      step: frames.length, w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, value: value.slice(), policy: policy.slice(), ring: -1, path, phase: 'done',
      log: `**学好了**:价值从终点一圈圈倒推满全图(每远一步 ×γ=0.9),每格的**策略**=往价值最高的邻居走。从起点(0,2,价值 ${r3(Math.pow(GAMMA, dist(...START)))})跟着箭头走,就是最优路线(${path.length - 1} 步)。` +
        `这就是强化学习:**没人教、靠试错 + Bellman 倒推,自己学出策略**,还不用提前知道地图。Q-learning 是 AlphaGo、机器人、推荐、大模型 RLHF 的底子。`,
    })
    const base0: Frame = { step: -1, w: W, h: H, goal: GOAL, start: START, gamma: GAMMA, value: Array(W * H).fill(null), policy: Array(W * H).fill(null), ring: -1, path: [], phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '价值倒推' },
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
