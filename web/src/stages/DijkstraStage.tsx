/** 舞台：Dijkstra —— 图 + 距离表 */
import type { DijkstraState } from '@engine/kernels/dijkstra.ts'
import type { SimDocument } from '@engine/core/document.ts'
import type { StageProps } from '../types.ts'
import { GraphView } from '../shell/GraphView.tsx'

const fmt = (v: number) => (v === Infinity || v === null || v === undefined ? '∞' : String(v))

export function DijkstraStage({ doc, trace, state, tab }: StageProps<DijkstraState>) {
  if (tab === 'table') return <Table doc={doc} trace={trace} state={state} />
  return <Graph doc={doc} state={state} />
}

/**
 * 图：顶点坐标由 doc 给（attrs.x / attrs.y，0..100）。
 * 用共享的 GraphView —— 当初这里自己画了一遍 SVG，
 * 结果 viewBox 与结点百分比定位不重合，连线离结点中心差了上百像素。
 * 那个 bug 修在 GraphView 里一次就够，不该每个图实验各修一遍。
 */
function Graph({ doc, state }: { doc: SimDocument; state: DijkstraState }) {
  const settled = new Set(state.settled)
  return (
    <div className="card">
      <h3>带权图 <span className="hint">深色=最短路已确定 · 高亮=本步正在松弛的边</span></h3>
      <div className="body">
        <GraphView
          doc={doc}
          directed={doc.params.directed === 1}
          edgeTone={id => {
            const e = doc.entities.find(x => x.id === id)!
            const active = (state.at === e.attrs.from && state.to === e.attrs.to)
              || (state.at === e.attrs.to && state.to === e.attrs.from)
            if (active) return 'active'
            //  树边：终点的前驱正好是另一端 —— 这就是最短路径树
            const tree = state.prev[String(e.attrs.to)] === e.attrs.from
              || state.prev[String(e.attrs.from)] === e.attrs.to
            return tree ? 'chosen' : 'plain'
          }}
          vertTone={id => (state.at === id ? 'active' : settled.has(id) ? 'done' : 'plain')}
          vertSub={id => fmt(state.dist[id])}
          legend={[['chosen', '最短路径树上的边'], ['active', '本步松弛的边']]}
        />
        <div className="glegend">
          <span>已确定 <b>{state.settled.length}</b> / {doc.entities.filter(e => e.type === 'node').length}</span>
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
