/** 舞台：梯形速度曲线 —— v(t) 图(梯形/三角) + 加速段/判形/分段/总时间 逐块 */
import type { TrapState } from '@engine/kernels/trapezoid.ts'
import type { StageProps } from '../types.ts'

export function TrapezoidStage({ state }: StageProps<TrapState>) {
  const s = state
  const { distLabel, D, vMax, aMax, tA, dA, isTrap, vPeak, dCruise, tCruise, tTotal, showAccel, showRegime, showProfile, showTime } = s
  // v(t) 图坐标：t 0..T → 34..300，v 0..vMax → 78..14
  const T = tTotal || 7
  const PX = (t: number) => 34 + (t / T) * 266
  const PY = (v: number) => 78 - (v / vMax) * 60
  // 曲线关键点
  const pts: [number, number][] = showProfile
    ? (isTrap ? [[0, 0], [tA, vMax], [tA + tCruise, vMax], [T, 0]] : [[0, 0], [T / 2, vPeak], [T, 0]])
    : showAccel ? [[0, 0], [tA, vMax]] : []
  const poly = pts.map(([t, v]) => `${PX(t)},${PY(v)}`).join(' ')

  return (
    <div className="card">
      <h3>时间最优轨迹 · 梯形速度曲线 <span className="hint">路径规划出"走哪"，轨迹规划出"什么速度走"；v_max/a_max 约束下最快走完</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{distLabel.split('（')[0]}</span><span className="scdl">距离 D={D}</span></div>
          <div className="scdk"><span className="scdn">{showRegime ? (isTrap ? '梯形' : '三角') : '—'}</span><span className="scdl">曲线形态</span></div>
          <div className="scdk"><span className="scdn">{vMax}/{aMax}</span><span className="scdl">v_max / a_max</span></div>
          <div className="scdk"><span className={`scdn${showTime ? ' tz-hot' : ''}`}>{showTime ? tTotal : '—'}<em className="cc-u">s</em></span><span className="scdl">总时间 T</span></div>
        </div>

        <svg className="tz-svg" viewBox="0 0 320 100" width="100%" height="120">
          {/* 轴 */}
          <line x1="34" y1="78" x2="308" y2="78" className="tz-axis" />
          <line x1="34" y1="78" x2="34" y2="10" className="tz-axis" />
          <text x="312" y="82" className="tz-axl">t</text>
          <text x="30" y="12" className="tz-axl" textAnchor="end">v</text>
          {/* v_max 参考线 */}
          {showRegime && <><line x1="34" y1={PY(vMax)} x2="300" y2={PY(vMax)} className="tz-vmax" /><text x="302" y={PY(vMax) + 3} className="tz-vmaxl">v_max={vMax}</text></>}
          {/* 曲线 */}
          {pts.length > 1 && <polyline points={poly} className={`tz-profile${showProfile ? ' tz-fill' : ''}`} fill={showProfile ? 'currentColor' : 'none'} />}
          {/* 关键点标注 */}
          {showProfile && isTrap && <>
            <text x={PX(tA)} y="94" className="tz-tick">t_a={tA}</text>
            <text x={PX(tA + tCruise)} y="94" className="tz-tick">{r2(tA + tCruise)}</text>
            <text x={PX(T)} y="94" className="tz-tick">T={T}</text>
          </>}
          {showProfile && !isTrap && <>
            <circle cx={PX(T / 2)} cy={PY(vPeak)} r="2.5" className="tz-peak" />
            <text x={PX(T / 2)} y={PY(vPeak) - 4} className="tz-tick">v_peak={vPeak}</text>
            <text x={PX(T)} y="94" className="tz-tick">T={T}</text>
          </>}
        </svg>

        <div className="tz-flow">
          <div className={`tz-blk${showAccel ? '' : ' tz-off'}`}>
            <span className="tz-n">①</span> 加速段 {showAccel ? <>t_a=v_max/a_max=<b>{tA}s</b>、d_a=v_max²/(2a_max)=<b>{dA}m</b>（减速对称，共 2·d_a={r2(2 * dA)}m）</> : '—'}
          </div>
          <div className={`tz-blk${showRegime ? '' : ' tz-off'}`}>
            <span className="tz-n">②</span> 判形 {showRegime ? <>D={D} {isTrap ? '≥' : '<'} 2·d_a={r2(2 * dA)} → <b className={isTrap ? 'tz-t' : 'tz-r'}>{isTrap ? '梯形（达 v_max）' : `三角（达不到，v_peak=${vPeak}<${vMax}）`}</b></> : '—'}
          </div>
          <div className={`tz-blk${showProfile ? '' : ' tz-off'}`}>
            <span className="tz-n">③</span> 分段 {showProfile ? (isTrap ? <>加速 {dA}m + <b>匀速 d_c={dCruise}m（t_c={tCruise}s）</b> + 减速 {dA}m</> : <>加速+减速各 {r2(D / 2)}m、无匀速段</>) : '—'}
          </div>
          <div className={`tz-blk${showTime ? '' : ' tz-off'}`}>
            <span className="tz-n">④</span> 总时间 {showTime ? <>T={isTrap ? `2·t_a+t_c=2·${tA}+${tCruise}` : `2·√(D/a_max)`}=<b className="tz-hot2">{tTotal}s</b>（时间最优：任何更快都违反约束）</> : '—'}
          </div>
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>梯形速度曲线 = 约束下的时间最优</b>：加速(t_a=v_max/a_max)-匀速-减速，bang-bang(全程取极值加速度)故最快；D&lt;2·d_a 时退化成三角(达不到 v_max)。<b>S 曲线</b>：再限 jerk(加速度变化率)、更柔更抗振，稍慢。<b>连</b>：「轨迹规划」的三次多项式是另一种插值(位置平滑)、梯形/S 曲线是速度受限的时间最优；「RRT/A*」出的几何路径每段都要配这样一条速度曲线才能执行。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}

function r2(x: number) { return Math.round(x * 100) / 100 }
