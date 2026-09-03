/** 舞台：缩放点积 + causal mask —— 下三角注意力矩阵热力图 + √d 去饱和对比 */
import type { ScaledMaskState } from '@engine/kernels/scaledmask.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function ScaledMaskStage({ state }: StageProps<ScaledMaskState>) {
  const { tokens, matrix, row, raw, scaled, weights, d, scale, causal, peak, peakUnscaled, phase } = state
  const N = tokens.length
  const done = phase === 'done'
  const cell = (w: number | null, masked: boolean) => {
    if (masked) return { background: 'var(--sunk-2)', color: 'var(--faint)' }
    const v = w ?? 0
    return {
      background: `color-mix(in srgb, var(--f-tag) ${Math.round(v * 88)}%, var(--panel))`,
      color: v > 0.55 ? '#fff' : 'var(--ink)',
    }
  }
  return (
    <div className="card">
      <h3>缩放点积 + 因果掩码 <span className="hint">除 √d 防饱和 · 掩码令矩阵成下三角</span></h3>
      <div className="body">
        {/* √d 缩放是主角:大数条摆 缩放因子 / 除√d后最大权重 / 不除会饱和到多少 */}
        {d > 1 && raw.length > 0 && (
          <div className="scdim">
            <div className="scdk"><span className="scdn hot">√{d}={scale.toFixed(2)}</span><span className="scdl">缩放因子</span></div>
            <div className="scdk"><span className="scdn good">{Math.round(peak * 100)}%</span><span className="scdl">除√d后·本行最大权重</span></div>
            <div className="scdk"><span className="scdn bad">{Math.round(peakUnscaled * 100)}%</span><span className="scdl">不除会饱和到·太尖</span></div>
          </div>
        )}
        {/* 注意力矩阵热力图 */}
        <div className="smmwrap">
          <div className="smmgrid" style={{ gridTemplateColumns: `28px repeat(${N}, 1fr)` }}>
            <div className="smmcorner">q\k</div>
            {tokens.map((t, j) => <div key={j} className="smmhead">{t}</div>)}
            {tokens.map((qt, i) => {
              const built = i < matrix.length
              const rw = built ? matrix[i] : null
              return (
                <div key={i} style={{ display: 'contents' }}>
                  <div className={`smmrh ${i === row && !done ? 'cur' : ''}`}>{qt}</div>
                  {tokens.map((_, j) => {
                    const masked = causal && j > i
                    const w = rw ? rw[j] : null
                    return (
                      <div key={j} className={`smmcell ${!built ? 'pending' : ''} ${i === row && !done && built ? 'inrow' : ''}`}
                        style={built ? cell(w, masked) : undefined}>
                        {built && !masked ? `${Math.round((w ?? 0) * 100)}` : masked ? '·' : ''}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          <div className="smmleg">格内数字 = 注意力权重 %（每行和 100）· 颜色越深越关注 · <span className="smmmask">·</span> = 被掩掉的未来位（权重 0）</div>
        </div>

        {/* 当前行拆解 */}
        {!done && raw.length > 0 && (
          <div className="smmbreak">
            <div className="smmbrow"><span className="smmbl">原始 Q·K</span>{raw.map((x, j) => <span key={j} className="smmbv">{x}</span>)}</div>
            <div className="smmbrow"><span className="smmbl">÷ √{d}={scale.toFixed(2)}</span>{scaled.map((x, j) => <span key={j} className="smmbv">{Number.isFinite(x) ? x.toFixed(2) : '−∞'}</span>)}</div>
            <div className="smmbrow"><span className="smmbl">softmax %</span>{weights.map((x, j) => <span key={j} className="smmbv hot">{Math.round(x * 100)}</span>)}</div>
          </div>
        )}

        {/* √d 去饱和对比 */}
        {raw.length > 0 && d > 1 && (
          <div className="smmsat">
            <div className="smmsatcol ok"><span className="smmsatn">{Math.round(peak * 100)}%</span><span className="smmsatl">除 √{d} 后本行最大权重</span></div>
            <div className="smmsatcol bad"><span className="smmsatn">{Math.round(peakUnscaled * 100)}%</span><span className="smmsatl">不除 √d 会更尖（饱和）</span></div>
          </div>
        )}

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
