/** 舞台：权重量化 —— scale 定标 + 逐权重 round/反量化/误差表 + 显存对比 */
import type { QuantState } from '@engine/kernels/quant.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function QuantStage({ state }: StageProps<QuantState>) {
  const { bits, qmax, scale, weights, cursor, ints, deq, errs, maxErr, bytesFp32, bytesQ, phase } = state
  const saved = Math.round((1 - bytesQ / bytesFp32) * 100)
  return (
    <div className="card">
      <h3>权重量化 <span className="hint">fp32 → int{bits} · round(w/scale) 存整数</span></h3>
      <div className="body">
        {/* 定标 */}
        <div className={`qzscale ${phase === 'scale' ? 'cur' : ''}`}>
          <span className="qzsk">scale</span>
          <span className="qzsv">{scale.toFixed(4)}</span>
          <span className="qzsf">= max|w| ÷ {qmax}　(int{bits} 范围 ±{qmax})</span>
        </div>

        {/* 逐权重表 */}
        <div className="qztab">
          <div className="qzhead"><span>w (fp32)</span><span>q = round(w/scale)</span><span>ŵ = q·scale</span><span>误差</span></div>
          {weights.map((w, k) => {
            const filled = ints[k] !== null
            return (
              <div key={k} className={`qzr ${k === cursor ? 'cur' : ''} ${!filled ? 'pend' : ''}`}>
                <span className="qzw">{w}</span>
                <span className="qzq">{filled ? ints[k] : '—'}</span>
                <span className="qzd">{filled ? (deq[k]!).toFixed(3) : '—'}</span>
                <span className="qze">{filled ? (errs[k]!).toFixed(3) : '—'}</span>
              </div>
            )
          })}
        </div>

        {/* 显存对比 + 最大误差 */}
        <div className="qzfoot">
          <div className="qzmem">
            <div className="qzbar"><span className="qzbl">fp32</span><div className="qztrack"><div className="qzfill bad" style={{ width: '100%' }}>{bytesFp32} B</div></div></div>
            <div className="qzbar"><span className="qzbl">int{bits}</span><div className="qztrack"><div className="qzfill ok" style={{ width: `${(bytesQ / bytesFp32) * 100}%` }}>{bytesQ} B</div></div></div>
          </div>
          <div className="qzsave"><span className="qzsaven">省 {saved}%</span><span className="qzsavel">显存　·　最大误差 {maxErr.toFixed(3)}</span></div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
