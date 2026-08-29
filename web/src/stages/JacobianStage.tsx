/** 舞台：雅可比矩阵 —— 画臂 + 末端速度箭头 + 2×2 J 矩阵 + det；θ2=0 伸直时 det=0 奇异、两列平行丢自由度 */
import type { JacoState } from '@engine/kernels/jacobian.ts'
import type { StageProps } from '../types.ts'

const W = 340, H = 360, PAD = 28
const XMIN = -1, XMAX = 4, YMIN = -1, YMAX = 4
const SCALE = Math.min((W - 2 * PAD) / (XMAX - XMIN), (H - 2 * PAD) / (YMAX - YMIN))
const sx = (x: number) => PAD + (x - XMIN) * SCALE
const sy = (y: number) => H - PAD - (y - YMIN) * SCALE
const VS = 0.5 // 速度箭头缩放

export function JacobianStage({ state }: StageProps<JacoState>) {
  const { phase, theta1, theta2, J, det, singular, dtheta, endVel, armPts, which, focus } = state
  const done = phase === 'done'
  const end = armPts[armPts.length - 1]!
  const gridX = [] as number[]; for (let x = XMIN; x <= XMAX; x++) gridX.push(x)
  const gridY = [] as number[]; for (let y = YMIN; y <= YMAX; y++) gridY.push(y)

  // 速度箭头终点（数学坐标）
  const vTip = endVel ? { x: end.x + endVel.vx * VS, y: end.y + endVel.vy * VS } : null

  return (
    <div className="card">
      <h3>雅可比矩阵 J <span className="hint">关节速度 → 末端速度；det(J)=0 即奇异、丢自由度</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">θ=[{theta1}°,{theta2}°]</span><span className="scdl">当前构型</span></div>
          <div className="scdk"><span className={`scdn ${singular ? 'sk-neg' : ''}`}>{det}</span><span className="scdl">det(J)=L1L2sinθ2</span></div>
          <div className="scdk"><span className={`scdn ${singular ? 'sk-neg' : ''}`} style={{ fontSize: '13px' }}>{singular ? '奇异·丢自由度' : '可逆'}</span><span className="scdl">J 状态</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
            <defs>
              <marker id="jarrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M0,0 L9,4.5 L0,9 z" fill="var(--hit)" />
              </marker>
            </defs>
            {gridX.map(x => <line key={'gx' + x} x1={sx(x)} y1={sy(YMIN)} x2={sx(x)} y2={sy(YMAX)} className="fk-grid" />)}
            {gridY.map(y => <line key={'gy' + y} x1={sx(XMIN)} y1={sy(y)} x2={sx(XMAX)} y2={sy(y)} className="fk-grid" />)}
            <line x1={sx(XMIN)} y1={sy(0)} x2={sx(XMAX)} y2={sy(0)} className="fk-axis" />
            <line x1={sx(0)} y1={sy(YMIN)} x2={sx(0)} y2={sy(YMAX)} className="fk-axis" />
            {/* 臂 */}
            {armPts.slice(0, -1).map((p, i) => {
              const q = armPts[i + 1]!
              return <line key={'seg' + i} x1={sx(p.x)} y1={sy(p.y)} x2={sx(q.x)} y2={sy(q.y)} className={`fk-link ${singular ? 'jc-straight' : ''}`} />
            })}
            {armPts.map((p, i) => <circle key={'j' + i} cx={sx(p.x)} cy={sy(p.y)} r={i === 0 ? 5 : i === armPts.length - 1 ? 6 : 5} className={`fk-joint ${i === 0 ? 'base' : ''} ${i === armPts.length - 1 ? 'tip' : ''}`} />)}
            {/* 末端速度箭头 */}
            {vTip && (
              <>
                <line x1={sx(end.x)} y1={sy(end.y)} x2={sx(vTip.x)} y2={sy(vTip.y)} className="jc-vel" markerEnd="url(#jarrow)" />
                <text x={sx(vTip.x) + 5} y={sy(vTip.y)} className="jc-vlbl">({endVel!.vx}, {endVel!.vy})</text>
              </>
            )}
            <polygon points={`${sx(0) - 9},${sy(0) + 14} ${sx(0) + 9},${sy(0) + 14} ${sx(0)},${sy(0)}`} className="fk-mount" />
          </svg>

          <div className="fk-side">
            {/* J 矩阵 */}
            <div className="jc-matwrap">
              <div className="fk-chead">雅可比 J = ∂(x,y)/∂(θ1,θ2)</div>
              <div className={`jc-mat ${singular ? 'sing' : ''}`}>
                <span className="jc-br">[</span>
                <div className="jc-cells">
                  <span>{J[0][0]}</span><span>{J[0][1]}</span>
                  <span>{J[1][0]}</span><span>{J[1][1]}</span>
                </div>
                <span className="jc-br">]</span>
              </div>
              <div className={`jc-det ${singular ? 'sing' : ''}`}>det = {det}{singular ? ' → 奇异（两列平行）' : ' ≠ 0 → 可逆'}</div>
            </div>
            {/* 本步速度映射 */}
            {dtheta && endVel && (
              <div className="jc-map">
                <div className="jc-mk">{which}</div>
                <div className="jc-mv">θ̇=[{dtheta[0]}, {dtheta[1]}] → 末端速度 ({endVel.vx}, {endVel.vy})</div>
              </div>
            )}
          </div>
        </div>

        {done
          ? <p className="scnote">雅可比是 FK/IK(位置) 之上的<b>速度层</b>：正着用 <code>ẋ=Jθ̇</code> 算末端速度，反着用 <code>θ̇=J⁻¹ẋ</code> 做速度层 IK(沿直线走/力控)。<b>det(J)=L1L2 sinθ2</b>：手臂伸直(θ2=0)或对折(180°)时 det=0、<b>奇异</b>、末端丢一个自由度、J⁻¹ 爆炸。工程上绕开奇异或用阻尼最小二乘(DLS)。还连着静力学 τ=Jᵀf。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{phase === 'build' ? 'J 的每一列 = "只转这个关节时末端往哪动"；任意关节速度的末端速度 = 两列的线性组合。' : phase === 'apply' ? '末端速度就是 J 乘关节角速度向量——图上箭头是此刻末端的运动方向。' : phase === 'det' ? 'det(J)≠0 → 可逆 → 能反解：给期望末端速度求关节速度(速度层 IK)。' : '雅可比把关节怎么转，线性映射成末端怎么动。'}</p>}
      </div>
    </div>
  )
}
