/** 舞台：大数定理 / 蒙特卡洛 —— 每个 n 跑多次独立试验，RMS 误差按 1/√n 缩、×√n≈1.64 恒定 */
import type { LlnState } from '@engine/kernels/lln.ts'
import type { StageProps } from '../types.ts'

export function LlnStage({ state }: StageProps<LlnState>) {
  const { n, trials, estimate, meanEst, rmsError, rmsErrSqrtN, inside, points, phase , target, hasMean, ratioCurve } = state
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

        {/*  ── ×√n 曲线（2026-09-08 加）──
             这一屏的结论全压在"×√n 是不是常数"上，而原来它只是读数栏里一个数字，
             看不出"恒定"还是"在涨"。画成曲线，柯西那一档一眼就翻脸。 */}
        <div className="mlwrap">
          <p className="gbsec"><b>RMS 误差 × √n</b>
            <span>{hasMean ? '期望存在 → 这条线应该是平的（误差 ∝ 1/√n）' : '柯西没有期望 → 这条线会一路往上，大数定理在这儿不成立'}</span></p>
          <svg className="llncurve" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(() => {
              const cv = ratioCurve
              const hi = Math.max(...cv.map(c => c[1])) * 1.1 || 1
              const X = (i: number) => (cv.length < 2 ? 0 : i / (cv.length - 1) * 100)
              const Y = (v: number) => 100 - v / hi * 88 - 6
              return <>
                <path d={cv.map(([, v], i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}
                  className={hasMean ? 'llnline' : 'llnline bad'} fill="none" vectorEffect="non-scaling-stroke" />
                {cv.map(([nn, v], i) => (
                  <circle key={nn} cx={X(i)} cy={Y(v)} r={nn === n ? 2.4 : 1.2}
                    className={nn === n ? 'llnnow' : 'llndot'} />
                ))}
              </>
            })()}
          </svg>
          <div className="orcap">{ratioCurve.map(([nn, v]) => `n=${nn}:${v}`).join('　')}</div>
        </div>

        {phase === 'done'
          ? (hasMean
            ? <p className="scnote">从 50 个样本到 12800 个、每个 n 跑 {trials} 次独立试验：均值估计始终 ≈真值（无偏），
              RMS 误差一路变小。关键看 <b>RMS×√n 基本恒定</b>（{ratioCurve[0][1]} → {ratioCurve[ratioCurve.length - 1][1]}）——
              这就是"误差 ∝ 1/√n"：样本翻 4 倍、误差才减半。<b>大数定理 + 方差可加</b>的直接体现，
              也是采样、蒙特卡洛、dropout、MoE 路由"多次平均就稳"的底。
              　<b>但它有前提</b>：样本的期望得存在。把「在估什么」换成<b>柯西均值</b>试试 —— 上面那条线会当场翻脸。</p>
            : <p className="scnote">从 50 个样本到 12800 个：<b>均值根本没有收敛</b>。
              RMS×√n 从 {ratioCurve[0][1]} 涨到 {ratioCurve[ratioCurve.length - 1][1]}，完全不是常数 ——
              <b>大数定理在这里不成立</b>。原因：柯西分布的尾巴重到<b>期望的积分发散</b>，
              它压根没有"平均值"这个东西可以收敛；而且 n 个柯西样本的均值<b>仍然是同一个柯西分布</b>、
              不随 n 变窄，采一百万个也照样在跳。
              　这就是为什么"多采样就准"是一条<b>有条件</b>的定理，而不是一句口号。</p>)
          : started && <p className="scnote" style={{ opacity: .85 }}>单条随机路径太吵，所以每个 n 跑 {trials} 次独立试验取 RMS 误差。
            继续加点，盯住上面那条 ×√n 的线：{hasMean ? '它应该是平的 —— 平就意味着误差按 1/√n 缩。' : '它在往上走 —— 这一档（柯西）没有期望，定理不适用。'}</p>}
      </div>
    </div>
  )
}
