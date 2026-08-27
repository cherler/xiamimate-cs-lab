/**
 * 内核：RAG 检索增强生成（大模型算法 · 原理：先按语义相似度检索资料、塞进上下文,再让模型据此作答)
 * 轴：step —— 把问题变成向量,和知识库里每篇文档的向量比**相似度**,取最相关的 top-k,拼进提示词,
 *      模型就"带着资料"回答——答案有出处、能更新、少编造(幻觉)。检索靠向量内积、和 k-NN/词向量一脉相承。
 *
 * 大模型的知识冻结在训练时的参数里:会过时、记不住私有资料、还爱一本正经地**编造**(幻觉)。**RAG** 给它外挂一个"开卷考试":
 * 把问题编码成**查询向量**,在向量化的**知识库**里按**相似度**(内积/余弦)检索出最相关的几篇,作为**上下文**塞进提示词,
 * 再让模型**据此作答**。于是答案**有据可查、可溯源、可随库更新**,不必重训模型。检索这一步就是**向量最近邻**——和词向量、k-NN 同源。
 *
 * 本实验:问"猫爱吃什么?",知识库 5 篇(猫/狗/汽车/植物…)。把问题和每篇比点积相似度:两篇讲猫吃的最高(0.9、0.74)被检索,
 * 无关的(汽车 0、植物 0.02)落选;top-2 拼进上下文,模型据此答出"肉和鱼"。相似度、检索结果都可手算核对。RAG 是问答、客服、搜索的主流范式。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Doc = { t: string; v: number[] }
const QUERY = { t: '猫爱吃什么?', v: [0.9, 0.1, 0] }
const DOCS: Doc[] = [
  { t: '猫是肉食动物，主食是肉和鱼', v: [1, 0, 0] },
  { t: '狗需要每天遛弯运动', v: [0.3, 0.7, 0] },
  { t: '汽车每 5000 公里保养一次', v: [0, 0, 1] },
  { t: '猫特别爱吃鱼、鸡肉', v: [0.8, 0.2, 0] },
  { t: '绿色植物靠光合作用产能', v: [0, 0.2, 0.9] },
]
const TOPK = 2
const r3 = (x: number) => Math.round(x * 1000) / 1000
const dot = (a: number[], b: number[]) => r3(a.reduce((s, x, i) => s + x * b[i], 0))

export type RagState = {
  i: number
  step: number
  query: string
  docs: { t: string; sim: number | null }[]
  stage: string                // 'query' | 'score' | 'retrieve' | 'augment' | 'done'
  topK: number
  retrieved: number[]          // 命中文档的原索引（按相似度降序）
  answer: string
  phase: 'run' | 'done'
  log: string
}

export const RAG_VISIBLE = [
  'step', 'query', 'docs', 'stage', 'topK', 'retrieved', 'answer', 'phase', 'log',
] as const

type Frame = Omit<RagState, 'i'>

export const ragKernel: Kernel<RagState> = {
  kind: 'rag',

  compile(_doc: SimDocument): CompiledModel<RagState> {
    const sims = DOCS.map(d => dot(QUERY.v, d.v))
    const order = DOCS.map((_, i) => i).sort((a, b) => sims[b] - sims[a])
    const retrieved = order.slice(0, TOPK)
    const answer = '肉和鱼（含鸡肉）'

    const docsNo = DOCS.map(d => ({ t: d.t, sim: null as number | null }))
    const docsScored = DOCS.map((d, i) => ({ t: d.t, sim: sims[i] }))

    const frames: Frame[] = [
      {
        step: 0, query: QUERY.t, docs: docsNo, stage: 'query', topK: TOPK, retrieved: [], answer: '', phase: 'run',
        log: `问题:「${QUERY.t}」。手头一个**知识库**(${DOCS.length} 篇:猫/狗/汽车/植物…)。RAG 不直接答,先去库里**找相关资料**。`,
      },
      {
        step: 1, query: QUERY.t, docs: docsScored, stage: 'score', topK: TOPK, retrieved: [], answer: '', phase: 'run',
        log: `把问题编码成**查询向量**,和每篇文档的向量算**相似度**(点积):讲"猫吃"的两篇最高(${sims[0]}、${sims[3]}),汽车(${sims[2]})、植物(${sims[4]})几乎为 0。`,
      },
      {
        step: 2, query: QUERY.t, docs: docsScored, stage: 'retrieve', topK: TOPK, retrieved, answer: '', phase: 'run',
        log: `**检索 top-${TOPK}**:取相似度最高的 ${TOPK} 篇 → 「${DOCS[retrieved[0]].t}」(${sims[retrieved[0]]})、「${DOCS[retrieved[1]].t}」(${sims[retrieved[1]]})。无关的丢掉。这一步就是**向量最近邻**。`,
      },
      {
        step: 3, query: QUERY.t, docs: docsScored, stage: 'augment', topK: TOPK, retrieved, answer: '', phase: 'run',
        log: `**增强**:把检索到的 ${TOPK} 篇拼进提示词当**上下文**——「已知:${DOCS[retrieved[0]].t};${DOCS[retrieved[1]].t}。问:${QUERY.t}」。模型开卷作答。`,
      },
      {
        step: 4, query: QUERY.t, docs: docsScored, stage: 'done', topK: TOPK, retrieved, answer, phase: 'done',
        log: `**据此作答**:「${answer}」——答案<b>有出处</b>(来自检索到的两篇)、不靠模型瞎记。RAG=把冻结在参数里的知识换成"开卷考试":检索(向量最近邻)+ 增强上下文 + 生成。` +
          `好处:知识可随库更新、可溯源、少幻觉,不用重训模型。是问答、客服、企业搜索的主流范式;检索质量决定上限,常配重排序、切块等技巧。`,
      },
    ]

    const base0: Frame = {
      step: -1, query: QUERY.t, docs: docsNo, stage: '', topK: TOPK, retrieved: [], answer: '', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '检索→增强→生成' },
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
