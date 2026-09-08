/** 舞台：交叉熵/困惑度 —— 逐词预测，惊讶度 −log₂p(真词) 累成交叉熵，换算困惑度(1..V) */
import type { XentState } from '@engine/kernels/xent.ts'
import type { StageProps } from '../types.ts'

export function XentStage({ state }: StageProps<XentState>) {
  const { vocab, V, trueIdx, trueWord, dist, pTrue, surprise, ce, perplexity, ppUniform, phase,
    betterThanChance, quality, doomTag, doomAt, doomBits, ceNoDoom, pplNoDoom, step } = state
  const isDoom = step === doomAt
  const hasDoom = doomAt >= 0
  const started = trueIdx >= 0
  const maxP = Math.max(0.2, ...dist)
  // 困惑度在 [1, V] 上的位置
  const ppPos = started ? Math.max(0, Math.min(1, (perplexity - 1) / (ppUniform - 1))) * 100 : 0
  return (
    <div className="card">
      <h3>交叉熵 · 困惑度 <span className="hint">训练损失和评测指标到底在量什么</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? `${(pTrue * 100).toFixed(0)}%` : '—'}</span><span className="scdl">给真词的概率</span></div>
          <div className="scdk"><span className="scdn">{started ? `${surprise.toFixed(2)}` : '—'}</span><span className="scdl">惊讶度 −log₂p (bit)</span></div>
          <div className="scdk"><span className="scdn">{started ? `${ce.toFixed(2)}` : '—'}</span><span className="scdl">平均交叉熵 (bit/词)</span></div>
          <div className="scdk"><span className="scdn hot">{started ? perplexity.toFixed(2) : '—'}</span><span className="scdl">困惑度 2^CE</span></div>
          {/*  这一栏才是跨词表可比的那个数 —— PPL 本身不可比 */}
          <div className="scdk"><span className={`scdn ${started && betterThanChance <= 1 ? '' : 'hot'}`}>
            {started ? `${betterThanChance}×` : '—'}</span>
            <span className="scdl">比瞎猜强（{ppUniform} ÷ PPL）</span></div>
        </div>

        {/* 预测分布：8 个词的概率，真词高亮 */}
        <div className="xewrap">
          <div className="xebars">
            {vocab.map((w, k) => (
              <div key={k} className="xecol">
                <div className="xebartrack">
                  <div className={`xebar ${k === trueIdx ? 'true' : ''}`} style={{ height: `${(dist[k] / maxP) * 100}%` }} />
                </div>
                <span className={`xelab ${k === trueIdx ? 'true' : ''}`}>{w}</span>
              </div>
            ))}
          </div>
          <div className="orcap">
            {started ? `模型对下一个词的预测分布；真词「${trueWord}」拿了 ${(pTrue * 100).toFixed(0)}%，惊讶度 = −log₂${pTrue} = ${surprise.toFixed(2)} bit`
              : '按「下一步」逐词预测 "the cat sat on the mat"'}
          </div>
        </div>

        {/* 困惑度刻度尺 1..V */}
        <div className="xeppwrap">
          <span className="xeppend">1<br /><i>毫不犹豫</i></span>
          <div className="xepptrack">
            {started && <span className="xeppmark" style={{ left: `${ppPos}%` }} title={`困惑度 ${perplexity.toFixed(2)}`}>▲<em>{perplexity.toFixed(2)}</em></span>}
          </div>
          <span className="xeppend r">{ppUniform}<br /><i>瞎猜</i></span>
        </div>

        {phase === 'done'
          ? <p className="scnote">整句平均交叉熵 <b>{ce.toFixed(2)}</b> bit/词 —— 这就是语言模型的<b>训练损失</b>；
            困惑度 = 2^{ce.toFixed(2)} = <b>{perplexity.toFixed(2)}</b>，即模型平均在约 {perplexity.toFixed(1)} 个等概率词之间犹豫。
            {quality.startsWith('瞎猜')
              ? <>　这一档是<b>瞎猜</b>（每个词都给 1/V），困惑度<b>正好等于词表大小 {ppUniform}</b> —— 这就是它的<b>天花板</b>。
                　所以"我的模型 PPL=20"这句话<b>单独拿出来没有意义</b>：V=8 时 20 比瞎猜还差，V=50257 时却是比瞎猜强 2500 倍。
                <b>该比的是"比瞎猜强几倍"，不是 PPL 本身。</b></>
              : hasDoom
                ? <>　⚠️ 但这个数被<b>一个词绑架了</b>：第 {doomAt + 1} 个词的概率只有 {pTrue.toExponential(0)}，
                  它一个人贡献 <b>{doomBits.toFixed(1)} bit</b>，把六个词的平均抬高了 {(ce - ceNoDoom).toFixed(2)} bit ——
                  困惑度从 {pplNoDoom.toFixed(2)} 涨到 <b>{perplexity.toFixed(2)}</b>（×{(perplexity / pplNoDoom).toFixed(1)}）。
                  　原因在定义里：交叉熵是 −log p 的<b>平均</b>，而 −log 在 p→0 时<b>无界</b>。
                  <b>一个"绝不可能"的判断，代价是无穷大。</b>
                  　这就是模型极少给出 0 概率、以及要做<b>标签平滑</b>的原因 —— 给每个词留一点点概率，是在给自己买保险。</>
                : <>　跟瞎猜比：瞎猜是 {ppUniform}，这个模型是 {perplexity.toFixed(2)} —— <b>强 {betterThanChance} 倍</b>。
                  　⚠️ 记住 PPL 的天花板就是词表大小：<b>换个词表，同一个模型看起来就完全不同</b>
                  （这一档换 V，PPL 一动不动，而"比瞎猜强"会差好几个数量级）。
                  <b>跨词表比 PPL 是没有意义的，要比就比这个倍数。</b>
                  　再把「有没有被判死刑的词」拧开看看。</>}</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>
            真词概率越高，这一步的惊讶度 −log₂p 越低；把每词惊讶度一平均就是交叉熵，2^交叉熵 就是困惑度。
            看那个 ▲ 在「1(笃定)…{ppUniform}(瞎猜)」之间的位置。
            {isDoom && <>　⚠️ <b>这一步就是那个被判"几乎不可能"的词</b>：它一个人贡献 {surprise.toFixed(1)} bit，
              盯住 ▲ 怎么被它一把拽过去。</>}</p>}
      </div>
    </div>
  )
}
