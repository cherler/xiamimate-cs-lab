/** 舞台：逻辑回归 —— 两类散点 + 决策边界(z=0)转到中间，概率场按 sigmoid 渐变 */
import type { LogRegState } from '@engine/kernels/logreg.ts'
import type { StageProps } from '../types.ts'

const CA = 'var(--now)', CB = 'var(--miss)'
const LO = -3, HI = 3
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function LogRegStage({ state }: StageProps<LogRegState>) {
  const { gdStep, w1, w2, b, loss, acc, points, phase , wNorm, l2, data, separable, accCurve, normCurve } = state
  const hasLine = Math.abs(w1) + Math.abs(w2) > 1e-6
  // 边界 w1·x+w2·y+b=0 → y = -(w1 x + b)/w2
  const yb = (x: number) => -(w1 * x + b) / (w2 || 1e-6)
  // 概率场：沿 (w1,w2) 方向的线性渐变（近似 sigmoid 场）
  const nrm = Math.hypot(w1, w2) || 1
  const gx = w1 / nrm, gy = w2 / nrm
  return (
    <div className="card">
      <h3>逻辑回归 <span className="hint">把"拟合直线"改造成"分两类"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{gdStep}</span><span className="scdl">梯度下降步</span></div>
          <div className="scdk"><span className="scdn hot">{loss.toFixed(3)}</span><span className="scdl">交叉熵损失</span></div>
          <div className="scdk"><span className="scdn">{(acc * 100).toFixed(0)}%</span><span className="scdl">准确率</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lrprob" x1={`${50 - gx * 50}%`} y1={`${50 + gy * 50}%`} x2={`${50 + gx * 50}%`} y2={`${50 - gy * 50}%`}>
                <stop offset="0%" stopColor={CA} stopOpacity="0.14" />
                <stop offset="50%" stopColor="var(--panel)" stopOpacity="0" />
                <stop offset="100%" stopColor={CB} stopOpacity="0.14" />
              </linearGradient>
            </defs>
            {hasLine && <rect x="0" y="0" width="100" height="100" fill="url(#lrprob)" />}
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 决策边界 */}
            {hasLine && <line x1={px(LO)} y1={py(yb(LO))} x2={px(HI)} y2={py(yb(HI))} className="mlline" vectorEffect="non-scaling-stroke" />}
            {/* 点 */}
            {points.map((p, k) => (
              <circle key={k} cx={px(p.x)} cy={py(p.y)} r="1.8" fill={p.c === 0 ? CA : CB} opacity="0.92" />
            ))}
          </svg>
          <div className="orcap">
            {gdStep === 0 ? '起点 w=b=0：还没有边界,概率全 0.5、蒙对一半'
              : `决策边界(z=0 那条线)转到两类之间;两侧按 sigmoid 概率渐变染色;准确率 ${(acc * 100).toFixed(0)}%`}
          </div>
        </div>

        {/*  ── 准确率 / ‖w‖ 两条曲线（2026-09-08 加）──
             异或那一档：准确率是一条**贴地的平线**，"练不出来"一眼看穿；
             可分 + λ=0：‖w‖ 一路往上没有停 —— 最大似然解不存在，这件事只有画出来才看得见。 */}
        <div className="mlwrap">
          <p className="gbsec"><b>准确率 / 权重范数 怎么走的</b>
            <span>{separable
              ? (l2 === 0 ? '实线=准确率；虚线=‖w‖。可分且 λ=0 时 ‖w‖ 会一直涨，没有上界' : '实线=准确率；虚线=‖w‖。λ>0 把 ‖w‖ 按住了')
              : '实线=准确率 —— 它是一条贴地的平线：直线分不开异或，练多久都一样'}</span></p>
          <svg className="lgcurve" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(() => {
              const nHi = Math.max(...normCurve.map(c => c[1])) * 1.15 || 1
              const X = (i: number) => (accCurve.length < 2 ? 0 : i / (accCurve.length - 1) * 100)
              const Ya = (v: number) => 100 - v * 88 - 6
              const Yn = (v: number) => 100 - v / nHi * 88 - 6
              return <>
                <line x1="0" y1={Ya(1)} x2="100" y2={Ya(1)} className="lgfull" vectorEffect="non-scaling-stroke" />
                <path d={normCurve.map(([, v], i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Yn(v).toFixed(1)}`).join(' ')}
                  className="lgnorm" fill="none" vectorEffect="non-scaling-stroke" />
                <path d={accCurve.map(([, v], i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Ya(v).toFixed(1)}`).join(' ')}
                  className={separable ? 'lgacc' : 'lgacc bad'} fill="none" vectorEffect="non-scaling-stroke" />
                {accCurve.map(([g, v], i) => (
                  <circle key={g} cx={X(i)} cy={Ya(v)} r={g === gdStep ? 2.4 : 1.2}
                    className={g === gdStep ? 'lgnow' : 'lgdot'} />
                ))}
              </>
            })()}
          </svg>
          <div className="orcap">
            准确率 {accCurve.map(([g, v]) => `${g}:${(v * 100).toFixed(0)}%`).join('　')}
            <br />‖w‖ {normCurve.map(([, v]) => v).join(' → ')}
          </div>
        </div>

        {phase === 'done'
          ? (separable
            ? <p className="scnote">梯度下降 {gdStep} 步（数据「{data}」）：交叉熵 <b>{loss.toFixed(3)}</b>、
              准确率 <b>{(acc * 100).toFixed(0)}%</b>，决策边界把两类分开。
              逻辑回归 = 线性打分 z → <b>sigmoid</b> 出概率 → <b>交叉熵</b>当损失 → 梯度下降调 w、b；
              它就是<b>单个神经元 + sigmoid</b>，理解它就摸到了神经网络最小的那块砖。
              {l2 === 0 && acc >= 0.999
                ? <>　⚠️ 注意 ‖w‖ 那条虚线<b>一直在涨</b>（{normCurve[0][1]} → {normCurve[normCurve.length - 1][1]}）：
                  数据被完全分开时<b>最大似然解不存在</b> —— 边界越推越陡，损失趋近 0 但永远到不了。
                  把 <b>L2 调到 0.2</b> 再看：‖w‖ 稳在 1.13 左右不再涨，而准确率照样 100%。<b>正则项管的就是这个。</b></>
                : l2 > 0 ? <>　这一档开了 λ={l2}，‖w‖ 稳在 <b>{normCurve[normCurve.length - 1][1]}</b> 不再乱涨。</> : null}
              　把「数据形状」换成<b>异或</b>试试 —— 那是它做不到的事。</p>
            : <p className="scnote">数据是<b>异或</b>排布：练了 {gdStep} 步，准确率<b>卡在 {(acc * 100).toFixed(0)}%</b> 就上不去，
              ‖w‖ 也只涨到 {normCurve[normCurve.length - 1][1]} 就不动了 —— 往任何方向转都不会更好，模型自己"放弃"了。
              　这<b>不是没练够</b>，是<b>线性模型的天花板</b>：逻辑回归的决策边界永远是一条直线，
              而异或的两类互相插花，任何一条直线都分不开。
              　这正是神经网络要加<b>隐藏层</b>的原因 —— 先把点非线性地搬到另一个空间，再在那儿画直线。
              单个神经元做不到的事，两层就能做到；这条边界是 1969 年 Minsky 那本书里的著名论断。</p>)
          : <p className="scnote" style={{ opacity: .85 }}>线性打分 z=w₁x+w₂y+b，sigmoid 把 z 压成"属于第 1 类的概率"；
            边界（z=0）一侧判 1、另一侧判 0。梯度下降沿交叉熵下降方向调 w、b，把边界转到分得开的位置。
            {separable ? '' : '　—— 但这一档是异或，你会看到它转到哪儿都没用。'}</p>}
      </div>
    </div>
  )
}
