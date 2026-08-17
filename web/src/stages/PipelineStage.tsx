/** 舞台：流水线时空图 —— 教材上那张 IF/ID/EX/MEM/WB 表 */
import type { PipeState } from '@engine/kernels/pipeline.ts'
import { STAGES } from '@engine/kernels/pipeline.ts'
import type { StageProps } from '../types.ts'

const TONE: Record<string, string> = {
  IF: 'if', ID: 'id', EX: 'ex', MEM: 'mem', WB: 'wb',
}

export function PipelineStage({ doc, trace, index, state, tab }: StageProps<PipeState>) {
  const ids = doc.entities.filter(e => e.type === 'inst').map(e => e.id)
  if (tab === 'now') return <Now doc={doc} state={state} />
  return <Chart doc={doc} trace={trace} index={index} ids={ids} />
}

/**
 * 时空图：行 = 指令，列 = 时钟周期。
 * 停顿画成灰色气泡格，被冲刷的画成红叉 —— 这两样才是这张图的看点。
 */
function Chart({ doc, trace, index, ids }: {
  doc: StageProps<PipeState>['doc']; trace: PipeState[]; index: number; ids: string[]
}) {
  const insts = doc.entities.filter(e => e.type === 'inst')
  return (
    <div className="card">
      <h3>时空图 <span className="hint">行 = 指令 · 列 = 时钟周期</span></h3>
      <div className="body scroll">
        <table className="ptab pipe">
          <thead>
            <tr>
              <th>指令</th>
              {trace.map(s => (
                <th key={s.cycle} className={s.i === index ? 'cur' : s.i > index ? 'future' : ''}>
                  {s.cycle}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {insts.map(e => (
              <tr key={e.id}>
                <th title={`${e.attrs.op} ${e.attrs.rd || ''} ${e.attrs.rs || ''} ${e.attrs.rt || ''}`}>
                  {e.id}<em>{String(e.attrs.op)}</em>
                </th>
                {trace.map((s, ci) => {
                  const at = s.at[e.id]
                  const prev = ci > 0 ? trace[ci - 1].at[e.id] : '-'
                  /**
                   * 气泡的定义就是"这一拍没往前挪"——
                   * 所以判据写在"与上一拍同段"上，而不是只看内核报了谁 stalled。
                   * 第一版把停顿格画成 ⋯，反而看不出卡在哪一段，
                   * 而后面那些被连累停在 IF 的又照常显示段名，两种画法自相矛盾。
                   */
                  const bubble = at !== '-' && at === prev
                  const flushed = s.flushed.includes(e.id)
                  const fwd = s.forwards[e.id]
                  const cls = [
                    at && at !== '-' ? TONE[at] : '',
                    s.i > index ? 'future' : '',
                    s.i === index ? 'cur' : '',
                    bubble ? 'stall' : '', flushed ? 'flush' : '', fwd ? 'fwd' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <td key={s.cycle} className={cls}
                        title={flushed ? '被分支冲刷'
                          : bubble ? `停顿：仍卡在 ${at} 段`
                          : fwd || at}>
                      {flushed ? '✕' : at === '-' ? '' : at}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="plegend">
          {STAGES.map(s => <span key={s}><i className={`pw ${TONE[s]}`} />{s}</span>)}
          <span><i className="pw stall" />气泡（这一拍没往前挪）</span>
          <span><i className="pw flush" />被冲刷</span>
        </div>
        <p className="tnote">
          无相关时 n 条指令跑完 = 段数 + (n−1)。每多一个气泡就多一个周期 ——
          这张表右边界往右挪多少，代价就是多少。
        </p>
      </div>
    </div>
  )
}

/** 本周期快照：五个段里各站着谁 */
function Now({ doc, state }: { doc: StageProps<PipeState>['doc']; state: PipeState }) {
  const inv: Record<string, string> = {}
  for (const [id, st] of Object.entries(state.at)) if (st && st !== '-') inv[st] = id
  return (
    <div className="card">
      <h3>本周期 <span className="hint">第 {state.cycle} 周期，五个段里各站着谁</span></h3>
      <div className="body">
        <div className="pstages">
          {STAGES.map(st => (
            <div key={st} className={`pstage ${inv[st] ? TONE[st] : 'empty'}`}>
              <span className="sn">{st}</span>
              <b>{inv[st] ?? '空'}</b>
            </div>
          ))}
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">已完成</span><span className="v">{state.done} 条</span></div>
          <div className="pr"><span className="k">本周期停顿</span>
            <span className="v">{state.stalled.length ? state.stalled.join('、') : '无'}</span></div>
          <div className="pr"><span className="k">本周期前递</span>
            <span className="v">{Object.values(state.forwards).join('；') || '无'}</span></div>
          <div className="pr"><span className="k">本周期冲刷</span>
            <span className="v">{state.flushed.length ? state.flushed.join('、') : '无'}</span></div>
        </div>
      </div>
    </div>
  )
}
