/**
 * 内核：反思 / 巩固 Reflection —— 把一堆零散观察攒成高层洞察（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 观察累积 → 重要度攒够触发 → 提炼洞察(带证据) → 洞察成为新记忆(可再被反思=反思树)。
 *
 * Generative Agents 的洞察：光存原始观察不够——agent 得**定期把零散观察巩固成高层洞察**，不然只见树木不见森林。
 *   · **触发**：最近一批观察的**重要度之和**超过阈值(论文里约 150)就反思一次。
 *   · **反思**：让 LLM 就最近观察提出几个**最值得想的问题**，各自检索相关记忆、**综合出洞察(insight)**，并**引用证据**(哪几条观察支撑它)。
 *   · **入库**：洞察当成一条**新记忆**(高重要度)加进记忆流；洞察本身还能被更高层反思 → **反思树**。
 * 这就是"消化":raw 观察是叶子、洞察是往上长的节点。重要度累积、触发、证据引用都由引擎**现算**。切「阈值」看反思勤/懒。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type TKey = '敏感' | '默认' | '迟钝'
type Obs = { id: string; text: string; importance: number }
export type ObsRow = Obs & { cum: number; reflected: boolean }
export type Insight = { text: string; evidence: string[]; importance: number }
export type ReflState = {
  i: number
  step: number
  stage: 'intro' | 'observe' | 'trigger' | 'reflect' | 'done'
  thresholdKey: TKey
  threshold: number
  obs: ObsRow[]              // 观察流（带累计重要度）
  cum: number               // 距上次反思的累计重要度
  triggerAt: number         // 触发时的观察下标（0-based，-1=未触发）
  insight: Insight | null   // 提炼出的洞察
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<ReflState, 'i'>

const THRESH: Record<TKey, number> = { 敏感: 10, 默认: 15, 迟钝: 20 }
//  agent 一场会话里对用户的观察（固定输入），带 LLM 打的重要度 1~10。
const OBS: Obs[] = [
  { id: 'o1', text: '用户问 Python 装饰器怎么写', importance: 3 },
  { id: 'o2', text: '用户在调 Django 的 ORM', importance: 4 },
  { id: 'o3', text: '用户又问 asyncio 并发', importance: 4 },
  { id: 'o4', text: '用户说前端不熟、CSS 头疼', importance: 5 },
  { id: 'o5', text: '用户的报错都在后端服务', importance: 4 },
]

export const reflectionKernel: Kernel<ReflState> = {
  kind: 'reflection',
  compile(doc: SimDocument): CompiledModel<ReflState> {
    const thresholdKey = (['敏感', '默认', '迟钝'] as TKey[]).includes(doc.params?.threshold as TKey) ? doc.params!.threshold as TKey : '默认'
    const threshold = THRESH[thresholdKey]

    //  累计重要度，找触发点（首个 cum≥threshold 的下标）
    let run = 0, triggerAt = -1
    const rows: ObsRow[] = OBS.map((o, idx) => {
      run += o.importance
      if (triggerAt < 0 && run >= threshold) triggerAt = idx
      return { ...o, cum: run, reflected: false }
    })
    const evidence = rows.slice(0, triggerAt + 1)   // 触发前(含)的观察=被反思的证据
    evidence.forEach(r => (r.reflected = true))
    const cumAtTrigger = evidence.reduce((a, r) => a + r.importance, 0)
    //  洞察随证据集变（含"前端不熟"那条就多一句）
    const hasFE = evidence.some(r => r.id === 'o4')
    const insight: Insight = {
      text: `用户是**后端 Python 工程师**${hasFE ? '、不擅前端' : ''}`,
      evidence: evidence.map(r => r.id), importance: 8,
    }

    const frames: Frame[] = []
    const b0 = { thresholdKey, threshold, triggerAt, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; obs: ObsRow[]; cum: number; insight: Insight | null; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    const blank = OBS.map(o => ({ ...o, cum: 0, reflected: false }))
    push({ stage: 'intro', obs: blank, cum: 0, insight: null, focus: `攒够重要度就反思一次（阈值 ${threshold}，${thresholdKey}）`,
      log: `**反思 / 巩固：把零散观察攒成高层洞察**\n光存原始观察不够——一堆"用户问了X""用户在调Y"，只见树木不见森林。Agent 得**定期消化**：把最近的零散观察**巩固成高层洞察**。\n**触发**：最近观察的**重要度之和**超过阈值(论文约 150；本例阈值 **${threshold}**、${thresholdKey})就反思一次。看它怎么攒、怎么提炼。` })

    // 观察累积到触发点
    const upto = rows.map((r, idx) => idx <= triggerAt ? { ...r } : { ...r, cum: 0, reflected: false })
    push({ stage: 'observe', obs: upto, cum: cumAtTrigger, insight: null, focus: `观察陆续进来，重要度累积 → ${cumAtTrigger}（阈值 ${threshold}）`,
      log: `**① 观察累积**\n观察一条条进记忆流，每条带 LLM 打的重要度(1~10)。累计重要度：${evidence.map(r => `${r.id}(+${r.importance})`).join(' ')} = **${cumAtTrigger}**。\n到 ${evidence[evidence.length - 1]!.id} 时累计 ${cumAtTrigger} **≥ 阈值 ${threshold}**——该反思了。` })

    push({ stage: 'trigger', obs: upto, cum: cumAtTrigger, insight: null, focus: `累计 ${cumAtTrigger} ≥ ${threshold} → 触发反思`,
      log: `**② 触发反思**\n累计重要度 **${cumAtTrigger} ≥ 阈值 ${threshold}**——触发一次反思。(重要度低、琐碎的观察攒得慢，越重要越快触发消化。)` })

    push({ stage: 'reflect', obs: upto, cum: 0, insight, focus: `提炼洞察：${insight.text.replace(/\*/g, '')}（引用 ${insight.evidence.join('/')}）`,
      log: `**③ 提炼洞察（reflect）**\nLLM 就最近观察问"最值得想的问题是什么"，检索相关记忆、**综合出洞察**并**引用证据**：\n→ 「**${insight.text.replace(/\*/g, '')}**」，重要度 ${insight.importance}，证据：${insight.evidence.join('、')}。\n这条洞察**当成一条新记忆入库**(高重要度，以后更容易被检索到)；累计重要度**归零**，重新攒。` })

    push({ stage: 'done', obs: upto, cum: 0, insight, phase: 'done', focus: `完：${evidence.length} 条观察 → 1 条洞察，还能再往上反思`,
      log: `**巩固完成：${evidence.length} 条零散观察 → 1 条高层洞察**\n反思 = 定期把 raw 观察消化成 insight：\n· **触发**靠重要度累积过阈值(论文约 150)——琐事攒得慢、要事催得快。\n· **提炼**：LLM 综合观察成洞察 + **引用证据**(可追溯，不是凭空)。\n· **入库**：洞察是**高重要度的新记忆**，还能被更高层反思 → **反思树**(观察=叶、洞察=往上的节点)。\n和上下文压缩的摘要像但不同:压缩是为省 token 把最近的压掉;反思是为**长期理解**把零散的往上抽象。面试延伸:反思树深度、洞察引用证据=可解释、阈值调反思频率。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, obs: blank, cum: 0, insight: null, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '反思步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
