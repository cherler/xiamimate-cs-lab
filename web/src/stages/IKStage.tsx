/** 舞台：逆运动学 IK —— 给末端目标反求关节角；画出可达范围、两支解(肘上/肘下)两种姿势够到同一点 */
import type { IKState } from '@engine/kernels/ik.ts'
import type { StageProps } from '../types.ts'

const W = 340, H = 360, PAD = 28
const XMIN = -1, XMAX = 4, YMIN = -1, YMAX = 4
const SCALE = Math.min((W - 2 * PAD) / (XMAX - XMIN), (H - 2 * PAD) / (YMAX - YMIN))
const sx = (x: number) => PAD + (x - XMIN) * SCALE
const sy = (y: number) => H - PAD - (y - YMIN) * SCALE
const rad = (d: number) => (d * Math.PI) / 180
const r2 = (n: number) => Math.round(n * 1000) / 1000

export function IKStage({ state }: StageProps<IKState>) {
  const { L1, L2, target, r, reachLo, reachHi, reachable, cosTheta2, solutions, curBranch, focus } = state

  // 从每个解的 th1 重建臂：[基座, 肘, 末端]
  const armOf = (s: { th1: number; checkX: number; checkY: number }) => [
    { x: 0, y: 0 },
    { x: r2(L1 * Math.cos(rad(s.th1))), y: r2(L1 * Math.sin(rad(s.th1))) },
    { x: s.checkX, y: s.checkY },
  ]
  const gridX = [] as number[]; for (let x = XMIN; x <= XMAX; x++) gridX.push(x)
  const gridY = [] as number[]; for (let y = YMIN; y <= YMAX; y++) gridY.push(y)

  return (
    <div className="card">
      <h3>逆运动学 IK <span className="hint">末端目标 → 关节角：可能多解(肘上/肘下)、无解(够不到)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={`scdn ${reachable ? '' : 'sk-neg'}`}>{r}</span><span className="scdl">目标距离 r（可达 [{reachLo},{reachHi}]）</span></div>
          <div className="scdk"><span className="scdn">{cosTheta2}</span><span className="scdl">cosθ2</span></div>
          <div className="scdk"><span className={`scdn ${solutions.length >= 2 ? 'hot' : 'sk-neg'}`}>{solutions.length}</span><span className="scdl">解数 · 肘上/肘下</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
            {gridX.map(x => <line key={'gx' + x} x1={sx(x)} y1={sy(YMIN)} x2={sx(x)} y2={sy(YMAX)} className="fk-grid" />)}
            {gridY.map(y => <line key={'gy' + y} x1={sx(XMIN)} y1={sy(y)} x2={sx(XMAX)} y2={sy(y)} className="fk-grid" />)}
            {/* 可达圆环：外圈 L1+L2、内圈 |L1-L2| */}
            <circle cx={sx(0)} cy={sy(0)} r={reachHi * SCALE} className="ik-reach" />
            {reachLo > 0 && <circle cx={sx(0)} cy={sy(0)} r={reachLo * SCALE} className="ik-reach" />}
            <line x1={sx(XMIN)} y1={sy(0)} x2={sx(XMAX)} y2={sy(0)} className="fk-axis" />
            <line x1={sx(0)} y1={sy(YMIN)} x2={sx(0)} y2={sy(YMAX)} className="fk-axis" />
            {/* 两支解同屏画出：肘朝下=琥珀、肘朝上=蓝（奇异合并时只剩一支） */}
            {solutions.map((s, si) => {
              const arm = armOf(s)
              return (
                <g key={'arm' + si}>
                  {arm.slice(0, -1).map((p, i) => {
                    const q = arm[i + 1]!
                    return <line key={i} x1={sx(p.x)} y1={sy(p.y)} x2={sx(q.x)} y2={sy(q.y)} className={`fk-link ${si === 0 ? '' : 'alt'}`} />
                  })}
                  {arm.map((p, i) => <circle key={'c' + i} cx={sx(p.x)} cy={sy(p.y)} r={i === 1 ? 5 : 4} className={`fk-joint ${i === 0 ? 'base' : ''}`} />)}
                </g>
              )
            })}
            {/* 目标标记 */}
            <g>
              <circle cx={sx(target.x)} cy={sy(target.y)} r={8} className="ik-target" />
              <text x={sx(target.x) + 11} y={sy(target.y) - 7} className="fk-lbl">目标 ({target.x},{target.y})</text>
            </g>
            <polygon points={`${sx(0) - 9},${sy(0) + 14} ${sx(0) + 9},${sy(0) + 14} ${sx(0)},${sy(0)}`} className="fk-mount" />
          </svg>

          <div className="fk-side">
            <div className="fk-conf">
              <div className="fk-chead">解（各关节角）</div>
              {solutions.length === 0 ? <div className="fk-crow" style={{ color: 'var(--faint)' }}>求解中…</div>
                : solutions.map((s, i) => (
                  <div key={i} className={`fk-crow ${curBranch === i ? 'now' : ''} done`} style={{ flexWrap: 'wrap' }}>
                    <span className="fk-cj">{s.branch.split(' ')[0]}</span>
                    <span className="fk-ct">θ1={s.th1}°</span>
                    <span className="fk-ct">θ2={s.th2}°</span>
                    <span className="fk-cok" title={`回代 FK=(${s.checkX},${s.checkY})`}>FK✓</span>
                  </div>
                ))}
            </div>
            <div className={`ik-reachbox ${reachable ? 'ok' : 'no'}`}>
              r={r} {reachable ? '∈' : '∉'} [{reachLo}, {reachHi}] → {reachable ? '够得到' : '够不到(无解)'}
            </div>
          </div>
        </div>

        <p className="scnote" style={{ opacity: reachable ? 1 : .95 }}>{focus}。{
          !reachable ? '目标超出可达圆环 [|L1−L2|, L1+L2]——手臂伸直也够不到，这就是 IK 的无解。'
            : solutions.length === 1 ? '目标正好在最大伸展处 r=L1+L2：θ2=0、两支解合并成一个——这就是奇异，手臂瞬间丢一个自由度、J⁻¹ 爆炸。'
              : '琥珀=肘朝下、蓝=肘朝上，两种姿势够到同一点——IK 的多解。把目标拉远它俩会靠拢，到最大伸展合并，再远就无解。对比 FK 唯一解：IK 可能多解/无解/奇异，选哪组看约束(避障/关节限位)；多轴臂用数值 IK。'
        }</p>
      </div>
    </div>
  )
}
