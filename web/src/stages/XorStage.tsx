/** 舞台：异或加密 —— 明文位 / 密钥位 / 密文位 三行，逐位 XOR */
import type { XorState } from '@engine/kernels/xorcipher.ts'
import type { StageProps } from '../types.ts'

export function XorStage({ state }: StageProps<XorState>) {
  const { pos, mBit, kBit, cBit, mBits, kBits, cBits, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>异或加密 <span className="hint">明文 XOR 密钥 = 密文；再 XOR 一次就还原</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{pos >= 0 ? pos + 1 : 8}</span><span className="scdl">第几位</span></div>
          <div className="scdk"><span className="scdn">{cBits.join('') || '—'}</span><span className="scdl">密文</span></div>
          <div className="scdk"><span className="scdn">{done ? '自反' : `${mBit} ⊕ ${kBit}`}</span><span className="scdl">本位</span></div>
        </div>
        <div className="cx-rows">
          <div className="cx-row"><span className="cx-lbl">明文</span>{mBits.map((x, i) => <span key={i} className={`cx-cell ${i === pos ? 'cur' : ''}`}>{x}</span>)}</div>
          <div className="cx-row"><span className="cx-lbl">密钥</span>{kBits.map((x, i) => <span key={i} className={`cx-cell ${i === pos ? 'cur' : ''}`} style={{ opacity: .8 }}>{x}</span>)}</div>
          <div className="cx-row"><span className="cx-lbl">密文</span>{mBits.map((_, i) => <span key={i} className={`cx-cell ${i < cBits.length ? 'done' : ''} ${i === pos ? 'cur' : ''}`}>{cBits[i] ?? '·'}</span>)}</div>
        </div>
        {pos >= 0 && !done && <div className="cx-calc">明文 <b>{mBit}</b> XOR 密钥 <b>{kBit}</b> = <b className="cx-out">{cBit}</b>（相同得 0、不同得 1）</div>}
        {done
          ? <p className="scnote">密文 = 明文 XOR 密钥。异或<b>自反</b>：密文再 XOR 同一密钥就还原成明文——加解密同一套代码。流密码(ChaCha20)、一次一密都靠它。安全全押在密钥上：真随机 + 等长 + 只用一次(OTP) = 理论不可破；密钥一重复就漏底。</p>
          : <p className="scnote" style={{ opacity: .85 }}>逐位异或：相同得 0、不同得 1。密钥若真随机、和明文一样长、只用一次，就是不可破的一次一密。</p>}
      </div>
    </div>
  )
}
