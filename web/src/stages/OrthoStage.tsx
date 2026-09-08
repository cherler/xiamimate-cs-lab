/** 舞台：高维近正交 —— 数轴上 28 对夹角余弦，随 d 增大越挤越紧地贴向 0（=正交） */
import type { OrthoState } from '@engine/kernels/ortho.ts'
import type { StageProps } from '../types.ts'

export function OrthoStage({ state }: StageProps<OrthoState>) {
  const { d, n, cosines, mean, std, theoStd, maxAbs, phase,
    tol, packed, packCap, pTheory, pMeasured, pErr, pSamples, capacity } = state
  //  容量跨十几个数量级，只能报量级
  const capStr = capacity >= 1e5 ? capacity.toExponential(1) : capacity.toFixed(0)
  const agree = pMeasured > 0 && Math.abs(pMeasured - pTheory) <= pErr
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
          {/*  这一栏是补厚的重点："指数级多"从形容词变成一个能算位数的数 */}
          <div className="scdk"><span className="scdn hot">{started ? capStr : '—'}</span>
            <span className="scdl">容量（|cos| ≤ {tol} 时能塞几个方向）</span></div>
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

        {/*  容量那一屏：直接装出来的下界 + 算出来的估计 + 撞线概率的理论/实测对照 */}
        {started && (
          <div className="orcap2">
            <div className="orcline">
              <span className="orck">① 真装进去（贪心）</span>
              <span className="orcv"><b>{packed}{packed >= packCap ? '+' : ''}</b> 个
                <span className="orcnote">
                  {packed >= packCap ? `（撞到装填上限 ${packCap}，只说明"至少这么多"）` : '（受试验次数所限，也是个下界）'}
                </span></span>
            </div>
            <div className="orcline">
              <span className="orck">② 保证装得下</span>
              <span className="orcv"><b>{capStr}</b> 个 —— 1/p（Gilbert–Varshamov：每收一个就在球面上挖掉 p，挖不满就还能收）</span>
            </div>
            <div className="orcline">
              <span className="orck" />
              <span className="orcv orcnote">①② <b>都是下界</b>，真实容量比两者都大；谁大谁小不固定（贪心常能超过保证值）。</span>
            </div>
            <div className="orcline">
              <span className="orck">撞线概率 p</span>
              <span className="orcv">
                精确 <b>{pTheory < 1e-4 ? pTheory.toExponential(2) : pTheory.toFixed(4)}</b>
                {pMeasured > 0
                  ? <>　实测 {pMeasured.toFixed(4)} ± {pErr.toFixed(4)}（{pSamples} 对里撞 {Math.round(pMeasured * pSamples)} 次）
                    <span className={`orcnote ${agree ? '' : 'warn'}`}>
                      {agree ? '　✓ 在抽样误差内对得上' : `　差 ${(Math.abs(pMeasured - pTheory) / Math.max(pErr, 1e-12)).toFixed(1)}σ，样本再多些就收敛`}
                    </span></>
                  : <>　实测：{pSamples} 对里<b>一次都没撞上</b>
                    <span className="orcnote">　这条尾巴只能算、数不出来</span></>}
              </span>
            </div>
          </div>
        )}

        {phase === 'done'
          ? <p className="scnote">从 d=2 到 d={d}，余弦标准差缩到 ~{std}（≈<b>1/√d</b>），点全挤到"正交"上 ——
            <b>高维里随机方向几乎两两正交</b>。
            　但这一屏真正要给的是<b>容量</b>：在"任意两个方向的 |cos| 不超过 {tol}"这个要求下，
            d={d} <b>保证</b>装得下 <b>{capStr}</b> 个方向（1/p 给的下界，真实容量更大）。
            　<b>"指数级多"是一个能算出位数的数，不是形容词</b> —— 几百维的嵌入装十几万个词根本不算事。
            每个概念占一个近正交方向、彼此几乎不干扰，这就是嵌入有容量、点积能当相关度的根，
            也是"叠加（superposition）"那套说法的地基。
            　⚠️ 容量对 <b>ε</b> 极其敏感（它在尾巴的指数里）：把「容忍度」拧到 0.1 再看，同一个 d 会掉好几个数量级。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>看灰带（±1σ）随 d 越缩越窄、点越挤向中间"0=正交"。d=2 时还可能有一对几乎同向（max|cos|≈1）；d 一大就都贴到 90° 了。</p>}
      </div>
    </div>
  )
}
