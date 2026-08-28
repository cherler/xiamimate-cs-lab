/** 舞台：Feed 推拉扩散 —— 普通用户发帖走推(写进我的收件箱)，大V发帖走拉(只存outbox)，刷feed两路归并按时间排 */
import type { FeedState } from '@engine/kernels/feed.ts'
import type { StageProps } from '../types.ts'

const tag = (text: string) => text.split('：')[0]

export function FeedStage({ state }: StageProps<FeedState>) {
  const { phase, op, event, myInbox, vOutbox, pushWrites, savedWrites, feed, focus } = state
  const done = phase === 'done'
  const showFeed = phase === 'read' || done

  return (
    <div className="card">
      <h3>Feed 流 · 推拉扩散 <span className="hint">推=写扩散(读快写贵)，拉=读归并(写快读贵)，大V走拉</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '推拉结合' : phase === 'push' ? '推·写扩散' : phase === 'pull' ? '拉·存outbox' : phase === 'read' ? '刷feed归并' : '就绪'}</span><span className="scdl">当前模式</span></div>
          <div className="scdk"><span className="scdn">{pushWrites}</span><span className="scdl">推·累计写入</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{savedWrites.toLocaleString()}</span><span className="scdl">大V拉·省下的写</span></div>
        </div>

        {/* 本步发帖 */}
        {event && (
          <div className={`fd-event ${event.mode}`}>
            <b>{event.author}</b> 发「{tag(event.text)}」
            {event.mode === 'push'
              ? <span className="fd-em push">推 → 写进 {event.fanout} 个粉丝收件箱</span>
              : <span className="fd-em pull">拉 → 只存 outbox，省 {(1_000_000).toLocaleString()} 次写</span>}
          </div>
        )}

        {/* 两路：我的收件箱 + 大V outbox */}
        <div className="fd-boxes">
          <div className="fd-box">
            <div className="fd-bhead">「我」的收件箱 <em>推来的（读 O(1)）</em></div>
            <div className="fd-items">
              {myInbox.length === 0 ? <span className="kv-empty">空</span>
                : myInbox.map(p => <span key={p.t} className={`fd-post ${op === 'postPush' && event?.t === p.t ? 'now' : ''}`}><b>{tag(p.text)}</b><i>{p.author}·t{p.t}</i></span>)}
            </div>
          </div>
          <div className="fd-box v">
            <div className="fd-bhead">大V 的 outbox <em>不扩散（刷时拉）</em></div>
            <div className="fd-items">
              {vOutbox.length === 0 ? <span className="kv-empty">空</span>
                : vOutbox.map(p => <span key={p.t} className={`fd-post v ${op === 'postPull' && event?.t === p.t ? 'now' : ''}`}><b>{tag(p.text)}</b><i>{p.author}·t{p.t}</i></span>)}
            </div>
          </div>
        </div>

        {/* 归并出的 feed */}
        {showFeed && (
          <div className="fd-feed">
            <div className="fd-bhead">「我」的 Feed <em>收件箱 + 拉大V → 按时间归并</em></div>
            <div className="fd-timeline">
              {feed.map((p, idx) => (
                <span key={p.t} className={`fd-tl ${p.author === '大V' ? 'v' : ''}`}>
                  <b>{tag(p.text)}</b><i>{p.author}·t{p.t}</i>{idx < feed.length - 1 && <span className="fd-gt">›</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {done
          ? <p className="scnote"><b>推</b>(fan-out on write)：发帖写进每个粉丝收件箱→读 O(1)、写 O(粉丝数)，普通用户用；<b>拉</b>(fan-out on read)：只存 outbox→写 O(1)、读要归并，大V 用。刷 feed = 读收件箱(推来的) + 拉少数大V，按时间<b>多路归并</b>。本例推写 {pushWrites} 次，大V 走拉省 {savedWrites.toLocaleString()} 次。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{phase === 'push' ? '普通用户粉丝少，发帖时写进每个粉丝收件箱——读 feed 时直接读收件箱、O(1)。' : phase === 'pull' ? '大V 百万粉，推会写爆——只存自己 outbox，粉丝刷时再实时拉这一个作者。' : phase === 'read' ? '收件箱(推来的普通帖)+拉大V outbox，按逻辑时间归并=多路有序合并。' : '普通用户走推、大V 走拉，最后刷 feed 归并。'}</p>}
      </div>
    </div>
  )
}
