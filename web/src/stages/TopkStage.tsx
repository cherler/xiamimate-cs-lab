/** 舞台：海量 Top-K —— 哈希分片(同词同片)把计数装进内存，大小 K 小顶堆求 Top-K(堆顶=门槛，比它大才挤进来) */
import type { TopkState } from '@engine/kernels/topk.ts'
import type { StageProps } from '../types.ts'

export function TopkStage({ state }: StageProps<TopkState>) {
  const { phase, op, K, N, shards, route, heap, consider, evicted, threshold, topk, focus } = state
  const done = phase === 'done'
  const inHeapPhase = phase === 'heap' || done

  return (
    <div className="card">
      <h3>海量 Top-K <span className="hint">哈希分片(同词同片) + 大小 {K} 小顶堆(堆顶=门槛)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{inHeapPhase ? '小顶堆' : '哈希分片'}</span><span className="scdl">当前机制</span></div>
          <div className="scdk"><span className="scdn">{threshold < 0 ? '—' : threshold}</span><span className="scdl">堆顶门槛(第{K}大)</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{done ? topk.map(x => x.word).join('>') : `K=${K}`}</span><span className="scdl">{done ? `Top-${K}` : '目标'}</span></div>
        </div>

        {/* 分片表 */}
        <div className="tk-shards">
          {shards.map(s => (
            <div key={s.id} className={`tk-shard ${route?.shard === s.id && phase === 'shard' ? 'on' : ''}`}>
              <div className="tk-shead">shard{s.id} <em>hash%{N}={s.id}</em></div>
              <div className="tk-sitems">
                {s.items.length === 0 ? <span className="kv-empty">空</span>
                  : s.items.map(w => <span key={w.word} className={`tk-wc ${route?.word === w.word ? 'now' : ''}`}>{w.word}<b>{w.count}</b></span>)}
              </div>
            </div>
          ))}
        </div>

        {/* 路由说明 */}
        {route && phase === 'shard' && (
          <div className="tk-route">「{route.word}」<code>hash={route.hash} % {N} = {route.shard}</code> → shard{route.shard}，计数 {route.count}（同词必同片）</div>
        )}

        {/* 小顶堆 */}
        {inHeapPhase && (
          <div className="tk-heapwrap">
            <div className="tk-hlabel">小顶堆（{heap.length}/{K}）· 堆顶=最小=门槛</div>
            <div className="tk-heap">
              {heap.map((w, idx) => (
                <span key={w.word} className={`tk-slot ${idx === 0 ? 'root' : ''} ${consider?.word === w.word && (op === 'insert' || op === 'replace') ? 'fresh' : ''}`}>
                  {w.word}<b>{w.count}</b>{idx === 0 && <em>门槛</em>}
                </span>
              ))}
              {Array.from({ length: Math.max(0, K - heap.length) }).map((_, idx) => <span key={'e' + idx} className="tk-slot empty">空</span>)}
            </div>
            {consider && !done && (
              <div className={`tk-consider ${op}`}>
                考察「{consider.word}」({consider.count})：
                {op === 'insert' && <span>堆未满 → 放入</span>}
                {op === 'replace' && <span className="ok">{consider.count} &gt; 门槛 {evicted?.count} → 淘汰「{evicted?.word}」({evicted?.count}) 换上</span>}
                {op === 'skip' && <span className="miss">{consider.count} ≤ 门槛 {threshold} → 进不了前 {K}，扔</span>}
              </div>
            )}
          </div>
        )}

        {done
          ? <p className="scnote">Top-{K} = <b>{topk.map(x => `${x.word}(${x.count})`).join('、')}</b>。<b>哈希分片</b>让上亿 key 装进内存（同词同片、各片独立数=MapReduce 的 map）；<b>大小 K 小顶堆</b>让取前 K 不必全排序：O(n㏒K)≪O(n㏒n)、只吃 K 个内存，绝大多数词一比门槛就扔。再大用 Count-Min Sketch 近似计数；热点倾斜就二次分片。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{phase === 'shard' ? '哈希确定→同一个词每次都落同一片，计数才不会被拆到两片求和出错。' : '小顶堆堆顶是这 K 个里最小的=当前门槛；新词只有超过门槛才值得挤掉堆顶进来。'}</p>}
      </div>
    </div>
  )
}
