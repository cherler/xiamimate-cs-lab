/** 舞台：BPE 分词 —— token 序列逐步合并变短 */
import type { BpeState } from '@engine/kernels/bpe.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function BpeStage({ state }: StageProps<BpeState>) {
  const { toks, merged, start, pair } = state
  return (
    <div className="card">
      <h3>BPE 分词 <span className="hint">按 merge 表逐条合并，token 序列越并越短</span></h3>
      <div className="body">
        <div className="bpsect">当前 token 序列 <span className="bpcap">{start} 符号 → {toks.length} token</span></div>
        <div className="bptoks">
          {toks.map((t, k) => (
            <span key={k} className={`bptok ${t === merged && state.act === 'merge' ? 'new' : ''} ${t.length > 1 ? 'multi' : ''}`}>{t}</span>
          ))}
        </div>

        {pair && (
          <div className="bpmerge">
            <span className="bppair">{pair[0]}</span>
            <span className="bpplus">+</span>
            <span className="bppair">{pair[1]}</span>
            <span className="bparr">→</span>
            <span className="bpres">{merged}</span>
          </div>
        )}

        {/* 压缩率 */}
        <div className="bpbar">
          <div className="bpbarfill" style={{ width: `${(toks.length / Math.max(1, start)) * 100}%` }} />
          <span className="bpbarlab">压到原来的 {Math.round((toks.length / Math.max(1, start)) * 100)}%</span>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
