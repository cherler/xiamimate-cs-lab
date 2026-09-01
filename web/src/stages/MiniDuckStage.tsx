/** 舞台：Open Duck Mini —— 相位/参考步态、腿关节表(q̂ vs q)、奖励分解(−15‖q−q̂‖² 主导)、消融结局横幅 */
import type { DuckState, Leg } from '@engine/kernels/miniduck.ts'
import type { StageProps } from '../types.ts'

export function MiniDuckStage({ state }: StageProps<DuckState>) {
  const { stage, modeLabel, mode, gaitI, N, phaseT, cosp, sinp, cmdV, v, legs, imitJoint, rVel, rImit, alive, reward, imitOn, fallen, outcome, showPhase, showPolicy, showReward, showOutcome } = state
  const outTone = mode === 'imit' ? 'mk-good' : mode === 'velonly' ? 'mk-warn' : 'mk-bad'

  return (
    <div className="card">
      <h3>Open Duck Mini · 学会走路 <span className="hint">BD-X 迷你复刻：腿式 RL + 相位参考步态的「模仿奖励」（≠模仿学习）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{modeLabel.split('(')[0]}</span><span className="scdl">模式</span></div>
          <div className="scdk"><span className="scdn">{showPhase ? phaseT : '—'}</span><span className="scdl">相位 t=(i mod N)/N</span></div>
          <div className="scdk"><span className={`scdn${showReward ? (mode === 'nopolicy' ? ' mk-rbad' : '') : ''}`}>{showReward ? reward : '—'}</span><span className="scdl">本步总奖励 r</span></div>
          <div className="scdk"><span className={`scdn${showOutcome ? (mode === 'imit' ? ' mk-rgood' : ' mk-rbad') : ''}`}>{showOutcome ? (mode === 'imit' ? '直立' : mode === 'velonly' ? '退化步态' : '摔倒') : '—'}</span><span className="scdl">结局</span></div>
        </div>

        {/* 相位条 */}
        {showPhase && (
          <div className="mk-phase">
            <div className="mk-pbar"><div className="mk-pcur" style={{ left: `${(gaitI / N) * 100}%` }} title={`第 ${gaitI}/${N} 步`} /></div>
            <div className="mk-pscale"><span>步态周期起</span><span className="mk-pval">t={phaseT} → φ=(cos {cosp}, sin {sinp})</span><span>止 N={N}</span></div>
          </div>
        )}

        {/* 腿关节表：参考 q̂ vs 实际 q */}
        <div className="mk-wrap">
          <table className="mk-table">
            <thead>
              <tr>
                <th className="l">腿关节</th>
                <th className={showPhase ? '' : 'off'}>参考 q̂(相位索引)</th>
                <th className={showPolicy ? '' : 'off'}>实际 q</th>
                <th className={showPolicy ? '' : 'off'}>偏差 q−q̂</th>
                <th className={showPolicy ? '' : 'off'}>PD 力矩 τ</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((l: Leg, r: number) => {
                const dev = Math.round((l.q - l.qhat) * 1000) / 1000
                return (
                  <tr key={r} className={showPolicy && Math.abs(dev) > 0.1 ? 'mk-devrow' : ''}>
                    <td className="l">{l.name}</td>
                    <td>{showPhase ? l.qhat : '—'}</td>
                    <td>{showPolicy ? l.q : '—'}</td>
                    <td className={showPolicy && Math.abs(dev) > 0.1 ? 'mk-dev' : ''}>{showPolicy ? dev : '—'}</td>
                    <td>{showPolicy ? l.tau : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 奖励分解 */}
        {showReward && (
          <div className="mk-reward">
            <div className="mk-rh">奖励分解　r = 2.5·R_vel {imitOn ? '+ 1.0·R_imit ' : '+ (模仿项消融) '}+ alive</div>
            <div className="mk-rrow"><span className="mk-rk">R_vel</span><span className="mk-rv">exp(−‖v−v*‖²/0.01) = {rVel}</span><span className="mk-rc">v*={cmdV}, v={v} → ×2.5 = {Math.round(2.5 * rVel * 100) / 100}</span></div>
            <div className={`mk-rrow${imitOn ? '' : ' mk-off'}`}><span className="mk-rk">R_imit</span><span className="mk-rv">{imitOn ? <>主导项 <b>−15·‖q−q̂‖²</b>；‖q−q̂‖²={imitJoint} → {rImit}</> : <>本模式消融（权重 0）——偏离参考多远都不扣分</>}</span><span className="mk-rc">{imitOn ? `×1.0 = ${rImit}` : '× 0'}</span></div>
            <div className="mk-rrow"><span className="mk-rk">alive</span><span className="mk-rv">{fallen ? '0（摔了）' : '20（站着不倒）'}</span><span className="mk-rc">+{alive}</span></div>
            <div className="mk-rtot"><span className="mk-rk">合计 r</span><span className="mk-rv" /><span className="mk-rc"><b>{reward}</b></span></div>
          </div>
        )}

        {/* 结局横幅 */}
        {showOutcome && (
          <div className={`mk-out ${outTone}`}>
            <b>{modeLabel} → {outcome}</b>
            <div className="mk-outnote">对照：<b>带模仿</b>=−15‖q−q̂‖² 拉向自然步态、直立摇摆；<b>只velocity</b>=去掉模仿项、reward 看着差不多、步态却退化；<b>无策略</b>=开环 q=q̂ 精确对齐、照样摔（欠驱动浮基没被闭环镇定）。</div>
          </div>
        )}

        {stage === 'done'
          ? <p className="scnote"><b>把整条 LeRobot 线收进一只鸭子</b>：<b>模仿奖励</b>（RL 里相位对齐的参考跟踪项，会探索会恢复）<b>≠模仿学习</b>（ACT/BC 监督克隆示教、累积误差、无恢复）——同词反机制。locomotion 用 RL：新形态没示教者、接触富、要扰动恢复。非对称 actor-critic（critic 看真值、actor 只用 IMU+相位）；主导项 −15‖q−q̂‖² 买自然步态；sim2real 靠作动器辨识+域随机化+随机推搡。PD 是内环、Placo 参考步态是应用 IK。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
