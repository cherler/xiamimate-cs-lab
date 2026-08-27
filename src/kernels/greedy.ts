/**
 * 内核：贪心算法（算法 · 原理：什么时候"每步都拿最好"就能得到全局最优）
 * 轴：step —— 用贪心找零(每步拿最大的币)，走完再和动态规划的最优解对比,看贪心怎么栽
 *
 * 贪心算法:每一步都做**当下看起来最好**的选择,不回头。它快、简单,但**不总对**——只有当问题具备
 * "**贪心选择性质**"(局部最优能拼成全局最优)时才保证最优。哈夫曼编码、Dijkstra、最小生成树(Kruskal/Prim)
 * 都吃这条、所以贪心就对;但很多问题不具备,贪心就会给出次优解。
 *
 * 经典反例——**找零**:币值 {1,3,4},要凑 6。贪心"每步拿最大的":4 → 剩 2 → 1 → 1，共 **3** 枚。
 * 可最优明明是 3+3 = **2** 枚!贪心被"先拿了 4"这个局部最优带偏,再也回不到 3+3。动态规划则枚举子问题、
 * 保证最优。对比 Dijkstra/Huffman(贪心正确)你就懂了:**贪心对不对,取决于问题结构,不取决于它跑得快**。
 * 值全部现算、可核对(贪心每步取 ≤剩余的最大币、DP 求全局最少枚数、贪心≥最优)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const COINS = [4, 3, 1]      // 从大到小
const TARGET = 6

function dpMin(target: number, coins: number[]): number {
  const dp = new Array(target + 1).fill(Infinity); dp[0] = 0
  for (let a = 1; a <= target; a++) for (const c of coins) if (a >= c) dp[a] = Math.min(dp[a], dp[a - c] + 1)
  return dp[target]
}

export type GreedyState = {
  i: number
  step: number
  coins: number[]
  target: number
  rem: number                // 这一步之前的剩余
  pick: number               // 本步拿的币（0=尚未/结束）
  picked: number[]           // 贪心已拿的币
  greedyCount: number
  optimal: number            // DP 最优枚数
  phase: 'run' | 'done'
  log: string
}

export const GREEDY_VISIBLE = [
  'step', 'coins', 'target', 'rem', 'pick', 'picked', 'greedyCount', 'optimal', 'phase', 'log',
] as const

type Frame = Omit<GreedyState, 'i'>

export const greedyKernel: Kernel<GreedyState> = {
  kind: 'greedy',

  compile(_doc: SimDocument): CompiledModel<GreedyState> {
    const frames: Frame[] = []
    const optimal = dpMin(TARGET, COINS)
    let rem = TARGET
    const picked: number[] = []
    let step = 0

    while (rem > 0) {
      const remBefore = rem
      const pick = COINS.find(c => c <= rem)!    // 贪心：拿 ≤剩余 的最大币
      picked.push(pick); rem -= pick
      frames.push({
        step: step++, coins: COINS, target: TARGET, rem: remBefore, pick, picked: picked.slice(),
        greedyCount: picked.length, optimal, phase: 'run',
        log: `贪心第 ${step} 步：剩 ${remBefore}，拿**当下最大**的币 **${pick}**(≤${remBefore}) → 剩 ${rem}。` +
          `已拿 [${picked.join('+')}]${rem === 0 ? `，共 ${picked.length} 枚。` : ''}`,
      })
    }

    frames.push({
      step, coins: COINS, target: TARGET, rem: 0, pick: 0, picked: picked.slice(),
      greedyCount: picked.length, optimal, phase: 'done',
      log: `贪心凑 ${TARGET}:[${picked.join('+')}] = **${picked.length} 枚**;可最优是 **${optimal} 枚**(3+3)!` +
        `贪心被"先拿了 4"的局部最优带偏,回不到 3+3。它快、简单,但**只有问题具备"贪心选择性质"时才最优**——` +
        `哈夫曼、Dijkstra、最小生成树吃这条所以对;找零这种币制不具备,贪心就栽。要保证最优得用**动态规划**枚举子问题。`,
    })

    const base0: Frame = {
      step: -1, coins: COINS, target: TARGET, rem: TARGET, pick: 0, picked: [], greedyCount: 0, optimal, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '贪心第几步' },
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
