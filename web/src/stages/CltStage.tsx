/** 舞台：中心极限定理 —— m 个均匀样本一平均，直方图从平顶长成钟形，贴上正态曲线 */
import type { CltState } from '@engine/kernels/clt.ts'
import type { StageProps } from '../types.ts'

export function CltStage({ state }: StageProps<CltState>) {
  const { m, trials, std, theoStd, exKurt, bins, phase , dist, finiteVar, kurtCurve } = state
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

        {/*  ── 峰度曲线（2026-09-08 加）——「离高斯还有多远」的量化答案 ──
             原来这个数只在读数栏里躺着，看不出"在往 0 走"还是"原地不动"。
             画成曲线，柯西那一档一眼就看出它压根没动。 */}
        <div className="mlwrap">
          <p className="gbsec"><b>离高斯还有多远</b>
            <span>纵轴=超额峰度（0=高斯）。{finiteVar ? '方差有限 → 它该一路奔向 0' : '柯西方差发散 → 它会停在天上，定理不适用'}</span></p>
          <svg className="cltcurve" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(() => {
              const cv = kurtCurve
              const hi = Math.max(...cv.map(c => Math.abs(c[1]))) * 1.15 || 1
              const X = (i: number) => (cv.length < 2 ? 0 : i / (cv.length - 1) * 100)
              const Y = (v: number) => 50 - v / hi * 44
              return <>
                <line x1="0" y1={Y(0)} x2="100" y2={Y(0)} className="cltzero" vectorEffect="non-scaling-stroke" />
                <path d={cv.map(([, v], i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}
                  className={finiteVar ? 'cltline' : 'cltline bad'} fill="none" vectorEffect="non-scaling-stroke" />
                {cv.map(([mm, v], i) => (
                  <circle key={mm} cx={X(i)} cy={Y(v)} r={mm === m ? 2.4 : 1.2}
                    className={mm === m ? 'cltnow' : 'cltdot'} />
                ))}
              </>
            })()}
          </svg>
          <div className="orcap">{kurtCurve.map(([mm, v]) => `m=${mm}:${v}`).join('　')}　（虚线=0，高斯）</div>
        </div>

        {phase === 'done'
          ? (finiteVar
            ? <p className="scnote">原始分布是<b>{dist}</b>：把 {m} 个一平均，均值分布长成了<b>钟形</b> ——
              超额峰度从 <b>{kurtCurve[0][1]}</b> 走到 <b>{kurtCurve[kurtCurve.length - 1][1]}</b>（0=高斯）、直方图贴住正态曲线；
              同时均值 std 按 <b>σ/√m</b> 缩（∝1/√m，接大数定理）。这就是<b>中心极限定理</b>：
              许多独立小随机因素相加，天然趋向高斯 —— 这正是它在自然界与深度学习里无处不在的原因。
              　但<b>"m 要多大"取决于原分布有多偏</b>：实测同样 m=32，均匀已经 −0.03，
              而「伯努利 p=0.05」还有 0.44 —— 教科书那句"m&gt;30 就够了"，在偏态分布上要打折。
              　还有更硬的一条：把原始分布换成<b>柯西</b>，这条曲线根本不会往下走。</p>
            : <p className="scnote">原始分布是<b>柯西</b>：{m} 个样本平均下来，超额峰度还是 <b>{kurtCurve[kurtCurve.length - 1][1]}</b>，
              直方图也没有变成钟形。<b>中心极限定理在这里不适用</b> —— 它要求方差有限，而柯西的方差发散。
              　更彻底的事实：n 个柯西样本的均值<b>仍然服从同一个柯西分布</b>，既不变窄也不变钟形，平均多少个都一样。
              　所以"什么东西加起来都会变高斯"是句<b>有前提</b>的话，前提就是方差得有限。</p>)
          : started && <p className="scnote" style={{ opacity: .85 }}>{m === 1 ? '这就是原分布本身，离高斯最远。' : '看直方图往钟形靠、越贴那条正态曲线；超额峰度往 0 走。'}
            {finiteVar ? '继续加大 m。' : '——但这一档是柯西，你会看到它怎么都不往 0 走。'}</p>}
      </div>
    </div>
  )
}
