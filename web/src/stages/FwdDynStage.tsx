/** 舞台：正向动力学 —— 偏置 b=Cq̇+G / 质量矩阵 M 与逆 / q̈=M⁻¹(τ−b) / 半隐式欧拉积分，逐块现算 */
import type { FwdState } from '@engine/kernels/fwddyn.ts'
import type { StageProps } from '../types.ts'

const z = (x: number) => (Object.is(x, -0) ? 0 : x)
const r2 = (x: number) => { const v = Math.round(x * 100) / 100; return Object.is(v, -0) ? 0 : v }
const Mat = ({ m }: { m: [[number, number], [number, number]] }) => (
  <span className="fw-mat"><i>[</i><table className="fw-mt"><tbody><tr><td>{m[0][0]}</td><td>{m[0][1]}</td></tr><tr><td>{m[1][0]}</td><td>{m[1][1]}</td></tr></tbody></table><i>]</i></span>
)

export function FwdDynStage({ state }: StageProps<FwdState>) {
  const s = state
  const { tqLabel, tau, Cqd, G, bias, M, detM, Minv, qdd, dt, qd, qdNext, qNext, showBias, showMinv, showQdd, showInteg } = s

  return (
    <div className="card">
      <h3>正向动力学 · 仿真 <span className="hint">给力矩 τ 求加速度 q̈=M⁻¹(τ−Cq̇−G)：物理仿真每一步在做的事</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{tqLabel.split('(')[0]}</span><span className="scdl">施加力矩 τ=[{tau}]</span></div>
          <div className="scdk"><span className="scdn">{showMinv ? detM : '—'}</span><span className="scdl">det M(SPD→可逆)</span></div>
          <div className="scdk"><span className={`scdn${showQdd ? ' fw-hot' : ''}`}>{showQdd ? z(qdd[0]) : '—'}</span><span className="scdl">q̈₁ rad/s²</span></div>
          <div className="scdk"><span className={`scdn${showQdd ? ' fw-hot' : ''}`}>{showQdd ? z(qdd[1]) : '—'}</span><span className="scdl">q̈₂ rad/s²</span></div>
        </div>

        <div className="fw-flow">
          <div className={`fw-blk${showBias ? '' : ' fw-off'}`}>
            <span className="fw-n">①</span> 偏置 b = C q̇ + G ={showBias ? <> [{Cqd}] + [{G}] = <b>[{bias}]</b></> : ' —'}<em className="fw-sub">速度+重力项，=一次 q̈=0 的 RNEA</em>
          </div>

          <div className={`fw-blk${showMinv ? '' : ' fw-off'}`}>
            <span className="fw-n">②</span> 质量矩阵 {showMinv ? <>M = <Mat m={M} />，det={detM}≠0 可逆，M⁻¹ = <Mat m={Minv} /></> : '—'}<em className="fw-sub">M 对称正定；实际用 Cholesky 解、大自由度用 ABA(O(n))</em>
          </div>

          <div className={`fw-blk${showQdd ? '' : ' fw-off'}`}>
            <span className="fw-n">③</span> 解 q̈ = M⁻¹·(τ − b) ={showQdd ? <> M⁻¹·[{r2(tau[0] - bias[0])}, {r2(tau[1] - bias[1])}] = <b className="fw-qdd">[{z(qdd[0])}, {z(qdd[1])}]</b> rad/s²</> : ' —'}
          </div>

          <div className={`fw-blk${showInteg ? '' : ' fw-off'}`}>
            <span className="fw-n">④</span> 半隐式欧拉积分（dt={dt}s）{showInteg ? <>：q̇←q̇+q̈·dt=<b>[{qdNext}]</b>，q←q+q̇·dt=<b>[{qNext}]°</b></> : ' —'}<em className="fw-sub">= 物理仿真器循环里的一步</em>
          </div>
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>正向动力学 q̈=M⁻¹(τ−Cq̇−G) = 仿真的心脏</b>：①偏置 b=Cq̇+G(一次 RNEA)②M 对称正定→可逆(Cholesky 解、大自由度 ABA O(n))③解 q̈ ④半隐式欧拉积分一步。<b>正向</b>(给力矩求运动)=仿真、<b>逆</b>(RNEA 给运动求力矩)=控制，二者互逆(round-trip 精确还原)。<b>连</b>：MuJoCo/Bullet 核心就是这循环；MPC 靠它预测未来；RL 在仿真里跑的也是它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
