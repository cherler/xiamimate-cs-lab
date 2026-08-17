/** 舞台：Dijkstra —— 图 + 距离表 */
import type { DijkstraState } from '@engine/kernels/dijkstra.ts'
import type { SimDocument } from '@engine/core/document.ts'
import type { StageProps } from '../types.ts'

const fmt = (v: number) => (v === Infinity || v === null || v === undefined ? '∞' : String(v))

export function DijkstraStage({ doc, trace, state, tab }: StageProps<DijkstraState>) {
  const nodes = doc.entities.filter(e => e.type === 'node')
  const edges = doc.entities.filter(e => e.type === 'edge')
  if (tab === 'table') return <Table doc={doc} trace={trace} state={state} />
  return <Graph nodes={nodes} edges={edges} state={state} />
}

type Ent = SimDocument['entities'][number]

/**
 * 图：顶点坐标由 doc 给（attrs.x / attrs.y，0..100）。
 * 让文档定布局，而不是前端自己排 —— 同一道题换个前端也能画成一样。
 */
function Graph({ nodes, edges, state }: { nodes: Ent[]; edges: Ent[]; state: DijkstraState }) {
  const pos = Object.fromEntries(nodes.map((n, k) => {
    const a = 2 * Math.PI * k / nodes.length - Math.PI / 2
    return [n.id, {
      x: typeof n.attrs.x === 'number' ? n.attrs.x : 50 + 36 * Math.cos(a),
      y: typeof n.attrs.y === 'number' ? n.attrs.y : 50 + 36 * Math.sin(a),
    }]
  }))
  const settled = new Set(state.settled)

  return (
    <div className="card">
      <h3>带权图 <span className="hint">深色=最短路已确定 · 高亮=本步正在松弛的边</span></h3>
      <div className="body">
        <div className="gwrap">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {edges.map(e => {
              const f = pos[String(e.attrs.from)], t = pos[String(e.attrs.to)]
              if (!f || !t) return null
              const active =
                (state.at === e.attrs.from && state.to === e.attrs.to) ||
                (state.at === e.attrs.to && state.to === e.attrs.from)
              // 树边：终点的前驱正好是另一端 —— 这就是最短路径树
              const tree =
                state.prev[String(e.attrs.to)] === e.attrs.from ||
                state.prev[String(e.attrs.from)] === e.attrs.to
              return (
                <g key={e.id} className={`gedge ${active ? 'act' : ''} ${tree ? 'tree' : ''}`}>
                  <line x1={f.x} y1={f.y} x2={t.x} y2={t.y} vectorEffect="non-scaling-stroke" />
                  <text x={(f.x + t.x) / 2} y={(f.y + t.y) / 2 - 1.4}>{String(e.attrs.w)}</text>
                </g>
              )
            })}
          </svg>
          {nodes.map(n => {
            const p = pos[n.id]
            const d = state.dist[n.id]
            const cls = [
              'gnode',
              settled.has(n.id) ? 'settled' : '',
              state.at === n.id ? 'at' : '',
              state.to === n.id ? 'to' : '',
            ].filter(Boolean).join(' ')
            return (
              <div key={n.id} className={cls} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <b>{n.id}</b>
                <em>{fmt(d)}</em>
              </div>
            )
          })}
        </div>
        <div className="glegend">
          <span>已确定 <b>{state.settled.length}</b> / {nodes.length}</span>
          <span>确定顺序 <b>{state.settled.join(' → ') || '—'}</b></span>
        </div>
      </div>
    </div>
  )
}

/**
 * 距离表 —— 考题让"写出每一轮的 dist 数组"，这张表逐轮就是答案。
 * 每一列是一个已确定的顶点被选出时的快照。
 */
function Table({ doc, trace, state }: { doc: SimDocument; trace: DijkstraState[]; state: DijkstraState }) {
  const nodes = doc.entities.filter(e => e.type === 'node').map(e => e.id)
  const picks = trace.filter(s => s.act === 'pick')
  const seen = state.settled.length

  return (
    <div className="card">
      <h3>逐轮距离表 <span className="hint">每一列 = 选出一个顶点时的 dist 快照</span></h3>
      <div className="body scroll">
        <table className="ptab dij">
          <thead>
            <tr>
              <th>顶点</th>
              {picks.map((p, k) => (
                <th key={k} className={k < seen ? 'past' : 'future'}>选出 {p.at}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map(n => (
              <tr key={n}>
                <th>{n}</th>
                {picks.map((p, k) => {
                  const done = p.settled.includes(n)
                  return (
                    <td key={k} className={[
                      k < seen ? 'past' : 'future',
                      done ? 'fixed' : '',
                      p.at === n ? 'pick' : '',
                    ].filter(Boolean).join(' ')}>
                      {fmt(p.dist[n])}
                      {p.prev[n] && !done ? <i>({p.prev[n]})</i> : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tnote">
          括号里是前驱顶点 —— 沿它一路回溯就是最短路径本身。加粗格表示该顶点在这一轮被确定，之后不再变。
        </p>
      </div>
    </div>
  )
}
