/** 舞台：正向运动学 FK —— 平面连杆臂，逐关节沿累计朝向走一根连杆，画出手臂、末端位姿真算 */
import type { FKState } from '@engine/kernels/fk.ts'
import type { StageProps } from '../types.ts'

// 数学坐标 → SVG 坐标（y 上翻）
const W = 340, H = 380, PAD = 28
const XMIN = -1, XMAX = 4, YMIN = -1, YMAX = 5
const SCALE = Math.min((W - 2 * PAD) / (XMAX - XMIN), (H - 2 * PAD) / (YMAX - YMIN))
const sx = (x: number) => PAD + (x - XMIN) * SCALE
const sy = (y: number) => H - PAD - (y - YMIN) * SCALE

export function FKStage({ state }: StageProps<FKState>) {
  const { phase, links, revealed, cur, points, cumAngle, endX, endY, endAngle, focus } = state
  const done = phase === 'done'

  const gridX = [] as number[]; for (let x = XMIN; x <= XMAX; x++) gridX.push(x)
  const gridY = [] as number[]; for (let y = YMIN; y <= YMAX; y++) gridY.push(y)
  const tip = points[points.length - 1]!

  return (
    <div className="card">
      <h3>正向运动学 FK <span className="hint">关节角 → 末端位姿：逐关节沿累计朝向走一根连杆</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{revealed}/{links.length}</span><span className="scdl">已应用关节</span></div>
          <div className="scdk"><span className="scdn">{cumAngle}°</span><span className="scdl">累计朝向 cumθ</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>({tip.x}, {tip.y})</span><span className="scdl">{done ? '末端位姿' : '当前末端'}</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
            {/* 网格 */}
            {gridX.map(x => <line key={'gx' + x} x1={sx(x)} y1={sy(YMIN)} x2={sx(x)} y2={sy(YMAX)} className="fk-grid" />)}
            {gridY.map(y => <line key={'gy' + y} x1={sx(XMIN)} y1={sy(y)} x2={sx(XMAX)} y2={sy(y)} className="fk-grid" />)}
            {/* 坐标轴 */}
            <line x1={sx(XMIN)} y1={sy(0)} x2={sx(XMAX)} y2={sy(0)} className="fk-axis" />
            <line x1={sx(0)} y1={sy(YMIN)} x2={sx(0)} y2={sy(YMAX)} className="fk-axis" />
            {/* 连杆段（已应用的） */}
            {points.slice(0, -1).map((p, i) => {
              const q = points[i + 1]!
              return <line key={'seg' + i} x1={sx(p.x)} y1={sy(p.y)} x2={sx(q.x)} y2={sy(q.y)} className={`fk-link ${cur === i ? 'now' : ''}`} />
            })}
            {/* 关节 + 末端 */}
            {points.map((p, i) => {
              const isBase = i === 0
              const isTip = i === points.length - 1 && revealed > 0
              return (
                <g key={'j' + i}>
                  <circle cx={sx(p.x)} cy={sy(p.y)} r={isTip ? 7 : 5} className={`fk-joint ${isBase ? 'base' : ''} ${isTip ? 'tip' : ''}`} />
                  {i > 0 && <text x={sx(p.x) + 9} y={sy(p.y) - 6} className="fk-lbl">({p.x}, {p.y})</text>}
                </g>
              )
            })}
            {/* 基座三角 */}
            <polygon points={`${sx(0) - 9},${sy(0) + 14} ${sx(0) + 9},${sy(0) + 14} ${sx(0)},${sy(0)}`} className="fk-mount" />
          </svg>

          {/* 关节配置表 */}
          <div className="fk-side">
            <div className="fk-conf">
              <div className="fk-chead">连杆链配置</div>
              {links.map((lk, i) => (
                <div key={i} className={`fk-crow ${cur === i ? 'now' : ''} ${i < revealed ? 'done' : ''}`}>
                  <span className="fk-cj">关节{i + 1}</span>
                  <span className="fk-ct">θ={lk.theta}°</span>
                  <span className="fk-cl">L={lk.L}</span>
                  {i < revealed && <span className="fk-cok">✓</span>}
                </div>
              ))}
            </div>
            {done && (
              <div className="fk-result">
                <div className="fk-rk">末端位姿</div>
                <div className="fk-rv">({endX}, {endY})</div>
                <div className="fk-ra">朝向 {endAngle}°</div>
              </div>
            )}
          </div>
        </div>

        {done
          ? <p className="scnote">FK = 把每个关节的"转 + 走"沿链累加：<b>累计朝向</b>决定这一节朝哪、<b>连杆长</b>决定走多远（齐次变换连乘 T₁T₂T₃ 的平面直觉版）。关节角定了、末端就唯一确定；反过来「给末端求关节角」是<b>逆运动学 IK</b>，可能多解/无解，难得多。用在机械臂末端定位、机器狗足端落点。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。每步只做一件事：把当前关节角叠进累计朝向 cumθ，再从上一节末端沿 cumθ 走一根连杆长——坐标全是 cos/sin 真算，可手核。</p>}
      </div>
    </div>
  )
}
