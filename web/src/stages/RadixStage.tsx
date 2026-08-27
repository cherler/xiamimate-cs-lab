/** 舞台：前缀缓存（Radix Cache）—— 前缀树 + 当前请求 token 带 + prefill 省下量 */
import type { RadixState } from '@engine/kernels/radix.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function RadixStage({ state }: StageProps<RadixState>) {
  const { nodes, focus } = state

  //  ── 布局：x 按深度，y 按叶序（DFS 顺序里每个叶子占一行）──
  const children = (p: number) => nodes.map((n, i) => (n.parent === p ? i : -1)).filter(i => i >= 0)
  const pos: Record<number, { x: number; y: number }> = {}
  let row = 0
  const place = (n: number) => {
    const kids = children(n)
    if (kids.length === 0) { pos[n] = { x: nodes[n].depth, y: row++ }; return }
    const ys: number[] = []
    for (const k of kids) { place(k); ys.push(pos[k].y) }
    pos[n] = { x: nodes[n].depth, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
  }
  //  从根（0）的孩子开始铺（根是虚拟的，不画）
  const roots = children(0)
  roots.forEach(place)
  const maxRow = Math.max(1, row)
  const maxDepth = Math.max(1, ...nodes.map(n => n.depth))

  const W = 60 + maxDepth * 96, H = 30 + maxRow * 44
  const X = (d: number) => 30 + (d - 1) * 96
  const Y = (y: number) => 24 + y * 44

  const savedNow = state.seenTotal ? state.savedTotal / state.seenTotal : 0

  return (
    <div className="card">
      <h3>前缀缓存树 <span className="hint">命中的前缀 KV 直接复用，只算未命中的新 token</span></h3>
      <div className="body">
        {/* 前缀树 */}
        <div className="rxgraph">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid meet" style={{ width: '100%', height: 'auto', maxHeight: 340 }} aria-hidden="true">
            {nodes.map((n, i) => {
              if (i === 0 || n.parent < 0) return null
              const p = n.parent === 0 ? null : pos[n.parent]
              if (!p) return null
              return <line key={`e${i}`} x1={X(nodes[n.parent].depth) + 16} y1={Y(p.y)} x2={X(n.depth) - 16} y2={Y(pos[i].y)}
                stroke="var(--line)" strokeWidth="1.5" />
            })}
            {nodes.map((n, i) => {
              if (i === 0) return null
              const cur = i === focus
              const term = n.terminal
              const c = cur ? 'var(--now)' : term ? 'var(--hit)' : 'var(--f-tag)'
              return (
                <g key={i}>
                  <rect x={X(n.depth) - 26} y={Y(pos[i].y) - 15} width="52" height="30" rx="7"
                    fill={`color-mix(in srgb, ${c} ${cur ? 22 : 12}%, transparent)`} stroke={c} strokeWidth={cur ? 2.2 : 1.5} />
                  <text x={X(n.depth)} y={Y(pos[i].y) + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={c}>{n.token}</text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* 当前请求的 token 带 */}
        {state.reqTokens.length > 0 && (
          <div className="rxreq">
            <span className="rxk">请求 {state.req}</span>
            <span className="rxtoks">
              {state.reqTokens.map((t, k) => {
                const done = k < state.pos || (k === state.pos && state.act !== 'reqdone')
                const isHit = done && k < state.hit
                const isCmp = done && k >= state.hit
                return <span key={k} className={`rxtok ${k === state.pos ? 'cur' : ''} ${isHit ? 'hit' : ''} ${isCmp ? 'cmp' : ''}`}>{t}</span>
              })}
            </span>
          </div>
        )}

        {/* prefill 省下量 */}
        <div className="rxsave">
          <div className="rxsaveh">
            <span>累计省下 prefill</span>
            <b>{state.savedTotal} / {state.seenTotal} token（{(savedNow * 100).toFixed(0)}%）</b>
          </div>
          <div className="rxbar"><i style={{ width: `${savedNow * 100}%` }} /></div>
          <div className="rxcap">缓存 {state.cached} / {state.budget} token{state.cached >= state.budget ? '（已满，超出即 LRU 淘汰）' : ''}</div>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
