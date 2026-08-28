/** 舞台：生日攻击 —— 碰撞概率随人数飙升的量表，过半线钉在 50% */
import type { BirthdayState } from '@engine/kernels/birthday.ts'
import type { StageProps } from '../types.ts'

const pct = (p: number) => (p * 100).toFixed(1)

export function BirthdayStage({ state }: StageProps<BirthdayState>) {
  const { N, k, pairs, pColl, crossed50, note, phase, focus } = state
  const done = phase === 'done'
  const w = Math.max(0, Math.min(100, pColl * 100))
  const MILES = [{ k: 23, p: '50%' }, { k: 41, p: '90%' }, { k: 57, p: '99%' }]
  const HASH = [{ n: 64, cost: '2³²', tag: '几十亿·分分钟破', bad: true }, { n: 128, cost: '2⁶⁴', tag: '偏弱', bad: false }, { n: 256, cost: '2¹²⁸', tag: '安全', bad: false }]

  return (
    <div className="card">
      <h3>生日攻击 <span className="hint">找一对碰撞只要约 √N 次，不是 N 次</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{k} 人</span><span className="scdl">屋里人数</span></div>
          <div className="scdk"><span className="scdn">{pairs} 对</span><span className="scdl">能相撞的对 C(k,2)</span></div>
          <div className="scdk"><span className={`scdn ${crossed50 ? 'ok' : ''}`}>{pct(pColl)}%</span><span className="scdl">至少一对同天</span></div>
        </div>

        <div className="bd-gauge">
          <div className="bd-track">
            <div className={`bd-fill ${crossed50 ? 'hot' : ''}`} style={{ width: `${w}%` }} />
            <div className="bd-mark" style={{ left: '50%' }}><span>50%</span></div>
          </div>
          <div className="bd-pnum"><b>{pct(pColl)}</b><i>% 碰撞概率</i><small>N = {N} 天</small></div>
        </div>

        <div className="bd-miles">
          {MILES.map(m => (
            <div key={m.k} className={`bd-mile ${k >= m.k ? 'hit' : ''}`}>
              <span className="bd-mk">{m.k} 人</span><span className="bd-mp">→ {m.p}</span>
            </div>
          ))}
        </div>

        {note && !done && <div className="bd-note">🎯 {note}</div>}

        {done && (
          <div className="bd-hash">
            <div className="bd-hcap">映射到哈希：n 位输出空间 2ⁿ，找碰撞只要约 <b>2^(n/2)</b> 次</div>
            <div className="bd-hrows">
              {HASH.map(h => (
                <div key={h.n} className={`bd-hrow ${h.bad ? 'bad' : h.n === 256 ? 'good' : ''}`}>
                  <span className="bd-hn">{h.n} 位</span>
                  <span className="bd-harrow">碰撞约</span>
                  <span className="bd-hcost">{h.cost} 次</span>
                  <span className="bd-htag">{h.tag}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {done
          ? <p className="scnote"><b>抗碰撞要的位数是抗原像的两倍</b>：因为比的是"任意一对"(对数 ≈ k²/2)，碰撞在约 √N 处就出现。MD5(128位)、SHA-1(160位) 已被攻破，现在用 SHA-256。数字签名、区块链、去重都靠哈希抗碰撞——这条线直接决定选多少位。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。逐个加人：能相撞的"对"按 k² 涨，所以概率飙得比直觉快得多。看它在第几个人处越过 50% 那条线。</p>}
      </div>
    </div>
  )
}
