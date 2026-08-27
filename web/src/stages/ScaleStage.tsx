/** 舞台：√d 缩放 —— 同一维度下「不缩放」vs「÷√d」两条 softmax，看不缩放怎么塌成 one-hot */
import type { ScaleState } from '@engine/kernels/scale.ts'
import type { StageProps } from '../types.ts'

const KEYS = ['k₀', 'k₁', 'k₂', 'k₃']

function Bars({ probs, hot }: { probs: number[]; hot?: boolean }) {
  return (
    <div className="scbars">
      {probs.map((p, k) => (
        <div className="scbar" key={k}>
          <span className="sctok">{KEYS[k]}</span>
          <span className="sctrack">
            <span className="scfill" style={{ width: `${Math.max(1, p * 100)}%`, background: hot && p > 0.9 ? 'var(--miss)' : hot ? 'var(--f-tag)' : 'var(--now)' }} />
          </span>
          <span className="scpct">{(p * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export function ScaleStage({ state }: StageProps<ScaleState>) {
  const { d, sqrtd, base, rawLogits, unscaled, scaled, variance, entU, entS, maxU, phase } = state
  const started = d > 0
  return (
    <div className="card">
      <h3>√d 缩放 <span className="hint">Q·K 方差随维度涨 → 不缩放 softmax 会饱和</span></h3>
      <div className="body">
        {/* 维度读数 */}
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? d : '—'}</span><span className="scdl">维度 d</span></div>
          <div className="scdk"><span className="scdn hot">{started ? variance : '—'}</span><span className="scdl">Q·K 方差 = d</span></div>
          <div className="scdk"><span className="scdn">{started ? sqrtd.toFixed(1) : '—'}</span><span className="scdl">标准差 √d</span></div>
        </div>

        {/* base（真实相似度） */}
        <div className="scbase">
          <span className="scblab">4 个 key 的真实相似度 base</span>
          <span className="scbval">[{base.map(b => b.toFixed(1)).join('，')}]</span>
          <span className="scbnote">← 理解成"缩放后本该有的 logit"</span>
        </div>

        {/* 两条 softmax 对比 */}
        <div className="sccmp">
          <div className="sccol bad">
            <div className="scch">不缩放 · softmax(base × √d)</div>
            {started ? <Bars probs={unscaled} hot /> : <div className="scempty">按「下一步」增大 d</div>}
            <div className="scmeta">
              原始 logit = [{started ? rawLogits.map(x => x.toFixed(1)).join('，') : '…'}]
              <br />熵 <b className={entU < 0.3 ? 'danger' : ''}>{started ? entU.toFixed(2) : '—'}</b> bit · 最大 <b className={maxU > 0.9 ? 'danger' : ''}>{started ? (maxU * 100).toFixed(1) + '%' : '—'}</b>
              {started && maxU > 0.9 && <span className="scwarn"> ← 塌成 one-hot，梯度要消失</span>}
            </div>
          </div>

          <div className="sccol good">
            <div className="scch">÷√d · softmax(base)</div>
            <Bars probs={scaled} />
            <div className="scmeta">
              logit = base（与 d 无关）
              <br />熵 <b>{entS.toFixed(2)}</b> bit · <b>恒定</b>，不随 d 变
            </div>
          </div>
        </div>

        {phase === 'done' && <p className="scnote">Q·K 是 <b>d 个 i.i.d. 乘积之和</b> → 方差累加 = d → 标准差 √d。d 一大，不缩放的 logit 差距被放大 √d 倍，softmax 塌成 one-hot（熵→0、梯度消失）。除以 <b>√d_k</b> 把方差永远拉回 1——这就是《Attention Is All You Need》那句"scale by 1/√d_k"的原因。不是玄学，是大数定理。</p>}
      </div>
    </div>
  )
}
