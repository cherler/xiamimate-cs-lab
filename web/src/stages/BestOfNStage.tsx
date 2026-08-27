/** 舞台：Best-of-N —— 采样 N 个候选，打分器给每个评分，取最高分的那个（argmax） */
import type { BestOfNState } from '@engine/kernels/bestofn.ts'
import type { StageProps } from '../types.ts'

export function BestOfNStage({ state }: StageProps<BestOfNState>) {
  const { task, target, cands, n, bestIdx, phase } = state
  const done = phase === 'done'
  const maxR = 10
  return (
    <div className="card">
      <h3>Best-of-N 拒绝采样 <span className="hint">采样 N 个候选，打分器挑最高分的那个</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{cands.length}/{n}</span><span className="scdl">已采样候选</span></div>
          <div className="scdk"><span className="scdn">{cands[bestIdx]?.reward ?? '—'}</span><span className="scdl">当前最高分</span></div>
          <div className="scdk"><span className="scdn">≈{target}</span><span className="scdl">目标</span></div>
        </div>

        <div className="bnwrap">
          <div className="bnprob">🎯 任务：<b>{task}</b><span className="bnrm">　打分器：奖励 = 10 − |24 − 结果|</span></div>

          <div className="bncands">
            {cands.map((c, k) => {
              const best = done ? k === bestIdx : k === bestIdx
              return (
                <div key={k} className={`bncand ${best ? 'best' : ''}`}>
                  <span className="bnidx">#{k + 1}</span>
                  <span className="bnexpr">{c.e} = {c.r}</span>
                  <span className="bnbar"><span className="bnbarfill" style={{ width: `${(c.reward / maxR) * 100}%` }} /></span>
                  <span className="bnr">{c.reward} 分</span>
                  <span className="bnmark">{best ? '★ 最高' : ''}</span>
                </div>
              )
            })}
          </div>

          <div className="orcap">
            {cands.length === 0 ? '按「下一步」开始:对同一任务采样 N 个候选,打分器评分、取最高'
              : done ? `取最高分:${n} 个候选里「${cands[bestIdx].e}」得 ${cands[bestIdx].reward} 分,最高 → 采纳`
                : `第 ${cands.length} 个:「${cands[cands.length - 1].e}」=${cands[cands.length - 1].r} 得 ${cands[cands.length - 1].reward} 分;当前最高「${cands[bestIdx].e}」(${cands[bestIdx].reward})`}
          </div>
        </div>

        {done
          ? <p className="scnote">生成一次质量参差:模型有时灵光、有时平庸。<b>Best-of-N</b>(拒绝采样)的思路很直白:<b>多采几个、挑最好的</b>。关键是有个<b>打分器</b>——训练好的<b>奖励模型</b>(给回答质量打分,RLHF 用它)或<b>可算的验证器</b>(数学验算、代码跑单测)。采样 N 个、逐个打分、<b>argmax 取最高</b>,用算力换质量。和自洽的<b>多数投票</b>不同:这里靠<b>外部打分器选单个最好</b>,适合开放式生成(没有"多数答案"可投)。N 越大越好但越贵,还受打分器质量限制。</p>
          : <p className="scnote" style={{ opacity: .85 }}>对同一任务采样多个候选(★=当前最高分)。每个候选交给<b>打分器</b>评分(这里是可算的验证器,按接近 24 的程度给分),条越长分越高。最后<b>取分数最高</b>的那个。这和自洽不同——自洽数票(多数投票),Best-of-N 看分(打分器择优)。</p>}
      </div>
    </div>
  )
}
