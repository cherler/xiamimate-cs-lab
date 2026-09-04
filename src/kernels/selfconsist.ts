/**
 * 内核：思维链自洽 Self-Consistency（大模型算法）
 * 轴：**采样链数 N** —— 对同一道题采样 N 条推理链，各自推到一个答案，再对答案**多数投票（取众数）**。
 *
 * 这里加深的正是自洽的**核心机制**:为什么"多采几条"能显著提升准确率?
 *   ①一道有唯一解的推理题,**正确的推法往往很多条、都殊途同归到同一个答案**(这里 17 由三种不同正确算法得到),
 *     而**错法五花八门、彼此不一致**(32/19/35/20 各错各的)。所以正解虽然单条链只占约 44%(不到半数),
 *     却是**唯一的众数**(plurality)——其它错误答案各自更少。
 *   ②**采样少(N 小)时,多数票不可靠**:抽样噪声能让某个错误答案暂时领先、或平票。
 *     **采样多(N 大)时,众数收敛到真正的众数=正解**,越来越稳。这就是自洽要"多跑几条"的原因(大数定律)。
 *
 * 为了可复现 + 可手数核对:答案序列是**钉死的**(ANSWERS,按真实分布手排,故意让 N=1 抽到错的、N≤5 还平票、
 * N≥9 才压到正解)。扫 N∈{1,3,5,9,15,25},每个 N 取序列前 N 条数票——票数都能拿手数出来。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const PROBLEM = '小明有 5 个苹果，又买了 3 袋、每袋 4 个，一共几个？'
const CORRECT = 17
//  17 的三条**不同**正确推法(殊途同归);错误答案各错各的(发散)。
const CORRECT_PATHS = ['5 + 3×4 = 5 + 12 = 17', '3×4 = 12，再 + 5 = 17', '5 + (3×4) = 17']
const WRONG_REASON: Record<number, string> = {
  32: '(5+3)×4 = 8×4 = 32　（先加后乘）',
  19: '5×3 + 4 = 19　（把袋数也乘进去）',
  35: '5×(3+4) = 5×7 = 35　（整体括起来）',
  20: '5×4 = 20　（漏算袋数）',
}
//  钉死的采样答案序列(按 17≈44% 的真实分布手排,前几条故意"不走运")。每个 N 取前 N 条。
const ANSWERS = [32, 19, 17, 32, 17, 20, 17, 35, 17, 32, 17, 19, 17, 32, 35, 17, 17, 20, 32, 17, 19, 32, 17, 19, 17]
const N_SWEEP = [1, 3, 5, 9, 15, 25]

export type SCSample = { a: number; r: string; ok: boolean }
export type SelfConsistState = {
  i: number
  n: number                    // 当前采样链数 N（轴）
  maxN: number
  problem: string
  samples: SCSample[]          // 前 N 条采样（含推理）
  tally: [number, number][]    // [答案, 票数]，降序
  winner: number | null        // 众数；平票为 null
  tie: boolean
  correct: number
  correctCount: number         // 前 N 条里正解出现次数
  reliable: boolean            // 众数 === 正解 且非平票
  phase: 'done'
  log: string
}

export const SELFCONSIST_VISIBLE = [
  'n', 'problem', 'samples', 'tally', 'winner', 'tie', 'correct', 'correctCount', 'reliable', 'phase', 'log',
] as const

type Frame = Omit<SelfConsistState, 'i'>

function sampleAt(k: number, seen17: number): SCSample {
  const a = ANSWERS[k]!
  if (a === CORRECT) return { a, r: CORRECT_PATHS[seen17 % CORRECT_PATHS.length]!, ok: true }
  return { a, r: WRONG_REASON[a] ?? `= ${a}`, ok: false }
}

function tallyOf(samples: SCSample[]): [number, number][] {
  const m = new Map<number, number>()
  samples.forEach(s => m.set(s.a, (m.get(s.a) ?? 0) + 1))
  //  平票时让**正解**排在并列的前面(不作弊:winner 另判平票;这只是让列表稳定好看)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] === CORRECT ? -1 : b[0] === CORRECT ? 1 : a[0] - b[0]))
}

export const selfconsistKernel: Kernel<SelfConsistState> = {
  kind: 'selfconsist',

  compile(_doc: SimDocument): CompiledModel<SelfConsistState> {
    const frames: Frame[] = []
    for (const n of N_SWEEP) {
      const samples: SCSample[] = []
      let seen17 = 0
      for (let k = 0; k < n; k++) {
        const s = sampleAt(k, seen17)
        if (s.ok) seen17++
        samples.push(s)
      }
      const tally = tallyOf(samples)
      const tie = tally.length > 1 && tally[0]![1] === tally[1]![1]
      const winner = tie ? null : tally[0]![0]
      const correctCount = seen17
      const reliable = !tie && winner === CORRECT
      const lead = tally[0]!
      const log =
        `采样 **N=${n}** 条链、数票:${tally.map(([a, v]) => `${a}×${v}`).join('、')}。` +
        (tie
          ? `**平票**（${lead[1]}=${tally[1]![1]}）—— 采样太少,多数票还定不下来,甚至可能被错误答案带偏。`
          : winner === CORRECT
            ? `众数=**${winner}**=正解 ✓（${lead[1]}/${n}）。正解单条链只占 ${Math.round(correctCount / n * 100)}%(不到半数),但它是**唯一的众数**,所以票数一多就稳赢。`
            : `众数=**${winner}**≠正解 ✗ —— 只采 ${n} 条时不走运,一个错误答案暂时领先。再多采几条就会被正解反超。`)
      frames.push({
        n, maxN: N_SWEEP[N_SWEEP.length - 1]!, problem: PROBLEM, samples, tally, winner, tie,
        correct: CORRECT, correctCount, reliable, phase: 'done', log,
      })
    }

    const base0: Frame = {
      n: 0, maxN: N_SWEEP[N_SWEEP.length - 1]!, problem: PROBLEM, samples: [], tally: [], winner: null, tie: false,
      correct: CORRECT, correctCount: 0, reliable: false, phase: 'done', log: '',
    }

    return {
      axis: { kind: 'step', label: '采样链数 N' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 }
      },
    }
  },
}
