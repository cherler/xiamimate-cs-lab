/** 舞台：交叉熵/困惑度 —— 逐词预测，惊讶度 −log₂p(真词) 累成交叉熵，换算困惑度(1..V) */
import type { XentState } from '@engine/kernels/xent.ts'
import type { StageProps } from '../types.ts'

export function XentStage({ state }: StageProps<XentState>) {
  const { vocab, V, trueIdx, trueWord, dist, pTrue, surprise, ce, perplexity, ppUniform, phase } = state
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
          ? <p className="scnote">整句平均交叉熵 <b>{ce.toFixed(2)}</b> bit/词——这就是语言模型的<b>训练损失</b>；困惑度 = 2^{ce.toFixed(2)} = <b>{perplexity.toFixed(2)}</b>，即模型平均只在约 <b>{perplexity.toFixed(1)}</b> 个等概率词之间犹豫。完美预测困惑度=1、瞎猜=V={ppUniform}。真词概率越高→惊讶度越低→交叉熵越小→困惑度越接近 1。所以<b>「降交叉熵损失」和「降困惑度」是同一件事</b>，这也是困惑度成为语言模型最常用评测指标的原因。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>真词概率越高，这一步的惊讶度 −log₂p 越低；把每词惊讶度一平均就是交叉熵，2^交叉熵 就是困惑度。看那个 ▲ 在「1(笃定)…{ppUniform}(瞎猜)」之间的位置。</p>}
      </div>
    </div>
  )
}
