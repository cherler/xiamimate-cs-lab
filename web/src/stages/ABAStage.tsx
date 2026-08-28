/** 舞台：ABA 问题 —— 无版本 CAS 被 A→B→A 骗，加版本号识破 */
import type { ABAState } from '@engine/kernels/aba.ts'
import type { StageProps } from '../types.ts'

export function ABAStage({ state }: StageProps<ABAState>) {
  const { act, op, value, version, t1Read, t1Ver, casOk, event, phase } = state
  const done = phase === 'done'
  const versioned = act === 'fixed'
  const isCas = op === 'cas'

  return (
    <div className="card">
      <h3>ABA 问题 <span className="hint">CAS 只比值，会被"绕一圈回来"骗；版本号识破</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{act === 'intro' ? 'CAS' : versioned ? '② 加版本号' : '① 无版本'}</span><span className="scdl">当前演示</span></div>
          <div className="scdk"><span className="scdn">{value}{versioned ? ` /v${version}` : ''}</span><span className="scdl">共享值{versioned ? '(值,版本)' : ''}</span></div>
          <div className="scdk"><span className={`scdn ${casOk === true ? 'miss' : casOk === false ? 'ok' : ''}`}>{casOk === null ? '—' : casOk ? '误判成功✗' : '正确失败✓'}</span><span className="scdl">CAS 结果</span></div>
        </div>

        <div className="ab-lane">
          {/* 共享值 */}
          <div className={`ab-cell ${op === 'change' ? 'chg' : ''}`}>
            <span className="ab-clbl">共享值</span>
            <span className="ab-cval">{value === 100 ? 'A' : value === 200 ? 'B' : value}<i>={value}</i></span>
            {versioned && <span className="ab-ver">v{version}</span>}
          </div>
          <span className="ab-arrow">{isCas ? '⟵ CAS 比对' : ''}</span>
          {/* T1 记忆 */}
          <div className="ab-cell t1">
            <span className="ab-clbl">T1 读到(记忆)</span>
            <span className="ab-cval">{t1Read < 0 ? '?' : t1Read === 100 ? 'A' : t1Read}<i>{t1Read < 0 ? '' : `=${t1Read}`}</i></span>
            {versioned && t1Ver > 0 && <span className="ab-ver mem">v{t1Ver}</span>}
          </div>
        </div>

        {event && !done && <div className={`ab-event ${casOk === true ? 'bad' : casOk === false ? 'ok' : ''}`}>{event}</div>}

        {isCas && (
          <div className={`ab-verdict ${casOk ? 'bad' : 'ok'}`}>
            {versioned
              ? <>期望 <b>(A, v{t1Ver})</b>　当前 <b>(A, v{version})</b> → 值同但<b>版本不符</b> → <b>CAS 失败 ✓</b>（识破了 ABA）</>
              : <>期望 <b>A(={t1Read})</b>　当前 <b>A(={value})</b> → 只比值、<b>相等</b> → <b>CAS 成功 ✗</b>（其实中间变过两次，被骗了）</>}
          </div>
        )}

        {done
          ? <p className="scnote"><b>CAS 只比值会被 ABA 骗</b>：值 A→B→A 绕回来，CAS 以为没人动过。<b>加一个单调递增的版本号(stamp)</b>、比 (值,版本) 一对，即使值绕回、版本也回不去 → 识破。这就是 Java 的 <b>AtomicStampedReference</b>、无锁数据结构里的 tagged pointer。代价：多存版本号、CAS 变双字比较。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯共享值和 T1 的记忆：无版本时，值绕一圈回到 A，T1 的 CAS 就以为"没人动过"而误判成功；加了版本号，值虽同但版本变了，CAS 就能正确失败。</p>}
      </div>
    </div>
  )
}
