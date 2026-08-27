/** 舞台：归纳头 —— 回头找"上次当前 token 之后跟了什么"，复制出预测 */
import type { InductionState } from '@engine/kernels/induction.ts'
import type { StageProps } from '../types.ts'

export function InductionStage({ state }: StageProps<InductionState>) {
  const { seq, queryPos, cur, stage, matches, weights, prediction } = state
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
          <div className="scdk"><span className="scdn hot">{showPred ? prediction : '?'}</span><span className="scdl">预测下一个</span></div>
        </div>

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
            {stage === 'scan' && <span>找"前一个 token 是 <b>{cur}</b>"的位置 → [{matches.join(', ')}]（就是"上次 {cur} 之后"）</span>}
            {stage === 'attend' && <span>注意力 softmax 落在 pos {matches.join('、')}（上次 {cur} 之后的 token）</span>}
            {(stage === 'copy' || stage === 'done') && <span>那些位置的 token 都是 <b>{prediction}</b> → 复制成预测</span>}
          </div>
        </div>

        {stage === 'done'
          ? <p className="scnote"><b>A B C A B C A → {prediction}</b>：归纳头回头找"上次 {cur} 之后是什么"，把 <b>{prediction}</b> 复制出来。它没在训练里见过这个具体序列，纯靠<b>上下文里的模式</b>现学现用——这就是<b>上下文学习(in-context learning)</b>的核心电路，也是大模型能"照着上文样式继续""看几个例子就照做(few-shot)"的底层机制之一。它由"前一 token 头"+"归纳头"两个注意力头接力实现。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{stage === 'id' ? '归纳头的策略:上次见到当前 token 时,它后面跟了什么?把那个复制过来。' : stage === 'scan' ? '标出所有"前面是当前 token"的位置——注意力要落到这些"某次 token 之后"上。' : '注意力集中到匹配位置,它们后面的 token 就是要复制的答案。'}</p>}
      </div>
    </div>
  )
}
