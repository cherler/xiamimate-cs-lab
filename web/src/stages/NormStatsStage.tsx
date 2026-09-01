/** 舞台：LeRobot 数据集归一化 —— 原始特征+统计量 / MEAN_STD / MIN_MAX 三视图逐步现算，末步演示反归一化 */
import { type ReactNode } from 'react'
import type { NSState, Col } from '@engine/kernels/normstats.ts'
import type { StageProps } from '../types.ts'

function NormTable({ title, field, cols, hot, note }: { title: ReactNode; field: 'ms' | 'mm'; cols: Col[]; hot: boolean; note?: string }) {
  return (
    <div className={`ns-tbl${hot ? ' ns-hot' : ''}`}>
      <div className="ns-th">{title}{hot && <em className="ns-badge">当前策略用这个</em>}</div>
      <div className="ns-wrap">
        <table className="ns-table">
          <tbody>
            {cols.map((c, r) => (
              <tr key={r} className={field === 'mm' && c.name === '力矩τ' ? 'ns-outlier' : ''}>
                <td className="ns-feat">{c.name}</td>
                {c[field].map((v, k) => (
                  <td key={k} className={Math.abs(v) >= 0.999 ? 'ns-edge' : ''}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <div className="ns-note">{note}</div>}
    </div>
  )
}

export function NormStatsStage({ state }: StageProps<NSState>) {
  const { policy, mode, cols, showStats, showMS, showMM, showUnnorm, unnormFeat, policyOut, unnormVal, forgotVal } = state

  return (
    <div className="card">
      <h3>数据集归一化 <span className="hint">用整套数据集的统计量把每个特征拉到同一量级，两端各一次</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{policy}</span><span className="scdl">策略</span></div>
          <div className="scdk"><span className="scdn">{mode === 'MEAN_STD' ? '均值方差' : '最小最大'}</span><span className="scdl">归一化模式</span></div>
          <div className="scdk"><span className="scdn">{cols.length}<em className="cc-u"> 特征</em></span><span className="scdl">各存 μ/σ/min/max</span></div>
        </div>

        {/* 原始特征 + 统计量 */}
        <div className="ns-tbl">
          <div className="ns-th">原始特征（6 个样本）{showStats && <em className="ns-badge on">＋全数据集统计量</em>}</div>
          <div className="ns-wrap">
            <table className="ns-table">
              <thead>
                <tr>
                  <th className="ns-feat l">特征</th>
                  {cols[0]!.vals.map((_, k) => <th key={k}>#{k}</th>)}
                  <th className={showStats ? 'ns-stat' : 'off'}>μ</th>
                  <th className={showStats ? 'ns-stat' : 'off'}>σ</th>
                  <th className={showStats ? 'ns-stat' : 'off'}>min</th>
                  <th className={showStats ? 'ns-stat' : 'off'}>max</th>
                </tr>
              </thead>
              <tbody>
                {cols.map((c, r) => (
                  <tr key={r}>
                    <td className="ns-feat l">{c.name}<em className="ns-u"> {c.unit}</em></td>
                    {c.vals.map((v, k) => <td key={k} className={c.name === '力矩τ' && v >= 3 ? 'ns-out' : ''}>{v}</td>)}
                    <td className={showStats ? 'ns-stat' : 'off'}>{showStats ? c.mean : '—'}</td>
                    <td className={showStats ? 'ns-stat' : 'off'}>{showStats ? c.std : '—'}</td>
                    <td className={showStats ? 'ns-stat' : 'off'}>{showStats ? c.min : '—'}</td>
                    <td className={showStats ? 'ns-stat' : 'off'}>{showStats ? c.max : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showStats && <div className="ns-note">σ = √(E[x²] − μ²)，一遍聚合；统计量在<b>整套数据集</b>上算一次存进 meta/stats → 归一化是固定、可逆的仿射变换（不像 BatchNorm 每批现算）。</div>}
        </div>

        {showMS && <NormTable title={<>MEAN_STD：x′ =(x−μ)/(σ+eps) → 均值~0、单位尺度</>} field="ms" cols={cols} hot={mode === 'MEAN_STD'}
          note="θ 均值恰为 0 → 就是除以 σ、符号不变；对无界的关节角/力矩自然，离群也相对稳。" />}

        {showMM && <NormTable title={<>MIN_MAX：x′ =2(x−min)/(max−min)−1 → 固定落 [-1,1]</>} field="mm" cols={cols} hot={mode === 'MIN_MAX'}
          note={`Diffusion 用（加噪 schedule 假设 [-1,1]）。看力矩τ 那行：离群 3.0→+1，正常样本 0.10~0.30 全被挤到 ${cols[2]!.mm[0]}~${cols[2]!.mm[3]}（紧贴 -1、彼此难分）——这就是 MIN_MAX 的离群敏感。`} />}

        {showUnnorm && (
          <div className="ns-unnorm">
            <div className="ns-uh">④ 反归一化：策略输出的是<b>归一化动作</b>，要用同一套统计量还原</div>
            <div className="ns-urow">
              <span className="ns-ok">策略输出 {policyOut}（归一化）<i>→ 反归一化 →</i> 真实 {unnormFeat} = <b>{unnormVal}</b></span>
              <span className="ns-bad">忘了反归一化：直接发 {forgotVal} → 差 {Math.round((unnormVal - forgotVal) * 100) / 100}（动作幅度全错的静默 bug）</span>
            </div>
          </div>
        )}

        <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>
      </div>
    </div>
  )
}
