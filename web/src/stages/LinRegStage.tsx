/**
 * 舞台：线性回归 —— 左边"数据空间"（散点+直线+残差），右边"参数空间"（等高线+下坡路）
 *
 * 2026-09-08 重画（用户：「实验仿真有点偏简陋，要深深打磨」）。
 * 原来只有左边那张图：散点、一条线、一个 MSE 数字。而梯度下降这件事，
 * **它真正发生的地方是右边那张图** —— (w,b) 平面上的一条下坡路。
 * 只看左边，"沿负梯度走"永远是一句口诀：你看不见坡在哪、也看不见它为什么会冲过头。
 *
 * 右边这张图上能一眼看见三件事：
 *   ① 等高线（MSE 的地形），中心那个十字是**最小二乘闭式解**；
 *   ② 走过的**轨迹**，一步一个点 —— 步长就是 lr×梯度；
 *   ③ 学习率过大时轨迹**在谷底两侧来回横跳、越跳越远**（发散），
 *      这是"学习率要调"那句话唯一说得清的地方。
 */
import { linregLossGrid } from '@engine/kernels/linreg.ts'
import type { LinRegState } from '@engine/kernels/linreg.ts'
import type { StageProps } from '../types.ts'

const XLO = -2.6, XHI = 2.6, YLO = -5, YHI = 7
const px = (x: number) => (x - XLO) / (XHI - XLO) * 100
const py = (y: number) => 100 - (y - YLO) / (YHI - YLO) * 100

//  参数平面的取景框：包住 OLS 解、两个起点，再留些余量
const WLO = -4, WHI = 5, BLO = -2, BHI = 7
const GRID = 34
//  等高线的地形是**跟参数无关的常量**（数据不变，损失面就不变），算一次就够
const LOSS = linregLossGrid(WLO, WHI, BLO, BHI, GRID)
const LMIN = Math.min(...LOSS.flat())
const LMAX = Math.max(...LOSS.flat())

export function LinRegStage({ state }: StageProps<LinRegState>) {
  const { gdStep, w, b, gw, gb, lr, mse, points, wOls, bOls, traj, diverged, lrMax, phase } = state
  const yAt = (x: number) => w * x + b
  const qx = (v: number) => (v - WLO) / (WHI - WLO) * 100
  const qy = (v: number) => 100 - (v - BLO) / (BHI - BLO) * 100
  //  轨迹点可能已经跑出取景框（发散），夹一下免得 SVG 坐标爆掉
  const clamp = (v: number, lo = -20, hi = 120) => Math.max(lo, Math.min(hi, v))
  const path = traj.map((t, i) =>
    `${i ? 'L' : 'M'}${clamp(qx(t.w)).toFixed(1)} ${clamp(qy(t.b)).toFixed(1)}`).join(' ')

  return (
    <div className="card">
      <h3>线性回归 <span className="hint">左：数据空间怎么拟合　右：参数空间怎么下坡</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{gdStep}</span><span className="scdl">梯度下降步</span></div>
          <div className="scdk"><span className={`scdn ${diverged ? '' : 'hot'}`}>
            {diverged || !Number.isFinite(mse) ? '发散' : mse.toFixed(3)}</span>
            <span className="scdl">均方误差 MSE</span></div>
          <div className="scdk"><span className="scdn">y={w.toFixed(2)}x+{b.toFixed(2)}</span><span className="scdl">当前直线</span></div>
          <div className="scdk"><span className={`scdn ${lr > lrMax ? '' : ''}`}>{(lr * 100).toFixed(0)}%</span>
            <span className="scdl">学习率（上界 {(lrMax * 100).toFixed(1)}%）</span></div>
        </div>

        <div className="lrpair">
          {/* ── 左：数据空间 ─────────────────────────── */}
          <div className="lrcol">
            <p className="gbsec"><b>数据空间</b><span>点、当前直线、残差（点到线的竖直距离）</span></p>
            <svg className="mlplot lrplot" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" vectorEffect="non-scaling-stroke" />
              {/*  OLS 那条最优线画成虚线：梯度下降要去的就是它 */}
              <line x1={px(XLO)} y1={py(wOls * XLO + bOls)} x2={px(XHI)} y2={py(wOls * XHI + bOls)}
                className="lrols" vectorEffect="non-scaling-stroke" />
              {points.map((p, k) => (
                <line key={k} x1={px(p.x)} y1={py(p.y)} x2={px(p.x)} y2={py(yAt(p.x))}
                  className="mlresid" vectorEffect="non-scaling-stroke" />
              ))}
              <line x1={px(XLO)} y1={py(yAt(XLO))} x2={px(XHI)} y2={py(yAt(XHI))}
                className="mlline" vectorEffect="non-scaling-stroke" />
              {points.map((p, k) => <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.6" className="mldot" />)}
            </svg>
          </div>

          {/* ── 右：参数空间 ─────────────────────────── */}
          <div className="lrcol">
            <p className="gbsec"><b>参数空间 (w, b)</b><span>底色=MSE 地形，十字=最小二乘解，折线=走过的路</span></p>
            <svg className="lrparam" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/*  地形：一格一个方块，越暗越低。用 log 压一下动态范围，否则谷底一片糊 */}
              {LOSS.map((row, j) => row.map((v, i) => {
                const t = (Math.log(v - LMIN + 1) / Math.log(LMAX - LMIN + 1))
                return <rect key={`${i}-${j}`} x={i / GRID * 100} y={100 - (j + 1) / GRID * 100}
                  width={100 / GRID + 0.4} height={100 / GRID + 0.4}
                  fill={`color-mix(in srgb, var(--f-tag) ${(t * 62).toFixed(0)}%, transparent)`} />
              }))}
              {/*  OLS 最优解 */}
              <line x1={qx(wOls) - 3} y1={qy(bOls)} x2={qx(wOls) + 3} y2={qy(bOls)} className="lrstar" vectorEffect="non-scaling-stroke" />
              <line x1={qx(wOls)} y1={qy(bOls) - 4} x2={qx(wOls)} y2={qy(bOls) + 4} className="lrstar" vectorEffect="non-scaling-stroke" />
              {/*  走过的路 */}
              <path d={path} className="lrtraj" fill="none" vectorEffect="non-scaling-stroke" />
              {traj.map((t, i) => (
                <circle key={i} cx={clamp(qx(t.w))} cy={clamp(qy(t.b))} r={i === traj.length - 1 ? 1.8 : 0.8}
                  className={i === traj.length - 1 ? 'lrnow' : 'lrdot'} />
              ))}
              {/*  当前点上那支负梯度箭头 —— 下一步就往它指的方向挪 */}
              {!diverged && (
                <line x1={clamp(qx(w))} y1={clamp(qy(b))}
                  x2={clamp(qx(w - lr * gw * 3))} y2={clamp(qy(b - lr * gb * 3))}
                  className="lrgrad" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
          </div>
        </div>

        {diverged
          ? <p className="scnote"><b>发散了。</b>学习率 {(lr * 100).toFixed(0)}% 越过了稳定上界 <b>{(lrMax * 100).toFixed(1)}%</b>
            （= 2/λmax，λmax 是损失 Hessian 的最大特征值 —— 这个界是<b>算出来的</b>，不是试出来的）。
            右图上能看见它在谷底两侧来回横跳、一次比一次远：每一步都迈过了最低点冲到对面更高处，
            下一步梯度更大、迈得更远，来回放大直到炸掉。把学习率调到 60% 以内再看。</p>
          : phase === 'done'
            ? <p className="scnote">梯度下降走到 y={w.toFixed(2)}x+{b.toFixed(2)}，MSE <b>{mse.toFixed(3)}</b>；
              它收敛到的正是<b>最小二乘闭式解</b>（右图那个十字）w={wOls}、b={bOls}。
              这就是机器"学习"最朴素的样子：定损失 → 对参数求梯度 → 沿负梯度更新 → 拟合。
              这条数据上学习率的稳定上界是 <b>{(lrMax * 100).toFixed(1)}%</b>，拧到 90% 就会炸给你看。</p>
            : <p className="scnote" style={{ opacity: .85 }}>
              这一步的梯度是 (∂/∂w, ∂/∂b) = (<b>{gw}</b>, <b>{gb}</b>)，
              下一步就沿它的<b>反方向</b>挪 lr×梯度 = ({(-lr * gw).toFixed(4)}, {(-lr * gb).toFixed(4)})。
              右图上那支短箭头指的就是这个方向。</p>}
      </div>
    </div>
  )
}
