/**
 * 进度与错题本。
 *
 * 打开就该知道"下一步该做什么" —— 所以错题本排在最前面，
 * 总览排在后面。只给数字不给下一步，学生看完还是茫然。
 */
import { useMemo, useState } from 'react'
import type { Store } from '../progress.ts'
import { keyOf, reviewQueue, statOf, STATUS_LABEL, MASTER_STREAK } from '../progress.ts'
import { PROBLEMS } from '../problems.ts'
import type { AnyExperiment } from '../types.ts'

type Slot = { problemId: string; qi: number }

export function ProgressPanel({
  store, experiments, onJump, onClose, onClear,
}: {
  store: Store
  experiments: AnyExperiment[]
  /** 跳到某道题的某一问 */
  onJump: (experimentId: string, problemId: string, qi: number) => void
  onClose: () => void
  onClear: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  const all: Slot[] = useMemo(
    () => PROBLEMS.flatMap(p => p.questions.map((_, qi) => ({ problemId: p.id, qi }))),
    [],
  )
  const total = statOf(store, all)
  const queue = useMemo(() => reviewQueue(store, all), [store, all])

  const byGroup = useMemo(() => {
    const groups = [...new Set(experiments.map(e => e.group))]
    return groups.map(g => {
      const ids = experiments.filter(e => e.group === g).map(e => e.id)
      const slots = all.filter(s =>
        ids.includes(PROBLEMS.find(p => p.id === s.problemId)?.experimentId ?? ''))
      return { group: g, stat: statOf(store, slots) }
    })
  }, [store, experiments, all])

  const byExp = useMemo(() => experiments.map(e => {
    const slots = all.filter(s =>
      PROBLEMS.find(p => p.id === s.problemId)?.experimentId === e.id)
    return { exp: e, stat: statOf(store, slots) }
  }).filter(x => x.stat.total > 0), [store, experiments, all])

  const find = (problemId: string, qi: number) => {
    const p = PROBLEMS.find(x => x.id === problemId)!
    const e = experiments.find(x => x.id === p.experimentId)!
    return { p, e, q: p.questions[qi] }
  }

  return (
    <div className="pgmask" role="dialog" aria-label="学习进度与错题本" onClick={onClose}>
      <div className="pgwrap" onClick={e => e.stopPropagation()}>
        <header className="pghead">
          <h2>学习进度</h2>
          <span className="pgsum">
            已掌握 <b>{total.mastered}</b> / {total.total} 问
          </span>
          <button className="pgx" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        <div className="pgbody">
          {/* ── 错题本：先说下一步做什么 ── */}
          <section>
            <div className="pgcap">
              错题本
              <em>
                {queue.length > 0
                  ? `${queue.length} 问 —— 错过的题要连续答对 ${MASTER_STREAK} 次才移出去`
                  : ''}
              </em>
            </div>
            {queue.length === 0 ? (
              <p className="pgempty">
                {total.mastered === 0
                  ? '还没有作答记录。随便挑一个实验，把下面的真题做一遍，答错的会自动进这里。'
                  : '错题本是空的 —— 错过的题都已经重新掌握了。'}
              </p>
            ) : (
              <ul className="pgqueue">
                {queue.slice(0, 12).map(({ problemId, qi, rec, status }) => {
                  const { p, e, q } = find(problemId, qi)
                  return (
                    <li key={keyOf(problemId, qi)} className={status}>
                      <button onClick={() => onJump(e.id, p.id, qi)}>
                        <span className="tag">{e.title}</span>
                        <span className="qq">{q.prompt}</span>
                        <span className="meta">
                          {STATUS_LABEL[status]} · 做过 {rec.attempts} 次、错 {rec.wrong} 次
                        </span>
                      </button>
                    </li>
                  )
                })}
                {queue.length > 12 && (
                  <li className="pgmore">还有 {queue.length - 12} 问，做完上面这些再看</li>
                )}
              </ul>
            )}
          </section>

          {/* ── 四科总览 ── */}
          <section>
            <div className="pgcap">按科目</div>
            <div className="pggrid">
              {byGroup.map(({ group, stat }) => (
                <div className="pgcard" key={group}>
                  <span className="g">{group}</span>
                  <Bar stat={stat} />
                  <span className="n">{stat.mastered} / {stat.total} 问</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── 逐个实验 ── */}
          <section>
            <div className="pgcap">按实验</div>
            <ul className="pgexps">
              {byExp.map(({ exp, stat }) => (
                <li key={exp.id} className={stat.mastered === stat.total ? 'done' : ''}>
                  <span className="t">{exp.title}</span>
                  <Bar stat={stat} />
                  <span className="n">{stat.mastered}/{stat.total}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="pgfoot">
            <p className="pgnote">
              一次做对就算掌握；<b>错过的题要连续答对两次</b>才算真掌握。
              记录只存在这台机器的浏览器里，换设备不会同步。
              <b>改动了实验配置时不记账</b> —— 配置一改答案就变了另一道题，记进去是假账。
            </p>
            {confirming ? (
              <div className="pgconfirm">
                <span>确定清空全部记录？这一步撤不回来。</span>
                <button className="danger" onClick={() => { onClear(); setConfirming(false) }}>确定清空</button>
                <button onClick={() => setConfirming(false)}>算了</button>
              </div>
            ) : (
              <button className="pgclear" onClick={() => setConfirming(true)}>清空记录</button>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function Bar({ stat }: { stat: { total: number; mastered: number; shaky: number; wrong: number } }) {
  const pct = (n: number) => (stat.total ? (n / stat.total) * 100 : 0)
  return (
    <div className="pgbar" title={`已掌握 ${stat.mastered} · 巩固中 ${stat.shaky} · 答错 ${stat.wrong}`}>
      <i className="m" style={{ width: `${pct(stat.mastered)}%` }} />
      <i className="s" style={{ width: `${pct(stat.shaky)}%` }} />
      <i className="w" style={{ width: `${pct(stat.wrong)}%` }} />
    </div>
  )
}
