/** 舞台：完整前向拼装 —— 输入序列 → 10 段流水 → 预测下一个 token；每段真实向量 */
import type { ForwardState } from '@engine/kernels/forward.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const STAGES = ['① 词嵌入', '② RMSNorm', '③ 自注意力', '④ 残差', '⑤ RMSNorm', '⑥ FFN', '⑦ 残差', '⑧ 末层 RMSNorm', '⑨ LM 头', '⑩ softmax→采样']

export function ForwardStage({ state }: StageProps<ForwardState>) {
  const { seq, vocab, stageIdx, stageName, stageLink, vec, attn, logits, probs, predicted, detail, phase } = state
  const done = phase === 'done'
  const bestIdx = probs ? probs.reduce((bi, p, i, a) => (p > a[bi] ? i : bi), 0) : -1
  return (
    <div className="card">
      <h3>完整前向拼装 <span className="hint">一次真实推理 · 把学过的零件串起来</span></h3>
      <div className="body">
        {/* 顶部：序列 → 预测 */}
        <div className="fwhdr">
          <div className="fwseq">{seq.map((t, k) => <span key={k} className="fwtok">{t}</span>)}</div>
          <span className="fwarrow">→</span>
          <span className={`fwpred ${done || predicted ? 'on' : ''}`}>{predicted ?? '？'}</span>
          {(done || predicted) && probs && <span className="fwprob">{Math.round(probs[bestIdx] * 100)}%</span>}
        </div>

        {/* 流水段进度 */}
        <div className="fwflow">
          {STAGES.map((nm, k) => (
            <span key={k} className={`fwstep ${k === stageIdx ? 'cur' : k < stageIdx || done ? 'done' : ''}`}>{nm}</span>
          ))}
        </div>

        {/* 当前段详情 */}
        <div className="fwdetail">
          <div className="fwdh">
            <span className="fwdn">{done ? '✓ 前向完成' : stageName}</span>
            {stageLink && stageLink !== '—' && <span className="fwlink">↳ {stageLink}</span>}
          </div>

          {/* 向量 */}
          {vec.length > 0 && (
            <div className="fwvec">
              <span className="fwvl">向量</span>
              {vec.map((v, k) => <span key={k} className="fwvc">{v.toFixed(2)}</span>)}
            </div>
          )}

          {/* 注意力权重 */}
          {attn && (
            <div className="fwsub">
              <span className="fwvl">注意力权重</span>
              {attn.map((w, k) => (
                <div key={k} className="fwbar"><span className="fwbl">看 {seq[k]}</span><div className="fwtrack"><div className="fwfill" style={{ width: `${w * 100}%` }}>{Math.round(w * 100)}%</div></div></div>
              ))}
            </div>
          )}

          {/* logits / 概率 */}
          {(logits || probs) && (
            <div className="fwsub">
              <span className="fwvl">{probs ? '词表概率' : 'logits（每个词的打分）'}</span>
              {vocab.map((t, k) => {
                const val = probs ? probs[k] : 0
                const lg = logits ? logits[k] : 0
                return (
                  <div key={k} className={`fwbar ${k === bestIdx && probs ? 'win' : ''}`}>
                    <span className="fwbl">{t}</span>
                    <div className="fwtrack">
                      {probs
                        ? <div className="fwfill p" style={{ width: `${val * 100}%` }}>{Math.round(val * 100)}%</div>
                        : <div className="fwfill l" style={{ width: `${Math.max(4, (lg + 1) / 3 * 100)}%` }}>{lg.toFixed(2)}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {detail && !done && <p className="fwtext">{detail}</p>}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
