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
  const { d, sqrtd, base, rawLogits, unscaled, scaled, variance, varTheory,
    entU, entS, maxU, jac, jacRef, mode, divisor, phase } = state
  const started = d > 0
  return (
    <div className="card">
      <h3>√d 缩放 <span className="hint">Q·K 方差随维度涨 → 不缩放 softmax 会饱和</span></h3>
      <div className="body">
        {/* 维度读数 */}
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? d : '—'}</span><span className="scdl">维度 d</span></div>
          {/*  实测方差 vs 理论 —— 这个实验的第一条腿：定理是**量出来**的，不是写进去的 */}
          <div className="scdk"><span className="scdn hot">{started ? variance : '—'}</span>
            <span className="scdl">Q·K 方差（实测 / 理论 {started ? varTheory : '—'}）</span></div>
          {/*  第二条腿：梯度。老版本只在文字里说"梯度要消失"，屏幕上没有这个数 */}
          <div className="scdk"><span className={`scdn ${started && jac < 0.05 ? '' : 'hot'}`}>{started ? jac : '—'}</span>
            <span className="scdl">梯度（softmax 雅可比）</span></div>
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
              <br />熵 <b className={entU < 0.3 ? 'danger' : ''}>{started ? entU.toFixed(2) : '—'}</b> bit · 最大 <b className={maxU > 0.9 || maxU < 0.32 ? 'danger' : ''}>{started ? (maxU * 100).toFixed(1) + '%' : '—'}</b>
              {' '}· 梯度 <b className={started && jac < 0.05 ? 'danger' : ''}>{started ? jac : '—'}</b>
              {started && maxU > 0.9 && <span className="scwarn"> ← 塌成 one-hot：有选择性，但梯度只剩 {jac}</span>}
              {started && maxU < 0.32 && <span className="scwarn"> ← 摊成均匀：有梯度，但分不出哪个 key 更相关</span>}
            </div>
          </div>

          <div className="sccol good">
            <div className="scch">÷√d · softmax(base)</div>
            <Bars probs={scaled} />
            <div className="scmeta">
              logit = base（与 d 无关）
              <br />熵 <b>{entS.toFixed(2)}</b> bit · 梯度 <b>{jacRef}</b> · <b>恒定</b>，不随 d 变
            </div>
          </div>
        </div>

        {phase === 'done' && (
          <p className="scnote">Q·K 是 <b>d 个 i.i.d. 乘积之和</b> → 方差累加 = d → 标准差 √d。
            实测方差从 {'{'}4→1024{'}'} 一路对上（这一屏的方差是<b>抽 200 对随机向量数出来的</b>，不是写进去的）。
            {mode === '不缩放'
              ? <>　<b>不缩放</b>：d=1024 时最大概率 {(maxU * 100).toFixed(1)}%、熵 {entU.toFixed(2)} bit，
                <b>梯度只剩 {jac}</b>（÷√d 那档是 {jacRef}）。
                　softmax 一饱和，它的雅可比 ∂p_i/∂z_j = p_i(δ_ij−p_j) 就整个塌向 0 ——
                <b>这跟 sigmoid 饱和之后 tanh′→0 是同一件事</b>，跟「反向传播」「RNN」说的是同一个机制。
                　把「缩放」拨到 ÷√d 看看。</>
              : mode.startsWith('÷√d')
                ? <>　<b>÷√d</b> 把标准差永远拉回 1：熵稳在 {entU.toFixed(2)} bit、梯度稳在 <b>{jac}</b>，
                  <b>完全不随 d 变</b>。这就是《Attention Is All You Need》那句"scale by 1/√d_k"的全部理由 ——
                  不是玄学，是"d 个 i.i.d. 项相加、方差累加"的必然。
                  　两边的失败都试一遍才完整：<b>不缩放</b> → 塌成 one-hot（有选择性但没梯度）；
                  <b>÷d</b> → 摊成均匀（有梯度但没选择性）。</>
                : <>　<b>÷d（缩过头）</b>：分母比该用的大了 √d 倍，softmax 几乎<b>均匀</b>
                  （最大概率 {(maxU * 100).toFixed(1)}%≈1/4、熵 {entU.toFixed(2)} bit 已经到顶）。
                  　这一档<b>有梯度</b>（{jac}）却<b>没有选择性</b> —— 注意力等于没在注意。
                  　两种失败正好是一对：不缩放<b>没梯度</b>、÷d <b>没选择性</b>，只有 ÷√d 两头都要。</>}
          </p>
        )}
      </div>
    </div>
  )
}
