/** 舞台：轨迹规划 —— 位置(S曲线)与速度(钟形)两图对时间，三次多项式(实线)vs线性插值(虚线,速度两端突跳) */
import type { TrajState } from '@engine/kernels/trajectory.ts'
import type { StageProps } from '../types.ts'

const W = 360, PAD = 30, TMAX = 2

function Chart({ h, ymax, ylabel, pts, linKind, linA, linB, curT, curV }: {
  h: number; ymax: number; ylabel: string
  pts: { t: number; v: number }[]
  linKind: 'line' | 'jump'; linA: number; linB: number
  curT: number | null; curV: number
}) {
  const sx = (t: number) => PAD + (t / TMAX) * (W - 2 * PAD)
  const sy = (v: number) => h - PAD - (v / ymax) * (h - 2 * PAD)
  const path = pts.map(s => `${sx(s.t)},${sy(s.v)}`).join(' ')
  return (
    <svg className="fk-svg" viewBox={`0 0 ${W} ${h}`} width={W} height={h} style={{ marginBottom: 8 }}>
      <line x1={sx(0)} y1={sy(0)} x2={sx(TMAX)} y2={sy(0)} className="fk-axis" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(ymax)} className="fk-axis" />
      <text x={sx(0) - 6} y={sy(ymax) + 8} className="km-axlbl" textAnchor="end">{ylabel}</text>
      {[0, 1, 2].map(t => <text key={t} x={sx(t)} y={h - PAD + 13} className="km-axlbl" textAnchor="middle">{t}s</text>)}
      {linKind === 'jump'
        ? <><line x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(linA)} className="traj-jump" /><line x1={sx(0)} y1={sy(linA)} x2={sx(TMAX)} y2={sy(linA)} className="traj-lin" /><line x1={sx(TMAX)} y1={sy(linA)} x2={sx(TMAX)} y2={sy(0)} className="traj-jump" /></>
        : <line x1={sx(0)} y1={sy(linA)} x2={sx(TMAX)} y2={sy(linB)} className="traj-lin" />}
      {pts.length > 1 && <polyline points={path} className="traj-cubic" />}
      {pts.map((s, i) => <circle key={i} cx={sx(s.t)} cy={sy(s.v)} r={3} className="traj-dot" />)}
      {curT !== null && <circle cx={sx(curT)} cy={sy(curV)} r={5.5} className="traj-cur" />}
    </svg>
  )
}

export function TrajStage({ state }: StageProps<TrajState>) {
  const { phase, op, theta0, thetaF, T, a, t, theta, vel, accel, linVel, samples, focus } = state
  const done = phase === 'done'
  const showCharts = phase === 'trace' || done
  const curT = op === 'sample' || op === 'summary' ? t : null

  return (
    <div className="card">
      <h3>轨迹规划 <span className="hint">三次多项式：位置 S 曲线、速度两端归零；线性插值速度突跳</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">t={t}s</span><span className="scdl">时间</span></div>
          <div className="scdk"><span className="scdn">{theta}°</span><span className="scdl">位置 θ（{theta0}→{thetaF}）</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{vel}°/s</span><span className="scdl">速度 θ̇</span></div>
        </div>

        {showCharts ? (
          <div className="traj-charts">
            <Chart h={120} ymax={100} ylabel="位置 θ°" pts={samples.map(s => ({ t: s.t, v: s.theta }))} linKind="line" linA={theta0} linB={thetaF} curT={curT} curV={theta} />
            <Chart h={120} ymax={75} ylabel="速度 θ̇" pts={samples.map(s => ({ t: s.t, v: s.vel }))} linKind="jump" linA={linVel} linB={linVel} curT={curT} curV={vel} />
          </div>
        ) : (
          <div className="traj-pre">
            {op === 'linear' && <div className="traj-warn">线性插值：θ(t)={linVel}·t，速度恒 <b>{linVel}°/s</b> 但两端从 0 突跳 → <b className="brake">瞬间无穷大加速度</b>（顿挫、抖动）。</div>}
            {op === 'solve' && <div className="traj-coef"><div className="km-mh">三次多项式 θ(t)=a₀+a₁t+a₂t²+a₃t³</div><div className="traj-crow"><span>a₀={a[0]}（=θ0）</span><span>a₁={a[1]}（θ̇(0)=0）</span></div><div className="traj-crow"><span>a₂={a[2]}（=3Δθ/T²）</span><span>a₃={a[3]}（=−2Δθ/T³）</span></div><div className="traj-note">4 个边界条件（两端位置 + 两端速度=0）定 4 个系数。</div></div>}
            {op === 'intro' && <div className="traj-note">关节 {theta0}°→{thetaF}°、T={T}s。先看线性插值的毛病，再用三次多项式修。</div>}
          </div>
        )}

        {(op === 'sample' || op === 'summary') && (
          <div className="traj-now">t={t}s：θ=<b>{theta}°</b>、θ̇=<b>{vel}°/s</b>、θ̈=<b>{accel}°/s²</b></div>
        )}

        {done
          ? <p className="scnote">三次多项式让位置走 <b>S 曲线</b>、速度呈<b>钟形</b>(两端归零→顺滑起停)，而线性插值速度两端突跳=无穷加速度。它做的是<b>时间参数化</b>的平滑运动(几何路径是 RRT 的活)。要加速度也平滑用<b>五次多项式</b>；多路点用<b>样条</b>拼；工业还用梯形/S 速度曲线。轨迹再交 <b>PID</b> 跟踪、每点用 <b>IK</b> 转关节角。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{op === 'linear' ? '匀速看似简单，但起停的速度突跳=无穷大加速度，真电机受不了。' : op === 'solve' ? '两端位置 + 两端速度为 0 这 4 个条件，正好定出三次多项式的 4 个系数。' : op === 'sample' ? '位置沿 S 曲线、速度沿钟形(两端 0、中间最大)——起步和停止都平滑。' : '轨迹规划=给一条平滑的时间轨迹，不只是连两点。'}</p>}
      </div>
    </div>
  )
}
