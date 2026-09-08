/** 舞台：贝叶斯定理 —— 连续阳性，患病信念一步步更新；真阳/误报的比例=后验 */
import type { BayesState } from '@engine/kernels/bayes.ts'
import type { StageProps } from '../types.ts'

export function BayesStage({ trace, index, state }: StageProps<BayesState>) {
  const { nTests, prior, sens, fpr, num, denFalse, posterior, phase } = state
  const started = nTests > 0
  //  上一帧的后验 —— 「后验变先验」这句话得能在屏幕上对上号，不能只是嘴上说
  const prev = index > 0 ? trace[index - 1] : null
  const carried = !!prev && prev.nTests > 0 && prev.posterior === prior
  const pctOf = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 2 : 1)}%`
  //  这一串是**现算的**，不是写死的：参数一改（患病率/灵敏度/误报率都能调）它就跟着变
  const chain = [trace.find(t => t.nTests === 1)?.prior ?? prior,
    ...trace.filter(t => t.phase === 'run').map(t => t.posterior)]
  const total = num + denFalse
  const truePct = total > 0 ? (num / total) * 100 : 0
  return (
    <div className="card">
      <h3>贝叶斯定理 <span className="hint">证据来了，患病信念怎么更新</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? nTests : 0}</span><span className="scdl">已看阳性次数</span></div>
          <div className="scdk"><span className="scdn">{started ? pctOf(prior) : pctOf(prior)}</span>
            <span className="scdl">{carried ? '先验 ＝ 上次的后验' : '先验（本次前）'}</span></div>
          <div className="scdk"><span className="scdn hot">{started ? pctOf(posterior) : '—'}</span><span className="scdl">后验（本次后）</span></div>
        </div>

        {/* 患病信念大刻度尺 0..100% */}
        <div className="bymeter">
          <div className="bytrack">
            {started && <div className="byfill" style={{ width: `${posterior * 100}%` }} />}
            {started && <span className="bypriormark" style={{ left: `${prior * 100}%` }} title="先验">先验</span>}
          </div>
          <div className="bylabels"><span>0%</span><span>P(患病)</span><span>100%</span></div>
        </div>

        {/* 本次阳性的贝叶斯拆分：真阳 vs 误报 */}
        {started && (
          <div className="bysplit">
            <div className="bysplitbar">
              <div className="byseg true" style={{ width: `${truePct}%` }}>{truePct > 12 ? '真阳' : ''}</div>
              <div className="byseg false" style={{ width: `${100 - truePct}%` }}>{100 - truePct > 12 ? '误报' : ''}</div>
            </div>
            <div className="orcap">
              后验 = 真阳 / (真阳+误报) = {num.toFixed(3)} / ({num.toFixed(3)}+{denFalse.toFixed(3)}) = <b>{pctOf(posterior)}</b>
              {nTests === 1 && <span>　←　误报那截太大，把真阳淹了</span>}
            </div>
          </div>
        )}

        {phase === 'done'
          ? <p className="scnote">连续 {nTests} 次阳性，患病概率 {chain.map(pctOf).join(' → ')}。两个要点:① <b>单次阳性≠患病</b>(只 {pctOf(chain[1] ?? posterior)})——贝叶斯把 {pctOf(chain[0])} 的基础率也算了进去,这是直觉最爱翻车处(基础率谬误);② <b>把上次后验当这次先验</b>,证据能连续更新逼近确诊。这就是"信念随证据更新":<b>后验 ∝ 先验 × 似然</b>,也是朴素贝叶斯、卡尔曼滤波、乃至模型在上下文里不断修正判断的底层逻辑。<br /><span style={{ opacity: .8 }}>这三个概率是<b>构造出来的教学例子</b>（不是某次真实筛查的统计），左边可以随便改 —— 把患病率拧到 50%，同一个检测，一次阳性的含义立刻不一样。</span></p>
          : started && <p className="scnote" style={{ opacity: .85 }}>{nTests === 1
            ? `看那条「真阳|误报」拆分:先验只 ${pctOf(prior)},真阳那截很小、误报那截巨大,所以单次阳性后验才 ${pctOf(posterior)}。`
            : carried
              ? `上一步的后验 ${pctOf(prev!.posterior)} 原封不动成了这一步的先验 ${pctOf(prior)}（同一个数）;再来一次阳性,信念继续往右爬。`
              : '上次的后验成了这次的先验;再来一次阳性,信念继续往右爬。'}</p>}
      </div>
    </div>
  )
}
