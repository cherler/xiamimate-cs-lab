/**
 * 内核：词向量 Word2Vec（深度学习算法 · 原理：把词变成向量,意思相近则方向相近、语义关系变成可加减的方向)
 * 轴：step —— 每个词是空间里的一个向量。相似的词离得近;更妙的是**语义关系变成方向**:
 *      国王−男人+女人 = 王后,因为"男→女"和"王室"两条语义方向可以像箭头一样加减。
 *
 * 词向量(word embedding)把每个词映射成一个稠密向量,让"意思"变成"位置"。它靠**分布假设**学出来:
 * 出现在相似上下文里的词(如"猫"和"狗"都常跟"宠物""喂食"共现),向量就相近——skip-gram/CBOW 就是让共现的词向量相互靠近。
 * 学好后有个惊人的性质:**语义关系体现为向量方向**。经典例子:**国王 − 男人 + 女人 ≈ 王后**——
 * "国王减男人"得到的正是"王室"这个方向,再加上"女人",就落到了"王后"。类比、近义、聚类都能靠向量运算做。
 *
 * 本实验:用两条可解释的语义轴(**王室度** × **性别**)给几个词定坐标,现场演示这道类比:
 * 国王(1,0) − 男人(0,0) = 王室方向(1,0);+ 女人(0,1) = (1,1);离它最近的词正是**王后(1,1),距离 0**。
 * 每步的向量加减、最近邻距离都可手算核对。词向量是 NLP 从"符号"迈向"语义"的关键一步,是所有大模型输入层的地基。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Word = { name: string; v: [number, number] }
const WORDS: Word[] = [
  { name: '男人', v: [0, 0] }, { name: '女人', v: [0, 1] },
  { name: '国王', v: [1, 0] }, { name: '王后', v: [1, 1] },
  { name: '王子', v: [0.9, 0.1] }, { name: '猫', v: [-1, 0.6] }, { name: '汽车', v: [-0.6, -0.5] },
]
const A = '国王', Bx = '男人', C = '女人'
const r3 = (x: number) => Math.round(x * 1000) / 1000
const dist = (a: [number, number], b: [number, number]) => r3(Math.hypot(a[0] - b[0], a[1] - b[1]))

export type WordVecState = {
  i: number
  step: number
  words: Word[]
  stage: string                // 'show' | 'sub' | 'add' | 'find' | 'done'
  dir: [number, number]        // A - B
  result: [number, number]     // A - B + C
  ranked: { name: string; d: number }[]
  nearest: string
  phase: 'run' | 'done'
  log: string
}

export const WORDVEC_VISIBLE = [
  'step', 'words', 'stage', 'dir', 'result', 'ranked', 'nearest', 'phase', 'log',
] as const

type Frame = Omit<WordVecState, 'i'>

export const wordvecKernel: Kernel<WordVecState> = {
  kind: 'wordvec',

  compile(_doc: SimDocument): CompiledModel<WordVecState> {
    const get = (n: string) => WORDS.find(w => w.name === n)!.v
    const vA = get(A), vB = get(Bx), vC = get(C)
    const dir: [number, number] = [vA[0] - vB[0], vA[1] - vB[1]]
    const result: [number, number] = [dir[0] + vC[0], dir[1] + vC[1]]
    const ranked = WORDS.map(w => ({ name: w.name, d: dist(result, w.v) })).sort((a, b) => a.d - b.d)
    const nearest = ranked[0].name

    const mk = (stage: string, log: string, extra: Partial<Frame> = {}): Frame => ({
      step: 0, words: WORDS, stage, dir: [0, 0], result: [0, 0], ranked: [], nearest: '', phase: 'run', log, ...extra,
    })

    const frames: Frame[] = [
      mk('show', `几个词摆进平面:横轴=**王室度**(0 平民→1 王室)、纵轴=**性别**(0 男→1 女)。国王(1,0)、男人(0,0)、女人(0,1)、王后(1,1)。相近的词离得近。`),
      mk('sub', `**国王 − 男人** = (1,0) − (0,0) = **(${dir.join(',')})**——这正是"**王室**"这个语义方向(把"男人"变成"国王"要往王室走一格)。`, { dir }),
      mk('add', `再 **+ 女人**(0,1):(${dir.join(',')}) + (0,1) = **(${result.join(',')})**——沿"女性"方向再走一格。`, { dir, result }),
      mk('find', `找离结果 (${result.join(',')}) **最近的词**:${ranked.slice(0, 3).map(r => `${r.name}(${r.d})`).join('、')}…… → 最近的是 **${nearest}**,距离 **${ranked[0].d}**!`, { dir, result, ranked, nearest }),
    ]
    frames.forEach((f, k) => (f.step = k))
    frames.push({
      step: frames.length, words: WORDS, stage: 'done', dir, result, ranked, nearest, phase: 'done',
      log: `**类比成立**:国王 − 男人 + 女人 = ${nearest}。词向量把"意思"变成"位置"、把"语义关系"变成"方向"——` +
        `"男→女"是一个方向、"平民→王室"是另一个方向,它们能像箭头一样加减。这靠**分布假设**学出来(共现的词向量相互靠近,skip-gram/CBOW)。` +
        `近义、类比、聚类都能靠向量运算做。词向量是 NLP 从符号迈向语义的关键一步,也是所有大模型**输入层**的地基。`,
    })

    const base0: Frame = mk('', '')
    base0.step = -1

    return {
      axis: { kind: 'step', label: '向量运算' },
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
