/** 舞台：ACT 动作分块·时序集成 —— 某动作的重叠预测+权重、集成结果，以及整条轨迹(真值/最新/集成)对比 */
import type { ActState, Vote } from '@engine/kernels/actte.ts'
import type { StageProps } from '../types.ts'

function Spark({ trues, newest, ens }: { trues: number[]; newest: number[]; ens: number[] }) {
  const all = [...trues, ...newest, ...ens]
  const lo = Math.min(...all), hi = Math.max(...all), W = 360, H = 84, pad = 8
  const x = (i: number, n: number) => pad + (i / (n - 1)) * (W - 2 * pad)
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad)
  const path = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i, arr.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="at-spark" preserveAspectRatio="xMidYMid meet">
      <path d={path(trues)} className="at-true" />
      <path d={path(newest)} className="at-newest" />
      <path d={path(ens)} className="at-ens" />
    </svg>
  )
}

export function ActTeStage({ state }: StageProps<ActState>) {
  const { stage, mKey, m, K, detailT, votes, ensembled, newest, trajTrue, trajNewest, trajEns } = state
  const showVotes = stage === 'overlap' || stage === 'ensemble'
  const showEns = stage === 'ensemble'
  const showTraj = stage === 'traj' || stage === 'done'

  return (
    <div className="card">
      <h3>ACT · 动作分块 + 时序集成 <span className="hint">预测一整块动作、把重叠预测加权平均，治抖动与复合误差</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">K={K}</span><span className="scdl">动作块长</span></div>
          <div className="scdk"><span className="scdn">{mKey}<em className="cc-u"> m={m}</em></span><span className="scdl">集成权重</span></div>
          <div className="scdk"><span className={`scdn ${showEns ? 'good' : ''}`}>{showEns ? `a${detailT}=${ensembled}` : showVotes ? `${votes.length} 条重叠` : '—'}</span><span className="scdl">本步</span></div>
        </div>

        {showVotes && (
          <div className="at-votes">
            <div className="at-h">动作 a{detailT} 的重叠预测（好几块都预测了它，旧→新）</div>
            {votes.map((v: Vote, idx: number) => (
              <div key={v.chunk} className={`at-v ${idx === 0 ? 'old' : idx === votes.length - 1 ? 'new' : ''}`}>
                <span className="at-vc">第 {v.chunk} 步的块{idx === 0 ? '（最旧）' : idx === votes.length - 1 ? '（最新）' : ''}</span>
                <span className="at-vval">预测 {v.val}</span>
                <span className="at-vw">权重 w={v.w}{showEns && ` → ${v.val}×${v.w}`}</span>
              </div>
            ))}
            {showEns
              ? <div className="at-result">集成 a{detailT} = Σ(值×权重)/Σ权重 = <b>{ensembled}</b> <span className="at-cmp">（只用最新那条 = {newest}，真值≈{trajTrue[detailT]}）</span></div>
              : <div className="at-note">它们互相不一致 → 单看最新那条（{newest}）会抖。下一步加权集成抹平。</div>}
          </div>
        )}

        {showTraj && (
          <div className="at-traj">
            <Spark trues={trajTrue} newest={trajNewest} ens={trajEns} />
            <div className="at-legend"><span className="at-l-true">真值</span><span className="at-l-newest">只用最新（抖）</span><span className="at-l-ens">时序集成（平滑）</span></div>
            <div className="at-rows">
              <div><b>真值</b>&nbsp;[{trajTrue.join(', ')}]</div>
              <div className="at-r-new"><b>最新</b>&nbsp;[{trajNewest.join(', ')}]</div>
              <div className="at-r-ens"><b>集成</b>&nbsp;[{trajEns.join(', ')}]</div>
            </div>
          </div>
        )}

        {stage === 'done'
          ? <p className="scnote"><b>动作分块 ≠ 时序集成</b>：分块=一次预测 K 个(有效时域 T→T/K、治复合误差)；集成=把重叠的多条预测加权平均(抹抖动)。权重 <b>w_i=exp(-m·i)</b>、最旧 w₀；m 默认 0.01≈均匀略偏旧。⚠️ <b>八股陷阱：LeRobot 默认关时序集成</b>(走队列 receding-horizon)——读配置别只读论文。ACT 还用 CVAE 潜变量吸收人类示范多样性(测试 z=0)。连「模仿学习·行为克隆」的复合误差；对比 Diffusion Policy(迭代去噪)。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
