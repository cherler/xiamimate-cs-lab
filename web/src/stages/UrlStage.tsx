/** 舞台：短链发号器 —— 发号器发自增 ID、Base62 编码成短码、累积映射；跳转时解码回 ID 查库 302 */
import type { UrlState } from '@engine/kernels/urlshortener.ts'
import type { StageProps } from '../types.ts'

const short = (u: string) => (u.length > 44 ? u.slice(0, 41) + '…' : u)

export function UrlStage({ state }: StageProps<UrlState>) {
  const { phase, counter, entries, cur, lookup, capacity, focus } = state
  const done = phase === 'done'

  return (
    <div className="card">
      <h3>短链 · 发号器 + Base62 <span className="hint">自增 ID 保唯一，Base62 保短，解码可逆</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{counter.toLocaleString()}</span><span className="scdl">发号器下一个号</span></div>
          <div className="scdk"><span className="scdn">{entries.length}</span><span className="scdl">已建短链</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>62⁶≈{(capacity / 1e8).toFixed(0)}亿</span><span className="scdl">6 位码容量</span></div>
        </div>

        {/* 映射表：长 URL → id → 短码 */}
        <div className="url-map">
          <div className="url-head"><span>长 URL</span><span>发号 ID</span><span>Base62 短码</span></div>
          {entries.length === 0 ? <div className="kv-empty">还没发号</div>
            : entries.map((e, i) => (
              <div key={e.code} className={`url-row ${cur === i && phase === 'issue' ? 'on' : ''} ${lookup?.code === e.code ? 'hit' : ''}`}>
                <span className="url-long" title={e.longUrl}>{short(e.longUrl)}</span>
                <span className="url-id">{e.id.toLocaleString()}</span>
                <span className="url-code">{e.code}</span>
              </div>
            ))}
        </div>

        {/* 跳转解码 */}
        {lookup && (
          <div className="url-redirect">
            <span className="url-rk">访问</span><code className="url-rc">/{lookup.code}</code>
            <span className="url-arr">→ 解码 →</span><span className="url-rid">ID {lookup.id.toLocaleString()}</span>
            <span className="url-arr">→ 查库 →</span><span className="url-302">302</span>
            <div className="url-target" title={lookup.longUrl}>{short(lookup.longUrl)}</div>
          </div>
        )}

        {done
          ? <p className="scnote">短链的机制：<b>发号器</b>发自增 ID（唯一、不碰撞）+ <b>Base62</b> 编码（1 亿→"6LAze"，只 5 位）。不用哈希是怕<b>碰撞</b>，不用十进制明文是怕被<b>顺号爬遍</b>。跳转靠 Base62 <b>解码</b>回 ID 查库、302（可统计）/301（永久省服务器）。读多写少 100:1 → 热点码进缓存扛读；发号器用号段/雪花做分布式。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{phase === 'redirect' ? '编码/解码是可逆的一对：解出来的 ID 正好等于当初发的号。' : phase === 'capacity' ? '每位 62 种取值，L 位就是 62^L 个码——比十进制每位 10 种密得多。' : '发号器保证 ID 单调递增、不重复，所以短码一定唯一。'}</p>}
      </div>
    </div>
  )
}
