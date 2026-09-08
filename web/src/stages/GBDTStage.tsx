/**
 * 舞台：GBDT · 补厚版 —— 三块：拟合图 / 残差与这一轮的树桩 / 训练-留出两条 MSE 曲线
 *
 * 2026-09-08 重画（用户：「实验仿真有点偏简陋，要深深打磨」）。
 * 原来这一屏只有一张图：数据点 + 一条预测折线 + 一个 MSE 数字。
 * 而 GBDT 的机制是三件事，一件都没画：
 *   ① **残差长什么样** —— 下一棵树拟合的是它，不是原始数据；
 *   ② **这一轮的树桩** —— 切在哪、两边各补多少、乘完学习率挪了多少；
 *   ③ **训练误差和留出误差什么时候分岔** —— "树太多会过拟合"这句话，
 *      在只有训练误差的屏幕上是**演不出来**的（它单调降，怎么调都好看）。
 */
import type { GBDTState } from '@engine/kernels/gbdt.ts'
import type { StageProps } from '../types.ts'

const XLO = -0.05, XHI = 1.05

export function GBDTStage({ state }: StageProps<GBDTState>) {
  const { round, lr, points, test, pred, resid, stump, mse, testMse, mseHist, testHist, act } = state
  const px = (x: number) => (x - XLO) / (XHI - XLO) * 100

  //  拟合图的 y 轴跟着数据走 —— 换了数据形状（正弦/直线）也不会跑出画面
  const ys = [...points.map(p => p.y), ...test.map(p => p.y), ...pred]
  const YLO = Math.min(...ys) - 0.4, YHI = Math.max(...ys) + 0.4
  const py = (y: number) => 100 - (y - YLO) / (YHI - YLO) * 100
  //  预测是**阶梯**不是折线：树桩在切点处直上直下，画成斜线是假的
  const stair = points.map((p, k) =>
    k === 0 ? `M${px(p.x).toFixed(1)} ${py(pred[k]).toFixed(1)}`
      : `L${px(p.x).toFixed(1)} ${py(pred[k - 1]).toFixed(1)} L${px(p.x).toFixed(1)} ${py(pred[k]).toFixed(1)}`
  ).join(' ')

  //  残差图：0 线居中，正负各占一半
  const rmax = Math.max(0.2, ...resid.map(Math.abs))
  const ry = (v: number) => 50 - v / rmax * 46

  return (
    <div className="card">
      <h3>梯度提升树 GBDT <span className="hint">一棵棵小树接力，每棵只补上一棵的"错"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{round}</span><span className="scdl">已加了几棵树</span></div>
          <div className="scdk"><span className="scdn hot">{mse.toFixed(3)}</span><span className="scdl">训练 MSE</span></div>
          <div className="scdk"><span className="scdn">{testMse.toFixed(3)}</span><span className="scdl">留出 MSE（没见过的点）</span></div>
          <div className="scdk"><span className="scdn">{(lr * 100).toFixed(0)}%</span><span className="scdl">学习率</span></div>
        </div>

        {/* ── ① 拟合图 ───────────────────────────────── */}
        <p className="gbsec"><b>① 拟合成什么样了</b><span>实心=训练点，空心=留出点（训练时没见过），折线=当前预测阶梯</span></p>
        <div className="mlwrap gbwrap1">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            {points.map((p, k) => (
              <line key={'r' + k} x1={px(p.x)} y1={py(p.y)} x2={px(p.x)} y2={py(pred[k])}
                className="mlresid" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={stair} className="mlline" vectorEffect="non-scaling-stroke" fill="none" />
            {test.map((p, k) => (
              <circle key={'t' + k} cx={px(p.x)} cy={py(p.y)} r="1.3" className="gbtest" vectorEffect="non-scaling-stroke" />
            ))}
            {points.map((p, k) => <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.5" className="mldot" />)}
          </svg>
        </div>

        {/* ── ② 残差 + 这一轮的树桩 ────────────────────── */}
        <p className="gbsec"><b>② 这一轮要拟合的残差</b>
          <span>{act === 'fit' && stump
            ? `树桩切在 x=${stump.t}：左边补 ${stump.lm}、右边补 ${stump.rm}（乘学习率 ${(lr * 100).toFixed(0)}% 之后才加进预测）`
            : '柱子 = 真值 − 当前预测。下一棵树拟合的是它，不是原始数据'}</span></p>
        <div className="mlwrap">
          <svg className="gbresid" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="50" x2="100" y2="50" className="mlaxis" vectorEffect="non-scaling-stroke" />
            {resid.map((v, k) => (
              <line key={k} x1={px(points[k].x)} y1="50" x2={px(points[k].x)} y2={ry(v)}
                className={`gbbar ${v >= 0 ? 'up' : 'dn'}`} vectorEffect="non-scaling-stroke" />
            ))}
            {/*  这一轮拟合出来的树桩：两段横线 + 一条切割线。
                 画的是**树桩本身**（lm/rm），不是乘完学习率的值 —— 那一步在①里体现。 */}
            {stump && (
              <>
                <line x1={px(XLO)} y1={ry(stump.lm)} x2={px(stump.t)} y2={ry(stump.lm)}
                  className="gbstump" vectorEffect="non-scaling-stroke" />
                <line x1={px(stump.t)} y1={ry(stump.rm)} x2={px(XHI)} y2={ry(stump.rm)}
                  className="gbstump" vectorEffect="non-scaling-stroke" />
                <line x1={px(stump.t)} y1="2" x2={px(stump.t)} y2="98"
                  className="gbcut" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>
        </div>

        {/* ── ③ 两条曲线：什么时候开始过拟合 ────────────── */}
        <p className="gbsec"><b>③ 训练 vs 留出</b>
          <span>训练误差一路降是必然的；**留出误差掉头往上**才说明后面的树在学噪声</span></p>
        <MseCurves mseHist={mseHist} testHist={testHist} round={round} />
      </div>
    </div>
  )
}

/** 两条 MSE 曲线 —— 分岔点就是"该早停了" */
function MseCurves({ mseHist, testHist, round }: { mseHist: number[]; testHist: number[]; round: number }) {
  const n = Math.max(mseHist.length, testHist.length, 2)
  const hi = Math.max(...mseHist, ...testHist) * 1.08 || 1
  const X = (i: number) => i / (n - 1) * 100
  const Y = (v: number) => 100 - v / hi * 94
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')
  const bestT = Math.min(...testHist)
  const bestAt = testHist.indexOf(bestT)
  //  留出曲线已经越过最低点 = 开始过拟合。只在真的越过之后才画那条线，不预告。
  const turned = testHist.length - 1 > bestAt
  return (
    <div className="mlwrap">
      <svg className="gbcurve" viewBox="0 0 100 100" preserveAspectRatio="none">
        {turned && <line x1={X(bestAt)} y1="0" x2={X(bestAt)} y2="100" className="gbbest" vectorEffect="non-scaling-stroke" />}
        <path d={path(mseHist)} className="gbtrain" vectorEffect="non-scaling-stroke" fill="none" />
        <path d={path(testHist)} className="gbtest-line" vectorEffect="non-scaling-stroke" fill="none" />
        <circle cx={X(Math.min(round, n - 1))} cy={Y(mseHist[Math.min(round, mseHist.length - 1)])} r="1.6" className="gbnow" />
      </svg>
      <div className="orcap gblegend">
        <span><i className="gbk train" />训练 MSE</span>
        <span><i className="gbk test" />留出 MSE</span>
        {turned
          ? <span className="gbwarn">留出误差在第 {bestAt} 轮触底 {bestT.toFixed(3)}，之后掉头往上 —— 再加树就是在学噪声</span>
          : <span>两条还一起降，说明这些树学到的是规律</span>}
      </div>
    </div>
  )
}
