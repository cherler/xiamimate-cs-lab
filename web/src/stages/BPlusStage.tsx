/** 舞台：B+ 树 —— 多叉树形 + 叶子链 */
import type { BPlusState, BNode } from '@engine/kernels/bplus.ts'
import { leafChain } from '@engine/kernels/bplus.ts'
import type { StageProps } from '../types.ts'

export function BPlusStage({ doc, trace, index, state, tab }: StageProps<BPlusState>) {
  if (tab === 'leaves') return <Leaves state={state} order={doc.params.order as number} />
  return <Tree state={state} order={doc.params.order as number} />
}

/** 按层排开：B+ 树是多叉的，不能用二叉的 TreeView */
function Tree({ state, order }: { state: BPlusState; order: number }) {
  const focus = new Set(state.focus)
  //  只画从根可达的结点 —— 分裂会留下不再引用的旧结点
  const levels: number[][] = []
  let cur = [state.root]
  const seen = new Set<number>()
  while (cur.length > 0 && levels.length < 8) {
    levels.push(cur.filter(n => !seen.has(n)))
    cur.forEach(n => seen.add(n))
    cur = cur.flatMap(n => state.nodes[n]?.children ?? [])
  }

  return (
    <div className="card">
      <h3>B+ 树 <span className="hint">{order} 阶 · 每个结点最多 {order - 1} 个关键字</span></h3>
      <div className="body scroll">
        <div className="bpt">
          {levels.map((row, d) => (
            <div className="bprow" key={d}>
              {row.map(n => {
                const nd: BNode = state.nodes[n]
                if (!nd) return null
                return (
                  <div key={n}
                    className={`bpnode ${nd.leaf ? 'leaf' : 'inner'} ${focus.has(n) ? 'hot' : ''}`}>
                    {nd.keys.map((k, j) => (
                      <span key={j} className={k === state.key ? 'cur' : ''}>{k}</span>
                    ))}
                    {nd.keys.length === 0 ? <em>空</em> : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="bplegend">
          <span><i className="bw inner" />内部结点（只当索引）</span>
          <span><i className="bw leaf" />叶子（所有关键字都在这一层）</span>
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 叶子链：B+ 树相对 B 树的最大好处就在这条链上 */
function Leaves({ state, order }: { state: BPlusState; order: number }) {
  const chain = leafChain(state.nodes, state.root)
  //  收集叶子结点本身，画成链
  const leaves: number[] = []
  let cur = state.root
  while (state.nodes[cur] && !state.nodes[cur].leaf) cur = state.nodes[cur].children[0]
  while (cur !== -1 && state.nodes[cur]) { leaves.push(cur); cur = state.nodes[cur].next }

  return (
    <div className="card">
      <h3>叶子链 <span className="hint">所有关键字都在这一层，且串成有序链表</span></h3>
      <div className="body scroll">
        <div className="bpchain">
          {leaves.map((n, k) => (
            <div key={n} className="bpleaf">
              <div className="ks">
                {state.nodes[n].keys.map((x, j) => <span key={j}>{x}</span>)}
              </div>
              {k < leaves.length - 1 ? <span className="arrow">→</span> : null}
            </div>
          ))}
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">叶子个数</span><span className="v">{leaves.length}</span></div>
          <div className="pr"><span className="k">链上关键字</span>
            <span className="v">{chain.join(' ')}</span></div>
          <div className="pr"><span className="k">树高</span><span className="v">{state.height} 层</span></div>
          <div className="pr"><span className="k">分裂次数</span><span className="v">{state.splits}</span></div>
        </div>
        <p className="tnote">
          B+ 树相对 B 树的两点差别，也正是它适合做数据库索引的原因：<br />
          <b>1. 所有关键字都在叶子层</b> —— 内部结点只放索引，一个结点能塞下更多分支，树更矮，磁盘 I/O 更少。<br />
          <b>2. 叶子串成有序链表</b> —— 范围查询（"找出 30 到 60 之间的所有记录"）顺着链走就行，不用回树上。<br />
          还有一处最容易记反：<b>叶子分裂时中间键复制上去（叶子自己留一份），内部结点分裂时中间键上移（自己不留）</b>。
        </p>
      </div>
    </div>
  )
}
