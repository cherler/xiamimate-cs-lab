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
 * ── 2026-09-08 补厚（用户：「实验仿真有点偏简陋，这个还是要深深打磨才行」）──
 * 老版本一句话、一组写死的 p(真词)、一个词表大小。定义讲清楚了，但两条**实践里最容易踩的坑**都没碰到：
 *
 *   ① **困惑度不能跨词表比。** 它的天花板就是 V：瞎猜时 PPL 正好等于词表大小。
 *      所以"我的模型 PPL=20"这句话单独拿出来**没有意义** —— V=8 时 20 比瞎猜还差（不可能，
 *      说明模型坏了），V=50257 时却是"比瞎猜强 2500 倍"。
 *      **该比的是 PPL 跟瞎猜基线 V 的比值**，不是 PPL 本身。这一条补厚后能直接切词表看。
 *   ② **一个词就能绑架整句。** 交叉熵是 −log p 的**平均**，而 −log 在 p→0 时是**无界**的。
 *      六个词里只要有一个被模型判了"几乎不可能"（p=1e-9），它一个人贡献 30 bit，
 *      把整句平均交叉熵抬高 5 bit —— 困惑度直接 ×32。
 *      这就是"模型为什么极少给出 0 概率""为什么要做标签平滑"的量化版本。
 *
 * 补厚补三个旋钮（模型质量 / 词表大小 / 有没有一个被判死刑的词），
 * 并把**瞎猜基线**和**比瞎猜强多少倍**摆上屏幕 —— 后者才是跨模型可比的那个数。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const VOCAB = ['a', 'the', 'cat', 'sat', 'on', 'mat', 'dog', 'ran']  // 屏幕上画的那 8 个
//  目标句 "the cat sat on the mat"：真词下标 + 一个陪衬 runner-up 下标
const SEQ = [
  { idx: 1, rival: 2 },  // the
  { idx: 2, rival: 6 },  // cat (vs dog)
  { idx: 3, rival: 7 },  // sat
  { idx: 4, rival: 1 },  // on  (拿不准)
  { idx: 1, rival: 0 },  // the
  { idx: 5, rival: 2 },  // mat
]
//  三档模型质量给的 p(真词)。"瞎猜"那档由词表大小定（p=1/V），在 compile 里算
const QUALITY: Record<string, number[]> = {
  '一般': [0.90, 0.50, 0.80, 0.25, 0.70, 0.95],   // 老版本那组，原样留着
  '很好': [0.98, 0.92, 0.96, 0.85, 0.94, 0.99],
}
//  "被判死刑的那个词"：把第 4 个词（模型本来就拿不准的那个）的概率压到极低
const DOOM: Record<string, number> = { '没有': 0, '有一个 p=0.001': 1e-3, '有一个 p=1e-9': 1e-9 }

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
  ppUniform: number          // 瞎猜困惑度 = V（**困惑度的天花板**）
  //  ── 补厚 ──
  betterThanChance: number   // 瞎猜基线 ÷ 困惑度 —— **这才是跨词表可比的那个数**
  quality: string
  doomTag: string
  doomAt: number             // 被判死刑的那个词的位置（-1=没有）
  doomBits: number           // 它一个人贡献了多少 bit
  ceNoDoom: number           // 把那个词换成正常概率后的平均交叉熵（对照）
  pplNoDoom: number
  phase: 'run' | 'done'
  log: string
}

export const XENT_VISIBLE = [
  'step', 'vocab', 'V', 'trueIdx', 'trueWord', 'dist', 'pTrue', 'surprise', 'ce', 'perplexity', 'ppUniform',
  'betterThanChance', 'quality', 'doomTag', 'doomAt', 'doomBits', 'ceNoDoom', 'pplNoDoom', 'phase', 'log',
] as const

type Frame = Omit<XentState, 'i'>

// 由 p(真词) + runner-up 合成一个像样的分布（真词 p、陪衬拿剩下的一大半、其余均分）
function makeDist(idx: number, p: number, rival: number): number[] {
  const V = VOCAB.length
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

  compile(doc: SimDocument): CompiledModel<XentState> {
    const quality = doc.params.model === undefined ? '一般' : str(doc.params, 'model')
    const V = doc.params.vocab === undefined ? 8 : num(doc.params, 'vocab')
    const doomTag = doc.params.doom === undefined ? '没有' : str(doc.params, 'doom')
    const doomP = DOOM[doomTag] ?? 0

    //  "瞎猜"那一档的概率由词表定：p=1/V —— 这正是"PPL 天花板 = V"的来源
    const base = quality.startsWith('瞎猜') ? SEQ.map(() => 1 / V) : (QUALITY[quality] ?? QUALITY['一般'])
    const DOOM_AT = 3                       // 第 4 个词（模型本来就拿不准的那个）
    const ps = base.map((p, k) => (doomP > 0 && k === DOOM_AT ? doomP : p))
    const doomAt = doomP > 0 ? DOOM_AT : -1

    const frames: Frame[] = []
    let sumSurprise = 0
    //  对照：把被判死刑的那个词换回正常概率之后的账
    const sumNoDoom = base.reduce((a, p) => a - Math.log2(p), 0)
    const ceNoDoom = sumNoDoom / SEQ.length
    const pplNoDoom = Math.pow(2, ceNoDoom)
    const doomBits = doomP > 0 ? -Math.log2(doomP) : 0

    SEQ.forEach((tok, step) => {
      const p = ps[step]
      const surprise = -Math.log2(p)
      sumSurprise += surprise
      const ce = sumSurprise / (step + 1)
      const perplexity = Math.pow(2, ce)
      const isDoom = step === doomAt
      frames.push({
        step, vocab: VOCAB, V, trueIdx: tok.idx, trueWord: VOCAB[tok.idx],
        dist: makeDist(tok.idx, p, tok.rival), pTrue: +p.toPrecision(4),
        surprise: +surprise.toFixed(3), ce: +ce.toFixed(3), perplexity: +perplexity.toFixed(3),
        ppUniform: V, betterThanChance: +(V / perplexity).toFixed(2),
        quality, doomTag, doomAt, doomBits: +doomBits.toFixed(2),
        ceNoDoom: +ceNoDoom.toFixed(3), pplNoDoom: +pplNoDoom.toFixed(3),
        phase: 'run',
        log: `预测第 ${step + 1} 个词「**${VOCAB[tok.idx]}**」：模型给它 `
          + `**${p >= 0.01 ? `${(p * 100).toFixed(0)}%` : p.toExponential(0)}**，`
          + `惊讶度 = −log₂ p = **${surprise.toFixed(2)}** bit`
          + (isDoom ? `　⚠️ **这个词被判了"几乎不可能"** —— 它一个人就贡献了 ${surprise.toFixed(1)} bit，`
            + `而正常那几个词每个才 ${(-Math.log2(base[0])).toFixed(2)} bit 上下。` : '。')
          + `　到此平均交叉熵 **${ce.toFixed(2)}** bit/词，困惑度 2^${ce.toFixed(2)} = **${perplexity.toFixed(2)}**`
          + `（1=毫不犹豫，${V}=瞎猜）。`,
      })
    })

    const lf = frames[frames.length - 1]
    const ratio = V / lf.perplexity
    frames.push({
      ...lf, phase: 'done',
      log: `整句预测完：平均交叉熵 **${lf.ce}** bit/词（这就是语言模型的**训练损失**），`
        + `困惑度 = 2^${lf.ce} = **${lf.perplexity}** —— 模型平均只在约 ${lf.perplexity.toFixed(1)} 个等概率词之间犹豫。`
        + (quality.startsWith('瞎猜')
          ? `　这一档是**瞎猜**（每个词都给 1/V）：困惑度**正好等于词表大小 ${V}**。`
            + `　这就是困惑度的**天花板**，也是它最容易被误用的地方 —— `
            + `**"我的模型 PPL=20"这句话单独拿出来没有意义**：V=8 时 20 比瞎猜还差，V=50257 时却是比瞎猜强 2500 倍。`
            + `　真正跨模型可比的是**比瞎猜强多少倍**（${V}÷PPL），把「模型质量」换掉再看这个数。`
          : doomP > 0
            ? `　⚠️ 但这个数被**一个词绑架了**：第 ${DOOM_AT + 1} 个词的概率只有 ${doomP.toExponential(0)}，`
              + `它一个人贡献 **${doomBits.toFixed(1)} bit**，把六个词的平均抬高了 `
              + `**${(lf.ce - ceNoDoom).toFixed(2)} bit** —— 困惑度从 ${pplNoDoom.toFixed(2)} 涨到 **${lf.perplexity}**`
              + `（×${(lf.perplexity / pplNoDoom).toFixed(1)}）。`
              + `　原因在定义里：交叉熵是 −log p 的**平均**，而 −log 在 p→0 时**无界**。`
              + `**一个"绝不可能"的判断，代价是无穷大。**`
              + `　这就是模型极少给出 0 概率、以及要做**标签平滑**的原因 —— 给每个词留一点点概率，是在给自己买保险。`
            : `　跟瞎猜比：瞎猜的困惑度是 ${V}，这个模型是 ${lf.perplexity} —— **比瞎猜强 ${ratio.toFixed(1)} 倍**。`
              + `　⚠️ 记住 PPL 的天花板就是词表大小：换个词表，同一个模型的"好坏"看起来就变了。`
              + `**跨词表比 PPL 是没有意义的，要比就比这个倍数。**`
              + `　再把「有没有被判死刑的词」拧开看看：一个 p=1e-9 的词能把整句的困惑度乘上几十倍。`),
    })

    const base0: Frame = {
      step: -1, vocab: VOCAB, V, trueIdx: -1, trueWord: '', dist: new Array(VOCAB.length).fill(0),
      pTrue: 0, surprise: 0, ce: 0, perplexity: 1, ppUniform: V, betterThanChance: V,
      quality, doomTag, doomAt, doomBits: +doomBits.toFixed(2),
      ceNoDoom: +ceNoDoom.toFixed(3), pplNoDoom: +pplNoDoom.toFixed(3), phase: 'run', log: '',
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
