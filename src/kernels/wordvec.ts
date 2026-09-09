/**
 * 内核：词向量 Word2Vec（深度学习算法）
 * 轴：数共现 → 算 PPMI → 降维得向量 → 做类比 → 结论
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本的向量是**我手摆的坐标**：
 *   国王(1,0)、男人(0,0)、女人(0,1)、王后(1,1)
 * 于是「国王 − 男人 + 女人 = 王后，距离 **0**」—— 那不是学出来的，是**摆出来的**。
 * 而它自己的正文写着：
 *   「词向量靠**分布假设**学出来：出现在相似上下文里的词，向量就相近 ——
 *    **skip-gram/CBOW 就是让共现的词向量相互靠近**」
 * 训练一次都没发生过。**"惊人的性质"如果是构造出来的，那就一点都不惊人。**
 *
 * 这一版：
 * ① **向量真的从语料里学**：数共现 → **PPMI**（正逐点互信息）→ 对称矩阵**特征分解**降维。
 *    这是经典的计数式词嵌入；Levy & Goldberg 证明过 skip-gram 本质上就是在隐式分解 PMI 矩阵。
 *    （用特征分解而不是 SGD，是为了**确定性**：同样的语料每次跑出同样的向量。）
 * ② **类比成不成立变成一个测量结果**：训完再问「国王 − 男人 + 女人 最近的是谁」——
 *    **答案可能不是王后**，而那才是真的。
 * ③ **语料规模做旋钮**：语料少的时候类比立不住，多了才涌现。
 * ④ **维度做旋钮**：2 / 4 / 8 维。
 * ⑤ ⭐ **那个几乎没人提的细节**：类比评测里通常要**把 a、b、c 三个输入词本身排除掉**，
 *    否则最近邻常常就是输入词自己（"国王−男人+女人"最近的往往还是**国王**）。
 *    屏幕上两种口径**并排给**——「国王−男人+女人≈王后」这个著名例子到底有多硬，
 *    很大程度上取决于这一步。（Linzen 2016 专门写过这件事。）
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

/*  ⚠️ 第一版这个旋钮是"每条模板重复几遍"（1/4/16）—— **完全没用**，三档跑出来一模一样。
    原因很基本：**PMI 是个比值**，把所有计数均匀放大 N 倍，p(a,b)/(p(a)p(b)) 一点不变。
    要让"语料多少"真起作用，得改变**共现结构本身** —— 所以改成"用多少条模板"。 */
const C_TINY = '少（前 8 条模板）'
const C_MID = '中（前 16 条）'
const C_BIG = '全（22 条）'
export const WV_CORPUS = [C_TINY, C_MID, C_BIG] as const
const NTPL: Record<string, number> = { [C_TINY]: 8, [C_MID]: 16, [C_BIG]: 22 }

export const WV_DIMS = [2, 4, 8] as const

const E_EXCL = '排除输入词（标准做法）'
const E_KEEP = '不排除'
export const WV_EXCLUDE = [E_EXCL, E_KEEP] as const

/*  目标词。前 8 个构成 王室×性别 的 2×2×（成人/年轻）结构，后 4 个是干扰项。 */
const TARGETS = ['国王', '王后', '王子', '公主', '男人', '女人', '男孩', '女孩', '猫', '狗', '汽车', '火车']

/*  语料模板：每条是一句话（已分好词）。**上下文词才是信息的来源** ——
    "他/她"标性别、"王宫/王位/加冕"标王室、"年轻"标年龄、"街上/工作/学校/玩"标平民场景。
    ⚠️ 这些句子是编的，但**向量不是**：向量只从这些句子的共现里算出来。 */
const TEMPLATES: string[][] = [
  ['国王', '在', '王宫', '里', '加冕', '他', '登上', '王位'],
  ['王后', '在', '王宫', '里', '加冕', '她', '登上', '王位'],
  ['王子', '在', '王宫', '里', '年轻', '他', '将要', '王位'],
  ['公主', '在', '王宫', '里', '年轻', '她', '将要', '王位'],
  ['男人', '在', '街上', '工作', '他', '很', '忙'],
  ['女人', '在', '街上', '工作', '她', '很', '忙'],
  ['男孩', '在', '学校', '玩', '他', '很', '年轻'],
  ['女孩', '在', '学校', '玩', '她', '很', '年轻'],
  ['国王', '和', '王后', '在', '王宫', '里'],
  ['王子', '和', '公主', '在', '王宫', '里', '年轻'],
  ['男人', '和', '女人', '在', '街上', '工作'],
  ['男孩', '和', '女孩', '在', '学校', '玩'],
  ['国王', '是', '男人', '他', '加冕'],
  ['王后', '是', '女人', '她', '加冕'],
  ['王子', '是', '男孩', '他', '年轻'],
  ['公主', '是', '女孩', '她', '年轻'],
  ['猫', '和', '狗', '在', '家', '里', '睡觉'],
  ['猫', '在', '家', '里', '睡觉', '很', '安静'],
  ['狗', '在', '家', '里', '玩', '很', '吵'],
  ['汽车', '和', '火车', '在', '路上', '跑'],
  ['汽车', '在', '路上', '跑', '很', '快'],
  ['火车', '在', '路上', '跑', '很', '长'],
]

/*  ⚠️ 窗口先设成 ±2，结果屏幕上的共现表里「国王·他」「王后·她」**都是 0** ——
    "国王 在 王宫 里 加冕 他 登上 王位" 里这两个词隔了 5 个位置，±2 根本够不到。
    而表旁边的说明写着"注意国王跟他、王后跟她的差别，性别方向就藏在这一列里"，
    **说明跟它旁边的表打架**。放宽到 ±4，句子里的性别词才真的进得来。 */
const WINDOW = 4
const r3 = (x: number) => Math.round(x * 1000) / 1000

// ═══════════════════════════════════════════════════════════════
//  真的从语料学向量：共现 → PPMI → 特征分解
// ═══════════════════════════════════════════════════════════════

/** 数共现：窗口内出现过就 +1（对称） */
function cooccur(corpus: string[][], vocab: string[]) {
  const idx = new Map(vocab.map((w, k) => [w, k]))
  const V = vocab.length
  const C: number[][] = Array.from({ length: V }, () => Array<number>(V).fill(0))
  for (const sent of corpus) {
    for (let i = 0; i < sent.length; i++) {
      const a = idx.get(sent[i]); if (a === undefined) continue
      for (let j = Math.max(0, i - WINDOW); j <= Math.min(sent.length - 1, i + WINDOW); j++) {
        if (i === j) continue
        const b = idx.get(sent[j]); if (b === undefined) continue
        C[a][b] += 1
      }
    }
  }
  return C
}

/**
 * PPMI：max(0, log( p(a,b) / (p(a)p(b)) ))。
 * 「共现得比随机撞上更频繁」才算信息 —— 这一步把"的、在、很"这类到处都出现的词自动压掉。
 */
function ppmi(C: number[][]) {
  const V = C.length
  const total = C.reduce((s, r) => s + r.reduce((t, x) => t + x, 0), 0) || 1
  const rowSum = C.map(r => r.reduce((t, x) => t + x, 0))
  const M: number[][] = Array.from({ length: V }, () => Array<number>(V).fill(0))
  for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) {
    if (C[i][j] === 0 || rowSum[i] === 0 || rowSum[j] === 0) continue
    const pmi = Math.log((C[i][j] * total) / (rowSum[i] * rowSum[j]))
    M[i][j] = Math.max(0, pmi)
  }
  return M
}

/**
 * 对称矩阵的特征分解（Jacobi 轮转）。
 * 用它而不是 SGD，是为了**确定性** —— 同一份语料每次跑出同一组向量，可复现、可核对。
 * Levy & Goldberg (2014) 证明过：skip-gram with negative sampling 本质上就是在隐式分解 PMI 矩阵。
 */
function jacobiEig(A0: number[][]) {
  const n = A0.length
  const A = A0.map(r => r.slice())
  let Vv: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j]
    if (off < 1e-14) break
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-12) continue
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q])
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
      const c = 1 / Math.sqrt(t * t + 1), s = t * c
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q]
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k]
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk
      }
      for (let k = 0; k < n; k++) {
        const vkp = Vv[k][p], vkq = Vv[k][q]
        Vv[k][p] = c * vkp - s * vkq; Vv[k][q] = s * vkp + c * vkq
      }
    }
  }
  const eig = A.map((r, i) => ({ val: r[i], vec: Vv.map(row => row[i]) }))
  eig.sort((a, b) => b.val - a.val)
  return eig
}

/** 学向量：PPMI 矩阵取前 d 个特征向量 × √特征值 */
function learn(corpus: string[][], vocab: string[], dim: number) {
  const C = cooccur(corpus, vocab)
  const M = ppmi(C)
  const eig = jacobiEig(M)
  const vecs = vocab.map((_, i) => eig.slice(0, dim).map(e => r3(e.vec[i] * Math.sqrt(Math.max(0, e.val)))))
  return { C, M, vecs, eigvals: eig.slice(0, dim).map(e => r3(e.val)) }
}

const cos = (a: number[], b: number[]) => {
  const dot = a.reduce((s, x, k) => s + x * b[k], 0)
  const na = Math.hypot(...a), nb = Math.hypot(...b)
  return na && nb ? r3(dot / (na * nb)) : 0
}

// ═══════════════════════════════════════════════════════════════
//  状态
// ═══════════════════════════════════════════════════════════════

export type WvWord = { name: string; v: number[]; xy: [number, number] }
export type WvRank = { name: string; sim: number; isInput: boolean }

export type WordVecState = {
  i: number
  step: number
  corpusName: string
  dim: number
  excludeName: string
  /** 语料一共多少句、多少词 */
  sents: number
  tokens: number
  /** 共现窗口（±几个词）—— 放进状态里，免得舞台和导览各写各的又漂掉 */
  window: number
  vocab: string[]
  words: WvWord[]
  /** 共现计数里最能说明问题的几行（国王/王后/男人/女人 × 几个上下文词） */
  coRows: { word: string; cells: { ctx: string; n: number; ppmi: number }[] }[]
  stage: 'intro' | 'count' | 'ppmi' | 'embed' | 'analogy' | 'done'
  a: string; b: string; c: string
  /** a − b + c 的结果向量投到前两维 */
  resultXY: [number, number]
  /** 排除输入词之后的排名 */
  ranked: WvRank[]
  /** ⭐ 不排除输入词的排名 —— 两种口径并排 */
  rankedKeep: WvRank[]
  nearest: string
  nearestKeep: string
  /** 类比成不成立（跟期望的答案比） */
  expected: string
  ok: boolean
  okKeep: boolean
  /** 第一名跟第二名的相似度差距 —— **"成立"和"分得开"是两件事** */
  margin: number
  /** 各档语料 × 各档维度下类比成不成立、以及分不分得开 */
  sweep: { corpus: string; dim: number; ok: boolean; okKeep: boolean; nearest: string; margin: number; runnerUp: string }[]
  phase: 'run' | 'done'
  log: string
}

export const WORDVEC_VISIBLE = [
  'step', 'corpusName', 'dim', 'excludeName', 'sents', 'tokens', 'window', 'vocab', 'words', 'coRows',
  'stage', 'a', 'b', 'c', 'resultXY', 'ranked', 'rankedKeep', 'nearest', 'nearestKeep',
  'expected', 'ok', 'okKeep', 'margin', 'sweep', 'phase', 'log',
] as const
type Frame = Omit<WordVecState, 'i'>

const A_W = '国王', B_W = '男人', C_W = '女人', EXPECT = '王后'
const CTX_SHOW = ['王宫', '王位', '加冕', '他', '她', '街上', '工作']

/*  前 8 条只有"每个词各自一句"，没有"国王和王后""国王是男人"这类**把词连起来**的句子；
    中间 8 条加上共现句；最后 6 条是干扰项（猫狗汽车火车）。 */
const buildCorpus = (name: string) => TEMPLATES.slice(0, NTPL[name] ?? TEMPLATES.length)

/** 跑一次完整流程，返回类比结果 */
function analogy(corpusName: string, dim: number) {
  const corpus = buildCorpus(corpusName)
  const vocab = [...new Set(corpus.flat())]
  const { C, M, vecs } = learn(corpus, vocab, dim)
  const at = (w: string) => vecs[vocab.indexOf(w)]
  const va = at(A_W), vb = at(B_W), vc = at(C_W)
  const res = va.map((x, k) => x - vb[k] + vc[k])
  const inputs = new Set([A_W, B_W, C_W])
  const all = TARGETS.filter(w => vocab.includes(w))
    .map(w => ({ name: w, sim: cos(res, at(w)), isInput: inputs.has(w) }))
    .sort((x, y) => y.sim - x.sim)
  const ranked = all.filter(w => !w.isInput)
  /*  ⭐ **"成立"和"分得开"是两件事。**
      少语料 / 低维那几档，前三名（王后、王子、公主）的余弦相似度**全是 1.000** ——
      它不是"选出了王后"，是这三个词根本分不开、碰巧王后排在最前面。
      只看"最近邻是不是王后"会把这种情况判成成功。**差距才是真正该看的量。** */
  const margin = ranked.length > 1 ? r3(ranked[0].sim - ranked[1].sim) : 1
  return { corpus, vocab, C, M, vecs, at, res, ranked, rankedKeep: all, margin }
}

export const wordvecKernel: Kernel<WordVecState> = {
  kind: 'wordvec',

  compile(doc: SimDocument): CompiledModel<WordVecState> {
    const corpusName = String(doc.params.corpus ?? C_BIG)
    const dim = Number(doc.params.dim ?? 4)
    const excludeName = String(doc.params.exclude ?? E_EXCL)

    const r = analogy(corpusName, dim)
    const { corpus, vocab, C, M, vecs, at, res, ranked, rankedKeep, margin } = r
    const nearest = ranked[0]?.name ?? '—'
    const nearestKeep = rankedKeep[0]?.name ?? '—'
    const ok = nearest === EXPECT
    const okKeep = nearestKeep === EXPECT
    const tokens = corpus.reduce((s, x) => s + x.length, 0)

    //  ⭐ 语料 × 维度扫描：类比成不成立是**扫出来的**，不是构造的
    const sweep = WV_CORPUS.flatMap(cn => WV_DIMS.map(d => {
      const x = analogy(cn, d)
      return { corpus: cn, dim: d, ok: x.ranked[0]?.name === EXPECT, okKeep: x.rankedKeep[0]?.name === EXPECT,
        nearest: x.ranked[0]?.name ?? '—', margin: x.margin, runnerUp: x.ranked[1]?.name ?? '—' }
    }))

    const words: WvWord[] = TARGETS.filter(w => vocab.includes(w)).map(w => {
      const v = at(w)
      return { name: w, v, xy: [v[0] ?? 0, v[1] ?? 0] as [number, number] }
    })
    const coRows = [A_W, B_W, C_W, EXPECT].map(w => {
      const i = vocab.indexOf(w)
      return { word: w, cells: CTX_SHOW.map(ctx => {
        const j = vocab.indexOf(ctx)
        return { ctx, n: j >= 0 ? C[i][j] : 0, ppmi: j >= 0 ? r3(M[i][j]) : 0 }
      }) }
    })
    const resultXY: [number, number] = [r3(res[0] ?? 0), r3(res[1] ?? 0)]

    const shared = {
      corpusName, dim, excludeName, sents: corpus.length, tokens, window: WINDOW, vocab, words, coRows,
      a: A_W, b: B_W, c: C_W, expected: EXPECT, resultXY, ranked, rankedKeep,
      nearest, nearestKeep, ok, okKeep, margin, sweep,
    }
    const mk = (stage: WordVecState['stage'], log: string, phase: 'run' | 'done' = 'run'): Frame =>
      ({ ...shared, step: 0, stage, phase, log })

    const frames: Frame[] = [
      mk('intro', `⚠️ **上一版这一屏的向量是我手摆的坐标** —— 国王(1,0)、男人(0,0)、女人(0,1)、王后(1,1)，`
        + `于是"国王−男人+女人=王后、距离 0"当然成立。**那不是学出来的，是摆出来的。**\n\n`
        + `这一版**真的从语料里学**。语料：**${corpus.length}** 句、**${tokens}** 个词（${corpusName}），`
        + `词表 ${vocab.length} 个词。句子是编的，**但向量不是** —— 向量只从这些句子的**共现**里算出来。`),
      mk('count', `**① 数共现**：窗口 ±${WINDOW} 个词。「${A_W}」和「王宫」一起出现了 ${coRows[0].cells[0].n} 次、`
        + `和「他」${coRows[0].cells.find(c => c.ctx === '他')?.n} 次；而「${EXPECT}」和「她」${coRows[3].cells.find(c => c.ctx === '她')?.n} 次。\n\n`
        + `**分布假设**就是这一步的全部依据：**出现在相似上下文里的词，意思也相近**。`),
      mk('ppmi', `**② 算 PPMI**（正逐点互信息）：max(0, log( p(a,b) / (p(a)·p(b)) ))。\n\n`
        + `"共现得比随机撞上更频繁"才算信息 —— 这一步把「在」「很」「的」这类到处都出现的词**自动压掉**，`
        + `只留下真正有指向的搭配。`),
      mk('embed', `**③ 降维**：把 ${vocab.length}×${vocab.length} 的 PPMI 矩阵做**特征分解**，取前 **${dim}** 个方向 —— `
        + `每个词就成了一个 ${dim} 维向量。\n\n`
        + `（Levy & Goldberg 2014 证明过：**skip-gram 本质上就是在隐式分解 PMI 矩阵**。`
        + `这里用特征分解而不是 SGD，是为了**确定性** —— 同一份语料每次跑出同一组向量，可复现。）`),
      mk('analogy', `**④ 做类比**：${A_W} − ${B_W} + ${C_W}，然后找**余弦相似度最高**的词。\n\n`
        + `⚠️ **注意这一次不是构造的** —— 向量是上面三步算出来的，答案是什么就是什么。`),
    ]
    frames.forEach((f, k) => (f.step = k))

    const topN = (list: WvRank[], n = 4) => list.slice(0, n).map(x => `${x.name}(${x.sim})`).join('、')
    const okAll = sweep.filter(x => x.ok).length
    frames.push({
      ...shared, step: frames.length, stage: 'done', phase: 'done',
      log: `**排除输入词**（${A_W}/${B_W}/${C_W}）之后的排名：${topN(ranked)}\n\n`
        + `→ 最近的是 **${nearest}**，期望是 **${EXPECT}** —— **${ok ? '类比成立 ✓' : '没成立 ✗'}**\n\n`
        + `⭐ **而如果不排除输入词**：${topN(rankedKeep)}\n\n`
        + `→ 最近的变成 **${nearestKeep}**`
        + (nearestKeep !== nearest
          ? `。**"国王 − 男人 + 女人"最近的居然还是「${nearestKeep}」自己。**\n\n`
            + `这不是 bug，是**词类比评测里一个几乎没人提的细节**：a−b+c 这个向量离 a 和 c 本来就很近`
            + `（毕竟只挪了一小步），所以标准评测都要**把 a、b、c 三个输入词排除掉**再取最近邻。`
            + `**「国王−男人+女人=王后」这个著名例子有多硬，很大程度上取决于这一步。**（Linzen 2016 专门写过。）`
          : `，跟排除后一样 —— 这一档输入词没有挡路。`)
        /*  ⚠️ **只报"最近邻是不是王后"是不够的。** 少语料/低维那几档前三名相似度全是 1.000 ——
            那不是"选出了王后"，是王后/王子/公主根本分不开、碰巧王后排在前面。
            **差距（第一名 − 第二名）才是真正该看的量。** */
        + `\n\n⚠️ **不过这一档"成立"得看多硬**：第一名 ${ranked[0]?.name}(${ranked[0]?.sim}) 和`
        + `第二名 ${ranked[1]?.name}(${ranked[1]?.sim}) 差 **${margin}**。`
        + (margin < 0.02
          ? `　**几乎为零 —— 这两个词根本分不开**，"最近邻是王后"只是排序碰巧。`
            + `**别把"排第一"当成"学出来了"。**`
          : `　差得开，这次是真的分出来了。`)
        + `\n\n**语料 × 维度扫描**（最近的是谁 · 跟第二名差多少）：\n`
        + WV_CORPUS.map(cn => `　${cn}：` + WV_DIMS.map(d => {
          const x = sweep.find(y => y.corpus === cn && y.dim === d)!
          return `${d}维→${x.nearest}${x.ok ? '✓' : ''}(差${x.margin}${x.margin < 0.02 ? '⚠️分不开' : ''})`
        }).join('　')).join('\n')
        + `\n\n**${sweep.length} 档里 ${okAll} 档最近邻是「${EXPECT}」，但其中 `
        + `${sweep.filter(x => x.ok && x.margin < 0.02).length} 档是"分不开"的假成立** —— `
        + `真正**又对又分得开**的只有 **${sweep.filter(x => x.ok && x.margin >= 0.02).length}** 档。\n\n`
        + `**这就是为什么不能只看一个例子。** 类比在精心挑的词上"成立"很容易，`
        + `可它到底是学出了结构、还是几个词挤成一团分不开，得看差距。`
        + `真实 word2vec 是在几十亿词上训的 —— **那个性质是要足够数据才长得出来的**。`
        + `\n\n词向量把"意思"变成"位置"、把"语义关系"变成"方向"。它靠**分布假设**学出来：`
        + `出现在相似上下文里的词，向量就相近。近义、类比、聚类都能靠向量运算做。`
        + `词向量是 NLP 从符号迈向语义的关键一步，也是所有大模型**输入层**的地基。\n\n`
        + `⚠️ **但别把类比当成词向量的证明。** 它在精心挑的例子上很漂亮，`
        + `换一批关系（国家—首都之外的、反义词、动词时态）成功率就掉得厉害 —— `
        + `**这一屏能让你自己扫一遍，就是为了不把一个漂亮例子当成普遍规律。**`,
    })

    const base0: Frame = { ...shared, step: -1, stage: 'intro', phase: 'run', log: '' }

    return {
      axis: { kind: 'step', label: '共现→PPMI→降维→类比' },
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
