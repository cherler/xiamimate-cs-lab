/**
 * 内核：Best-of-N 拒绝采样（大模型算法）
 * 轴：**采样候选数 N** —— 对同一任务采样 N 个候选,用**打分器**(奖励模型/可算验证器)给每个打分,**argmax 取最高分**的那个。
 *
 * 这里加深的是 Best-of-N 的**核心机制:边际递减**。取 N 个样本的最好一个 = 取分布的**最大值**;
 * 而 N 个独立样本的期望最大值随 N **越涨越慢**(近似 log N):
 *   ①**前几个候选**里就容易撞到"还行"的,best 快速抬升;
 *   ②**再加候选**只有偶尔比现有最好更好,best 几乎不动——**边际递减**。
 * 所以 Best-of-N 是"用算力换质量":N 翻倍、算力翻倍,但质量提升越来越小,还被**打分器上限**卡住。
 * 和自洽的"多数投票"不同:Best-of-N 靠外部打分器选**单个最好**,适合开放式生成(没有"多数答案"可投)。
 *
 * 为了可复现 + 可手算:候选池 + 抽样序列都钉死(好候选故意出现得晚,让 best 随 N 抬升再压平)。
 * 扫 N∈{1,2,4,8,16,32},每个 N 取序列前 N 个候选、验证器打分、取最高——分数都能手算。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const TASK = '用 3、8、5 拼一个算式，结果尽量接近 24'
const TARGET = 24
const reward = (v: number) => Math.max(0, 10 - Math.abs(TARGET - v))

//  候选池(算式→结果);奖励由 reward() 现算。抽样序列从池里按下标取(可重复,模拟"多次采样")。
const POOL: { e: string; v: number }[] = [
  { e: '8 × 5', v: 40 },        // 0 → 奖励 0
  { e: '3 + 8 + 5', v: 16 },    // 1 → 2
  { e: '(8 − 5) × 3', v: 9 },   // 2 → 0
  { e: '3 × 8 − 5', v: 19 },    // 3 → 5
  { e: '5 × 3 + 8', v: 23 },    // 4 → 9
  { e: '3 × 8', v: 24 },        // 5 → 10（最优,故意出现得晚）
]
//  钉死抽样序列(32 个下标):好候选(4=9分)约第 6 个才出、最优(5=10分)约第 16 个才出 → best 先快涨后压平。
const DRAWS = [1, 0, 3, 0, 1, 4, 2, 3, 0, 1, 3, 0, 4, 2, 1, 5, 3, 0, 1, 2, 3, 0, 1, 4, 2, 3, 0, 1, 5, 2, 0, 3]
const N_SWEEP = [1, 2, 4, 8, 16, 32]

export type BONCand = { e: string; v: number; reward: number }
export type BONPoint = { n: number; best: number }
export type BestOfNState = {
  i: number
  n: number                    // 当前采样候选数 N（轴）
  maxN: number
  task: string
  target: number
  drawn: BONCand[]             // 前 N 个采样候选
  bestIdx: number              // drawn 里最高分的下标
  bestReward: number
  gain: number                 // 相比上一档 N,best 涨了多少(看边际递减)
  curve: BONPoint[]            // 已揭示的 (N, best) 点(到当前 N)
  phase: 'done'
  log: string
}

export const BESTOFN_VISIBLE = [
  'n', 'task', 'target', 'drawn', 'bestIdx', 'bestReward', 'gain', 'curve', 'phase', 'log',
] as const

type Frame = Omit<BestOfNState, 'i'>

function drawnOf(n: number): BONCand[] {
  return DRAWS.slice(0, n).map(idx => ({ e: POOL[idx]!.e, v: POOL[idx]!.v, reward: reward(POOL[idx]!.v) }))
}
function bestOf(cands: BONCand[]): number {
  let bi = 0
  for (let j = 1; j < cands.length; j++) if (cands[j]!.reward > cands[bi]!.reward) bi = j
  return bi
}

export const bestofnKernel: Kernel<BestOfNState> = {
  kind: 'bestofn',

  compile(_doc: SimDocument): CompiledModel<BestOfNState> {
    const fullCurve: BONPoint[] = N_SWEEP.map(n => ({ n, best: drawnOf(n)[bestOf(drawnOf(n))]!.reward }))
    const frames: Frame[] = []
    for (let k = 0; k < N_SWEEP.length; k++) {
      const n = N_SWEEP[k]!
      const drawn = drawnOf(n)
      const bestIdx = bestOf(drawn)
      const bestReward = drawn[bestIdx]!.reward
      const gain = k === 0 ? bestReward : bestReward - fullCurve[k - 1]!.best
      const curve = fullCurve.slice(0, k + 1)
      const best = drawn[bestIdx]!
      const log =
        `采样 **N=${n}** 个候选、逐个打分,取最高 → 「**${best.e}**」= ${best.v},得 **${bestReward}** 分。` +
        (k === 0
          ? `只采 1 个,好坏全凭运气。`
          : gain >= 3
            ? `比上一档多涨了 **+${gain}** 分 —— 加候选还很划算。`
            : gain > 0
              ? `只比上一档多 **+${gain}** 分 —— **边际开始递减**。`
              : `和上一档**一样**(+0)—— 再加候选几乎白花算力,**边际递减**到头,且被打分器上限卡住。`)
      frames.push({ n, maxN: N_SWEEP[N_SWEEP.length - 1]!, task: TASK, target: TARGET, drawn, bestIdx, bestReward, gain, curve, phase: 'done', log })
    }

    const base0: Frame = {
      n: 0, maxN: N_SWEEP[N_SWEEP.length - 1]!, task: TASK, target: TARGET, drawn: [], bestIdx: 0, bestReward: 0, gain: 0, curve: [], phase: 'done', log: '',
    }

    return {
      axis: { kind: 'step', label: '采样候选数 N' },
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
