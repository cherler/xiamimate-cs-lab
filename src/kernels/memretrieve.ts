/**
 * 内核：记忆检索打分 Memory Retrieval Scoring —— agent 从一堆记忆里捞哪几条进上下文（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 一次检索逐格算：最近度 → 重要度 → 相关度 → 加权求分 → 排序取 top-k。
 *
 * agent 的长期记忆不是"grep 一下"，而是一套**打分检索**（Generative Agents 的经典做法）：
 *   查询来了，给每条记忆算三个信号，加权求和，排序，只把 **top-k** 捞进上下文。
 *   · **最近度 recency** = decay^龄（decay=0.995/小时）——越久越淡，指数衰减。
 *   · **重要度 importance** = LLM 给这条记忆打的 1~10 分 /10（"用户是 VIP"=9 vs "吃了早饭"=1）。
 *   · **相关度 relevance** = 记忆向量与查询向量的余弦。
 *   · **得分 = w_rec·最近度 + w_rel·相关度 + w_imp·重要度**，排序取 top-k。
 * 关键：**权重不同，捞回来的记忆不同**——论文说三者等权(1·1·1)，但 Generative Agents 的**代码**里是 (0.5·3·2)[最近·相关·重要]，相关度最重。切「权重」看排名怎么翻。
 * 三个信号、得分、排名都由引擎**现算**。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type WKey = '均衡' | '重相关' | '重时新'
type Mem = { id: string; text: string; ageH: number; importance: number; relevance: number }  // 固定输入
export type Scored = Mem & { recency: number; imp01: number; rel01: number; score: number; rank: number; retrieved: boolean }
export type MRState = {
  i: number
  step: number
  stage: 'intro' | 'signals' | 'score' | 'rank' | 'done'
  weights: WKey
  wr: number; wl: number; wi: number     // 权重：最近 / 相关 / 重要
  query: string
  topK: number
  decay: number
  mems: Scored[]                          // 当前帧展示顺序的记忆（rank 后为排序序）
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<MRState, 'i'>

const DECAY = 0.995
const TOPK = 3
const QUERY = '怎么修登录的 500 错误'
//  权重 [最近, 相关, 重要]。论文=等权 1/1/1；Generative Agents 代码=0.5/3/2(相关最重)。
const WEIGHTS: Record<WKey, [number, number, number]> = { 均衡: [1, 1, 1], 重相关: [0.5, 3, 2], 重时新: [3, 1, 1] }

//  agent 的记忆流（固定输入）：龄(小时)、重要度(1~10 LLM 打分)、对本次查询的相关度(余弦 0~1)。
const MEMS: Mem[] = [
  { id: 'm1', text: '用户上周报登录偶尔 500', ageH: 168, importance: 6, relevance: 0.90 },
  { id: 'm2', text: 'auth.py 用 JWT 鉴权', ageH: 720, importance: 7, relevance: 0.70 },
  { id: 'm3', text: '用户是付费 VIP', ageH: 24, importance: 9, relevance: 0.20 },
  { id: 'm4', text: '刚查日志：auth.py:42 有 NPE', ageH: 0.5, importance: 5, relevance: 0.88 },
  { id: 'm5', text: '用户偏好深色主题', ageH: 48, importance: 2, relevance: 0.05 },
  { id: 'm6', text: '上次部署在周五傍晚', ageH: 100, importance: 4, relevance: 0.35 },
]
const r2 = (x: number) => Math.round(x * 100) / 100

export const memretrieveKernel: Kernel<MRState> = {
  kind: 'memretrieve',
  compile(doc: SimDocument): CompiledModel<MRState> {
    const weights = (['均衡', '重相关', '重时新'] as WKey[]).includes(doc.params?.weights as WKey) ? doc.params!.weights as WKey : '均衡'
    const [wr, wl, wi] = WEIGHTS[weights]

    //  三信号 + 得分，全现算
    const scoredRaw = MEMS.map(m => {
      const recency = r2(Math.pow(DECAY, m.ageH))
      const imp01 = r2(m.importance / 10)
      const rel01 = m.relevance
      const score = r2(wr * recency + wl * rel01 + wi * imp01)
      return { ...m, recency, imp01, rel01, score, rank: 0, retrieved: false }
    })
    //  按得分排名（降序）
    const byScore = [...scoredRaw].sort((a, b) => b.score - a.score)
    byScore.forEach((m, idx) => { m.rank = idx + 1; m.retrieved = idx < TOPK })
    //  原序（intro/signals/score 用）与排序（rank/done 用）
    const orig = MEMS.map(m => scoredRaw.find(s => s.id === m.id)!)
    const sorted = byScore

    const frames: Frame[] = []
    const b0 = { weights, wr, wl, wi, query: QUERY, topK: TOPK, decay: DECAY, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; mems: Scored[]; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({ stage: 'intro', mems: orig, focus: `记忆流 ${MEMS.length} 条，查询「${QUERY}」来了——该捞哪几条进上下文？`,
      log: `**记忆检索打分：从一堆记忆里捞哪几条？**\nagent 的长期记忆一大堆，上下文塞不下全部——查询来了，得**只捞最该看的 top-${TOPK} 条**。怎么选？不是关键词匹配，是**打分**（Generative Agents 的经典做法）：给每条记忆算三个信号、加权求和、排序取 top-k。\n查询：「${QUERY}」。记忆流 ${MEMS.length} 条（带"龄"和 LLM 打的"重要度"）。下面逐格算。` })

    push({ stage: 'signals', mems: orig, focus: '算三信号：最近度=decay^龄、重要度=分/10、相关度=余弦',
      log: `**① 三个信号（每条记忆都算）**\n· **最近度 recency = decay^龄**（decay=${DECAY}/小时）：龄 0.5h→${r2(Math.pow(DECAY, 0.5))}，龄 720h→${r2(Math.pow(DECAY, 720))}。越久越淡、指数衰减。\n· **重要度 importance**：LLM 给这条记忆打的 1~10 分 /10（"用户是 VIP"=9、"深色主题"=2）。\n· **相关度 relevance**：记忆向量与查询向量的余弦（本例给定）。\n三列都填好了，注意它们各说各话：有的记忆很新但不相关、有的很重要但不相关。` })

    push({ stage: 'score', mems: orig, focus: `加权求分：得分 = ${wr}·最近 + ${wl}·相关 + ${wi}·重要（权重：${weights}）`,
      log: `**② 加权求分**\n得分 = **w_rec·最近度 + w_rel·相关度 + w_imp·重要度**。本次权重「${weights}」= 最近 **${wr}** · 相关 **${wl}** · 重要 **${wi}**。\n⚠️ 权重是关键旋钮：论文说三者**等权(1·1·1)**，但 Generative Agents 的**代码**里是 **(0.5·3·2)**——相关度最重。权重一变，谁被捞回来就变（下一步见）。` })

    push({ stage: 'rank', mems: sorted, focus: `排序取 top-${TOPK}：${sorted.slice(0, TOPK).map(m => m.id).join(' / ')} 被捞进上下文`,
      log: `**③ 排序，取 top-${TOPK}**\n按得分降序排，**只把前 ${TOPK} 条捞进上下文**，其余留在记忆库里（没删、只是这次没被选中）。\n本次（权重「${weights}」）捞回：**${sorted.slice(0, TOPK).map(m => `${m.text}(${m.score})`).join('、')}**。\n${sorted.find(m => m.id === 'm3')!.retrieved ? '注意 m3「用户是 VIP」被捞回了——它相关度只有 0.2，但重要度高(9)、又新，靠这两项挤进来。' : '注意 m3「用户是 VIP」这次没被捞回——它重要度虽高(9)，但相关度太低(0.2)，相关权重一大就落榜。'}` })

    const kept = sorted.filter(m => m.retrieved).map(m => m.text)
    push({ stage: 'done', mems: sorted, phase: 'done', focus: `完：top-${TOPK} 进上下文，换权重排名会翻`,
      log: `**捞回上下文的是：${kept.join(' / ')}**\n检索 = **最近度(decay^龄) + 重要度(LLM 1~10) + 相关度(余弦)** 加权排序取 top-k。三个要点：\n· **不是关键词匹配**，是三信号加权——所以"很重要但眼下不相关"的记忆(VIP)要不要捞回，全看权重。\n· **权重翻则排名翻**：论文等权 vs 代码(0.5·3·2 相关最重)差别很大；切「权重」参数亲眼看 m3 进/出。\n· **min-max 归一化**：Generative Agents 实际会把三列各自归一化到[0,1]再加权(本实验为看清直接用原值)。\n面试延伸：向量检索(embed→余弦 top-k)、稀疏(BM25)、混合+rerank；以及"捞回来的记忆会不会污染上下文"(检索不准就是在喂噪声)。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, mems: orig, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '检索步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
