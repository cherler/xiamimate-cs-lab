/** 舞台：凯撒密码 —— 明文逐字母移位，看 code +k mod26 → 密文 */
import type { CaesarState } from '@engine/kernels/caesar.ts'
import type { StageProps } from '../types.ts'

export function CaesarStage({ state }: StageProps<CaesarState>) {
  const { plain, key, pos, code, shifted, out, cipher, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>凯撒密码 <span className="hint">每个字母在字母表上后移 k 位</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">k = {key}</span><span className="scdl">位移密钥</span></div>
          <div className="scdk"><span className="scdn">{pos >= 0 ? pos + 1 : plain.length}</span><span className="scdl">第几个字母</span></div>
          <div className="scdk"><span className="scdn">{cipher || '—'}</span><span className="scdl">密文</span></div>
        </div>

        {/* 明文 / 密文 对照 */}
        <div className="cx-rows">
          <div className="cx-row"><span className="cx-lbl">明文</span>
            {plain.split('').map((c, i) => <span key={i} className={`cx-cell ${i === pos ? 'cur' : ''}`}>{c}</span>)}
          </div>
          <div className="cx-row"><span className="cx-lbl">密文</span>
            {plain.split('').map((c, i) => <span key={i} className={`cx-cell ${i < cipher.length ? 'done' : ''} ${i === pos ? 'cur' : ''}`}>{cipher[i] ?? '·'}</span>)}
          </div>
        </div>

        {/* 当前字母的变换 */}
        {pos >= 0 && !done && (
          <div className="cx-calc">
            {plain[pos]} = <b>{code}</b> &nbsp;→&nbsp; ({code} + {key}) mod 26 = <b>{shifted}</b> &nbsp;→&nbsp; <b className="cx-out">{out}</b>
          </div>
        )}

        {done
          ? <p className="scnote">{plain} → <b>{cipher}</b>。凯撒密码只有 26 种密钥、又不改字母频率，暴力试 + 频率分析都能破。但「字母转成数字、加密钥、mod 26 绕回」这个骨架，是后面维吉尼亚乃至一切对称加密的起点。</p>
          : <p className="scnote" style={{ opacity: .85 }}>把字母转成数字（A=0…Z=25），加上密钥 k，对 26 取模（越过 Z 绕回 A），再转回字母。解密就是反着减 k。</p>}
      </div>
    </div>
  )
}
