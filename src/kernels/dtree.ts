/**
 * 内核：决策树（机器学习算法 · 原理：靠一刀刀"切平面"把类别分开）
 * 轴：step —— 从一个不纯的整体出发，每次挑"最能把类别分开"的一刀(某特征某阈值)，递归切成纯净的区块
 *
 * 决策树的思路像 20 个问题:每个内部节点问一个"某特征 ≷ 某阈值?"的是非题,把数据一分为二;顺着答案往下走,
 * 直到落进一个**纯净**的叶子(里面几乎全是同一类)。怎么选每一刀?看哪一刀让子集**最纯**——常用**基尼不纯度**
 * (Gini,越接近 0 越纯)衡量,挑**信息增益**(切完不纯度下降最多)的那一刀。递归地切,直到每块都纯。
 * 它天生**可解释**(每条路径就是一串 if-else 规则)、能处理非线性边界(用多刀轴对齐地拼),是随机森林、GBDT 的积木。
 *
 * 本实验:16 个点分布在四象限,只有右上是第 1 类。看它先切 **x=0**(左半纯净=第0类)、再在右半切 **y=0**
 * (右上=第1类、右下=第0类),三刀两下全部切纯。值全部现算、可核对(每刀的 Gini/信息增益、叶子纯度)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// 四象限各 4 点，右上=class1
const RAW: [number, number, number][] = [
  [1, 1, 1], [1.5, 0.8, 1], [0.8, 1.4, 1], [1.3, 1.2, 1],
  [-1, 1, 0], [-1.4, 0.9, 0], [-0.8, 1.3, 0], [-1.2, 1.1, 0],
  [-1, -1, 0], [-1.3, -0.9, 0], [-0.8, -1.2, 0], [-1.1, -1.3, 0],
  [1, -1, 0], [1.4, -0.8, 0], [0.9, -1.3, 0], [1.2, -1.1, 0],
]
const POINTS = RAW.map(([x, y, c]) => ({ x, y, c }))
const gini = (sub: { c: number }[]) => {
  if (!sub.length) return 0
  const p1 = sub.filter(p => p.c === 1).length / sub.length
  return +(1 - p1 * p1 - (1 - p1) * (1 - p1)).toFixed(3)
}

type Split = { feat: 'x' | 'y'; t: number; seg: [number, number, number, number] }  // 切线段 x0,y0,x1,y1
type Leaf = { box: [number, number, number, number]; c: number }  // x0,y0,x1,y1 + 主类

export type DTreeState = {
  i: number
  step: number
  phase: 'root' | 'split' | 'done'
  points: { x: number; y: number; c: number }[]
  splits: Split[]            // 已切的线
  leaves: Leaf[]             // 已确定的纯净叶子
  curGini: number            // 当前处理节点的不纯度
  gain: number               // 本刀的信息增益
  depth: number
  log: string
}

export const DTREE_VISIBLE = [
  'step', 'phase', 'points', 'splits', 'leaves', 'curGini', 'gain', 'depth', 'log',
] as const

type Frame = Omit<DTreeState, 'i'>

export const dtreeKernel: Kernel<DTreeState> = {
  kind: 'dtree',

  compile(_doc: SimDocument): CompiledModel<DTreeState> {
    const rootGini = gini(POINTS)
    const left = POINTS.filter(p => p.x < 0), right = POINTS.filter(p => p.x >= 0)
    const gain1 = +(rootGini - (left.length * gini(left) + right.length * gini(right)) / POINTS.length).toFixed(3)
    const rTop = right.filter(p => p.y >= 0), rBot = right.filter(p => p.y < 0)
    const gain2 = +(gini(right) - (rTop.length * gini(rTop) + rBot.length * gini(rBot)) / right.length).toFixed(3)

    const splitX: Split = { feat: 'x', t: 0, seg: [0, -3, 0, 3] }
    const splitY: Split = { feat: 'y', t: 0, seg: [0, 0, 3, 0] }
    const leafLeft: Leaf = { box: [-3, -3, 0, 3], c: 0 }
    const leafTop: Leaf = { box: [0, 0, 3, 3], c: 1 }
    const leafBot: Leaf = { box: [0, -3, 3, 0], c: 0 }

    const frames: Frame[] = [
      { step: 0, phase: 'root', points: POINTS, splits: [], leaves: [], curGini: rootGini, gain: 0, depth: 0,
        log: `根节点:16 个点混在一起,基尼不纯度 **${rootGini}**(0=全同类)。决策树要一刀刀把它切纯。` },
      { step: 1, phase: 'split', points: POINTS, splits: [splitX], leaves: [leafLeft], curGini: gini(right), gain: gain1, depth: 1,
        log: `第 1 刀:在所有"某特征≷某阈值"里挑信息增益最大的——**x < 0?**(增益 ${gain1})。` +
          `左半 8 个点**全是第 0 类**(Gini 0、纯了,成叶子);右半还混着(Gini ${gini(right)}),继续切。` },
      { step: 2, phase: 'split', points: POINTS, splits: [splitX, splitY], leaves: [leafLeft, leafTop, leafBot], curGini: 0, gain: gain2, depth: 2,
        log: `第 2 刀:只在右半切,**y < 0?**(增益 ${gain2})。右上 4 个=**第 1 类**、右下 4 个=**第 0 类**,` +
          `两块都纯了。三刀两下,全部切纯。` },
      { step: 3, phase: 'done', points: POINTS, splits: [splitX, splitY], leaves: [leafLeft, leafTop, leafBot], curGini: 0, gain: 0, depth: 2,
        log: `决策树建好:深 2、3 个纯叶子。每条路径就是一串 if-else 规则(x<0→第0类;x≥0且y≥0→第1类;x≥0且y<0→第0类)。` +
          `决策树用**多刀轴对齐**拼出非线性边界、天生可解释;基尼选刀、递归切纯。它是**随机森林、GBDT** 的积木。`,
      },
    ]

    const base0: Frame = {
      step: -1, phase: 'root', points: POINTS, splits: [], leaves: [], curGini: rootGini, gain: 0, depth: 0, log: '',
    }

    return {
      axis: { kind: 'step', label: '第几刀' },
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
