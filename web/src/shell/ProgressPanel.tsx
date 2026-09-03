/**
 * 进度与错题本。
 *
 * 打开就该知道"下一步该做什么" —— 所以错题本排在最前面，
 * 总览排在后面。只给数字不给下一步，学生看完还是茫然。
 */
import { useMemo, useState } from 'react'
import type { Store } from '../progress.ts'
import { keyOf, reviewQueue, statOf, STATUS_LABEL, MASTER_STREAK } from '../progress.ts'
import type { CloudState } from '../sync.ts'
import { PROBLEMS } from '../problems.ts'
import type { AnyExperiment } from '../types.ts'

type Slot = { problemId: string; qi: number }

export function ProgressPanel({
  store, experiments, cloud, onJump, onClose, onClear, scopeLabel,
}: {
  store: Store
  /** 只统计这些实验（当前职业的实验集合，含软链）—— 面板按职业过滤，不再全站一锅端。 */
  experiments: AnyExperiment[]
  /** 记录存在哪儿 —— 面板上如实说，不要让用户以为换台机器还在 */
  cloud: CloudState
  /** 跳到某道题的某一问 */
  onJump: (experimentId: string, problemId: string, qi: number) => void
  onClose: () => void
  onClear: () => void
  /** 当前职业名，印在标题上，让"这是哪一科的进度"一目了然。 */
  scopeLabel?: string
}) {
  const [confirming, setConfirming] = useState(false)

  //  ⚠️ 只数**当前职业**的实验的题:面板此前用全站 PROBLEMS,导致每个职业点开都看同一个 0/全站,
  //     且和顶栏"N 实验"(按职业统计)对不上。改成按传入的 experiments 过滤。
  const expIds = useMemo(() => new Set(experiments.map(e => e.id)), [experiments])
  const all: Slot[] = useMemo(
    () => PROBLEMS.filter(p => expIds.has(p.experimentId))
      .flatMap(p => p.questions.map((_, qi) => ({ problemId: p.id, qi }))),
    [expIds],
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
          <h2>学习进度{scopeLabel ? ` · ${scopeLabel}` : ''}</h2>
          <span className="pgsum">
            已掌握 <b>{total.mastered}</b> / {total.total} 问
          </span>
          <CloudTag cloud={cloud} />
          <button className="pgx" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        {all.length === 0 ? (
          <div className="pgbody">
            <p className="pgempty">
              「{scopeLabel ?? '这个职业'}」目前还没有真题 —— AI 学伴的题库还没覆盖到这条线。
              先去有真题的职业(如 408 基础、算法)做题,答错的会进错题本。
            </p>
          </div>
        ) : (
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
              <b>改动了实验配置时不记账</b> —— 配置一改答案就变了另一道题，记进去是假账。
            </p>
            <p className="pgnote">{STORAGE_NOTE[cloud.kind]}</p>
            {(cloud.kind === 'synced' || cloud.kind === 'saving' || cloud.kind === 'error') && (
              <p className="pgnote dim">
                跨设备合并的口径：同一问在两台设备上都做过时，<b>次数取较大值而不是相加</b>
                （两边带着同一段历史，相加会把一次作答数成两次）；
                「最近答对没有」取更近的那一次。因此分头做题时次数会少算 ——
                这个数字只用来挑该复习的题，不是统计报表。
              </p>
            )}
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
        )}
      </div>
    </div>
  )
}

/**
 * 记录存在哪儿 —— **五种状态各说各的，不合并成一句含糊的话。**
 *
 * 「只存在本机」和「登录后可跨设备」是两条不同的下一步：前者没有下一步，
 * 后者的下一步是点右上角登录。合成一句「可能不同步」等于两边都没说清。
 */
const STORAGE_NOTE: Record<CloudState['kind'], string> = {
  unknown: '正在确认记录存在哪里…',
  standalone: '记录只存在这台机器的浏览器里，换设备不会同步。',
  anon: '记录只存在这台机器的浏览器里。右上角登录之后会自动同步到账号，换设备也在。',
  synced: '已同步到你的虾米伙伴账号，换设备也在。',
  saving: '正在同步到你的虾米伙伴账号…',
  error: '同步到账号失败了 —— 这台机器上的记录是完整的，联网后改动会自动补推。',
}

const CLOUD_TAG: Record<CloudState['kind'], string | null> = {
  unknown: null, standalone: null, anon: '仅本机',
  synced: '已同步', saving: '同步中…', error: '同步失败',
}

function CloudTag({ cloud }: { cloud: CloudState }) {
  const text = CLOUD_TAG[cloud.kind]
  if (!text) return null
  return (
    <span className={`pgcloud ${cloud.kind}`} title={STORAGE_NOTE[cloud.kind]}>{text}</span>
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
