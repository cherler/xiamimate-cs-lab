/**
 * 舞台：条件数 —— 同一个 κ 的两张脸并排
 *   左：**优化的脸**（等高线 + 之字形轨迹，κ 越大越扁、越难走）
 *   右：**数值的脸**（b 上一点点误差，被放大多少倍传给 x）
 *
 * 2026-09-08 补厚时加的右半边。老版本只画了左边，而 ‖Δx‖/‖x‖ ≤ κ·‖Δb‖/‖b‖
 * 才是条件数的**定义式** —— 那张脸屏幕上一点都看不见。
 *
 * ⚠️ 等高线不能再用 <ellipse> 画了：矩阵 A 现在是**旋转过的**（主轴转了 30°，
 * 好让对角缩放不是一步到位的万能药）。这里直接按二次型参数化描点，
 * 免去一层"到底该转 +30° 还是 −30°"的坐标账 —— 那种账错了不报错，只是图不对。
 */
import type { CondNumState } from '@engine/kernels/condnum.ts'
import type { StageProps } from '../types.ts'

const TH = 30 * Math.PI / 180
const C = Math.cos(TH), S = Math.sin(TH)
const cx = (x: number) => 50 + x * 34
const cy = (y: number) => 50 - y * 34

export function CondNumStage({ state }: StageProps<CondNumState>) {
  const { kappa, kappaEff, steps, rate, amp, ampCap, dirMode, precond, path, phase } = state
  const started = kappa > 0
  const jacobi = precond !== '不预处理'

  /*  等高线：uᵀ·diag(1,κ)·u = c 是轴对齐椭圆，x = Rᵀu 把它转回来。
      直接描点，不做 SVG 旋转。 */
  const levelPath = (c: number) => {
    const pts: string[] = []
    for (let k = 0; k <= 48; k++) {
      const t = k / 48 * Math.PI * 2
      const u1 = Math.sqrt(c) * Math.cos(t), u2 = Math.sqrt(c / kappaEff) * Math.sin(t)
      pts.push(`${cx(C * u1 - S * u2).toFixed(1)},${cy(S * u1 + C * u2).toFixed(1)}`)
    }
    return pts.join(' ')
  }
  const levels = [1.6, 0.8, 0.3, 0.08]
  //  放大条：输入固定 0.1%，输出 = 0.1% × 放大倍数。用 log 宽度，不然输入那根看不见。
  const inRel = 0.1, outRel = 0.1 * amp
  /*  ⚠️ amp 和 ampCap 要并排比，就必须**同一个格式化**：
      原来一个 toFixed(0)、一个 toPrecision(4)，于是屏幕上印出
      "放大 151 倍，上界正是 150.5 —— 一位不差" —— 自己打自己的脸。 */
  const f = (v: number) => `${+v.toPrecision(4)}`
  const tight = Math.abs(amp - ampCap) / Math.max(1e-9, ampCap) < 1e-3
  const wOf = (v: number) => Math.max(3, Math.min(100, (Math.log10(v) + 2) / 3.5 * 100))

  return (
    <div className="card">
      <h3>条件数 <span className="hint">同一个数的两张脸：走得慢，和算不准</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{started ? (jacobi ? `${kappa}→${kappaEff}` : kappa) : '—'}</span>
            <span className="scdl">条件数 κ{jacobi ? '（对角缩放后）' : ''}</span></div>
          <div className="scdk"><span className="scdn hot">{started ? steps : '—'}</span><span className="scdl">优化：收敛步数</span></div>
          <div className="scdk"><span className={`scdn ${started && amp > 10 ? '' : 'hot'}`}>
            {started ? `${f(amp)}×` : '—'}</span>
            <span className="scdl">数值：误差放大（上界 {started ? f(ampCap) : '—'}）</span></div>
        </div>

        <div className="cnpair">
          {/* ── 左：优化的脸 ───────────────────────── */}
          <div className="cncol">
            <p className="gbsec"><b>优化的脸</b><span>等高线越扁，梯度越不指向谷底</span></p>
            <svg className="cnplot" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              <line x1="6" y1={cy(0)} x2="94" y2={cy(0)} className="cnaxis" />
              <line x1={cx(0)} y1="6" x2={cx(0)} y2="94" className="cnaxis" />
              {started && levels.map((c, k) => (
                <polyline key={k} points={levelPath(c)} className="cnlevel" fill="none" vectorEffect="non-scaling-stroke" />
              ))}
              {started && path.length > 1 && (
                <polyline points={path.map(p => `${cx(p.x)},${cy(p.y)}`).join(' ')} className="cnpath" fill="none" vectorEffect="non-scaling-stroke" />
              )}
              {started && path.slice(0, 24).map((p, k) => (
                <circle key={k} cx={cx(p.x)} cy={cy(p.y)} r={k === 0 ? 2.2 : 1.1} className={k === 0 ? 'cndot start' : 'cndot'} />
              ))}
              <circle cx={cx(0)} cy={cy(0)} r="1.6" className="cnmin" />
            </svg>
            <div className="orcap">
              {started ? `${steps} 步收敛；每步误差最多缩 (κ−1)/(κ+1)=${rate}` : '按「下一步」把 κ 从 1 一路加到 200'}
            </div>
          </div>

          {/* ── 右：数值的脸 ───────────────────────── */}
          <div className="cncol">
            <p className="gbsec"><b>数值的脸</b><span>解 Ax=b：b 抖一点，x 抖多少</span></p>
            {started ? (
              <div className="cnamp">
                <span className="cnabar in">
                  <b>b 的误差</b><i style={{ width: `${wOf(inRel)}%` }} /><em>{inRel}%</em>
                </span>
                <span className={`cnabar out ${amp > 10 ? 'bad' : ''}`}>
                  <b>x 的误差</b><i style={{ width: `${wOf(outRel)}%` }} />
                  <em>{outRel >= 10 ? outRel.toFixed(0) : outRel.toPrecision(2)}%</em>
                </span>
                <span className="cnafn">
                  放大 <b>{f(amp)}</b> 倍，理论上界正是 <b>κ = {f(ampCap)}</b>
                  {tight
                    ? ' —— 最坏方向上它顶满了，一位不差。'
                    : ' —— 这个方向远够不着：κ 是上界，不是每次都会发生的事。'}
                </span>
              </div>
            ) : <div className="cnamp"><span className="cnafn">按「下一步」开始</span></div>}
            <div className="orcap">
              {started
                ? `‖Δx‖/‖x‖ ≤ κ·‖Δb‖/‖b‖ —— 这才是"条件数"这个名字的来源`
                : '同一个 κ，也决定了这个问题算不算得准'}
            </div>
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">κ 从 1 拉到 200，<b>同一个数</b>在两个地方同时变坏：收敛步数从 1 涨到 <b>{steps}</b>，
            误差放大从 1 涨到 <b>{f(amp)}</b> 倍。
            　这两件事看着不相干，其实是一张脸的两面：碗被拉扁，梯度就几乎垂直于通往谷底的方向；
            矩阵被拉扁，<b>最小特征值就贴近 0，b 上一点点误差除以它就会炸开</b>。
            　所以"病态"不是"算法不好"，是<b>问题本身不稳</b> —— 换个更快的优化器能救前一半，救不了后一半。
            {jacobi
              ? <>　⚠️ 现在开着<b>对角缩放</b>，κ=200 那档也只降到 {kappaEff}。因为这里的 A 是<b>旋转过的</b>：
                对角缩放只能修"各维尺度不一"那部分病态，修不了"方向相关"那部分。
                <b>"归一化一下就好了"是不成立的。</b></>
              : <>　把「预处理」拨到<b>对角缩放</b>看看能修回多少 —— 有用，但远不是万能。</>}</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>
            {kappa === 1
              ? '正圆碗：梯度直指圆心，一步到位；解也对扰动完全不敏感（放大 1 倍）。两张脸此刻都是最好的样子。'
              : '椭圆越扁，梯度越偏离"通往谷底"的方向，于是来回之字形；同时最小特征值越贴近 0，解对 b 的扰动越敏感。盯右边那两根条：输入抖一点，输出抖多少。'}</p>}
      </div>
    </div>
  )
}
