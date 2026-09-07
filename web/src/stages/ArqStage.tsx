/** 舞台：滑动窗口 ARQ —— 时空图 + 窗口状态 */
import type { ArqState } from '@engine/kernels/arq.ts'
import type { StageProps } from '../types.ts'

export function ArqStage({ doc, trace, index, state, tab }: StageProps<ArqState>) {
  const total = doc.params.totalFrames as number
  const W = doc.params.protocol === 'SW' ? 1 : (doc.params.windowSize as number)
  if (tab === 'window') return <Window state={state} total={total} W={W} proto={String(doc.params.protocol)} />
  return <Spacetime trace={trace} index={index} state={state} delay={doc.params.delay as number} total={total} proto={String(doc.params.protocol)} />
}

/**
 * 时空图 —— 教材上讲滑动窗口用的就是这张图：
 * 左边一条发送方时间线，右边一条接收方时间线，中间是斜的报文箭头。
 * 丢失的报文画成半路断掉的虚线。
 */
function Spacetime({ trace, index, state, delay, total, proto }: { trace: ArqState[]; index: number; state: ArqState; delay: number; total: number; proto: string }) {
  const rows = trace.length
  const yOf = (t: number) => (t / Math.max(1, rows)) * 100
  //  第 0 步「还没开始」时 index 是 −1，轨迹里取不到 —— 用初始态兜底(App 传的就是它)
  const cur = trace[index] ?? state
  const retx = Math.max(0, cur.transmissions - total)

  /** 从轨迹里还原每一次传输：发出时隙 → 到达（或丢失）时隙 */
  type Msg = {
    kind: 'frame' | 'ack'; seq: number; t0: number; t1: number; lost: boolean
    /** 同一时隙里的第几条 —— GBN 回退重传会一次发好几帧 */
    slot: number
  }
  const msgs: Msg[] = []
  for (let t = 0; t < trace.length; t++) {
    const prevIds = new Set((trace[t - 1]?.inFlight ?? []).map(f => `${f.kind}${f.seq}@${f.eta}`))
    let slot = 0
    for (const f of trace[t].inFlight) {
      // 刚发出的：eta 等于满程延迟，且上一步没有同样的在途记录
      if (f.eta === delay && !prevIds.has(`${f.kind}${f.seq}@${delay}`)) {
        msgs.push({ kind: f.kind, seq: f.seq, t0: t, t1: t + delay, lost: f.doomed, slot: slot++ })
      }
    }
  }

  /**
   * 同一时隙发出的多条报文必须错开画。
   * 不错开的话，GBN 超时后回退重传的那 4 帧会精确重合成一条线 ——
   * 而"回退 N 帧"这个名字的全部含义恰恰就在那一刻。
   */
  const FAN = 1.1                                   // 每条错开的纵向偏移（viewBox 单位）
  const geom = (m: Msg) => {
    const down = m.kind === 'frame'
    const off = m.slot * FAN
    const x0 = down ? 8 : 92, x1 = down ? 92 : 8
    const y0 = yOf(m.t0) + off, y1 = yOf(Math.min(m.t1, rows)) + off
    const f = m.lost ? 0.55 : 1                      // 丢失的画一半就断
    return { down, x0, y0, x1: x0 + (x1 - x0) * f, y1: y0 + (y1 - y0) * f, f }
  }

  return (
    <div className="card">
      <h3>时空图 <span className="hint">左发送方 · 右接收方 · 斜线是报文，红色断头表示丢失</span></h3>
      <div className="body awrap">
        {/* ARQ 的题眼是"丢一帧要重传多少":大数条摆 累计传输 / 其中重传 / 信道在途,一眼看出 GBN 的浪费 */}
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{cur.transmissions}</span><span className="scdl">{proto} · 累计传输次数</span></div>
          <div className="scdk"><span className={`scdn ${retx > 0 ? 'bad' : 'good'}`}>{retx}</span><span className="scdl">其中重传(理想 0)</span></div>
          <div className="scdk"><span className="scdn">{cur.inFlight.length}</span><span className="scdl">信道在途报文</span></div>
        </div>
        <div className="alanes"><span>发送方</span><span>接收方</span></div>
        <div className="aplot" style={{ height: `${Math.max(200, rows * 26)}px` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1={8} x2={8} y1={0} y2={100} className="alane" vectorEffect="non-scaling-stroke" />
            <line x1={92} x2={92} y1={0} y2={100} className="alane" vectorEffect="non-scaling-stroke" />
            {msgs.map((m, k) => {
              const g = geom(m)
              return (
                <line
                  key={k} x1={g.x0} y1={g.y0} x2={g.x1} y2={g.y1}
                  className={`amsg ${m.kind} ${m.lost ? 'lost' : ''} ${m.t0 <= index ? 'seen' : 'future'}`}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </svg>
          {msgs.filter(m => m.t0 <= index).map((m, k) => {
            const g = geom(m)
            //  标签贴在发出端附近并按同时隙序号横向错开，避免全挤在正中一列
            const at = 0.2 + m.slot * 0.16
            return (
              <div
                key={k}
                className={`atag ${m.kind} ${m.lost ? 'lost' : ''}`}
                style={{
                  left: `${g.x0 + (g.x1 - g.x0) * at}%`,
                  top: `${g.y0 + (g.y1 - g.y0) * at}%`,
                }}
              >
                {m.kind === 'frame' ? `帧 ${m.seq}` : `ACK ${m.seq}`}{m.lost ? ' ✕' : ''}
              </div>
            )
          })}
          <div className="anow" style={{ top: `${yOf(index)}%` }} />
        </div>
      </div>
    </div>
  )
}

/** 窗口状态：发送窗口滑到哪、接收方期待谁、缓存了谁 */
function Window({ state, total, W, proto }: {
  state: ArqState; total: number; W: number; proto: string
}) {
  const buffered = new Set(state.buffered)
  return (
    <div className="card">
      <h3>窗口状态 <span className="hint">{proto} · 发送窗口 {W}</span></h3>
      <div className="body">
        {/* 窗口三要素:大数条摆 窗口左沿 base / 接收方期待 / 重传次数 */}
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{state.base}</span><span className="scdl">发送窗口左沿 base(上界 {state.base + W - 1})</span></div>
          <div className="scdk"><span className="scdn good">{state.expected}</span><span className="scdl">接收方期待帧</span></div>
          <div className="scdk"><span className={`scdn ${Math.max(0, state.transmissions - total) > 0 ? 'bad' : ''}`}>{Math.max(0, state.transmissions - total)}</span><span className="scdl">重传次数 · 累计传 {state.transmissions}</span></div>
        </div>
        <div className="awin">
          <div className="arow">
            <span className="k">发送方</span>
            <div className="acells">
              {Array.from({ length: total }, (_, n) => {
                const inWin = n >= state.base && n < state.base + W
                const cls = [
                  'acell',
                  n < state.base ? 'acked' : '',
                  inWin && n < state.next ? 'flying' : '',
                  inWin && n >= state.next ? 'usable' : '',
                  inWin ? 'inwin' : '',
                ].filter(Boolean).join(' ')
                return <div key={n} className={cls} title={`帧 ${n}`}>{n}</div>
              })}
            </div>
          </div>
          <div className="arow">
            <span className="k">接收方</span>
            <div className="acells">
              {Array.from({ length: total }, (_, n) => {
                const cls = [
                  'acell',
                  n < state.expected ? 'delivered' : '',
                  buffered.has(n) ? 'buffered' : '',
                  n === state.expected ? 'expect' : '',
                ].filter(Boolean).join(' ')
                return <div key={n} className={cls} title={`帧 ${n}`}>{n}</div>
              })}
            </div>
          </div>
        </div>

        <div className="alegend">
          <span><i className="aw acked" />已确认</span>
          <span><i className="aw flying" />已发未确认</span>
          <span><i className="aw usable" />窗口内可发</span>
          <span><i className="aw delivered" />已交付</span>
          <span><i className="aw buffered" />失序缓存</span>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">发送窗口</span>
            <span className="v">base={state.base}，next={state.next}，上界={state.base + W - 1}</span></div>
          <div className="pr"><span className="k">接收方期待</span><span className="v">{state.expected}</span></div>
          <div className="pr"><span className="k">失序缓存</span>
            <span className="v">{state.buffered.length ? state.buffered.join(' ') : proto === 'SR' ? '空' : 'GBN 不缓存失序帧'}</span></div>
          <div className="pr"><span className="k">信道在途</span>
            <span className="v">{state.inFlight.length
              ? state.inFlight.map(f => `${f.kind === 'frame' ? '帧' : 'ACK'} ${f.seq}`).join(' ')
              : '空'}</span></div>
          <div className="pr"><span className="k">累计传输</span>
            <span className="v">{state.transmissions} 次（重传 {Math.max(0, state.transmissions - total)} 次）</span></div>
        </div>
      </div>
    </div>
  )
}
