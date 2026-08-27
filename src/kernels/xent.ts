/**
 * 内核：交叉熵 / 困惑度（大模型 · 原理：训练损失和评测指标到底在量什么）
 * 轴：step —— 一个语言模型逐词预测一句话，看每个词的"惊讶度"怎么累成交叉熵、换算成困惑度
 *
 * 语言模型每一步都吐出一个"下一个词"的概率分布 p。真实的下一个词只有一个(one-hot)，于是这一步的
 * **交叉熵**就退化成 **−log p(真词)** —— 也就是模型对"真相"的**惊讶度**(单位 bit，用 log2)。
 * 整句的**平均交叉熵** = 各词惊讶度的平均，正是语言模型的**训练损失**。
 * **困惑度(perplexity) = 2^(交叉熵)** —— 它是"有效分叉数"：模型平均在多少个等概率的词之间犹豫。
 *   完美预测：p(真词)=1 → 交叉熵 0 → 困惑度 **1**(毫不犹豫)；
 *   瞎猜(均匀)：p=1/V → 交叉熵 log2(V) → 困惑度 **V**(在 V 个里乱蒙)。
 * 真实模型落在 1 和 V 之间：困惑度越低越好。这就是为什么"降低交叉熵损失""降低困惑度"是一回事。
 *
 * 本实验让模型逐词预测 "the cat sat on the mat"(词表 V=8)：每步给出它对真词的概率 p(真词)，
 * 算惊讶度 −log2 p、累计平均交叉熵、换算困惑度。值全部现算、可核对(困惑度=2^平均交叉熵，夹在 1 与 V 之间)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const VOCAB = ['a', 'the', 'cat', 'sat', 'on', 'mat', 'dog', 'ran']  // V=8
const V = VOCAB.length

// 目标句 "the cat sat on the mat"：真词下标 + 模型给真词的概率 + 一个陪衬 runner-up 下标
const SEQ = [
  { idx: 1, p: 0.90, rival: 2 },  // the
  { idx: 2, p: 0.50, rival: 6 },  // cat (vs dog)
  { idx: 3, p: 0.80, rival: 7 },  // sat
  { idx: 4, p: 0.25, rival: 1 },  // on  (拿不准)
  { idx: 1, p: 0.70, rival: 0 },  // the
  { idx: 5, p: 0.95, rival: 2 },  // mat
]

export type XentState = {
  i: number
  step: number
  vocab: string[]
  V: number
  trueIdx: number
  trueWord: string
  dist: number[]              // 模型对 8 个词的预测概率（和为 1）
  pTrue: number              // 给真词的概率
  surprise: number           // −log2 p(真词)，bit
  ce: number                 // 到此为止的平均交叉熵（bit/token）
  perplexity: number         // 2^ce
  ppUniform: number          // 瞎猜困惑度 = V
  phase: 'run' | 'done'
  log: string
}

export const XENT_VISIBLE = [
  'step', 'vocab', 'V', 'trueIdx', 'trueWord', 'dist', 'pTrue', 'surprise', 'ce', 'perplexity', 'ppUniform', 'phase', 'log',
] as const

type Frame = Omit<XentState, 'i'>

// 由 p(真词) + runner-up 合成一个像样的分布（真词 p、陪衬拿剩下的一大半、其余均分）
function makeDist(idx: number, p: number, rival: number): number[] {
  const d = new Array(V).fill(0)
  d[idx] = p
  const rest = 1 - p
  if (rival !== idx) { d[rival] = rest * 0.6; }
  const others = []
  for (let k = 0; k < V; k++) if (k !== idx && k !== rival) others.push(k)
  const share = (rest - (rival !== idx ? rest * 0.6 : 0)) / others.length
  for (const k of others) d[k] = share
  return d.map(x => +x.toFixed(3))
}

export const xentKernel: Kernel<XentState> = {
  kind: 'xent',

  compile(_doc: SimDocument): CompiledModel<XentState> {
    const frames: Frame[] = []
    let sumSurprise = 0

    SEQ.forEach((tok, step) => {
      const surprise = -Math.log2(tok.p)
      sumSurprise += surprise
      const ce = sumSurprise / (step + 1)
      const perplexity = Math.pow(2, ce)
      frames.push({
        step, vocab: VOCAB, V, trueIdx: tok.idx, trueWord: VOCAB[tok.idx],
        dist: makeDist(tok.idx, tok.p, tok.rival), pTrue: tok.p,
        surprise: +surprise.toFixed(3), ce: +ce.toFixed(3), perplexity: +perplexity.toFixed(3), ppUniform: V,
        phase: 'run',
        log: `预测第 ${step + 1} 个词「**${VOCAB[tok.idx]}**」：模型给它 **${(tok.p * 100).toFixed(0)}%**，` +
          `惊讶度 = −log₂ ${tok.p} = **${surprise.toFixed(2)}** bit。` +
          `到此平均交叉熵 **${ce.toFixed(2)}** bit/词，困惑度 2^${ce.toFixed(2)} = **${perplexity.toFixed(2)}**` +
          `（1=毫不犹豫，${V}=瞎猜）。`,
      })
    })

    const lf = frames[frames.length - 1]
    frames.push({
      ...lf, phase: 'done',
      log: `整句预测完：平均交叉熵 **${lf.ce}** bit/词（这就是语言模型的**训练损失**），` +
        `困惑度 = 2^${lf.ce} = **${lf.perplexity}** —— 模型平均只在约 **${lf.perplexity.toFixed(1)}** 个等概率词之间犹豫。` +
        `对比：完美预测困惑度=1，瞎猜(均匀)困惑度=${V}。真词概率越高→惊讶度越低→交叉熵越小→困惑度越接近 1。` +
        `所以"降交叉熵损失"和"降困惑度"是同一件事，也是为什么困惑度是语言模型最常用的评测指标。`,
    })

    const base0: Frame = {
      step: -1, vocab: VOCAB, V, trueIdx: -1, trueWord: '', dist: new Array(V).fill(0),
      pTrue: 0, surprise: 0, ce: 0, perplexity: 1, ppUniform: V, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '第几个词' },
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
