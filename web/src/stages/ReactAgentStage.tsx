/** 舞台：Agent 主循环 · 防死循环 —— 循环轨迹 + 步数预算条 + stuck 窗口 + 终止横幅 */
import type { ReactState } from '@engine/kernels/reactagent.ts'
import type { StageProps } from '../types.ts'

const ICON: Record<string, string> = { thought: '💭', action: '🔧', observation: '👀', answer: '✅', error: '🛑', halt: '🛑' }
const LABEL: Record<string, string> = { thought: 'Thought', action: 'Action', observation: 'Observation', answer: 'Answer', error: '异常', halt: '停' }
const HALT_TXT: Record<string, string> = { answer: '✅ 正常终止：模型不再发工具调用', stuck: '🛑 陷入重复：stuck 检测中止（最近 3 步动作相同）', budget: '🛑 超预算：走满步数上限，交 best-effort', error: '🛑 出错：autosubmit 交一版当前最好结果' }

export function ReactAgentStage({ state }: StageProps<ReactState>) {
  const { scenario, history, stepCount, budget, recent, halt, kind } = state
  const win = recent.slice(-3)
  const allSame = win.length === 3 && win.every(a => a === win[0])
  const pct = Math.min(100, (stepCount / budget) * 100)

  return (
    <div className="card">
      <h3>Agent 主循环 · 防死循环 <span className="hint">想→做→看，难在正确地停</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{scenario}</span><span className="scdl">场景</span></div>
          <div className="scdk"><span className={`scdn ${stepCount >= budget ? 'hot' : ''}`}>{stepCount}<em className="cc-u">/{budget}</em></span><span className="scdl">步数 / 预算</span></div>
          <div className="scdk"><span className={`scdn ${halt && halt !== 'answer' ? 'hot' : ''}`}>{halt ? (halt === 'answer' ? '正常' : halt === 'stuck' ? '重复' : halt === 'budget' ? '超预算' : '出错') : '运行中'}</span><span className="scdl">终止</span></div>
        </div>

        {/* 控制条：步数预算 + stuck 窗口 */}
        <div className="ra-ctrl">
          <div className="ra-budget">
            <span className="ra-cl">步数预算</span>
            <div className="ra-bbar"><div className={`ra-bfill ${stepCount >= budget ? 'over' : ''}`} style={{ width: `${pct}%` }} /></div>
            <span className="ra-cv">{stepCount}/{budget}</span>
          </div>
          <div className="ra-stuck">
            <span className="ra-cl">stuck 窗口（最近 3 步动作）</span>
            <span className={`ra-swin ${allSame ? 'same' : ''}`}>{win.length ? win.map((a, i) => <code key={i}>{a}</code>) : <em>—</em>}{allSame && <b> 全相同！</b>}</span>
          </div>
        </div>

        <div className="ra-trace">
          {history.map((h, i) => (
            <div key={i} className={`ra-turn ${h.kind} ${h.bad ? 'bad' : ''}`}>
              <span className="ra-tag">{ICON[h.kind]} {LABEL[h.kind]}</span>
              <span className="ra-txt">{h.text}</span>
            </div>
          ))}
        </div>

        {halt && (kind === 'halt' || kind === 'answer') && <div className={`ra-halt ${halt}`}>{HALT_TXT[halt]}</div>}

        {halt
          ? <p className="scnote">主循环难在<b>正确地停</b>。四条路：<b>正常</b>(模型不再发工具)、<b>重复</b>(stuck 检测:最近几步动作相同就中止)、<b>超预算</b>(步数/成本上限、交 best-effort)、<b>出错</b>(autosubmit 交一版、别白跑)。step=一次模型请求+工具，turn=零或多个 step。Codex/DeepSeek 无硬 turn 上限、靠压缩+stuck 兜底；SWE-agent/OpenHands 有 max_iterations 硬上限。切「场景」看另外三条。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯着步数条和 stuck 窗口——循环会不会跑飞，就看这两个控件拦不拦得住。</p>}
      </div>
    </div>
  )
}
