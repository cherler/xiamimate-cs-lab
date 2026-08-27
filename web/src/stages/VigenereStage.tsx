/** 舞台：维吉尼亚密码 —— 明文 / 关键词(循环) / 密文 三行对照 */
import type { VigenereState } from '@engine/kernels/vigenere.ts'
import type { StageProps } from '../types.ts'

export function VigenereStage({ state }: StageProps<VigenereState>) {
  const { plain, keyword, pos, chCode, keyCode, shifted, out, cipher, phase } = state
  const done = phase === 'done'
  const keyAt = (i: number) => keyword[i % keyword.length]
  return (
    <div className="card">
      <h3>维吉尼亚密码 <span className="hint">关键词循环给出每一位的位移</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{keyword}</span><span className="scdl">关键词</span></div>
          <div className="scdk"><span className="scdn">{pos >= 0 ? pos + 1 : plain.length}</span><span className="scdl">第几位</span></div>
          <div className="scdk"><span className="scdn">{cipher || '—'}</span><span className="scdl">密文</span></div>
        </div>
        <div className="cx-rows">
          <div className="cx-row"><span className="cx-lbl">明文</span>{plain.split('').map((c, i) => <span key={i} className={`cx-cell ${i === pos ? 'cur' : ''}`}>{c}</span>)}</div>
          <div className="cx-row"><span className="cx-lbl">密钥</span>{plain.split('').map((_, i) => <span key={i} className={`cx-cell ${i === pos ? 'cur' : ''}`} style={{ opacity: .8 }}>{keyAt(i)}</span>)}</div>
          <div className="cx-row"><span className="cx-lbl">密文</span>{plain.split('').map((_, i) => <span key={i} className={`cx-cell ${i < cipher.length ? 'done' : ''} ${i === pos ? 'cur' : ''}`}>{cipher[i] ?? '·'}</span>)}</div>
        </div>
        {pos >= 0 && !done && <div className="cx-calc">明文 <b>{chCode}</b> + 密钥 <b>{keyCode}</b> = {chCode + keyCode} → mod 26 = <b>{shifted}</b> → <b className="cx-out">{out}</b></div>}
        {done
          ? <p className="scnote">{plain} → <b>{cipher}</b>。两个 L 加密成了不同字母（J、V）——同一明文字母在不同位置对应不同密钥，<b>频率分析失效</b>。弱点在关键词<b>周期重复</b>：找出周期就能拆成几个凯撒分别破。它是「一次一密」的前身。</p>
          : <p className="scnote" style={{ opacity: .85 }}>关键词 {keyword} 循环套在明文上，每一位的位移 = 对应关键词字母的值。所以是「多张凯撒表轮着用」。</p>}
      </div>
    </div>
  )
}
