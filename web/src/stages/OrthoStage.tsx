/** 舞台：高维近正交 —— 数轴上 28 对夹角余弦，随 d 增大越挤越紧地贴向 0（=正交） */
import type { OrthoState } from '@engine/kernels/ortho.ts'
import type { StageProps } from '../types.ts'

export function OrthoStage({ state }: StageProps<OrthoState>) {
  const { d, n, cosines, mean, std, theoStd, maxAbs, phase } = state
  const started = d > 0
  // 数轴 [-1,1] → [0,100]%
  const pos = (c: number) => (c + 1) / 2 * 100
  return (
    <div className="card">
      <h3>高维近正交 <span className="hint">随机向量两两夹角，随维度挤向 90°（余弦→0）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? d : '—'}</span><span className="scdl">维度 d</span></div>
          <div className="scdk"><span className="scdn hot">{started ? std.toFixed(3) : '—'}</span><span className="scdl">余弦标准差</span></div>
          <div className="scdk"><span className="scdn">{started ? theoStd.toFixed(3) : '—'}</span><span className="scdl">理论 1/√d</span></div>
          <div className="scdk"><span className="scdn">{started ? maxAbs.toFixed(2) : '—'}</span><span className="scdl">最大 |余弦|</span></div>
        </div>

        {/* 数轴 */}
        <div className="orline">
          <div className="ortrack">
            {/* 刻度 */}
            <span className="ortick" style={{ left: '0%' }}><i>-1</i><em>反向</em></span>
            <span className="ortick mid" style={{ left: '50%' }}><i>0</i><em>正交 · 90°</em></span>
            <span className="ortick" style={{ left: '100%' }}><i>+1</i><em>同向</em></span>
            {/* ±1σ 带 */}
            {started && <span className="orband" style={{ left: `${pos(mean - std)}%`, width: `${std * 100}%` }} />}
            {/* 余弦点 */}
            {started && cosines.map((c, k) => (
              <span key={k} className="ordot" style={{ left: `${pos(c)}%` }} title={`余弦 ${c.toFixed(3)} → ${(Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI).toFixed(0)}°`} />
            ))}
          </div>
          <div className="orcap">{started ? `${n} 个随机向量 · ${cosines.length} 对夹角（灰带 = ±1 个标准差）` : '按「下一步」增大维度 d'}</div>
        </div>

        {phase === 'done'
          ? <p className="scnote">从 d=2 到 d=512，余弦标准差从 ~0.7 缩到 ~0.04（≈<b>1/√d</b>），点全挤到"正交"上。<b>高维里随机方向几乎两两正交</b>——所以几百维能塞下指数级多"近正交"方向，一个概念占一个、彼此几乎不干扰。这就是<b>嵌入有容量、点积能当相关度</b>的根。又是大数定理：分量越多，归一化内积越集中在 0。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>看灰带（±1σ）随 d 越缩越窄、点越挤向中间"0=正交"。d=2 时还可能有一对几乎同向（max|cos|≈1）；d 一大就都贴到 90° 了。</p>}
      </div>
    </div>
  )
}
