/** 舞台：Best-of-N —— 轴=采样候选数 N；核心是"最高分随 N 边际递减"的曲线 */
import type { BestOfNState } from '@engine/kernels/bestofn.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const NS = [1, 2, 4, 8, 16, 32]

export function BestOfNStage({ state }: StageProps<BestOfNState>) {
  const { task, drawn, bestIdx, bestReward, curve, n } = state
  const best = drawn[bestIdx]
  //  去重候选(池成员),按奖励降序——N 大时避免列 32 行
  const distinct = [...new Map(drawn.map(c => [c.e, c])).values()].sort((a, b) => b.reward - a.reward)

  //  边际递减曲线画布
  const W = 320, H = 132, pl = 26, pr = 14, pt = 12, pb = 26
  const pw = W - pl - pr, ph = H - pt - pb
  const xi = (i: number) => pl + (i / (NS.length - 1)) * pw
  const yv = (r: number) => pt + ph - (r / 10) * ph

  return (
    <div className="card">
      <h3>Best-of-N 拒绝采样 <span className="hint">采样越多、最高分越好——但边际递减</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">N={n}</span><span className="scdl">采样候选数(轴)</span></div>
          <div className="scdk"><span className="scdn good">{bestReward}</span><span className="scdl">最高分(满分 10)</span></div>
          <div className="scdk"><span className="scdn">{best?.e ?? '—'}</span><span className="scdl">采纳的候选</span></div>
        </div>

        <div className="bnwrap">
          <div className="bnprob">🎯 <b>{task}</b><span className="bnrm">　打分器：奖励 = 10 − |24 − 结果|</span></div>

          {/* 边际递减曲线:最高分 vs N —— 先快涨、后压平 */}
          <div className="bncurvewrap">
            <div className="bncurve-t">最高分随 N 变化：<b>先快涨、后压平</b> = 边际递减</div>
            <svg className="bncurve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {[0, 5, 10].map(r => (
                <g key={r}>
                  <line x1={pl} y1={yv(r)} x2={W - pr} y2={yv(r)} className="bng" vectorEffect="non-scaling-stroke" />
                  <text x={pl - 4} y={yv(r) + 3} className="bnax" textAnchor="end">{r}</text>
                </g>
              ))}
              {NS.map((nn, i) => <text key={nn} x={xi(i)} y={H - 8} className="bnax" textAnchor="middle">{nn}</text>)}
              {curve.length > 1 && <polyline points={curve.map((p, i) => `${xi(i)},${yv(p.best)}`).join(' ')} className="bncurveline" vectorEffect="non-scaling-stroke" />}
              {curve.map((p, i) => (
                <g key={i}>
                  <circle cx={xi(i)} cy={yv(p.best)} r={i === curve.length - 1 ? 4.2 : 2.6} className={i === curve.length - 1 ? 'bndot cur' : 'bndot'} />
                  {i === curve.length - 1 && <text x={xi(i)} y={yv(p.best) - 8} className="bndotlbl" textAnchor="middle">{p.best}</text>}
                </g>
              ))}
            </svg>
          </div>

          {/* 采到的候选(去重),按分排;★=被采纳的最高分 */}
          <div className="bncands">
            {distinct.map((c, k) => (
              <div key={k} className={`bncand bon ${c.e === best?.e ? 'best' : ''}`}>
                <span className="bnexpr">{c.e} = {c.v}</span>
                <span className="bnbar"><span className="bnbarfill" style={{ width: `${(c.reward / 10) * 100}%` }} /></span>
                <span className="bnr">{c.reward} 分</span>
                <span className="bnmark">{c.e === best?.e ? '★ 采纳' : ''}</span>
              </div>
            ))}
          </div>

          <div className="orcap">{rich(state.log)}</div>
        </div>

        <p className="scnote">
          <b>Best-of-N（拒绝采样）</b>：生成一次质量参差,索性<b>多采 N 个、打分器给每个评分、argmax 取最高</b>——用算力换质量。
          核心是<b>边际递减</b>:取 N 个样本的最好一个 = 取分布的最大值,而期望最大值随 N <b>越涨越慢</b>(近似 log N)——
          前几个就容易撞到"还行"的、best 快速抬升;再加候选只偶尔更好、几乎不动。所以 N 翻倍算力翻倍,质量提升却越来越小,还被<b>打分器上限</b>卡住(满分 10 封顶)。
          打分器可以是<b>奖励模型</b>(RLHF)或<b>可算验证器</b>(验算/跑单测)。和自洽的<b>多数投票</b>不同:这里靠外部打分器选<b>单个最好</b>,适合开放式生成(没有"多数答案"可投)。
        </p>
      </div>
    </div>
  )
}
