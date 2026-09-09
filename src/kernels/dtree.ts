/**
 * 内核：决策树（机器学习算法 · 靠一刀刀"切平面"把类别分开）
 * 轴：step —— 真递归：每到一个节点就枚举所有候选切法、算不纯度下降、取 argmax 落刀
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。上一轮已经把"选刀"做成真搜索（更早那版把切点写死成 x=0、y=0
 * 却自称"挑增益最大"）。但整棵树仍是**手写死的 6 帧**、数据是一份**两刀就能切净**的
 * 四象限点集 —— 于是决策树最重要的那两件事一次都没出场：
 *
 * ① **它会把噪声也学进去。** 不限深度时，树会为每一个标签翻错的点单独切一刀，
 *    训练准确率 100%，而**留出集准确率掉下来**。这是决策树必须剪枝的全部理由，
 *    而"训练误差 0"在屏幕上看起来跟"学会了"一模一样 —— 不摆留出集就分不出来。
 * ② **它只会切横竖刀。** 真边界是一条对角线时，轴对齐的树只能用**阶梯**去逼近：
 *    叶子数一路涨、训练准确率一路涨，而留出集准确率早就停住了。
 *    "决策树画不出斜线"这句话，画面上一眼看得见。
 *
 * 所以这一版：整棵树改成真递归（轴上走的就是递归本身）、数据分训练/留出、
 * 三档数据 × 两种不纯度 × 四档深度上限，每一帧都带着两个准确率。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Pt = { x: number; y: number; c: number }
const r3 = (x: number) => +x.toFixed(3)

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const D_QUAD = '四象限（两刀切净）'
const D_DIAG = '对角边界 y = x'
const D_NOISY = '四象限 + 噪声'
export const DT_DATA = [D_QUAD, D_DIAG, D_NOISY] as const

const I_GINI = '基尼'
const I_ENTROPY = '信息熵'
export const DT_IMPURITY = [I_GINI, I_ENTROPY] as const

/** 深度上限。`0` 表示不限 —— 显示成「不限」 */
export const DT_DEPTHS = [0, 1, 2, 3] as const

const RANGE = 2.2

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/**
 * 造一批点。`seed` 不同就是另一批 —— 训练集和留出集**同分布、不同样本**，
 * 留出集才有资格当"没见过的数据"。
 */
function makeData(kind: string, n: number, seed: number): Pt[] {
  const r = rng(seed)
  const out: Pt[] = []
  if (kind === D_DIAG) {
    for (let k = 0; k < n; k++) {
      const x = (r() * 2 - 1) * RANGE, y = (r() * 2 - 1) * RANGE
      //  真边界是一条 45° 的斜线 —— 轴对齐的刀切不出它，只能拿阶梯凑
      out.push({ x: r3(x), y: r3(y), c: y > x ? 1 : 0 })
    }
    return out
  }
  /*  四象限：只有右上是第 1 类。
      ⚠️ 象限要**均分**，不能每个点独立掷两次硬币。第一版就是掷硬币的，
      40 个点里右上只落了 **6 个** —— 数据严重不平衡，最大增益的那一刀根本不在 x≈0，
      树切了 4 层 7 个叶子。而这一档的名字叫「两刀切净」。**档名描述的形状要真的成立。** */
  for (let k = 0; k < n; k++) {
    const qx = k % 2 === 0 ? -1 : 1, qy = (k >> 1) % 2 === 0 ? -1 : 1
    const x = qx * (0.6 + r() * 1.4), y = qy * (0.6 + r() * 1.4)
    out.push({ x: r3(x), y: r3(y), c: qx > 0 && qy > 0 ? 1 : 0 })
  }
  if (kind === D_NOISY) {
    //  翻掉 12% 的标签。**这些点的位置没变** —— 它们跟同象限的邻居长得一模一样，
    //  唯一的区别是标签错了。树想把它们也分对，只能为每一个单独切一刀。
    const m = Math.max(1, Math.round(n * 0.12))
    const picked = new Set<number>()
    while (picked.size < m) picked.add(Math.floor(r() * n))
    for (const k of picked) out[k].c = 1 - out[k].c
  }
  return out
}

// ═══════════════════════════════════════════════════════════════
//  不纯度与候选搜索
// ═══════════════════════════════════════════════════════════════

/**
 * 不纯度。两种指标形状不同（熵的峰更尖），但**排序候选切法时结论几乎总是一样** ——
 * 这一点也是可以在屏幕上核对的，不必背"实践中两者差别不大"这句话。
 */
function impurityOf(sub: Pt[], kind: string): number {
  if (!sub.length) return 0
  const p = sub.filter(q => q.c === 1).length / sub.length
  if (kind === I_ENTROPY) {
    const h = (t: number) => (t > 0 ? -t * Math.log2(t) : 0)
    return r3(h(p) + h(1 - p))
  }
  return r3(1 - p * p - (1 - p) * (1 - p))
}

export type Cand = { feat: 'x' | 'y'; t: number; gain: number }

/** 枚举这个节点上所有候选切法（每特征相邻取值的中点），算不纯度下降，按增益降序 */
function searchSplit(pts: Pt[], kind: string): Cand[] {
  const g0 = impurityOf(pts, kind)
  const out: Cand[] = []
  for (const feat of ['x', 'y'] as const) {
    const vals = [...new Set(pts.map(p => p[feat]))].sort((a, b) => a - b)
    for (let i = 0; i < vals.length - 1; i++) {
      const t = r3((vals[i] + vals[i + 1]) / 2)
      const L = pts.filter(p => p[feat] < t), R = pts.filter(p => p[feat] >= t)
      if (!L.length || !R.length) continue
      const g = g0 - (L.length * impurityOf(L, kind) + R.length * impurityOf(R, kind)) / pts.length
      out.push({ feat, t, gain: r3(g) })
    }
  }
  /*  ⚠️ 排序要**完全确定**。增益已经舍到 3 位，平局很常见（四象限那档 x≈0 和 y≈0
      的增益一模一样），平局时再按 |t| 和特征名定序 —— 否则"换个不纯度指标那一刀会不会变"
      量到的是抛硬币，不是两个指标的真差别。 */
  return out.sort((a, b) => b.gain - a.gain || Math.abs(a.t) - Math.abs(b.t) || a.feat.localeCompare(b.feat))
}

// ═══════════════════════════════════════════════════════════════
//  树
// ═══════════════════════════════════════════════════════════════

type Box = [number, number, number, number]     // [x0, y0, x1, y1]
type Node =
  | { kind: 'leaf'; box: Box; c: number; n: number; wrong: number }
  | { kind: 'split'; box: Box; feat: 'x' | 'y'; t: number; L: Node; R: Node }

export type Split = { feat: 'x' | 'y'; t: number; seg: [number, number, number, number] }
export type Leaf = { box: Box; c: number; n: number; wrong: number }

const majority = (pts: Pt[]) => (pts.filter(p => p.c === 1).length * 2 >= pts.length ? 1 : 0)

/** 拿一棵树给一个点定类 */
function predict(node: Node, p: Pt): number {
  let cur = node
  while (cur.kind === 'split') cur = (p[cur.feat] < cur.t ? cur.L : cur.R)
  return cur.c
}

const accuracy = (node: Node, pts: Pt[]) =>
  pts.length ? r3(pts.filter(p => predict(node, p) === p.c).length / pts.length) : 0

// ═══════════════════════════════════════════════════════════════

export type DTreeState = {
  i: number
  step: number
  phase: 'root' | 'search' | 'split' | 'leaf' | 'done'
  points: Pt[]
  /** 留出集 —— 训练时一个点都没看过 */
  holdout: Pt[]
  /** 本步搜索的候选切法（降序，取前几个展示） */
  cands: Cand[]
  nCands: number
  best: Cand | null
  /** 当前节点的范围（画高亮框用） */
  nodeBox: Box | null
  nodeN: number
  splits: Split[]
  leaves: Leaf[]
  curGini: number
  depth: number
  /** 到这一步为止的叶子数 */
  nLeaves: number
  /** 整棵树建完之后的两个准确率 —— 每一帧都带着，读数不用等到最后 */
  trainAcc: number
  testAcc: number
  /** 训练准确率减留出准确率：这个缺口就是过拟合的大小 */
  overfit: number
  maxLeaves: number
  finalDepth: number
  dataKind: string
  impurity: string
  depthCap: number
  /** 换成另一种不纯度指标时，根节点选的那一刀会不会变 */
  sameAsOther: boolean
  /** 深度扫描：depth 1..8 各建一棵，只算准确率不出帧 */
  sweep: { depth: number; leaves: number; train: number; test: number }[]
  /** 留出准确率最高的那个深度，以及那个高度 */
  bestDepth: number
  ceiling: number
  /** 峰之后留出掉了多少 —— 大于 0 就是"越切越差" */
  declineAfterPeak: number
  log: string
}

export const DTREE_VISIBLE = [
  'step', 'phase', 'points', 'holdout', 'cands', 'nCands', 'best', 'nodeBox', 'nodeN',
  'splits', 'leaves', 'curGini', 'depth', 'nLeaves', 'trainAcc', 'testAcc', 'overfit',
  'maxLeaves', 'finalDepth', 'dataKind', 'impurity', 'depthCap', 'sameAsOther',
  'sweep', 'bestDepth', 'ceiling', 'declineAfterPeak', 'log',
] as const

type Frame = Omit<DTreeState, 'i'>

export const dtreeKernel: Kernel<DTreeState> = {
  kind: 'dtree',

  compile(doc: SimDocument): CompiledModel<DTreeState> {
    const dataKind = String(doc.params.data ?? D_QUAD)
    const impurity = String(doc.params.impurity ?? I_GINI)
    const depthCap = Number(doc.params.depth ?? 0)      // 0 = 不限

    /*  留出集比训练集大得多：它只用来算准确率、不出帧，多撒点不花什么代价，
        而 40 个点上"阶梯边界的代价"根本量不出来（对角档留出准确率一度是 97.5%）。 */
    const TRAIN_N = 40, TEST_N = 400
    const train = makeData(dataKind, TRAIN_N, 20260909)
    const holdout = makeData(dataKind, TEST_N, 771003)

    /*  先把整棵树建完（不出帧），因为读数要在**每一帧**都印出最终的两个准确率 ——
        「练到一半的准确率」不是学生要比较的东西，"训练 100% / 留出 82%"才是。 */
    const build = (pts: Pt[], box: Box, depth: number, cap = depthCap): Node => {
      const imp = impurityOf(pts, impurity)
      const capped = cap > 0 && depth >= cap
      const cands = capped || imp === 0 ? [] : searchSplit(pts, impurity)
      if (!cands.length || cands[0].gain <= 1e-9) {
        const c = majority(pts)
        return { kind: 'leaf', box, c, n: pts.length, wrong: pts.filter(p => p.c !== c).length }
      }
      const b = cands[0]
      const L = pts.filter(p => p[b.feat] < b.t), R = pts.filter(p => p[b.feat] >= b.t)
      const [x0, y0, x1, y1] = box
      const lBox: Box = b.feat === 'x' ? [x0, y0, b.t, y1] : [x0, y0, x1, b.t]
      const rBox: Box = b.feat === 'x' ? [b.t, y0, x1, y1] : [x0, b.t, x1, y1]
      return { kind: 'split', box, feat: b.feat, t: b.t, L: build(L, lBox, depth + 1, cap), R: build(R, rBox, depth + 1, cap) }
    }
    const FULL: Box = [-3, -3, 3, 3]
    const tree = build(train, FULL, 0)

    const trainAcc = accuracy(tree, train)
    const testAcc = accuracy(tree, holdout)
    const overfit = r3(trainAcc - testAcc)
    const countLeaves = (nd: Node): number => (nd.kind === 'leaf' ? 1 : countLeaves(nd.L) + countLeaves(nd.R))
    const treeDepth = (nd: Node): number => (nd.kind === 'leaf' ? 0 : 1 + Math.max(treeDepth(nd.L), treeDepth(nd.R)))
    const maxLeaves = countLeaves(tree)
    const finalDepth = treeDepth(tree)

    /*  ⭐ **深度扫描**：depth = 1..8 各建一棵树（只算准确率、不出帧），
        把叶子数、训练准确率、留出准确率并排。这一条曲线是这个实验的落点 ——
        三档数据在它上面长得完全不同：

        - 四象限：留出到深 2 就顶到 99%，再切没有任何收益（**刚好够**）
        - 四象限+噪声：留出**先升后降**，峰在深 2~3，之后越切越差（**过拟合**）
        - 对角：留出一路缓升，但**永远够不到 100%** —— 阶梯逼近斜线，边上总留着锯齿

        ⚠️ 第一版没有这条曲线，我在对角那档的结语里写了"留出准确率早就停住了"，
        而实测是 74.5 → 79.7 → 90.0 → 92.5 一路在涨。**那句话是编的。**
        有了曲线就不用编：峰在哪、天花板多高，屏幕上直接读。 */
    const sweep = [1, 2, 3, 4, 5, 6, 7, 8].map(d => {
      const t = build(train, FULL, 0, d)
      return { depth: d, leaves: countLeaves(t), train: accuracy(t, train), test: accuracy(t, holdout) }
    })
    const bestRow = sweep.reduce((a, b) => (b.test > a.test ? b : a), sweep[0])
    const ceiling = bestRow.test
    const bestDepth = bestRow.depth
    //  留出准确率在峰之后掉了多少 —— 这就是"越切越差"的大小
    const declineAfterPeak = r3(ceiling - sweep[sweep.length - 1].test)

    /*  换另一种不纯度，根节点选的那一刀会不会变？
        "基尼和信息熵实践中差别不大"这句话，可以在屏幕上核对，不用背。 */
    const other = impurity === I_GINI ? I_ENTROPY : I_GINI
    const a0 = searchSplit(train, impurity)[0]
    const b0 = searchSplit(train, other)[0]
    const sameAsOther = !!a0 && !!b0 && a0.feat === b0.feat && Math.abs(a0.t - b0.t) < 1e-9

    // ── 出帧：轴上走的就是递归本身（先序，栈） ──
    const frames: Frame[] = []
    const splits: Split[] = []
    const leaves: Leaf[] = []
    const shared = {
      points: train, holdout, trainAcc, testAcc, overfit, maxLeaves, finalDepth,
      dataKind, impurity, depthCap, sameAsOther, sweep, bestDepth, ceiling, declineAfterPeak,
    }
    const push = (f: Partial<Frame> & { phase: Frame['phase']; log: string }) => frames.push({
      ...shared, step: frames.length, cands: [], nCands: 0, best: null, nodeBox: null, nodeN: 0,
      splits: splits.map(s => ({ ...s })), leaves: leaves.map(l => ({ ...l })),
      curGini: 0, depth: 0, nLeaves: leaves.length, ...f,
    })

    const rootImp = impurityOf(train, impurity)
    push({
      phase: 'root', curGini: rootImp, nodeBox: FULL, nodeN: train.length,
      log: `根节点：${train.length} 个训练点混在一起，${impurity}不纯度 **${rootImp}**（0 = 全同类）。\n\n` +
        `另有 ${holdout.length} 个**留出点**，同一个分布、另一批样本 —— 建树时一个都不看，` +
        `**它们是唯一能分出"学会了"和"背下来了"的东西**。`,
    })

    const walk = (nd: Node, pts: Pt[], depth: number) => {
      if (nd.kind === 'leaf') {
        leaves.push({ box: nd.box, c: nd.c, n: nd.n, wrong: nd.wrong })
        const why = depthCap > 0 && depth >= depthCap ? `**撞到深度上限 ${depthCap}**，不再往下切`
          : nd.wrong === 0 ? '这一块已经纯了' : '再切也没有正的增益了'
        push({
          phase: 'leaf', nodeBox: nd.box, nodeN: nd.n, depth,
          curGini: impurityOf(pts, impurity),
          log: `第 ${depth} 层的一块成了**叶子**：${nd.n} 个点，判为第 ${nd.c} 类` +
            (nd.wrong > 0 ? `，其中 **${nd.wrong} 个是错的**` : '（全对）') + `。${why}。`,
        })
        return
      }
      const cands = searchSplit(pts, impurity)
      push({
        phase: 'search', nodeBox: nd.box, nodeN: pts.length, depth,
        cands: cands.slice(0, 5), nCands: cands.length, best: cands[0],
        curGini: impurityOf(pts, impurity),
        log: `**搜第 ${splits.length + 1} 刀**（这一块 ${pts.length} 个点）：枚举 ${cands.length} 个候选切法` +
          `（每个特征相邻取值的中点），各算${impurity}下降 → 最大的是 **${cands[0].feat} < ${cands[0].t}?**，增益 **${cands[0].gain}**。` +
          `\n\n不是钦定的，是搜出来的。`,
      })
      const [x0, y0, x1, y1] = nd.box
      splits.push({
        feat: nd.feat, t: nd.t,
        seg: nd.feat === 'x' ? [nd.t, y0, nd.t, y1] : [x0, nd.t, x1, nd.t],
      })
      const L = pts.filter(p => p[nd.feat] < nd.t), R = pts.filter(p => p[nd.feat] >= nd.t)
      push({
        phase: 'split', nodeBox: nd.box, nodeN: pts.length, depth: depth + 1, best: cands[0],
        curGini: impurityOf(pts, impurity),
        log: `落下第 ${splits.length} 刀 **${nd.feat} < ${nd.t}**：左/下 ${L.length} 个（不纯度 ${impurityOf(L, impurity)}），` +
          `右/上 ${R.length} 个（不纯度 ${impurityOf(R, impurity)}）。两边各自继续。`,
      })
      walk(nd.L, L, depth + 1)
      walk(nd.R, R, depth + 1)
    }
    walk(tree, train, 0)

    const capText = depthCap > 0 ? `深度上限 ${depthCap}` : '不限深度'
    const pct = (v: number) => (v * 100).toFixed(1) + '%'
    const curve = sweep.map(r => `深${r.depth}:${r.leaves}叶 训${pct(r.train)}/留${pct(r.test)}`).join('　')
    push({
      phase: 'done', depth: finalDepth, curGini: 0,
      log: `**树建好了**（${capText}）：深 ${finalDepth} 层、${maxLeaves} 个叶子。\n\n` +
        `训练准确率 **${pct(trainAcc)}**，留出准确率 **${pct(testAcc)}**，缺口 **${(overfit * 100).toFixed(1)} 个百分点**。\n\n` +
        `**深度扫描**（各建一棵、只算准确率不出帧）：\n${curve}\n\n` +
        /*  ⚠️ 三档的结论**从这条曲线上读**，不是分档写死的话。
            第一版对角那档的结语写着"留出准确率早就停住了"，而实测一路在涨 —— 那句是编的。 */
        (declineAfterPeak > 0.02
          ? `⚠️ **留出准确率先升后降**：峰在**深 ${bestDepth}**（${pct(ceiling)}），一直切到深 8 掉回 ${pct(sweep[sweep.length - 1].test)}，` +
            `掉了 **${(declineAfterPeak * 100).toFixed(1)} 个百分点**。而训练准确率同一段是一路涨到 ${pct(sweep[sweep.length - 1].train)}。\n\n` +
            `**这就是过拟合，也是剪枝的全部理由。**` +
            /*  分支由曲线定（留出先升后降），但"为什么会这样"这句得跟着**数据档**说 ——
                把"12% 标签翻错"写死在曲线分支里，换一档数据触发同一个分支时它就成了假话。 */
            (dataKind === D_NOISY
              ? ` 这份数据里有 12% 的点标签是翻错的 —— 它们的位置跟同象限的邻居**一模一样**，唯一的区别就是标签错了。` +
                `树想把它们也分对，只能**为每一个单独切一刀**，而那些刀对没见过的数据是纯粹的噪声。`
              : ` 深了之后多出来的刀只在贴合这一批训练点的位置，换一批点就不成立了。`) + `\n\n` +
            `**「训练准确率 100%」在屏幕上跟「学会了」长得一模一样** —— 不摆留出集，这两件事根本分不开。`
          : ceiling < 0.97
            ? `留出准确率一路缓升到 **${pct(ceiling)}**（深 ${bestDepth}）就上不去了，**再多的刀也够不到 100%**。\n\n` +
              `⚠️ 因为**决策树只会切横竖刀**，而这份数据的真边界是一条 45° 斜线。轴对齐的刀只能拿**阶梯**去贴它，` +
              `台阶越密越像，但每一级台阶的斜角上总留着一小块判错的三角 —— 这个天花板是形状带来的，加深度补不上。\n\n` +
              `**一条斜线本来一刀就够**：逻辑回归、SVM 在这份数据上一条直线打满分，而树花了 ${maxLeaves} 个叶子才到 ${pct(testAcc)}。` +
              `（真要让树切斜线，得换成斜决策树 —— 每一刀允许是特征的线性组合。）`
            : `留出准确率在**深 ${bestDepth}** 就顶到 ${pct(ceiling)}，之后既不升也不降 —— **刀刚好够用，多切没有收益也没有代价**。\n\n` +
              `每条路径就是一串 if-else，天生可解释；多刀轴对齐拼出非线性边界。它是**随机森林、GBDT** 的积木。\n\n` +
              `这是最顺的一档。换成「对角边界」看它切不动斜线，换成「四象限 + 噪声」看它怎么把噪声也背下来。`) +
        `\n\n换成「${other}」当不纯度指标，根节点选的那一刀${sameAsOther ? '**一模一样**' : '**会变**'} —— ` +
        `两种指标形状不同（熵的峰更尖），但排候选时结论常常一致。这一条也是量出来的，不用背。`,
    })

    const base0: Frame = {
      ...shared, step: -1, phase: 'root', cands: [], nCands: 0, best: null,
      nodeBox: null, nodeN: 0, splits: [], leaves: [], curGini: rootImp, depth: 0, nLeaves: 0, log: '',
    }

    return {
      axis: { kind: 'step', label: '搜刀 → 落刀' },
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
