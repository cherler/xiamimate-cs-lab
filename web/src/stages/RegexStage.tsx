/** 舞台：mini 正则引擎 —— DP 表逐行揭开，* 的"零或多个"两种转移，关键格高亮 */
import type { RegexState } from '@engine/kernels/regex.ts'
import type { StageProps } from '../types.ts'

const RULE: Record<string, string> = { zero: '* 匹配 0 个', more: '* 多吃一个', char: '字符相配·看左上', base: '起点' }

export function RegexStage({ state }: StageProps<RegexState>) {
  const { s, p, table, revealed, curRow, key, matched, phase } = state
  const done = phase === 'done'
  const pHead = ['_', ...p.split('')]
  const sHead = ['_', ...s.split('')]

  return (
    <div className="card">
      <h3>mini 正则引擎 <span className="hint">. 配任意、* 配零或多个前一字符（DP 表）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{state.op === 'intro' ? '看规则' : done ? '读答案' : `填第 ${curRow} 行`}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{key ? `dp[${key.i}][${key.j}]` : '—'}</span><span className="scdl">{key ? RULE[key.rule] : '关键格'}</span></div>
          <div className="scdk"><span className={`scdn ${done ? (matched ? 'ok' : 'miss') : ''}`}>{done ? (matched ? '匹配 ✓' : '不匹配 ✗') : 's="' + s + '" p="' + p + '"'}</span><span className="scdl">{done ? '结果' : '输入'}</span></div>
        </div>

        {/* DP 表 */}
        <div className="rx-table" style={{ gridTemplateColumns: `28px repeat(${pHead.length}, 34px)` }}>
          <span className="rx-corner">dp</span>
          {pHead.map((c, j) => <span key={j} className={`rx-head ${c === '*' ? 'star' : c === '.' ? 'any' : ''}`}>{c}</span>)}
          {table.map((row, i) => (
            <span key={`r${i}`} style={{ display: 'contents' }}>
              <span className="rx-head sh">{sHead[i]}</span>
              {row.map((v, j) => {
                const shown = i < revealed
                const isKey = key && key.i === i && key.j === j
                const isAns = done && i === s.length && j === p.length
                return (
                  <span key={j} className={`rx-cell ${shown ? (v ? 'tt' : 'ff') : 'hide'} ${i === curRow && shown ? 'currow' : ''} ${isKey ? 'key' : ''} ${isAns ? 'ans' : ''}`}>
                    {shown ? (v ? '✓' : '·') : ''}
                  </span>
                )
              })}
            </span>
          ))}
        </div>

        {key && !done && (
          <div className={`rx-note ${key.rule}`}>
            {key.rule === 'zero' ? <>关键格 dp[{key.i}][{key.j}]：p 这段是 "x*"，让 <b>* 匹配 0 个</b> → 跳两格看 dp[{key.i}][{key.j - 2}]。</>
              : key.rule === 'more' ? <>关键格 dp[{key.i}][{key.j}]：<b>* 多吃一个</b>（s 这个字符配 x）→ 看正上方 dp[{key.i - 1}][{key.j}]。</>
                : <>关键格 dp[{key.i}][{key.j}]：p 这位不是 *，<b>字符相配</b>且看左上 dp[{key.i - 1}][{key.j - 1}]。</>}
          </div>
        )}

        {done
          ? <p className="scnote">正则 <code>. *</code> 用 DP 最清楚：<b>*</b> 的"零或多个"就是两种转移——<b>跳两格（匹配 0 个）</b>或 <b>看正上方（多吃一个）</b>；非 * 看左上且字符相配。右下角就是答案。O(nm) 时空、比回溯稳。面试讲：* 的两种转移、和通配符 *（任意一段）的区别、DP vs 回溯、真引擎用 NFA/DFA。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。表逐行揭开：每格问"p 这位是不是 *"——是就用"跳两格(0 个)"或"正上方(多吃一个)"，不是就看"左上"且字符相配。绿✓=能匹配、·=不能。看 c* 怎么匹配 0 个、a* 怎么吃掉两个 a。</p>}
      </div>
    </div>
  )
}
