/** 舞台：粒子滤波 —— 数轴粒子云(半径∝权重)+ 重采样后的新云；加权/N_eff/重采样逐块现算 */
import type { PfState, Particle } from '@engine/kernels/particlefilter.ts'
import type { StageProps } from '../types.ts'

export function PfStage({ state }: StageProps<PfState>) {
  const s = state
  const { modeLabel, mode, z, sigma, particles, sumW, neff, N, resampled, estimate, estimateResampled, showWeight, showNeff, showResample } = s
  const W = 320, X0 = 20, SC = (W - X0 - 12) / 11
  const px = (v: number) => X0 + v * SC
  // 重采样后每个位置出现次数 → 叠放
  const counts: Record<number, number> = {}

  return (
    <div className="card">
      <h3>粒子滤波 · 蒙特卡洛定位 <span className="hint">用一堆带权粒子表示信念，能表多峰/非高斯（EKF 线性化失效时的答案）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{modeLabel.split('(')[0]}</span><span className="scdl">重采样</span></div>
          <div className="scdk"><span className={`scdn${showNeff ? (neff < N / 2 ? ' pf-bad' : '') : ''}`}>{showNeff ? neff : '—'}<em className="cc-u">/{N}</em></span><span className="scdl">有效样本数 N_eff</span></div>
          <div className="scdk"><span className={`scdn${showNeff ? ' pf-hot' : ''}`}>{showNeff ? estimate : '—'}</span><span className="scdl">估计(加权均值)</span></div>
          <div className="scdk"><span className="scdn">z={z}</span><span className="scdl">测量(σ={sigma})</span></div>
        </div>

        <svg className="pf-svg" viewBox="0 0 340 96" width="100%" height="102">
          {/* 测量位置 */}
          <line x1={px(z)} y1="6" x2={px(z)} y2="78" className="pf-z" />
          <text x={px(z)} y="4" className="pf-zt">z={z}</text>
          {/* 上行:加权粒子 */}
          <line x1={X0} y1="40" x2={W} y2="40" className="pf-axis" />
          {[0, 5, 10].map(t => <text key={t} x={px(t)} y="52" className="pf-tick">{t}</text>)}
          {particles.map((p: Particle, k: number) => (
            <circle key={k} cx={px(p.pos)} cy="40" r={showWeight ? 3 + p.wn * 22 : 4} className={showWeight ? 'pf-pw' : 'pf-p'} />
          ))}
          <text x={X0 - 4} y="30" className="pf-rowl">粒子(半径∝权重)</text>
          {/* 下行:重采样后 */}
          {showResample && mode === 'on' && <>
            <line x1={X0} y1="80" x2={W} y2="80" className="pf-axis" />
            {resampled.map((pos: number, k: number) => { counts[pos] = (counts[pos] ?? 0) + 1; return (
              <circle key={k} cx={px(pos)} cy={80 - (counts[pos]! - 1) * 7} r="4" className="pf-pr" />
            ) })}
            <text x={X0 - 4} y="94" className="pf-rowl">重采样后(等权、聚拢)</text>
          </>}
        </svg>

        <div className="pf-flow">
          <div className={`pf-blk${showWeight ? '' : ' pf-off'}`}>
            <span className="pf-n">①②</span> 加权 w_i = exp(−(z−x_i)²/(2σ²)){showWeight ? <>：{particles.map((p, k) => <span key={k} className="pf-wchip">{p.pos}:{p.wn}</span>)}（离 z={z} 越近权重越高）</> : ' —'}
          </div>
          <div className={`pf-blk${showNeff ? '' : ' pf-off'}`}>
            <span className="pf-n">③</span> 有效样本数 N_eff = 1/Σw² {showNeff ? <>= <b className={neff < N / 2 ? 'pf-bad' : ''}>{neff}</b>（满值 {N}，{neff < N / 2 ? '< N/2 → 该重采样' : '接近阈值 N/2'}）；加权均值估计 = <b>{estimate}</b></> : '—'}
          </div>
          <div className={`pf-blk${showResample ? '' : ' pf-off'}`}>
            <span className="pf-n">④</span> {showResample ? (mode === 'on'
              ? <>重采样：高权复制、低权淘汰 → 新云 <b>[{resampled.join(', ')}]</b>（x=2、9 死、x=5、6 复制），权重重置 1/{N}、聚拢到高概率区</>
              : <>不重采样：权重继续退化——迭代几步后全集中到极少数粒子（<b>N_eff→1</b>、粒子退化），标准 PF 必须重采样</>) : '—'}
          </div>
        </div>

        {s.stage === 'done'
          ? <p className="scnote"><b>粒子滤波 = 一群样本近似任意分布</b>：①预测(每粒子按运动+噪声动)②加权(w∝观测似然)③归一+N_eff=1/Σw²(&lt;N/2 重采样)④重采样(高权复制/低权淘汰/权重重置、治退化)。估计=加权均值 {estimate}。<b>vs KF/EKF</b>：它们用一个高斯、快但单峰；粒子滤波用一堆样本、能表<b>多峰/非高斯</b>(全局定位/绑架问题)，但粒子多才准、慢、要重采样治退化。<b>连</b>：是「卡尔曼滤波」的采样式替代、「EKF」强非线性失效时的答案(MCL)。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
