/** 舞台：熔断器 —— 三态机 Closed/Open/Half-Open，失败累计触发跳闸、超时试探恢复 */
import type { BreakerState } from '@engine/kernels/circuitbreaker.ts'
import type { StageProps } from '../types.ts'

const STATES: { k: 'closed' | 'open' | 'halfopen'; name: string; sub: string; tone: string }[] = [
  { k: 'closed', name: 'Closed', sub: '正常放行·累计失败', tone: 'good' },
  { k: 'open', name: 'Open', sub: '快速失败·不打下游', tone: 'bad' },
  { k: 'halfopen', name: 'Half-Open', sub: '放探测·试恢复', tone: 'warn' },
]

export function BreakerStage({ state }: StageProps<BreakerState>) {
  const { op, cstate, fails, threshold, outcome, phase } = state
  const done = phase === 'done'
  const pctFail = Math.min(100, (fails / threshold) * 100)
  const outTone = outcome.includes('成功') || outcome.includes('恢复') ? 'ok' : outcome.includes('失败') || outcome.includes('熔断') ? 'miss' : ''

  return (
    <div className="card">
      <h3>熔断器状态机 <span className="hint">下游故障就快速失败，给它恢复的机会（防级联雪崩）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={`scdn ${cstate === 'closed' ? 'ok' : cstate === 'open' ? 'miss' : 'hot'}`}>{STATES.find(s => s.k === cstate)?.name}</span><span className="scdl">当前状态</span></div>
          <div className="scdk"><span className="scdn">{fails}/{threshold}</span><span className="scdl">失败计数/阈值</span></div>
          <div className="scdk"><span className={`scdn ${outTone}`}>{outcome || '—'}</span><span className="scdl">本步结果</span></div>
        </div>

        <div className="cb-states">
          {STATES.map((s, i) => (
            <div key={s.k} className="cb-wrap">
              <div className={`cb-state ${s.tone} ${cstate === s.k ? 'on' : ''}`}>
                <span className="cb-sname">{s.name}</span>
                <span className="cb-ssub">{s.sub}</span>
              </div>
              {i < STATES.length - 1 && <span className="cb-arrow">{i === 0 ? '失败≥阈值 →' : '超时 →'}</span>}
            </div>
          ))}
          <span className="cb-back">↺ 探测成功回 Closed / 失败退回 Open</span>
        </div>

        {/* 失败计数条（Closed 时有意义） */}
        {cstate === 'closed' && !done && (
          <div className="cb-meter">
            <span className="cb-mlabel">失败累计</span>
            <div className="cb-track"><div className={`cb-fill ${fails >= threshold ? 'trip' : ''}`} style={{ width: `${pctFail}%` }} /></div>
            <span className="cb-mval">{fails} / {threshold}{fails >= threshold ? ' → 跳闸' : ''}</span>
          </div>
        )}

        <div className={`cb-event ${op}`}>
          {op === 'trip' && <span className="cb-alert">⚡ 跳闸！Closed → Open，从此快速失败、不打下游</span>}
          {op === 'reject' && <span className="cb-alert warn">⛔ Open 中：请求 fail-fast，未调用下游</span>}
          {op === 'timeout' && <span className="cb-alert warn">⏱ 超时到：Open → Half-Open，放探测请求</span>}
          {op === 'probe' && <span className="cb-alert ok">🔎 探测成功：下游看起来恢复了</span>}
          {op === 'probeFail' && <span className="cb-alert">🔁 探测失败：Half-Open → 退回 Open，再等一个超时</span>}
          {op === 'recover' && <span className="cb-alert ok">✅ Half-Open → Closed，失败计数清零，恢复正常</span>}
          {(op === 'pass' || op === 'fail') && <span className="cb-alert">{outcome === '成功' ? '✓ 请求成功' : `✗ 请求失败（计数 ${fails}/${threshold}）`}</span>}
        </div>

        {done
          ? <p className="scnote">熔断器用三态机把"故障隔离 + 自动恢复"做成自动的：<b>Closed</b> 累计失败、<b>Open</b> 快速失败保护下游、<b>Half-Open</b> 小流量试探。探测成功回 Closed、失败退回 Open。配合超时和降级(fallback)，是微服务容错标配（Hystrix / Resilience4j / Sentinel）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯状态怎么随请求成败流转：Closed 里失败攒够阈值就跳 Open；Open 里所有请求快速失败、不打下游；超时后进 Half-Open 放探测，成功就回 Closed。</p>}
      </div>
    </div>
  )
}
