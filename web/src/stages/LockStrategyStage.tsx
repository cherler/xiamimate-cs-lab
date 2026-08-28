/** 舞台：乐观锁 vs 悲观锁 —— 共享行 + 两事务，看版本重试 vs 加锁阻塞 */
import type { LockState } from '@engine/kernels/lockstrategy.ts'
import type { StageProps } from '../types.ts'

const ACTNAME: Record<string, string> = { intro: '引入', lost: '① 无保护', optimistic: '② 乐观锁', pessimistic: '③ 悲观锁', summary: '对比' }

export function LockStrategyStage({ state }: StageProps<LockState>) {
  const { act, stock, version, lockedBy, t1, t2, event, outcome, phase } = state
  const done = phase === 'done'
  const showVer = act === 'optimistic' || act === 'summary'

  return (
    <div className="card">
      <h3>乐观锁 vs 悲观锁 <span className="hint">并发改一行：版本重试 还是 加锁阻塞</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{ACTNAME[act]}</span><span className="scdl">当前</span></div>
          <div className="scdk"><span className={`scdn ${outcome === 'ok' ? 'ok' : outcome === 'fail' ? 'miss' : ''}`}>{outcome === 'ok' ? '成功' : outcome === 'fail' ? '失败/丢失' : outcome === 'block' ? '阻塞等待' : outcome === 'retry' ? '重试成功' : '—'}</span><span className="scdl">结果</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'ok' : ''}`}>stock {stock}</span><span className="scdl">库存{showVer ? ` · v${version}` : ''}</span></div>
        </div>

        {!done && (
          <>
            {/* 共享行 */}
            <div className={`lk-row ${lockedBy ? 'locked' : ''}`}>
              <span className="lk-rlbl">数据库行</span>
              <span className="lk-field">stock = <b>{stock}</b></span>
              {showVer && <span className="lk-field ver">version = <b>{version}</b></span>}
              {lockedBy && <span className="lk-lock">🔒 被 {lockedBy} 锁定</span>}
            </div>

            {/* 两事务 */}
            <div className="lk-txns">
              <div className={`lk-txn ${t1 ? 'active' : ''}`}>
                <span className="lk-tname">事务 T1</span>
                <span className="lk-taction">{t1 || '—'}</span>
              </div>
              <div className={`lk-txn ${t2 ? 'active' : ''} ${outcome === 'fail' && act === 'optimistic' ? 'fail' : outcome === 'block' ? 'block' : ''}`}>
                <span className="lk-tname">事务 T2</span>
                <span className="lk-taction">{t2 || '—'}</span>
              </div>
            </div>

            {event && <div className={`lk-event ${outcome === 'ok' || outcome === 'retry' ? 'ok' : outcome === 'fail' ? 'bad' : outcome === 'block' ? 'warn' : ''}`}>{event}</div>}
          </>
        )}

        {done && (
          <div className="lk-compare">
            <div className="lk-col opt">
              <div className="lk-ch">乐观锁</div>
              <div className="lk-cp">假设冲突少 → <b>不加锁</b></div>
              <div className="lk-cp">更新校验版本，<b>冲突才重试</b></div>
              <div className="lk-cp good">并发高、无锁开销</div>
              <div className="lk-cp bad">冲突多时反复重试更差</div>
              <div className="lk-cp use">读多写少 / 冲突罕见（点赞、MVCC）</div>
            </div>
            <div className="lk-col pes">
              <div className="lk-ch">悲观锁</div>
              <div className="lk-cp">假设冲突多 → <b>先加锁</b></div>
              <div className="lk-cp">别人<b>阻塞等待</b>、天然串行</div>
              <div className="lk-cp good">稳、不重试、一次成功</div>
              <div className="lk-cp bad">并发低、锁竞争、可能死锁</div>
              <div className="lk-cp use">写多 / 冲突频繁（扣钱、抢票核心）</div>
            </div>
          </div>
        )}

        {done
          ? <p className="scnote">两种都防更新丢失、结果都是 8，但世界观相反：<b>乐观锁</b>（版本号/CAS）赌冲突少、不加锁、失败重试；<b>悲观锁</b>（FOR UPDATE/行锁）赌冲突多、先加锁、串行。面试讲：乐观锁怎么实现（版本号列/CAS）、<b>ABA 问题</b>、悲观锁的死锁风险、各自适用场景。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。无保护时两个事务都读到 10、都写 9，一次扣减被覆盖丢了。乐观锁靠版本号发现"我读之后有人改过"→失败重试；悲观锁靠先加锁让别人根本进不来→排队。</p>}
      </div>
    </div>
  )
}
