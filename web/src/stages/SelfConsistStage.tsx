/** 舞台：思维链自洽 —— 轴=采样链数 N；看多数票随 N 从"不可靠(错/平票)"收敛到正解 */
import type { SelfConsistState } from '@engine/kernels/selfconsist.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function SelfConsistStage({ state }: StageProps<SelfConsistState>) {
  const { problem, samples, n, tally, winner, tie, correct, correctCount, reliable } = state
  const maxVotes = Math.max(...tally.map(([, v]) => v), 1)
  const winColor = tie ? 'var(--now)' : reliable ? 'var(--hit)' : 'var(--miss)'
  const winText = tie ? '平票' : (winner ?? '—')
  //  样例(静态"为什么"锚):正解的多条不同推法(殊途同归) + 每种错法一条(发散)
  const correctPaths = [...new Set(samples.filter(s => s.ok).map(s => s.r))].slice(0, 3)
  const wrongPaths = [...new Map(samples.filter(s => !s.ok).map(s => [s.a, s.r] as const)).values()]

  return (
    <div className="card">
      <h3>思维链自洽 Self-Consistency <span className="hint">采样越多，多数票越可靠</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">N={n}</span><span className="scdl">采样链数(轴)</span></div>
          <div className="scdk"><span className="scdn" style={{ color: winColor }}>{winText}</span><span className="scdl">多数票{reliable ? ' ✓正解' : tie ? ' 未定' : ' ✗错'}</span></div>
          <div className="scdk"><span className="scdn">{n ? Math.round(correctCount / n * 100) : 0}%</span><span className="scdl">正解占比 {correctCount}/{n}</span></div>
        </div>

        <div className="scwrap">
          <div className="scprob">📝 <b>{problem}</b> <span className="scprob-ans">正解 {correct}</span></div>

          {/* 投票条:随 N 变——看正解(绿)的票数怎么一步步压过错误答案 */}
          <div className="scvote">
            <span className="scvlbl">N={n} 条链的票数：</span>
            {tally.map(([a, v]) => {
              const win = !tie && a === winner
              const isCorrect = a === correct
              return (
                <div key={a} className={`scbar ${win ? 'win' : ''} ${isCorrect ? 'sc-correct' : 'sc-wrong'}`}>
                  <span className="scba">{a}{isCorrect ? ' ✓' : ''}</span>
                  <span className="scbbar"><span className="scbfill" style={{ width: `${(v / maxVotes) * 100}%` }} /></span>
                  <span className="scbn">{v} 票</span>
                  {win && <span className="scbwin">← 多数票</span>}
                </div>
              )
            })}
          </div>

          {/* 为什么正解总是众数:多条正确推法殊途同归、错法各异(静态锚,解释机制) */}
          <div className="scwhy">
            <div className="scwhy-col ok">
              <div className="scwhy-h">✓ 正解 {correct}：多条推法殊途同归</div>
              {correctPaths.map((r, k) => <div key={k} className="scwhy-item">{r}</div>)}
            </div>
            <div className="scwhy-col bad">
              <div className="scwhy-h">✗ 错法各异、彼此不一致</div>
              {wrongPaths.map((r, k) => <div key={k} className="scwhy-item">{r}</div>)}
            </div>
          </div>

          <div className="orcap">{rich(state.log)}</div>
        </div>

        {/*  ── 可靠率曲线：这一屏最要紧的一张图（2026-09-08 加）──
             单看这一次的输赢是**运气**；「多跑几条链有多大用」得看这条**概率**曲线，
             而它是蒙特卡洛重采样 400 次现算的，不是一句"越多越稳"。
             「集中」那一档它会**往下走** —— 自洽的边界只有在这里才看得见。 */}
        <div className="mlwrap">
          <p className="gbsec"><b>多跑几条，到底有多大用</b>
            <span>纵轴=这个 N 下多数票答对的概率（重采样 400 次算的）；橙点=当前 N</span></p>
          <svg className="sccurve" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="8" x2="100" y2="8" className="scc50" vectorEffect="non-scaling-stroke" />
            {(() => {
              const cv = state.curve
              const X = (i: number) => (cv.length < 2 ? 0 : i / (cv.length - 1) * 100)
              const Y = (v: number) => 100 - v * 92 - 4
              return <>
                <path d={cv.map(([, v], i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}
                  className="sccline" fill="none" vectorEffect="non-scaling-stroke" />
                {cv.map(([nn, v], i) => (
                  <circle key={nn} cx={X(i)} cy={Y(v)} r={nn === n ? 2.4 : 1.2}
                    className={nn === n ? 'sccnow' : 'sccdot'} />
                ))}
              </>
            })()}
          </svg>
          <div className="orcap">
            {state.curve.map(([nn, v]) => `N=${nn}:${(v * 100).toFixed(0)}%`).join('　')}
          </div>
        </div>

        <p className="scnote">
          <b>自洽的核心</b>：一道有唯一解的推理题，<b>正确推法往往很多条、都殊途同归到同一答案</b>，
          <b>错法却五花八门、彼此不一致</b>。所以正解单条链虽只占 {(state.pCorrect * 100).toFixed(0)}%（不到半数），
          却是<b>唯一的众数</b>；于是<b>采样越多、多数票越向正解收敛</b>。
          {state.spread === '集中'
            ? <>　⚠️ 但这一档把错法调成了<b>集中</b>（所有链都犯同一个错）——
              那个错答案才是众数，<b>可靠率随 N 往下掉</b>（{(state.curve[0][1] * 100).toFixed(0)}% →
              {' '}{(state.curve[state.curve.length - 1][1] * 100).toFixed(0)}%）。
              <b>自洽赌的是"错法互不相同"</b>，赌输了它就是个放大错误的机器。这是这个方法的边界。</>
            : <>　把「错法分布」换成<b>集中</b>试试：所有链都犯同一个错时，可靠率会<b>随 N 往下掉</b> ——
              自洽不是万灵药，它赌的是错法互不相同。</>}
          　代价是要多跑 N 次、更贵。经典且简单，常配思维链 CoT 用。
        </p>
      </div>
    </div>
  )
}
