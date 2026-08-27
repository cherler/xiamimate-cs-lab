/** 舞台：Diffie-Hellman —— 公开 p/g，Alice/Bob 各算各的，得到同一共享密钥 */
import type { DHState } from '@engine/kernels/diffiehellman.ts'
import type { StageProps } from '../types.ts'

export function DHStage({ state }: StageProps<DHState>) {
  const { p, g, a, b, A, B, aliceShared, bobShared, phase } = state
  const done = phase === 'done'
  const v = (x: number) => (x >= 0 ? x : '—')
  const same = done && aliceShared === bobShared
  return (
    <div className="card">
      <h3>Diffie-Hellman 密钥交换 <span className="hint">公开信道上商量出只有你俩知道的密钥</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">p={p} g={g}</span><span className="scdl">公开参数</span></div>
          <div className="scdk"><span className="scdn">{v(A)} / {v(B)}</span><span className="scdl">公钥 A/B</span></div>
          <div className="scdk"><span className={`scdn ${same ? 'ok' : ''}`}>{v(aliceShared)}</span><span className="scdl">共享密钥</span></div>
        </div>
        <div className="cx-kv">
          <div className="cx-box hot"><span className="cx-bk">Alice 私钥 a</span><span className="cx-bv">{a}</span></div>
          <div className="cx-box"><span className="cx-bk">A=g^a mod p(公开)</span><span className="cx-bv">{v(A)}</span></div>
          <div className={`cx-box ${aliceShared >= 0 ? 'ok' : ''}`}><span className="cx-bk">Alice 算 B^a</span><span className="cx-bv">{v(aliceShared)}</span></div>
        </div>
        <div className="cx-kv">
          <div className="cx-box hot"><span className="cx-bk">Bob 私钥 b</span><span className="cx-bv">{b}</span></div>
          <div className="cx-box"><span className="cx-bk">B=g^b mod p(公开)</span><span className="cx-bv">{v(B)}</span></div>
          <div className={`cx-box ${bobShared >= 0 ? 'ok' : ''}`}><span className="cx-bk">Bob 算 A^b</span><span className="cx-bv">{v(bobShared)}</span></div>
        </div>
        {done
          ? <p className="scnote">双方都得到共享密钥 <b>{aliceShared}</b> = g^(ab) mod p，全程没在信道上传过它。偷听者只见 p、g、A、B，想反推私钥要解<b>离散对数</b>（g^a=A 求 a）——大数下算不动。这就是无需事先见面就能建密钥的魔法，TLS 握手就用它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>各自私钥保密、公钥公开；用「对方公钥 ^ 自己私钥 mod p」算共享——都等于 g^(ab) mod p，所以一致。</p>}
      </div>
    </div>
  )
}
