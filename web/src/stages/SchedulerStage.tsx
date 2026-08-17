/** 舞台：进程调度 —— 甘特图 / 就绪队列 */
import type { SchedState } from '@engine/kernels/scheduler.ts'
import type { StageProps } from '../types.ts'

const HUES = ['#5B7FD4', '#45B39A', '#9B6FCC', '#E2884A', '#4E9FBF', '#C7658F']

export function SchedulerStage({ doc, trace, index, state, tab }: StageProps<SchedState>) {
  const procs = doc.entities.filter(e => e.type === 'process')
  const color = (id: string) => HUES[procs.findIndex(p => p.id === id) % HUES.length]

  if (tab === 'queue') return <Queue state={state} procs={procs} color={color} />
  return <Gantt trace={trace} index={index} procs={procs} color={color} />
}

// ═══ 甘特图 ════════════════════════════════════════════
function Gantt({ trace, index, procs, color }: {
  trace: SchedState[]; index: number
  procs: { id: string }[]; color: (id: string) => string
}) {
  return (
    <div className="card">
      <h3>甘特图 <span className="hint">每格一个时间单位</span></h3>
      <div className="body">
        <div className="gantt">
          {procs.map(p => (
            <div className="gline" key={p.id}>
              <div className="glbl" style={{ color: color(p.id) }}>{p.id}</div>
              <div className="gcells">
                {trace.map((s, i) => {
                  const running = s.running === p.id
                  const ready = s.readyQueue.includes(p.id)
                  const done = s.completed.includes(p.id)
                  const cls = running ? 'run' : ready ? 'wait' : done ? 'done' : 'idle'
                  return (
                    <div
                      key={i}
                      className={`gcell ${cls} ${i === index ? 'cur' : ''}`}
                      style={running ? { background: color(p.id) } : undefined}
                      title={`t=${s.t} ${running ? '运行' : ready ? '就绪等待' : done ? '已完成' : '未到达'}`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
          <div className="gline gaxis">
            <div className="glbl" />
            <div className="gcells">
              {trace.map((s, i) => (
                <div key={i} className={`gtick ${i === index ? 'cur' : ''}`}>
                  {(s.t % 5 === 0 || i === index) ? s.t : ''}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="legend">
          <span><i className="run" />运行</span>
          <span><i className="wait" />就绪等待</span>
          <span><i className="done" />已完成</span>
          <span><i className="idle" />未到达</span>
        </div>
      </div>
    </div>
  )
}

// ═══ 就绪队列 ══════════════════════════════════════════
function Queue({ state, procs, color }: {
  state: SchedState; procs: { id: string }[]; color: (id: string) => string
}) {
  return (
    <div className="card">
      <h3>本时刻的队列状态 <span className="hint">t = {state.t}</span></h3>
      <div className="body queue">
        <div className="qbox">
          <div className="qt">CPU</div>
          {state.running
            ? <div className="qchip run" style={{ borderColor: color(state.running), color: color(state.running) }}>
                {state.running}<em>剩 {state.remaining[state.running]}</em>
              </div>
            : <div className="qempty">空闲</div>}
        </div>

        <div className="qbox">
          <div className="qt">就绪队列</div>
          {state.readyQueue.length
            ? <div className="qrow">
                {state.readyQueue.map(id => (
                  <div className="qchip" key={id} style={{ borderColor: color(id), color: color(id) }}>
                    {id}<em>剩 {state.remaining[id]}</em>
                  </div>
                ))}
              </div>
            : <div className="qempty">空</div>}
        </div>

        <div className="qbox">
          <div className="qt">已完成</div>
          {state.completed.length
            ? <div className="qrow">
                {state.completed.map(id => (
                  <div className="qchip done" key={id}>{id}</div>
                ))}
              </div>
            : <div className="qempty">无</div>}
        </div>

        <div className="qbox">
          <div className="qt">未到达</div>
          {(() => {
            const rest = procs.filter(p =>
              p.id !== state.running &&
              !state.readyQueue.includes(p.id) &&
              !state.completed.includes(p.id))
            return rest.length
              ? <div className="qrow">{rest.map(p => <div className="qchip idle" key={p.id}>{p.id}</div>)}</div>
              : <div className="qempty">无</div>
          })()}
        </div>
      </div>
    </div>
  )
}
