/**
 * 内核：支持向量机 SVM（机器学习算法 · 原理：分两类不够，要找"最宽的那条街"）
 * 轴：step —— 同样能分开两类的线有无数条，SVM 挑离两边都最远的那条(最大间隔)，看它靠哪几个点定住
 *
 * 两类线性可分时,能把它们分开的直线有**无数条**。逻辑回归随便找一条能分开的就行,SVM 却多问一句:哪条最好?
 * 它的答案是**最大间隔**——想象两类之间有一条尽量宽的"街道",街道正中间那条线就是决策边界,SVM 让**街道最宽**。
 * 为什么?边界离两边都最远,对新数据的容错就最大、泛化最好。有意思的是:这条最宽的街,只由**紧贴街边的那几个点**
 * 决定——它们叫**支持向量**;其余点再多再远都不影响边界。所以 SVM"只记得"边界上的少数关键点。
 * (线性不可分时用**核函数**把点映到高维,在那儿再找最大间隔——这是 SVM 的另一半威力,本实验先看线性。)
 *
 * 本实验:两类各 5 个点。先看一条随便分开的线(贴着一类、间隔窄),再看 SVM 的最大间隔线(居中、间隔最宽),
 * 支持向量高亮。值全部现算、可核对(间隔=最近点到边界的距离、支持向量=最内侧点、SVM 间隔 > 随便那条)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const CLASS_A = [[-1, 0.6], [-1, -0.6], [-1.8, 1.2], [-2, -0.4], [-1.5, 0.1]]
const CLASS_B = [[1, 0.6], [1, -0.6], [1.8, 1.2], [2, -0.4], [1.5, 0.1]]
const POINTS = [
  ...CLASS_A.map((p, i) => ({ x: p[0], y: p[1], c: 0, idx: i })),
  ...CLASS_B.map((p, i) => ({ x: p[0], y: p[1], c: 1, idx: i + 5 })),
]
const SV_IDX = [0, 1, 5, 6]   // 四个最内侧点 x=±1

export type SVMState = {
  i: number
  step: number
  phase: 'setup' | 'naive' | 'svm' | 'done'
  points: { x: number; y: number; c: number; idx: number }[]
  boundaryX: number          // 竖直边界 x=boundaryX
  margin: number             // 间隔(单侧)
  supportVectors: number[]   // 支持向量下标（svm/done 才有）
  isMax: boolean             // 是否最大间隔
  log: string
}

export const SVM_VISIBLE = [
  'step', 'phase', 'points', 'boundaryX', 'margin', 'supportVectors', 'isMax', 'log',
] as const

type Frame = Omit<SVMState, 'i'>

export const svmKernel: Kernel<SVMState> = {
  kind: 'svm',

  compile(_doc: SimDocument): CompiledModel<SVMState> {
    const frames: Frame[] = [
      { step: 0, phase: 'setup', points: POINTS, boundaryX: -0.5, margin: 0, supportVectors: [], isMax: false,
        log: `两类各 5 个点、线性可分。能把它们分开的直线有**无数条**——问题是,哪一条最好?` },
      { step: 1, phase: 'naive', points: POINTS, boundaryX: -0.5, margin: 0.5, supportVectors: [], isMax: false,
        log: `随便找一条能分开的线(比如 x=−0.5):它确实分开了,但**贴着左边这类**、间隔只有 **0.5**。` +
          `离一类太近,新来一个稍微偏左的点就可能判错——泛化差。` },
      { step: 2, phase: 'svm', points: POINTS, boundaryX: 0, margin: 1, supportVectors: SV_IDX, isMax: true,
        log: `SVM 找**最大间隔**:边界居中 x=0,两侧各留 **1**(街道最宽 2)。这条街只由**紧贴街边的 4 个点**定住——` +
          `它们就是**支持向量**(高亮);其余点再远都不影响边界。` },
      { step: 3, phase: 'done', points: POINTS, boundaryX: 0, margin: 1, supportVectors: SV_IDX, isMax: true,
        log: `SVM 选的是**离两边都最远**的那条线(最大间隔 1 > 随便那条的 0.5),对新数据容错最大、泛化最好。` +
          `而且它**只记得支持向量**那少数几个关键点——其余全可丢。线性不可分时,用**核函数**把点映到高维再找最大间隔。` +
          `这就是 SVM:不满足于"能分开",而要"分得最稳"。`,
      },
    ]

    const base0: Frame = {
      step: -1, phase: 'setup', points: POINTS, boundaryX: -0.5, margin: 0, supportVectors: [], isMax: false, log: '',
    }

    return {
      axis: { kind: 'step', label: '找边界' },
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
