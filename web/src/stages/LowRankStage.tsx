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
  const { rank, sigmas, original, approx, error, energyPct, fullParams, lowrankParams, phase } = state
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
          ? <p className="scnote">秩从 1→4:误差 5.48→2.24→1.0→<b>0</b>、保留能量 88%→98%→99.6%→<b>100%</b>。信息集中在前几个大奇异值上,留前 2 个就 98% 像。这就是 <b>LoRA</b>:微调不动整块 d×d 权重,而是加个低秩更新 ΔW=B·A(秩 r≪d),只训 2·d·r 个参数——省显存、省算力、能存很多套技能包。图像压缩、PCA、推荐降维底子也都是它(Eckart–Young:低秩近似里 A_k 最优)。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>只留前 {rank} 个奇异分量,右边就用 {lowrankParams} 个数近似了原来 {fullParams} 个。误差正好等于丢掉的奇异值 √(Σσ²)。加大 k 看它越来越像。</p>}
      </div>
    </div>
  )
}
