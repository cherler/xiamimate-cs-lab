/** 舞台：拓扑排序与关键路径 —— AOE 图 + ve/vl 表 */
import type { TopoState } from '@engine/kernels/topo.ts'
import type { StageProps } from '../types.ts'
import { GraphView } from '../shell/GraphView.tsx'

export function TopoStage({ doc, trace, index, state, tab }: StageProps<TopoState>) {
  const critical = doc.params.operation === 'critical'
  if (tab === 'table') return <Table doc={doc} state={state} critical={critical} trace={trace} index={index} />
  return <Graph doc={doc} state={state} critical={critical} />
}

function Graph({ doc, state, critical }: {
  doc: StageProps<TopoState>['doc']; state: TopoState; critical: boolean
}) {
  const crit = new Set(state.critical)
  const done = new Set(state.order)
  return (
    <div className="card">
      <h3>{critical ? 'AOE 网' : '有向图'}
        <span className="hint">{critical ? '边上的数是活动耗时' : '每次取一个入度为 0 的顶点'}</span></h3>
      <div className="body">
        <GraphView
          doc={doc} directed
          edgeTone={id => (crit.has(id) ? 'critical' : id === state.at ? 'active' : 'plain')}
          vertTone={id => (id === state.at ? 'active' : done.has(id) ? 'done' : 'plain')}
          vertSub={id => {
            if (!critical) return state.indeg[id] !== undefined ? `入度 ${state.indeg[id]}` : ''
            const ve = state.ve[id], vl = state.vl[id]
            if (ve === undefined) return ''
            return vl === undefined ? `ve ${ve}` : `${ve} / ${vl}`
          }}
          legend={critical
            ? [['critical', '关键活动'], ['active', '本步'], ['plain', '有时间余量']]
            : [['active', '本步删除的出边'], ['plain', '尚未处理']]}
        />
        <div className="phasenow">
          {!critical && (
            <div className="pr"><span className="k">拓扑序列</span>
              <span className="v">{state.order.join(' → ') || '还没开始'}</span></div>
          )}
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** ve/vl 与活动表 —— 关键路径题就是填这两张表 */
function Table({ doc, state, critical, trace, index }: {
  doc: StageProps<TopoState>['doc']; state: TopoState; critical: boolean
  trace: TopoState[]; index: number
}) {
  const nodes = doc.entities.filter(e => e.type === 'node').map(e => e.id)
  const edges = doc.entities.filter(e => e.type === 'edge')

  if (!critical) {
    const steps = trace.filter(s => s.phase === 'topo' && s.at)
    return (
      <div className="card">
        <h3>入度变化 <span className="hint">每输出一个顶点，它的后继入度就减一</span></h3>
        <div className="body scroll">
          <table className="ptab">
            <thead>
              <tr><th>步</th><th>输出</th>{nodes.map(n => <th key={n}>{n}</th>)}</tr>
            </thead>
            <tbody>
              {steps.map(s => (
                <tr key={s.i} className={s.i > index ? 'future' : s.i === index ? 'past' : ''}>
                  <td>{s.i}</td>
                  <th>{s.at}</th>
                  {nodes.map(n => (
                    <td key={n} className={s.indeg[n] === 0 ? 'yes' : ''}>{s.indeg[n]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tnote">
            入度降到 0 的顶点就可以输出了。若最后还有顶点入度不为 0，说明<b>图里有环</b>，
            不存在拓扑序列。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3>ve / vl 与活动表 <span className="hint">e = 起点 ve，l = 终点 vl − 耗时</span></h3>
      <div className="body scroll">
        <table className="ptab">
          <thead><tr><th>事件</th>{nodes.map(n => <th key={n}>{n}</th>)}</tr></thead>
          <tbody>
            <tr><th>ve 最早</th>
              {nodes.map(n => (
                <td key={n} className={state.at === n && state.phase === 've' ? 'work' : ''}>
                  {state.ve[n] ?? '—'}
                </td>
              ))}</tr>
            <tr><th>vl 最迟</th>
              {nodes.map(n => (
                <td key={n} className={state.at === n && state.phase === 'vl' ? 'work' : ''}>
                  {state.vl[n] ?? '—'}
                </td>
              ))}</tr>
            <tr><th>余量</th>
              {nodes.map(n => {
                const d = (state.vl[n] ?? 0) - (state.ve[n] ?? 0)
                const has = state.vl[n] !== undefined && state.ve[n] !== undefined
                return <td key={n} className={has && d === 0 ? 'no' : ''}>{has ? d : '—'}</td>
              })}</tr>
          </tbody>
        </table>

        <div className="entcap" style={{ marginTop: 14 }}>活动表</div>
        <table className="ptab">
          <thead><tr><th>活动</th><th>耗时</th><th>e 最早开始</th><th>l 最迟开始</th><th>余量 l−e</th><th /></tr></thead>
          <tbody>
            {edges.map(e => {
              const ee = state.ee[e.id], el = state.el[e.id]
              const has = ee !== undefined && el !== undefined
              const isCrit = state.critical.includes(e.id)
              return (
                <tr key={e.id} className={!has ? 'future' : ''}>
                  <th>{e.id}</th>
                  <td>{String(e.attrs.w)}</td>
                  <td>{has ? ee : '—'}</td>
                  <td>{has ? el : '—'}</td>
                  <td className={has && el - ee === 0 ? 'no' : ''}>{has ? el - ee : '—'}</td>
                  <td className="dim">{isCrit ? '← 关键活动' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="tnote">
          <b>ve 正推取最大</b>（所有前置活动都完成才能开始）、
          <b>vl 逆推取最小</b>（不能拖累任何一个后继）—— 这两个方向搞反是最常见的错。
          余量为 0 的活动就是关键活动，缩短它才能缩短总工期。
        </p>
      </div>
    </div>
  )
}
