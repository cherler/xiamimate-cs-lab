/** 舞台：JL 引理 —— 高维点投到 K 维，两两距离比(低维/高维)随 K 增大挤向 1 */
import type { JLState } from '@engine/kernels/jl.ts'
import type { StageProps } from '../types.ts'

export function JLStage({ state }: StageProps<JLState>) {
  const { d, k, n, ratios, avgRatio, maxDev, phase, pairs, devCurve, kNeeded } = state
  const started = k > 0
  // 比例轴 [0.5, 1.5] → [0,100]%
  const LO = 0.5, HI = 1.5
  const pos = (r: number) => Math.max(0, Math.min(100, (r - LO) / (HI - LO) * 100))
  return (
    <div className="card">
      <h3>Johnson–Lindenstrauss <span className="hint">高维压到低维，还几乎不丢距离</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{d}→{started ? k : '?'}</span><span className="scdl">维度 D→K</span></div>
          <div className="scdk"><span className="scdn">{started ? avgRatio.toFixed(3) : '—'}</span><span className="scdl">平均距离比</span></div>
          <div className="scdk"><span className="scdn hot">{started ? `${(maxDev * 100).toFixed(0)}%` : '—'}</span><span className="scdl">最大距离偏差</span></div>
        </div>

        {/* 距离比数轴 */}
        <div className="jlwrap">
          <div className="jltrack">
            <span className="jltick" style={{ left: `${pos(1)}%` }}><i>1.0</i><em>完全保距</em></span>
            <span className="jltick l" style={{ left: `${pos(0.7)}%` }}><i>0.7</i></span>
            <span className="jltick r" style={{ left: `${pos(1.3)}%` }}><i>1.3</i></span>
            {/* ±maxDev 带 */}
            {started && <span className="jlband" style={{ left: `${pos(1 - maxDev)}%`, width: `${pos(1 + maxDev) - pos(1 - maxDev)}%` }} />}
            {started && ratios.map((r, i) => (
              <span key={i} className="jldot" style={{ left: `${pos(r)}%` }} title={`距离比 ${r}`} />
            ))}
          </div>
          <div className="orcap">
            {started ? `${d} 维 → ${k} 维：${ratios.length} 对点的「低维距离 / 高维距离」（灰带=±最大偏差 ${(maxDev * 100).toFixed(0)}%）`
              : '按「下一步」把投影维度 K 从 16 加到 128'}
          </div>
        </div>

        {/*  ── 偏差曲线（2026-09-08 加）──
             JL 的全部意义在"K 多大够用"，而这条曲线才是答案；
             更要紧的是：**拧 D 它几乎不动、拧 N 它明显抬高** —— 引理那句
             「与原始维度无关」只有把两条曲线放在同一张图的位置上比才验得了。 */}
        <div className="mlwrap">
          <p className="gbsec"><b>投影维度 K 与最大偏差</b>
            <span>纵轴=所有 {pairs} 对点里最大的 |距离比−1|。拧 D 这条线几乎不动，拧 N 它整条抬高
              {kNeeded ? `　（这个精度按 8·lnN/ε² 算约需 ${kNeeded} 维）` : ''}</span></p>
          <svg className="jlcurve" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(() => {
              const cv = devCurve
              const hi = Math.max(...cv.map(c => c[1])) * 1.15 || 1
              const X = (i: number) => (cv.length < 2 ? 0 : i / (cv.length - 1) * 100)
              const Y = (v: number) => 100 - v / hi * 88 - 6
              return <>
                <path d={cv.map(([, v], i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}
                  className="jlline" fill="none" vectorEffect="non-scaling-stroke" />
                {cv.map(([kk, v], i) => (
                  <circle key={kk} cx={X(i)} cy={Y(v)} r={kk === k ? 2.4 : 1.2}
                    className={kk === k ? 'jlnow' : 'jldotc'} />
                ))}
              </>
            })()}
          </svg>
          <div className="orcap">{devCurve.map(([kk, v]) => `K=${kk}:${(v * 100).toFixed(1)}%`).join('　')}</div>
        </div>

        {phase === 'done'
          ? <p className="scnote">K 从 {devCurve[0][0]}→{devCurve[devCurve.length - 1][0]}：最大偏差从
            <b> {(devCurve[0][1] * 100).toFixed(1)}%</b> 收到 <b>{(devCurve[devCurve.length - 1][1] * 100).toFixed(1)}%</b>、平均比≈1
            —— <b>{d} 维的 {n} 个点压到几十维，两两距离几乎原样保留</b>。
            这就是 <b>JL 引理</b>：所需维度 k~O(log N/ε²)、<b>与原始维度 D 无关</b>，只看点数 N 和精度 ε。
            　两个旋钮就是用来验这句话的：把 <b>D 从 64 拧到 1024</b>（点数不变），这条曲线<b>几乎不动</b>；
            而把 <b>N 从 6 拧到 200</b>（维度不变），它<b>整条抬起来</b> —— 要保住的点对从 15 涨到 19900，同样的 K 自然更吃力。
            　随机投影降维、近似最近邻、特征哈希都靠它；也和 LoRA/低秩、高维近正交一家 —— 高维很"空"、可压。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>每个点是一对点的距离比，随 K 增大越挤越紧地贴向 1、灰带越缩越窄。
            现在这一档要保住 <b>{pairs}</b> 对点的距离；把「点数 N」调大，同样的 K 会明显吃力 ——
            而把「原始维度 D」调大，几乎没有影响。<b>这正是 JL 最反直觉的地方。</b></p>}
      </div>
    </div>
  )
}
