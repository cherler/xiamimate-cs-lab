/** 舞台：MPC —— 位置vs时间图：MPC(绿,预测刹车停在目标)vs反应式(红,冲过目标);当前步显示预测停点 */
import type { MPCState } from '@engine/kernels/mpc.ts'
import type { StageProps } from '../types.ts'

const W = 380, H = 240, PAD = 32
const TMAX = 8.5, YMAX = 16

export function MPCStage({ state }: StageProps<MPCState>) {
  const { phase, op, target, t, x, v, u, brakeDist, predStop, braking, mpcShown, reacFull, reacMax, focus } = state
  const done = phase === 'done'
  const sx = (tt: number) => PAD + (tt / TMAX) * (W - 2 * PAD)
  const sy = (p: number) => H - PAD - (p / YMAX) * (H - 2 * PAD)
  const showMpc = phase === 'mpc' || done
  const mpcPath = mpcShown.map(p => `${sx(p.t)},${sy(p.x)}`).join(' ')
  const reacPath = reacFull.map(p => `${sx(p.t)},${sy(Math.min(p.x, YMAX))}`).join(' ')

  return (
    <div className="card">
      <h3>MPC 模型预测控制 <span className="hint">预测未来+优化+只执行第一步；会提前刹车、精准停在目标不越界</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'reactive' ? '反应式' : done ? 'MPC·停住' : phase === 'mpc' ? (braking ? 'MPC·刹车' : 'MPC·加速') : '就绪'}</span><span className="scdl">当前</span></div>
          <div className="scdk"><span className="scdn">{op === 'reactive' ? reacMax : x}</span><span className="scdl">{op === 'reactive' ? '反应式最远(越界)' : `位置 x（目标 ${target}）`}</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{op === 'sample' || op === 'summary' ? predStop : '—'}</span><span className="scdl">预测停点</span></div>
        </div>

        <svg className="fk-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ marginBottom: 8 }}>
          {[0, 4, 8, 12, 16].map(p => <line key={'g' + p} x1={sx(0)} y1={sy(p)} x2={sx(TMAX)} y2={sy(p)} className="fk-grid" />)}
          {[0, 2, 4, 6, 8].map(tt => <text key={'t' + tt} x={sx(tt)} y={H - PAD + 13} className="km-axlbl" textAnchor="middle">{tt}s</text>)}
          {[0, 4, 8, 12, 16].map(p => <text key={'y' + p} x={sx(0) - 6} y={sy(p) + 3} className="km-axlbl" textAnchor="end">{p}</text>)}
          {/* 目标线（也是墙） */}
          <line x1={sx(0)} y1={sy(target)} x2={sx(TMAX)} y2={sy(target)} className="mpc-target" />
          <text x={sx(TMAX)} y={sy(target) - 4} className="km-axlbl" textAnchor="end">目标/墙 {target}</text>
          {/* 反应式（越界） */}
          {(op === 'reactive' || showMpc) && <polyline points={reacPath} className="mpc-reac" />}
          {op === 'reactive' && <text x={sx(reacFull[reacFull.length - 1]!.t)} y={sy(Math.min(reacMax, YMAX)) - 4} className="mpc-rlbl">冲到 {reacMax}!</text>}
          {/* MPC（停在目标） */}
          {showMpc && mpcShown.length > 1 && <polyline points={mpcPath} className="mpc-mpc" />}
          {showMpc && mpcShown.map((p, i) => <circle key={i} cx={sx(p.t)} cy={sy(p.x)} r={2.5} className="mpc-dot" />)}
          {/* 当前点 + 预测停点 */}
          {(op === 'sample' || op === 'summary') && (
            <>
              <circle cx={sx(t)} cy={sy(x)} r={5} className={`mpc-cur ${braking ? 'brake' : ''}`} />
              <line x1={sx(t)} y1={sy(x)} x2={sx(t)} y2={sy(Math.min(predStop, YMAX))} className="mpc-pred" />
              <circle cx={sx(t)} cy={sy(Math.min(predStop, YMAX))} r={3.5} className="mpc-predstop" />
            </>
          )}
        </svg>

        <div className="mpc-info">
          {op === 'reactive' ? <div className="mpc-warn">反应式(纯比例)：没有预测，到跟前还在冲 → 冲过目标 {target} 飙到 <b>{reacMax}</b>（撞穿墙）。</div>
            : op === 'sample' || op === 'summary' ? <div className={`mpc-row ${braking ? 'brake' : 'accel'}`}>t={t}s：x={x}、v={v} → 刹车距离 {brakeDist} → <b>预测停点 {predStop}</b> {braking ? `≥ 目标 → 提前刹车(u=${u})` : `< 目标、有余量 → 加速(u=${u})`}</div>
              : <div className="mpc-note">质量块要精准停在目标 {target}（也是墙、不能越）。先看反应式冲过头，再看 MPC 预测刹车。</div>}
        </div>

        {done
          ? <p className="scnote">同一任务：<b>反应式冲到 {reacMax}（撞墙）、MPC 停在 {x}</b>。MPC 三件套：用<b>模型预测</b>未来一段、<b>优化</b>整条控制序列(跟踪+约束+省劲)、<b>只执行第一步</b>再滚动重规划。本例的"预测"就是刹车距离→预测停点，够到目标就提前刹。真 MPC 每步解带约束优化(QP/NLP)、显式处理不越界/超速/超力矩。代价：要准模型+在线求解。用在自动驾驶、四足步态、无人机、过程控制。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{op === 'reactive' ? '反应式只看当前误差、没有预测，到目标还带着大速度、刹不住。' : op === 'sample' ? 'MPC 每步预测"照现在速度刹停要多远"(预测停点)，够到目标就提前刹车——会往前看。' : 'MPC 预测未来、优化、只执行第一步、下步重规划。'}</p>}
      </div>
    </div>
  )
}
