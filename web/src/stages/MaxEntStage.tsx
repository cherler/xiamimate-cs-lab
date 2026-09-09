/**
 * 舞台：最大熵原理
 *
 * 这一屏的主角是**两排柱子重叠在一起**：实心的是"在约束平面上爬熵"搜出来的分布，
 * 虚线框是指数族解析解 p ∝ e^{Σλf}。搜索全程不知道指数族长什么样，
 * 却一轮一轮贴到虚线框上 —— **"softmax 是唯一答案"这句话就摆在柱子上，不在旁白里。**
 */
import type { MaxEntState } from '@engine/kernels/maxent.ts'
import type { StageProps } from '../types.ts'

export function MaxEntStage({ state }: StageProps<MaxEntState>) {
  const {
    mode, mu, probs, ent, fam, gap, feasErr, freedom, nCon, conText, famText, lamText,
    maxEnt, randBest, randN, naiveMean, solvable, gapToFeasible, phase, startLabel,
  } = state
  const started = probs.length > 0
  const maxP = Math.max(0.35, ...probs, ...fam)

  return (
    <div className="card">
      <h3>最大熵原理 <span className="hint">softmax/玻尔兹曼分布凭什么"天生合理"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{nCon}</span><span className="scdl">矩约束条数</span></div>
          <div className="scdk">
            <span className={`scdn ${freedom === 0 ? 'bad' : ''}`}>{freedom}</span>
            <span className="scdl">可行平面自由方向</span>
          </div>
          <div className="scdk">
            <span className="scdn hot">{started ? ent.toFixed(3) : '—'}</span>
            <span className="scdl">当前熵 / 上限 {maxEnt.toFixed(3)}</span>
          </div>
          <div className="scdk">
            <span className={`scdn ${Number.isFinite(gap) && gap < 1e-6 ? 'good' : ''}`}>
              {started && Number.isFinite(gap) ? (gap < 1e-9 ? '0' : gap.toExponential(1)) : '—'}
            </span>
            <span className="scdl">与指数族解的最大差</span>
          </div>
        </div>

        <div className="orcap">
          约束：<b>{conText}</b>
          {mode.includes('μ') && <>　（μ = {mu}）</>}
          　起点：{startLabel}
        </div>

        {phase === 'dead' ? (
          <>
            <p className="scnote">
              <b>这组约束没有解。</b>{famText}<br />
              满足矩约束的那张平面，跟"概率不能是负数"之间隔着一条 <b>{gapToFeasible}</b> 宽的缝 ——
              再怎么投影也进不去。（支撑集已经 63 个全枚举过，不是没找着，是真没有。）
            </p>
            <p className="scnote">
              ⚠️ <b>值得看一眼老式解法在这里会怎么样。</b>只盯"期望点数"这一条二分求 λ，
              它会<b>照样交给你一个分布</b>，均值 {naiveMean} —— 看着挺像回事，而方差那条约束它压根没看见。
              <b>「解出来了」和「解对了」是两件事。</b>
            </p>
          </>
        ) : (
          <>
            {/* 骰子分布：实心=搜出来的，虚线框=指数族解析解 */}
            <div className="mewrap">
              <div className="mebars">
                {(started ? probs : new Array(6).fill(0)).map((p, k) => (
                  <div key={k} className="mecol">
                    <span className="mepct">{(p * 100).toFixed(1)}%</span>
                    <div className="mebartrack">
                      {fam.length > 0 && (
                        <div className="mefam" style={{ height: `${(fam[k] / maxP) * 100}%` }} />
                      )}
                      <div className="mebar" style={{ height: `${(p / maxP) * 100}%` }} />
                    </div>
                    <span className="melab">{k + 1}</span>
                  </div>
                ))}
              </div>
              <div className="meentwrap">
                <span className="meentlab">熵</span>
                <div className="meenttrack"><div className="meentfill" style={{ width: `${(ent / maxEnt) * 100}%` }} /></div>
                <span className="meentval">{ent.toFixed(3)} / {maxEnt.toFixed(3)}</span>
              </div>
              <div className="orcap">
                {fam.length > 0
                  ? <>实心 = <b>爬熵搜出来的</b>（不假设任何形式）　虚线框 = 指数族解 {famText.split('　')[0]}　{lamText}</>
                  : <>这一档没有指数族解可比</>}
                　约束残差 {Number.isFinite(feasErr) ? feasErr : 0}
              </div>
            </div>

            {freedom === 0 ? (
              <p className="scnote">
                <b>自由方向 0 个 —— 最大熵原理在这一档一句话都没说上。</b>
                {nCon} 条矩约束 + "加起来=1" 一共 {nCon + 1} 个方程、6 个未知数，可行集缩成一个点。
                分布是被方程组<b>解出来</b>的，不是被熵<b>挑出来</b>的。
                而它跟只约束均值那一档爬出来的分布一模一样 ——
                <b>同一个答案，一次靠"约束给够了"，一次靠"没给够的部分别瞎猜"。</b>
              </p>
            ) : !solvable ? null : ent === 0 && nCon === 2 && Number.isInteger(mu) ? (
              <p className="scnote">
                <b>还剩 {freedom} 个自由方向，却一步也走不动。</b>
                方差=0 就是"每次都掷出同一面"，μ={mu} 又正好是整数 —— 答案被逼到单纯形的<b>角</b>上，
                每个方向刚一动就有概率变成负数，线搜索能走的那一段长度是 0。
                <b>"还有自由方向"和"走得动"是两回事。</b>
              </p>
            ) : phase === 'done' ? (
              <p className="scnote">
                搜索全程只做了两件事：<b>待在约束平面上</b>、<b>往熵高的地方走</b>。
                它从没听说过"指数族"，最后却停在了 {famText}，逐项差 {Number.isFinite(gap) ? (gap < 1e-9 ? '0' : gap.toExponential(2)) : '—'}。
                <b>所以 softmax 不是有人挑了个好看的公式</b> —— 它是"约束下最不武断"这句话的唯一解，
                逻辑回归、玻尔兹曼机、注意力里的 softmax，根都在这儿。
                <br />
                交叉验证：同一张可行平面上随机撒了 {randN} 个分布（hit-and-run，每一发都落在可行集里），
                撞到的最高熵 <b>{randBest}</b>，仍低于爬到的 {ent} —— 爬到的是顶，这是另一个来源说的。
              </p>
            ) : started ? (
              <p className="scnote" style={{ opacity: .85 }}>
                沿 {freedom} 个自由方向各做一次线搜索、再沿投影梯度走一次。
                盯着<b>虚线框和实心柱的差</b>：它掉到 0 的那一刻，"指数族"就从假设变成了结论。
              </p>
            ) : (
              <p className="scnote" style={{ opacity: .85 }}>按「下一步」开始在约束平面上爬熵。</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
