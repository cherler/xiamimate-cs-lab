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
import { num as pnum, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/**
 * ⚠️ 这三个数**是构造出来的教学例子，不是某次真实筛查的统计**。
 *
 * 用户 2026-09-08 问：「那些概率值，是随手编的吗？我怎么没看到概率出处？」——
 * 问得对。它们原来是写死在这里的三个常量，屏幕上不出现、也没说来历，
 * 读者只能当成"老师给的数"。两件事都改了：
 *   ① 说清楚它是**编的**（照着「稀有病 + 一个不错的检测」这个经典形状编的，
 *      为的是把**基础率谬误**演出来）—— 没有出处就不装作有出处；
 *   ② 把它们变成**可调参数**。数字一旦能改，它就不再是需要你相信的断言，
 *      而是你自己拧出来的输入 —— 这才是"出处"问题真正的解法。
 * 下面这几个只是默认值。
 */
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
/** 概率一律先舍到 4 位小数再用 —— 见下面循环里那段说明 */
const r4 = (x: number) => +x.toFixed(4)

export const bayesKernel: Kernel<BayesState> = {
  kind: 'bayes',

  compile(doc: SimDocument): CompiledModel<BayesState> {
    //  参数缺省时退回默认值（老的存档 doc 里没有这几个键）
    const P0 = doc.params.prior === undefined ? PRIOR0 : pnum(doc.params, 'prior') / 100
    const SE = doc.params.sens === undefined ? SENS : pnum(doc.params, 'sens') / 100
    const FP = doc.params.fpr === undefined ? FPR : pnum(doc.params, 'fpr') / 100
    const N = doc.params.tests === undefined ? N_TESTS : pnum(doc.params, 'tests')

    const frames: Frame[] = []
    let belief = r4(P0)

    for (let t = 1; t <= N; t++) {
      /*  这一步的先验**就是上一步的后验**（第一步是那个基础率）。
          用户问过「为什么前一个后验和后一个先验不相等」—— 它们必须相等，
          相等本身就是这个实验要演的那件事。tests/新判据里钉住了这一条。 */
      /*  ⚠️ **四舍五入只做一次，然后所有地方都用同一个数。**
          原来是：帧里存 `+x.toFixed(4)`，而日志里印的是**没舍入的** x。
          于是同一个 0.502546… 在一处印成 50.3%（未舍入）、在另一处印成 50.2%（先舍到 0.5025 再印）——
          用户 2026-09-08 因此问「为什么前一个后验概率，和后一个先验概率值不相等」。
          它们本来就相等，是这两条印法把同一个数印成了两个样子。
          现在先舍入、再拿舍入后的值继续往下算，屏幕上看到的就是真往下传的那个数。 */
      const prior = belief
      const num = r4(SE * prior)             // 真阳
      const denFalse = r4(FP * (1 - prior))   // 误报
      const posterior = r4(num / (num + denFalse))
      belief = posterior
      frames.push({
        step: t - 1, nTests: t, prior, sens: SE, fpr: FP,
        num, denFalse, posterior,
        phase: 'run',
        log: `第 ${t} 次**阳性**：先验(这次之前的信念) **${pct(prior)}**。` +
          `后验 = 真阳 / (真阳+误报) = ${num.toFixed(3)} / (${num.toFixed(3)}+${denFalse.toFixed(3)}) = **${pct(posterior)}**。` +
          (t === 1 ? `——注意：单次阳性也只有 ${pct(posterior)}！没病的人基数太大，误报淹没了真阳性(基础率谬误)。`
            : `**这次的先验 ${pct(prior)}，就是上一次的后验**——信念接着往上走，升到 ${pct(posterior)}。`),
      })
    }

    const lf = frames[frames.length - 1]
    /*  ⚠️ 这条链**必须现算**。原来写死成「1% → 9% → 50% → 91%」，只有最后一个是算的：
        参数一改（现在能改了）那串数就全是假的，而屏幕上不会有任何东西提示你它假了。 */
    const chain = [r4(P0), ...frames.filter(f => f.phase === 'run').map(f => f.posterior)].map(pct).join(' → ')
    const first = frames[0]
    frames.push({
      ...lf, phase: 'done',
      log: `连续 ${N} 次阳性，患病概率 ${chain}。` +
        `关键有二：① **单次阳性≠患病**(只 ${pct(first.posterior)})，因为贝叶斯把 ${pct(P0)} 的基础率也算了进去——这是直觉最爱翻车的地方；` +
        `② 把上次后验当这次先验，证据能**连续更新**、逼近确诊。这就是"信念随证据更新"，也是朴素贝叶斯、` +
        `卡尔曼滤波、乃至模型"在上下文里不断修正判断"的底层逻辑：后验 ∝ 先验 × 似然。`,
    })

    const base0: Frame = {
      step: -1, nTests: 0, prior: r4(P0), sens: SE, fpr: FP, num: 0, denFalse: 0, posterior: r4(P0), phase: 'run', log: '',
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
