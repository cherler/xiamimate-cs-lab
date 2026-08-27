/** 舞台：大数定理 / 蒙特卡洛 —— 每个 n 跑多次独立试验，RMS 误差按 1/√n 缩、×√n≈1.64 恒定 */
import type { LlnState } from '@engine/kernels/lln.ts'
import type { StageProps } from '../types.ts'

export function LlnStage({ state }: StageProps<LlnState>) {
  const { n, trials, estimate, meanEst, rmsError, rmsErrSqrtN, inside, points, phase } = state
  const started = n > 0
  return (
    <div className="card">
      <h3>大数定理 · 蒙特卡洛 <span className="hint">撒点估 π：点越多越准，误差 ∝ 1/√n</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? n : '—'}</span><span className="scdl">撒点数 n</span></div>
          <div className="scdk"><span className="scdn">{started ? meanEst.toFixed(3) : '—'}</span><span className="scdl">均值估计（{trials}次）</span></div>
          <div className="scdk"><span className="scdn hot">{started ? rmsError.toFixed(3) : '—'}</span><span className="scdl">RMS 误差</span></div>
          <div className="scdk"><span className="scdn">{started ? rmsErrSqrtN.toFixed(2) : '—'}</span><span className="scdl">RMS误差×√n</span></div>
        </div>

        {/* 散点图：单位正方形 + 1/4 圆弧（第 0 次试验） */}
        <div className="llnwrap">
          <svg className="llnplot" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <path d="M 100 100 L 0 100 L 0 0 A 100 100 0 0 1 100 100 Z" className="llnarc-out" />
            <path d="M 0 100 L 0 0 A 100 100 0 0 1 100 100 Z" className="llnarc-in" />
            <path d="M 0 0 A 100 100 0 0 1 100 100" className="llnarc-line" />
            {/* 点：y 轴翻转（SVG y 向下） */}
            {points.map((p, k) => (
              <circle key={k} cx={p.x * 100} cy={(1 - p.y) * 100} r={1.1} className={p.in ? 'llnpt in' : 'llnpt out'} />
            ))}
          </svg>
          <div className="orcap">
            {started
              ? `散点=第 0 次试验：落进 1/4 圆 ${inside}/${n} → π≈${estimate.toFixed(3)}${points.length < n ? `（抽样展示 ${points.length} 点）` : ''}`
              : '按「下一步」增大撒点数 n'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">从 50 点到 12800 点、每个 n 跑 {trials} 次独立试验：均值估计始终 ≈<b>3.14159</b>（无偏），RMS 误差一路变小。关键看 <b>RMS误差×√n ≈ 1.64 恒定</b>（理论值 4·√(p(1−p))，p=π/4）——这就是"误差 ∝ 1/√n"：样本翻 4 倍、误差才减半。<b>大数定理 + 方差可加</b>的直接体现，也是采样、蒙特卡洛、dropout、MoE 路由"多次平均就稳"的底。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>单条随机路径太吵，所以每个 n 跑 {trials} 次独立试验取 RMS 误差。继续加点：RMS 误差按 1/√n 缩、×√n 却基本不变——那个常数(≈1.64)就是 1/√n 定律。</p>}
      </div>
    </div>
  )
}
