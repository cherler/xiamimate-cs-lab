/** 舞台：数字签名 —— 私钥签名、公钥验证 */
import type { SignState } from '@engine/kernels/signature.ts'
import type { StageProps } from '../types.ts'

export function SignStage({ state }: StageProps<SignState>) {
  const { n, e, d, hash, sig, recvHash, verified, ok, stage, phase } = state
  const done = phase === 'done'
  const v = (x: number) => (x >= 0 ? x : '—')
  return (
    <div className="card">
      <h3>数字签名 <span className="hint">私钥签名、公钥验证，改一下就验不过</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">私钥 d={d}</span><span className="scdl">签名用</span></div>
          <div className="scdk"><span className="scdn">签名 {v(sig)}</span><span className="scdl">s=h^d mod n</span></div>
          <div className="scdk"><span className={`scdn ${done ? (ok ? 'ok' : 'miss') : ''}`}>{done ? (ok ? '通过 ✓' : '失败 ✕') : '…'}</span><span className="scdl">验证</span></div>
        </div>
        <div className="cx-kv">
          <div className="cx-box hot"><span className="cx-bk">发送方 · 消息哈希 h</span><span className="cx-bv">{hash}</span></div>
          <div className={`cx-box ${sig >= 0 ? 'ok' : ''}`}><span className="cx-bk">签名 s=h^d mod n</span><span className="cx-bv">{v(sig)}</span></div>
        </div>
        <div className="cx-kv">
          <div className="cx-box"><span className="cx-bk">接收方 · 重算哈希 h'</span><span className="cx-bv">{v(recvHash)}</span></div>
          <div className={`cx-box ${verified >= 0 ? (ok ? 'ok' : 'hot') : ''}`}><span className="cx-bk">验证 s^e mod n</span><span className="cx-bv">{v(verified)}</span></div>
        </div>
        {done
          ? <p className="scnote">s^e mod n = {verified} = h'，<b>验证通过</b>——证明消息没被改、且确实出自私钥持有者（别人没私钥签不出这个 s）。若消息被篡改，重算的 h' 会变，而验证算出的仍是原 h，两者对不上，当场露馅。加密是公钥加/私钥解，签名反过来：<b>私钥签、公钥验</b>。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{stage === 'hash' ? '先对消息算哈希，压成定长指纹。' : stage === 'sign' ? '用私钥对哈希签名，连消息一起发。' : stage === 'verify' ? '接收方对收到的消息重算哈希。' : '用公钥验证签名，比对两个哈希。'}</p>}
      </div>
    </div>
  )
}
