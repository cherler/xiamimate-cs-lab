/** 舞台：接触动力学 —— 法向互补 f_n=mg / 摩擦锥条(μf_n 边界 vs 推力 F)/ 粘/滑判定 / 加速度，逐步现算 */
import type { LcpState } from '@engine/kernels/contactlcp.ts'
import type { StageProps } from '../types.ts'

export function ContactLcpStage({ state }: StageProps<LcpState>) {
  const s = state
  const { pushLabel, m, g, mu, F, fn, maxStatic, stick, ft, accel, showNormal, showCone, showStick, showAccel } = s
  const scale = 12                 // 条的满量程 N
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`

  return (
    <div className="card">
      <h3>接触动力学 · 摩擦锥 + LCP <span className="hint">物理引擎每步怎么解接触力：法向互补 0≤f_n⊥φ≥0 + 库仑摩擦锥 |f_t|≤μf_n</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{pushLabel.split(' ')[0]}</span><span className="scdl">推力 F={F}N</span></div>
          <div className="scdk"><span className="scdn">{mu}</span><span className="scdl">摩擦系数 μ</span></div>
          <div className="scdk"><span className={`scdn${showStick ? (stick ? ' lc-stick' : ' lc-slip') : ''}`}>{showStick ? (stick ? '粘住' : '滑动') : '—'}</span><span className="scdl">粘/滑</span></div>
          <div className="scdk"><span className={`scdn${showAccel ? (accel > 0 ? ' lc-slip' : '') : ''}`}>{showAccel ? accel : '—'}<em className="cc-u"> m/s²</em></span><span className="scdl">加速度 a</span></div>
        </div>

        {showNormal && (
          <div className="lc-line"><span className="lc-n">①</span> 法向互补 <b>0 ≤ f_n ⊥ φ ≥ 0</b>（不能拉·不能穿）→ 静止支撑 f_n = m·g = {m}×{g} = <b>{fn}N</b></div>
        )}

        {showCone && (
          <div className="lc-conewrap">
            <div className="lc-line"><span className="lc-n">②</span> 库仑摩擦锥 <b>|f_t| ≤ μ·f_n = {mu}×{fn} = {maxStatic}N</b>（最大静摩擦）</div>
            <div className="lc-bar">
              <div className="lc-cone" style={{ width: pct(maxStatic) }}><span className="lc-conelbl">摩擦锥内（可粘）</span></div>
              <div className="lc-limit" style={{ left: pct(maxStatic) }} title={`μf_n=${maxStatic}`}><span className="lc-limlbl">μf_n={maxStatic}</span></div>
              {showStick && <div className={`lc-force ${stick ? 'lc-fstick' : 'lc-fslip'}`} style={{ left: pct(F) }}><span className="lc-flbl">F={F}</span></div>}
            </div>
          </div>
        )}

        {showStick && (
          <div className={`lc-verdict ${stick ? 'lc-vstick' : 'lc-vslip'}`}>
            <span className="lc-n">③</span> 比较 <b>F={F}N {stick ? '≤' : '>'} μf_n={maxStatic}N</b> → <b>{stick ? '粘住(stick)' : '滑动(slip)'}</b>：
            {stick
              ? <> 摩擦力 f_t={ft}N（=外力反向、落在锥<b>内</b>），滑块不动、v_t 保持 0。</>
              : <> 摩擦力饱和在边界 f_t=μf_n={ft}N（滑动摩擦、反向阻滑），多出的力让它加速。</>}
          </div>
        )}

        {showAccel && (
          <div className="lc-line lc-accel"><span className="lc-n">④</span> 牛顿：<b>a = (F − f_t)/m = ({F} − {ft})/{m} = {accel} m/s²</b>　·　LCP 视角：{stick ? '松弛 λ=0、锥约束不激活（有余量）' : '松弛 λ>0、锥约束激活（Σβ=μf_n 顶到边界）'}——引擎每步组一个 LCP/QP 解所有接触冲量。</div>
        )}

        {s.stage === 'done'
          ? <p className="scnote"><b>接触 = 法向互补 + 摩擦锥两条约束</b>：①0≤f_n⊥φ≥0（不能拉不能穿）②|f_t|≤μf_n（粘=锥内 v_t=0 / 滑=锥边界 f_t=μf_n 反向）③粘/滑=摩擦锥的 KKT 开关（F≤μf_n 粘 a=0、否则滑 a=(F−μf_n)/m）。物理引擎每步组 <b>LCP/QP</b> 解接触冲量（锥常线性化成金字塔；碰撞要冲量级、Painlevé 佯谬）。<b>连</b>：正向动力学/仿真每步要解它；阻抗力控处理接触柔顺；抓取力闭合、腿足落脚都建在摩擦锥上。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{s.focus}。</p>}
      </div>
    </div>
  )
}
