/** 舞台：距离矢量路由 —— 距离矢量矩阵（逐轮演化）+ 网络图 */
import { RIP_INF, type RipState } from '@engine/kernels/rip.ts'
import type { SimDocument } from '@engine/core/document.ts'
import type { StageProps } from '../types.ts'
import { GraphView } from '../shell/GraphView.tsx'
import { rich } from '../shell/rich.tsx'

export function RipStage({ doc, state, tab }: StageProps<RipState>) {
  if (tab === 'graph') return <Net doc={doc} state={state} />
  return <Matrix state={state} />
}

const fmt = (v: number) => (v >= RIP_INF ? '∞' : String(v))

function Matrix({ state }: { state: RipState }) {
  const { routers, dist, via, changed, broken } = state
  const changedSet = new Set(changed)
  return (
    <div className="card">
      <h3>距离矢量矩阵 <span className="hint">行 = 路由器，列 = 目的地；格子是「代价（下一跳）」</span></h3>
      <div className="body scroll">
        <table className="ripmat">
          <thead>
            <tr><th className="corner">到 →<br />从 ↓</th>{routers.map(y => <th key={y}>{y}</th>)}</tr>
          </thead>
          <tbody>
            {routers.map(x => (
              <tr key={x}>
                <th>{x}</th>
                {routers.map(y => {
                  const v = dist[x]?.[y] ?? RIP_INF
                  const self = x === y
                  const inf = v >= RIP_INF
                  const cls = [
                    self ? 'self' : '',
                    !self && inf ? 'inf' : '',
                    changedSet.has(`${x}→${y}`) ? 'changed' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <td key={y} className={cls}>
                      <span className="rc">{self ? '0' : fmt(v)}</span>
                      {!self && !inf && via[x]?.[y] ? <span className="rv">{via[x][y]}</span> : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="riplegend">
          <span><i className="rcw changed" />本轮变了</span>
          <span><i className="rcw inf" />∞ = 不可达（≥ {RIP_INF}）</span>
          {broken ? <span className="ripbroken">链路 {broken[0]}—{broken[1]} 已断</span> : null}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}

function Net({ doc, state }: { doc: SimDocument; state: RipState }) {
  const brokenId = state.broken
  return (
    <div className="card">
      <h3>网络拓扑 <span className="hint">断掉的链路会标红</span></h3>
      <div className="body">
        <GraphView
          doc={doc}
          edgeTone={id => (brokenId && (id === brokenId || id === brokenId[1] + brokenId[0]) ? 'dropped' : 'plain')}
          legend={brokenId ? [['dropped', '已断链路']] : undefined}
        />
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
