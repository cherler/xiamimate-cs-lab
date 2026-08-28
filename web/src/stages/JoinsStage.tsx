/** 舞台：三种 JOIN 算法 —— 同两表走 NLJ/Hash/SMJ，看机制与代价 */
import type { JoinState } from '@engine/kernels/joins.ts'
import type { StageProps } from '../types.ts'

const ALGO_NAME: Record<string, string> = { none: '', nlj: 'Nested Loop', hash: 'Hash Join', smj: 'Sort-Merge' }

export function JoinsStage({ state }: StageProps<JoinState>) {
  const { algo, op, users, orders, hash, matches, cost, costs, phase } = state
  const done = phase === 'done'
  const maxCost = Math.max(costs.nlj, costs.hash, costs.smj, 1)
  const BARS = [
    { k: 'nlj', name: 'Nested Loop', v: costs.nlj, note: 'O(N×M)·任意条件', tone: 'bad' },
    { k: 'hash', name: 'Hash Join', v: costs.hash, note: 'O(N+M)·等值主力', tone: 'good' },
    { k: 'smj', name: 'Sort-Merge', v: costs.smj, note: '排序+归并·要有序', tone: '' },
  ]

  return (
    <div className="card">
      <h3>三种 JOIN 算法 <span className="hint">同样两表连接，优化器按代价选算法</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '代价对比' : ALGO_NAME[algo] || 'JOIN'}</span><span className="scdl">当前算法</span></div>
          <div className="scdk"><span className="scdn">{op === 'build' ? 'build 建表' : op === 'probe' ? 'probe 探测' : op === 'sort' ? '排序' : op === 'merge' ? '归并' : op === 'nlj' ? '逐行嵌套' : '—'}</span><span className="scdl">阶段</span></div>
          <div className="scdk"><span className={`scdn ${matches.length ? 'ok' : ''}`}>{cost > 0 ? `${cost} 次/步` : matches.length ? `${matches.length} 匹配` : '—'}</span><span className="scdl">{cost > 0 ? '代价' : '匹配'}</span></div>
        </div>

        {!done && (
          <div className="jn-tables">
            <div className="jn-tbl">
              <span className="jn-tname">Users.id</span>
              <div className="jn-rows">{users.map((u, i) => <span key={i} className="jn-row">{u}</span>)}</div>
            </div>
            <div className="jn-mid">
              <span className="jn-join">⋈ id=uid</span>
              {algo === 'hash' && hash.length > 0 && <div className="jn-hash">哈希表 {`{${hash.join(',')}}`}</div>}
            </div>
            <div className="jn-tbl">
              <span className="jn-tname">Orders.uid</span>
              <div className="jn-rows">{orders.map((o, i) => <span key={i} className={`jn-row ${algo === 'hash' && op === 'probe' && hash.includes(o) ? 'hit' : algo === 'hash' && op === 'probe' ? 'miss' : ''}`}>{o}</span>)}</div>
            </div>
          </div>
        )}

        {matches.length > 0 && !done && (
          <div className="jn-matches">匹配行：{matches.map((m, i) => <span key={i} className="jn-mrow">({m[0]},{m[1]})</span>)}</div>
        )}

        {done && (
          <div className="jn-costs">
            {BARS.map(bar => (
              <div key={bar.k} className={`jn-cbar ${bar.tone}`}>
                <span className="jn-cname">{bar.name}</span>
                <span className="jn-ctrack"><i style={{ width: `${(bar.v / maxCost) * 100}%` }} /></span>
                <span className="jn-cval">{bar.v}{bar.k === 'smj' ? ' +排序' : ' 次'}</span>
                <span className="jn-cnote">{bar.note}</span>
              </div>
            ))}
          </div>
        )}

        {done
          ? <p className="scnote">优化器（MySQL/PG 的 EXPLAIN）按表大小、有无索引、连接类型（等值 vs 范围）、要不要有序，估算代价挑一个：<b>Nested Loop</b> 表小/有索引才划算、<b>Hash Join</b> 大表等值连接首选、<b>Sort-Merge</b> 输入已排序或要有序输出时最好。看懂这三种，就能读懂执行计划——SQL 调优的基本功。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。三种算法结果一样（{matches.length || 3} 个匹配行），但代价机制不同：NLJ 双层循环、Hash 建表+探测、SMJ 排序+双指针归并。走到底看代价对比。</p>}
      </div>
    </div>
  )
}
