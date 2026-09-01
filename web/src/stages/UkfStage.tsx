/** 舞台：UKF —— h(x) 曲线上撒 sigma 点(过真非线性) + sigma 表 + 重组/更新 + 与 EKF 对比 */
import type { UkfState, Sigma } from '@engine/kernels/ukf.ts'
import type { StageProps } from '../types.ts'

export function UkfStage({ state }: StageProps<UkfState>) {
  const s = state
  const { uncLabel, unc, xPred, P, L, d, z, sqrtTerm, sigmas, zPred, S, Pxz, K, xPost, PPost, xEkf, PEkf, showSigma, showTrans, showRecomb, showUpd } = s
  // SVG: x∈[0,12]→[24,300], h∈[4,12]→[70,14]
  const hx = (x: number) => Math.sqrt((L - x) ** 2 + d * d)
  const PX = (x: number) => 24 + (x / 12) * 276
  const PY = (h: number) => 70 - ((h - 4) / 8) * 56
  const curve = Array.from({ length: 49 }, (_, k) => { const x = k / 4; return `${k === 0 ? 'M' : 'L'}${PX(x).toFixed(1)},${PY(hx(x)).toFixed(1)}` }).join(' ')

  return (
    <div className="card">
      <h3>无迹卡尔曼滤波 UKF <span className="hint">不求雅可比：挑一组 sigma 点过真非线性函数、再拟合高斯（近似分布比近似函数容易）</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{uncLabel.split('(')[0]}</span><span className="scdl">先验不确定 {uncLabel.match(/\(([^)]+)\)/)?.[1]}</span></div>
          <div className="scdk"><span className="scdn">3</span><span className="scdl">sigma 点 (2n+1)</span></div>
          <div className="scdk"><span className={`scdn${showUpd ? ' uk-hot' : ''}`}>{showUpd ? xPost : xPred}</span><span className="scdl">UKF 估计 x̂</span></div>
          <div className="scdk"><span className={`scdn${showUpd ? ' uk-cmp' : ''}`}>{showUpd ? xEkf : '—'}</span><span className="scdl">对比 EKF x̂</span></div>
        </div>

        <svg className="uk-svg" viewBox="0 0 320 84" width="100%" height="88">
          <path d={curve} className="uk-curve" fill="none" />
          <text x="304" y={PY(hx(12)) + 3} className="uk-curvel">h(x)</text>
          <line x1="24" y1="70" x2="300" y2="70" className="uk-axis" />
          {[0, 5, 10].map(t => <text key={t} x={PX(t)} y="82" className="uk-tick">{t}</text>)}
          {/* 测量 z 水平线 */}
          {showRecomb && <line x1="24" y1={PY(z)} x2="300" y2={PY(z)} className="uk-z" />}
          {showRecomb && <text x="304" y={PY(z) + 3} className="uk-zt">z={z}</text>}
          {/* sigma 点:x 轴 + 投到曲线 */}
          {showSigma && sigmas.map((g: Sigma, k: number) => (
            <g key={k}>
              <circle cx={PX(g.x)} cy="70" r="3" className={k === 0 ? 'uk-s0' : 'uk-si'} />
              {showTrans && <><line x1={PX(g.x)} y1="70" x2={PX(g.x)} y2={PY(g.h)} className="uk-proj" /><circle cx={PX(g.x)} cy={PY(g.h)} r="3.5" className={k === 0 ? 'uk-s0' : 'uk-si'} /></>}
            </g>
          ))}
        </svg>

        <div className="uk-flow">
          <div className={`uk-blk${showSigma ? '' : ' uk-off'}`}>
            <span className="uk-n">①</span> sigma 点 X₀=μ={xPred}、X₁,₂=μ±√((n+λ)P)={xPred}±{showSigma ? sqrtTerm : '…'}{showSigma ? <> → <b>[{sigmas.map(g => g.x).join(', ')}]</b></> : ''}<em className="uk-sub">{unc === 'big' ? 'P 大→铺得开、探到曲率' : 'P 小→靠得近、局部近似线性'}</em>
          </div>
          <div className={`uk-blk${showTrans ? '' : ' uk-off'}`}>
            <span className="uk-n">②</span> 每点过真非线性 h(不求导){showTrans ? <>：{sigmas.map((g, k) => <span key={k} className="uk-hchip">h({g.x})={g.h}</span>)}</> : ' —'}
          </div>
          <div className={`uk-blk${showRecomb ? '' : ' uk-off'}`}>
            <span className="uk-n">③</span> 重组 {showRecomb ? <>ẑ=ΣWm·h(Xᵢ)=<b>{zPred}</b>（≠EKF 的 h(x̂)=7.07）、S=<b>{S}</b>、互协方差 Pxz=<b>{Pxz}</b></> : '—'}
          </div>
          <div className={`uk-blk${showUpd ? '' : ' uk-off'}`}>
            <span className="uk-n">④</span> 更新 {showUpd ? <>K=Pxz/S=<b>{K}</b>，x←x̂+K(z−ẑ)=<b className="uk-hot2">{xPost}</b>，P←P−KSK=<b>{PPost}</b></> : '—'}
          </div>
        </div>

        {showUpd && (
          <div className={`uk-cmpbox ${unc === 'big' ? 'uk-diverge' : 'uk-agree'}`}>
            <b>UKF x={xPost}, P={PPost}</b> vs <b>EKF x={xEkf}, P={PEkf}</b> —— {unc === 'big'
              ? <>先验 P 大 → <b>两者分道</b>：sigma 点铺得开、UKF 把 h 的曲率算进来，和 EKF 一阶线性化明显不同。</>
              : <>先验 P 小 → <b>几乎一样</b>：这段 h 近似线性，UKF≈EKF。UKF 的优势在不确定大/非线性强时才显现。</>}
          </div>
        )}

        {s.stage === 'done'
          ? <p className="scnote"><b>UKF = 无迹变换 + 卡尔曼</b>：取 2n+1 个 sigma 点→每点过真非线性 f/h(<b>不求导</b>)→重组均值/协方差/互协方差→卡尔曼式更新(K=Pxz/S)。<b>vs EKF</b>：EKF 一条切线(雅可比一阶)；UKF 让点真走一遍非线性、捕捉二阶曲率(高斯到三阶精确)、且免推雅可比。<b>vs 粒子滤波</b>：UKF 还是单高斯(单峰)，PF 一堆样本能表多峰。选型：线性→KF、弱非线性/快→EKF、强非线性/难求导→UKF、多峰→PF。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
