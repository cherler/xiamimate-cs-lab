/** 舞台：图的遍历 —— 图 + 栈/队列 */
import type { TravState } from '@engine/kernels/traverse.ts'
import type { StageProps } from '../types.ts'
import { GraphView } from '../shell/GraphView.tsx'

export function TraverseStage({ doc, state, tab }: StageProps<TravState>) {
  const dfs = doc.params.algorithm === 'DFS'
  if (tab === 'container') return <Container state={state} dfs={dfs} />
  const visited = new Set(state.order)
  const tree = new Set(state.treeEdges)
  return (
    <div className="card">
      <h3>遍历过程 <span className="hint">{dfs ? 'DFS：栈' : 'BFS：队列'} · 深色=已访问</span></h3>
      <div className="body">
        <GraphView
          doc={doc}
          directed={doc.params.directed === 1}
          edgeLabel={() => ''}
          edgeTone={id => {
            const e = doc.entities.find(x => x.id === id)!
            const a = String(e.attrs.from), b = String(e.attrs.to)
            return tree.has(`${a}-${b}`) || tree.has(`${b}-${a}`) ? 'chosen' : 'plain'
          }}
          vertTone={id => (id === state.at ? 'active' : visited.has(id) ? 'done' : 'plain')}
          vertSub={id => {
            const k = state.order.indexOf(id)
            return k >= 0 ? `第 ${k + 1} 个` : ''
          }}
          legend={[['chosen', '生成树上的边'], ['plain', '回边 / 未走']]}
        />
        <div className="phasenow">
          <div className="pr"><span className="k">访问序列</span>
            <span className="v">{state.order.join(' → ') || '还没开始'}</span></div>
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 栈/队列内容 —— DFS 与 BFS 的全部差别就在这里 */
function Container({ state, dfs }: { state: TravState; dfs: boolean }) {
  return (
    <div className="card">
      <h3>{dfs ? '栈' : '队列'}的内容
        <span className="hint">{dfs ? '从末尾（栈顶）取' : '从开头（队首）取'}</span></h3>
      <div className="body">
        <div className="trcont">
          <span className="end">{dfs ? '栈底' : '队首'}</span>
          <div className="tritems">
            {state.pending.length === 0 ? <em>空</em>
              : state.pending.map((x, k) => (
                <span key={k} className={
                  (dfs && k === state.pending.length - 1) || (!dfs && k === 0) ? 'next' : ''
                }>{x}</span>
              ))}
          </div>
          <span className="end">{dfs ? '栈顶 ↑ 下一个从这取' : '队尾'}</span>
        </div>
        <div className="trorder">
          <span className="k">已访问</span>
          {state.order.map((x, k) => (
            <span key={k} className="o">{k + 1}.{x}</span>
          ))}
          {state.order.length === 0 ? <em>还没有</em> : null}
        </div>
        <p className="tnote">
          DFS 与 BFS 的代码几乎一模一样，唯一的差别是<b>下一个从哪儿取</b>：
          DFS 取栈顶（后进先出，所以一条路走到黑），BFS 取队首（先进先出，所以一层一层铺开）。
          把容器从栈换成队列，算法就从 DFS 变成了 BFS。
        </p>
      </div>
    </div>
  )
}
