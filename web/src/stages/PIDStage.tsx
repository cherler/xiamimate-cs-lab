/** 舞台：PID 控制 —— 位置vs步图，纯P(震荡冲过头)与PD(阻尼收敛)两条轨迹对目标线；侧栏拆本步 P/D 贡献 */
import type { PIDState } from '@engine/kernels/pid.ts'
import type { StageProps } from '../types.ts'

const W = 380, H = 300, PAD = 34
const XMAX = 8, YMIN = 0, YMAX = 13
const sx = (k: number) => PAD + (k / XMAX) * (W - 2 * PAD)
const sy = (p: number) => H - PAD - ((p - YMIN) / (YMAX - YMIN)) * (H - 2 * PAD)

export function PIDStage({ state }: StageProps<PIDState>) {
  const { phase, op, target, Kp, Kd, mode, k, e, uP, uD, u, p, ponly, pd, focus } = state
  const done = phase === 'done'
  const gy = [0, 2, 4, 6, 8, 10, 12]
  const pPath = ponly.map(t => `${sx(t.k)},${sy(t.p)}`).join(' ')
  const pdPath = pd.map(t => `${sx(t.k)},${sy(t.p)}`).join(' ')
  const curTrace = mode === 'P' ? ponly : pd
  const cur = curTrace[curTrace.length - 1]

  return (
    <div className="card">
      <h3>PID 控制 <span className="hint">纯 P 震荡冲过头，加 D 阻尼平稳收敛到目标</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{mode === 'P' ? '纯 P' : mode === 'PD' ? 'P + D' : '就绪'}</span><span className="scdl">控制器</span></div>
          <div className="scdk"><span className="scdn">{p}</span><span className="scdl">位置（目标 {target}）</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{e}</span><span className="scdl">误差 e</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
            {gy.map(v => <line key={'g' + v} x1={sx(0)} y1={sy(v)} x2={sx(XMAX)} y2={sy(v)} className="fk-grid" />)}
            {[0, 2, 4, 6, 8].map(s => <text key={'sx' + s} x={sx(s)} y={H - PAD + 15} className="km-axlbl" textAnchor="middle">{s}</text>)}
            {gy.map(v => <text key={'sy' + v} x={sx(0) - 8} y={sy(v) + 3} className="km-axlbl" textAnchor="end">{v}</text>)}
            {/* 目标线 */}
            <line x1={sx(0)} y1={sy(target)} x2={sx(XMAX)} y2={sy(target)} className="pid-target" />
            <text x={sx(XMAX)} y={sy(target) - 4} className="pid-tlbl" textAnchor="end">目标 {target}</text>
            {/* 纯 P 轨迹 */}
            {ponly.length > 1 && <polyline points={pPath} className="pid-ponly" />}
            {ponly.map(t => <circle key={'po' + t.k} cx={sx(t.k)} cy={sy(t.p)} r={3.5} className="pid-podot" />)}
            {/* PD 轨迹 */}
            {pd.length > 1 && <polyline points={pdPath} className="pid-pd" />}
            {pd.map(t => <circle key={'pd' + t.k} cx={sx(t.k)} cy={sy(t.p)} r={3.5} className="pid-pddot" />)}
            {/* 当前点 */}
            {cur && !done && op === 'step' && <circle cx={sx(cur.k)} cy={sy(cur.p)} r={6} className={mode === 'P' ? 'pid-cur po' : 'pid-cur pd'} />}
          </svg>

          <div className="fk-side">
            <div className="km-legend">
              <span><i className="km-dot" style={{ background: 'var(--miss)' }} />纯 P</span>
              <span><i className="km-dot" style={{ background: 'var(--hit)' }} />P + D</span>
              <span><i className="km-dot" style={{ border: '1.5px dashed var(--faint)' }} />目标</span>
            </div>
            {op === 'step' && (
              <div className={`pid-terms ${mode === 'P' ? 'po' : 'pd'}`}>
                <div className="km-mh">步 {k} · 控制量 u = {u}</div>
                <div className="pid-term"><span>P = Kp·e</span><b>{uP}</b></div>
                {mode === 'PD' && <div className="pid-term"><span>D = Kd·Δe</span><b className={uD < 0 ? 'brake' : ''}>{uD}</b></div>}
                <div className="pid-term tot"><span>→ 位置</span><b>{p}</b></div>
              </div>
            )}
            {op === 'switch' && <div className="pid-terms pd"><div className="km-mh">加 D 项（Kd={Kd}）</div><div className="pid-note">纯 P 冲过头震荡；D 按误差变化率反向刹车、提供阻尼。</div></div>}
          </div>
        </div>

        {done
          ? <p className="scnote">PID 三项把误差变成控制量：<b>P</b> 按当前误差使劲(越远越使劲)、<b>D</b> 按误差变化率<b>阻尼</b>(快到时反向刹车、防冲过头)、<b>I</b> 累积误差<b>消除稳态偏差</b>(顶掉重力等恒定扰动)。质量块(双积分)纯 P 必震荡、加 D 才稳；有恒定扰动再加 I。调参(Kp快易震/Kd稳/Ki消稳态误差)是控制日常。用在机器人关节位控力控、电机调速、无人机姿态、温控。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{mode === 'P' ? '纯 P：到目标时还有速度、刹不住 → 冲过头、再反向 → 震荡（红线）。' : op === 'switch' ? 'D 项按误差变化率给反向的刹车力，提前减速。' : 'P 往目标推、D 反向刹车阻尼，合起来平稳停在目标（绿线）。'}</p>}
      </div>
    </div>
  )
}
