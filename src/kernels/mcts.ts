/**
 * 内核：蒙特卡洛树搜索 MCTS（大模型算法/决策 · 原理：靠随机模拟+UCB,把有限的思考花在最有希望的走法上)
 * 轴：step —— 下棋这种走法爆炸的问题,没法全搜。MCTS 反复做四步:**选择**(按 UCB 走到最值得试的分支)→**扩展**→
 *      **模拟**(随机走到底,看输赢)→**回传**(把结果更新回沿途节点)。多轮后,访问次数**集中到最好的走法**。AlphaGo 的核心。
 *
 * 围棋每步几百种选择、走到底是天文数字,穷举和 minimax 都算不动。**MCTS** 用"随机模拟 + 统计"逼近:维护一棵树,每个节点记
 * **访问次数 N** 和**胜率**。每一轮四步走:**选择**——从根按 **UCB = 胜率 + c·√(ln N_父 / N_子)** 挑分支(胜率高的多利用、试得少的多探索,兼顾两者);
 * **扩展**——遇到没展开的就加个新节点;**模拟**——从这随机走到棋局结束,得一个输赢;**回传**——把这盘的结果更新回沿途每个节点的 N 和胜率。
 * 反复几千上万轮,好的走法被反复模拟、访问数飙升;最后**选访问次数最多的走法**。它不需要评估函数,靠大量随机对局的统计说话。
 *
 * 本实验:根有 3 个候选走法 A/B/C(A 好、B/C 差)。看每轮 UCB 怎么先把三个都试一遍(未访问=∞),再把火力**集中到 A**;
 * 6 轮后 A 被访问 4 次(全赢)、B/C 各 1 次(输)→ 选 A。每步 UCB 可手算核对。MCTS 是 AlphaGo/AlphaZero 的引擎,和你建的思维树 ToT 一脉相承(带评估的树搜索)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const MOVES = ['A', 'B', 'C']
const ROLLOUTS: Record<string, number[]> = { A: [1, 1, 1, 1], B: [0], C: [0] }   // 各走法被选中时的输赢脚本
const C = 1.4
const ITERS = 6
const r2 = (x: number) => Math.round(x * 100) / 100

export type MctsState = {
  i: number
  step: number
  moves: string[]
  n: number[]
  w: number[]
  ucb: (number | null)[]       // null = ∞（未访问）
  pick: number
  win: number                  // 本轮 rollout：1 赢 0 输 -1 无
  iter: number
  c: number
  best: number
  phase: 'run' | 'done'
  log: string
}

export const MCTS_VISIBLE = ['step', 'moves', 'n', 'w', 'ucb', 'pick', 'win', 'iter', 'c', 'best', 'phase', 'log'] as const
type Frame = Omit<MctsState, 'i'>

export const mctsKernel: Kernel<MctsState> = {
  kind: 'mcts',
  compile(_doc: SimDocument): CompiledModel<MctsState> {
    const frames: Frame[] = []
    const n = [0, 0, 0], w = [0, 0, 0], rc = [0, 0, 0]
    let Nroot = 0
    const ucbOf = (k: number): number | null => (n[k] === 0 ? null : r2(w[k] / n[k] + C * Math.sqrt(Math.log(Nroot) / n[k])))
    const bestIdx = () => n.indexOf(Math.max(...n))

    frames.push({
      step: 0, moves: MOVES, n: n.slice(), w: w.slice(), ucb: [null, null, null], pick: -1, win: -1, iter: 0, c: C, best: -1, phase: 'run',
      log: `下棋走法太多没法全搜。MCTS 每轮四步:**选择**(按 UCB 挑最值得试的走法)→**扩展**→**模拟**(随机走到底看输赢)→**回传**(更新沿途节点)。根有 3 个候选走法 A/B/C。`,
    })
    for (let it = 1; it <= ITERS; it++) {
      const ucbs = MOVES.map((_, k) => ucbOf(k))
      // 选择：UCB 最大（未访问 ∞ 优先）
      let pick = 0, bestU = -Infinity
      for (let k = 0; k < 3; k++) { const u = ucbs[k] === null ? Infinity : ucbs[k]!; if (u > bestU) { bestU = u; pick = k } }
      const win = ROLLOUTS[MOVES[pick]][rc[pick]++] ?? 0
      n[pick]++; w[pick] += win; Nroot++
      frames.push({
        step: frames.length, moves: MOVES, n: n.slice(), w: w.slice(), ucb: ucbs, pick, win, iter: it, c: C, best: bestIdx(), phase: 'run',
        log: `第 ${it} 轮 · **选择**:UCB = ${MOVES.map((m, k) => `${m}=${ucbs[k] === null ? '∞' : ucbs[k]}`).join('、')} → 挑最大的 **${MOVES[pick]}**` +
          `${n[pick] === 1 && ucbs[pick] === null ? '(没试过,先探索)' : '(胜率高又值得试)'}。**模拟**:随机走到底 → **${win ? '赢' : '输'}**。**回传**:${MOVES[pick]} 访问+1、胜${win ? '+1' : '不变'}。`,
      })
    }
    const best = bestIdx()
    frames.push({
      step: frames.length, moves: MOVES, n: n.slice(), w: w.slice(), ucb: MOVES.map((_, k) => ucbOf(k)), pick: best, win: -1, iter: ITERS, c: C, best, phase: 'done',
      log: `**搜索结束**:访问次数 ${MOVES.map((m, k) => `${m}=${n[k]}`).join('、')} → **选访问最多的 ${MOVES[best]}**(它被反复模拟、几乎每次都赢)。` +
        `MCTS 靠 UCB **兼顾探索与利用**:未试的先试、好的多试,把有限的思考花在最有希望的分支上,不需要评估函数,靠大量随机对局的统计说话。` +
        `它是 AlphaGo/AlphaZero 的引擎(配神经网络给出先验和价值),和你建的**思维树 ToT** 一脉相承——都是带评估的树搜索。`,
    })
    const base0: Frame = { step: -1, moves: MOVES, n: [0, 0, 0], w: [0, 0, 0], ucb: [null, null, null], pick: -1, win: -1, iter: 0, c: C, best: -1, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '模拟轮' },
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
