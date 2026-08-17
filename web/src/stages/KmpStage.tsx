/** 舞台：KMP —— next 数组表 + 主串/模式串对齐图 */
import type { KmpState } from '@engine/kernels/kmp.ts'
import type { StageProps } from '../types.ts'

export function KmpStage({ doc, trace, index, state, tab }: StageProps<KmpState>) {
  const text = String(doc.params.text)
  const pattern = String(doc.params.pattern)
  if (tab === 'match') return <Match text={text} pattern={pattern} state={state} />
  return <Next pattern={pattern} state={state} />
}

/** next 数组：每一列是"前 j+1 个字符的最长相等前后缀长度" */
function Next({ pattern, state }: { pattern: string; state: KmpState }) {
  return (
    <div className="card">
      <h3>next 数组 <span className="hint">next[j] = 前 j+1 个字符里最长的「相等前后缀」长度</span></h3>
      <div className="body scroll">
        <table className="ptab kmp">
          <thead>
            <tr>
              <th>下标 j</th>
              {pattern.split('').map((_, k) => (
                <th key={k} className={k === state.j ? 'cur' : k > state.j ? 'future' : ''}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>模式串</th>
              {pattern.split('').map((c, k) => (
                <td key={k} className={[
                  k === state.j ? 'cur' : '',
                  k === state.k ? 'cmp' : '',
                  k > state.j ? 'future' : '',
                ].filter(Boolean).join(' ')}>{c}</td>
              ))}
            </tr>
            <tr>
              <th>next[j]</th>
              {state.next.map((v, k) => (
                <td key={k} className={v < 0 ? 'future' : k === state.j ? 'work' : ''}>
                  {v < 0 ? '?' : v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {state.j >= 0 && state.k >= 0 && state.phase === 'next' && (
          <p className="kmpwhy">
            正在比较 模式[{state.j}]=<b>{pattern[state.j]}</b> 与 模式[{state.k}]=<b>{pattern[state.k]}</b>
            {state.eq === true ? ' —— 相等，前后缀可以再长一位'
              : state.eq === false ? ' —— 不等，k 要按 next 回退' : ''}
          </p>
        )}
        <p className="tnote">
          求 next 本质上就是<b>模式串自己跟自己做一次 KMP 匹配</b>。
          比如 "ababa" 的 next[4]=3，是因为 "aba" 既是它的前缀又是它的后缀。
        </p>
      </div>
    </div>
  )
}

/** 匹配对齐图：模式串在主串下方滑动 */
function Match({ text, pattern, state }: { text: string; pattern: string; state: KmpState }) {
  const shift = state.ti - state.pj      // 模式串当前对齐到主串的哪个位置
  const found = new Set<number>()
  for (const f of state.found) for (let k = 0; k < pattern.length; k++) found.add(f + k)

  return (
    <div className="card">
      <h3>匹配对齐 <span className="hint">失配时主串指针不动，只滑模式串</span></h3>
      <div className="body scroll">
        <div className="kmpalign">
          <div className="karow">
            <span className="kalab">主串</span>
            {text.split('').map((c, k) => (
              <span key={k} className={[
                'kach',
                k === state.ti ? 'cur' : '',
                found.has(k) ? 'hit' : '',
                k < shift ? 'past' : '',
              ].filter(Boolean).join(' ')}>{c}</span>
            ))}
          </div>
          <div className="karow">
            <span className="kalab">模式串</span>
            {text.split('').map((_, k) => {
              const j = k - shift
              const inside = j >= 0 && j < pattern.length
              return (
                <span key={k} className={[
                  'kach', inside ? 'pat' : 'blank',
                  k === state.ti ? (state.eq === false ? 'bad' : 'cur') : '',
                ].filter(Boolean).join(' ')}>{inside ? pattern[j] : ''}</span>
              )
            })}
          </div>
          <div className="karow small">
            <span className="kalab">主串下标</span>
            {text.split('').map((_, k) => (
              <span key={k} className="kach idx">{k}</span>
            ))}
          </div>
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">主串指针 i</span><span className="v">{state.ti}</span></div>
          <div className="pr"><span className="k">模式指针 j</span><span className="v">{state.pj}</span></div>
          <div className="pr"><span className="k">已找到</span>
            <span className="v">{state.found.length ? state.found.join('、') : '暂无'}</span></div>
          <div className="pr"><span className="k">主串共前进</span>
            <span className="v">{state.textAdvances} 次（长度 {text.length}，永不回退）</span></div>
        </div>
      </div>
    </div>
  )
}
