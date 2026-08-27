/** 舞台：费马素性测试 —— 算 a^(n-1) mod n，≠1 则合数 */
import type { FermatState } from '@engine/kernels/fermat.ts'
import type { StageProps } from '../types.ts'

export function FermatStage({ state }: StageProps<FermatState>) {
  const { n, a, bitPos, bit, baseNow, result, verdict, phase } = state
  const done = phase === 'done'
  const composite = verdict === '合数'
  return (
    <div className="card">
      <h3>费马素性测试 <span className="hint">a^(n-1) mod n ≠ 1 → 一定是合数</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{a}^{n - 1} mod {n}</span><span className="scdl">要算</span></div>
          <div className="scdk"><span className="scdn">{result}</span><span className="scdl">当前结果</span></div>
          <div className="scdk"><span className={`scdn ${done ? (composite ? 'miss' : 'ok') : ''}`}>{verdict || '…'}</span><span className="scdl">判定</span></div>
        </div>
        <div className="cx-kv">
          <div className="cx-box"><span className="cx-bk">测试对象 n</span><span className="cx-bv">{n}</span></div>
          <div className="cx-box"><span className="cx-bk">底 a</span><span className="cx-bv">{a}</span></div>
          <div className={`cx-box ${bit === 1 ? 'hot' : ''}`}><span className="cx-bk">指数第几位</span><span className="cx-bv">{bitPos >= 0 ? `${bitPos}=${bit}` : '—'}</span></div>
          <div className={`cx-box ${done ? (composite ? '' : 'ok') : ''}`}><span className="cx-bk">a^(n-1) mod n</span><span className="cx-bv">{result}</span></div>
        </div>
        {done
          ? <p className="scnote">{a}^{n - 1} mod {n} = <b>{result}</b>。{composite ? <>≠1 → <b>{n} 一定是合数</b>！费马测试当场揪出——这就是 RSA 选素数时先用它快速筛掉合数。</> : <>=1 → <b>{n} 可能是素数</b>（概率判定，极少数卡迈克尔数会骗过，实用中用更强的米勒-拉宾）。</>}</p>
          : <p className="scnote" style={{ opacity: .85 }}>费马小定理：素数 p 有 a^(p-1)≡1 (mod p)。反过来当检测——算出的结果 ≠1 就铁证是合数；=1 只是"很可能素数"。这里用快速模幂算 a^(n-1)。</p>}
      </div>
    </div>
  )
}
