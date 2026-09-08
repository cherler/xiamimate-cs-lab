/**
 * 舞台：KMP —— next 数组表 + 主串/模式串对齐图，**同一屏**
 *
 * 2026-09-08 用户：「next 数组与匹配对齐，应该在同一个 tab 页里。现在分在了两个 tab 页，
 * 会比较不直观」。他说得对，而且这不只是"少点一下"的问题：
 *
 * KMP 这一课的全部内容就是**这两块之间的那根线** —— 失配的那一刻，去 next 表里查一格，
 * 查到的数就是模式串下一步滑到哪。表和对齐图分在两个页签，恰好把这根线剪断了：
 * 在对齐图上看到失配，得自己记着 j 是几，切过去找到那一格，再切回来。
 *
 * 合成一屏之后这根线可以真的画出来：失配时**表里被查的那一格亮起来**（`.look`），
 * 底下那句话把「查 next[2] = 1 → 模式串滑到 1」写全。
 */
import type { KmpState } from '@engine/kernels/kmp.ts'
import type { StageProps } from '../types.ts'

export function KmpStage({ doc, state }: StageProps<KmpState>) {
  const text = String(doc.params.text)
  const pattern = String(doc.params.pattern)
  const showMatch = Number(doc.params.showMatch) === 1
  const matching = state.phase !== 'next'

  /*  失配时算法查的是 next[pj−1]（模式串已经匹配上的那一截有多长）；
      走到末尾找到一处时查的是 next[m−1]。把这一格在表里点亮 —— 这就是两块之间那根线。 */
  const look = state.phase === 'found' ? pattern.length - 1
    : state.phase === 'match' && state.eq === false && state.pj > 0 ? state.pj - 1
    : -1

  return (
    <div className="card">
      <h3>KMP <span className="hint">
        上面求 next 表，下面拿它做匹配 —— 失配时查的就是上面点亮的那一格
      </span></h3>
      <div className="body scroll">
        <Next pattern={pattern} state={state} look={look} matching={matching} />
        {showMatch
          ? <Match text={text} pattern={pattern} state={state} />
          : <p className="kmpsec off">这次只求 next 数组（「是否演示匹配」设成了 0），不演示匹配过程。</p>}
        {/*  这一句得留短：上下两块摞起来之后，卡片已经顶到 FitBox 0.58 的缩放下限，
             多两行字底下就出屏了（实测）。 */}
        <p className="tnote">
          上下两块跑的是<b>同一套逻辑</b> —— 上面是模式串跟自己匹配（这就是 next 的来历），
          下面是模式串跟主串匹配。
        </p>
      </div>
    </div>
  )
}

/** next 数组：每一列是"前 j+1 个字符的最长相等前后缀长度" */
function Next({ pattern, state, look, matching }: {
  pattern: string; state: KmpState; look: number; matching: boolean
}) {
  return (
    <>
      <p className="kmpsec">
        <b>① next 表</b>
        <span>next[j] = 前 j+1 个字符里最长的「相等前后缀」长度</span>
      </p>
      <table className="ptab kmp">
        <thead>
          <tr>
            <th>下标 j</th>
            {pattern.split('').map((_, k) => (
              <th key={k} className={k === look ? 'look' : k === state.j ? 'cur' : k > state.j ? 'future' : ''}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>模式串</th>
            {pattern.split('').map((c, k) => (
              <td key={k} className={[
                //  求 next 时高亮的是"正在算的那一位"；匹配时高亮的是"模式指针在哪"
                (matching ? k === state.pj : k === state.j) ? 'cur' : '',
                !matching && k === state.k ? 'cmp' : '',
                !matching && k > state.j ? 'future' : '',
              ].filter(Boolean).join(' ')}>{c}</td>
            ))}
          </tr>
          <tr>
            <th>next[j]</th>
            {state.next.map((v, k) => (
              <td key={k} className={[
                v < 0 ? 'future' : '',
                k === look ? 'look' : !matching && k === state.j ? 'work' : '',
              ].filter(Boolean).join(' ')}>
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
      {look >= 0 && (
        //  两块之间那根线：这一句把"表里的那一格"和"下面模式串滑到哪"接起来
        <p className="kmpwhy">
          {state.phase === 'found' ? '找到一处，接着往下找：' : '失配了，'}
          查表里点亮的那一格 → next[{look}] = <b>{state.next[look]}</b>
          {' '}→ 模式串的 j 滑到 <b>{state.next[look]}</b>，主串指针原地不动。
        </p>
      )}
    </>
  )
}

/** 匹配对齐图：模式串在主串下方滑动 */
function Match({ text, pattern, state }: { text: string; pattern: string; state: KmpState }) {
  const shift = state.ti - state.pj      // 模式串当前对齐到主串的哪个位置
  const found = new Set<number>()
  for (const f of state.found) for (let k = 0; k < pattern.length; k++) found.add(f + k)
  //  还在求 next 的那几步：匹配根本没开始，ti/pj 都是 −1，别画一条假的对齐
  const started = state.phase !== 'next'

  return (
    <>
      <p className="kmpsec">
        <b>② 匹配对齐</b>
        <span>{started
          ? '失配时主串指针不动，只滑模式串'
          : '还没开始 —— 得先把上面的 next 表求完'}</span>
      </p>
      <div className={`kmpalign${started ? '' : ' waiting'}`}>
        <div className="karow">
          <span className="kalab">主串</span>
          {text.split('').map((c, k) => (
            <span key={k} className={[
              'kach',
              started && k === state.ti ? 'cur' : '',
              found.has(k) ? 'hit' : '',
              started && k < shift ? 'past' : '',
            ].filter(Boolean).join(' ')}>{c}</span>
          ))}
        </div>
        <div className="karow">
          <span className="kalab">模式串</span>
          {text.split('').map((_, k) => {
            const j = k - shift
            const inside = started && j >= 0 && j < pattern.length
            return (
              <span key={k} className={[
                'kach', inside ? 'pat' : 'blank',
                started && k === state.ti ? (state.eq === false ? 'bad' : 'cur') : '',
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
      {/*  这里原来还有一块 `.phasenow`（主串指针 i / 模式指针 j / 已找到 / 主串共前进）。
           两块合到一屏之后卡片长了一截，实测底下这四行被挤出舞台看不见了；
           而它们四个**右边的读数栏里一个不少地都有**（见 registry 的 readouts）。
           同一个数在一屏上摆两遍，还把主角挤出去，删掉的是重复的那一份。 */}
    </>
  )
}
