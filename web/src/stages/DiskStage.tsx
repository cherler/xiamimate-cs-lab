/** 舞台：磁盘调度 —— 磁头轨迹 / 请求队列 */
import type { DiskState } from '@engine/kernels/disk.ts'
import type { StageProps } from '../types.ts'

export function DiskStage({ doc, trace, index, state, tab }: StageProps<DiskState>) {
  const maxTrack = doc.params.maxTrack as number
  const start = doc.params.headStart as number
  if (tab === 'queue') return <Queue state={state} maxTrack={maxTrack} />
  return <Path trace={trace} index={index} maxTrack={maxTrack} start={start} />
}

/**
 * 磁头轨迹 —— 横轴磁道号，纵轴服务次序向下。
 * 教材上画的折线图就是这个形状；SCAN 系的"碰边再折返"一眼能看出来。
 */
function Path({ trace, index, maxTrack, start }: {
  trace: DiskState[]; index: number; maxTrack: number; start: number
}) {
  /**
   * 纵轴一行 = 磁头的一段行程。
   * 折返点也要单独占一行 —— 挤在同一行里的话，"走到 199 再折回 14" 会被压成一条近乎直线，
   * 又变回"数字对、图看不出"。
   */
  const rows = 1 + trace.reduce((n, s) => n + 1 + s.via.length, 0)
  const xOf = (t: number) => (t / maxTrack) * 100
  const yOf = (r: number) => (r / Math.max(1, rows - 1)) * 100

  /**
   * 折点要包含途经的边界。
   * 只画 from → head 的话，SCAN"先走到边界再掉头"那 209 个磁道会被画成一条直线 ——
   * 数字对，但图上完全看不出它绕了远路。
   */
  type Pt = { x: number; y: number; t: number; i: number; via?: boolean }
  const pts: Pt[] = [{ x: xOf(start), y: yOf(0), t: start, i: -1 }]
  let row = 0
  trace.forEach((s, i) => {
    for (const v of s.via) pts.push({ x: xOf(v), y: yOf(++row), t: v, i, via: true })
    pts.push({ x: xOf(s.head), y: yOf(++row), t: s.head, i })
  })

  return (
    <div className="card">
      <h3>磁头轨迹 <span className="hint">横轴磁道号 · 自上而下为服务次序</span></h3>
      <div className="body dwrap">
        <div className="dscale">
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <span key={f} style={{ left: `${f * 100}%` }}>{Math.round(f * maxTrack)}</span>
          ))}
        </div>
        <div className="dplot" style={{ height: `${Math.max(120, rows * 26)}px` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1={f * 100} x2={f * 100} y1={0} y2={100}
                    stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <polyline
              points={pts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="var(--now)" strokeWidth={1.6}
              strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.5} />
            <polyline
              points={pts.filter(p => p.i <= index).map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke="var(--now)" strokeWidth={2.4}
              strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {pts.map((p, k) => (
            <div
              key={k}
              className={`dnode ${p.via ? 'via' : ''} ${p.x > 88 ? 'rt' : ''} ${p.i === index ? 'cur' : ''} ${p.i < 0 ? 'start' : ''} ${p.i > index ? 'future' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              title={p.via
                ? `途经磁道 ${p.t}（没有请求，纯粹空跑）`
                : p.i < 0 ? `起始磁道 ${p.t}` : `第 ${p.i + 1} 个：磁道 ${p.t}`}
            >
              <em>{p.t}</em>
            </div>
          ))}
        </div>
        <div className="dlegend">
          <span>起始磁道 <b>{start}</b></span>
          <span>已服务 <b>{index + 1}</b> / {trace.length}</span>
          <span className="tot">累计寻道 <b>{trace[index]?.total ?? 0}</b></span>
        </div>
      </div>
    </div>
  )
}

function Queue({ state, maxTrack }: { state: DiskState; maxTrack: number }) {
  return (
    <div className="card">
      <h3>本步状态 <span className="hint">第 {state.i + 1} 次服务</span></h3>
      <div className="body">
        <div className="dbar">
          <div className="dtrack">
            {state.pending.map(t => (
              <div key={t} className="dreq" style={{ left: `${(t / maxTrack) * 100}%` }} title={`待服务 ${t}`} />
            ))}
            <div className="dhead" style={{ left: `${(state.head / maxTrack) * 100}%` }}>
              <em>{state.head}</em>
            </div>
          </div>
          <div className="dends"><span>0</span><span>{maxTrack}</span></div>
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">磁头位置</span><span className="v">{state.head}</span></div>
          <div className="pr"><span className="k">本步移动</span><span className="v">{state.from} → {state.head}，{state.moved} 个磁道</span></div>
          <div className="pr"><span className="k">累计寻道</span><span className="v">{state.total}</span></div>
          <div className="pr"><span className="k">扫描方向</span>
            <span className="v">{state.dir === 0 ? '不适用' : state.dir > 0 ? '↑ 向大磁道' : '↓ 向小磁道'}</span></div>
          <div className="pr"><span className="k">剩余请求</span>
            <span className="v">{state.pending.length ? state.pending.join(' ') : '全部完成'}</span></div>
        </div>
      </div>
    </div>
  )
}
