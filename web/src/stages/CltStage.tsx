/** 舞台：中心极限定理 —— m 个均匀样本一平均，直方图从平顶长成钟形，贴上正态曲线 */
import type { CltState } from '@engine/kernels/clt.ts'
import type { StageProps } from '../types.ts'

export function CltStage({ state }: StageProps<CltState>) {
  const { m, trials, std, theoStd, exKurt, bins, phase } = state
  const started = m > 0
  const maxD = Math.max(0.42, ...bins.map(b => Math.max(b.density, b.gauss)))
  const H = 120
  // 正态曲线折线点
  const n = bins.length
  const px = (k: number) => (k + 0.5) / n * 100
  const py = (v: number) => H - (v / maxD) * H
  const curve = bins.map((b, k) => `${k ? 'L' : 'M'}${px(k).toFixed(1)} ${py(b.gauss).toFixed(1)}`).join(' ')

  return (
    <div className="card">
      <h3>中心极限定理 <span className="hint">平的均匀分布，一平均就长成钟形</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? m : '—'}</span><span className="scdl">平均样本数 m</span></div>
          <div className="scdk"><span className="scdn">{started ? std.toFixed(3) : '—'}</span><span className="scdl">均值 std</span></div>
          <div className="scdk"><span className="scdn">{started ? theoStd.toFixed(3) : '—'}</span><span className="scdl">理论 σ/√m</span></div>
          <div className="scdk"><span className="scdn hot">{started ? exKurt.toFixed(2) : '—'}</span><span className="scdl">超额峰度（0=高斯）</span></div>
        </div>

        {/* 标准化直方图 + 正态曲线 */}
        <div className="cltwrap">
          <svg className="cltplot" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
            {bins.map((b, k) => (
              <rect key={k} x={px(k) - 100 / n / 2 + 0.4} width={100 / n - 0.8}
                y={py(b.density)} height={Math.max(0, H - py(b.density))}
                className={`cltbar ${exKurt > -0.1 ? 'bell' : ''}`} />
            ))}
            {started && <path d={curve} className="cltcurve" vectorEffect="non-scaling-stroke" />}
          </svg>
          <div className="orcap">
            {started
              ? `标准化直方图(${trials.toLocaleString()} 次) vs 标准正态曲线；m=1 平顶、m 越大越贴钟形`
              : '按「下一步」增大平均样本数 m'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">原始是最不像高斯的<b>均匀分布(平的)</b>，可只要把 32 个一平均，均值分布就长成了<b>钟形</b>——超额峰度从 −1.2 奔向 0(=高斯)、直方图贴住正态曲线。同时均值 std 按 <b>σ/√m</b> 缩(∝1/√m，接大数定理)。这就是<b>中心极限定理</b>：许多独立小随机因素相加，天然趋向高斯——这正是高斯分布在自然界与深度学习(权重初始化、噪声假设、误差项)里无处不在的原因。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>{m === 1 ? '这就是均匀分布本身——平顶，离高斯最远(峰度 −1.2)。' : '看直方图往钟形靠、越贴那条正态曲线；超额峰度往 0 走。'}继续加大 m。</p>}
      </div>
    </div>
  )
}
