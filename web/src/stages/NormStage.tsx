/** 舞台：归一化 —— 样本×特征表，BatchNorm 沿样本轴(列)、LayerNorm 沿特征轴(行)，(x−μ)/σ */
import type { NormState } from '@engine/kernels/norm.ts'
import type { StageProps } from '../types.ts'

export function NormStage({ state }: StageProps<NormState>) {
  const { mat, kindName, axis, out, slice, vals, mu, sigma, phase } = state
  const done = phase === 'done'
  const isBatch = axis === 'col'
  const started = slice >= 0
  const inSlice = (r: number, c: number) => started && !done && (isBatch ? c === slice : r === slice)
  const cell = (v: number | null, r: number, c: number, isOut: boolean) => (
    <div key={`${isOut ? 'o' : 'i'}${r}-${c}`} className={`nmcell ${inSlice(r, c) ? 'slice' : ''} ${isOut && v !== null ? 'filled' : ''}`}>
      {v === null ? '' : v}
    </div>
  )
  return (
    <div className="card">
      <h3>归一化 BatchNorm / LayerNorm <span className="hint">把一批激活拉成零均值单位方差——差别只在沿哪条轴</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{kindName}</span><span className="scdl">沿{isBatch ? '样本轴(列)' : '特征轴(行)'}</span></div>
          <div className="scdk"><span className="scdn">{started && !done ? mu : '—'}</span><span className="scdl">本片均值 μ</span></div>
          <div className="scdk"><span className="scdn">{started && !done ? sigma : '—'}</span><span className="scdl">本片标准差 σ</span></div>
        </div>

        <div className="nmwrap">
          <div className="nmside">
            <div className="nmcap">输入激活（4 样本 × 3 特征）{isBatch ? '　沿 ↓ 归一化' : '　沿 → 归一化'}</div>
            <div className="nmgridwrap">
              <div className="nmcolh"><span></span><span>f1</span><span>f2</span><span>f3</span></div>
              {mat.map((row, r) => (
                <div key={r} className="nmrow">
                  <span className="nmrowh">s{r + 1}</span>
                  {row.map((v, c) => cell(v, r, c, false))}
                </div>
              ))}
            </div>
          </div>

          <div className="nmarrow">→</div>

          <div className="nmside">
            <div className="nmcap">归一化输出（零均值、单位方差）</div>
            <div className="nmgridwrap">
              <div className="nmcolh"><span></span><span>f1</span><span>f2</span><span>f3</span></div>
              {out.map((row, r) => (
                <div key={r} className="nmrow">
                  <span className="nmrowh">s{r + 1}</span>
                  {row.map((v, c) => cell(v, r, c, true))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="orcap">
          {!started ? `按「下一步」开始:${isBatch ? '批归一化沿"样本"轴,给每个特征(列)归一化' : '层归一化沿"特征"轴,给每个样本(行)归一化'}`
            : done ? `${kindName}完成:每${isBatch ? '个特征(列)' : '个样本(行)'}都被拉成零均值、单位方差`
              : `${isBatch ? `特征 f${slice + 1}(列)` : `样本 s${slice + 1}(行)`} [${vals.join(',')}]:μ=${mu}、σ=${sigma} → (x−μ)/σ`}
        </div>

        {done
          ? <p className="scnote">归一化把激活<b>拉回零均值、单位方差</b>(x̂=(x−μ)/√(σ²+ε)),再乘可学 γ、加 β,让深层网络更好训练、收敛更快。核心分歧在<b>沿哪条轴统计 μ、σ</b>:<b>BatchNorm</b> 对每个特征、在一个 batch 的所有样本上算(依赖 batch,训练/推理不同、小 batch 不稳,多见于 CNN);<b>LayerNorm</b> 对每个样本、在它自己所有特征上算(不依赖 batch、对序列稳,是 Transformer/RNN 的标配;RMSNorm 是它省掉减均值的简化)。切上面的参数看另一种——一眼看清"谁沿谁的轴"。</p>
          : <p className="scnote" style={{ opacity: .85 }}>左=输入(4 样本×3 特征),琥珀=当前归一化的<b>{isBatch ? '一列(一个特征跨所有样本)' : '一行(一个样本跨所有特征)'}</b>;右=输出。对每片算 μ、σ,再 (x−μ)/σ 拉成零均值单位方差。<b>BatchNorm 沿列、LayerNorm 沿行</b>——同一个公式,只是统计的轴不同。改上面参数立即重跑。</p>}
      </div>
    </div>
  )
}
