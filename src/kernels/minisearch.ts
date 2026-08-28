/**
 * 内核：mini 搜索引擎 —— 倒排索引 + TF-IDF 打分（后端 · 项目实战 · 组合式项目）
 * 轴：step —— 读语料→分词→建倒排索引→收查询→取候选→算 idf→TF-IDF 打分→排序返回
 *
 * 这是一个能讲进简历的组合式项目：从零搭一个真能排序的迷你搜索引擎。
 * 语料小到能手算，TF 和 IDF 两个效应都看得见：
 *   D1「猫 爱 吃 鱼」 D2「狗 爱 吃 肉」 D3「猫 猫 玩 鱼」，查询「猫 狗」
 *   idf(猫)=ln(3/2)=0.41、idf(狗)=ln(3/1)=1.10 —— 狗更稀有、权重更高
 *   打分 D1=0.41、D2=1.10、D3=0.81 → 排序 D2 > D3 > D1
 *   （D2 靠稀有词 idf 赢；D3 靠词频 tf=2 超过 D1）
 * 值可核:每个 tf/df/idf/score 都由代码从语料算出,非手填。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Posting = [string, number] // [docId, tf]
type IndexEntry = { term: string; postings: Posting[] }
type IdfRow = { term: string; df: number; idf: number }
type ScoreRow = { id: string; score: number; parts: string }

export type SearchState = {
  i: number
  step: number
  stage: string
  focus: string
  detail: string
  reading: string          // 当前正在读入的 docId（建索引阶段高亮）
  indexed: string[]         // 已建入索引的 docId
  index: IndexEntry[]       // 倒排索引（随读入累积）
  query: string[]           // 查询分词
  candidates: string[]      // 命中候选 docId
  idf: IdfRow[]             // 每个查询词的 df/idf
  scores: ScoreRow[]        // 打分结果（末步已按分降序）
  phase: 'run' | 'done'
  log: string
}
type Frame = Omit<SearchState, 'i'>

const DOCS: { id: string; text: string }[] = [
  { id: 'D1', text: '猫 爱 吃 鱼' },
  { id: 'D2', text: '狗 爱 吃 肉' },
  { id: 'D3', text: '猫 猫 玩 鱼' },
]
const QUERY = ['猫', '狗']

const tok = (s: string) => s.split(' ').filter(Boolean)
const r2 = (x: number) => Math.round(x * 100) / 100

// —— 从语料真算出倒排索引（term → docId → tf）——
function buildIndexUpTo(n: number): IndexEntry[] {
  const m = new Map<string, Map<string, number>>()
  for (let d = 0; d < n; d++) {
    const doc = DOCS[d]!
    for (const t of tok(doc.text)) {
      if (!m.has(t)) m.set(t, new Map())
      const inner = m.get(t)!
      inner.set(doc.id, (inner.get(doc.id) ?? 0) + 1)
    }
  }
  return [...m.entries()]
    .map(([term, inner]) => ({ term, postings: [...inner.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1) as Posting[] }))
    .sort((a, b) => b.postings.length - a.postings.length || (a.term < b.term ? -1 : 1))
}

export const minisearchKernel: Kernel<SearchState> = {
  kind: 'minisearch',
  compile(_doc: SimDocument): CompiledModel<SearchState> {
    const N = DOCS.length
    const fullIndex = buildIndexUpTo(N)
    const termOf = (t: string) => fullIndex.find(e => e.term === t)
    const dfOf = (t: string) => termOf(t)?.postings.length ?? 0
    const idfOf = (t: string) => Math.log(N / (dfOf(t) || 1))
    const tfOf = (t: string, id: string) => termOf(t)?.postings.find(p => p[0] === id)?.[1] ?? 0

    // 候选 = 任一查询词命中的文档并集
    const candSet = new Set<string>()
    for (const t of QUERY) for (const p of (termOf(t)?.postings ?? [])) candSet.add(p[0])
    const candidates = [...candSet].sort()

    const idfRows: IdfRow[] = QUERY.map(t => ({ term: t, df: dfOf(t), idf: idfOf(t) }))
    const scoreRows: ScoreRow[] = candidates.map(id => {
      let s = 0; const bits: string[] = []
      for (const t of QUERY) {
        const tf = tfOf(t, id); if (tf === 0) continue
        s += tf * idfOf(t)
        bits.push(`${t}:tf${tf}×idf${r2(idfOf(t))}`)
      }
      return { id, score: s, parts: bits.join(' + ') || '无命中' }
    }).sort((a, b) => b.score - a.score)

    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'log'> & { log: string }) => frames.push({ step: frames.length, ...f })
    const empty = { reading: '', indexed: [] as string[], index: [] as IndexEntry[], query: [] as string[], candidates: [] as string[], idf: [] as IdfRow[], scores: [] as ScoreRow[] }

    // f0 语料就位
    push({ ...empty, stage: '① 准备语料', focus: '三篇小文档', detail: '搜索引擎要在一批文档里找出和查询最相关的几篇。先看语料。',
      phase: 'run', log: `**① 准备语料**\n三篇文档：\n${DOCS.map(d => `${d.id}「${d.text}」`).join('\n')}\n目标：给一个查询，按相关度排序返回。` })

    // f1..f3 逐篇读入：分词 + 建倒排
    for (let d = 0; d < N; d++) {
      const doc = DOCS[d]!
      const idx = buildIndexUpTo(d + 1)
      push({ ...empty, stage: `② 建倒排索引`, focus: `读入 ${doc.id}`, detail: '',
        reading: doc.id, indexed: DOCS.slice(0, d + 1).map(x => x.id), index: idx,
        phase: 'run', log: `**② 建倒排索引 · 读入 ${doc.id}**\n分词：[${tok(doc.text).join(' , ')}]\n把每个词记进倒排表「词 → 出现在哪些文档(及词频)」。\n${doc.id === 'D3' ? '注意「猫」在 D3 出现 **2 次**，postings 记 tf=2。' : ''}` })
    }

    // f4 收到查询
    push({ ...empty, stage: '③ 收到查询', focus: `「${QUERY.join(' ')}」`, detail: '', index: fullIndex, indexed: DOCS.map(x => x.id), query: QUERY,
      phase: 'run', log: `**③ 收到查询**\n查询：「${QUERY.join(' ')}」→ 分词 [${QUERY.join(' , ')}]\n不再扫全部文档，直接查倒排表。` })

    // f5 取候选
    push({ ...empty, stage: '④ 查倒排取候选', focus: '并集命中', detail: '', index: fullIndex, indexed: DOCS.map(x => x.id), query: QUERY, candidates,
      phase: 'run', log: `**④ 查倒排取候选**\n猫 → {${(termOf('猫')?.postings ?? []).map(p => `${p[0]}×${p[1]}`).join(', ')}}\n狗 → {${(termOf('狗')?.postings ?? []).map(p => `${p[0]}×${p[1]}`).join(', ')}}\n候选 = 并集 = {${candidates.join(', ')}}（D2 只因含"狗"入选）。` })

    // f6 算 idf
    push({ ...empty, stage: '⑤ 算 idf', focus: '稀有词更值钱', detail: '', index: fullIndex, indexed: DOCS.map(x => x.id), query: QUERY, candidates, idf: idfRows,
      phase: 'run', log: `**⑤ 算 idf（逆文档频率）**\nidf = ln(N / df)，N=${N}。\n${idfRows.map(r => `idf(${r.term}) = ln(${N}/${r.df}) = **${r2(r.idf)}**`).join('\n')}\n"狗"只在 1 篇出现(df=1)→idf 高；"猫"在 2 篇→idf 低。**越稀有的词，越能区分相关性**。` })

    // f7 TF-IDF 打分
    push({ ...empty, stage: '⑥ TF-IDF 打分', focus: 'score = Σ tf × idf', detail: '', index: fullIndex, indexed: DOCS.map(x => x.id), query: QUERY, candidates, idf: idfRows, scores: scoreRows,
      phase: 'run', log: `**⑥ TF-IDF 打分**\nscore(文档) = Σ_查询词 tf(词,文档) × idf(词)\n${scoreRows.map(s => `${s.id}: ${s.parts} = **${r2(s.score)}**`).join('\n')}` })

    // f8 排序返回
    push({ ...empty, stage: '⑦ 排序返回', focus: '按分降序', detail: '', index: fullIndex, indexed: DOCS.map(x => x.id), query: QUERY, candidates, idf: idfRows, scores: scoreRows,
      phase: 'done', log: `**搜索完成**：按分降序返回 → ${scoreRows.map(s => `${s.id}(${r2(s.score)})`).join(' > ')}\n\n两个效应都看到了：\n· **D2 排第一**——它只含一个查询词"狗"，但"狗"稀有(idf 高)，稀有词命中更相关。\n· **D3 排在 D1 前**——都含"猫"，但"猫"在 D3 出现两次(tf=2)，词频高更相关。\n\n面试可讲：倒排索引让查询不用扫全库；TF-IDF 用「词频高更相关 + 稀有词更值钱」两条直觉打分。真实引擎(Lucene/ES)在此之上加 BM25、字段权重、向量召回。` })

    const base0: Frame = { step: -1, stage: '', focus: '', detail: '', ...empty, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '检索步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
