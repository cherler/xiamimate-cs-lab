/** 舞台：参数量与显存 —— 参数拆解堆叠条 + 权重/KV 显存 */
import type { LlmSizeState } from '@engine/kernels/llmsize.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const fmtN = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n)
const fmtB = (b: number) => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(0) + ' MB' : (b / 1e3).toFixed(0) + ' KB'

export function LlmSizeStage({ state }: StageProps<LlmSizeState>) {
  const { L, embed, attnPerLayer, ffnPerLayer, total, weightBytes, kvBytes, phase } = state
  const attnTotal = attnPerLayer * L
  const ffnTotal = ffnPerLayer * L
  //  分母用最终总参数（有则用，无则用当前累加）保证条形跨步可比
  const denom = total || (embed + attnTotal + ffnTotal) || 1

  const rows = [
    { key: 'embed', label: '词嵌入', val: embed, cls: 't', show: embed > 0, note: `vocab×d` },
    { key: 'attn', label: `注意力 ×${L}`, val: attnTotal, cls: 'i', show: attnPerLayer > 0, note: `4d² ×层` },
    { key: 'ffn', label: `FFN ×${L}`, val: ffnTotal, cls: 'o', show: ffnPerLayer > 0, note: `2·${state.ffn}·d² ×层` },
  ]

  return (
    <div className="card">
      <h3>参数量与显存 <span className="hint">7B 为什么要十几 G · KV 缓存吃多少</span></h3>
      <div className="body">
        {/* 参数拆解堆叠条 */}
        <div className="lssect">参数拆解 {total > 0 && <span className="lscap">总计 <b>{fmtN(total)}</b></span>}</div>
        <div className="lsstack">
          {rows.filter(r => r.show).map(r => (
            <div key={r.key} className={`lsseg ${r.cls} ${phase === r.key ? 'cur' : ''}`}
              style={{ width: `${(r.val / denom) * 100}%` }} title={`${r.label} ${fmtN(r.val)}`} />
          ))}
        </div>
        <div className="lslegend">
          {rows.filter(r => r.show).map(r => (
            <div key={r.key} className={`lsitem ${phase === r.key ? 'cur' : ''}`}>
              <span className={`lsdot ${r.cls}`} />
              <span className="lsl">{r.label}</span>
              <span className="lsv">{fmtN(r.val)}</span>
              <span className="lsn">{r.note}</span>
            </div>
          ))}
        </div>

        {/* 显存 */}
        {(weightBytes > 0 || kvBytes > 0) && (
          <>
            <div className="lssect" style={{ marginTop: 18 }}>显存占用 <span className="lscap">{state.dtype} · 序列 {state.seq}</span></div>
            <div className="lsmem">
              {weightBytes > 0 && (
                <div className="lsmrow">
                  <span className="lsmk">权重（固定）</span>
                  <div className="lsmtrack"><div className="lsmfill w" style={{ width: '100%' }}>{fmtB(weightBytes)}</div></div>
                </div>
              )}
              {kvBytes > 0 && (
                <div className="lsmrow">
                  <span className="lsmk">KV 缓存 / 序列</span>
                  <div className="lsmtrack"><div className="lsmfill kv" style={{ width: `${Math.max(6, Math.min(100, (kvBytes / (weightBytes || kvBytes)) * 100))}%` }}>{fmtB(kvBytes)}</div></div>
                </div>
              )}
            </div>
            <div className="gd-note" style={{ marginTop: 8 }}>权重是固定开销；KV 缓存随<b>序列长度 × 并发数</b>线性增长 —— 长上下文、高并发就是被它吃满的。</div>
          </>
        )}

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
