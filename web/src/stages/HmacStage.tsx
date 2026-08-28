/** 舞台：HMAC —— 两层嵌套哈希，密钥内外各揉一次；改一个字节标签就对不上 */
import type { HmacState } from '@engine/kernels/hmac.ts'
import type { StageProps } from '../types.ts'

const hex = (n: number) => n.toString(16).padStart(2, '0')
const Bytes = ({ a, tone }: { a: number[]; tone?: string }) => (
  <span className={`hm-bytes ${tone ?? ''}`}>{a.map((b, i) => <i key={i}>{hex(b)}</i>)}</span>
)

export function HmacStage({ state }: StageProps<HmacState>) {
  const { op, K, m, ki, ko, inner, mac, tamperM, tamperMac, phase } = state
  const done = phase === 'done'
  const hasInner = inner >= 0, hasMac = mac >= 0
  const step = (o: string) => op === o

  return (
    <div className="card">
      <h3>HMAC <span className="hint">密钥 + 嵌套哈希 = 防伪造又防篡改的消息标签</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'intro' ? '看目标' : op === 'ipad' ? 'K⊕ipad' : op === 'inner' ? '内层H' : op === 'opad' ? 'K⊕opad' : op === 'outer' ? '外层H' : '验证'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className={`scdn ${hasInner ? '' : ''}`}>{hasInner ? hex(inner) : '—'}</span><span className="scdl">内层 inner</span></div>
          <div className="scdk"><span className={`scdn ${hasMac ? 'ok' : ''}`}>{hasMac ? hex(mac) : '—'}</span><span className="scdl">HMAC 标签</span></div>
        </div>

        <div className="hm-pipe">
          {/* 内层 */}
          <div className={`hm-lane ${step('ipad') || step('inner') ? 'on' : ''}`}>
            <span className="hm-tag">内层</span>
            <span className="hm-term">K <em>密钥</em><Bytes a={K} /></span>
            <span className="hm-oplus">⊕</span>
            <span className="hm-term">ipad <em>0x36</em></span>
            <span className="hm-eq">=</span>
            <span className="hm-term"><Bytes a={ki.length ? ki : K.map(() => 0)} tone={ki.length ? 'x' : 'ghost'} /></span>
            <span className="hm-cat">‖ m <Bytes a={m} /></span>
            <span className="hm-arrow">→ H →</span>
            <span className={`hm-out ${hasInner ? 'lit' : ''}`}>{hasInner ? hex(inner) : '··'}</span>
          </div>
          {/* 外层 */}
          <div className={`hm-lane ${step('opad') || step('outer') ? 'on' : ''}`}>
            <span className="hm-tag">外层</span>
            <span className="hm-term">K <em>密钥</em><Bytes a={K} /></span>
            <span className="hm-oplus">⊕</span>
            <span className="hm-term">opad <em>0x5c</em></span>
            <span className="hm-eq">=</span>
            <span className="hm-term"><Bytes a={ko.length ? ko : K.map(() => 0)} tone={ko.length ? 'x' : 'ghost'} /></span>
            <span className="hm-cat">‖ inner <span className={`hm-mini ${hasInner ? 'lit' : ''}`}>{hasInner ? hex(inner) : '··'}</span></span>
            <span className="hm-arrow">→ H →</span>
            <span className={`hm-out big ${hasMac ? 'lit' : ''}`}>{hasMac ? hex(mac) : '··'}</span>
          </div>
        </div>

        {op === 'verify' && (
          <div className="hm-verify">
            <div className="hm-vrow"><span>攻击者改消息</span><Bytes a={m} /> <b>→</b> <Bytes a={tamperM} tone="bad" /><span className="hm-note">（没有密钥 K）</span></div>
            <div className="hm-vrow"><span>收方用 K 重算</span><span className="hm-mini bad lit">{hex(tamperMac)}</span> <b>≠</b> <span className="hm-mini lit">{hex(mac)}</span> <span className="hm-reject">✗ 被篡改，拒收</span></div>
          </div>
        )}

        {done
          ? <p className="scnote">HMAC = <b>密钥 + 嵌套哈希</b>：没有 K 就算不出正确标签（防伪造），改一个字节标签就对不上（防篡改）。两层嵌套（密钥内外各揉一次）堵住了 H(K‖m) 的<b>长度扩展攻击</b>。真实用 HMAC-SHA256——TLS、JWT、API 签名、微信支付回调验签全靠它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。看两条泳道：内层把 K⊕ipad 拼消息哈希出 inner，外层把 K⊕opad 拼 inner 再哈希出 HMAC。密钥在内外各揉一次，是它比 H(K‖m) 稳的关键。</p>}
      </div>
    </div>
  )
}
