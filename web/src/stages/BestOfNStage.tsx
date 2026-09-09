/**
 * 舞台：Best-of-N —— 轴 = 采样候选数 N。
 *
 * 2026-09-09 补厚。老版本只画一条线（最高分随 N 涨），演的是**边际递减**。
 * 但它自己的注释里写着「还被**打分器上限**卡住」—— 那句话背后是 Best-of-N
 * 真正的失败模式：打分器只是**代理**。
 *
 * 所以这一屏的落点变成了**两条线**：
 *   实线 = 打分器给的**代理分数**（argmax 认的就是它）
 *   虚线 = 候选的**真实质量**（我们真正想要的）
 * 两条线分岔的那个 N，就是"再加算力反而更差"的拐点。
 */
import type { BestOfNState } from '@engine/kernels/bestofn.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function BestOfNStage({ state }: StageProps<BestOfNState>) {
  const {
    task, drawn, bestIdx, bestReward, bestTrue, curve, fullCurve, n, maxN,
    judge, variety, peakN, declineAfterPeak, ceiling, hacked, distinct,
  } = state
  const best = drawn[bestIdx]
  const flawed = judge.startsWith('有缺陷')
  const done = n >= maxN
  //  去重候选（池成员），按**代理分数**降序 —— argmax 认的就是这一列
  const uniq = [...new Map(drawn.map(c => [c.e, c])).values()].sort((a, b) => b.reward - a.reward)
  //  纵轴要同时装下代理分（有缺陷时最高 14）和真实质量（最高 10）
  const top = Math.max(10, ...fullCurve.map(p => p.best))

  const W = 340, H = 148, pl = 26, pr = 14, pt = 14, pb = 28
  const pw = W - pl - pr, ph = H - pt - pb
  const xi = (i: number) => pl + (i / (fullCurve.length - 1)) * pw
  const yv = (r: number) => pt + ph - (r / top) * ph

  return (
    <div className="card">
      <h3>Best-of-N 拒绝采样 <span className="hint">采样 N 个、打分器挑最高——但它挑的是代理分数</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">N={n}</span><span className="scdl">采样候选数（轴）</span></div>
          <div className="scdk">
            <span className="scdn">{bestReward}</span>
            <span className="scdl">代理分数（argmax 认的）</span>
          </div>
          {/*  ⭐ 补厚的落点：代理分数旁边永远摆着真实质量 */}
          <div className="scdk">
            <span className={`scdn ${hacked ? 'bad' : bestTrue >= ceiling ? 'good' : ''}`}>{bestTrue}</span>
            <span className="scdl">真实质量（天花板 {ceiling}）</span>
          </div>
          <div className="scdk">
            <span className={`scdn ${distinct <= 2 && n >= 4 ? 'bad' : ''}`}>{distinct} / {n}</span>
            <span className="scdl">不同候选 / 采了几个</span>
          </div>
        </div>

        <div className="bnwrap">
          <div className="bnprob">
            🎯 <b>{task}</b>
            <span className="bnrm">　打分器：{flawed ? '奖励模型（真实质量 + 长度加成）' : '完美验证器（就是真实质量）'}　多样性：{variety}</span>
          </div>

          {/*  ⭐ 两条线：代理分数（实线）vs 真实质量（虚线）。分岔处 = 过优化拐点 */}
          <div className="bncurvewrap">
            <div className="bncurve-t">
              <b className="bnlg-p">━ 代理分数</b>（打分器给的，argmax 认它）
              <b className="bnlg-t">╌ 真实质量</b>（我们真正想要的）
            </div>
            <svg className="bncurve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {[0, Math.round(top / 2), top].map(r => (
                <g key={r}>
                  <line x1={pl} y1={yv(r)} x2={W - pr} y2={yv(r)} className="bng" vectorEffect="non-scaling-stroke" />
                  <text x={pl - 4} y={yv(r) + 3} className="bnax" textAnchor="end">{r}</text>
                </g>
              ))}
              {fullCurve.map((p, i) => <text key={p.n} x={xi(i)} y={H - 8} className="bnax" textAnchor="middle">{p.n}</text>)}
              {/*  真实质量见顶的那一列 —— 之后再加算力就是往回走 */}
              {declineAfterPeak > 0 && (() => {
                const pi = fullCurve.findIndex(p => p.n === peakN)
                return <line x1={xi(pi)} y1={pt} x2={xi(pi)} y2={pt + ph} className="bnpeak" vectorEffect="non-scaling-stroke" />
              })()}
              {curve.length > 1 && (
                <polyline points={curve.map((p, i) => `${xi(i)},${yv(p.best)}`).join(' ')} className="bncurveline" vectorEffect="non-scaling-stroke" />
              )}
              {curve.length > 1 && (
                <polyline points={curve.map((p, i) => `${xi(i)},${yv(p.trueBest)}`).join(' ')} className="bntrueline" vectorEffect="non-scaling-stroke" />
              )}
              {curve.map((p, i) => (
                <g key={i}>
                  <circle cx={xi(i)} cy={yv(p.best)} r={i === curve.length - 1 ? 4.2 : 2.6} className={i === curve.length - 1 ? 'bndot cur' : 'bndot'} />
                  <circle cx={xi(i)} cy={yv(p.trueBest)} r={i === curve.length - 1 ? 4.2 : 2.6} className={i === curve.length - 1 ? 'bntdot cur' : 'bntdot'} />
                  {i === curve.length - 1 && <text x={xi(i)} y={yv(p.best) - 8} className="bndotlbl" textAnchor="middle">{p.best}</text>}
                </g>
              ))}
            </svg>
          </div>

          {/*  采到的候选（去重），按**代理分数**排；★=argmax 采纳的那条 */}
          {/*  ⚠️ 红框的判据得钉在**意思**上，不是"代理分比真实质量高一截"。
               老写法 `gap > 4 && trueR === 0` 把「(8−5)×3」这种平庸的长候选也涂红了 ——
               它代理分 5、压根没压过谁，而导览里写的是「红框那条是**专门来骗打分器的**」，
               两边对不上（「有缺陷+中」那档没钻空子成功，却也冒出一个红框）。
               改成:**真实质量为 0，而代理分压过了所有真有质量的候选** —— 那才叫钻空子。 */}
          <div className="bncands">
            {uniq.map((c, k) => {
              const bestReal = Math.max(0, ...uniq.filter(x => x.trueR > 0).map(x => x.reward))
              return (
                <div key={k} className={`bncand bon ${c.e === best?.e ? 'best' : ''} ${c.trueR === 0 && c.reward > bestReal ? 'bnhack' : ''}`}>
                  <span className="bnexpr">{c.e} = {c.v}</span>
                  <span className="bnbar">
                    <span className="bnbarfill" style={{ width: `${(c.reward / top) * 100}%` }} />
                    <span className="bnbartrue" style={{ width: `${(c.trueR / top) * 100}%` }} />
                  </span>
                  <span className="bnr">代理 {c.reward}<span className="dimv">　真实 {c.trueR}</span></span>
                  <span className="bnmark">{c.e === best?.e ? '★ 采纳' : ''}</span>
                </div>
              )
            })}
          </div>

          <div className="orcap">{rich(state.log)}</div>
        </div>

        {/*  ⭐ 整条 N 曲线 + 代价。Best-of-N 的代价是**线性**的：N 翻倍算力翻倍 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead">
              <span>N</span><span>代理分数</span><span>真实质量</span><span>算力（次生成+打分）</span><span></span>
            </div>
            {fullCurve.map(p => (
              <div className="qsrow" key={p.n}>
                <span>{p.n}{p.n === peakN && declineAfterPeak > 0 ? ' ◀顶' : ''}</span>
                <span className="good">{p.best}</span>
                <span className={p.trueBest === 0 ? 'bad' : 'dimv'}>{p.trueBest}</span>
                <span className="dimv">{p.n * 2} 次</span>
                <span />
              </div>
            ))}
            <div className="orcap">
              {declineAfterPeak > 0
                ? <>⚠️ 代理分数从 {fullCurve[0].best} 一路涨到 {fullCurve[fullCurve.length - 1].best}，
                  <b>算力也老老实实翻了 {maxN} 倍</b> —— 而<b className="bad">真实质量在 N={peakN} 之后掉了 {declineAfterPeak} 分</b>。
                  {/*  ⚠️ 别写成"这 64 次调用买回来一个更差的答案" —— 更差是**相对峰值那一档**说的，
                       得把两笔账并排摆出来，不然"更差"没有参照物。 */}
                  <b>N={peakN} 花 {peakN * 2} 次调用拿到 {fullCurve.find(p => p.n === peakN)!.trueBest} 分；
                  N={maxN} 花 {maxN * 2} 次调用只拿到 {fullCurve[fullCurve.length - 1].trueBest} 分。</b></>
                : <>N 翻倍，算力就翻倍（<b>线性</b>），而质量提升<b>越涨越慢</b>（近似 log N）。这就是"用算力换质量"的兑换率。</>}
            </div>
          </div>
        )}

        <p className="scnote">
          <b>Best-of-N（拒绝采样）</b>：生成一次质量参差，索性<b>多采 N 个、打分器给每个评分、argmax 取最高</b> —— 用算力换质量。
          <br />
          <b>而 argmax 认的是打分器给的分数，不是真实质量。</b>两者一旦分家，加算力就开始朝错的方向使劲：
          N 越大，越一定会撞上那条<b>专门讨好打分器</b>的候选。<b>这就是 Goodhart 定律</b>（"一个指标一旦成为目标，它就不再是个好指标"），
          在大模型这边叫 <b>reward hacking / 过优化</b> —— RLHF 里那条著名的曲线（KL 越大、奖励模型分越高、人类偏好反而下降）说的是同一件事。
          <br />
          还有一条常被忽略的前提：<b>Best-of-N 取的是"N 个样本里的最大值"，样本之间得真的不一样</b>。
          把「采样多样性」调到<b>低</b>那一档看看 —— 候选高度重复时，N 加了等于没加，算力全白花。
          <br />
          和自洽的<b>多数投票</b>不同：这里靠外部打分器选<b>单个最好</b>，适合开放式生成（没有"多数答案"可投），
          代价是<b>它只和打分器一样好</b>。
        </p>
      </div>
    </div>
  )
}
