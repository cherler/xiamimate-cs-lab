/** 舞台：扩展欧几里得求模逆 —— 迭代 (q,r,t)，末位系数取模即逆元 */
import type { ExtGcdState } from '@engine/kernels/extgcd.ts'
import type { StageProps } from '../types.ts'

export function ExtGcdStage({ state }: StageProps<ExtGcdState>) {
  const { e, m, q, r, newr, t, newt, result, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>扩展欧几里得 · 求模逆 <span className="hint">求 d 使 e·d ≡ 1 (mod m)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{e}⁻¹ mod {m}</span><span className="scdl">要求的逆元</span></div>
          <div className="scdk"><span className="scdn">{q >= 0 ? q : '—'}</span><span className="scdl">本步商 q</span></div>
          <div className="scdk"><span className={`scdn ${result >= 0 ? 'ok' : ''}`}>{result >= 0 ? result : '?'}</span><span className="scdl">逆元 d</span></div>
        </div>
        <div className="cx-kv">
          <div className="cx-box"><span className="cx-bk">余数 r / new</span><span className="cx-bv small">{r} / {newr}</span></div>
          <div className="cx-box hot"><span className="cx-bk">商 q</span><span className="cx-bv">{q >= 0 ? q : '—'}</span></div>
          <div className="cx-box"><span className="cx-bk">系数 t / new</span><span className="cx-bv small">{t} / {newt}</span></div>
          <div className={`cx-box ${result >= 0 ? 'ok' : ''}`}><span className="cx-bk">逆元 d</span><span className="cx-bv">{result >= 0 ? result : '?'}</span></div>
        </div>
        {done
          ? <p className="scnote">gcd({e},{m})=1（互质，可逆），系数取模 {m} → 逆元 <b>d={result}</b>，验证 {e}×{result}={e * result}≡1 (mod {m})。这正是 <b>RSA 求私钥 d</b> 的那一步——一切「模运算里的除法」都靠它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>一边辗转相除求 gcd，一边回带系数 t。每步：q=⌊r/newr⌋，同步更新余数和系数。最后 gcd=1 时，系数 t 取模 m 就是逆元。</p>}
      </div>
    </div>
  )
}
