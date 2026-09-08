/**
 * 内核：归纳头（大模型 · 原理：上下文学习/in-context learning 怎么发生）
 * 轴：step —— 给一段有重复规律的 token，看注意力怎么"回头找上次"，把该跟的 token 复制出来
 *
 * 归纳头(induction head)是 2022 年在 Transformer 里发现的一种具体电路，被认为是**上下文学习**的核心机制之一。
 * 它干的事，一句话:**"上次见到当前这个 token 时，它后面跟了什么？把那个复制过来。"**
 * 实现靠两个注意力头**接力**:一个"前一 token 头"把每个位置标注上"我前面是谁"；一个"归纳头"用当前 token 去
 *   匹配这些标注——凡是"前一个 token = 当前 token"的位置，就把注意力放上去，于是注意力落在**上次那个 token 之后**，
 *   再把那里的 token 复制成预测。它不需要训练时见过这个具体序列，纯靠**上下文里的模式**现学现用。
 *
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本只有一条写死的 A B C A B C A → B。机制是讲清楚了，可它有个**说服力上的漏洞**：
 * 这么规整的序列，看客完全可以怀疑"是不是背下来的"。而归纳头最要紧的一点恰恰是
 * **它不是记忆，是一条现场执行的规则**。规则长什么样，得靠**换序列**才逼得出来。
 *
 * 补厚补四档序列，每档专门顶一个问题：
 *   · **A B C A B C A** —— 教科书情形，答案唯一（原样保留）。
 *   · **没见过的符号**（♣ ♠ ♦ …）—— 换成一组不可能在训练里出现的符号，它照样答对。
 *     这一档是"不是背下来的"的**直接证据**。
 *   · **有歧义**（A B C A D C A）—— 上次 A 后面跟 B、上上次跟 D。
 *     这一档最值钱：它把"复制"这个说法拆开了 —— 归纳头其实是在**对所有先例投票**，
 *     票数就是 softmax 权重。答案不再唯一，屏幕上给的是一个**分布**。
 *   · **没有先例**（当前 token 第一次出现）—— 匹配集为空，注意力无处可落。
 *     这一档划出机制的**前提**：没有先例，归纳头什么也做不了。
 *
 * 另加一个**匹配锐度 β**旋钮：β 大 → 只认最近那条先例（近乎硬复制）；
 * β 小 → 各条先例平摊（近乎平均）。这就是 softmax 温度在这条电路里的实际含义。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const SEQS: Record<string, string[]> = {
  'A B C A B C A（教科书）': ['A', 'B', 'C', 'A', 'B', 'C', 'A'],
  //  一组绝不可能在训练里出现的符号 —— "不是背下来的"的直接证据
  '没见过的符号（♣♠♦）': ['♣', '♠', '♦', '♣', '♠', '♦', '♣'],
  //  上次 A 后面跟 B、上上次跟 D —— 答案不再唯一，归纳头给的是一个分布
  '有歧义（上次跟 B、上上次跟 D）': ['A', 'D', 'C', 'A', 'B', 'C', 'A'],
  //  当前 token 第一次出现 —— 匹配集为空，机制的前提不成立
  '没有先例（当前 token 首次出现）': ['A', 'B', 'C', 'A', 'B', 'C', 'Z'],
}

export type InductionState = {
  i: number
  step: number
  seq: string[]
  queryPos: number
  cur: string                // 当前(查询)token
  stage: 'id' | 'scan' | 'attend' | 'copy' | 'done'
  matches: number[]          // 注意力应落的位置（前一 token == cur 的那些位置）
  weights: number[]          // softmax 权重（attend 后才有）
  prediction: string
  //  ── 补厚 ──
  beta: number
  seqTag: string
  /*  预测**分布**：把落在各位置的权重按 token 归并。
      老版本只报一个"最大的那个"，于是"复制"看着像个确定动作；
      其实它是**对所有先例投票**，歧义那一档必须把票摆出来。 */
  dist: [string, number][]
  conf: number               // 最高票的占比
  ambiguous: boolean         // 先例不止一种后继
  noPrecedent: boolean       // 压根没有先例
  log: string
}

export const INDUCTION_VISIBLE = [
  'step', 'seq', 'queryPos', 'cur', 'stage', 'matches', 'weights', 'prediction',
  'beta', 'seqTag', 'dist', 'conf', 'ambiguous', 'noPrecedent', 'log',
] as const

type Frame = Omit<InductionState, 'i'>

export const inductionKernel: Kernel<InductionState> = {
  kind: 'induction',

  compile(doc: SimDocument): CompiledModel<InductionState> {
    const seqTag = doc.params.seq === undefined ? 'A B C A B C A（教科书）' : str(doc.params, 'seq')
    const SEQ = SEQS[seqTag] ?? SEQS['A B C A B C A（教科书）']
    const BETA = doc.params.beta === undefined ? 8 : num(doc.params, 'beta')

    const q = SEQ.length - 1
    const cur = SEQ[q]
    /*  归纳头：位置 j 得分高 ⟺ j≥1 且 seq[j−1]==cur（"前一个 token 是当前 token"）。
        ⚠️ 得分不是简单的 0/1：**越近的先例给的分越高**（每往前一格减 0.5）。
        少了这一项，歧义那一档的两条先例会平票 50/50，"β 越大越只认最近那条"就演不出来 ——
        而那正是 softmax 温度在这条电路里的实际含义。 */
    const recency = (j: number) => 1 - 0.5 * ((q - j) / Math.max(1, q))
    const raw = SEQ.map((_, j) => (j >= 1 && j <= q && SEQ[j - 1] === cur ? recency(j) : -Infinity))
    const matches = SEQ.map((_, j) => j).filter(j => Number.isFinite(raw[j]))
    const noPrecedent = matches.length === 0

    let weights = SEQ.map(() => 0)
    if (!noPrecedent) {
      const scores = raw.map(v => (Number.isFinite(v) ? BETA * v : -Infinity))
      const mx = Math.max(...scores.filter(Number.isFinite))
      const es = scores.map(x => (Number.isFinite(x) ? Math.exp(x - mx) : 0))
      const Z = es.reduce((a, b) => a + b, 0)
      weights = es.map(e => +(e / Z).toFixed(4))
    }

    //  预测**分布**：把落在各位置的权重按 token 归并 —— 归纳头是在对所有先例投票
    const bag = new Map<string, number>()
    matches.forEach(j => bag.set(SEQ[j], (bag.get(SEQ[j]) ?? 0) + weights[j]))
    const dist: [string, number][] = [...bag.entries()]
      .map(([k, v]) => [k, +v.toFixed(4)] as [string, number])
      .sort((a, b) => b[1] - a[1])
    const prediction = dist.length ? dist[0][0] : '—'
    const conf = dist.length ? dist[0][1] : 0
    const ambiguous = dist.length > 1

    const common = { seq: SEQ, queryPos: q, cur, beta: BETA, seqTag, dist, conf, ambiguous, noPrecedent }
    const zeroW = SEQ.map(() => 0)
    const pct = (w: number) => `${(w * 100).toFixed(0)}%`

    const frames: Frame[] = [
      {
        step: 0, ...common, stage: 'id', matches: [], weights: zeroW, prediction: '',
        log: `序列 **${SEQ.join(' ')}**，问下一个 token 是什么？当前（最后一个）token 是 **${cur}**。`
          + `　归纳头的策略只有一句：**回头找"上次 ${cur} 之后跟了什么"**。`,
      },
      {
        step: 1, ...common, stage: 'scan', matches, weights: zeroW, prediction: '',
        log: noPrecedent
          ? `扫描：哪些位置的**前一个 token 是 ${cur}**？　**一个都没有** —— ${cur} 在这段上下文里`
            + `是第一次出现，没有任何先例。`
            + `　⚠️ 这一档划出的是这条电路的**前提**：归纳头做的是"照着上次做"，没有上次，它什么也做不了。`
          : `扫描：哪些位置的**前一个 token 是 ${cur}**？找到 [${matches.join(', ')}]`
            + `（pos${matches.join('、pos')} 前面都是 ${cur}）。注意力就要落到这些"${cur} 之后"的位置。`,
      },
      {
        step: 2, ...common, stage: 'attend', matches, weights, prediction: '',
        log: noPrecedent
          ? `没有可落的位置，注意力权重全是 0 —— 这一步空转。`
          : `对这些位置做 softmax(β·得分)，β=${BETA}：`
            + `权重 = [${matches.map(j => `pos${j}（${SEQ[j]}）:${pct(weights[j])}`).join(', ')}]。`
            + (ambiguous
              ? `　⚠️ **两条先例给出的后继不一样**（${dist.map(([k, v]) => `${k} ${pct(v)}`).join(' / ')}）——`
                + `所以归纳头做的其实不是"复制"，是**对所有先例投票**。越近的先例票越重，`
                + `而 β 决定这个偏好有多极端。`
              : `　注意力集中在**上次 ${cur} 之后**的那些 token 上。`),
      },
      {
        step: 3, ...common, stage: 'copy', matches, weights, prediction,
        log: noPrecedent
          ? `没有东西可复制。归纳头在这一步交白卷 —— 预测得靠别的机制（比如模型权重里背下来的先验）。`
          : ambiguous
            ? `按票数把 token 加权取出：**${dist.map(([k, v]) => `${k} ${pct(v)}`).join('、')}** → 最高票是 **${prediction}**，`
              + `但把握只有 **${pct(conf)}**。**答案是个分布，不是一个字。**`
            : `被注意到的位置（${matches.join('、')}）上的 token 都是 **${prediction}** → **复制**出来当预测。`,
      },
      {
        step: 4, ...common, stage: 'done', matches, weights, prediction,
        log: noPrecedent
          ? `**${SEQ.join(' ')} → ？** 当前 token 在上下文里没有先例，归纳头**无从下手**。`
            + `　这不是 bug，是这条电路的定义：它做的是"上次见到这个 token 时，后面跟了什么"。`
            + `　所以上下文学习**需要上下文里真有那个模式** —— 少样本提示里那几个例子，`
            + `作用就是**现场造出先例**。`
          : ambiguous
            ? `**${SEQ.join(' ')} → ${prediction}（${pct(conf)}）**，另有 ${dist.slice(1).map(([k, v]) => `${k} ${pct(v)}`).join('、')}。`
              + `　这一档把"复制"这个说法拆开了：归纳头不是照搬某一处，而是**对所有先例做加权投票**，`
              + `权重就是 softmax。把 β 调大 → 只认最近那条先例（近乎硬复制）；调小 → 各条先例平摊（近乎平均）。`
              + `**softmax 的温度在这条电路里的意思，就是"多信最近的那次"。**`
            : `**${SEQ.join(' ')} → ${prediction}**：归纳头回头找"上次 ${cur} 之后是什么"，把 **${prediction}** 复制出来。`
              + (seqTag.startsWith('没见过')
                ? `　⚠️ 注意这一档用的是 **♣♠♦** 这种不可能在训练里出现的符号，它照样答对了 —— `
                  + `**这不是背下来的，是一条现场执行的规则**。这也正是"上下文学习"四个字的分量所在。`
                : `　它没在训练里见过这个具体序列，纯靠**上下文里的模式**现学现用 —— 这就是**上下文学习**的核心电路。`
                  + `　换成"没见过的符号"那一档再看，那才是"不是背下来的"的直接证据。`),
      },
    ]

    const base0: Frame = {
      step: -1, ...common, stage: 'id', matches: [], weights: zeroW, prediction: '', log: '',
    }

    return {
      axis: { kind: 'step', label: '步骤' },
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
