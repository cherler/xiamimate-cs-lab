/** 舞台：令牌桶限流 —— 桶里的令牌、每刻放行/拒绝 */
import type { TokenBucketState } from '@engine/kernels/tokenbucket.ts'
import type { StageProps } from '../types.ts'

export function TokenBucketStage({ state }: StageProps<TokenBucketState>) {
  const { cap, rate, tick, tokens, arrived, allowed, rejected, totalAllowed, totalRejected, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>令牌桶限流 <span className="hint">匀速放令牌，请求拿令牌才放行</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{tokens}/{cap}</span><span className="scdl">桶中令牌</span></div>
          <div className="scdk"><span className="scdn">{tick >= 0 ? `t=${tick}` : '完成'}</span><span className="scdl">时刻</span></div>
          <div className="scdk"><span className="scdn">{totalAllowed} / {totalRejected}</span><span className="scdl">累计 放行/拒绝</span></div>
        </div>
        {/* 桶：令牌格子 */}
        <div className="tb-bucket">
          <span className="cx-lbl">桶（速率 {rate}/tick）</span>
          <div className="tb-slots">
            {Array.from({ length: cap }, (_, k) => <span key={k} className={`tb-slot ${k < tokens ? 'on' : ''}`} />)}
          </div>
        </div>
        {tick >= 0 && !done && (
          <div className="cx-kv">
            <div className="cx-box"><span className="cx-bk">这刻到达</span><span className="cx-bv">{arrived}</span></div>
            <div className="cx-box ok"><span className="cx-bk">放行</span><span className="cx-bv">{allowed}</span></div>
            <div className={`cx-box ${rejected ? '' : ''}`} style={rejected ? { borderColor: 'var(--miss)' } : undefined}><span className="cx-bk">拒绝</span><span className="cx-bv">{rejected}</span></div>
          </div>
        )}
        {done
          ? <p className="scnote">共放行 {totalAllowed}、拒绝 {totalRejected}。开局桶是满的 → 突发 3 个一次放行（容量给的<b>突发额度</b>）；之后桶被抽干、只能按放令牌的速率（{rate}/tick）放行——<b>既限住平均速率、又容忍短时突发</b>，这就是令牌桶。漏桶则恒定速率、不容突发。</p>
          : <p className="scnote" style={{ opacity: .85 }}>每刻先匀速补令牌（满了溢出），再处理请求：有令牌就放行并消耗，没令牌就拒绝。桶容量 = 允许的突发量。</p>}
      </div>
    </div>
  )
}
