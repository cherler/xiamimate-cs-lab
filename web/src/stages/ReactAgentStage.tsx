/** 舞台：ReAct Agent —— Thought/Action/Observation 轨迹逐步累积，直到 Final Answer */
import type { ReactState } from '@engine/kernels/reactagent.ts'
import type { StageProps } from '../types.ts'

const ICON: Record<string, string> = { thought: '💭', action: '🔧', observation: '👀' }
const LABEL: Record<string, string> = { thought: 'Thought', action: 'Action', observation: 'Observation' }

export function ReactAgentStage({ state }: StageProps<ReactState>) {
  const { kind, round, text, tool, arg, obs, history, answer, phase } = state
  const done = phase === 'done'
  // 当前这一步（intro/answer 之外）也拼进展示
  const cur = kind === 'thought' ? { kind, text } : kind === 'action' ? { kind, text: `${tool}(${arg})`, tool } : kind === 'observation' ? { kind, text: obs } : null
  const rows = [...history, ...(cur && history.length < 11 && kind !== 'intro' && kind !== 'answer' ? [] : [])]
  // history 已包含到"上一步"；当前步单独高亮显示

  return (
    <div className="card">
      <h3>ReAct Agent 循环 <span className="hint">想→做(调工具)→看(结果)→再想…→答</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{kind === 'intro' ? '开始' : kind === 'answer' ? '作答' : `第 ${round} 轮`}</span><span className="scdl">进度</span></div>
          <div className="scdk"><span className="scdn">{kind === 'action' ? tool : kind === 'observation' ? '工具返回' : kind === 'thought' ? '推理' : '—'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">🔧 search · calc</span><span className="scdl">可用工具</span></div>
        </div>

        <div className="ra-q">❓ {'北京今天比上海热多少度？'}</div>

        <div className="ra-trace">
          {history.map((h, i) => (
            <div key={i} className={`ra-turn ${h.kind}`}>
              <span className="ra-tag">{ICON[h.kind]} {LABEL[h.kind]}</span>
              <span className="ra-txt">{h.text}</span>
            </div>
          ))}
          {cur && (
            <div className={`ra-turn ${cur.kind} now`}>
              <span className="ra-tag">{ICON[cur.kind]} {LABEL[cur.kind]}</span>
              <span className="ra-txt">{cur.text}</span>
            </div>
          )}
          {done && <div className="ra-answer">✅ Final Answer：{answer}</div>}
        </div>

        {done
          ? <p className="scnote">ReAct 让大模型<b>边想边做</b>：答不了就调工具、拿真结果、再继续想，整个轨迹拼进 prompt 保证每步有上下文——这就是 Agent 的骨架（LangChain/各种 Copilot 都基于它）。工程要点：工具怎么描述给模型（function schema）、循环怎么停（模型说 Final 或到步数上限）、观察到错误怎么重试、怎么防无限循环。面试讲：ReAct（提示范式）vs function calling（模型原生能力）、多步任务怎么拆、怎么防跑飞。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯轨迹一行行长出来：Thought 是模型在想、Action 是它决定调哪个工具、Observation 是工具返回的真实结果。下一轮的"想"看得到前面全部——所以能一步步逼近答案，而不是一口气瞎编。</p>}
      </div>
    </div>
  )
}
