/**
 * 内核：决策树（机器学习算法 · 原理：靠一刀刀"切平面"把类别分开）
 * 轴：step —— 从不纯的整体出发,每次**在所有候选切法里搜出信息增益最大的一刀**(某特征某阈值),递归切成纯净区块。
 *
 * 这里加深的是"选刀"这一步:前一版把切点**写死**成 x=0、y=0(自称"挑增益最大"却没真搜)。现在**真的枚举候选阈值、算每个的增益、取 argmax**:
 *   ①候选阈值=每个特征相邻取值的中点;②对每个候选算加权基尼下降(信息增益);③选增益最大的那刀落下。
 * 于是 x=0 / y=0 是**搜出来的**结果、不是钦定的。每个候选的增益都可手算核对。
 *
 * 基尼不纯度(Gini,越接近 0 越纯)衡量子集纯度,信息增益=切前 Gini − 切后加权 Gini。递归切到每块都纯。
 * 决策树天生**可解释**(每条路径=一串 if-else 规则)、用多刀轴对齐拼出非线性边界,是随机森林、GBDT 的积木。
 * 本实验:16 个点分四象限、只有右上是第 1 类;搜出先切 x=0(左半纯)、再在右半搜出 y=0(右上/右下各纯),三刀两下全切纯。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Pt = { x: number; y: number; c: number }
const RAW: [number, number, number][] = [
  [1, 1, 1], [1.5, 0.8, 1], [0.8, 1.4, 1], [1.3, 1.2, 1],
  [-1, 1, 0], [-1.4, 0.9, 0], [-0.8, 1.3, 0], [-1.2, 1.1, 0],
  [-1, -1, 0], [-1.3, -0.9, 0], [-0.8, -1.2, 0], [-1.1, -1.3, 0],
  [1, -1, 0], [1.4, -0.8, 0], [0.9, -1.3, 0], [1.2, -1.1, 0],
]
const POINTS: Pt[] = RAW.map(([x, y, c]) => ({ x, y, c }))
const r3 = (x: number) => +x.toFixed(3)
const gini = (sub: Pt[]) => {
  if (!sub.length) return 0
  const p1 = sub.filter(p => p.c === 1).length / sub.length
  return r3(1 - p1 * p1 - (1 - p1) * (1 - p1))
}
type Cand = { feat: 'x' | 'y'; t: number; gain: number }
//  枚举某节点上所有候选切法(每特征相邻取值的中点)、算信息增益、按增益降序。
function searchSplit(pts: Pt[]): Cand[] {
  const g0 = gini(pts)
  const out: Cand[] = []
  for (const feat of ['x', 'y'] as const) {
    const vals = [...new Set(pts.map(p => p[feat]))].sort((a, b) => a - b)
    for (let i = 0; i < vals.length - 1; i++) {
      const t = r3((vals[i]! + vals[i + 1]!) / 2)
      const L = pts.filter(p => p[feat] < t), R = pts.filter(p => p[feat] >= t)
      out.push({ feat, t, gain: r3(g0 - (L.length * gini(L) + R.length * gini(R)) / pts.length) })
    }
  }
  return out.sort((a, b) => b.gain - a.gain || Math.abs(a.t) - Math.abs(b.t))
}

type Split = { feat: 'x' | 'y'; t: number; seg: [number, number, number, number] }
type Leaf = { box: [number, number, number, number]; c: number }

export type DTreeState = {
  i: number
  step: number
  phase: 'root' | 'search' | 'split' | 'done'
  points: Pt[]
  cands: Cand[]              // 本步搜索的候选切法(降序,取头几个展示)
  nCands: number            // 候选总数
  best: Cand | null         // 选中的那刀
  splits: Split[]
  leaves: Leaf[]
  curGini: number
  depth: number
  log: string
}

export const DTREE_VISIBLE = ['step', 'phase', 'points', 'cands', 'nCands', 'best', 'splits', 'leaves', 'curGini', 'depth', 'log'] as const
type Frame = Omit<DTreeState, 'i'>

export const dtreeKernel: Kernel<DTreeState> = {
  kind: 'dtree',

  compile(_doc: SimDocument): CompiledModel<DTreeState> {
    const rootGini = gini(POINTS)
    const right = POINTS.filter(p => p.x >= 0)

    //  ① 根节点搜索:枚举所有候选、取增益最大 → 得 x≈0
    const rootCands = searchSplit(POINTS)
    const best1 = rootCands[0]!
    //  ② 右半搜索 → 得 y≈0
    const rightCands = searchSplit(right)
    const best2 = rightCands[0]!

    const splitX: Split = { feat: 'x', t: 0, seg: [best1.t, -3, best1.t, 3] }
    const splitY: Split = { feat: 'y', t: 0, seg: [best1.t, best2.t, 3, best2.t] }
    const leafLeft: Leaf = { box: [-3, -3, best1.t, 3], c: 0 }
    const leafTop: Leaf = { box: [best1.t, best2.t, 3, 3], c: 1 }
    const leafBot: Leaf = { box: [best1.t, -3, 3, best2.t], c: 0 }
    const top = (cs: Cand[]) => cs.slice(0, 5)

    const frames: Frame[] = [
      { step: 0, phase: 'root', points: POINTS, cands: [], nCands: 0, best: null, splits: [], leaves: [], curGini: rootGini, depth: 0,
        log: `根节点:16 个点混在一起,基尼不纯度 **${rootGini}**(0=全同类)。决策树要一刀刀把它切纯——关键是每步**怎么选那一刀**。` },
      { step: 1, phase: 'search', points: POINTS, cands: top(rootCands), nCands: rootCands.length, best: best1, splits: [], leaves: [], curGini: rootGini, depth: 0,
        log: `**搜索第 1 刀**:枚举 ${rootCands.length} 个候选切法(每特征相邻点的中点),各算信息增益 → 最大是 **${best1.feat} < ${best1.t}?**(增益 **${best1.gain}**)。不是钦定,是搜出来的。` },
      { step: 2, phase: 'split', points: POINTS, cands: [], nCands: 0, best: best1, splits: [splitX], leaves: [leafLeft], curGini: gini(right), depth: 1,
        log: `落下第 1 刀 **${best1.feat} < ${best1.t}**:左半 8 个点**全是第 0 类**(Gini 0、纯了,成叶子);右半还混着(Gini ${gini(right)}),继续。` },
      { step: 3, phase: 'search', points: POINTS, cands: top(rightCands), nCands: rightCands.length, best: best2, splits: [splitX], leaves: [leafLeft], curGini: gini(right), depth: 1,
        log: `**搜索第 2 刀**(只在右半):${rightCands.length} 个候选里增益最大的是 **${best2.feat} < ${best2.t}?**(增益 **${best2.gain}**,直接把右半切成两块纯的)。` },
      { step: 4, phase: 'split', points: POINTS, cands: [], nCands: 0, best: best2, splits: [splitX, splitY], leaves: [leafLeft, leafTop, leafBot], curGini: 0, depth: 2,
        log: `落下第 2 刀 **${best2.feat} < ${best2.t}**:右上 4 个=**第 1 类**、右下 4 个=**第 0 类**,两块都纯了。三刀两下,全部切纯。` },
      { step: 5, phase: 'done', points: POINTS, cands: [], nCands: 0, best: null, splits: [splitX, splitY], leaves: [leafLeft, leafTop, leafBot], curGini: 0, depth: 2,
        log: `决策树建好:深 2、3 个纯叶子。每条路径就是一串 if-else(x<0→第0类;x≥0且y≥0→第1类;x≥0且y<0→第0类)。` +
          `选刀靠**搜候选取最大信息增益**、递归切纯;多刀轴对齐拼非线性边界、天生可解释。它是**随机森林、GBDT** 的积木。`,
      },
    ]

    const base0: Frame = { step: -1, phase: 'root', points: POINTS, cands: [], nCands: 0, best: null, splits: [], leaves: [], curGini: rootGini, depth: 0, log: '' }

    return {
      axis: { kind: 'step', label: '搜刀→落刀' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 }
      },
    }
  },
}
