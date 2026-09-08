/** 舞台：归纳头 —— 回头找"上次当前 token 之后跟了什么"，复制出预测 */
import type { InductionState } from '@engine/kernels/induction.ts'
import type { StageProps } from '../types.ts'

export function InductionStage({ state }: StageProps<InductionState>) {
  const { seq, queryPos, cur, stage, matches, weights, prediction , dist, conf, ambiguous, noPrecedent, beta } = state
  const matchSet = new Set(matches)
  const showW = stage === 'attend' || stage === 'copy' || stage === 'done'
  const showPred = stage === 'copy' || stage === 'done'
  return (
    <div className="card">
      <h3>归纳头 <span className="hint">上下文学习：照着上文的样式继续</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{cur}</span><span className="scdl">当前 token</span></div>
          <div className="scdk"><span className="scdn">{matches.length ? matches.join(', ') : '—'}</span><span className="scdl">注意力落点</span></div>
          <div className="scdk"><span className={`scdn ${noPrecedent ? '' : 'hot'}`}>{showPred ? (prediction || '—') : '?'}</span>
            <span className="scdl">预测下一个{showPred && ambiguous ? `（把握 ${(conf * 100).toFixed(0)}%）` : ''}</span></div>
        </div>

        {/*  没有先例那一档：这条电路的**前提**不成立，得单独说 */}
        {noPrecedent && stage !== 'id' && (
          <div className="idcWarn">
            🚫 <b>「{cur}」在这段上下文里是第一次出现，一条先例都没有。</b>
            归纳头做的是"照着上次做"，没有上次，它<b>什么也做不了</b> ——
            这不是 bug，是这条电路的定义。所以少样本提示里那几个例子，作用就是<b>现场造出先例</b>。
          </div>
        )}

        {/* token 序列 */}
        <div className="idcwrap">
          <div className="idcrow">
            {seq.map((t, j) => (
              <div key={j} className="idccol">
                <div className={`idctok ${j === queryPos ? 'query' : ''} ${matchSet.has(j) && stage !== 'id' ? 'match' : ''} ${(stage === 'scan') && seq[j] === cur && j !== queryPos ? 'prevtok' : ''}`}>
                  {t}
                </div>
                <span className="idcpos">{j}</span>
                {showW && weights[j] > 0 && (
                  <div className="idcw"><div className="idcwfill" style={{ height: `${weights[j] * 100}%` }} /></div>
                )}
              </div>
            ))}
            {showPred && (
              <div className="idccol">
                <div className="idctok pred">{prediction}</div>
                <span className="idcpos">→</span>
              </div>
            )}
          </div>
          <div className="orcap">
            {stage === 'id' && <span>当前 token = <b>{cur}</b>（问它下一个是什么）</span>}
            {stage === 'scan' && (noPrecedent
              ? <span>找"前一个 token 是 <b>{cur}</b>"的位置 → <b>一个都没有</b></span>
              : <span>找"前一个 token 是 <b>{cur}</b>"的位置 → [{matches.join(', ')}]（就是"上次 {cur} 之后"）</span>)}
            {stage === 'attend' && !noPrecedent && <span>注意力 softmax(β={beta}) 落在 pos {matches.join('、')}</span>}
            {(stage === 'copy' || stage === 'done') && !noPrecedent && (ambiguous
              ? <span>先例给出的后继<b>不一样</b>，按票数加权 → {dist.map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join('、')}</span>
              : <span>那些位置的 token 都是 <b>{prediction}</b> → 复制成预测</span>)}
          </div>
        </div>

        {/*  预测分布：歧义那一档全靠它才说得清"复制"其实是投票 */}
        {showPred && dist.length > 0 && (
          <div className="idcdist">
            <span className="idcdt">预测分布（对所有先例投票，票数 = softmax 权重）</span>
            {dist.map(([k, v]) => (
              <span key={k} className={`idcdbar ${v === conf ? 'top' : ''}`}>
                <b>{k}</b><i style={{ width: `${Math.max(2, v * 100)}%` }} /><em>{(v * 100).toFixed(0)}%</em>
              </span>
            ))}
          </div>
        )}

        {stage === 'done'
          ? (noPrecedent
            ? <p className="scnote"><b>{seq.join(' ')} → ？</b> 当前 token 在上下文里<b>没有先例</b>，归纳头无从下手。
              　这不是 bug，是这条电路的定义：它做的是"上次见到这个 token 时，后面跟了什么"。
              　所以<b>上下文学习需要上下文里真有那个模式</b> —— 少样本提示里那几个例子，作用就是<b>现场造出先例</b>；
              没有先例时，预测只能靠模型权重里背下来的先验，那已经不是这条电路的事了。</p>
            : ambiguous
              ? <p className="scnote"><b>{seq.join(' ')} → {prediction}（{(conf * 100).toFixed(0)}%）</b>，
                另有 {dist.slice(1).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join('、')}。
                　这一档把"复制"这个说法<b>拆开了</b>：归纳头不是照搬某一处，而是<b>对所有先例做加权投票</b>，
                票数就是 softmax 权重。<b>答案是个分布，不是一个字。</b>
                　把 <b>β</b> 调大 → 只认最近那条先例（近乎硬复制）；调小 → 各条先例平摊（近乎平均）。
                <b>softmax 的温度在这条电路里的意思，就是"多信最近的那一次"。</b></p>
              : <p className="scnote"><b>{seq.join(' ')} → {prediction}</b>：归纳头回头找"上次 {cur} 之后是什么"，
                把 <b>{prediction}</b> 复制出来。它由"前一 token 头"+"归纳头"两个注意力头接力实现。
                {seq[0] === '♣'
                  ? <>　⚠️ 注意这一档用的是 <b>♣♠♦</b> 这种不可能在训练里出现的符号，<b>它照样答对了</b> ——
                    这不是背下来的，是<b>一条现场执行的规则</b>。"上下文学习"四个字的分量就在这里。</>
                  : <>　它没在训练里见过这个具体序列，纯靠<b>上下文里的模式</b>现学现用。
                    　换成<b>"没见过的符号"</b>那一档再看 —— 那才是"不是背下来的"的直接证据；
                    再换成<b>"有歧义"</b>那一档，会看到"复制"其实是一次<b>投票</b>。</>}</p>)
          : <p className="scnote" style={{ opacity: .85 }}>{stage === 'id' ? '归纳头的策略:上次见到当前 token 时,它后面跟了什么?把那个复制过来。' : stage === 'scan' ? '标出所有"前面是当前 token"的位置——注意力要落到这些"某次 token 之后"上。' : '注意力集中到匹配位置,它们后面的 token 就是要复制的答案。'}</p>}
      </div>
    </div>
  )
}
