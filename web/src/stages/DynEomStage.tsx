/** 舞台：机械臂运动方程 —— M(q) 2×2 矩阵(非对角=耦合高亮) + 三项(惯性/科氏/重力)逐列现算汇成 τ */
import type { DynState } from '@engine/kernels/dyneom.ts'
import type { StageProps } from '../types.ts'

const z = (x: number) => (Object.is(x, -0) ? 0 : x)

export function DynEomStage({ state }: StageProps<DynState>) {
  const s = state
  const { M, Cqd, G, Mqdd, tau, qd, qdd, alpha, beta, delta, showM, showC, showG, showTau } = s

  return (
    <div className="card">
      <h3>机械臂运动方程 <span className="hint">M(q)q̈ + C(q,q̇)q̇ + G(q) = τ：惯性耦合 + 科氏/离心 + 重力，写进一条方程</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{s.motionLabel.split('(')[0]}</span><span className="scdl">运动状态</span></div>
          <div className="scdk"><span className="scdn">[{s.q1}°,{s.q2}°]</span><span className="scdl">构型 q</span></div>
          <div className="scdk"><span className={`scdn${showTau ? ' dy-hot' : ''}`}>{showTau ? z(tau[0]) : '—'}<em className="cc-u"> N·m</em></span><span className="scdl">关节1 力矩 τ₁</span></div>
          <div className="scdk"><span className={`scdn${showTau ? ' dy-hot' : ''}`}>{showTau ? z(tau[1]) : '—'}<em className="cc-u"> N·m</em></span><span className="scdl">关节2 力矩 τ₂</span></div>
        </div>

        {/* 质量矩阵 M(q) */}
        {showM && (
          <div className="dy-massblk">
            <div className="dy-mh">质量矩阵 M(q)　<span className="dy-consts">α={alpha}　β={beta}　δ={delta}</span></div>
            <div className="dy-matrix">
              <div className="dy-mbr">[</div>
              <table className="dy-mtable">
                <tbody>
                  <tr><td>{M[0][0]}</td><td className="dy-coup">{M[0][1]}</td></tr>
                  <tr><td className="dy-coup">{M[1][0]}</td><td>{M[1][1]}</td></tr>
                </tbody>
              </table>
              <div className="dy-mbr">]</div>
              <div className="dy-mnote">对角=各关节自身惯性；<b className="dy-coupt">非对角 {M[0][1]}≠0 = 关节耦合</b>（动一个甩另一个）。M 随 q2 变（cos q2）——姿势不同、惯性就不同。</div>
            </div>
          </div>
        )}

        {/* 三项汇成 τ */}
        <div className="dy-eq">
          <div className="dy-eqh">τ = M·q̈ <span className="dy-op">+</span> C(q,q̇)·q̇ <span className="dy-op">+</span> G(q)</div>
          <table className="dy-terms">
            <thead>
              <tr>
                <th className="l">关节</th>
                <th className={showTau ? 'dy-inertia' : 'off'}>惯性 M·q̈<br /><em>q̈=[{qdd[0]},{qdd[1]}]</em></th>
                <th className={showC ? 'dy-cor' : 'off'}>科氏/离心 C·q̇<br /><em>q̇=[{qd[0]},{qd[1]}]</em></th>
                <th className={showG ? 'dy-grav' : 'off'}>重力 G</th>
                <th className={showTau ? 'dy-tau' : 'off'}>= τ</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1].map(j => (
                <tr key={j}>
                  <td className="l">关节{j + 1}</td>
                  <td className={showTau ? 'dy-inertia' : 'off'}>{showTau ? z(Mqdd[j]!) : '—'}</td>
                  <td className={showC ? 'dy-cor' : 'off'}>{showC ? z(Cqd[j]!) : '—'}</td>
                  <td className={showG ? 'dy-grav' : 'off'}>{showG ? z(G[j]!) : '—'}</td>
                  <td className={showTau ? 'dy-tau' : 'off'}>{showTau ? <b>{z(tau[j]!)}</b> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {showG && !showTau && <div className="dy-note">静止举着(q̇=q̈=0)也要输出 τ=G=[{z(G[0])}, {z(G[1])}]：关节1 得 <b>{z(G[0])} N·m</b> 顶住整条臂的重力——这就是为什么伺服要「重力补偿」。</div>}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>M(q)q̈ + C(q,q̇)q̇ + G(q) = τ 是刚体动力学的中枢</b>：M 惯性(非对角=耦合、随构型变)、C·q̇ 科氏+离心(∝q̇²、只在运动时)、G 重力(静止也要顶)。<b>连</b>：逆动力学 RNEA 高效算这条 τ；计算力矩控制用它抵消非线性；正向动力学反解 q̈=M⁻¹(τ−Cq̇−G)；重力补偿只前馈 G。面试：为何不能当 n 个独立 PID（耦合+重力+科氏）；M 为何对称正定。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
