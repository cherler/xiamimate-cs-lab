/** 舞台：采样解码 —— 降序概率条 + top-k/top-p 截断 + 累计线 + 重归一化后的分布 */
import type { SamplingState } from '@engine/kernels/sampling.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function SamplingStage({ state }: StageProps<SamplingState>) {
  const { tokens, order, probs, kept, cum, final, phase } = state
  const sorted = phase === 'softmax' ? tokens.map((_, i) => i) : order
  const showFinal = final.length > 0
  const showCum = cum.length > 0 && (phase === 'topp')
  const maxP = Math.max(...probs, 0.01)

  return (
    <div className="card">
      <h3>采样解码 <span className="hint">softmax → 排序 → top-k / top-p 截断 → 重新归一化</span></h3>
      <div className="body">
        <div className="spsect">
          {phase === 'softmax' ? '概率（原始顺序）' : '按概率降序 · 截断后重采样'}
          {showFinal && <span className="spcap">留 {kept.filter(Boolean).length} / {tokens.length} 个</span>}
        </div>
        <div className="spbars">
          {sorted.map((idx, rank) => {
            const cut = phase !== 'softmax' && phase !== 'sort' && !kept[idx]
            const pv = probs[idx]
            const fv = showFinal ? final[idx] : 0
            return (
              <div key={idx} className={`sprow ${cut ? 'cut' : ''} ${rank === state.focus ? 'cur' : ''}`}>
                <span className="sptok">{tokens[idx]}</span>
                <div className="sptrack">
                  {/* 原始概率（浅）*/}
                  <div className="spfill orig" style={{ width: `${(pv / maxP) * 100}%` }} />
                  {/* 归一化后（实）*/}
                  {showFinal && !cut && <div className="spfill final" style={{ width: `${(fv / maxP) * 100}%` }} />}
                </div>
                <span className="spval">{showFinal && !cut ? `${(fv * 100).toFixed(0)}%` : `${(pv * 100).toFixed(0)}%`}</span>
                {showCum && <span className={`spcum ${cum[rank] >= state.p ? 'over' : ''}`}>Σ{(cum[rank] * 100).toFixed(0)}%</span>}
                {cut && <span className="spx">✕</span>}
              </div>
            )
          })}
        </div>

        {/* 旋钮现值 */}
        <div className="spknobs">
          <span className="spknob">温度 <b>{state.T}</b></span>
          <span className="spknob">top-k <b>{state.k > 0 ? state.k : '关'}</b></span>
          <span className="spknob">top-p <b>{state.p < 1 ? state.p : '关'}</b></span>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
