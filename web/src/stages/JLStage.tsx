/** 舞台：JL 引理 —— 高维点投到 K 维，两两距离比(低维/高维)随 K 增大挤向 1 */
import type { JLState } from '@engine/kernels/jl.ts'
import type { StageProps } from '../types.ts'

export function JLStage({ state }: StageProps<JLState>) {
  const { d, k, n, ratios, avgRatio, maxDev, phase } = state
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

        {phase === 'done'
          ? <p className="scnote">K 从 16→128:距离最大偏差从 ~31% 收到 <b>{(maxDev * 100).toFixed(0)}%</b>、平均比≈1——<b>{d} 维的点压到几十维,两两距离几乎原样保留</b>。这就是 <b>JL 引理</b>:所需维度 k~O(log N/ε²)、<b>与原始维度 D 无关</b>,只看点数 N 和精度 ε。随机投影降维、近似最近邻、特征哈希都靠它;也和 LoRA/低秩、高维近正交一家——高维很"空"、可压。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>看这些点(每个是一对点的距离比)随 K 增大越挤越紧地贴向 1、灰带越缩越窄。惊人的是:要多少投影维度只跟点数 N 和精度有关,<b>和原始 {d} 维无关</b>。</p>}
      </div>
    </div>
  )
}
