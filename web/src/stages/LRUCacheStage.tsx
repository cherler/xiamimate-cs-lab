/** 舞台：手写 LRU 缓存 —— 双向链表(头=最近/尾=最久) + HashMap，看移头与淘汰尾 */
import type { LRUState } from '@engine/kernels/lrucache.ts'
import type { StageProps } from '../types.ts'

export function LRUCacheStage({ state }: StageProps<LRUState>) {
  const { op, opDesc, list, result, hit, evicted, moved, capacity, phase } = state
  const done = phase === 'done'
  const isGet = op === 'get'

  return (
    <div className="card">
      <h3>手写 LRU 缓存 <span className="hint">HashMap + 双向链表，get/put 都 O(1)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{opDesc || '就绪'}</span><span className="scdl">本步操作</span></div>
          <div className="scdk"><span className={`scdn ${isGet ? (hit ? 'ok' : 'miss') : ''}`}>{isGet ? (result === -1 ? '未命中 -1' : `命中 ${result}`) : evicted !== null ? `淘汰 ${evicted}` : '插入'}</span><span className="scdl">结果</span></div>
          <div className="scdk"><span className="scdn">{list.length}/{capacity}</span><span className="scdl">占用/容量</span></div>
        </div>

        {/* HashMap keys */}
        <div className="lru-map">
          <span className="lru-mlbl">HashMap keys</span>
          <div className="lru-keys">
            {list.length ? list.map(n => <span key={n.k} className={`lru-key ${moved === n.k ? 'moved' : ''}`}>{n.k}</span>) : <span className="rw-empty">空</span>}
            {evicted !== null && <span className="lru-key ev">✗{evicted}</span>}
          </div>
        </div>

        {/* 双向链表 */}
        <div className="lru-list">
          <span className="lru-end head">头·最近</span>
          {list.map((n, i) => (
            <span key={n.k} className="lru-node-wrap">
              <span className={`lru-node ${moved === n.k && i === 0 ? 'moved' : ''} ${i === 0 ? 'athead' : ''} ${i === list.length - 1 && op === 'put' && list.length >= capacity ? 'attail' : ''}`}>
                <b>{n.k}</b><i>:{n.v}</i>
              </span>
              {i < list.length - 1 && <span className="lru-link">⇄</span>}
            </span>
          ))}
          {evicted !== null && <span className="lru-evicted">⟶ 淘汰 {evicted}</span>}
          <span className="lru-end tail">尾·最久</span>
        </div>

        {(moved !== null || evicted !== null) && !done && (
          <div className={`lru-note ${evicted !== null ? 'ev' : 'mv'}`}>
            {evicted !== null ? `缓存满 ${capacity}：淘汰尾部 ${evicted}（最久没用），新节点插到头部` : isGet ? `命中 → 把 ${moved} 移到头部（它刚被用，成了最近的）` : `${moved} 插到/移到头部`}
          </div>
        )}

        {done
          ? <p className="scnote"><b>HashMap 给 O(1) 定位、双向链表给 O(1) 摘除和头插</b>，两者配合让 get/put 都 O(1)，淘汰永远从尾部。面试讲这个项目：为什么要双向链表（单链表删节点找不到前驱）、为什么要 HashMap（否则定位 O(n)）、容量满怎么淘汰——一套下来就是"我实现过 O(1) 的 LRU"。Redis 近似 LRU、本地缓存都建在这上面。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯链表：头是最近用的、尾是最久没用的。get 命中就把节点移到头；put 满了就砍掉尾部那个。HashMap 让"找节点"是 O(1)，双向链表让"摘节点/插头"也是 O(1)。</p>}
      </div>
    </div>
  )
}
