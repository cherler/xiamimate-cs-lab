/** 舞台：策略梯度 —— 动作概率条(采样前/后) + softmax/采样/梯度/更新 逐块；带基线压差动作 vs 不带误强化 */
import type { PgState } from '@engine/kernels/policygrad.ts'
import type { StageProps } from '../types.ts'

export function PolicyGradStage({ state }: StageProps<PgState>) {
  const s = state
  const { baseLabel, base, acts, rewards, pi, sampled, rS, b, adv, weight, gradLog, thetaNew, piNew, showPolicy, showSample, showGrad, showUpdate } = s
  const down = piNew[sampled]! < pi[sampled]!

  return (
    <div className="card">
      <h3>策略梯度 REINFORCE <span className="hint">直接参数化策略 π_θ，把导致高回报的动作概率往上推；基线/优势降方差</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{baseLabel.split('(')[0]}</span><span className="scdl">基线</span></div>
          <div className="scdk"><span className={`scdn${showSample ? (adv < 0 ? ' pg-bad' : ' pg-good') : ''}`}>{showSample ? adv : '—'}</span><span className="scdl">优势 A=G−b</span></div>
          <div className="scdk"><span className="scdn">{showGrad ? weight : '—'}</span><span className="scdl">更新权重</span></div>
          <div className="scdk"><span className={`scdn${showUpdate ? (down ? ' pg-good' : ' pg-bad') : ''}`}>{showUpdate ? piNew[sampled] : pi[sampled]}</span><span className="scdl">π({acts[sampled]}) {showUpdate ? (down ? '↓压低✓' : '↑推高✗') : ''}</span></div>
        </div>

        {showPolicy && (
          <div className="pg-bars">
            {acts.map((a, k) => (
              <div key={k} className="pg-row">
                <span className="pg-albl">{a}<em>（回报 {rewards[k]}{k === sampled ? '，采到' : ''}）</em></span>
                <div className="pg-track">
                  <div className="pg-fill pg-before" style={{ width: `${pi[k]! * 100}%` }}><span>{pi[k]}</span></div>
                  {showUpdate && <div className={`pg-fill pg-after${k === sampled ? (down ? ' pg-af-down' : ' pg-af-up') : ''}`} style={{ width: `${piNew[k]! * 100}%` }}><span>{piNew[k]}</span></div>}
                </div>
              </div>
            ))}
            <div className="pg-barlbl">{showUpdate ? '上=采样前 π，下=更新后 π' : '采样前 π'}</div>
          </div>
        )}

        <div className="pg-flow">
          <div className={`pg-blk${showSample ? '' : ' pg-off'}`}>
            <span className="pg-n">采样</span> {showSample ? <>按 π 采到 <b>{acts[sampled]}</b>（回报 G={rS}，较差）；基线 b=Σπ·R={b}，优势 A=G−b=<b className={adv < 0 ? 'pg-r' : 'pg-g'}>{adv}</b></> : '—'}
          </div>
          <div className={`pg-blk${showGrad ? '' : ' pg-off'}`}>
            <span className="pg-n">梯度</span> {showGrad ? <>∇log π({acts[sampled]})=onehot−π=[{gradLog.join(', ')}]，权重={base === 'on' ? <>优势 A=<b>{adv}</b></> : <>回报 G=<b>{rS}</b></>}</> : '—'}
          </div>
          <div className={`pg-blk${showUpdate ? '' : ' pg-off'}`}>
            <span className="pg-n">更新</span> {showUpdate ? <>θ←θ+α·权重·∇logπ=[{thetaNew.join(', ')}] → π({acts[sampled]}) {pi[sampled]}→<b className={down ? 'pg-g' : 'pg-r'}>{piNew[sampled]}</b>（{base === 'on' ? 'A<0 压低差动作 ✓' : 'G>0 误推高差动作 ✗'}）</> : '—'}
          </div>
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>策略梯度 = 把好动作的概率推上去</b>：∇J=E[∇log π·G]，REINFORCE 采样估计梯度、上升；天然处理连续动作(值方法难 argmax)。<b>基线/优势</b> A=G−b 降方差、正确压制低于平均的动作(→actor-critic：actor=π、critic=V 当基线)。<b>on-policy</b>(样本用完即扔)。<b>痛点→PPO</b>：步子难调，PPO 用裁剪的替代目标把更新限在信任域、稳且样本更省——<b>miniduck 用的就是 PPO</b>。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
