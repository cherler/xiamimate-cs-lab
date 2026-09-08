/**
 * 内核：思维链自洽 Self-Consistency（大模型算法）
 * 轴：**采样链数 N** —— 对同一道题采样 N 条推理链，各自推到一个答案，再对答案**多数投票（取众数）**。
 *
 * 自洽为什么有效？一道有唯一解的推理题，**正确的推法往往很多条、都殊途同归到同一个答案**，
 * 而**错法五花八门、彼此不一致**。所以正解虽然单条链只占四成多（不到半数），
 * 却常常是**唯一的众数**（plurality）—— 票数一多就稳赢。
 *
 * ## 2026-09-08 补厚（用户：「继续往下做」）
 *
 * 上一轮已经把轴换成了「采样链数 N」，但底下那套数据还是**手排死的**：
 * `ANSWERS = [32, 19, 17, …]` 一串手敲的答案，注释里写着"按 17≈44% 的真实分布手排"。
 * 于是两件事做不到：
 *   ① **换不了分布** —— "正解占三成时还灵不灵"问不出来；
 *   ② **看不见它什么时候失效** —— 自洽有一个硬前提：**正解必须是唯一众数**。
 *      如果大家都犯**同一个**错（错误答案集中），多数票会**稳稳投给错的**，
 *      而且 N 越大越确信。这才是这个方法真正的边界，老版本里它连出场机会都没有。
 *
 * 现在：
 *   · 答案由**真的采样**产生（给定分布 + 种子的 LCG），不是手敲的列表；
 *   · 三个旋钮：正解占比 p、错法是**分散**还是**集中**、随机种子；
 *   · 每个 N 都用**蒙特卡洛重采样 400 次**算出「多数票答对的概率」——
 *     这条曲线才是"多跑几条链有多大用"的量化答案，而且是现算的；
 *   · 「集中」那一档：可靠率随 N **往下掉到 0**。自洽不是万灵药，它赌的是错法互不相同。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const PROBLEM = '小明有 5 个苹果，又买了 3 袋、每袋 4 个，一共几个？'
const CORRECT = 17
//  17 的三条**不同**正确推法（殊途同归）；错误答案各错各的（发散）
const CORRECT_PATHS = ['5 + 3×4 = 5 + 12 = 17', '3×4 = 12，再 + 5 = 17', '5 + (3×4) = 17']
const WRONG_REASON: Record<number, string> = {
  32: '(5+3)×4 = 8×4 = 32　（先加后乘）',
  19: '5×3 + 4 = 19　（把袋数也乘进去）',
  35: '5×(3+4) = 5×7 = 35　（整体括起来）',
  20: '5×4 = 20　（漏算袋数）',
}
const WRONGS = [32, 19, 35, 20]
const N_SWEEP = [1, 3, 5, 9, 15, 25, 49]
/** 蒙特卡洛重复次数：算「这个 N 下多数票答对的概率」 */
const MC = 400

function lcg(seed: number) {
  let x = (seed * 2654435761) >>> 0
  return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 0x100000000 }
}

/**
 * 按分布采一个答案。
 * `spread` 决定错法是**分散**（四种错法平分剩下的概率）还是**集中**（所有错都犯同一个）。
 * 集中那一档正是自洽失效的地方：错误答案成了唯一众数，票数越多越确信错的。
 */
function drawAnswer(u: number, p: number, spread: string): number {
  if (u < p) return CORRECT
  if (spread === '集中') return WRONGS[0]
  const k = Math.min(WRONGS.length - 1, Math.floor((u - p) / ((1 - p) / WRONGS.length)))
  return WRONGS[k]
}

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
  /** 这个 N 下「多数票答对」的概率（蒙特卡洛重采样 400 次算的） */
  pWin: number
  /** 每个 N 的可靠率，画曲线用：[N, 概率] */
  curve: [number, number][]
  /** 这一次的配置：正解占比 / 错法分布 */
  pCorrect: number
  spread: string
  phase: 'done'
  log: string
}

export const SELFCONSIST_VISIBLE = [
  'n', 'problem', 'samples', 'tally', 'winner', 'tie', 'correct', 'correctCount', 'reliable',
  'pWin', 'curve', 'pCorrect', 'spread', 'phase', 'log',
] as const

type Frame = Omit<SelfConsistState, 'i'>

function mkSample(a: number, seen17: number): SCSample {
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

  compile(doc: SimDocument): CompiledModel<SelfConsistState> {
    const P = doc.params.p === undefined ? 0.44 : num(doc.params, 'p') / 100
    const spread = doc.params.spread === undefined ? '分散' : str(doc.params, 'spread')
    const seed = doc.params.seed === undefined ? 7 : num(doc.params, 'seed')

    /** 数票：返回众数（平票为 null） */
    const voteOf = (as: number[]): { win: number | null; tie: boolean; tal: [number, number][] } => {
      const m = new Map<number, number>()
      as.forEach(a => m.set(a, (m.get(a) ?? 0) + 1))
      const tal = [...m.entries()].sort((a, b) => b[1] - a[1]
        || (a[0] === CORRECT ? -1 : b[0] === CORRECT ? 1 : a[0] - b[0])) as [number, number][]
      const tie = tal.length > 1 && tal[0]![1] === tal[1]![1]
      return { win: tie ? null : tal[0]![0], tie, tal }
    }

    /*  「这个 N 下多数票答对的概率」：独立重采样 MC 次数出来的。
        这条曲线是"多跑几条链到底有多大用"的**量化**答案 —— 老版本只能凭一句话说"越多越稳"。 */
    const mcRnd = lcg(seed * 977 + 13)
    const pWinAt = (n: number) => {
      let win = 0
      for (let t = 0; t < MC; t++) {
        const as: number[] = []
        for (let k = 0; k < n; k++) as.push(drawAnswer(mcRnd(), P, spread))
        const v = voteOf(as)
        if (!v.tie && v.win === CORRECT) win++
      }
      return +(win / MC).toFixed(3)
    }
    const curve = N_SWEEP.map(n => [n, pWinAt(n)] as [number, number])

    const frames: Frame[] = []
    //  展示用的那一串答案：同一条序列，前 N 条就是 N 那一帧看到的（所以票数能手数）
    const showRnd = lcg(seed)
    const drawn = N_SWEEP[N_SWEEP.length - 1]!
    const seq: number[] = []
    for (let k = 0; k < drawn; k++) seq.push(drawAnswer(showRnd(), P, spread))

    for (const n of N_SWEEP) {
      const samples: SCSample[] = []
      let seen17 = 0
      for (let k = 0; k < n; k++) {
        const s2 = mkSample(seq[k]!, seen17)
        if (s2.ok) seen17++
        samples.push(s2)
      }
      const { win, tie, tal } = voteOf(samples.map(x => x.a))
      const reliable = !tie && win === CORRECT
      const pWin = curve.find(c => c[0] === n)![1]
      const log =
        `采样 **N=${n}** 条链、数票：${tal.map(([a, v]) => `${a}×${v}`).join('、')}。`
        + (tie
          ? `**平票** —— 采样太少，多数票还定不下来。`
          : win === CORRECT
            ? `众数=**${win}**=正解 ✓（${tal[0]![1]}/${n}）。正解单条链只占 ${Math.round(seen17 / n * 100)}%，`
              + `但它是**唯一的众数**，所以票数一多就稳赢。`
            : `众数=**${win}**≠正解 ✗。`)
        + `　这个 N 下**多数票答对的概率 ${(pWin * 100).toFixed(1)}%**（重采样 ${MC} 次算的）`
        + (spread === '集中'
          ? ` —— 注意它**没有随 N 变好**：所有错都犯在同一个答案上时，那个错答案才是众数，`
            + `采得越多越确信错的。**自洽赌的是"错法互不相同"，这一档它输了。**`
          : ``)
      frames.push({
        n, maxN: drawn, problem: PROBLEM, samples, tally: tal, winner: win, tie,
        correct: CORRECT, correctCount: seen17, reliable, pWin, curve, pCorrect: P, spread,
        phase: 'done', log,
      })
    }

    const base0: Frame = {
      n: 0, maxN: N_SWEEP[N_SWEEP.length - 1]!, problem: PROBLEM, samples: [], tally: [], winner: null, tie: false,
      correct: CORRECT, correctCount: 0, reliable: false, pWin: 0, curve, pCorrect: P, spread,
      phase: 'done', log: '',
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
