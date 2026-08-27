/** 舞台：快速模幂 —— a^b mod n，逐位平方-乘 */
import type { ModPowState } from '@engine/kernels/modpow.ts'
import type { StageProps } from '../types.ts'

export function ModPowStage({ state }: StageProps<ModPowState>) {
  const { a, b, n, bitPos, bit, baseNow, result, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>快速模幂 <span className="hint">a^b mod n：逐位平方、遇 1 就乘进结果</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{a}^{b} mod {n}</span><span className="scdl">要算</span></div>
          <div className="scdk"><span className="scdn">{done ? result : result}</span><span className="scdl">当前结果</span></div>
          <div className="scdk"><span className="scdn">{b.toString(2)}</span><span className="scdl">指数二进制</span></div>
        </div>
        <div className="cx-kv">
          <div className="cx-box"><span className="cx-bk">指数第几位</span><span className="cx-bv">{bitPos >= 0 ? bitPos : '—'}</span></div>
          <div className={`cx-box ${bit === 1 ? 'hot' : ''}`}><span className="cx-bk">这一位</span><span className="cx-bv">{bit >= 0 ? bit : '—'}</span></div>
          <div className="cx-box"><span className="cx-bk">当前底数 mod n</span><span className="cx-bv">{baseNow}</span></div>
          <div className="cx-box ok"><span className="cx-bk">结果 mod n</span><span className="cx-bv">{result}</span></div>
        </div>
        {done
          ? <p className="scnote">{a}^{b} mod {n} = <b>{result}</b>。指数 {b}=1101₂，所以只需 3^1·3^4·3^8 mod 7——把指数拆成二进制，底数逐步平方、遇 1 就乘进结果，全程对 n 取模。O(log b) 次乘法。RSA、DH 上千位的幂全靠它才跑得动。</p>
          : <p className="scnote" style={{ opacity: .85 }}>从低位到高位：底数每步平方（3→3²→3⁴→3⁸…），指数这一位是 1 就把当前底数乘进结果，始终对 {n} 取模。</p>}
      </div>
    </div>
  )
}
