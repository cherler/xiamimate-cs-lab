/** 舞台：阻塞队列 —— 有界缓冲 + 生产者/消费者，满/空时挂起、对方操作后唤醒 */
import type { BQState } from '@engine/kernels/blockingqueue.ts'
import type { StageProps } from '../types.ts'

export function BlockingQueueStage({ state }: StageProps<BQState>) {
  const { op, queue, cap, actor, item, blockedP, blockedC, event, phase } = state
  const done = phase === 'done'
  const full = queue.length >= cap
  const empty = queue.length === 0
  const slots = Array.from({ length: cap }, (_, k) => queue[k] ?? null)
  const isBlockOp = op === 'blockFull' || op === 'blockEmpty'
  const isWake = op === 'wakeP' || op === 'wakeC'

  return (
    <div className="card">
      <h3>线程安全阻塞队列 <span className="hint">满时 put 阻塞、空时 take 阻塞（生产者-消费者）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'intro' ? '就绪' : actor === 'P' ? `生产者 ${op === 'put' || op === 'wakeC' || op === 'blockFull' ? 'put' : ''}` : `消费者 ${op === 'take' || op === 'wakeP' || op === 'blockEmpty' ? 'take' : ''}`}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className={`scdn ${full ? 'miss' : empty ? '' : 'ok'}`}>{queue.length}/{cap}{full ? ' 满' : empty ? ' 空' : ''}</span><span className="scdl">队列占用</span></div>
          <div className="scdk"><span className={`scdn ${blockedP || blockedC ? 'miss' : ''}`}>{blockedP ? '⏳生产者' : blockedC ? '⏳消费者' : '无阻塞'}</span><span className="scdl">阻塞</span></div>
        </div>

        <div className="bq-scene">
          {/* 生产者 */}
          <div className={`bq-actor prod ${actor === 'P' && !done ? 'active' : ''} ${blockedP ? 'blocked' : ''}`}>
            <span className="bq-aname">生产者 P</span>
            <span className="bq-astate">{blockedP ? '⏳ 阻塞(等空位)' : op === 'put' || op === 'wakeC' ? `put(${item})` : '就绪'}</span>
          </div>

          {/* 有界缓冲 */}
          <div className={`bq-buffer ${full ? 'full' : ''} ${empty ? 'empty' : ''}`}>
            <span className="bq-blbl">有界缓冲 (cap {cap})</span>
            <div className="bq-slots">
              {slots.map((v, k) => (
                <span key={k} className={`bq-slot ${v ? 'filled' : 'free'} ${v && v === item && (op === 'put' || op === 'wakeC') ? 'new' : ''}`}>{v ?? '·'}</span>
              ))}
            </div>
          </div>

          {/* 消费者 */}
          <div className={`bq-actor cons ${actor === 'C' && !done ? 'active' : ''} ${blockedC ? 'blocked' : ''}`}>
            <span className="bq-aname">消费者 C</span>
            <span className="bq-astate">{blockedC ? '⏳ 阻塞(等数据)' : op === 'take' || op === 'wakeP' ? `take → ${item}` : '就绪'}</span>
          </div>
        </div>

        {event && !done && <div className={`bq-event ${isBlockOp ? 'bad' : isWake ? 'ok' : ''}`}>{event}</div>}

        {done
          ? <p className="scnote">有界阻塞队列 = <b>锁 + 两个条件变量</b>（notFull / notEmpty）：满了 put 在 notFull 上等、空了 take 在 notEmpty 上等，对方操作后 signal 唤醒。天然<b>削峰</b>（生产快了堵在 put）、解耦。=Java ArrayBlockingQueue、Go 带缓冲 channel。面试讲：为什么要两个条件变量、为什么用 while 而不是 if 判满/空（防虚假唤醒）、无界队列的区别（不阻塞 put 但可能 OOM）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。队列容量有限：满了生产者 put 就挂起（等空位）、空了消费者 take 就挂起（等数据）；对方一操作、腾出空位/放入数据，就把挂起的那方唤醒。挂起是真让出 CPU，不是忙等。</p>}
      </div>
    </div>
  )
}
