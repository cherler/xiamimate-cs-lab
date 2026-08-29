/** 舞台：阻抗/力控 —— 1D 轨道上末端(块)被软弹簧拉向目标、遇墙柔顺贴住；接触力对比 刚性(砸) vs 柔顺(贴) */
import type { ImpState } from '@engine/kernels/impedance.ts'
import type { StageProps } from '../types.ts'

const W = 380, H = 96, PADX = 20
const XMAXV = 9
const px = (x: number) => PADX + (x / XMAXV) * (W - 2 * PADX)

export function ImpedanceStage({ state }: StageProps<ImpState>) {
  const { phase, op, xCmd, xWall, K, D, stiffForce, t, x, contactForce, penetration, focus } = state
  const done = phase === 'done'
  const isStiff = phase === 'stiff'
  const armX = px(x)
  const wallX = px(xWall)
  const tgtX = px(xCmd)
  // 弹簧折线（arm→target）
  const coil = () => {
    const x0 = armX, x1 = tgtX, n = 7, pts = []
    for (let i = 0; i <= n; i++) { const fx = x0 + (x1 - x0) * (i / n); const dy = i === 0 || i === n ? 0 : (i % 2 ? -6 : 6); pts.push(`${fx},${H / 2 + dy}`) }
    return pts.join(' ')
  }
  const maxForce = Math.max(stiffForce, 1)

  return (
    <div className="card">
      <h3>阻抗 / 力控 <span className="hint">末端像虚拟弹簧-阻尼：遇阻柔顺让步，接触力=K×侵入、可调</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{isStiff ? '刚性位置控制' : done ? '柔顺·稳定' : phase === 'compliant' ? '阻抗控制' : '就绪'}</span><span className="scdl">模式</span></div>
          <div className="scdk"><span className={`scdn ${contactForce > 200 ? 'sk-neg' : contactForce > 0 ? 'km-dn' : ''}`}>{contactForce}N</span><span className="scdl">接触力</span></div>
          <div className="scdk"><span className="scdn">{penetration}</span><span className="scdl">侵入墙深度</span></div>
        </div>

        {/* 1D 轨道 */}
        <svg className="fk-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ marginBottom: 10 }}>
          <line x1={px(0)} y1={H / 2} x2={px(XMAXV)} y2={H / 2} className="imp-track" />
          {/* 墙 */}
          <rect x={wallX} y={12} width={W - wallX - PADX + 6} height={H - 24} className="imp-wall" />
          <text x={wallX + 4} y={22} className="imp-lbl">墙 x={xWall}</text>
          {/* 目标 */}
          <line x1={tgtX} y1={16} x2={tgtX} y2={H - 16} className="imp-tgt" />
          <text x={tgtX} y={H - 4} className="imp-lbl" textAnchor="middle">目标 x={xCmd}</text>
          {/* 弹簧 */}
          {!isStiff && <polyline points={coil()} className="imp-spring" />}
          {/* 末端块 */}
          <rect x={armX - 9} y={H / 2 - 12} width={18} height={24} className={`imp-arm ${contactForce > 200 ? 'slam' : ''}`} />
          <text x={armX} y={H / 2 - 16} className="imp-lbl" textAnchor="middle">末端 {x}</text>
        </svg>

        {/* 接触力对比 */}
        <div className="imp-cmp">
          <div className="imp-bar">
            <span className="imp-bl">刚性(位置控制)</span>
            <div className="imp-track2"><div className="imp-fill slam" style={{ width: `${(stiffForce / maxForce) * 100}%` }} /></div>
            <span className="imp-bv slam">{stiffForce}N</span>
          </div>
          <div className="imp-bar">
            <span className="imp-bl">柔顺(阻抗控制)</span>
            <div className="imp-track2"><div className="imp-fill soft" style={{ width: `${((done ? contactForce : phase === 'compliant' ? contactForce : 0) / maxForce) * 100}%` }} /></div>
            <span className="imp-bv soft">{done || phase === 'compliant' ? contactForce : 0}N</span>
          </div>
        </div>

        {done
          ? <p className="scnote">同一命令(去 x={xCmd})、同一堵墙：<b>刚性 {stiffForce}N（砸）vs 柔顺 {contactForce}N（贴）</b>。阻抗控制让末端像<b>弹簧-阻尼</b> F=K·Δx−D·ẋ、遇阻柔顺让步；<b>接触力≈K×侵入，K 是你设的旋钮</b>(软=轻贴/吸冲击/对人安全)。变体：导纳控制、混合力/位控(打磨:沿面控位、压向控力)、直接力控。靠力矩/力传感器测力。装配、打磨、拧螺丝、协作机器人的核心。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{isStiff ? '位置控制刚度高：为把位置误差压到 0 会死命顶墙，输出巨大接触力、砸坏工件。' : phase === 'compliant' ? '末端像软弹簧被拉向目标，遇墙柔顺贴住而非硬顶；接触力小而可控。' : '命令末端去墙后面的目标，比刚性硬顶和柔顺贴合的接触力。'}</p>}
      </div>
    </div>
  )
}
