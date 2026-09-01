/** 舞台：计算力矩控制 —— 误差 e,ė / 伺服律 v=q̈_d+Kd ė+Kp e / 组力矩 τ(按模式含 M·v/Cq̇/G) / 误差动力学线性or残留 */
import type { CtcState } from '@engine/kernels/computedtorque.ts'
import type { StageProps } from '../types.ts'

const z = (x: number) => (Object.is(x, -0) ? 0 : x)

export function ComputedTorqueStage({ state }: StageProps<CtcState>) {
  const s = state
  const { modeLabel, mode, e, ed, qddDes, Kp, Kd, Mv, Cqd, G, innerV, pdPart, tau, useM, useCor, useGrav, linear, showErr, showLaw, showTau, showDyn } = s

  return (
    <div className="card">
      <h3>计算力矩控制 · 反馈线性化 <span className="hint">用动力学模型 M/C/G 抵消非线性，剩下干净的线性误差动力学 ë+Kd ė+Kp e=0</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{modeLabel.split('(')[0]}</span><span className="scdl">控制模式</span></div>
          <div className="scdk"><span className="scdn">{Kp}/{Kd}</span><span className="scdl">Kp/Kd(=2√Kp 临界)</span></div>
          <div className="scdk"><span className={`scdn${showTau ? ' ct-hot' : ''}`}>{showTau ? z(tau[0]) : '—'}<em className="cc-u"> N·m</em></span><span className="scdl">τ₁</span></div>
          <div className="scdk"><span className={`scdn${showDyn ? (linear ? ' ct-good' : ' ct-bad') : ''}`}>{showDyn ? (linear ? '线性解耦' : '残留非线性') : '—'}</span><span className="scdl">误差动力学</span></div>
        </div>

        <div className="ct-flow">
          <div className={`ct-blk${showErr ? '' : ' ct-off'}`}>
            <span className="ct-n">①</span> 跟踪误差 {showErr ? <>e=q_d−q=<b>[{e}]</b>，ė=q̇_d−q̇=<b>[{ed}]</b></> : '—'}<em className="ct-sub">Kp={Kp}、Kd={Kd}（=2√Kp 临界阻尼 ζ=1）</em>
          </div>

          <div className={`ct-blk${showLaw ? '' : ' ct-off'}`}>
            <span className="ct-n">②</span> 伺服律 v = q̈_d + Kd·ė + Kp·e {showLaw ? <>= [{qddDes}] + {Kd}·[{ed}] + {Kp}·[{e}] = <b>[{innerV}]</b></> : '—'}<em className="ct-sub">PD 作用在"加速度"上（外环）</em>
          </div>

          <div className={`ct-blk${showTau ? '' : ' ct-off'}`}>
            <span className="ct-n">③</span> 组力矩 τ = {showTau ? (
              <>
                <span className={useM ? 'ct-on' : 'ct-mute'}>M·v{useM ? `=[${Mv}]` : '（无）'}</span>
                <span className="ct-plus">+</span>
                <span className={useCor ? 'ct-on' : 'ct-mute'}>{useCor ? `Cq̇=[${z(Cqd[0])},${z(Cqd[1])}]` : 'Cq̇（无）'}</span>
                <span className="ct-plus">+</span>
                <span className={useGrav ? 'ct-on' : 'ct-mute'}>{useGrav ? `G=[${G}]` : 'G（无）'}</span>
                {!useM && <span className="ct-pd"> ＋ PD=[{pdPart}]</span>}
                <span className="ct-eq"> = <b className="ct-tau">[{z(tau[0])}, {z(tau[1])}]</b> N·m</span>
              </>
            ) : '—'}
          </div>

          {showDyn && (
            <div className={`ct-dyn ${linear ? 'ct-dgood' : 'ct-dbad'}`}>
              {mode === 'ctc'
                ? <><b>④ 代回被控对象：Cq̇+G 抵消、M 约掉 → ë + Kd·ė + Kp·e = 0</b>：每关节独立解耦二阶线性系统，可配极点（Kd=2√Kp 临界阻尼、无超调），<b>一套增益全局适用</b>（无需增益调度）。</>
                : mode === 'gravcomp'
                  ? <><b>④ 只重力补偿</b>：重力被前馈消掉（静止能定住、无稳态下垂），但 M⁻¹ 把增益按构型缩放、<b>科氏没消</b> → 误差动力学<b>仍非线性耦合</b>、高速退化。设定点调节够用、轨迹跟踪差。</>
                  : <><b>④ 纯 PID</b>：重力/惯性耦合/科氏<b>全没抵消</b>，固定增益硬扛 → 强非线性、必须保守整定；重力项还让它<b>稳态下垂</b>（要积分才勉强纠）。</>}
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>计算力矩控制 = 用模型把非线性"拉直"</b>：τ=M(q̈_d+Kd ė+Kp e)+Cq̇+G，M·v 给想要的加速度、<b>Cq̇+G 前馈抵消科氏和重力</b> → 误差动力学 <b>ë+Kd ė+Kp e=0</b>（每关节独立二阶线性、可配极点、一套增益全局用）。三档：计算力矩(全抵消)&gt;只重力补偿(消重力留耦合)&gt;纯PID(啥都不消、稳态下垂)。<b>连</b>：Cq̇+G 前馈=一次 RNEA；是 PID 的模型升级版；要准确模型（误差→自适应/鲁棒计算力矩）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
