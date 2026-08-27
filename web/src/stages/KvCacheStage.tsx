/** 舞台：KV 缓存 —— 序列逐 token 生长 + 有/无缓存计算量对比条 */
import type { KvCacheState } from '@engine/kernels/kvcache.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function KvCacheStage({ state }: StageProps<KvCacheState>) {
  const { seq, phase, computed, recomputed, cacheSize, cumCached, cumNaive, savedPct } = state
  const max = Math.max(cumNaive, 1)
  const newIdx = phase === 'decode' ? seq.length - 1 : -1
  return (
    <div className="card">
      <h3>KV 缓存 <span className="hint">已算过的 K/V 存起来，每步只算新 token</span></h3>
      <div className="body">
        {/* 序列：token 逐个生长，缓存里的染色、新算的高亮 */}
        <div className="kvseqwrap">
          <div className="kvlab">序列（缓存 {cacheSize} 对 K/V）</div>
          <div className="kvseq">
            {seq.map((t, k) => (
              <div key={k} className={`kvtok ${k === newIdx ? 'new' : phase === 'prefill' ? 'prefill' : 'cached'}`}>
                <span className="kvch">{t}</span>
                <span className="kvkv">K/V</span>
              </div>
            ))}
            {phase === 'done' && <span className="kvdone">✓ 全部生成完</span>}
          </div>
        </div>

        {/* 本步算了几次 */}
        <div className="kvstep">
          <div className="kvstepcol ok">
            <span className="kvstepn">{computed}</span>
            <span className="kvstepl">有缓存 · 本步算的 K/V</span>
          </div>
          <div className="kvstepcol bad">
            <span className="kvstepn">{recomputed}</span>
            <span className="kvstepl">无缓存 · 本步要重算</span>
          </div>
        </div>

        {/* 累计对比条 */}
        <div className="kvcmp">
          <div className="kvbarrow">
            <span className="kvbarlab">有缓存累计</span>
            <div className="kvbar"><div className="kvbarfill ok" style={{ width: `${(cumCached / max) * 100}%` }} /></div>
            <span className="kvbarval">{cumCached}</span>
          </div>
          <div className="kvbarrow">
            <span className="kvbarlab">无缓存累计</span>
            <div className="kvbar"><div className="kvbarfill bad" style={{ width: `${(cumNaive / max) * 100}%` }} /></div>
            <span className="kvbarval">{cumNaive}</span>
          </div>
          {phase === 'done' && (
            <div className="kvsaved">缓存省了 <b>{savedPct}%</b> 计算 · 代价：缓存占 {cacheSize} 对 K/V 显存，序列越长占越多</div>
          )}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
