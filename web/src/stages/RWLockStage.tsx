/** 舞台：读写锁 —— 读者共享/写者独占，看持有者与等待队列随请求变化 */
import type { RWLockState } from '@engine/kernels/rwlock.ts'
import type { StageProps } from '../types.ts'

export function RWLockStage({ state }: StageProps<RWLockState>) {
  const { op, readers, writer, waitQ, event, phase } = state
  const done = phase === 'done'
  const holderKind = writer ? 'writer' : readers.length ? 'readers' : 'free'

  return (
    <div className="card">
      <h3>读写锁 RWLock <span className="hint">读读共享、读写/写写互斥</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={`scdn ${writer ? 'miss' : readers.length ? 'ok' : ''}`}>{writer ? `写 ${writer}` : readers.length ? `读 ×${readers.length}` : '空闲'}</span><span className="scdl">锁状态</span></div>
          <div className="scdk"><span className="scdn">{waitQ.length}</span><span className="scdl">等待队列</span></div>
          <div className="scdk"><span className={`scdn ${event.includes('获准') ? 'ok' : event.includes('阻塞') ? 'miss' : ''}`}>{event || '—'}</span><span className="scdl">本步</span></div>
        </div>

        {/* 锁持有区 */}
        <div className={`rw-lock ${holderKind}`}>
          <span className="rw-lbl">锁持有者</span>
          <div className="rw-holders">
            {writer ? (
              <span className="rw-holder w">✍ {writer} <em>写·独占</em></span>
            ) : readers.length ? (
              readers.map(r => <span key={r} className="rw-holder r">👁 {r} <em>读·共享</em></span>)
            ) : (
              <span className="rw-empty">— 空闲 —</span>
            )}
          </div>
        </div>

        {/* 等待队列 */}
        <div className="rw-queue">
          <span className="rw-lbl">等待队列</span>
          <div className="rw-qitems">
            {waitQ.length ? waitQ.map((w, i) => (
              <span key={i} className={`rw-qitem ${w.type === 'W' ? 'w' : 'r'} ${i === 0 ? 'head' : ''}`}>{w.who}<em>{w.type === 'W' ? '写' : '读'}{i === 0 ? '·队首' : ''}</em></span>
            )) : <span className="rw-empty">— 无 —</span>}
          </div>
        </div>

        {event && !done && (
          <div className={`rw-event ${event.includes('获准') ? 'ok' : event.includes('阻塞') ? 'bad' : ''}`}>{event}</div>
        )}

        {done
          ? <p className="scnote"><b>读读共享</b>（多读者并发、不阻塞，读多写少吞吐高）+ <b>读写/写写互斥</b>（写者独占、保证不读到中间态）。代价是要防<b>写饥饿</b>——公平锁让新读者也排在等待的写者后面。Java ReentrantReadWriteLock、Go sync.RWMutex、数据库 S锁/X锁 都是这个模型；<b>读远多于写、读操作不短</b>时最划算。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯锁持有区：读者可以有好几个（共享），写者只能一个且此时读者区必须为空。进不来的请求进等待队列，锁一释放就按队首条件唤醒。</p>}
      </div>
    </div>
  )
}
