/** 舞台：低秩近似/SVD→LoRA —— 原矩阵 vs 秩-k 重建，误差随 k 掉、能量攒 */
import type { LowRankState } from '@engine/kernels/lowrank.ts'
import type { StageProps } from '../types.ts'

function Heat({ M, max }: { M: number[][]; max: number }) {
  return (
    <div className="lrheat">
      {M.map((row, i) => (
        <div key={i} className="lrrow">
          {row.map((v, j) => {
            const t = Math.max(-1, Math.min(1, v / max))
            const col = t >= 0
              ? `color-mix(in srgb, var(--now) ${Math.round(t * 100)}%, var(--panel))`
              : `color-mix(in srgb, var(--miss) ${Math.round(-t * 100)}%, var(--panel))`
            return <span key={j} className="lrcell" style={{ background: col }} />
          })}
        </div>
      ))}
    </div>
  )
}

export function LowRankStage({ state }: StageProps<LowRankState>) {
  const { rank, n, sigmas, original, approx, error, energyPct, fullParams, lowrankParams, phase,
    spectrum, ratio, rFor90, rFor99, worthIt } = state
  const started = rank > 0
  const max = 2.2
  const maxSig = Math.max(...sigmas)
  return (
    <div className="card">
      <h3>低秩近似 · SVD → LoRA <span className="hint">为什么"低秩"能省参数还不太掉精度</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? rank : 0}</span><span className="scdl">保留秩 k</span></div>
          <div className="scdk"><span className="scdn hot">{started ? `${energyPct}%` : '—'}</span><span className="scdl">保留能量</span></div>
          <div className="scdk"><span className="scdn">{started ? error : '—'}</span><span className="scdl">重建误差</span></div>
          <div className="scdk"><span className="scdn">{started ? `${lowrankParams}/${fullParams}` : `—/${fullParams}`}</span><span className="scdl">参数(低秩/全)</span></div>
        </div>

        {/* 两张热力图 */}
        <div className="lrwrap">
          <div className="lrpair">
            <div className="lrbox"><Heat M={original} max={max} /><span className="lrcap">原矩阵 (8×8)</span></div>
            <div className="lrarrow">≈</div>
            <div className="lrbox"><Heat M={approx} max={max} /><span className="lrcap">秩-{started ? rank : 0} 重建</span></div>
          </div>
          {/* 奇异值条 */}
          <div className="lrsig">
            {sigmas.map((s, k) => (
              <div key={k} className="lrsigcol">
                <div className="lrsigtrack"><div className={`lrsigfill ${started && k < rank ? 'kept' : 'dropped'}`} style={{ height: `${(s / maxSig) * 100}%` }} /></div>
                <span className={`lrsiglab ${started && k < rank ? 'kept' : ''}`}>σ{k + 1}={s}</span>
              </div>
            ))}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">这条谱是「{spectrum}」，{n}×{n} 的矩阵<b>满秩</b>（不是搭出来的低秩矩阵）。
            　要留住 <b>90%</b> 的能量，秩得开到 <b>{rFor90}</b>（压缩 {(n / (2 * rFor90)).toFixed(2)}×）；
            要 99% 得开到 <b>{rFor99}</b>。
            {worthIt
              ? <>　<b>能量集中在前几个大奇异值上</b>，所以很小的 k 就够像 —— 这就是 <b>LoRA</b> 的原理：
                微调不动整块 d×d 权重，只加一个低秩更新 ΔW=B·A（秩 r≪d），只训 2·d·r 个参数。
                　⚠️ 但这不是低秩这件事有魔法。把「奇异值谱」拧到<b>平坦（随机矩阵）</b>再看同一套数学。</>
              : <>　⚠️ <b>这一档低秩近似帮不上忙</b>：谱是平的，能量摊在所有分量上，
                想留住 90% 就得留 {rFor90}/{n} 的秩，压缩比只有 <b>{(n / (2 * rFor90)).toFixed(2)}×</b>
                {n / (2 * rFor90) < 1 && <>（<b>小于 1，存 U、V 比直接存原矩阵还费，等于白忙</b>）</>}。
                　所以 <b>LoRA 能用，靠的不是"低秩"这个数学工具有魔法，而是一个经验事实：
                大模型微调时的权重更新 ΔW，它的谱确实是陡降的。</b>谱一平，同一套数学立刻什么都省不下来。</>}
            　（Eckart–Young：前 k 个分量拼出来的 A_k 是所有秩-k 矩阵里最接近 A 的，
            误差正好等于被丢掉那些奇异值的平方和开根 —— 屏幕上那个误差就是这么来的。）</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>
            只留前 {rank} 个奇异分量，右边就用 {lowrankParams} 个数近似了原来 {fullParams} 个
            （压缩 <b>{ratio}×</b>{ratio < 1 && <>　⚠️ <b>小于 1 —— 这时候低秩近似是白忙</b></>}）。
            误差正好等于丢掉的奇异值 √(Σσ²)。加大 k 看它越来越像。</p>}
      </div>
    </div>
  )
}
