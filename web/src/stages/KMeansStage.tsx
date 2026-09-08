/**
 * 舞台：k-means —— 点按最近重心染色、重心移到均值，簇自己浮现
 *
 * 2026-09-08 补厚（见 kernels/kmeans.ts 顶上）。原来只有一张散点图和一个 inertia 数字，
 * 而这门算法的两条软肋（依赖初始化、k 得人定）**演不出来**。现在屏幕上多了两样：
 *   · 收敛曲线旁边并排摆着「最好的一次」那条线 —— 掉进局部最优时，两条明显岔开；
 *   · k 是旋钮，换 k 就换一张图（inertia 必然随 k 降，所以不能靠它选 k）。
 */
import type { KMeansState } from '@engine/kernels/kmeans.ts'
import type { StageProps } from '../types.ts'

//  k 最多 5，配色也得给到 5 种（原来只有 3 种，k=4/5 时两堆会同色）
const CL = ['var(--now)', 'var(--hit)', 'var(--miss)', 'var(--f-tag)', 'var(--f-idx)']
const LO = -3.6, HI = 3.6
const px = (x: number) => (x - LO) / (HI - LO) * 100
const py = (y: number) => 100 - (y - LO) / (HI - LO) * 100

export function KMeansStage({ state }: StageProps<KMeansState>) {
  const { iter, k, phase, points, assign, centroids, inertia, inertiaHist, bestInertia, gapPct, converged } = state
  const started = assign.some(a => a >= 0)
  const stuck = gapPct > 0.5
  return (
    <div className="card">
      <h3>k-means 聚类 <span className="hint">无标签的点，怎么自己分成几堆</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{iter + 1}</span><span className="scdl">第几轮</span></div>
          <div className="scdk"><span className="scdn">{k}</span><span className="scdl">簇数 k</span></div>
          <div className="scdk"><span className="scdn hot">{inertia}</span><span className="scdl">簇内平方和</span></div>
          {/*  「最好的一次」并排摆着 —— 「只保证收敛、不保证最优」这句话才立得住 */}
          <div className="scdk"><span className={`scdn ${stuck ? '' : 'hot'}`}>{bestInertia}</span>
            <span className="scdl">最好的一次（20 次重启）</span></div>
        </div>

        <div className="mlwrap">
          <svg className="mlplot" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={px(0)} y1="0" x2={px(0)} y2="100" className="mlaxis" />
            <line x1="0" y1={py(0)} x2="100" y2={py(0)} className="mlaxis" />
            {/* 点，按归属染色 */}
            {points.map((p, i) => (
              <circle key={i} cx={px(p[0])} cy={py(p[1])} r="1.7"
                fill={started && assign[i] >= 0 ? CL[assign[i] % CL.length] : 'var(--faint)'} opacity="0.9" />
            ))}
            {/* 重心，用 ✕ */}
            {centroids.map((c, k2) => (
              <g key={k2}>
                <line x1={px(c[0]) - 2.4} y1={py(c[1]) - 2.4} x2={px(c[0]) + 2.4} y2={py(c[1]) + 2.4} stroke={CL[k2 % CL.length]} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                <line x1={px(c[0]) - 2.4} y1={py(c[1]) + 2.4} x2={px(c[0]) + 2.4} y2={py(c[1]) - 2.4} stroke={CL[k2 % CL.length]} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                <circle cx={px(c[0])} cy={py(c[1])} r="3.4" fill="none" stroke={CL[k2 % CL.length]} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </svg>
          <div className="orcap">
            {!started ? '按「下一步」开始:先按最近重心分堆'
              : phase === 'assign' ? '分配:每个点归给离它最近的重心(✕)，按颜色分堆'
              : phase === 'move' || converged ? '更新:每个重心 ✕ 移到自己那堆点的平均位置'
              : ''}
          </div>
        </div>

        {/*  收敛曲线 + 「最好的一次」那条基准线：两条岔开 = 掉进局部最优 */}
        {inertiaHist.length > 1 && (
          <div className="mlwrap">
            <p className="gbsec"><b>簇内平方和怎么降的</b>
              <span>实线=这一次；虚线=同样 k、同样数据<b>最好的一次</b>。两条不合拢，就是停在了局部最优</span></p>
            <svg className="kmcurve" viewBox="0 0 100 100" preserveAspectRatio="none">
              {(() => {
                const hi = Math.max(...inertiaHist, bestInertia) * 1.08 || 1
                const X = (i: number) => (inertiaHist.length < 2 ? 0 : i / (inertiaHist.length - 1) * 100)
                const Y = (v: number) => 100 - v / hi * 92
                return <>
                  <line x1="0" y1={Y(bestInertia)} x2="100" y2={Y(bestInertia)} className="kmbest" vectorEffect="non-scaling-stroke" />
                  <path d={inertiaHist.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')}
                    className="kmline" fill="none" vectorEffect="non-scaling-stroke" />
                  {inertiaHist.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r="1.2" className="kmdot" />)}
                </>
              })()}
            </svg>
          </div>
        )}

        {phase === 'done'
          ? <p className="scnote">k-means 收敛（k={k}）：簇内平方和降到 <b>{inertia}</b>，点的归属稳定。
            全程<b>没用任何标签</b> —— 纯靠"分给最近重心 → 重心移到均值"两步交替，让结构自己浮现。
            {stuck
              ? <> 但这一次<b>掉进了局部最优</b>：同样的 k、同样的数据，最好的一次只要 <b>{bestInertia}</b>，
                这一次高出 <b>{gapPct}%</b>。k-means 保证收敛，<b>不保证收敛到最好</b> —— 实际用的时候要换不同初始跑很多次取最好
                （sklearn 的 <code>n_init</code> 就是干这个的）。把「初始重心」换成 k-means++ 再看。</>
              : <> 这一次落在了最好的那一档（{bestInertia}）。把「初始重心」换成<b>一角扎堆</b>试试 ——
                同样的算法、同样的数据，只因为起点不同就会停在明显更差的地方。</>}
            　还有一条：inertia <b>必然随 k 单调降</b>，所以<b>不能靠它选 k</b>（手肘法就是为这个存在的）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{phase === 'assign' ? '只看"谁离哪个 ✕ 近"，不看真实标签 —— 所以叫无监督。' : '重心跳到自己那堆的中心后，下一轮点的归属可能又变 —— 两步一直跳到不再变为止。'}簇内平方和每步都不增，这正是它必然收敛的原因。</p>}
      </div>
    </div>
  )
}
