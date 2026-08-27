/** 舞台：盐与密码哈希 —— 同一密码，不加盐哈希相同、加盐不同 */
import type { SaltState } from '@engine/kernels/salt.ts'
import type { StageProps } from '../types.ts'

export function SaltStage({ state }: StageProps<SaltState>) {
  const { pw, saltA, saltB, noSaltA, noSaltB, saltedA, saltedB, stage, phase } = state
  const done = phase === 'done'
  const v = (x: number) => (x >= 0 ? x : '—')
  const noSaltSame = noSaltA >= 0 && noSaltA === noSaltB
  const saltedDiff = saltedA >= 0 && saltedA !== saltedB
  return (
    <div className="card">
      <h3>盐与密码哈希 <span className="hint">同一密码，加盐后哈希各不相同</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">"{pw}"</span><span className="scdl">两人同一密码</span></div>
          <div className="scdk"><span className={`scdn ${noSaltSame ? 'miss' : ''}`}>{noSaltSame ? '相同' : '—'}</span><span className="scdl">不加盐</span></div>
          <div className="scdk"><span className={`scdn ${saltedDiff ? 'ok' : ''}`}>{saltedDiff ? '不同' : '—'}</span><span className="scdl">加盐</span></div>
        </div>
        <div className="cx-kv">
          <div className={`cx-box ${noSaltSame ? '' : ''}`} style={noSaltSame ? { borderColor: 'var(--miss)' } : undefined}><span className="cx-bk">Alice · hash(密码)</span><span className="cx-bv">{v(noSaltA)}</span></div>
          <div className="cx-box" style={noSaltSame ? { borderColor: 'var(--miss)' } : undefined}><span className="cx-bk">Bob · hash(密码)</span><span className="cx-bv">{v(noSaltB)}</span></div>
        </div>
        <div className="cx-kv">
          <div className={`cx-box ${saltedA >= 0 ? 'ok' : ''}`}><span className="cx-bk">Alice · hash(盐{saltA}+密码)</span><span className="cx-bv">{v(saltedA)}</span></div>
          <div className={`cx-box ${saltedB >= 0 ? 'ok' : ''}`}><span className="cx-bk">Bob · hash(盐{saltB}+密码)</span><span className="cx-bv">{v(saltedB)}</span></div>
        </div>
        {done
          ? <p className="scnote">同一个密码：不加盐两人哈希都是 {noSaltA}（<b>相同</b>，彩虹表可批量破、还暴露谁和谁密码一样）；加盐后 {saltedA} ≠ {saltedB}（<b>不同</b>，彩虹表失效，必须对每个盐单独暴力）。盐不用保密，随哈希一起存，作用是<b>打散</b>。真实系统再叠 bcrypt/argon2 故意放慢哈希。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{stage === 'pw' ? '两个用户恰好用了同一个常见密码。' : stage === 'nosalt' ? '不加盐直接存 hash(密码)——两人一模一样。' : '每人配随机盐，存 hash(盐+密码)——哈希被打散了。'}</p>}
      </div>
    </div>
  )
}
