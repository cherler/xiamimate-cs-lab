/** 舞台：位姿与四元数 —— xy 平面里向量随四元数旋转，侧栏显示 q(w,x,y,z)|q|/旋转矩阵/万向锁三组同 R */
import type { QuatState } from '@engine/kernels/quat.ts'
import type { StageProps } from '../types.ts'

const SZ = 280, CX = 140, CY = 140, SC = 88
const px = (x: number) => CX + x * SC
const py = (y: number) => CY - y * SC

export function QuatStage({ state }: StageProps<QuatState>) {
  const { phase, op, q, qnorm, R, vecStart, vecNow, angleShown, eulerSets, gimbalR, focus } = state
  const done = phase === 'done'
  const isGimbal = phase === 'gimbal'
  const labels = ['w', 'x', 'y', 'z']

  return (
    <div className="card">
      <h3>位姿与四元数 <span className="hint">轴-角→四元数→矩阵→转向量；四元数相乘=组合；欧拉角万向锁</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot" style={{ fontSize: '12px' }}>({q.join(', ')})</span><span className="scdl">四元数 q=(w,x,y,z)</span></div>
          <div className="scdk"><span className="scdn">{qnorm}</span><span className="scdl">|q|²（单位）</span></div>
          <div className="scdk"><span className="scdn">{angleShown}°</span><span className="scdl">绕 z 累计转角</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${SZ} ${SZ}`} width={SZ} height={SZ}>
            <defs>
              <marker id="qarrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="var(--now)" /></marker>
              <marker id="qarrow0" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--faint)" /></marker>
            </defs>
            {/* 轴 */}
            <line x1={px(-1.4)} y1={py(0)} x2={px(1.4)} y2={py(0)} className="fk-axis" />
            <line x1={px(0)} y1={py(-1.4)} x2={px(0)} y2={py(1.4)} className="fk-axis" />
            <text x={px(1.4) - 6} y={py(0) - 5} className="km-axlbl">x</text>
            <text x={px(0) + 6} y={py(1.4) + 10} className="km-axlbl">y</text>
            {/* 旋转弧 */}
            {angleShown > 0 && <path d={`M ${px(0.55)} ${py(0)} A ${0.55 * SC} ${0.55 * SC} 0 ${angleShown > 180 ? 1 : 0} 0 ${px(0.55 * Math.cos(angleShown * Math.PI / 180))} ${py(0.55 * Math.sin(angleShown * Math.PI / 180))}`} className="quat-arc" />}
            {/* 起始向量（faint） */}
            <line x1={px(0)} y1={py(0)} x2={px(vecStart[0])} y2={py(vecStart[1])} className="quat-v0" markerEnd="url(#qarrow0)" />
            {/* 当前向量 */}
            <line x1={px(0)} y1={py(0)} x2={px(vecNow[0])} y2={py(vecNow[1])} className="quat-v" markerEnd="url(#qarrow)" />
            <text x={px(vecNow[0]) + (vecNow[0] < 0 ? -8 : 8)} y={py(vecNow[1]) + (vecNow[1] > 0 ? -6 : 14)} className="quat-vlbl">({vecNow[0]},{vecNow[1]},{vecNow[2]})</text>
          </svg>

          <div className="fk-side">
            {/* 四元数分量 */}
            <div className="quat-q">
              {q.map((c, i) => <span key={i} className="quat-qc"><i>{labels[i]}</i><b>{c}</b></span>)}
            </div>
            {/* 旋转矩阵 or 万向锁 */}
            {!isGimbal ? (
              <div className="jc-matwrap">
                <div className="fk-chead">旋转矩阵 R（3×3）</div>
                <div className="quat-mat">
                  {R.map((row, i) => row.map((v, j) => <span key={`${i}-${j}`}>{v}</span>))}
                </div>
              </div>
            ) : (
              <div className="jc-matwrap">
                <div className="fk-chead">万向锁：pitch=90° 三组欧拉角 → 同一 R</div>
                <div className="quat-euler">
                  {eulerSets.map((e, i) => <div key={i} className="quat-eset">(yaw {e.yaw}, pitch {e.pitch}, roll {e.roll}) <em>yaw−roll={e.yaw - e.roll}</em></div>)}
                  {gimbalR && <div className="quat-eq">都 → R=[[{gimbalR[0]!.join(',')}],[{gimbalR[1]!.join(',')}],[{gimbalR[2]!.join(',')}]]</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {done
          ? <p className="scnote"><b>欧拉角</b>直观但 pitch=90° <b>万向锁</b>丢自由度；<b>旋转矩阵</b>好乘向量但 9 个数带约束；<b>四元数</b> 4 个数、|q|=1、<b>无奇异</b>、组合=相乘、插值平滑(Slerp)——机器人姿态估计(IMU)/SLAM/图形/无人机<b>默认用四元数</b>，只在给人看时转欧拉角。配 FK/IK(位置) 就是完整位姿(位置+朝向)。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{op === 'quat' ? '绕轴转 θ → q=(cos(θ/2), sin(θ/2)·轴)，|q| 恒=1，只用 4 个数编码一个旋转。' : op === 'matrix' ? '固定公式把 4 个数展成 3×3，就能乘向量把它转过去。' : op === 'rotate' ? 'R 乘向量 = 把向量转过去；(1,0,0)→(0,1,0)。' : op === 'compose' ? '组合旋转 = 四元数相乘(不可交换)，比连乘矩阵省、不漂移。' : isGimbal ? '三组不同欧拉角给出同一个 R——yaw 和 roll 锁成一个、丢了一个自由度。四元数没这毛病。' : '看四元数怎么表示、转向量、组合、以及欧拉角的万向锁。'}</p>}
      </div>
    </div>
  )
}
