/** 舞台：手写 LFU 缓存 —— 每项带频率徽章，满了淘汰最低频(同频看最久未用) */
import type { LFUState } from '@engine/kernels/lfucache.ts'
import type { StageProps } from '../types.ts'

export function LFUCacheStage({ state }: StageProps<LFUState>) {
  const { op, opDesc, entries, result, hit, evicted, evictReason, bumped, capacity, phase } = state
  const done = phase === 'done'
  const isGet = op === 'get'
  const minFreq = entries.length ? Math.min(...entries.map(e => e.freq)) : 0

  return (
    <div className="card">
      <h3>手写 LFU 缓存 <span className="hint">按频率淘汰，同频再看最久未用（LRU 打平手）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{opDesc || '就绪'}</span><span className="scdl">本步操作</span></div>
          <div className="scdk"><span className={`scdn ${isGet ? (hit ? 'ok' : 'miss') : evicted !== null ? 'miss' : ''}`}>{isGet ? (result === -1 ? '未命中 -1' : `命中 ${result}`) : evicted !== null ? `淘汰 ${evicted}` : '插入'}</span><span className="scdl">结果</span></div>
          <div className="scdk"><span className="scdn">{entries.length}/{capacity}</span><span className="scdl">占用/容量</span></div>
        </div>

        <div className="lfu-cards">
          {entries.length ? entries.map(e => (
            <div key={e.k} className={`lfu-card ${bumped === e.k ? 'bump' : ''} ${e.freq === minFreq && !isGet ? 'lfu' : ''}`}>
              <span className="lfu-kv">{e.k}:{e.v}</span>
              <span className={`lfu-freq ${e.freq === minFreq ? 'min' : ''}`}>freq {e.freq}</span>
              {e.freq === minFreq && entries.length > 1 && <span className="lfu-mark">最低频</span>}
            </div>
          )) : <span className="rw-empty">空</span>}
          {evicted !== null && <span className="lfu-evicted">✗ 淘汰 {evicted}</span>}
        </div>

        {evicted !== null && !done && (
          <div className="lfu-note">
            缓存满 {capacity} → 淘汰 <b>{evicted}</b>：{evictReason === '最低频' ? '它频率最低' : '和别人同频，但它最久没被用（同频用 LRU 打破平手）'}
          </div>
        )}
        {isGet && hit && !done && (
          <div className="lfu-note mv">命中 {bumped} → 频率 +1（用得越多越不容易被淘汰）</div>
        )}

        {done
          ? <p className="scnote"><b>LFU 按频率淘汰、同频再按最久未用</b>。O(1) 实现 = 频率桶(freq→双向链表) + minFreq 指针。面试讲：和 LRU 的区别（<b>频率 vs 时间</b>）、为什么要 minFreq（O(1) 定位要淘汰的桶）、同频怎么打破平手（桶内维护 LRU）、LFU 的坑（老热点频率高、赖着不走 → 真实系统用带衰减的近似 LFU，如 Redis）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯每张卡的 freq：get/put 命中都让它 +1。容量满时，淘汰 freq 最低的那张；要是有多张并列最低，就淘汰其中最久没用的（这就是 LFU 和 LRU 的关键差别）。</p>}
      </div>
    </div>
  )
}
