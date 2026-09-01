/** 舞台：工具调用 —— 4 段流水线(解析→门禁→执行→回灌)逐调用点亮 + 调用/结果历史配对累积 */
import type { ToolCallState, Pipe } from '@engine/kernels/toolcall.ts'
import type { StageProps } from '../types.ts'

const STAGES: [string, keyof Pipe][] = [['解析', 'parse'], ['门禁', 'guard'], ['执行', 'exec'], ['回灌', 'inject']]
const OUT_BADGE: Record<string, string> = { ok: '✅ 成功', denied: '⛔ 拒绝', unknown: '❓ 未知工具', malformed: '💥 解析失败' }

export function ToolCallStage({ state }: StageProps<ToolCallState>) {
  const { stage, cur, call, pipe, outcome, history, total } = state
  const emit = cur < 0

  return (
    <div className="card">
      <h3>工具调用 <span className="hint">解析→门禁→执行→回灌；错了不崩循环</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{emit ? '发出' : `${cur + 1}/${total}`}</span><span className="scdl">处理进度</span></div>
          <div className="scdk"><span className={`scdn ${outcome === 'ok' ? '' : outcome === '—' ? '' : 'hot'}`}>{emit ? '—' : (OUT_BADGE[outcome] ?? outcome)}</span><span className="scdl">本调用结局</span></div>
          <div className="scdk"><span className="scdn">{history.filter(h => h.ok).length}✓ / {history.filter(h => !h.ok).length}✗</span><span className="scdl">已回灌</span></div>
        </div>

        {/* 4 段流水线：当前调用走到哪、卡在哪 */}
        {!emit && (
          <div className="tc-pipe">
            {STAGES.map(([label, key], idx) => (
              <div key={key} className={`tc-st ${pipe[key]}`}>
                <span className="tc-sic">{pipe[key] === 'pass' ? '✓' : pipe[key] === 'fail' ? '✗' : '·'}</span>
                <span className="tc-slb">{label}</span>
                {idx < 3 && <span className="tc-arrow">→</span>}
              </div>
            ))}
          </div>
        )}

        {emit
          ? (
            <div className="tc-batch">
              <div className="tc-batch-h">模型这一轮发出 {total} 个工具调用：</div>
              <div className="tc-raw">{'read_file · calc · run_shell · web_serch · calc(截断)'}</div>
              <div className="tc-enc">⚠️ 都用 JSON，但工具调用<b>不一定是 JSON</b>：Codex 的 <code>apply_patch</code> 是自由文本、Aider 用文本 diff、有的用 XML 标签——为了<b>模型无关</b>+避开「JSON 里塞代码」的转义地狱。</div>
            </div>
          ) : call && (
            <div className={`tc-cur ${outcome}`}>
              <div className="tc-cur-raw"><span className="tc-enc-tag">{call.enc}</span><code>{call.raw}</code></div>
              <div className="tc-cur-parsed">
                {outcome === 'malformed'
                  ? <span className="tc-bad">解析失败：JSON 截断，取不出 name/args</span>
                  : <>工具 <b>{call.name}</b> · 参数 <b>{call.args}</b> · <span className={`tc-badge ${outcome}`}>{OUT_BADGE[outcome]}</span></>}
              </div>
            </div>
          )}

        {/* 历史：调用/结果配对累积（错误也是一条结果，红色标出）*/}
        <div className="tc-hist">
          <div className="tc-hist-h">回灌给模型的历史（每条结果配对它的调用）：</div>
          {history.length === 0
            ? <div className="tc-empty">还没有——processing 后逐条出现</div>
            : history.map((h, i) => (
              <div key={i} className={`tc-hi ${h.ok ? 'ok' : 'err'}`}>
                <span className="tc-hi-k">{h.ok ? 'tool_result' : 'error'}</span>
                <span className="tc-hi-n">{h.name}</span>
                <span className="tc-hi-t">{h.text}</span>
              </div>
            ))}
        </div>

        {stage === 'done'
          ? <p className="scnote"><b>{total} 个调用：{history.filter(h => h.ok).length} 成 / {history.filter(h => !h.ok).length} 败，但没有一个抛异常终止循环</b>——失败(拒绝/未知/解析错)全变成一条 error 结果喂回，模型能重试/换招。两个工程点：<b>配对</b>（每条结果带 call_id 喂回，别拆）；<b>并行 vs 独占</b>（只读/独立的可并行，写/shell 必须独占排队）。这套解析→门禁→执行→回灌是确定性流水线——模型只管"发"，怎么"接"是 harness 的功夫。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
