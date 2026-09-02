/** 舞台：MDP 值迭代 —— 状态链(A→B→C→G+值+策略) + 值迭代表(值从G往回传) + 贝尔曼备份 */
import type { MdpState } from '@engine/kernels/mdp.ts'
import type { StageProps } from '../types.ts'

export function MdpStage({ state }: StageProps<MdpState>) {
  const s = state
  const { gamLabel, gamma, iters, vFinal, policy, nIters, bkC, showComp, showBellman, showIter, showConv } = s
  const chain = ['A', 'B', 'C', 'G']
  const shownV = showConv ? vFinal : showIter ? iters[iters.length - 1]! : iters[0]!

  return (
    <div className="card">
      <h3>MDP + 贝尔曼方程 · 值迭代 <span className="hint">强化学习地基：V(s)=max_a[R+γV(s')]，值从目标一步步往回传</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">γ={gamma}</span><span className="scdl">折扣（{gamLabel.split(' ')[0]}）</span></div>
          <div className="scdk"><span className="scdn">{showIter ? nIters : '—'}</span><span className="scdl">收敛扫描次数</span></div>
          <div className="scdk"><span className={`scdn${showConv ? ' md-hot' : ''}`}>{showConv ? vFinal.A : '—'}</span><span className="scdl">V(A)=γ²·1</span></div>
          <div className="scdk"><span className="scdn">{showConv ? '全 →' : '—'}</span><span className="scdl">最优策略 π*</span></div>
        </div>

        {/* 状态链 */}
        {showComp && (
          <svg className="md-svg" viewBox="0 0 320 66" width="100%" height="80">
            {chain.map((st, k) => {
              const x = 40 + k * 78, y = 30
              const isG = st === 'G'
              return (
                <g key={st}>
                  {k < 3 && <line x1={x + 15} y1={y} x2={x + 63} y2={y} className="md-arrow" markerEnd="" />}
                  {k < 3 && <text x={x + 39} y={y - 6} className="md-albl">{k === 2 ? '+1' : '0'}</text>}
                  <circle cx={x} cy={y} r="15" className={isG ? 'md-goal' : 'md-node'} />
                  <text x={x} y={y + 4} className="md-nlbl">{st}</text>
                  {!isG && <text x={x} y={y + 30} className={`md-val${showConv ? ' md-vhot' : ''}`}>V={shownV[st]}</text>}
                  {showConv && !isG && <text x={x} y={y + 44} className="md-pol">{policy[st]}</text>}
                  {isG && <text x={x} y={y + 30} className="md-gt">目标</text>}
                </g>
              )
            })}
          </svg>
        )}

        <div className="md-flow">
          <div className={`md-blk${showBellman ? '' : ' md-off'}`}>
            <span className="md-n">备份</span> 贝尔曼 V(s)=max_a[R+γV(s')]，以 C 为例 {showBellman ? <>：max(→: 1+γ·V(G)=<b>1</b>, ←: 0+γ·V(B)={bkC.left}) = <b className="md-g">1</b></> : '—'}
          </div>
          {showIter && (
            <div className="md-itbox">
              <div className="md-ith">值迭代：每次扫描后的 V（值从目标 G 往回传）</div>
              <table className="md-ittable">
                <thead><tr><th>扫描</th><th>A</th><th>B</th><th>C</th></tr></thead>
                <tbody>
                  {iters.map((v, k) => (
                    <tr key={k} className={k === iters.length - 1 ? 'md-final' : ''}>
                      <td>iter{k}</td>
                      <td className={v.A !== (iters[k - 1]?.A ?? -1) ? 'md-changed' : ''}>{v.A}</td>
                      <td className={v.B !== (iters[k - 1]?.B ?? -1) ? 'md-changed' : ''}>{v.B}</td>
                      <td className={v.C !== (iters[k - 1]?.C ?? -1) ? 'md-changed' : ''}>{v.C}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showConv && (
            <div className="md-conv">
              <span className="md-n">收敛</span> V*=[A:{vFinal.A}, B:{vFinal.B}, C:{vFinal.C}]，即 <b>γ^(到G步数)·1</b>；最优策略 argmax=全部 →。<b>γ={gamma}</b>：γ 越大越远视（远处 +1 也看重）、越小越短视。
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>MDP+贝尔曼 = 强化学习地基</b>：MDP⟨S,A,P,R,γ⟩、最大化累积折扣回报；贝尔曼 V*(s)=max_a[R+γV*(s')]；值迭代反复备份、值从目标往回传、argmax 得最优策略；γ 折扣平衡近远期。<b>V vs Q</b>：Q(s,a) 更常用(argmax Q 直接给策略、免转移模型)。<b>有模型(值迭代要知 P/R) vs 免模型</b>(「Q-learning」从经验学)。<b>连</b>：Q-learning/PPO/SAC 都建在这上面；「miniduck」用 PPO 学走路。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
