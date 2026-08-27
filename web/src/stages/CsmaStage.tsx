/** 舞台：CSMA/CD —— 时隙图 + 退避表 */
import type { CsmaState } from '@engine/kernels/csma.ts'
import type { StageProps } from '../types.ts'

export function CsmaStage({ doc, trace, index, state, tab }: StageProps<CsmaState>) {
  const stations = doc.entities.filter(e => e.type === 'station').map(e => e.id)
  if (tab === 'backoff') return <Backoff trace={trace} index={index} state={state} stations={stations} />
  return <Slots trace={trace} index={index} state={state} stations={stations} />
}

/** 时隙图：哪个站在哪个争用期发了、撞没撞 */
function Slots({ trace, index, state, stations }: {
  trace: CsmaState[]; index: number; state: CsmaState; stations: string[]
}) {
  const slots = trace.filter(s => s.slot > 0)
  return (
    <div className="card">
      <h3>争用期时隙图 <span className="hint">行 = 站 · 列 = 争用期（2τ）</span></h3>
      <div className="body scroll">
        <table className="ptab csma">
          <thead>
            <tr><th>站</th>{slots.map(s => (
              <th key={s.i} className={s.i === index ? 'cur' : s.i > index ? 'future' : ''}>{s.slot}</th>
            ))}</tr>
          </thead>
          <tbody>
            {stations.map(st => (
              <tr key={st}>
                <th>{st}</th>
                {slots.map(s => {
                  /*  ⚠️ 还没走到的争用期：**格子留空**，不是"画出来再调暗"。
                      原来给未来格打 `future`（opacity .34）——可 34% 的 ✕/✓ 照样看得清清楚楚，
                      第 1 步就知道哪一列会冲突、哪一列会成功，旁边讲解却还在一步步推。
                      列本身保留（表格宽度不跳），只是内容还没长出来。 */
                  const future = s.i > index
                  const sending = !future && s.sending.includes(st)
                  const waiting = !future && s.backoff[st] > 0
                  const cls = [
                    sending ? (s.collision ? 'coll' : 'okslot') : '',
                    waiting ? 'wait' : '',
                    future ? 'future' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <td key={s.i} className={cls} title={future ? '' : (s.picked[st] ?? '')}>
                      {sending ? (s.collision ? '✕' : '✓') : waiting ? '·' : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="cslegend">
          <span><i className="csw coll" />冲突</span>
          <span><i className="csw okslot" />发送成功</span>
          <span><i className="csw wait" />退避中</span>
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 退避表：二进制指数退避的每一次取值 */
function Backoff({ trace, index, state, stations }: {
  trace: CsmaState[]; index: number; state: CsmaState; stations: string[]
}) {
  /*  只列**已经发生过**的冲突。原来把整条 trace 里的冲突全列出来（未来的调暗），
      等于开局就告诉用户"第 3、第 5 个争用期会撞" —— 而这张表的意义正是
      "撞一次、退避范围翻一倍"这个过程。下面那个「还没有发生冲突」空态本来就有，
      现在它在开局真的会出现了。 */
  const colls = trace.filter(s => s.collision && s.i <= index)
  return (
    <div className="card">
      <h3>二进制指数退避 <span className="hint">第 n 次冲突从 {'{0 … 2^min(n,10)−1}'} 里取 r</span></h3>
      <div className="body scroll">
        <table className="ptab">
          <thead><tr><th>争用期</th>{stations.map(s => <th key={s}>{s}</th>)}</tr></thead>
          <tbody>
            {colls.map(s => (
              <tr key={s.i} className={s.i > index ? 'future' : s.i === index ? 'past' : ''}>
                <th>{s.slot}</th>
                {stations.map(st => (
                  <td key={st} className="dim" style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 160 }}>
                    {s.picked[st] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
            {colls.length === 0 ? (
              <tr className="none"><td colSpan={stations.length + 1}>还没有发生冲突</td></tr>
            ) : null}
          </tbody>
        </table>
        <div className="phasenow">
          <div className="pr"><span className="k">已成功</span>
            <span className="v">{state.done.join('、') || '暂无'}</span></div>
          <div className="pr"><span className="k">已放弃</span>
            <span className="v">{state.aborted.join('、') || '无'}</span></div>
          <div className="pr"><span className="k">各站冲突次数</span>
            <span className="v">{Object.entries(state.attempts).map(([k, v]) => `${k}:${v}`).join('  ')}</span></div>
        </div>
        <p className="tnote">
          退避范围随冲突次数<b>指数增长</b>：第 1 次从 {'{0,1}'} 取，第 2 次 {'{0…3}'}，第 3 次 {'{0…7}'}……
          这样网络越挤、各站错开的可能越大。k 封顶在 10（即 {'{0…1023}'}），
          连续 16 次仍失败就放弃并报错。<br />
          本实验的"随机"取值由配置给定 —— 否则每次跑出来不一样，既没法复现也没法出题。
        </p>
      </div>
    </div>
  )
}
