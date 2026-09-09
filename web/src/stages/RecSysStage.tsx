/**
 * 舞台：推荐系统 · 矩阵分解
 *
 * 主角是那张评分表：**绿=训练格（模型只看这些）、蓝框=留出格（一格都不看）、空白=真没打过分**。
 * 每一格印的是"预测 / 真值"，看得见模型在哪些格上离谱。
 *
 * 底下两块是补厚的落点：
 * ① 每轮的训练/留出 RMSE，跟"什么都不学、一律猜基准分"的基线并排 —— 模型至少得赢过它。
 * ② k × λ 的网格。只调一个旋钮会挑错，两个摆在一起才看得出。
 */
import type { RecSysState } from '@engine/kernels/recsys.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function RecSysStage({ state }: StageProps<RecSysState>) {
  const {
    users, movies, full, role, pred, round, trainRmse, testRmse, curve, baseRmse,
    coldUser, coldNorm, coldRmse, rotGap, rotPGap, nTrain, nTest,
    predMin, predMax, scene, dim, lambda, grid, bestK, bestLam, phase, log,
  } = state
  const done = phase === 'done'
  const started = round > 0
  const wild = predMax > 5.5 || predMin < 0.5

  return (
    <div className="card">
      <h3>推荐系统 · 矩阵分解 <span className="hint">评分 ≈ 用户隐向量 · 电影隐向量 —— 而这两个向量是从已知评分里<b>学</b>出来的</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{round}</span><span className="scdl">ALS 轮次</span></div>
          <div className="scdk"><span className="scdn">{dim} 维 / λ={lambda}</span><span className="scdl">隐空间</span></div>
          <div className="scdk"><span className="scdn hot">{started ? trainRmse : '—'}</span><span className="scdl">训练 RMSE（{nTrain} 格）</span></div>
          {/*  ⭐ 训练 RMSE 单独看没有意义：它旁边必须站着留出 RMSE，
               而留出 RMSE 旁边必须站着"什么都不学"的基线。 */}
          <div className="scdk">
            <span className={`scdn ${started ? (testRmse < baseRmse ? 'good' : 'bad') : ''}`}>{started ? testRmse : '—'}</span>
            <span className="scdl">留出 RMSE（{nTest} 格）</span>
          </div>
          <div className="scdk"><span className="scdn">{baseRmse}</span><span className="scdl">基线：一律猜 3.2</span></div>
        </div>

        <div className="rswrap">
          <table className="rstable">
            <thead>
              <tr>
                <th className="rscorner"></th>
                {movies.map(m => <th key={m} className="rsmh"><span className="rsname">{m}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((u, r) => (
                <tr key={u} className={r === coldUser ? 'rscold' : ''}>
                  <th className="rsuh"><span className="rsname">{u}{r === coldUser && <i className="rscoldtag">无评分</i>}</span></th>
                  {movies.map((_, c) => {
                    const k = role[r][c]
                    const p = started ? pred[r][c] : null
                    const off = k !== 'none' && p !== null ? Math.abs(p - full[r][c]) : 0
                    return (
                      <td key={c} className={`rs-${k}${off > 0.8 ? ' rsbad' : ''}`}>
                        {k === 'none'
                          ? <span className="rsq">·</span>
                          : <><span className="rspred">{p === null ? '?' : p}</span><span className="rstrue">{full[r][c]}</span></>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="orcap">
            每格上面是<b>预测</b>、下面是真值。<span className="rslg rs-train" />训练格（{nTrain}，模型只看这些）
            　<span className="rslg rs-test" />留出格（{nTest}，一格都不看）　<span className="rslg rs-none" />真没打过分
            　红底 = 差了 0.8 分以上
            {wild && <>　⚠️ 预测量程 <b className="bad">{predMin} ~ {predMax}</b>，而评分只有 1~5 分</>}
          </div>
        </div>

        {/*  k × λ 网格：只调一个旋钮会挑错 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>λ＼k</span>{[...new Set(grid.map(g => g.k))].map(k => <span key={k}>k={k}</span>)}</div>
            {[...new Set(grid.map(g => g.lam))].map(lam => (
              <div className="qsrow" key={lam}>
                <span>{lam}{lam === lambda ? ' ◀' : ''}</span>
                {grid.filter(g => g.lam === lam).map(g => (
                  <span key={g.k} className={g.k === bestK && g.lam === bestLam ? 'good' : g.test > baseRmse ? 'bad' : ''}>
                    {g.test > 9.9 ? g.test.toFixed(0) : g.test.toFixed(2)}
                  </span>
                ))}
              </div>
            ))}
            <div className="orcap">
              格子里是<b>留出 RMSE</b>（越小越好，基线 {baseRmse}）。全场最低在 <b>k={bestK}、λ={bestLam}</b>。
              真模型是<b>秩 2</b> 的 —— <b>但只调一个旋钮会挑错</b>，k 和 λ 得一起挑；
              而真实场景里你根本不知道真秩是多少。
            </div>
          </div>
        )}

        <div className="orcap">{rich(log)}</div>

        {done && (
          <p className="scnote">
            <b>隐向量是从那 {nTrain} 格里学出来的，不是写在代码里的。</b>ALS 每轮先把每个用户的向量按
            "让它的已知评分误差最小"重解一遍（电影向量当已知），再反过来重解每部电影的向量。
            {curve.length > 1 && <>训练 RMSE 从 {curve[0].train} 走到 {trainRmse}，留出从 {curve[0].test} 走到 {testRmse}。</>}
            <br />
            ⭐ <b>最容易被讲错的一件事</b>：把 P 乘上一个随机可逆矩阵、Q 乘上它的逆，
            隐向量整个面目全非（最大变化 <b>{rotPGap}</b>），而<b>所有预测逐格最大变化只有 {rotGap}</b>。
            所以"第一维是爱动作、第二维是爱文艺"这种话<b>讲不得</b> —— 隐向量本身不是定下来的东西，
            只有内积（也就是预测）才是模型。
            {coldUser >= 0 && <>
              <br />
              ⚠️ <b>冷启动</b>：「{users[coldUser]}」一条训练评分都没有，隐向量没有任何约束、被正则压到范数 <b>{coldNorm}</b>，
              于是给他的预测全是基准分，他那几格上的 RMSE 是 <b>{coldRmse}</b>（全表 {testRmse}）。
              <b>加维度、加轮次、调正则都救不了</b> —— 没有数据就是没有数据。
            </>}
          </p>
        )}
        {!done && started && (
          <p className="scnote" style={{ opacity: .85 }}>
            盯着两个 RMSE 的<b>差距</b>：训练那个一路降是必然的（模型就是照着训练格拟合的），
            留出那个才说明学到了没有。当前场景「{scene}」。
          </p>
        )}
      </div>
    </div>
  )
}
