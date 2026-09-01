/** 舞台：RNEA 逆动力学 —— 外向扫描(ω/α/a_c)+内向扫描(F/N/τ)两表逐步现算，末步与 M q̈+C q̇+G 对拍 */
import type { RneaState } from '@engine/kernels/rnea.ts'
import type { StageProps } from '../types.ts'

export function RneaStage({ state }: StageProps<RneaState>) {
  const s = state
  const { grav, q, qd, qdd, a0, out, inw, tau, eomTau, showOut, showIn, showVerify } = s
  const match = tau[0] === eomTau[0] && tau[1] === eomTau[1]

  return (
    <div className="card">
      <h3>递归牛顿-欧拉 RNEA <span className="hint">逆动力学：给定 q,q̇,q̈ 两次扫描 O(n) 算关节力矩 τ，不显式组 M/C/G</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{grav === 'on' ? '含重力' : '无重力'}</span><span className="scdl">重力(a₀={grav === 'on' ? '−g' : '0'})</span></div>
          <div className="scdk"><span className="scdn">[{q[0]}°,{q[1]}°]</span><span className="scdl">q / q̇=[{qd}] / q̈=[{qdd}]</span></div>
          <div className="scdk"><span className={`scdn${showIn ? ' rn-hot' : ''}`}>{showIn ? tau[0] : '—'}<em className="cc-u"> N·m</em></span><span className="scdl">τ₁</span></div>
          <div className="scdk"><span className={`scdn${showIn ? ' rn-hot' : ''}`}>{showIn ? tau[1] : '—'}<em className="cc-u"> N·m</em></span><span className="scdl">τ₂</span></div>
        </div>

        <div className="rn-flow">
          {/* 外向 */}
          <div className={`rn-blk${showOut ? '' : ' rn-off'}`}>
            <div className="rn-bh"><span className="rn-dir">外向 ▶</span> base → tip：传运动（ω/α/a_c）　<em className="rn-trick">重力技巧 a₀=[{a0[0]},{a0[1]}]</em></div>
            {showOut ? (
              <table className="rn-table">
                <thead><tr><th className="l">连杆</th><th>ω</th><th>α</th><th>质心加速度 a_c=[x, y]</th></tr></thead>
                <tbody>
                  {out.map(o => <tr key={o.link}><td className="l">连杆{o.link}</td><td>{o.omega}</td><td>{o.alpha}</td><td>[{o.aCom[0]}, {o.aCom[1]}]</td></tr>)}
                </tbody>
              </table>
            ) : <div className="rn-wait">—</div>}
          </div>

          {/* 内向 */}
          <div className={`rn-blk${showIn ? '' : ' rn-off'}`}>
            <div className="rn-bh"><span className="rn-dir rn-up">◀ 内向</span> tip → base：传力（F=m·a_c, N=I·α）→ τ</div>
            {showIn ? (
              <table className="rn-table">
                <thead><tr><th className="l">连杆</th><th>F=m·a_c</th><th>N=I·α</th><th className="rn-tauh">τ</th></tr></thead>
                <tbody>
                  {inw.map(o => <tr key={o.link}><td className="l">连杆{o.link}{o.link === 2 ? '（梢）' : ''}</td><td>[{o.F[0]}, {o.F[1]}]</td><td>{o.N}</td><td className="rn-tauc"><b>{o.tau}</b></td></tr>)}
                </tbody>
              </table>
            ) : <div className="rn-wait">—</div>}
          </div>
        </div>

        {showVerify && (
          <div className={`rn-verify ${match ? 'rn-ok' : 'rn-bad'}`}>
            对拍：RNEA 递归 τ=[{tau[0]}, {tau[1]}]　{match ? '＝' : '≠'}　M q̈+C q̇{grav === 'on' ? '+G' : ''}=[{eomTau[0]}, {eomTau[1]}]　{match ? '✓ 完全一致' : '✗'}——同一套动力学，RNEA 只是 O(n) 递归、没组过 M/C/G 矩阵。
          </div>
        )}

        {s.stage === 'done'
          ? <p className="scnote"><b>RNEA = 逆动力学的实时算法</b>：外向传运动(ω/α/a)、内向传力(F/N/τ)，两次扫描 <b>O(n)</b>、不显式组 M/C/G。<b>重力技巧</b>：基座假加速度 a₀=−g，每连杆自动含自重。结果与「机械臂运动方程」M q̈+C q̇+G 完全一致。<b>连</b>：计算力矩控制的 Cq̇+G 前馈=一次 RNEA；也是 CRBA(读 M 的列)与 ABA(正向动力学)的构件。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
