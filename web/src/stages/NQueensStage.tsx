/** 舞台：回溯 N 皇后 —— 4×4 棋盘逐行放皇后，撞死胡同就撤回换一列，皇后一进一出就是回溯 */
import type { NQueensState } from '@engine/kernels/nqueens.ts'
import type { StageProps } from '../types.ts'

export function NQueensStage({ state }: StageProps<NQueensState>) {
  const { n, cols, row, col, act, skip, placed, tries, backtracks, phase } = state
  const done = phase === 'done'
  const solved = act === 'solved' || done
  return (
    <div className="card">
      <h3>回溯 · 4 皇后 <span className="hint">走不通就退回上一步，换一个再试</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{placed}/{n}</span><span className="scdl">盘上皇后</span></div>
          <div className="scdk"><span className="scdn hot">{tries}</span><span className="scdl">试列次数</span></div>
          <div className="scdk"><span className="scdn">{backtracks}</span><span className="scdl">回溯次数</span></div>
        </div>

        <div className="nqwrap">
          <div className={`nqboard ${solved ? 'win' : ''}`} style={{ gridTemplateColumns: `repeat(${n}, 40px)` }}>
            {Array.from({ length: n * n }, (_, idx) => {
              const r = Math.floor(idx / n), c = idx % n
              const hasQ = cols[r] === c
              const dark = (r + c) % 2 === 1
              const isAct = !solved && r === row && c === col
              const isSkip = !solved && r === row && skip.includes(c)
              const showQ = hasQ || (isAct && act === 'backtrack')
              const cls = [
                'nqcell', dark ? 'dk' : '',
                isAct && act === 'place' ? 'place' : '',
                isAct && act === 'backtrack' ? 'back' : '',
                isSkip ? 'atk' : '',
                hasQ && solved ? 'solq' : '',
              ].filter(Boolean).join(' ')
              return (
                <div key={idx} className={cls}>
                  {showQ ? <span className="nqq">♛</span> : isSkip ? <span className="nqx">✕</span> : ''}
                </div>
              )
            })}
          </div>
          <div className="orcap">
            {row < 0 && !solved ? '按「下一步」开始:第 0 行从最左列找一个安全位落子'
              : solved ? `无冲突布局 [${cols.join(',')}]——四个皇后互不攻击,解出来了!`
                : act === 'place' ? `第 ${row} 行落在列 ${col}${skip.length ? `(列 ${skip.join('、')} 被攻击、✕ 跳过)` : ''}——安全,进下一行`
                  : `第 ${row} 行列 ${col} 下面走进死胡同 → 撤回这枚皇后(回溯),回上一行换下一列`}
          </div>
        </div>

        {done
          ? <p className="scnote">一路"试一个 → 撞死胡同 → 撤回 → 换下一个",深度优先地把选择树走了一遍,靠"提前剪掉被攻击的列"避免真去枚举全部 <b>{n ** n}</b> 种摆法。皇后<b>一落一撤</b>就是回溯的全部秘密。数独、排列组合、正则匹配、编译器求解,底子都是这套"走不通就退一步"。</p>
          : <p className="scnote" style={{ opacity: .85 }}>绿=刚落子(安全)、红=正被撤回(回溯)、✕=本行被已放皇后攻击的列。盯着皇后:它进一个又退一个、换个位置再来——这就是"试错+撤销"。</p>}
      </div>
    </div>
  )
}
