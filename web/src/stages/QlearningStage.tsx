/** 舞台：Q-learning —— 状态链(Q值) + TD更新卡 + 一回合vs收敛对比(=值迭代V*) */
import type { QState } from '@engine/kernels/qlearning.ts'
import type { StageProps } from '../types.ts'

export function QlearningStage({ state }: StageProps<QState>) {
  const s = state
  const { alLabel, alpha, gamma, td, q1ep, qConv, showQ, showTd, showEp, showConv } = s
  const chain = ['A', 'B', 'C', 'G']
  const shownQ: Record<string, number> = showConv ? qConv : showEp ? q1ep : { A: 0, B: 0, C: 0 }

  return (
    <div className="card">
      <h3>Q-learning · 免模型强化学习 <span className="hint">不知道模型，从经验 (s,a,r,s') 学 Q(s,a)：TD 更新、off-policy</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">α={alpha}</span><span className="scdl">学习率（{alLabel.split('(')[0].replace('α=' + alpha, '')}）</span></div>
          <div className="scdk"><span className={`scdn${showTd ? ' ql-hot' : ''}`}>{showTd ? td.delta : '—'}</span><span className="scdl">TD 误差 δ</span></div>
          <div className="scdk"><span className={`scdn${showTd ? ' ql-hot' : ''}`}>{showTd ? td.newQ : '—'}</span><span className="scdl">Q(C,→) 首次更新</span></div>
          <div className="scdk"><span className={`scdn${showConv ? ' ql-good' : ''}`}>{showConv ? qConv.A : '—'}</span><span className="scdl">收敛 Q(A)=V*(A)</span></div>
        </div>

        {showQ && (
          <svg className="ql-svg" viewBox="0 0 320 58" width="100%" height="72">
            {chain.map((st, k) => {
              const x = 40 + k * 78, y = 26, isG = st === 'G'
              return (
                <g key={st}>
                  {k < 3 && <line x1={x + 15} y1={y} x2={x + 63} y2={y} className="ql-arrow" />}
                  {k < 3 && <text x={x + 39} y={y - 6} className="ql-albl">{k === 2 ? 'r=+1' : 'r=0'}</text>}
                  <circle cx={x} cy={y} r="15" className={isG ? 'ql-goal' : 'ql-node'} />
                  <text x={x} y={y + 4} className="ql-nlbl">{st}</text>
                  {!isG && <text x={x} y={y + 28} className={`ql-val${showConv ? ' ql-vhot' : ''}`}>Q={shownQ[st]}</text>}
                  {isG && <text x={x} y={y + 28} className="ql-gt">目标</text>}
                </g>
              )
            })}
          </svg>
        )}

        <div className="ql-flow">
          <div className={`ql-blk${showTd ? '' : ' ql-off'}`}>
            <span className="ql-n">TD</span> Q(s,a)←Q+α·[r+γ·max Q(s',·)−Q] {showTd ? <>：经验 C→G，δ=r+γ·max Q(G)−Q(C,→)={td.r}+{gamma}·{td.maxNext}−{td.oldQ}=<b className="ql-g">{td.delta}</b>，Q(C,→)←0+α·{td.delta}=<b className="ql-g">{td.newQ}</b></> : '—'}<em className="ql-sub">δ=TD 误差(自举)；α=学习率；走一步更一次</em>
          </div>
          <div className={`ql-blk${showEp ? '' : ' ql-off'}`}>
            <span className="ql-n">1回合</span> {showEp ? <>只有紧挨奖励的 C 学到 <b>{q1ep.C}</b>（A={q1ep.A}、B={q1ep.B} 还是 0）——<b>奖励每回合往回传一步</b></> : '—'}<em className="ql-sub">B 要等 C 有值、下回合才学得到（催生经验回放/资格迹）</em>
          </div>
          {showConv && (
            <div className="ql-conv">
              <span className="ql-n">收敛</span> 多回合后 Q(·,→)=[A:{qConv.A}, B:{qConv.B}, C:{qConv.C}] —— <b>和「MDP 值迭代」的 V*=γ^步数·1 一模一样</b>，但<b>免模型</b>(不知 P/R)、从经验渐进学。α 大快但抖、α 小慢但稳，都收敛到同一答案。<b>off-policy</b>：更新用 max(贪心目标策略)、行为带 ε-greedy 探索。
            </div>
          )}
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>Q-learning = 免模型 + TD + off-policy</b>：从经验 (s,a,r,s') 学 Q，TD 更新 Q←Q+α[r+γmax Q(s')−Q]（自举、走一步更一次），off-policy(更新用 max、行为带探索)，收敛到和值迭代一样的 Q*。<b>探索 vs 利用</b>：ε-greedy 平衡。<b>升级</b>：状态大/连续 → DQN(神经网络近似 Q+经验回放)、连续动作 → 策略梯度/PPO/SAC。<b>连</b>：「MDP」是有模型版；「miniduck」用 PPO 学走路。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
