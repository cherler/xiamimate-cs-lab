/** 舞台：TCP 连接管理 —— 时序图 + 两端状态机 */
import type { HsState } from '@engine/kernels/handshake.ts'
import { CLIENT_STATES, SERVER_STATES } from '@engine/kernels/handshake.ts'
import type { StageProps } from '../types.ts'

export function HandshakeStage({ trace, index, state, tab }: StageProps<HsState>) {
  if (tab === 'states') return <States state={state} />
  return <Timeline trace={trace} index={index} state={state} />
}

/**
 * 时序图：左客户端、右服务器，斜线是报文段。
 * 状态写在各自泳道的时间线旁边 —— 考题问的几乎都是"这一刻两端各是什么状态"。
 */
function Timeline({ trace, index, state }: { trace: HsState[]; index: number; state: HsState }) {
  const events = trace.filter(s => s.seg !== null)
  const rows = Math.max(events.length, 1)

  return (
    <div className="card">
      <h3>时序图 <span className="hint">左客户端 · 右服务器 · 状态标在各自一侧</span></h3>
      <div className="body hswrap">
        {/* 考题几乎都问"此刻两端各是什么状态":大数条把两端状态 + 本步报文摆最前 */}
        <div className="scdim">
          <div className="scdk"><span className="scdn hot" style={{ fontSize: '14px' }}>{state.client}</span><span className="scdl">客户端(主动方)</span></div>
          <div className="scdk"><span className="scdn good" style={{ fontSize: '14px' }}>{state.server}</span><span className="scdl">服务器(被动方)</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '14px', color: state.seg?.lost ? 'var(--miss)' : 'var(--f-tag)' }}>{state.seg ? state.seg.flags : '—'}</span><span className="scdl">{state.seg ? (state.seg.lost ? '本步报文 · 丢失✕' : `本步报文 seq=${state.seg.seq}`) : '尚未发送'}</span></div>
        </div>
        <div className="hslanes"><span>客户端</span><span>服务器</span></div>
        <div className="hsplot" style={{ height: `${Math.max(200, rows * 54)}px` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1={14} x2={14} y1={0} y2={100} className="alane" vectorEffect="non-scaling-stroke" />
            <line x1={86} x2={86} y1={0} y2={100} className="alane" vectorEffect="non-scaling-stroke" />
            {events.map((s, k) => {
              const seg = s.seg!
              const y0 = (k / rows) * 100 + 4
              const y1 = ((k + 1) / rows) * 100
              const down = seg.dir === 'c2s'
              const x0 = down ? 14 : 86
              const x1 = down ? 86 : 14
              const f = seg.lost ? 0.5 : 1
              return (
                <line key={k}
                  x1={x0} y1={y0} x2={x0 + (x1 - x0) * f} y2={y0 + (y1 - y0) * f}
                  className={`amsg ${seg.lost ? 'lost' : 'frame'} ${s.i <= index ? 'seen' : 'future'}`}
                  vectorEffect="non-scaling-stroke" />
              )
            })}
          </svg>
          {events.map((s, k) => {
            const seg = s.seg!
            const y0 = (k / rows) * 100 + 4
            const y1 = ((k + 1) / rows) * 100
            const down = seg.dir === 'c2s'
            const f = seg.lost ? 0.5 : 1
            const x = (down ? 14 : 86) + ((down ? 72 : -72) * f) / 2
            return (
              <div key={k}
                className={`hstag ${seg.lost ? 'lost' : ''} ${s.i <= index ? '' : 'future'}`}
                style={{ left: `${x}%`, top: `${y0 + (y1 - y0) / 2}%` }}>
                {seg.flags}
                <em>seq={seg.seq}{seg.ack >= 0 ? ` ack=${seg.ack}` : ''}</em>
                {seg.lost ? <b>✕ 丢失</b> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 状态机：两条链，当前状态高亮 */
function States({ state }: { state: HsState }) {
  return (
    <div className="card">
      <h3>状态迁移 <span className="hint">两端各走各的链</span></h3>
      <div className="body">
        <div className="entcap">客户端（主动方）</div>
        <div className="hschain">
          {CLIENT_STATES.map(s => (
            <div key={s} className={`hsnode ${state.client === s ? 'on' : ''}`}>{s}</div>
          ))}
        </div>
        <div className="entcap" style={{ marginTop: 16 }}>服务器（被动方）</div>
        <div className="hschain">
          {SERVER_STATES.map(s => (
            <div key={s} className={`hsnode ${state.server === s ? 'on' : ''}`}>{s}</div>
          ))}
        </div>
        <p className="tnote">
          <b>为什么握手三次而不是两次</b>：第三次让服务器确认「客户端确实收到了我的应答」，
          否则一个迟到的旧 SYN 会让服务器白建一条无人使用的连接。<br />
          <b>为什么挥手四次而不是三次</b>：服务器收到 FIN 时可能还有数据没发完，
          它的 ACK 和 FIN 之间隔着这段时间（CLOSE_WAIT），合并不了。<br />
          <b>TIME_WAIT 为什么等 2MSL</b>：一是最后那个 ACK 若丢失，对方重发 FIN 时自己还在、还能再确认；
          二是让本连接的迟到报文消散，不污染下一条同四元组的连接。
        </p>
      </div>
    </div>
  )
}
