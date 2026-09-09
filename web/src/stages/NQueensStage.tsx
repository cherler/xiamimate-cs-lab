/**
 * 舞台：回溯 N 皇后 —— 棋盘逐行放皇后，撞死胡同就撤回换一列，皇后一进一出就是回溯。
 *
 * 补厚后这一屏的落点是读数里那一对数：**访问节点数** vs **不剪枝要访问几个**。
 * 回溯的全部价值不是"穷举得更快"，而是**根本没去穷举那些一看就不可能的分支** ——
 * 8×8 上这一对是 2056 vs 19,173,960。
 */
import type { NQueensState } from '@engine/kernels/nqueens.ts'
import type { StageProps } from '../types.ts'

export function NQueensStage({ state }: StageProps<NQueensState>) {
  const {
    n, cols, row, col, act, skip, placed, tries, backtracks, phase,
    goal, prune, nodes, solutions, totalNodes, totalSolutions, totalBacktracks,
    bruteNodes, drawn, omitted, scale,
  } = state
  const done = phase === 'done'
  const solved = act === 'solved' || done
  const ratio = totalNodes > 0 ? bruteNodes / totalNodes : 1
  return (
    <div className="card">
      <h3>回溯 · {n} 皇后 <span className="hint">走不通就退回上一步，换一个再试</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{placed}/{n}</span><span className="scdl">盘上皇后</span></div>
          <div className="scdk"><span className="scdn hot">{tries}</span><span className="scdl">试列次数</span></div>
          <div className="scdk"><span className="scdn">{backtracks}</span><span className="scdl">回溯次数</span></div>
          {/*  ⭐ 补厚的落点：回溯的全部价值就是"没去穷举那些一看就不可能的分支" */}
          <div className="scdk"><span className="scdn hot">{nodes}</span><span className="scdl">访问节点数</span></div>
          <div className="scdk">
            <span className={`scdn ${prune.startsWith('放满') ? 'bad' : 'good'}`}>{bruteNodes.toLocaleString('en-US')}</span>
            <span className="scdl">不剪枝要访问几个</span>
          </div>
          <div className="scdk">
            <span className={`scdn ${totalSolutions === 0 ? 'bad' : 'good'}`}>{totalSolutions}</span>
            <span className="scdl">解的个数</span>
          </div>
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

        {/*  换 N 扫一遍：剪枝 vs 不剪枝。这张表才是"剪掉了多少"的证据 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>N</span><span>剪枝后节点</span><span>不剪枝节点</span><span>差几倍</span><span>解的个数</span></div>
            {scale.map(r => (
              <div className="qsrow" key={r.n}>
                <span>{r.n}{r.n === n ? ' ◀' : ''}</span>
                <span className="good">{r.nodes}</span>
                <span className="bad">{r.brute.toLocaleString('en-US')}</span>
                <span>{(r.brute / Math.max(1, r.nodes)).toFixed(0)}×</span>
                <span className={r.sols === 0 ? 'bad' : 'dimv'}>{r.sols}</span>
              </div>
            ))}
            <div className="orcap">
              都找全部解。<b>N=2、N=3 一个解都没有</b> —— 而那是<b>走完整棵树</b>之后的结论。
              不剪枝那一列涨得快得多，这个差距才是回溯的价值。
            </div>
          </div>
        )}

        {done
          ? (
            <p className="scnote">
              {goal === '找出全部解' ? '整棵树走完了' : '找到第一个解就停了'}（{n}×{n}，{prune}）：
              访问 <b>{totalNodes}</b> 个节点、回溯 {totalBacktracks} 次，
              {totalSolutions === 0
                ? <>⚠️ <b>一个解都没有</b>。注意"没找到"和"没找"是两件事 —— 这里是<b>整棵搜索树都走完了</b>才下的结论。
                  <b>回溯保证找完，"找不到"也是一个结论。</b></>
                : <>找到 <b>{totalSolutions}</b> 个解。</>}
              <br />
              {/*  ⚠️ 不剪枝那一档拿自己跟自己比会印出"差 1 倍" —— 得换个方向说。 */}
              {prune.startsWith('放满')
                ? <><b>这一档一刀没剪</b>：放的时候不检查，一直放满 {n} 个才验一次 ——
                  也就是老老实实枚举 {n}^{n} = <b>{(n ** n).toLocaleString('en-US')}</b> 种摆法。
                  看表里同一行的「剪枝后节点」那一列：<b>正常回溯只要 {scale.find(r => r.n === n)?.nodes} 个</b>，
                  而答案一模一样。</>
                : <><b>剪枝剪掉了多少？</b>同样的 N 和目标，不剪枝要访问 <b>{bruteNodes.toLocaleString('en-US')}</b> 个节点，
                  而这一档只访问了 <b>{totalNodes}</b> 个 —— <b>差 {ratio.toFixed(0)} 倍</b>。</>}
              这就是"靠提前剪掉不可能的分支，避免真的枚举所有组合"的实际含义：
              <b>回溯不是穷举得更快，是根本没去穷举那些一看就不可能的分支。</b>
              {omitted > 0 && <><br />⚠️ 逐帧只画了前 <b>{drawn}</b> 步，后面还有约 {omitted} 步画不下 —— <b>但上面这些计数是全量精确的</b>（另一趟只计数跑出来的）。</>}
            </p>
          )
          : <p className="scnote" style={{ opacity: .85 }}>绿=刚落子(安全)、红=正被撤回(回溯)、✕=本行被已放皇后攻击的列。盯着皇后:它进一个又退一个、换个位置再来——这就是"试错+撤销"。</p>}
      </div>
    </div>
  )
}
