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
 * 本实验:序列 A B C A B C A，问下一个是什么?当前 token 是 A;归纳头回头找"前面是 A"的位置(pos1、pos4，它们
 * 前面都是 A)，注意力落上去——那两处的 token 都是 **B**——复制出 **B**。这就是"A B C A B C A → B"的模式补全，
 * 也是为什么大模型能"照着上文的样式继续"。值全部现算、可核对(匹配位置、softmax 权重、复制出的 token)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const SEQ = ['A', 'B', 'C', 'A', 'B', 'C', 'A']
const BETA = 8

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
  log: string
}

export const INDUCTION_VISIBLE = [
  'step', 'seq', 'queryPos', 'cur', 'stage', 'matches', 'weights', 'prediction', 'log',
] as const

type Frame = Omit<InductionState, 'i'>

export const inductionKernel: Kernel<InductionState> = {
  kind: 'induction',

  compile(_doc: SimDocument): CompiledModel<InductionState> {
    const q = SEQ.length - 1
    const cur = SEQ[q]
    // 归纳头：位置 j 得分高 <=> j≥1 且 seq[j-1]==cur（"前一个 token 是当前 token"）
    const scores = SEQ.map((_, j) => (j >= 1 && j <= q && SEQ[j - 1] === cur ? BETA : 0))
    const hasMatch = scores.map(x => x > 0)
    const matches = SEQ.map((_, j) => j).filter(j => hasMatch[j])
    const mx = Math.max(...scores)
    const es = scores.map(x => Math.exp(x - mx))
    const Z = es.reduce((a, b) => a + b, 0)
    const weights = es.map(e => +(e / Z).toFixed(3))
    // 预测 = 权重最大处的 token（复制）
    const pj = weights.indexOf(Math.max(...weights))
    const prediction = SEQ[pj]

    const zeroW = SEQ.map(() => 0)
    const frames: Frame[] = [
      {
        step: 0, seq: SEQ, queryPos: q, cur, stage: 'id', matches: [], weights: zeroW, prediction: '',
        log: `序列 **${SEQ.join(' ')}**，问下一个 token 是什么?当前(最后一个)token 是 **${cur}**。` +
          `归纳头的策略:回头找"上次 ${cur} 之后跟了什么"。`,
      },
      {
        step: 1, seq: SEQ, queryPos: q, cur, stage: 'scan', matches, weights: zeroW, prediction: '',
        log: `扫描:哪些位置的**前一个 token 是 ${cur}**?找到 [${matches.join(', ')}]` +
          `（pos${matches.join('、pos')} 前面都是 ${cur}）。注意力就要落到这些"${cur} 之后"的位置。`,
      },
      {
        step: 2, seq: SEQ, queryPos: q, cur, stage: 'attend', matches, weights, prediction: '',
        log: `对这些位置做 softmax(β·匹配)，注意力权重 = [${weights.map((w, j) => w > 0 ? `pos${j}:${(w * 100).toFixed(0)}%` : '').filter(Boolean).join(', ')}]。` +
          `注意力集中在**上次 ${cur} 之后**的那些 token 上。`,
      },
      {
        step: 3, seq: SEQ, queryPos: q, cur, stage: 'copy', matches, weights, prediction,
        log: `被注意到的位置(${matches.join('、')})上的 token 都是 **${prediction}** → **复制**出来当预测。预测下一个 token = **${prediction}**。`,
      },
      {
        step: 4, seq: SEQ, queryPos: q, cur, stage: 'done', matches, weights, prediction,
        log: `**A B C A B C A → ${prediction}**：归纳头回头找"上次 ${cur} 之后是什么"，把 **${prediction}** 复制出来。` +
          `它没在训练里见过这个具体序列,纯靠**上下文里的模式**现学现用——这就是**上下文学习(in-context learning)**的核心电路，` +
          `也是大模型能"照着上文样式继续""看几个例子就照做"的底层机制之一。`,
      },
    ]

    const base0: Frame = {
      step: -1, seq: SEQ, queryPos: q, cur, stage: 'id', matches: [], weights: zeroW, prediction: '', log: '',
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
