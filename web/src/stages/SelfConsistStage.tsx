/** 舞台：思维链自洽 —— 采样多条推理链，各得一个答案，多数投票；殊途同归的答案更可信 */
import type { SelfConsistState } from '@engine/kernels/selfconsist.ts'
import type { StageProps } from '../types.ts'

export function SelfConsistStage({ state }: StageProps<SelfConsistState>) {
  const { problem, chains, n, tally, winner, correct, phase } = state
  const done = phase === 'done'
  const maxVotes = Math.max(...tally.map(([, v]) => v), 1)
  return (
    <div className="card">
      <h3>思维链自洽 Self-Consistency <span className="hint">采样多条推理链，多数投票</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{chains.length}/{n}</span><span className="scdl">已采样链</span></div>
          <div className="scdk"><span className="scdn">{done ? winner : tally[0]?.[0] ?? '—'}</span><span className="scdl">当前多数票</span></div>
          <div className="scdk"><span className="scdn">{correct}</span><span className="scdl">正解</span></div>
        </div>

        <div className="scwrap">
          <div className="scprob">📝 <b>{problem}</b></div>

          <div className="scchains">
            {chains.map((c, k) => (
              <div key={k} className={`scchain ${c.ok ? 'ok' : 'bad'}`}>
                <span className="scidx">链{k + 1}</span>
                <span className="screason">{c.r}</span>
                <span className="scans">→ {c.a}</span>
                <span className="scmark">{c.ok ? '✓' : '✗'}</span>
              </div>
            ))}
          </div>

          <div className="scvote">
            <span className="scvlbl">投票：</span>
            {tally.map(([a, v]) => {
              const win = done && a === winner
              return (
                <div key={a} className={`scbar ${win ? 'win' : ''}`}>
                  <span className="scba">{a}</span>
                  <span className="scbbar"><span className="scbfill" style={{ width: `${(v / maxVotes) * 100}%` }} /></span>
                  <span className="scbn">{v} 票</span>
                  {win && <span className="scbwin">← 胜出</span>}
                </div>
              )
            })}
          </div>

          <div className="orcap">
            {chains.length === 0 ? '按「下一步」开始:对同一题采样多条推理链,再多数投票'
              : done ? `多数投票 ${winner} 胜出(${tally[0][1]}/${n})——3 条殊途同归到 17,少数算错的被淹没`
                : `第 ${chains.length} 条链 → ${chains[chains.length - 1].a}${chains[chains.length - 1].ok ? '' : '(算错)'};当前 ${tally[0][0]} 领先`}
          </div>
        </div>

        {done
          ? <p className="scnote">单条<b>贪心</b>推理一步错就步步错,若恰好采到那条错链(如 32)就答错。<b>自洽</b>的洞见:一道有唯一答案的推理题,<b>正确推法往往很多条、都通向同一个答案</b>,错法则五花八门、彼此不一致。于是<b>采样 N 条</b>链(温度制造多样)、各自推答案、<b>取票数最多的</b>——少数算错的被淹没,推理准确率显著提升(尤其数学/常识)。是提升 LLM 推理的经典简单招,配思维链 CoT 用。代价:要多跑 N 次、更贵。</p>
          : <p className="scnote" style={{ opacity: .85 }}>对同一道题,让模型采样出<b>多条不同的推理链</b>(带随机性)。每条独立推到一个答案(绿=对、红=错),再<b>数票</b>:出现最多的那个答案胜出。不同路子若殊途同归到同一答案,它更可能对;个别算错的会被多数票淹没。</p>}
      </div>
    </div>
  )
}
