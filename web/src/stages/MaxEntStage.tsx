/** 舞台：最大熵原理 —— 给定期望约束，求最不武断(熵最大)的分布 */
import type { MaxEntState } from '@engine/kernels/maxent.ts'
import type { StageProps } from '../types.ts'

export function MaxEntStage({ state }: StageProps<MaxEntState>) {
  const { mu, probs, ent, naiveEnt, maxEnt, phase } = state
  const started = probs.some(p => p > 0)
  const maxP = Math.max(0.35, ...probs)
  return (
    <div className="card">
      <h3>最大熵原理 <span className="hint">softmax/玻尔兹曼分布凭什么"天生合理"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{mu}</span><span className="scdl">期望约束 μ</span></div>
          <div className="scdk"><span className="scdn hot">{started ? ent.toFixed(2) : maxEnt.toFixed(2)}</span><span className="scdl">最大熵 (bit)</span></div>
          <div className="scdk"><span className="scdn">{maxEnt.toFixed(2)}</span><span className="scdl">熵上限 log₂6</span></div>
        </div>

        {/* 骰子分布柱状 */}
        <div className="mewrap">
          <div className="mebars">
            {probs.map((p, k) => (
              <div key={k} className="mecol">
                <span className="mepct">{(p * 100).toFixed(0)}%</span>
                <div className="mebartrack"><div className="mebar" style={{ height: `${(p / maxP) * 100}%` }} /></div>
                <span className="melab">{k + 1}</span>
              </div>
            ))}
          </div>
          {/* 熵条 */}
          <div className="meentwrap">
            <span className="meentlab">熵</span>
            <div className="meenttrack"><div className="meentfill" style={{ width: `${(ent / maxEnt) * 100}%` }} /></div>
            <span className="meentval">{ent.toFixed(2)} / {maxEnt.toFixed(2)}</span>
          </div>
          <div className="orcap">
            {started
              ? `最大熵解 p_i ∝ e^{λi}（骰子 1..6 的概率）；${mu === 3.5 ? '无约束 → 均匀、熵到顶' : `同均值的"两点"分布只有 ${naiveEnt.toFixed(2)} bit，远低于它`}`
              : '按「下一步」逐步收紧期望约束 μ'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">约束从 μ=3.5 收紧到 5.5:最大熵解从<b>均匀</b>(熵 {maxEnt.toFixed(2)})一路变尖(熵→{ent.toFixed(2)})——<b>信息越多、最诚实的分布越集中</b>。每一步都是"满足约束里最不武断"的那个,形式恒为指数族 p∝e^(λ·特征)。给"期望能量"约束时它就是 <b>softmax/玻尔兹曼分布</b>——这就是 softmax、逻辑回归、玻尔兹曼机天生合理的根:不是随手一挑,是<b>约束下最大熵</b>的唯一答案。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>{mu === 3.5 ? '没有额外信息时,最诚实的分布就是均匀——熵到顶,不偏袒任何一面。' : '有了"均值偏大"这条信息,分布被迫往 6 偏;但它仍是所有满足该均值的分布里熵最高、最不武断的那个。'}</p>}
      </div>
    </div>
  )
}
