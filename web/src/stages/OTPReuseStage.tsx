/** 舞台：一次一密密钥重用 —— 两段密文异或，密钥消失，泄露 m1⊕m2 */
import type { OTPReuseState } from '@engine/kernels/otpreuse.ts'
import type { StageProps } from '../types.ts'

export function OTPReuseStage({ state }: StageProps<OTPReuseState>) {
  const { m1, m2, k, c1, c2, pos, m1xm2, phase } = state
  const done = phase === 'done'
  const row = (lbl: string, bits: number[], hl: boolean) => (
    <div className="cx-row"><span className="cx-lbl">{lbl}</span>{bits.map((x, i) => <span key={i} className={`cx-cell ${i === pos && hl ? 'cur' : ''}`}>{x}</span>)}</div>
  )
  return (
    <div className="card">
      <h3>一次一密的密钥重用 <span className="hint">同一密钥加密两条消息 = 送人头</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">同一个 k</span><span className="scdl">两条消息共用</span></div>
          <div className="scdk"><span className="scdn">{pos >= 0 ? pos + 1 : 8}</span><span className="scdl">第几位</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'miss' : ''}`}>{m1xm2.join('') || '—'}</span><span className="scdl">泄露的 m1⊕m2</span></div>
        </div>
        <div className="cx-rows">
          {row('密文1', c1, true)}
          {row('密文2', c2, true)}
          <div className="cx-row"><span className="cx-lbl">C1⊕C2</span>{c1.map((_, i) => <span key={i} className={`cx-cell ${i < m1xm2.length ? 'flip' : ''} ${i === pos ? 'cur' : ''}`}>{m1xm2[i] ?? '·'}</span>)}</div>
        </div>
        <p className="cx-calc" style={{ fontSize: 11 }}>暗中：明文1={m1.join('')}、明文2={m2.join('')}、密钥={k.join('')}（攻击者看不到）。但 C1⊕C2 = (m1⊕k)⊕(m2⊕k) = m1⊕m2，<b className="cx-out">k 被抵消</b>。</p>
        {done
          ? <p className="scnote">把两段密文异或得到 <b>{m1xm2.join('')} = m1⊕m2</b>，<b>密钥完全消失</b>。攻击者不需要密钥就拿到了两条明文的异或关系；若知道其中一条，另一条直接还原。这就是「OTP 密钥绝不能重复用」——重复一次，安全性从"不可破"跌到"送人头"（WEP、某些 RC4 就这么被打穿）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>c1=m1⊕k、c2=m2⊕k。逐位异或两段密文：k⊕k=0 被抵消，剩下的正是 m1⊕m2——密钥没了，明文关系露出来了。</p>}
      </div>
    </div>
  )
}
