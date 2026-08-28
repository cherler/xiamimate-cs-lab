/** 舞台：TOTP —— 时间窗驱动的 6 位动态码，同窗不变、换窗即变 */
import type { TotpState } from '@engine/kernels/totp.ts'
import type { StageProps } from '../types.ts'

export function TotpStage({ state }: StageProps<TotpState>) {
  const { op, t, T, code, prevCode, history, phase } = state
  const done = phase === 'done'
  const changed = op === 'next' || (op === 'code' && !prevCode)
  const same = op === 'same'
  const hasCode = code !== ''

  return (
    <div className="card">
      <h3>TOTP 动态口令 <span className="hint">共享密钥 + 时间窗：手机和服务器离线算出同一个码</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{t}s</span><span className="scdl">当前时间</span></div>
          <div className="scdk"><span className="scdn">T = {T}</span><span className="scdl">时间窗 ⌊t/30⌋</span></div>
          <div className="scdk"><span className={`scdn ${changed ? 'ok' : same ? '' : ''}`}>{hasCode ? code : '——'}</span><span className="scdl">6 位码</span></div>
        </div>

        {/* 管线：时间 → 窗口 → HMAC → 截断 → 码 */}
        <div className="tp-pipe">
          <span className="tp-node">🕐 {t}s<em>当前时间</em></span>
          <span className="tp-op">⌊÷30⌋</span>
          <span className="tp-node">T = {T}<em>时间窗</em></span>
          <span className="tp-op">HMAC(K,T)</span>
          <span className="tp-node">哈希<em>密钥揉时间</em></span>
          <span className="tp-op">截断取6位</span>
          <span className={`tp-code ${hasCode ? 'lit' : ''} ${changed ? 'flip' : ''} ${same ? 'hold' : ''}`}>{hasCode ? code : '· · · · · ·'}</span>
        </div>

        {(changed || same) && !done && (
          <div className={`tp-flag ${same ? 'hold' : 'flip'}`}>
            {same ? `⏸ 还在窗口 ${T}，码不变（30 秒有效期）` : `🔄 跳到窗口 ${T}，旧码 ${prevCode || '—'} 作废，换新码 ${code}`}
          </div>
        )}

        {/* 码历史：窗口 → 码 */}
        {history.length > 0 && (
          <div className="tp-hist">
            <span className="tp-hcap">窗口 → 码</span>
            {history.map(h => (
              <span key={h.T} className={`tp-hitem ${h.T === T ? 'cur' : ''}`}>T{h.T}<b>{h.code}</b></span>
            ))}
          </div>
        )}

        {done
          ? <p className="scnote">服务器用**同一个 K + 它自己的当前时间**算 T={T} 的码，一致就放行——<b>全程没传密钥、没联网对表</b>。为容忍时钟差，服务器一般同时校验 T−1/T/T+1 三个窗口。<b>共享密钥 + 时间窗 + HMAC</b> = 双方离线算出同一串一次性码，这就是 TOTP(RFC 6238)。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。码 = 截断( HMAC(密钥, ⌊时间/30⌋) )。同一个 30 秒窗口里 T 不变 → 码不变；跨窗口 T+1 → 哈希全变 → 新码。手机和服务器各自算、不用通信。</p>}
      </div>
    </div>
  )
}
