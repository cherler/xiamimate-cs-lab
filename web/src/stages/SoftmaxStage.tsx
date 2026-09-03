/** 舞台：softmax 与温度 —— logits 条 → 概率条，随温度变形 */
import type { SoftmaxState } from '@engine/kernels/softmax.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function SoftmaxStage({ state }: StageProps<SoftmaxState>) {
  const { tokens, logits, scaled, probs, phase, T, entropy } = state
  const showProbs = probs.length > 0
  const showScaled = scaled.length > 0
  const topProb = showProbs ? probs.indexOf(Math.max(...probs)) : -1   // argmax=当前会选中的 token
  const tEffect = T < 1 ? '低温 → 分布更尖、越确定(趋近只选最大)' : T > 1 ? '高温 → 分布更平、越随机有创造性' : '基准温度 T=1(调低更确定、调高更随机)'

  //  上排：logit（或温度缩放后）—— 有正有负，居中基线
  const vals = showScaled && !showProbs ? scaled : logits
  const maxAbs = Math.max(1, ...vals.map(v => Math.abs(v)))

  return (
    <div className="card">
      <h3>softmax <span className="hint">logit（可正可负）→ 概率（非负、和为 1）</span></h3>
      <div className="body">
        {/* 温度是主角：大数条把 温度T / 熵 / 最大概率 摆到最前，一眼看出"尖还是平" */}
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{T}</span><span className="scdl">温度 T</span></div>
          <div className="scdk"><span className="scdn">{showProbs ? entropy.toFixed(2) : '—'}</span><span className="scdl">熵 (bit) · 越大越平</span></div>
          <div className="scdk"><span className={`scdn ${showProbs ? 'good' : ''}`}>{showProbs && topProb >= 0 ? `${(probs[topProb] * 100).toFixed(0)}%` : '—'}</span><span className="scdl">最大概率 · 越大越尖</span></div>
        </div>
        <p className="smtip">{tEffect}——温度就是 softmax 之前先把 logit 除以 T。左侧「实验控制」可调 T 看分布形变。</p>

        {/* logit / 缩放后 */}
        <div className="smsect">{showProbs ? 'logit（原始打分）' : showScaled ? `logit ÷ 温度 ${state.T}` : 'logit（原始打分）'}</div>
        <div className="smbars">
          {tokens.map((tk, k) => {
            const v = vals[k]
            return (
              <div className="smrow" key={k}>
                <span className="smtok">{tk}</span>
                <div className="smtrack neg">
                  <div className={`smfill ${v >= 0 ? 'pos' : 'minus'}`} style={{ width: `${(Math.abs(v) / maxAbs) * 50}%`, marginLeft: v >= 0 ? '50%' : `${50 - (Math.abs(v) / maxAbs) * 50}%` }} />
                </div>
                <span className="smval">{v.toFixed(2)}</span>
              </div>
            )
          })}
        </div>

        {/* 概率分布 */}
        {showProbs && (
          <>
            <div className="smsect" style={{ marginTop: 16 }}>概率分布 <span className="smcap">和 = {(probs.reduce((a, b) => a + b, 0)).toFixed(3)} · 熵 {state.entropy.toFixed(2)} bit</span></div>
            <div className="smbars">
              {tokens.map((tk, k) => (
                <div className="smrow" key={k}>
                  <span className="smtok">{tk}</span>
                  <div className="smtrack">
                    <div className={`smfill prob ${k === topProb ? 'top' : ''}`} style={{ width: `${probs[k] * 100}%` }} />
                  </div>
                  <span className={`smval prob ${k === topProb ? 'top' : ''}`}>{(probs[k] * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
