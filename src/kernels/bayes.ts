/**
 * 内核：贝叶斯定理（机器学习基础 · 原理：证据来了，信念该怎么更新）
 * 轴：step —— 一个稀有病 + 一个不错的检测，连续几次阳性，看"患病概率"怎么被一步步更新
 *
 * 贝叶斯定理：后验 ∝ 先验 × 似然。P(病|阳) = P(阳|病)·P(病) / P(阳)，其中
 *   P(阳) = P(阳|病)·P(病) + P(阳|没病)·P(没病)（全概率：阳性可能来自真病，也可能是误报）。
 * 它的精髓是**把先验(基础率)也算进去**——这正是直觉最容易翻车的地方(基础率谬误)。
 *
 * 本实验：患病率(先验)只有 **1%**，检测灵敏度 P(阳|病)=90%、误报率 P(阳|没病)=9%。
 * 反直觉的结论：**单次阳性也只有 ~9% 真患病**——因为没病的人基数太大(99%)，光误报就淹没了真阳性。
 * 但贝叶斯还能**连续更新**：把上一次的后验当这一次的先验，再来一次阳性 → 9%→50%→91%→99%，
 * 证据累积逼近确诊。这就是**信念随证据更新**的机制，也是朴素贝叶斯分类器、卡尔曼滤波、
 * 乃至"上下文里不断修正判断"的底层逻辑。值全部现算、可核对(每步后验=sens·先验/(sens·先验+fpr·(1−先验)))。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const PRIOR0 = 0.01     // 患病率（先验）
const SENS = 0.90       // P(阳|病) 灵敏度
const FPR = 0.09        // P(阳|没病) 误报率
const N_TESTS = 4       // 连续阳性次数

export type BayesState = {
  i: number
  step: number
  nTests: number         // 已看到的阳性次数
  prior: number          // 这一步之前的信念（患病概率）
  sens: number
  fpr: number
  num: number            // sens·prior（真阳）
  denFalse: number       // fpr·(1−prior)（误报）
  posterior: number      // 这一步之后的信念
  phase: 'run' | 'done'
  log: string
}

export const BAYES_VISIBLE = [
  'step', 'nTests', 'prior', 'sens', 'fpr', 'num', 'denFalse', 'posterior', 'phase', 'log',
] as const

type Frame = Omit<BayesState, 'i'>

const pct = (x: number) => (x * 100).toFixed(x < 0.1 ? 2 : 1) + '%'

export const bayesKernel: Kernel<BayesState> = {
  kind: 'bayes',

  compile(_doc: SimDocument): CompiledModel<BayesState> {
    const frames: Frame[] = []
    let belief = PRIOR0

    for (let t = 1; t <= N_TESTS; t++) {
      const prior = belief
      const num = SENS * prior             // 真阳
      const denFalse = FPR * (1 - prior)   // 误报
      const posterior = num / (num + denFalse)
      belief = posterior
      frames.push({
        step: t - 1, nTests: t, prior: +prior.toFixed(4), sens: SENS, fpr: FPR,
        num: +num.toFixed(4), denFalse: +denFalse.toFixed(4), posterior: +posterior.toFixed(4),
        phase: 'run',
        log: `第 ${t} 次**阳性**：先验(这次之前的信念) **${pct(prior)}**。` +
          `后验 = 真阳 / (真阳+误报) = ${num.toFixed(3)} / (${num.toFixed(3)}+${denFalse.toFixed(3)}) = **${pct(posterior)}**。` +
          (t === 1 ? `——注意：单次阳性也只有 ${pct(posterior)}！没病的人基数太大，误报淹没了真阳性(基础率谬误)。`
            : `证据累积，信念从 ${pct(prior)} 升到 ${pct(posterior)}。`),
      })
    }

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `连续 ${N_TESTS} 次阳性，患病概率 1% → 9% → 50% → 91% → **${pct(lf.posterior)}**。` +
        `关键有二：① **单次阳性≠患病**(只 9%)，因为贝叶斯把 1% 的基础率也算了进去——这是直觉最爱翻车的地方；` +
        `② 把上次后验当这次先验，证据能**连续更新**、逼近确诊。这就是"信念随证据更新"，也是朴素贝叶斯、` +
        `卡尔曼滤波、乃至模型"在上下文里不断修正判断"的底层逻辑：后验 ∝ 先验 × 似然。`,
    })

    const base0: Frame = {
      step: -1, nTests: 0, prior: PRIOR0, sens: SENS, fpr: FPR, num: 0, denFalse: 0, posterior: PRIOR0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '第几次阳性' },
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
