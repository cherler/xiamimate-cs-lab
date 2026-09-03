/** 舞台：TCP 拥塞窗口 —— 锯齿曲线 / 状态机 */
import type { TcpState } from '@engine/kernels/tcp.ts'
import type { StageProps } from '../types.ts'

const PHASE_CN: Record<string, string> = {
  slowStart: '慢启动',
  congestionAvoidance: '拥塞避免',
  fastRecovery: '快恢复',
}
/** 阶段配色走 CSS 变量，深浅各一套 —— 理由同 SchedulerStage 的 HUES。 */
const PHASE_COLOR: Record<string, string> = {
  slowStart: 'var(--p1)',
  congestionAvoidance: 'var(--p2)',
  fastRecovery: 'var(--p3)',
}

export function TcpStage({ trace, index, state, tab }: StageProps<TcpState>) {
  if (tab === 'phase') return <Phase state={state} />
  return <Curve trace={trace} index={index} />
}

// ═══ 锯齿曲线 ══════════════════════════════════════════
function Curve({ trace, index }: { trace: TcpState[]; index: number }) {
  const W = 100, H = 46, PAD = 3
  /*  ⚠️ 纵轴上限 / 横轴跨度**故意用整条 trace 算**，不跟着当前步变：
      跟着变的话每走一步坐标系就重新缩放，已经画出来的曲线会整体跳动，
      比"剧透"还难看。轴是固定的画布，曲线在上面长出来。 */
  const maxC = Math.max(...trace.map(s => Math.max(s.cwnd, s.ssthresh)), 4)
  const x = (i: number) => PAD + (i / Math.max(1, trace.length - 1)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - (v / maxC) * (H - PAD * 2)

  /*  只画到当前步 —— 这一屏的规矩是"逐步揭示"（Cache/银行家都是这样）。
      原来拿整条 trace 画路径：第 1 步就把全部锯齿摆在那，
      而旁边的讲解还在说"这一轮 cwnd 翻倍" —— 图和文案自相矛盾，
      用户也失去了"猜下一步"的余地。 */
  const upto = trace.slice(0, index + 1)
  const cwndPath = upto.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(s.cwnd)}`).join(' ')
  const ssPath = upto.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(s.ssthresh)}`).join(' ')
  //  面积填充:cwnd 曲线下方灌一层渐变,让"窗口涨落"有体积感(不再是一根线)
  const areaPath = `${cwndPath} L ${x(index)} ${H - PAD} L ${x(0)} ${H - PAD} Z`
  const cur = trace[index]

  return (
    <div className="card">
      <h3>拥塞窗口变化 <span className="hint">实线 cwnd · 虚线 ssthresh</span></h3>
      <div className="body">
        {/* 拥塞控制的三个主角:大数条摆 cwnd / ssthresh / 当前阶段,一眼看出涨到哪、门限在哪、在哪个阶段 */}
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{cur.cwnd}</span><span className="scdl">cwnd · 当前窗口(MSS)</span></div>
          <div className="scdk"><span className="scdn">{cur.ssthresh}</span><span className="scdl">ssthresh · 慢启动门限</span></div>
          <div className="scdk"><span className="scdn" style={{ color: PHASE_COLOR[cur.phase], fontSize: '15px' }}>{PHASE_CN[cur.phase]}</span><span className="scdl">{cur.event === 'none' ? `阶段 · 第 ${cur.round} 轮` : cur.event === 'timeout' ? '超时!cwnd 重置' : '三次重复ACK'}</span></div>
        </div>
        <div className="curvewrap">
        <svg className="curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
             aria-label="拥塞窗口随轮次变化的锯齿曲线">
          <defs>
            <linearGradient id="tcpfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--now)" stopOpacity="0.26" />
              <stop offset="1" stopColor="var(--now)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={PAD} x2={W - PAD} y1={y(maxC * f)} y2={y(maxC * f)}
                  stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {upto.length > 1 && <path d={areaPath} fill="url(#tcpfill)" stroke="none" />}
          <path d={ssPath} fill="none" stroke="var(--dim)" strokeWidth={1.4} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <path d={cwndPath} fill="none" stroke="var(--now)" strokeWidth={2}
                strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {/*  丢包竖线同理只画已经走到的：提前画出来等于告诉用户"第 8 轮会丢包"。 */}
          {trace.map((s, i) => i <= index && s.event !== 'none' && (
            <line key={i} x1={x(i)} x2={x(i)} y1={PAD} y2={H - PAD}
                  stroke="var(--miss)" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.8} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={x(index)} x2={x(index)} y1={PAD} y2={H - PAD}
                stroke="var(--now)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        </svg>

        {/* 当前点用 HTML 定位，不放进 SVG —— viewBox 被非等比拉伸，圆会变椭圆 */}
        <div className="curvedot" style={{
          left: `${(x(index) / W) * 100}%`,
          top: `${(y(trace[index].cwnd) / H) * 100}%`,
        }} />

        <div className="curvelegend">
          <span><i style={{ background: 'var(--now)' }} />cwnd</span>
          <span><i style={{ background: 'var(--dim)' }} />ssthresh</span>
          <span><i style={{ background: 'var(--miss)' }} />丢包事件</span>
          <span className="max">纵轴上限 {maxC} MSS</span>
        </div>
        </div>
      </div>
    </div>
  )
}

// ═══ 状态机 ════════════════════════════════════════════
function Phase({ state }: { state: TcpState }) {
  const order = ['slowStart', 'congestionAvoidance', 'fastRecovery']
  return (
    <div className="card">
      <h3>本轮所处阶段 <span className="hint">第 {state.round} 轮</span></h3>
      <div className="body">
        <div className="phases">
          {order.map(p => {
            const on = state.phase === p
            return (
              <div key={p} className={`phase ${on ? 'on' : ''}`}
                   style={on ? { borderColor: PHASE_COLOR[p], color: PHASE_COLOR[p] } : undefined}>
                <div className="pn">{PHASE_CN[p]}</div>
                <div className="pd">
                  {p === 'slowStart' && 'cwnd 每轮翻倍，直到达到 ssthresh'}
                  {p === 'congestionAvoidance' && 'cwnd 每轮 +1，线性增长'}
                  {p === 'fastRecovery' && 'Reno 收到三次重复 ACK 后不回慢启动'}
                </div>
              </div>
            )
          })}
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">cwnd</span><span className="v">{state.cwnd} MSS</span></div>
          <div className="pr"><span className="k">ssthresh</span><span className="v">{state.ssthresh} MSS</span></div>
          <div className="pr">
            <span className="k">本轮事件</span>
            <span className={`v ${state.event === 'none' ? '' : 'bad'}`}>
              {state.event === 'none' ? '无' : state.event === 'timeout' ? '超时' : '三次重复 ACK'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
