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
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/*  语义坐标就四维：[讲猫, 讲企鹅, 讲"吃/食物", 讲"作息/行为"]。
    维度取得这么少是**故意的**：相似度要能一眼手算核对。
    每篇文档另外标一个 answers —— 它到底**能不能回答**哪个问题。
    ⚠️ 这一项是补厚的关键：相似度高 ≠ 能回答。检索是按"像不像"排的，
    而"像"和"有答案"是两件事，这一屏就是要把它们分开。 */
type Doc = { t: string; v: number[]; answers: string[] }
type Q = { id: string; t: string; v: number[] }

const QUERIES: Record<string, Q> = {
  '猫爱吃什么？（库里有答案）': { id: 'eat', t: '猫爱吃什么？', v: [1, 0, 1, 0] },
  '企鹅爱吃什么？（库里没有）': { id: 'peng', t: '企鹅爱吃什么？', v: [0, 1, 1, 0] },
  /*  ⚠️ 这一问的向量是**调过**的：第一版 [1,0,0,1] 让答案那篇稳居第一，
      于是"干扰项"根本没干扰到谁，"k 太小会漏"也演不出来。
      改成 [1,0,0,0.3]（问题主要是在问"猫"，"半夜叫"只占一点权重）之后，
      两篇讲猫但答非所问的文档相似度反而更高，**含答案的那篇掉到第 3** —— 这才是真实情形。 */
  '猫为什么半夜叫？（有干扰项）': { id: 'night', t: '猫为什么半夜叫？', v: [1, 0, 0, 0.3] },
}

const DOCS: Doc[] = [
  { t: '猫是肉食动物，主食是肉和鱼', v: [1, 0, 1, 0], answers: ['eat'] },
  //  这篇是 night 的答案，但它讲的是"作息"，"猫"这一维的权重不高 —— 所以相似度排不到前面
  { t: '猫在夜间活跃，属于晨昏性动物', v: [0.5, 0, 0, 1], answers: ['night'] },
  { t: '猫的平均寿命约 15 年', v: [1, 0, 0, 0], answers: [] },        // 讲猫，但什么都答不了 —— 干扰项
  { t: '狗需要每天遛弯运动', v: [0.2, 0, 0, 0.6], answers: [] },
  { t: '鱼类富含蛋白质', v: [0, 0, 0.7, 0], answers: [] },
  { t: '绿色植物靠光合作用产能', v: [0, 0, 0.3, 0], answers: [] },
  { t: '汽车每 5000 公里保养一次', v: [0, 0, 0, 0], answers: [] },
]
const r3 = (x: number) => Math.round(x * 1000) / 1000
const dot = (a: number[], b: number[]) => r3(a.reduce((s, x, i) => s + x * b[i], 0))

export type RagState = {
  i: number
  step: number
  query: string
  docs: { t: string; sim: number | null; isAnswer: boolean }[]
  stage: string
  topK: number
  retrieved: number[]
  answer: string
  //  ── 补厚 ──
  qTag: string
  hit: boolean               // 检索到的里面**有没有**真正含答案的那篇
  hasAnswerInKb: boolean     // 知识库里到底有没有答案
  honest: string             // 模型的脾气：没依据时老实说不知道，还是照着资料硬答
  hallucinated: boolean      // 没命中却给了肯定答案 = 幻觉
  answerRank: number         // 含答案那篇排到第几（-1=库里就没有）
  maxSim: number
  phase: 'run' | 'done'
  log: string
}

export const RAG_VISIBLE = [
  'step', 'query', 'docs', 'stage', 'topK', 'retrieved', 'answer',
  'qTag', 'hit', 'hasAnswerInKb', 'honest', 'hallucinated', 'answerRank', 'maxSim', 'phase', 'log',
] as const

type Frame = Omit<RagState, 'i'>

export const ragKernel: Kernel<RagState> = {
  kind: 'rag',

  compile(doc: SimDocument): CompiledModel<RagState> {
    const qTag = doc.params.q === undefined ? '猫爱吃什么？（库里有答案）' : str(doc.params, 'q')
    const TOPK = doc.params.topk === undefined ? 2 : num(doc.params, 'topk')
    const honest = doc.params.honest === undefined ? '老实（没依据就说不知道）' : str(doc.params, 'honest')
    const Q = QUERIES[qTag] ?? QUERIES['猫爱吃什么？（库里有答案）']

    const sims = DOCS.map(d => dot(Q.v, d.v))
    const order = DOCS.map((_, i2) => i2).sort((a, b) => sims[b] - sims[a])
    const retrieved = order.slice(0, TOPK)

    const answerDocs = DOCS.map((d, i2) => (d.answers.includes(Q.id) ? i2 : -1)).filter(i2 => i2 >= 0)
    const hasAnswerInKb = answerDocs.length > 0
    const hit = retrieved.some(i2 => DOCS[i2].answers.includes(Q.id))
    //  含答案那篇在检索排序里排第几（1-based）；库里没有就是 -1
    const answerRank = hasAnswerInKb ? order.findIndex(i2 => DOCS[i2].answers.includes(Q.id)) + 1 : -1
    const maxSim = sims[order[0]]

    const isHonest = honest.startsWith('老实')
    //  据此作答：命中就有依据；没命中时，老实的说不知道、爱编的照着最像那篇硬答
    const ANSWERS: Record<string, string> = { eat: '肉和鱼', night: '它是晨昏性动物，夜里本来就活跃' }
    const FABRICATED: Record<string, string> = {
      eat: '肉和鱼', peng: '肉和鱼', night: '大概是饿了吧',
    }
    const answer = hit ? ANSWERS[Q.id]
      : isHonest ? '资料里没有提到，我不知道'
        : FABRICATED[Q.id]
    const hallucinated = !hit && !isHonest

    const docsNo = DOCS.map(d => ({ t: d.t, sim: null as number | null, isAnswer: d.answers.includes(Q.id) }))
    const docsScored = DOCS.map((d, i2) => ({ t: d.t, sim: sims[i2], isAnswer: d.answers.includes(Q.id) }))
    const common = { query: Q.t, topK: TOPK, qTag, hit, hasAnswerInKb, honest, hallucinated, answerRank, maxSim }
    const nameOf = (i2: number) => `「${DOCS[i2].t}」(${sims[i2]})`

    const frames: Frame[] = [
      {
        step: 0, ...common, docs: docsNo, stage: 'query', retrieved: [], answer: '', phase: 'run',
        log: `问题：「**${Q.t}**」。手头一个 ${DOCS.length} 篇的**知识库**。RAG 不直接答，先去库里**找相关资料**。`
          + (hasAnswerInKb ? `　（这一档库里**确实有**能回答它的文档。）`
            : `　⚠️ （这一档库里**根本没有**能回答它的文档 —— 但检索照样会给你几篇，看它给什么。）`),
      },
      {
        step: 1, ...common, docs: docsScored, stage: 'score', retrieved: [], answer: '', phase: 'run',
        log: `把问题编码成**查询向量**，跟每篇文档算**相似度**（点积，四维语义坐标，可手算）：`
          + `最高的是 ${nameOf(order[0])}，最低几篇几乎为 0。`
          + `　⚠️ 注意相似度排的是"**像不像**"，不是"**有没有答案**" —— 这两件事马上就要分家。`,
      },
      {
        step: 2, ...common, docs: docsScored, stage: 'retrieve', retrieved, answer: '', phase: 'run',
        log: `**检索 top-${TOPK}**：取相似度最高的 ${TOPK} 篇 → ${retrieved.map(nameOf).join('、')}。`
          + (hit ? `　其中**含答案的那篇进来了**（它排第 ${answerRank}）。`
            : hasAnswerInKb
              ? `　⚠️ **含答案的那篇没进来** —— 它排第 ${answerRank}，被 top-${TOPK} 卡在外面了。把 k 调大试试。`
              : `　⚠️ **这几篇一个能答的都没有** —— 可检索**照样给了你 ${TOPK} 篇**。`
                + `**检索永远有输出，它不会说"我没有"，只会给你最像的。**`),
      },
      {
        step: 3, ...common, docs: docsScored, stage: 'augment', retrieved, answer: '', phase: 'run',
        log: `**增强**：把这 ${TOPK} 篇拼进提示词当上下文 —— 「已知：${retrieved.map(i2 => DOCS[i2].t).join('；')}。问：${Q.t}」。`
          + `模型开卷作答。`
          + (hit ? `` : `　⚠️ 但这份"已知"里**没有答案**。接下来就看模型的脾气了。`),
      },
      {
        step: 4, ...common, docs: docsScored, stage: 'done', retrieved, answer, phase: 'done',
        log: hit
          ? `**据此作答**：「**${answer}**」—— 答案**有出处**（来自检索到的那篇），不靠模型瞎记。`
            + `　RAG = 把冻结在参数里的知识换成"开卷考试"：检索（向量最近邻）+ 增强上下文 + 生成。`
            + `知识可随库更新、可溯源、少幻觉，不用重训模型。`
            + `　⚠️ 但它的上限**卡在检索这一步**。把「问题」换成另外两档看看会怎样。`
          : hallucinated
            ? `**据此作答**：「**${answer}**」—— ⚠️ **这是编的。**`
              + `检索到的 ${TOPK} 篇里没有一篇能回答这个问题，模型却照着最像的那篇给了个肯定答案。`
              + `　这就是 RAG 最典型的失败：**检索错了，答案一定错，而且错得理直气壮**（它还带着"出处"）。`
              + (hasAnswerInKb
                ? `　这一档的答案**其实在库里**（排第 ${answerRank}），只是被 top-${TOPK} 挡在外面 —— 把 k 调大就能救。`
                : `　这一档的答案**根本不在库里** —— 调 k 也没用，得先把资料补上。`
                  + `**RAG 不能凭空变出知识，它只能把已有的资料递给模型。**`)
            : `**据此作答**：「**${answer}**」—— 模型老实交代了。`
              + `　检索到的 ${TOPK} 篇里没有能回答这个问题的，它就没硬答。`
              + `**这是对的行为，但注意：能不能做到这一点，取决于模型的脾气（和提示词），不取决于 RAG 本身。**`
              + `　把「模型脾气」拨到"爱编"，同样的检索结果会得出一个理直气壮的错答案。`
              + (hasAnswerInKb ? `　另外这一档的答案其实在库里（排第 ${answerRank}），把 k 调大就能捞回来。` : ''),
      },
    ]

    const base0: Frame = {
      step: -1, ...common, docs: docsNo, stage: '', retrieved: [], answer: '', phase: 'run', log: '',
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
