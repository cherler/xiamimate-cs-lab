/** 舞台：通配符匹配 —— s/p 双指针，* 记锚点、回溯多吃，覆盖的字符高亮 */
import type { WildState } from '@engine/kernels/wildcard.ts'
import type { StageProps } from '../types.ts'

export function WildcardStage({ state }: StageProps<WildState>) {
  const { op, s, p, si, pj, star, coverFrom, coverTo, matched, phase } = state
  const done = phase === 'done'
  const covered = (idx: number) => coverFrom >= 0 && idx >= coverFrom && idx < coverTo

  return (
    <div className="card">
      <h3>通配符匹配 <span className="hint">? 配一个、* 配一段：双指针 + 回溯锚点</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'intro' ? '就绪' : op === 'match' ? '匹配' : op === 'star' ? '记锚点' : op === 'backtrack' ? '回溯' : done ? '结束' : op}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">si={op === 'intro' ? 0 : si} · pj={op === 'intro' ? 0 : pj}</span><span className="scdl">双指针</span></div>
          <div className="scdk"><span className={`scdn ${done ? (matched ? 'ok' : 'miss') : ''}`}>{done ? (matched ? '匹配 ✓' : '不匹配 ✗') : star >= 0 ? `* 吃 "${s.slice(coverFrom, coverTo) || '空'}"` : '—'}</span><span className="scdl">{done ? '结果' : '* 覆盖'}</span></div>
        </div>

        {/* s 行 */}
        <div className="wc-row">
          <span className="wc-lbl">s</span>
          <div className="wc-cells">
            {s.split('').map((ch, idx) => (
              <span key={idx} className={`wc-cell ${idx === si && !done ? 'ptr' : ''} ${covered(idx) ? 'cover' : ''} ${done && matched ? 'ok' : ''}`}>{ch}<i>{idx}</i></span>
            ))}
            <span className={`wc-end ${si >= s.length ? 'at' : ''}`}>⊣</span>
          </div>
        </div>

        {/* p 行 */}
        <div className="wc-row">
          <span className="wc-lbl">p</span>
          <div className="wc-cells">
            {p.split('').map((ch, idx) => (
              <span key={idx} className={`wc-cell ${idx === pj && !done ? 'ptr' : ''} ${ch === '*' ? 'star' : ch === '?' ? 'any' : ''} ${idx === star ? 'anchor' : ''}`}>{ch}<i>{idx}</i></span>
            ))}
            <span className={`wc-end ${pj >= p.length ? 'at' : ''}`}>⊣</span>
          </div>
        </div>

        {op === 'backtrack' && <div className="wc-note">走不通 → 回到锚点（p 的 *），让 <b>*</b> 多吃一个字符（现在吃了 "<b>{s.slice(coverFrom, coverTo)}</b>"），继续往后配。</div>}
        {op === 'star' && <div className="wc-note mv">遇 <b>*</b> → 记下锚点（p={star}），先当它匹配 <b>0 个</b>字符往后走；走不通再回来多吃。</div>}

        {done
          ? <p className="scnote"><b>* 用锚点 + 回溯</b>处理"该吃几个"：先贪心当 0 个、走不通就逐个多吃。O(n) 空间、不用递归/DP。面试讲：* 为什么要回溯、锚点法 vs 动态规划（DP 更直观但 O(nm) 空间）、和正则 <code>.*</code> 的区别。文件通配、路由匹配、SQL LIKE 都用类似思路。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。两个指针扫 s、p：字符相同或 ? 就一起前进；遇 * 记锚点、先当匹配 0 个；后面走不通就回锚点让 * 多吃一个（s 里绿色就是 * 吃掉的段）。</p>}
      </div>
    </div>
  )
}
