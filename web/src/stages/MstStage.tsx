/** 舞台：最小生成树 —— 图 + 边表 */
import type { MstState } from '@engine/kernels/mst.ts'
import type { StageProps } from '../types.ts'
import { GraphView } from '../shell/GraphView.tsx'

export function MstStage({ doc, trace, index, state, tab }: StageProps<MstState>) {
  if (tab === 'edges') return <Edges doc={doc} trace={trace} index={index} state={state} tab={tab} />
  const chosen = new Set(state.chosen)
  const inTree = new Set(state.inTree)
  const prim = doc.params.algorithm === 'Prim'
  return (
    <div className="card">
      <h3>图与生成树 <span className="hint">{String(doc.params.algorithm)} · 加粗的是已选入的边</span></h3>
      <div className="body">
        <GraphView
          doc={doc}
          edgeTone={id => (chosen.has(id) ? 'chosen'
            : id === state.edge ? (state.act === 'skip' ? 'dropped' : 'active')
            : 'plain')}
          vertTone={id => (prim
            ? (inTree.has(id) ? 'done' : 'plain')
            : (state.chosen.some(c => c.includes(id)) ? 'done' : 'plain'))}
          legend={[['chosen', '已选入生成树'], ['active', '本步考察'], ['dropped', '会成环，丢弃']]}
        />
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 边表：Kruskal 就是照着这张排好序的表往下走 */
function Edges({ doc, trace, index, state }: StageProps<MstState>) {
  const edges = doc.entities.filter(e => e.type === 'edge')
  const kruskal = doc.params.algorithm === 'Kruskal'
  const sorted = kruskal
    ? [...edges].sort((a, b) => (Number(a.attrs.w) - Number(b.attrs.w)) || a.id.localeCompare(b.id))
    : edges
  const chosen = new Set(state.chosen)
  const seen = new Set(trace.filter(s => s.i <= index && s.edge).map(s => s.edge))

  return (
    <div className="card">
      <h3>{kruskal ? '按权排序的边表' : '边表'}
        <span className="hint">{kruskal ? 'Kruskal 就是照这张表从上往下走' : 'Prim 每步从候选边里挑最小的'}</span></h3>
      <div className="body scroll">
        <table className="ptab">
          <thead><tr><th>边</th><th>两端</th><th>权值</th><th>结论</th></tr></thead>
          <tbody>
            {sorted.map(e => {
              const isChosen = chosen.has(e.id)
              const wasSeen = seen.has(e.id)
              return (
                <tr key={e.id} className={e.id === state.edge ? 'past' : !wasSeen ? 'future' : ''}>
                  <th>{e.id}</th>
                  <td>{String(e.attrs.from)} – {String(e.attrs.to)}</td>
                  <td>{String(e.attrs.w)}</td>
                  <td className={isChosen ? 'yes' : wasSeen ? 'no' : 'dim'}>
                    {isChosen ? '选入' : wasSeen ? '丢弃（成环）' : '还没考察'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr><th colSpan={3}>已选边数 / 总权值</th>
              <td className="work">{state.chosen.length} 条 / {state.weight}</td></tr>
          </tfoot>
        </table>
        <p className="tnote">
          n 个顶点的生成树恰好 <b>n−1</b> 条边。Prim 与 Kruskal 选出的边集可能不同
          （权值相等时），但<b>总权值一定相同</b>。
        </p>
      </div>
    </div>
  )
}
