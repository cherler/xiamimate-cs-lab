/**
 * 内核：图卷积 GCN（深度学习算法）
 * 轴：第 1 层逐节点聚合 → 第 2、3…L 层整层推进 → 结论
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本**只跑一层**，而它自己的正文里写着两句从没兑现过的话：
 *   ①「把**多层叠起来**，信息一跳一跳传得更远 —— 第 L 层的节点表示概括了它 **L 跳内**的整个子图」
 *     —— 层数写死是 1，"L 跳"这件事一次都没发生过。
 *   ②「真实 GCN 聚合后还乘可学权重 W」—— 没有权重、没有归一化。
 * 而且**整个图神经网络最有名的那个毛病压根没提**：**过平滑（over-smoothing）**。
 * 「叠得越深看得越远」听着全是好处，可实际上**叠到一定深度，所有节点的表示会糊成一样**，
 * 节点分类反而变差。这正是①那句话的另一面，也是 GNN 实践里第一个要撞的墙。
 *
 * 这一版：
 * ① **层数做成旋钮**（1/2/3/5/10）。
 * ② **过平滑量出来**：每层算一次节点特征的**离散度**（max−min）。
 *    它随层数塌向 0 —— 屏幕上一条曲线，而不是一句话。
 * ③ **聚合方式做成旋钮**：**均值聚合**（自己+邻居平均）vs **对称归一化** D^(−1/2)(A+I)D^(−1/2)
 *    （这才是 Kipf & Welling 那篇里的 GCN）。在**度数不均**的图上两者明显不同。
 * ④ **图做成旋钮**：链状（传得慢）/ 原来那张 / 星形（一层就糊成一片）。
 * ⑤ **"L 跳"是扰动实验验出来的，不是断言**：把某个节点的初始特征改一下，
 *    看第 L 层有哪些节点跟着变 —— 变的那些必须**正好**是 L 跳以内的。
 *    ⚠️ 这一条不能问 GCN 自己，得另拿 BFS 算一份跳数当真值。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const G_MID = '原图（5 点 5 边）'
const G_CHAIN = '链状（传得慢）'
const G_STAR = '星形（一层就糊）'
export const GCN_GRAPHS = [G_MID, G_CHAIN, G_STAR] as const

const A_MEAN = '均值聚合（自己+邻居平均）'
const A_SYM = '对称归一化（真 GCN）'
export const GCN_AGGS = [A_MEAN, A_SYM] as const

export const GCN_LAYERS = [1, 2, 3, 5, 10] as const

type Pt = { x: number; y: number }
type Graph = { pos: Pt[]; edges: [number, number][]; feat0: number[] }

const GRAPHS: Record<string, Graph> = {
  [G_MID]: {
    pos: [{ x: 0.22, y: 0.28 }, { x: 0.22, y: 0.72 }, { x: 0.48, y: 0.5 }, { x: 0.72, y: 0.5 }, { x: 0.92, y: 0.5 }],
    edges: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4]],
    feat0: [1, 0, 0, 0, 1],
  },
  //  链状：0—1—2—3—4。信息一层只能走一跳，5 个点要 4 层才通到头
  [G_CHAIN]: {
    pos: [{ x: 0.1, y: 0.5 }, { x: 0.3, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 }, { x: 0.9, y: 0.5 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    feat0: [1, 0, 0, 0, 0],
  },
  //  星形：中心 0 连所有人。任意两点最多 2 跳 —— **一层就糊，两层基本平了**
  [G_STAR]: {
    pos: [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.15 }, { x: 0.86, y: 0.68 }, { x: 0.5, y: 0.88 }, { x: 0.14, y: 0.68 }],
    edges: [[0, 1], [0, 2], [0, 3], [0, 4]],
    feat0: [0, 1, 0, 0, 1],
  },
}

const r3 = (x: number) => Math.round(x * 1000) / 1000
const N = 5

const nbrsOf = (edges: [number, number][], v: number) =>
  edges.filter(e => e.includes(v)).map(e => (e[0] === v ? e[1] : e[0]))

/**
 * 一层聚合的**系数矩阵**。两档：
 * - 均值：每个邻居（含自己）权重都是 1/(deg+1) —— 老版本那套。
 * - 对称归一化：Â = D^(−1/2)(A+I)D^(−1/2)，权重 1/√((deg_i+1)(deg_j+1))。
 *   **这才是 Kipf & Welling 的 GCN**：度数大的邻居被压低，不会因为"朋友多"就把别人淹了。
 */
function coefMatrix(edges: [number, number][], agg: string): number[][] {
  const adj: number[][] = Array.from({ length: N }, () => Array<number>(N).fill(0))
  for (let v = 0; v < N; v++) { adj[v][v] = 1 }
  for (const [a, b] of edges) { adj[a][b] = 1; adj[b][a] = 1 }
  const deg = adj.map(row => row.reduce((s, x) => s + x, 0))
  const M: number[][] = Array.from({ length: N }, () => Array<number>(N).fill(0))
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (!adj[i][j]) continue
    M[i][j] = agg === A_SYM ? 1 / Math.sqrt(deg[i] * deg[j]) : 1 / deg[i]
  }
  return M
}

const applyLayer = (M: number[][], f: number[]) =>
  M.map(row => r3(row.reduce((s, w, j) => s + w * f[j], 0)))

/** 离散度：节点特征的 max−min。**过平滑就是它塌向 0** */
const spread = (f: number[]) => r3(Math.max(...f) - Math.min(...f))

/** BFS 跳数 —— 「第 L 层只看得到 L 跳内」的**独立真值**，不问 GCN */
function hops(edges: [number, number][], src: number): number[] {
  const d = Array<number>(N).fill(Infinity)
  d[src] = 0
  const q = [src]
  while (q.length) {
    const v = q.shift()!
    for (const u of nbrsOf(edges, v)) if (d[u] === Infinity) { d[u] = d[v] + 1; q.push(u) }
  }
  return d
}

/**
 * ⭐ **扰动实验**：把节点 `src` 的初始特征 +1，跑 L 层，看哪些节点的输出跟着变了。
 * 「第 L 层的表示概括它 L 跳内的子图」这句话，只有这么验才算数 —— 而不是我说它是。
 */
function perturb(edges: [number, number][], agg: string, feat0: number[], L: number, src: number) {
  const M = coefMatrix(edges, agg)
  let a = feat0.slice(), b = feat0.slice()
  b[src] += 1
  for (let l = 0; l < L; l++) { a = applyLayer(M, a); b = applyLayer(M, b) }
  return a.map((x, k) => Math.abs(x - b[k]) > 1e-9)
}

// ═══════════════════════════════════════════════════════════════
//  状态
// ═══════════════════════════════════════════════════════════════

/** 每一层的账 */
export type GcnLayerRow = { layer: number; feat: number[]; spread: number }

export type GcnState = {
  i: number
  step: number
  graphName: string
  aggName: string
  layers: number
  pos: Pt[]
  edges: [number, number][]
  feat0: number[]
  /** 上一层的特征（这一层的输入） */
  feat: number[]
  /** 本层逐节点算出的新特征（第 1 层逐个亮；之后整层一次出） */
  newFeat: (number | null)[]
  /** 当前层号（0=还没开始） */
  layer: number
  /** 第 1 层正在聚合的节点（-1=不在逐节点阶段） */
  cur: number
  agg: number[]
  result: number
  /** 每个聚合系数（当前节点那一行）—— 两档归一化的差别在这儿看得见 */
  coef: number[]
  /** 节点特征的离散度：**过平滑就是它塌向 0** */
  spread: number
  spread0: number
  /** 每层的账，画曲线用 */
  rows: GcnLayerRow[]
  /** ⭐ 扰动实验：改了哪个节点、第 L 层有哪些节点跟着变、真值 L 跳内是哪些 */
  probeSrc: number
  changed: boolean[]
  withinHops: boolean[]
  /** 扰动结果跟"L 跳内"完全一致吗 */
  hopsMatch: boolean
  hopDist: number[]
  /** 各层数下的离散度，摆成表 */
  depthSweep: { layers: number; spread: number; collapsed: boolean }[]
  /**  ⚠️ 叠到很深之后**塌成了什么形状**（归一化到最大值=1）。
       这一栏是量出来才发现的：均值聚合塌成**全一样**，
       而对称归一化塌成**正比于 √(度数+1)** —— 离散度不为 0，
       可那点差别**只反映度数、跟初始特征毫无关系**。信息一样丢光了，只是丢法不同。 */
  deepShape: number[]
  degShape: number[]
  /** 深层形状跟**它实际塌向的那个极限**的最大偏差 */
  shapeGap: number
  /** 它塌向了哪一个极限：「全都一样」还是「正比于 √(度数+1)」 */
  limitName: string
  limitShape: number[]
  /** 换一组完全不同的初始特征，深层形状还是不是这个 —— 是的话就说明初始信息丢光了 */
  infoLost: boolean
  /** 深层离散度是不是已经塌到近 0（均值聚合那档的长相） */
  deepFlat: boolean
  phase: 'run' | 'done'
  log: string
}

export const GCN_VISIBLE = [
  'step', 'graphName', 'aggName', 'layers', 'pos', 'edges', 'feat0', 'feat', 'newFeat', 'layer',
  'cur', 'agg', 'result', 'coef', 'spread', 'spread0', 'rows', 'probeSrc', 'changed', 'withinHops',
  'hopsMatch', 'hopDist', 'depthSweep', 'deepShape', 'degShape', 'shapeGap', 'limitName', 'limitShape',
  'infoLost', 'deepFlat', 'phase', 'log',
] as const
type Frame = Omit<GcnState, 'i'>

const DEPTHS = [1, 2, 3, 5, 10, 20, 50]

export const gcnKernel: Kernel<GcnState> = {
  kind: 'gcn',

  compile(doc: SimDocument): CompiledModel<GcnState> {
    const graphName = String(doc.params.graph ?? G_MID)
    const aggName = String(doc.params.agg ?? A_MEAN)
    const layers = Number(doc.params.layers ?? 3)
    const g = GRAPHS[graphName] ?? GRAPHS[G_MID]
    const { pos, edges, feat0 } = g
    const M = coefMatrix(edges, aggName)
    const nbrs = (v: number) => nbrsOf(edges, v)

    //  每层跑完的特征
    const rows: GcnLayerRow[] = []
    {
      let f = feat0.slice()
      for (let l = 1; l <= Math.max(layers, ...DEPTHS); l++) {
        f = applyLayer(M, f)
        rows.push({ layer: l, feat: f.slice(), spread: spread(f) })
      }
    }
    const s0 = spread(feat0)
    //  ⭐ 深度扫描：离散度随层数塌下去 —— **过平滑量出来，不是说出来**
    const depthSweep = DEPTHS.map(d => {
      const sp = rows[d - 1].spread
      return { layers: d, spread: sp, collapsed: sp < s0 * 0.05 }
    })

    /*  ⭐ 深层塌成了什么形状？归一化到最大值=1 再比。
        ⚠️ 这一段是**量出来才发现的**：对称归一化的离散度到 20 层也不为 0（0.12），
        我原来一句"塌得慢、方向一样"就糊过去了 —— 而真相是它塌向 **√(度数+1)** 的比例，
        那点残余差别只反映度数、跟初始特征无关。**信息一样丢光了。** */
    const DEEP = DEPTHS[DEPTHS.length - 1]
    const norm = (v: number[]) => { const m = Math.max(...v.map(Math.abs)) || 1; return v.map(x => r3(x / m)) }
    const deepShape = norm(rows[DEEP - 1].feat)
    const degs = (() => {
      const d = Array<number>(N).fill(1)
      for (const [a, b] of edges) { d[a]++; d[b]++ }
      return d
    })()
    const degShape = norm(degs.map(Math.sqrt))
    const uniShape = norm(Array.from({ length: N }, () => 1))
    const gapTo = (t: number[]) => r3(Math.max(...deepShape.map((x, k) => Math.abs(x - t[k]))))
    /*  ⚠️ 均值聚合塌向"全一样"、对称归一化塌向"√度数"，是**两个不同的极限**。
        第一版只取了两者里较近的那个当 `shapeGap`，可屏幕上那一行只写着"正比于 √(度数+1)" ——
        于是星形+均值那档（实际 [0.997,1,0.997…]、离 √度数的 [1,0.632…] 差着十万八千里）
        照样印出"← 几乎重合"。**得把"它到底塌向哪一个"也交出去。** */
    const gapDeg = gapTo(degShape), gapUni = gapTo(uniShape)
    const shapeGap = Math.min(gapDeg, gapUni)
    const limitName = gapUni <= gapDeg ? '全都一样（均匀）' : '正比于 √(度数+1)'
    const limitShape = gapUni <= gapDeg ? uniShape : degShape
    //  换一组完全不同的初始特征，深层形状还是不是这个？是 = 初始信息丢光了
    const otherFeat0: number[] = feat0.map((_, k) => (k === N - 1 ? 1 : 0))
    const otherDeep = (() => {
      let f = otherFeat0.slice()
      for (let l = 0; l < DEEP; l++) f = applyLayer(M, f)
      return norm(f)
    })()
    /*  ⚠️ 「信息丢光了」有两种长相，只查一种会漏：
        · 形状收敛到同一个（对称归一化那档，离散度停在 0.12 却已经只剩度数信息）；
        · 离散度直接塌到 ~0（均值聚合那档，这时候归一化会把残余噪声放大，形状比不出来）。
        第一版只查了前一种，链状+均值那档离散度已经 0.004 了却报"还没丢光"。 */
    const shapesAgree = deepShape.every((x, k) => Math.abs(x - otherDeep[k]) < 0.02)
    const deepFlat = rows[DEEP - 1].spread < s0 * 0.02
    const infoLost = shapesAgree || deepFlat

    //  ⭐ 扰动实验：改节点 0 的初始特征，看第 L 层哪些节点跟着变
    const probeSrc = 0
    const changed = perturb(edges, aggName, feat0, layers, probeSrc)
    const hopDist = hops(edges, probeSrc)
    const withinHops = hopDist.map(d => d <= layers)
    const hopsMatch = changed.every((c, k) => c === withinHops[k])

    const frames: Frame[] = []
    const shared = {
      graphName, aggName, layers, pos, edges, feat0, rows, probeSrc, changed, withinHops,
      hopsMatch, hopDist, depthSweep, spread0: s0,
      deepShape, degShape, shapeGap, limitName, limitShape, infoLost, deepFlat,
    }
    const blank = { newFeat: Array<number | null>(N).fill(null), cur: -1, agg: [] as number[], result: 0, coef: [] as number[] }

    frames.push({
      ...shared, ...blank, step: 0, feat: feat0, layer: 0, spread: s0, phase: 'run',
      log: `图有 ${N} 个节点、${edges.length} 条边（**${graphName}**）。初始特征：`
        + feat0.map((x, k) => `节点 ${k}=${x}`).join('、') + `。\n\n`
        + `GCN 一层 = 每个节点把**自己 + 所有邻居**的特征聚合成新特征。这一档用「**${aggName}**」，一共叠 **${layers}** 层。\n\n`
        + (aggName === A_SYM
          ? `**对称归一化**：权重是 1/√((deg_i+1)(deg_j+1))，度数大的邻居会被压低 —— 不会因为"朋友多"就把别人淹了。**这才是 Kipf & Welling 那篇里的 GCN。**`
          : `**均值聚合**：自己和每个邻居的权重都是 1/(deg+1)。最好手算，但**度数不均的图上它会被高度数节点主导** —— 换成对称归一化那档对比看。`),
    })

    //  ── 第 1 层：逐节点算，保持可手算
    const newFeat: (number | null)[] = Array<number | null>(N).fill(null)
    for (let v = 0; v < N; v++) {
      const agg = [v, ...nbrs(v)]
      const result = rows[0].feat[v]
      newFeat[v] = result
      const coef = agg.map(u => r3(M[v][u]))
      frames.push({
        ...shared, step: frames.length, feat: feat0, newFeat: newFeat.slice(),
        layer: 1, cur: v, agg, result, coef, spread: s0, phase: 'run',
        log: `**第 1 层 · 节点 ${v}**：聚合 {自己 ${v}${nbrs(v).length ? '、邻居 ' + nbrs(v).join('、') : ''}}\n\n`
          + `　${agg.map((u, k) => `${coef[k]}×${feat0[u]}`).join(' + ')} = **${result}**`
          + (aggName === A_SYM
            ? `　（系数 1/√((deg_${v}+1)(deg_j+1))，各不相同）`
            : `　（系数都是 1/${agg.length}）`),
      })
    }

    //  ── 第 2 层起：整层推进，盯离散度
    for (let l = 2; l <= layers; l++) {
      const prev = rows[l - 2].feat, now = rows[l - 1].feat
      frames.push({
        ...shared, step: frames.length, feat: prev, newFeat: now.slice(),
        layer: l, cur: -1, agg: [], result: 0, coef: [], spread: rows[l - 1].spread, phase: 'run',
        log: `**第 ${l} 层**：整层再聚合一次 → [${now.join(', ')}]。信息又往外传了一跳，`
          + `现在每个节点概括的是它 **${l} 跳**以内的子图。\n\n`
          + `⚠️ **盯住离散度**（节点特征的 max−min）：初始 ${s0} → 第 ${l - 1} 层 ${rows[l - 2].spread} → 第 ${l} 层 **${rows[l - 1].spread}**。`
          + (rows[l - 1].spread < rows[l - 2].spread
            ? `　**节点之间正在变得越来越像。**`
            : `　这一层没再塌。`),
      })
    }

    //  ── 末帧
    const fin = rows[layers - 1]
    const deep = depthSweep.find(d => d.collapsed)
    frames.push({
      ...shared, step: frames.length, feat: fin.feat, newFeat: fin.feat.slice(),
      layer: layers, cur: -1, agg: [], result: 0, coef: [], spread: fin.spread, phase: 'done',
      log: `**${layers} 层跑完**：[${fin.feat.join(', ')}]。\n\n`
        + `⭐ **"第 L 层概括 L 跳内的子图"这句话，用扰动实验验一遍**：把节点 ${probeSrc} 的初始特征 +1，`
        + `看第 ${layers} 层有哪些节点跟着变了 —— 变的是 **{${changed.map((c, k) => (c ? k : null)).filter(k => k !== null).join(', ')}}**；`
        + `而另拿 BFS 算的"${layers} 跳以内"是 **{${withinHops.map((c, k) => (c ? k : null)).filter(k => k !== null).join(', ')}}**。`
        + (hopsMatch
          ? `　**一模一样 ✓** —— 这句话是验出来的，不是我说的。`
          : `　⚠️ **对不上**（跳数：${hopDist.map(d => (d === Infinity ? '∞' : d)).join('/')}）。`)
        + `\n\n⚠️⚠️ **但"叠得越深看得越远"只说了一半。** 节点特征的**离散度**（max−min）：\n`
        + depthSweep.map(d => `　${d.layers} 层：${d.spread}${d.collapsed ? '　← 基本糊成一片了' : ''}`).join('\n')
        + `\n\n从 ${s0} 一路塌到 ${depthSweep[depthSweep.length - 1].spread}`
        + (deep
          ? ` —— **叠到 ${deep.layers} 层，所有节点的表示就几乎一样了**。`
          : `。`)
        /*  ⚠️ 别拿"离散度没塌到 0"当"没有过平滑"。对称归一化那档 20 层还有 0.12，
            可它塌向的是 **√(度数+1) 的比例** —— 残余的那点差别只反映度数，跟初始特征无关。
            我原来一句"塌得慢、方向一样"糊过去了，量完才知道该这么说。 */
        + `\n\n⚠️ **光看离散度还不够，得看它塌成了什么形状。** 第 ${DEEP} 层的特征归一化之后是 `
        + `[${deepShape.join(', ')}]，而**${limitName}**长这样：[${limitShape.join(', ')}]`
        + (shapeGap < 0.05 ? `　—— **几乎重合**。` : `　（差 ${shapeGap}）。`)
        + (infoLost
          ? `\n\n**初始信息已经丢光了。** `
            + (deepFlat
              ? `这一档的离散度直接塌到了 ${rows[DEEP - 1].spread}（初始是 ${s0}）—— 节点之间**几乎完全一样**。`
              : `换一组完全不同的初始特征，深层跑出来**还是这个形状** —— 剩下的只是图的度数结构。\n\n`
                + `⚠️ **别拿"离散度没塌到 0"当"没有过平滑"**：对称归一化这一档 ${DEEP} 层还有 ${rows[DEEP - 1].spread} 的离散度，`
                + `可那点残余差别**只反映度数、跟节点原本携带的信息一点关系都没有**。`
                + `**信息一样丢光了，只是丢的方式不同。**`)
          : `\n\n（换一组初始特征，深层形状还有差别 —— 这一档收敛得慢，还没完全丢光。链状图的谱隙小，传得慢也糊得慢。）`)
        + `\n\n**这就是过平滑（over-smoothing），图神经网络最有名的毛病。** 聚合的本质是"跟邻居取平均"，`
        + `取一次平均是"融合邻域信息"，取很多次就是**把整张图抹平**：节点分类要的是"不同节点长得不一样"，`
        + `而深层 GCN 恰恰把这个抹没了。**所以实践中的 GCN 大多只有 2~3 层** —— 不是因为算不动，`
        + `是因为**再深就没信息了**。（缓解办法：残差连接、跳跃连接、PairNorm 之类，这一屏没做。）\n\n`
        + `**换个图看看差别**：${G_CHAIN}上信息一层只走一跳，5 个点要 4 层才通到头；`
        + `而${G_STAR}上任意两点最多 2 跳，**一层就糊、两层基本平了** —— `
        + `**同样的层数，在不同的图上"深"的程度完全不同**。\n\n`
        + `真实 GCN 里每个节点是一个向量，聚合之后还要乘一个可学权重 W、再过激活（这一屏只做了聚合那一半，`
        + `因为**过平滑是聚合本身带来的**，跟 W 无关）。GCN 是节点分类、推荐、分子性质预测的核心；和词向量、注意力同属"表示学习"。`,
    })

    const base0: Frame = { ...shared, ...blank, step: -1, feat: feat0, layer: 0, spread: s0, phase: 'run', log: '' }

    return {
      axis: { kind: 'step', label: '聚合（层 / 节点）' },
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
