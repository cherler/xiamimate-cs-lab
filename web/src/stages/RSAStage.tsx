/** 舞台：RSA —— 生成密钥 → 公钥加密 → 私钥解密 */
import type { RSAState } from '@engine/kernels/rsa.ts'
import type { StageProps } from '../types.ts'

export function RSAStage({ state }: StageProps<RSAState>) {
  const { p, q, n, phi, e, d, m, c, dec, stage, phase } = state
  const done = phase === 'done'
  const v = (x: number) => (x >= 0 ? x : '—')
  const keyReady = stage !== 'keygen'
  const privReady = stage === 'priv' || stage === 'encrypt' || stage === 'decrypt' || done
  return (
    <div className="card">
      <h3>RSA 公钥加密 <span className="hint">公钥加密、私钥解密；安全靠大数分解难</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">n={n}</span><span className="scdl">模数(公开)</span></div>
          <div className="scdk"><span className="scdn">公钥 (e={e},n={n})</span><span className="scdl">谁都能用</span></div>
          <div className="scdk"><span className="scdn">私钥 d={privReady ? d : '?'}</span><span className="scdl">自己藏好</span></div>
        </div>
        <div className="cx-kv">
          <div className="cx-box"><span className="cx-bk">素数 p,q</span><span className="cx-bv small">{p}, {q}</span></div>
          <div className="cx-box hot"><span className="cx-bk">n = p·q</span><span className="cx-bv">{n}</span></div>
          <div className="cx-box"><span className="cx-bk">φ=(p-1)(q-1)</span><span className="cx-bv">{phi}</span></div>
          <div className="cx-box"><span className="cx-bk">公钥 e</span><span className="cx-bv">{e}</span></div>
          <div className={`cx-box ${privReady ? 'ok' : ''}`}><span className="cx-bk">私钥 d(e·d≡1)</span><span className="cx-bv">{privReady ? d : '?'}</span></div>
        </div>
        <div className="cx-kv">
          <div className="cx-box"><span className="cx-bk">明文 m</span><span className="cx-bv">{m}</span></div>
          <div className={`cx-box ${c >= 0 ? 'hot' : ''}`}><span className="cx-bk">密文 c=m^e mod n</span><span className="cx-bv">{v(c)}</span></div>
          <div className={`cx-box ${dec >= 0 ? 'ok' : ''}`}><span className="cx-bk">解密 c^d mod n</span><span className="cx-bv">{v(dec)}</span></div>
        </div>
        {done
          ? <p className="scnote">公钥加密（{m}→{c}）、私钥解密（{c}→<b>{dec}</b>，还原成 {m}）。公开的 n={n} 谁都看得见，但想从 n 反推 p、q 才能算出私钥 d——这是<b>大数分解</b>，几百位就算不动了。加密的人无需知道私钥，这就是「公钥」的意义。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{!keyReady ? '先选两个素数生成公私钥。' : stage === 'pub' ? '公钥 (e,n) 发给全世界。' : stage === 'priv' ? '私钥 d 满足 e·d≡1 (mod φ)，自己藏好。' : stage === 'encrypt' ? '别人用公钥把明文加密成密文。' : '你用私钥把密文解回明文。'}</p>}
      </div>
    </div>
  )
}
