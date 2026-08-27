/** 舞台：推荐系统矩阵分解 —— 用户隐向量·电影隐向量=评分，内积补全空缺("猜你喜欢") */
import type { RecSysState } from '@engine/kernels/recsys.ts'
import type { StageProps } from '../types.ts'

export function RecSysStage({ state }: StageProps<RecSysState>) {
  const { users, movies, known, rating, stage, pr, pc, phase } = state
  const done = phase === 'done'
  const knownSet = new Set(known)
  const showU = stage === 'userv' || stage === 'moviev' || stage === 'predict' || done
  const showM = stage === 'moviev' || stage === 'predict' || done
  return (
    <div className="card">
      <h3>推荐系统 · 矩阵分解 <span className="hint">评分 = 用户隐向量 · 电影隐向量，内积补全"猜你喜欢"</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{stage === 'predict' || done ? rating[pr]?.[pc] : '?'}</span><span className="scdl">预测评分</span></div>
          <div className="scdk"><span className="scdn">2 维</span><span className="scdl">隐空间(动作/文艺)</span></div>
          <div className="scdk"><span className="scdn">{rating.flat().filter(x => x !== null).length}/9</span><span className="scdl">已填评分</span></div>
        </div>

        <div className="rswrap">
          <table className="rstable">
            <thead>
              <tr>
                <th className="rscorner"></th>
                {movies.map((m, c) => (
                  <th key={c} className="rsmh">
                    <span className="rsname">{m.n}</span>
                    {showM && <span className="rsvec">({m.v.join(',')})</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, r) => (
                <tr key={r}>
                  <th className="rsuh">
                    <span className="rsname">{u.n}</span>
                    {showU && <span className="rsvec">({u.v.join(',')})</span>}
                  </th>
                  {movies.map((m, c) => {
                    const v = rating[r][c]
                    const isKnown = knownSet.has(`${r},${c}`)
                    const isPred = r === pr && c === pc && (stage === 'predict' || done)
                    const cls = ['rscell', isKnown ? 'known' : v !== null ? 'pred' : 'empty', isPred ? 'cur' : ''].filter(Boolean).join(' ')
                    return <td key={c} className={cls}>{v === null ? '?' : v}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="orcap">
            {stage === '' || stage === 'matrix' ? '按「下一步」开始:评分表大半空着,矩阵分解给用户和电影各学一个隐向量'
              : stage === 'userv' ? '用户隐向量:每人的口味(爱动作,爱文艺)——小明只爱动作、小红只爱文艺'
                : stage === 'moviev' ? '电影隐向量:每片的属性(动作度,文艺度);已知评分=用户·电影内积,都对得上'
                  : stage === 'predict' ? `预测:${users[pr].n}(${users[pr].v.join(',')})·${movies[pc].n}(${movies[pc].v.join(',')}) = ${rating[pr][pc]} 分`
                    : '所有空缺补全:给小明推盗梦空间(4)、不推小森林(0)'}
          </div>
        </div>

        {done
          ? <p className="scnote">用户只对极少数物品打过分,矩阵大半是空的。<b>矩阵分解</b>:给每个用户、每个电影各学一个<b>隐向量</b>(压进低维隐空间),让<b>评分 ≈ 用户隐向量·电影隐向量</b>(内积)。已知评分把隐向量学出来,空缺再用内积<b>预测</b>——口味和属性对得上(内积大)=推荐。这里隐向量能解释成"动作/文艺",真实系统是几十上百维、从海量评分自动学。Netflix、淘宝、抖音"猜你喜欢"的经典底子,和词向量同属<b>把对象嵌进隐空间</b>的表示学习。</p>
          : <p className="scnote" style={{ opacity: .85 }}>表格=评分(绿=已知、? =空缺)。每个用户一个隐向量(口味)、每个电影一个隐向量(属性)。<b>评分=两向量内积</b>:口味和属性越合拍、内积越大、评分越高。学好隐向量后,空缺处一算内积就是预测评分——这就是"猜你喜欢"。</p>}
      </div>
    </div>
  )
}
