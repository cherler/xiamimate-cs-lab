/** 舞台：MHA/MQA/GQA —— query 头 → KV 头 连线 + KV 缓存比 */
import type { MhaState } from '@engine/kernels/mha.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function MhaStage({ state }: StageProps<MhaState>) {
  const { variant, heads, kvHeads, map, focus, kvRatio } = state
  return (
    <div className="card">
      <h3>多头注意力 <span className="hint">query 头共享 KV 头 → KV 缓存变小</span></h3>
      <div className="body">
        {/* 变体是主角:大数条摆 变体 / query头→KV头 / KV缓存占比,一眼看出 MHA→GQA→MQA 怎么省 */}
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{variant}</span><span className="scdl">变体</span></div>
          <div className="scdk"><span className="scdn">{heads} → {kvHeads}</span><span className="scdl">query头 → KV头</span></div>
          <div className="scdk"><span className="scdn good">{Math.round(kvRatio * 100)}%</span><span className="scdl">KV 缓存 · 越小越省</span></div>
        </div>
        <div className="mhwrap">
          <div className="mhrow">
            <span className="mhlab">query 头</span>
            <div className="mhheads">
              {Array.from({ length: heads }, (_, q) => (
                <div key={q} className={`mhhead q ${q === focus ? 'cur' : ''}`}>{q}</div>
              ))}
            </div>
          </div>
          <svg className="mhlines" viewBox={`0 0 ${heads * 40} 46`} preserveAspectRatio="none" aria-hidden="true">
            {Array.from({ length: heads }, (_, q) => {
              const qx = q * 40 + 20
              const kx = map[q] * (heads * 40 / kvHeads) + (heads * 40 / kvHeads) / 2
              return <line key={q} x1={qx} y1="2" x2={kx} y2="44"
                stroke={q === focus ? 'var(--now)' : 'var(--line)'} strokeWidth={q === focus ? 2 : 1.2} vectorEffect="non-scaling-stroke" />
            })}
          </svg>
          <div className="mhrow">
            <span className="mhlab">KV 头</span>
            <div className="mhheads kv" style={{ gridTemplateColumns: `repeat(${kvHeads}, 1fr)` }}>
              {Array.from({ length: kvHeads }, (_, k) => (
                <div key={k} className={`mhhead k ${map[focus] === k && focus >= 0 ? 'cur' : ''}`}>{k}</div>
              ))}
            </div>
          </div>
        </div>

        {/* KV 缓存比 */}
        <div className="mhkv">
          <div className="mhkvh">KV 缓存大小 <span className="mhkvcap">∝ KV 头数 · 相对 MHA</span></div>
          <div className="mhbar"><div className="mhbarfill" style={{ width: `${kvRatio * 100}%` }}>{Math.round(kvRatio * 100)}%</div></div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
