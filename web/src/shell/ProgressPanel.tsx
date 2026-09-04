/**
 * 进度与错题本。
 *
 * 打开就该知道"下一步该做什么" —— 所以错题本排在最前面，
 * 总览排在后面。只给数字不给下一步，学生看完还是茫然。
 */
import { useMemo, useState } from 'react'
import type { Store, Mastery } from '../progress.ts'
import { keyOf, reviewAll, masteryOf, STATUS_LABEL, MASTER_STREAK } from '../progress.ts'
import type { CloudState } from '../sync.ts'
import { PROBLEMS } from '../problems.ts'
import type { AnyExperiment } from '../types.ts'

type Slot = { problemId: string; qi: number }

export function ProgressPanel({
  store, experiments, cloud, onJump, onOpenAi, onDrillFact, onClose, onClear, scopeLabel, aiFacts,
}: {
  store: Store
  /** 只统计这些实验（当前职业的实验集合，含软链）—— 面板按职业过滤，不再全站一锅端。 */
  experiments: AnyExperiment[]
  /** 记录存在哪儿 —— 面板上如实说，不要让用户以为换台机器还在 */
  cloud: CloudState
  /** 跳到某真题的某一问 */
  onJump: (experimentId: string, problemId: string, qi: number) => void
  /** 打开某实验的 AI 学伴（AI 错题的"再练"入口——题面是现场生成的，无法定位到原题，只能回去重出） */
  onOpenAi: (experimentId: string) => void
  /** 直接去练某实验里的某条事实（后端按 factId 定向出题）—— 推荐下一步"练最弱那条"用 */
  onDrillFact: (experimentId: string, factId: string) => void
  onClose: () => void
  onClear: () => void
  /** 当前职业名，印在标题上，让"这是哪一科的进度"一目了然。 */
  scopeLabel?: string
  /** 每实验 AI 学伴事实题数（掌握度分母） */
  aiFacts: Map<string, number>
}) {
  const [confirming, setConfirming] = useState(false)

  const expIds = useMemo(() => new Set(experiments.map(e => e.id)), [experiments])
  const trueSlotsOf = (id: string): Slot[] =>
    PROBLEMS.filter(p => p.experimentId === id).flatMap(p => p.questions.map((_, qi) => ({ problemId: p.id, qi })))
  const allTrue: Slot[] = useMemo(
    () => PROBLEMS.filter(p => expIds.has(p.experimentId)).flatMap(p => p.questions.map((_, qi) => ({ problemId: p.id, qi }))),
    [expIds])

  //  ⭐ 新主口径:**每实验掌握度**(真题 + AI 学伴事实合起来)。只列有题可练的(total>0)。
  //     attempted>0 的排前面(练过的先看),没练过的沉底。
  const byExp = useMemo(() => experiments
    .map(e => ({ exp: e, m: masteryOf(store, e.id, trueSlotsOf(e.id), aiFacts.get(e.id) ?? 0) }))
    .filter(x => x.m.total > 0)
    .sort((a, b) => (b.m.attempted > 0 ? 1 : 0) - (a.m.attempted > 0 ? 1 : 0)),
    [store, experiments, aiFacts])
  const expTotal = byExp.length
  const expMastered = byExp.filter(x => x.m.mastered === x.m.total).length

  //  错题本:真题 + AI 事实一起收(按当前职业过滤)
  const queue = useMemo(() => reviewAll(store, allTrue, expIds), [store, allTrue, expIds])

  //  按科目:每组「已全掌握实验 / 有题实验」+ 题级进度条
  const byGroup = useMemo(() => {
    const groups = [...new Set(byExp.map(x => x.exp.group))]
    return groups.map(g => {
      const rows = byExp.filter(x => x.exp.group === g)
      const items = rows.reduce((a, x) => ({
        mastered: a.mastered + x.m.mastered, shaky: a.shaky + x.m.shaky, wrong: a.wrong + x.m.wrong, total: a.total + x.m.total,
      }), { mastered: 0, shaky: 0, wrong: 0, total: 0 })
      return { group: g, mastered: rows.filter(x => x.m.mastered === x.m.total).length, total: rows.length, items }
    })
  }, [byExp])

  //  ⭐ 薄弱点诊断 + 推荐下一步(全部由进度数据确定性算出,不问大模型——和出题一个哲学)。
  const diag = useMemo(() => {
    const attempted = byExp.filter(x => x.m.attempted > 0)
    //  练了但没全掌握的,按题级掌握率升序=最该补的在前
    const inProgress = attempted.filter(x => x.m.mastered < x.m.total)
      .sort((a, b) => (a.m.mastered / a.m.total) - (b.m.mastered / b.m.total))
    const untouched = byExp.filter(x => x.m.attempted === 0)
    //  最弱科目:有作答的组里题级掌握率最低的
    const weakGroup = byGroup
      .map(g => ({ ...g, done: g.items.mastered, tried: g.items.mastered + g.items.shaky + g.items.wrong, ratio: g.items.total ? g.items.mastered / g.items.total : 1 }))
      .filter(g => g.tried > 0 && g.ratio < 1)
      .sort((a, b) => a.ratio - b.ratio)[0]
    //  推荐下一步:最弱的那条 AI 事实(能定向出题)优先 → 真题错题 → 补练中 → 开新的
    const topAi = queue.find(x => x.kind === 'ai')
    let rec: { text: string; expId?: string; drill?: { expId: string; factId: string } } | null = null
    if (topAi && topAi.kind === 'ai') rec = { text: `你最弱的一条:「${topAi.label}」`, drill: { expId: topAi.expId, factId: topAi.factId } }
    else if (queue.length > 0) rec = { text: `先清错题本的 ${queue.length} 题` }
    else if (inProgress[0]) rec = { text: `继续攻「${inProgress[0].exp.title}」`, expId: inProgress[0].exp.id }
    else if (untouched[0]) rec = { text: `开练「${untouched[0].exp.title}」`, expId: untouched[0].exp.id }
    return { attempted: attempted.length, inProgress, weakGroup, rec }
  }, [byExp, byGroup, queue])

  const findTrue = (problemId: string) => {
    const p = PROBLEMS.find(x => x.id === problemId)!
    return { p, e: experiments.find(x => x.id === p.experimentId) }
  }
  const titleOf = (id: string) => experiments.find(e => e.id === id)?.title ?? id

  return (
    <div className="pgmask" role="dialog" aria-label="学习进度与错题本" onClick={onClose}>
      <div className="pgwrap" onClick={e => e.stopPropagation()}>
        <header className="pghead">
          <h2>学习进度{scopeLabel ? ` · ${scopeLabel}` : ''}</h2>
          <span className="pgsum">
            掌握 <b>{expMastered}</b> / {expTotal} 实验
          </span>
          <CloudTag cloud={cloud} />
          <button className="pgx" onClick={onClose} aria-label="关闭">✕</button>
        </header>

        {expTotal === 0 ? (
          <div className="pgbody">
            <p className="pgempty">
              「{scopeLabel ?? '这个职业'}」还没有可练的题 —— 真题和 AI 学伴都还没覆盖到这条线。
            </p>
          </div>
        ) : (
        <div className="pgbody">
          {/* ── 诊断 + 推荐下一步（进度数据现算，不问大模型） ── */}
          <div className="pgdiag">
            {diag.attempted === 0 ? (
              <p className="pgdiag-t">还没开始练。挑一个实验，用「<b>AI 学伴 · 出题</b>」或做真题，进度就动起来了。</p>
            ) : (
              <>
                <p className="pgdiag-t">
                  练过 <b>{diag.attempted}</b> 个实验、掌握 <b>{expMastered}</b> 个。
                  {diag.weakGroup && <> 最弱在「<b>{diag.weakGroup.group}</b>」——题级掌握才 {Math.round(diag.weakGroup.ratio * 100)}%。</>}
                </p>
                {diag.rec && (
                  <div className="pgdiag-rec">
                    <span className="pgdiag-lbl">下一步</span>
                    <span className="pgdiag-do">{diag.rec.text}</span>
                    {diag.rec.drill && <button className="pgdiag-go" onClick={() => onDrillFact(diag.rec!.drill!.expId, diag.rec!.drill!.factId)}>出这条的题 →</button>}
                    {diag.rec.expId && <button className="pgdiag-go" onClick={() => onOpenAi(diag.rec!.expId!)}>去练 →</button>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── 错题本：先说下一步做什么（真题 + AI 学伴一起） ── */}
          <section>
            <div className="pgcap">
              错题本
              <em>
                {queue.length > 0
                  ? `${queue.length} 题 —— 错过的要连续答对 ${MASTER_STREAK} 次才移出去`
                  : ''}
              </em>
            </div>
            {queue.length === 0 ? (
              <p className="pgempty">
                错题本是空的 —— 做题时答错的（真题或 AI 学伴出题）会自动进这里。
              </p>
            ) : (
              <ul className="pgqueue">
                {queue.slice(0, 14).map(item => item.kind === 'true'
                  ? (() => {
                    const { p, e } = findTrue(item.problemId)
                    return (
                      <li key={keyOf(item.problemId, item.qi)} className={item.status}>
                        <button onClick={() => e && onJump(e.id, p.id, item.qi)}>
                          <span className="tag">{e?.title ?? p.experimentId}</span>
                          <span className="qq">{p.questions[item.qi].prompt}</span>
                          <span className="meta">{STATUS_LABEL[item.status]} · 做过 {item.rec.attempts} 次、错 {item.rec.wrong} 次</span>
                        </button>
                      </li>
                    )
                  })()
                  : (
                    <li key={item.key} className={item.status}>
                      <button onClick={() => onOpenAi(item.expId)}>
                        <span className="tag ai">{titleOf(item.expId)} · AI</span>
                        <span className="qq">{item.label}</span>
                        <span className="meta">{STATUS_LABEL[item.status]} · 做过 {item.rec.attempts} 次、错 {item.rec.wrong} 次 · 点开去 AI 学伴再练</span>
                      </button>
                    </li>
                  ))}
                {queue.length > 14 && (
                  <li className="pgmore">还有 {queue.length - 14} 题</li>
                )}
              </ul>
            )}
          </section>

          {/* ── 按科目：已全掌握实验 / 有题实验 ── */}
          <section>
            <div className="pgcap">按科目</div>
            <div className="pggrid">
              {byGroup.map(({ group, mastered, total, items }) => (
                <div className="pgcard" key={group}>
                  <span className="g">{group}</span>
                  <Bar stat={items} />
                  <span className="n">{mastered} / {total} 实验</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── 逐个实验：真题 + AI 学伴合起来的掌握度 ── */}
          <section>
            <div className="pgcap">按实验<em>真题 + AI 学伴合起来算</em></div>
            <ul className="pgexps">
              {byExp.map(({ exp, m }) => (
                <li key={exp.id} className={m.mastered === m.total ? 'done' : ''}>
                  <span className="t">{exp.title}</span>
                  <Bar stat={m} />
                  <span className="n">{m.mastered}/{m.total}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="pgfoot">
            <p className="pgnote">
              <b>掌握度 = 真题 + AI 学伴出题合起来算</b>：一次做对就算掌握，错过的题要连续答对两次才算真掌握。
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
