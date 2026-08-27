/** 舞台：动态规划/编辑距离 —— 逐格填表，每格由三个已算邻居推出 */
import type { EditDistState } from '@engine/kernels/editdist.ts'
import type { StageProps } from '../types.ts'

export function EditDistStage({ state }: StageProps<EditDistState>) {
  const { a, b, table, ci, cj, match, val, phase } = state
  const started = ci > 0
  const rowH = ['ε', ...a.split('')]   // 行标：ε + a
  const colH = ['ε', ...b.split('')]   // 列标：ε + b
  const srcs = new Set<string>()
  if (started) { srcs.add(`${ci - 1},${cj - 1}`); srcs.add(`${ci - 1},${cj}`); srcs.add(`${ci},${cj - 1}`) }
  return (
    <div className="card">
      <h3>动态规划 · 编辑距离 <span className="hint">记住子问题，把指数搜索压成填表</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{a} → {b}</span><span className="scdl">把 a 改成 b</span></div>
          <div className="scdk"><span className="scdn">{started ? `(${ci},${cj})` : '—'}</span><span className="scdl">当前格</span></div>
          <div className="scdk"><span className="scdn hot">{phase === 'done' ? val : (started ? val : '?')}</span><span className="scdl">{phase === 'done' ? '编辑距离(右下角)' : '本格值'}</span></div>
        </div>

        {/* DP 表 */}
        <div className="edwrap">
          <table className="edtable">
            <thead>
              <tr><th /><th className="edhead" />{colH.map((c, j) => <th key={j} className="edhead">{c}</th>)}</tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={i}>
                  <th className="edhead">{rowH[i]}</th>
                  <td className="edgap" />
                  {row.map((v, j) => {
                    const isCur = i === ci && j === cj
                    const isSrc = srcs.has(`${i},${j}`) && !isCur
                    const isAns = phase === 'done' && i === a.length && j === b.length
                    return (
                      <td key={j} className={`edcell ${v === null ? 'empty' : ''} ${isCur ? 'cur' : ''} ${isSrc ? 'src' : ''} ${isAns ? 'ans' : ''}`}>
                        {v === null ? '' : v}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="orcap">
            {started
              ? <span>格 ({ci},{cj})：a[{ci}]=<b>{a[ci - 1]}</b> vs b[{cj}]=<b>{b[cj - 1]}</b> → {match ? '相同，抄左上' : '不同，1 + min(左上/上/左)'} = <b>{val}</b></span>
              : '按「下一步」逐格填表（蓝=当前格，浅色=它依赖的三个邻居）'}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">整张表填完:把 <b>{a}</b> 改成 <b>{b}</b> 最少 <b>{val}</b> 步(右下角)。每格只看三个已算好的邻居就 O(1) 推出，{a.length * b.length} 格 O(n·m) 填完——这就是<b>动态规划</b>:记住每个子问题的答案，把朴素递归的<b>指数级重复计算压成多项式</b>。序列比对、最短路(Bellman-Ford)、背包、DNA/语音对齐,底子都是它。</p>
          : started && <p className="scnote" style={{ opacity: .85 }}>{match ? '两个字符相同——不用编辑，直接继承左上角的子问题答案。' : '不同——在"替换/删除/插入"三条路里挑最省的那条(+1)。三个邻居都是已经算好的子问题,直接查表 O(1)。'}</p>}
      </div>
    </div>
  )
}
