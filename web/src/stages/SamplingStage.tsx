/** 舞台：采样解码 · top-p 核采样 —— top-p 从紧到松扫描，看「核」(保留的候选集)随阈值长大。
 *  降序概率条:核内保留(实色+归一化后长度)、核外砍掉(灰+✕);Σ 累计线;顶部大数条 top-p/保留数/覆盖。 */
import type { SamplingState } from '@engine/kernels/sampling.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function SamplingStage({ state }: StageProps<SamplingState>) {
  const { tokens, order, probs, kept, cum, final, p, T, k } = state
  const keptCount = kept.filter(Boolean).length
  const coverage = probs.reduce((a, pr, i) => a + (kept[i] ? pr : 0), 0)
  const maxP = Math.max(...probs, 0.01)

  return (
    <div className="card">
      <h3>采样解码 · top-p 核采样 <span className="hint">top-p 从紧到松扫描 —— 看候选集(核)随阈值长大</span></h3>
      <div className="body">
        {/* top-p 是主角:大数条摆 阈值 / 保留候选(核) / 覆盖概率 */}
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{p >= 1 ? '关' : p}</span><span className="scdl">top-p 阈值</span></div>
          <div className="scdk"><span className="scdn good">{keptCount}/{tokens.length}</span><span className="scdl">保留候选(核)</span></div>
          <div className="scdk"><span className="scdn">{(coverage * 100).toFixed(0)}%</span><span className="scdl">覆盖概率</span></div>
        </div>
        <p className="smtip">概率从大到小累加、保留累计刚超过 top-p 的「核」——分布尖时核小、分布平时核自动变大。温度、top-k 在左侧「实验控制」里调、可叠加。</p>

        <div className="spsect">按概率降序 · 核内保留 / 核外砍掉 <span className="spcap">留 {keptCount} / {tokens.length} 个</span></div>
        <div className="spbars">
          {order.map((idx, rank) => {
            const cut = !kept[idx]
            const pv = probs[idx]
            const fv = final[idx] ?? 0
            const overP = cum[rank] != null && cum[rank] >= p
            return (
              <div key={idx} className={`sprow ${cut ? 'cut' : ''}`}>
                <span className="sptok">{tokens[idx]}</span>
                <div className="sptrack">
                  <div className="spfill orig" style={{ width: `${(pv / maxP) * 100}%` }} />
                  {!cut && <div className="spfill final" style={{ width: `${(fv / maxP) * 100}%` }} />}
                </div>
                <span className="spval">{cut ? `${(pv * 100).toFixed(0)}%` : `${(fv * 100).toFixed(0)}%`}</span>
                {cum.length > 0 && <span className={`spcum ${overP ? 'over' : ''}`}>Σ{(cum[rank] * 100).toFixed(0)}%</span>}
                {cut && <span className="spx">✕</span>}
              </div>
            )
          })}
        </div>

        <div className="spknobs">
          <span className="spknob">温度 <b>{T}</b></span>
          <span className="spknob">top-k <b>{k > 0 ? k : '关'}</b></span>
          <span className="spknob">top-p <b>{p < 1 ? p : '关'}</b></span>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
