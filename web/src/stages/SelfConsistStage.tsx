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

        <p className="scnote">
          <b>自洽的核心</b>:一道有唯一解的推理题,<b>正确推法往往很多条、都殊途同归到同一答案</b>(这里 17 由三种算法得到),
          <b>错法却五花八门、彼此不一致</b>。所以正解单条链虽只占约 {correct === 17 ? '44' : '?'}%(不到半数),却是<b>唯一的众数</b>。
          于是<b>采样越多、多数票越向正解收敛</b>:N 小时抽样噪声能让错误答案暂时领先或平票(如上 N≤5),N 大了正解就稳压全场(N≥9)。
          这就是自洽比"单条贪心推理"强的原因——代价是要多跑 N 次、更贵。经典且简单,常配思维链 CoT 用。
        </p>
      </div>
    </div>
  )
}
