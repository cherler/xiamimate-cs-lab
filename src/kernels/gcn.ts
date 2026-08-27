/**
 * 内核：图卷积 GCN（深度学习算法 · 原理：每个节点聚合邻居的特征来更新自己,信息沿边传播)
 * 轴：step —— 图上每个节点有一个特征。GCN 一层 = 每个节点把**自己+所有邻居**的特征做**平均**(聚合),得到新特征。
 *      于是节点"看见"了邻域;叠 L 层,信息就传播 L 跳。图神经网络处理社交网络、分子、知识图谱的底子。
 *
 * 普通网络吃的是规整的向量/图像;但社交关系、分子结构、知识图谱是**图**——节点数不定、每个节点邻居数还不一样。
 * **图卷积 GCN** 的巧思:让每个节点**聚合邻居的信息**来更新自己的表示。最简单的一层就是**邻域平均**:
 * 新特征 = (自己 + 所有邻居的特征) 的平均,再乘一个可学权重、过激活。这样每个节点的新表示就融进了**一跳邻居**的信息;
 * 把多层叠起来,信息一跳一跳传得更远——第 L 层的节点表示概括了它 L 跳内的整个子图。
 *
 * 本实验:5 个节点的小图,两个节点带初始特征(=1、其余 0)。看 GCN 一层:逐个节点把自己+邻居的特征平均,
 * 特征沿边"渗"开——相连的节点变得相似。每个平均值都可手算核对。GCN 是节点分类、推荐、分子性质预测的核心;和词向量、注意力同属"表示学习"。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Pt = { x: number; y: number }
const POS: Pt[] = [{ x: 0.22, y: 0.28 }, { x: 0.22, y: 0.72 }, { x: 0.48, y: 0.5 }, { x: 0.72, y: 0.5 }, { x: 0.92, y: 0.5 }]
const EDGES: [number, number][] = [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4]]
const FEAT0 = [1, 0, 0, 0, 1]
const r3 = (x: number) => Math.round(x * 1000) / 1000
const nbrs = (v: number) => EDGES.filter(e => e.includes(v)).map(e => (e[0] === v ? e[1] : e[0]))

export type GcnState = {
  i: number
  step: number
  pos: Pt[]
  edges: [number, number][]
  feat: number[]               // 当前特征（这一层结束时更新）
  newFeat: (number | null)[]   // 本层逐节点算出的新特征
  cur: number                  // 正在聚合的节点（-1=收官）
  agg: number[]                // 当前节点聚合用到的节点（自己+邻居）
  result: number
  phase: 'run' | 'done'
  log: string
}

export const GCN_VISIBLE = ['step', 'pos', 'edges', 'feat', 'newFeat', 'cur', 'agg', 'result', 'phase', 'log'] as const
type Frame = Omit<GcnState, 'i'>

export const gcnKernel: Kernel<GcnState> = {
  kind: 'gcn',
  compile(_doc: SimDocument): CompiledModel<GcnState> {
    const frames: Frame[] = []
    const newFeat: (number | null)[] = FEAT0.map(() => null)
    frames.push({
      step: 0, pos: POS, edges: EDGES, feat: FEAT0, newFeat: newFeat.slice(), cur: -1, agg: [], result: 0, phase: 'run',
      log: `图有 5 个节点、5 条边。初始特征:节点 0、4 = **1**(有信息),其余 = 0。GCN 一层:每个节点把**自己+邻居**的特征**平均**成新特征。`,
    })
    for (let v = 0; v < 5; v++) {
      const agg = [v, ...nbrs(v)]
      const result = r3(agg.reduce((s, u) => s + FEAT0[u], 0) / agg.length)
      newFeat[v] = result
      frames.push({
        step: frames.length, pos: POS, edges: EDGES, feat: FEAT0, newFeat: newFeat.slice(), cur: v, agg, result, phase: 'run',
        log: `节点 ${v}:聚合{自己 ${v}${nbrs(v).length ? '+邻居 ' + nbrs(v).join('、') : ''}} 的特征 → (${agg.map(u => FEAT0[u]).join('+')})/${agg.length} = **${result}**。`,
      })
    }
    frames.push({
      step: frames.length, pos: POS, edges: EDGES, feat: newFeat as number[], newFeat: newFeat.slice(), cur: -1, agg: [], result: 0, phase: 'done',
      log: `**一层结束**:新特征 [${(newFeat as number[]).join(', ')}]。信息沿边**渗**了一跳——节点 0、4 的"1"分给了邻居,相连的节点变相似。` +
        `再叠一层就传两跳,第 L 层每个节点概括它 L 跳内的子图。GCN 是**节点分类、推荐、分子性质预测**的核心;和词向量、注意力同属"表示学习"。真实 GCN 每个节点是向量、聚合后还乘可学权重 W 再过激活。`,
    })
    const base0: Frame = { step: -1, pos: POS, edges: EDGES, feat: FEAT0, newFeat: FEAT0.map(() => null), cur: -1, agg: [], result: 0, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '节点聚合' },
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
