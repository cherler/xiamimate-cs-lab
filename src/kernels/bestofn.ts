/**
 * 内核：Best-of-N 拒绝采样（大模型算法 · 原理：采样 N 个候选,用打分器挑最高分的那个)
 * 轴：step —— 对同一个任务采样 N 个候选答案,每个用**打分器**(奖励模型 / 可算的验证器)评分,最后**取最高分**的。
 *      和自洽的"多数投票"不同:Best-of-N 靠一个**外部打分器**选出**单个最好**的——适合开放式生成、没有"多数答案"可投的场景。
 *
 * 生成任务往往一次采样质量参差:模型有时灵光、有时平庸。**Best-of-N**(也叫拒绝采样)的思路直白:多采几个、挑最好的。
 * 关键是有个**打分器**给每个候选打分——可以是训练好的**奖励模型**(给回答的质量/有用性/安全性打分,RLHF 里就用它),
 * 也可以是一个**可计算的验证器**(数学题验算结果、代码跑单测)。采样 N 个、逐个打分、**argmax 取最高**,用算力换质量。
 *
 * 本实验:任务"用 3、8、5 拼算式凑近 24",采样 5 个候选,验证器按**接近程度**打分(奖励=10−|24−结果|,越接近越高):
 * 3×8=24 得满分 10、5×3+8=23 得 9、…、8×5=40 得 0。**取最高分 → 3×8**。每个结果、每个奖励都可手算。
 * Best-of-N 是 RLHF、推理增强、数据合成里最常用的"采样+择优"套路;N 越大质量越好但越贵,还受打分器质量限制。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const TASK = '用 3、8、5 拼一个算式，结果尽量接近 24'
const TARGET = 24
type Cand = { e: string; r: number }
const CANDS: Cand[] = [
  { e: '3 + 8 + 5', r: 16 }, { e: '5 × 3 + 8', r: 23 }, { e: '8 × 5', r: 40 }, { e: '3 × 8', r: 24 }, { e: '3 × 8 − 5', r: 19 },
]
const reward = (r: number) => Math.max(0, 10 - Math.abs(TARGET - r))

export type BestOfNState = {
  i: number
  step: number
  task: string
  target: number
  cands: { e: string; r: number; reward: number }[]   // 已采样的候选（逐步增加）
  n: number
  bestIdx: number              // 当前最高分候选的下标
  phase: 'run' | 'done'
  log: string
}

export const BESTOFN_VISIBLE = [
  'step', 'task', 'target', 'cands', 'n', 'bestIdx', 'phase', 'log',
] as const

type Frame = Omit<BestOfNState, 'i'>

export const bestofnKernel: Kernel<BestOfNState> = {
  kind: 'bestofn',

  compile(_doc: SimDocument): CompiledModel<BestOfNState> {
    const scored = CANDS.map(c => ({ e: c.e, r: c.r, reward: reward(c.r) }))
    const frames: Frame[] = []
    const bestUpTo = (k: number) => {
      let bi = 0
      for (let j = 1; j <= k; j++) if (scored[j].reward > scored[bi].reward) bi = j
      return bi
    }
    for (let k = 0; k < scored.length; k++) {
      const shown = scored.slice(0, k + 1)
      const bi = bestUpTo(k)
      const c = scored[k]
      frames.push({
        step: frames.length, task: TASK, target: TARGET, cands: shown, n: scored.length, bestIdx: bi, phase: 'run',
        log: `采样第 ${k + 1} 个候选:「${c.e}」= ${c.r} → 验证器打分 **${c.reward}**(奖励=10−|24−${c.r}|)。` +
          `目前最高分:「${scored[bi].e}」(${scored[bi].reward} 分)。`,
      })
    }
    const finalBest = bestUpTo(scored.length - 1)
    frames.push({
      step: frames.length, task: TASK, target: TARGET, cands: scored, n: scored.length, bestIdx: finalBest, phase: 'done',
      log: `**取最高分**:${scored.length} 个候选里「${scored[finalBest].e}」= ${scored[finalBest].r} 得 ${scored[finalBest].reward} 分,最高 → 采纳它。` +
        `Best-of-N=采样 N 个 + 打分器评分 + **argmax 取最高**,用算力换质量。和自洽的**多数投票**不同:这里靠**外部打分器选单个最好**,适合开放式生成(没有"多数答案"可投)。` +
        `打分器可以是奖励模型(RLHF)或可算的验证器(验算/跑单测)。N 越大质量越好但越贵,还受打分器质量限制。`,
    })

    const base0: Frame = {
      step: -1, task: TASK, target: TARGET, cands: [], n: scored.length, bestIdx: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '采样候选' },
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
