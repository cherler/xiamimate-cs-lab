/**
 * 内核：推荐系统·矩阵分解（机器学习算法 · 原理：评分=用户隐向量·物品隐向量,用内积补全评分矩阵)
 * 轴：step —— 一张"用户×电影"的评分表,大半是空的(没看过)。矩阵分解:给每个用户、每个电影各学一个**隐向量**,
 *      让 评分 ≈ 用户隐向量·物品隐向量(内积)。学好后,空缺就用内积**预测**出来——这就是"猜你喜欢"。
 *
 * 推荐系统的核心问题:用户只对极少数物品打过分,矩阵大半是空的,怎么猜"他没看过的会打几分"?**协同过滤·矩阵分解**的洞见:
 * 用户的喜好和物品的属性,都能压进一个低维的**隐空间**。给每个用户一个**隐向量**(他各方面口味有多重),给每个电影一个**隐向量**
 * (它各方面属性有多强),让**评分 ≈ 两个隐向量的内积**。用已知评分把这些隐向量学出来(内积对上真实分),
 * 空缺处再用内积一算,就是预测评分。口味和属性对得上(内积大)=推荐。
 *
 * 本实验:3 用户 × 3 电影,隐向量用两条可解释的轴(**爱动作/爱文艺** × **动作度/文艺度**)。已知评分都能被内积复现,
 * 于是预测空缺:小明(爱动作)×盗梦空间(动作+烧脑)=(1,0)·(4,3)=**4**;而小明×小森林(纯文艺)=0,不推荐。每个内积可手算。
 * 矩阵分解是 Netflix、淘宝、抖音推荐的经典底子,和词向量同属"把对象嵌进隐空间"的表示学习。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const USERS = [{ n: '小明', v: [1, 0] }, { n: '小红', v: [0, 1] }, { n: '阿强', v: [0.8, 0.6] }]
const MOVIES = [{ n: '复仇者', v: [5, 0] }, { n: '小森林', v: [0, 5] }, { n: '盗梦空间', v: [4, 3] }]
// 已知评分(其余是空缺待预测)：[user, movie]
const KNOWN = new Set(['0,0', '0,1', '1,1', '2,0', '2,2'])
const dot = (a: number[], b: number[]) => Math.round((a[0] * b[0] + a[1] * b[1]) * 10) / 10
const PREDICT: [number, number] = [0, 2]   // 小明 × 盗梦空间

export type RecSysState = {
  i: number
  step: number
  users: { n: string; v: number[] }[]
  movies: { n: string; v: number[] }[]
  known: string[]
  rating: (number | null)[][]      // 逐步填：已知 + 预测
  stage: string                    // 'matrix'|'userv'|'moviev'|'predict'|'done'
  pr: number; pc: number           // 当前预测的格子
  phase: 'run' | 'done'
  log: string
}

export const RECSYS_VISIBLE = ['step', 'users', 'movies', 'known', 'rating', 'stage', 'pr', 'pc', 'phase', 'log'] as const
type Frame = Omit<RecSysState, 'i'>

export const recsysKernel: Kernel<RecSysState> = {
  kind: 'recsys',
  compile(_doc: SimDocument): CompiledModel<RecSysState> {
    const knownArr = [...KNOWN]
    const full = USERS.map((u, r) => MOVIES.map((m, c) => dot(u.v, m.v)))
    const withKnown = () => USERS.map((_, r) => MOVIES.map((_, c) => (KNOWN.has(`${r},${c}`) ? full[r][c] : null)))
    const frames: Frame[] = [
      { step: 0, users: USERS, movies: MOVIES, known: knownArr, rating: withKnown(), stage: 'matrix', pr: -1, pc: -1, phase: 'run',
        log: `一张"用户×电影"的评分表,大半是空的(没看过)。推荐系统要猜:**空缺处,这个人会打几分**?矩阵分解的办法——给用户和电影各学一个**隐向量**。` },
      { step: 1, users: USERS, movies: MOVIES, known: knownArr, rating: withKnown(), stage: 'userv', pr: -1, pc: -1, phase: 'run',
        log: `**用户隐向量**(可解释成:爱动作、爱文艺各多少):小明=(1,0)只爱动作、小红=(0,1)只爱文艺、阿强=(0.8,0.6)都爱。` },
      { step: 2, users: USERS, movies: MOVIES, known: knownArr, rating: withKnown(), stage: 'moviev', pr: -1, pc: -1, phase: 'run',
        log: `**电影隐向量**(动作度、文艺度):复仇者=(5,0)纯动作、小森林=(0,5)纯文艺、盗梦空间=(4,3)动作+烧脑。已知评分都能被"用户·电影内积"复现。` },
      { step: 3, users: USERS, movies: MOVIES, known: knownArr, rating: (() => { const r = withKnown(); r[PREDICT[0]][PREDICT[1]] = full[PREDICT[0]][PREDICT[1]]; return r })(), stage: 'predict', pr: PREDICT[0], pc: PREDICT[1], phase: 'run',
        log: `**预测空缺**:小明没看过盗梦空间?用内积算——小明(1,0)·盗梦(4,3)=1×4+0×3=**4**分。口味和属性对得上(都偏动作),分就高。` },
      { step: 4, users: USERS, movies: MOVIES, known: knownArr, rating: full.map(row => row.slice()), stage: 'done', pr: PREDICT[0], pc: PREDICT[1], phase: 'done',
        log: `**补全**:所有空缺都用内积预测出来。给小明推**盗梦空间(4)**、不推小森林(0,纯文艺不对味)。矩阵分解=把用户和物品都嵌进低维**隐空间**,` +
          `让 评分≈内积;已知评分学隐向量、空缺内积预测。Netflix、淘宝、抖音"猜你喜欢"的经典底子,和词向量同属表示学习。真实系统隐向量是几十上百维、从海量评分自动学。`,
      },
    ]
    const base0: Frame = { step: -1, users: USERS, movies: MOVIES, known: knownArr, rating: withKnown(), stage: '', pr: -1, pc: -1, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '分解→预测' },
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
