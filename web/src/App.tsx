/**
 * 宿主框架。
 *
 * 单向数据流（验收标准 3）：
 *   参数 / 选中实验 / 当前步  →  重算 doc → 校验 → 编译 → 跑出轨迹 → 所有视图从轨迹派生
 * 视图之间从不互相写。改一个状态，五块地方一起变。
 */
import { useMemo, useState } from 'react'
import { run } from '@engine/core/kernel.ts'
import { validateDocument } from '@engine/ai/schema.ts'
import type { SimDocument, Entity } from '@engine/core/document.ts'
import { EXPERIMENTS } from './registry.ts'
import { AxisBand } from './shell/AxisBand.tsx'
import { StepLog, ParamPanel, Readouts, Violations, Bounds } from './shell/Panels.tsx'
import { ProblemPanel } from './shell/ProblemPanel.tsx'
import { SequenceEditor, parseSequence, formatSequence } from './shell/SequenceEditor.tsx'
import { EntityEditor } from './shell/EntityEditor.tsx'
import { problemsFor, PROBLEMS } from './problems.ts'
import { ProgressPanel } from './shell/ProgressPanel.tsx'
import * as progress from './progress.ts'

export default function App() {
  const [expId, setExpId] = useState(EXPERIMENTS[0].id)
  const [overrides, setOverrides] = useState<Record<string, Record<string, number | string>>>({})
  const [index, setIndex] = useState(0)
  const [tab, setTab] = useState(EXPERIMENTS[0].tabs[0].id)
  const [playing, setPlaying] = useState(false)
  const [problemId, setProblemId] = useState<string | null>(null)
  /**
   * 驱动序列拆成两份状态，不能只留文本：
   *   seqText   输入框里的原文（可能正处在半截的、解析不通过的状态）
   *   seqValues **上一次解析通过**的结果 —— 真正喂给仿真的就是它
   * 只留文本的话，一敲坏字符仿真就会跳回原始序列，而不是停在上一次有效的地方。
   */
  const [seqText, setSeqText] = useState<Record<string, string | undefined>>({})
  const [seqValues, setSeqValues] = useState<Record<string, number[] | undefined>>({})
  /** 学习进度（只存本地）；懒加载一次，之后全在内存里 */
  const [store, setStore] = useState<progress.Store>(() => progress.load())
  const [showProgress, setShowProgress] = useState(false)
  /** 从错题本跳过来时要高亮的那一问 */
  const [focusQ, setFocusQ] = useState<number | null>(null)
  /** 实体表的改动；undefined = 没改过，用 baseDoc.entities */
  const [entities, setEntities] = useState<Record<string, Entity[] | undefined>>({})

  const exp = EXPERIMENTS.find(e => e.id === expId)!
  const problems = useMemo(() => problemsFor(exp.id), [exp])
  const problem = problems.find(p => p.id === problemId) ?? null

  // ── 唯一的真相来源：doc。选了真题就用真题的配置，用户改的参数/序列叠在上面。──
  const baseDoc = problem?.doc ?? exp.defaultDoc

  /** 序列编辑器里应当显示的文本：改过就用改过的，没改过就从 baseDoc 现算 */
  const baseSeq = exp.sequence
    ? baseDoc.streams.find(s => s.name === exp.sequence!.stream)?.values ?? []
    : []
  const seqRaw = seqText[exp.id] ?? (exp.sequence ? formatSequence(baseSeq, exp.sequence) : '')
  /** 真正喂给仿真的序列：改过且解析通过就用它，否则用 baseDoc 里那条 */
  const seqLive = seqValues[exp.id]
  const seqKey = seqLive ? seqLive.join(',') : ''

  const entLive = entities[exp.id]
  const entKey = entLive ? JSON.stringify(entLive) : ''

  const doc: SimDocument = useMemo(() => {
    const d: SimDocument = {
      ...baseDoc,
      params: { ...baseDoc.params, ...(overrides[exp.id] ?? {}) },
      entities: entLive ?? baseDoc.entities,
    }
    if (exp.sequence && seqLive) {
      const name = exp.sequence.stream
      d.streams = baseDoc.streams.map(s => (s.name === name ? { ...s, values: seqLive } : s))
    }
    return d
  // seqLive 是数组，按内容做依赖才不会每帧重算
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // entLive 是数组，按内容做依赖才不会每帧重算
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDoc, exp.id, exp.sequence, overrides, seqKey, entKey])

  // 参数或序列被改得偏离原题时要明说 —— 因为答案是按当前配置算的
  const seqDrifted = problem !== null && exp.sequence !== undefined && seqLive !== undefined &&
    formatSequence(baseSeq, exp.sequence) !== formatSequence(seqLive, exp.sequence)
  const entDrifted = entLive !== undefined &&
    JSON.stringify(entLive) !== JSON.stringify(baseDoc.entities)
  const drifted = seqDrifted || (problem !== null && entDrifted) || (problem !== null &&
    Object.entries(overrides[exp.id] ?? {}).some(([k, v]) => problem.doc.params[k] !== v))

  /** 供真题里"改个参数再算一遍"型的题用 */
  const runDoc = useMemo(() => (d: SimDocument) => {
    try { return run(exp.kernel.compile(d)) as unknown[] } catch { return [] }
  }, [exp])

  const violations = useMemo(() => validateDocument(doc), [doc])

  const trace = useMemo(() => {
    if (violations.length > 0) return []
    try { return run(exp.kernel.compile(doc)) as never[] } catch { return [] }
  }, [exp, doc, violations])

  const clamped = Math.min(index, Math.max(0, trace.length - 1))
  const state = trace[clamped]

  function selectExp(id: string) {
    const e = EXPERIMENTS.find(x => x.id === id)!
    setExpId(id); setTab(e.tabs[0].id); setIndex(0); setPlaying(false); setProblemId(null)
    setSeqText(t => ({ ...t, [id]: undefined })); setSeqValues(v => ({ ...v, [id]: undefined }))
    setEntities(e => ({ ...e, [id]: undefined }))
  }
  function pickProblem(id: string | null) {
    setProblemId(id)
    setOverrides(o => ({ ...o, [exp.id]: {} }))
    clearSeq()
    setIndex(0); setPlaying(false)
  }
  function restoreProblem() {
    setOverrides(o => ({ ...o, [exp.id]: {} }))
    clearSeq()
    setIndex(0)
  }
  function clearSeq() {
    setSeqText(t => ({ ...t, [exp.id]: undefined }))
    setSeqValues(v => ({ ...v, [exp.id]: undefined }))
    setEntities(e => ({ ...e, [exp.id]: undefined }))
  }
  function editEntities(next: Entity[]) {
    setEntities(e => ({ ...e, [exp.id]: next }))
    setIndex(0); setPlaying(false)
  }
  function resetEntities() {
    setEntities(e => ({ ...e, [exp.id]: undefined }))
    setIndex(0); setPlaying(false)
  }
  function editSeq(text: string) {
    setSeqText(t => ({ ...t, [exp.id]: text }))
    // 只有解析通过才动仿真；不通过就保持上一次有效的序列
    const r = exp.sequence ? parseSequence(text, exp.sequence) : null
    if (r?.ok) { setSeqValues(v => ({ ...v, [exp.id]: r.values })); setIndex(0); setPlaying(false) }
  }
  function resetSeq() {
    clearSeq()
    setIndex(0); setPlaying(false)
  }
  function setParam(key: string, v: number | string) {
    setOverrides(o => ({ ...o, [exp.id]: { ...(o[exp.id] ?? {}), [key]: v } }))
    setIndex(0); setPlaying(false)
  }
  function seek(i: number) { setIndex(i); }

  function recordAnswer(problemId: string, qi: number, correct: boolean) {
    setStore(s => {
      const next = progress.record(s, progress.keyOf(problemId, qi), correct)
      progress.save(next)
      return next
    })
  }
  /** 从错题本跳到某实验的某道题的某一问 */
  function jumpToQuestion(experimentId: string, problemId: string, qi: number) {
    if (experimentId !== expId) selectExp(experimentId)
    setProblemId(problemId)
    setOverrides(o => ({ ...o, [experimentId]: {} }))
    setSeqText(t => ({ ...t, [experimentId]: undefined }))
    setSeqValues(v => ({ ...v, [experimentId]: undefined }))
    setEntities(e => ({ ...e, [experimentId]: undefined }))
    setIndex(0); setPlaying(false)
    setShowProgress(false)
    setFocusQ(qi)
  }

  /** 页眉上的进度数字 —— 全量统计一次，便宜 */
  const { mastered, totalQ, reviewCount } = useMemo(() => {
    const all = PROBLEMS.flatMap(p => p.questions.map((_, qi) => ({ problemId: p.id, qi })))
    const st = progress.statOf(store, all)
    return {
      mastered: st.mastered,
      totalQ: st.total,
      reviewCount: progress.reviewQueue(store, all).length,
    }
  }, [store])

  const grouped = EXPERIMENTS.reduce<Record<string, typeof EXPERIMENTS>>((acc, e) => {
    (acc[e.group] ??= []).push(e); return acc
  }, {})

  return (
    <div className="app">
      <header className="top">
        <h1>{exp.title}</h1>
        <span className="sub">{exp.subtitle}</span>
        <div className="chips">
          {violations.length > 0
            ? <span className="chip warn">配置不合法</span>
            : <span className="chip">{trace.length} 步</span>}
          {problem && <span className="chip on">{problem.source}</span>}
          <span className="chip">{EXPERIMENTS.length} 个实验</span>
          <button className="chip act" onClick={() => setShowProgress(true)}>
            进度 {mastered} / {totalQ}
            {reviewCount > 0 && <b className="dot">{reviewCount}</b>}
          </button>
        </div>
      </header>

      <div className="grid">
        {/* 左：实验目录 */}
        <nav className="card nav" aria-label="实验目录">
          {Object.entries(grouped).map(([group, list]) => (
            <div key={group}>
              <div className="grp">{group}</div>
              {list.map((e, i) => (
                <button
                  key={e.id}
                  className={e.id === expId ? 'on' : ''}
                  onClick={() => selectExp(e.id)}
                  aria-current={e.id === expId}
                >
                  <span className="n">{String(EXPERIMENTS.indexOf(e) + 1).padStart(2, '0')}</span>
                  <span>{e.title}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* 中：舞台 + 轴 + 日志 */}
        <div className="col">
          <div className="tabs" role="tablist">
            {exp.tabs.map(t => (
              <button
                key={t.id} role="tab"
                aria-selected={t.id === tab}
                onClick={() => setTab(t.id)}
              >{t.label}</button>
            ))}
          </div>

          {exp.sequence && (
            <SequenceEditor
              spec={exp.sequence} text={seqRaw}
              onText={editSeq} onReset={resetSeq}
            />
          )}

          {exp.entitySpec && (
            <EntityEditor
              spec={exp.entitySpec} doc={doc} dirty={entDrifted}
              onChange={editEntities} onReset={resetEntities}
            />
          )}

          {violations.length > 0
            ? <Violations items={violations} />
            : state
              ? <>
                  {/* 舞台外面套一层稳定容器：测试要认出"哪块是舞台"，
                      不能靠"中列第几张卡片"猜 —— 每加一个编辑器就会误判一次 */}
                  <div className="stagewrap">
                    <exp.Stage doc={doc} trace={trace} index={clamped} state={state} tab={tab} />
                  </div>
                  <AxisBand
                    exp={exp} trace={trace} index={clamped}
                    playing={playing}
                    onSeek={seek}
                    onTogglePlay={() => setPlaying(p => !p)}
                  />
                  <StepLog exp={exp} trace={trace} index={clamped} onSeek={seek} />
                  <ProblemPanel
                    problems={problems} activeId={problemId} trace={trace} doc={doc}
                    runDoc={runDoc} drifted={drifted}
                    onPick={id => { pickProblem(id); setFocusQ(null) }}
                    onRestore={restoreProblem} onSeek={seek}
                    onAnswer={recordAnswer}
                    statusOf={(pid, qi) => progress.statusOf(store.q[progress.keyOf(pid, qi)])}
                    focusQ={focusQ}
                  />
                </>
              : <div className="viol"><div className="t">无轨迹</div><p>当前配置跑不出任何一步。</p></div>}
        </div>

        {/* 右：参数 + 读数 */}
        <div className="col">
          <ParamPanel specs={exp.params} values={doc.params} onChange={setParam}
                      emptyNote={exp.paramsNote} />
          {state && <Readouts items={exp.readouts(state, doc, clamped)} />}
        </div>
      </div>

      <Bounds items={exp.bounds} />

      {showProgress && (
        <ProgressPanel
          store={store} experiments={EXPERIMENTS}
          onJump={jumpToQuestion}
          onClose={() => setShowProgress(false)}
          onClear={() => { progress.clearAll(); setStore(progress.load()) }}
        />
      )}
    </div>
  )
}
