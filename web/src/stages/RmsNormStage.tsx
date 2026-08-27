/** 舞台：RMSNorm —— x → 平方 → RMS → 逐维除以 RMS×g → 归一化后 RMS=1 */
import type { RmsNormState } from '@engine/kernels/rmsnorm.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function RmsNormStage({ state }: StageProps<RmsNormState>) {
  const { x, gain, sq, meanSq, rms, cursor, out, outRms, phase } = state
  const showSq = phase !== 'square' ? true : true
  return (
    <div className="card">
      <h3>RMSNorm 归一化 <span className="hint">除以均方根 · 不减均值（比 LayerNorm 省）</span></h3>
      <div className="body">
        {/* 输入向量 */}
        <div className="rnrow">
          <span className="rnlab">输入 x</span>
          {x.map((v, k) => <span key={k} className={`rncell ${k === cursor ? 'cur' : ''}`}>{v}</span>)}
        </div>
        {/* 平方 */}
        {showSq && sq.length > 0 && (
          <div className="rnrow">
            <span className="rnlab">x²</span>
            {sq.map((v, k) => <span key={k} className="rncell sq">{v}</span>)}
          </div>
        )}

        {/* RMS 计算 */}
        <div className="rnrms">
          <span className="rnrk">均方 mean(x²)</span><span className="rnrv">{meanSq || '—'}</span>
          <span className="rnarrow">→</span>
          <span className="rnrk">RMS = √均方</span><span className="rnrv hot">{rms || '—'}</span>
        </div>

        {/* 归一化输出 */}
        <div className="rnrow">
          <span className="rnlab">x̂ = x/RMS·g</span>
          {out.map((v, k) => (
            <span key={k} className={`rncell out ${v === null ? 'pend' : ''} ${k === cursor ? 'cur' : ''}`}>{v === null ? '—' : v}</span>
          ))}
        </div>
        <div className="rngain">
          <span className="rnlab">增益 g</span>
          {gain.map((v, k) => <span key={k} className="rngcell">{v}</span>)}
        </div>

        {/* RMS=1 验证 */}
        {outRms > 0 && (
          <div className={`rncheck ${Math.abs(outRms - 1) < 0.01 ? 'ok' : ''}`}>
            {Math.abs(outRms - 1) < 0.01 ? '✓ ' : ''}归一化后（未乘增益）向量 RMS = <b>{outRms}</b> —— 拉到了单位均方根
          </div>
        )}

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
