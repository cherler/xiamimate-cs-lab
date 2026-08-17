/** 舞台：银行家算法 —— 资源矩阵 + 安全序列搜索 */
import type { BankerState } from '@engine/kernels/banker.ts'
import type { SimDocument } from '@engine/core/document.ts'
import type { StageProps } from '../types.ts'

export function BankerStage({ doc, trace, state, tab }: StageProps<BankerState>) {
  const res = String(doc.params.resources).split(',').map(s => s.trim()).filter(Boolean)
  const procs = doc.entities.filter(e => e.type === 'process')
  if (tab === 'search') return <Search trace={trace} state={state} res={res} />
  return <Matrix doc={doc} state={state} res={res} procs={procs} />
}

type Ent = SimDocument['entities'][number]

/**
 * 四张矩阵：Max / Allocation / Need / Work。
 * 教材上就是并排画的，考题也按这个格式作答 —— 版式跟着考题走。
 */
function Matrix({ doc, state, res, procs }: {
  doc: SimDocument; state: BankerState; res: string[]; procs: Ent[]
}) {
  const totals = res.map(r =>
    Number(doc.entities.find(e => e.type === 'resource' && e.id === r)?.attrs.total ?? 0))

  return (
    <div className="card">
      <h3>资源矩阵 <span className="hint">Need = Max − Allocation · 绿格表示本行 Need 已被 Work 满足</span></h3>
      <div className="body scroll">
        <table className="ptab bank">
          <thead>
            <tr>
              <th rowSpan={2}>进程</th>
              <th colSpan={res.length}>Max</th>
              <th colSpan={res.length}>Allocation</th>
              <th colSpan={res.length}>Need</th>
              <th rowSpan={2}>Finish</th>
            </tr>
            <tr>
              {['max', 'alloc', 'need'].flatMap(g => res.map(r => <th key={g + r} className="sub">{r}</th>))}
            </tr>
          </thead>
          <tbody>
            {procs.map(p => {
              const need = res.map(r => Number(p.attrs[`max_${r}`] ?? 0) - Number(p.attrs[`alloc_${r}`] ?? 0))
              const fits = res.every((r, k) => need[k] <= (state.work[r] ?? 0))
              const done = state.finish[p.id]
              return (
                <tr key={p.id} className={[
                  done ? 'done' : '', state.pid === p.id ? 'trying' : '',
                ].filter(Boolean).join(' ')}>
                  <th>{p.id}</th>
                  {res.map(r => <td key={'m' + r}>{String(p.attrs[`max_${r}`] ?? 0)}</td>)}
                  {res.map(r => <td key={'a' + r}>{String(p.attrs[`alloc_${r}`] ?? 0)}</td>)}
                  {need.map((n, k) => (
                    <td key={'n' + k} className={done ? '' : fits ? 'fit' : 'nofit'}>{n}</td>
                  ))}
                  <td className={done ? 'yes' : 'no'}>{done ? 'true' : 'false'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>Work（当前可用）</th>
              <td colSpan={res.length} className="dim">系统总量 {totals.join(' ')}</td>
              <td colSpan={res.length} className="dim">—</td>
              {res.map(r => <td key={'w' + r} className="work">{state.work[r] ?? 0}</td>)}
              <td className="dim">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

/** 搜索过程 —— 试探/接受/拒绝的完整链条，以及最终安全序列 */
function Search({ trace, state, res }: { trace: BankerState[]; state: BankerState; res: string[] }) {
  const tried = trace.filter(s => s.act === 'accept' || s.act === 'reject')
  const upto = tried.filter(s => s.i <= state.i)
  const total = Object.keys(state.finish).length
  /**
   * 结论只在推到最后一步时才给。
   * 之前用 trace.at(-1)，结果第 1 步就把安全序列摊在屏幕上 ——
   * 学生还没推，答案先到了，这个实验就白做了。
   */
  const done = state.act === 'safe' || state.act === 'unsafe'

  return (
    <div className="card">
      <h3>安全性检查 <span className="hint">每一次试探都记下来 —— 被拒绝的那些才是理解的关键</span></h3>
      <div className="body">
        {done ? (
          <div className={`bverdict ${state.act}`}>
            {state.act === 'safe'
              ? <><b>安全状态</b><span>安全序列：{state.sequence.join(' → ')}</span></>
              : <><b>不安全状态</b><span>找不到能让所有进程依次完成的顺序</span></>}
          </div>
        ) : (
          <div className="bverdict pending">
            <b>推演中</b>
            <span>已入序列 {state.sequence.length} / {total} —— 走到最后一步才出结论</span>
          </div>
        )}

        <ol className="btries">
          {upto.map(s => (
            <li key={s.i} className={`${s.act} ${s.i === state.i ? 'cur' : ''}`}>
              <span className="pid">{s.pid}</span>
              <span className="mark">{s.act === 'accept' ? '可满足' : '资源不足'}</span>
              <span className="detail">
                Need({res.map(r => s.need[s.pid]?.[r] ?? 0).join(' ')})
                {s.act === 'accept' ? ' ≤ ' : ' ≰ '}
                Work({res.map(r => s.work[r] ?? 0).join(' ')})
              </span>
            </li>
          ))}
          {upto.length === 0 ? <li className="none">还没开始试探</li> : null}
        </ol>

        <div className="bseq">
          <span className="k">已入序列</span>
          {state.sequence.length
            ? state.sequence.map(p => <b key={p}>{p}</b>)
            : <em>空</em>}
        </div>
      </div>
    </div>
  )
}
