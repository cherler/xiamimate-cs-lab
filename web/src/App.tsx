/**
 * 宿主框架。
 *
 * 单向数据流（验收标准 3）：
 *   参数 / 选中实验 / 当前步  →  重算 doc → 校验 → 编译 → 跑出轨迹 → 所有视图从轨迹派生
 * 视图之间从不互相写。改一个状态，五块地方一起变。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { ChromeHeader, ChromeFooter } from './shell/PlatformChrome.tsx'
import { Dock } from './shell/Dock.tsx'
import { GuideOverlay } from './shell/GuideOverlay.tsx'
import { FitBox } from './shell/FitBox'
import { Brief } from './shell/Brief'
import { briefFor } from './brief.ts'
import { TipLayer } from './shell/Tip.tsx'
import { cardsOf } from './guide.ts'
import * as progress from './progress.ts'
import * as sync from './sync.ts'

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
  /**
   * 学习进度。**本地那份始终是权威的读写目标**；登录后再跟云端主本合并
   * （见 sync.ts）。懒加载一次，之后全在内存里。
   */
  const [store, setStore] = useState<progress.Store>(() => progress.load())
  /** 云端状态：没主站 / 没登录 / 已同步 / 正在写 / 写失败 —— 面板上如实显示 */
  const [cloud, setCloud] = useState<sync.CloudState>({ kind: 'unknown' })
  const [showProgress, setShowProgress] = useState(false)
  /**
   * 讲解浮层开关。关掉的状态存 localStorage —— 学会了的人不该每换一个实验就再关一次。
   * 「页面各区域」那一串已经并进每个实验的卡片序列里，所以不再有"讲实验/讲页面"两档。
   */
  const [guideOff, setGuideOff] = useState(() => {
    try { return localStorage.getItem('cslab.guide.closed') === '1' } catch { return false }
  })

  /** 从错题本跳过来时要高亮的那一问 */
  const [focusQ, setFocusQ] = useState<number | null>(null)
  /** 底部坞：同一时刻只露一块（日志 / 真题 / 边界），以及收不收起 */
  const [dock, setDock] = useState('log')
  const [dockFolded, setDockFolded] = useState(false)
  /** 实体表的改动；undefined = 没改过，用 baseDoc.entities */
  const [entities, setEntities] = useState<Record<string, Entity[] | undefined>>({})

  const exp = EXPERIMENTS.find(e => e.id === expId)!

  /**
   * **必须 memo。** `cardsOf()` 每次调用都造一个新数组，而 App 在播放时每秒重渲染
   * 几十次 —— 浮层那几个 effect 的依赖里有 cards，新数组会让它们每帧都
   * 退订再订阅一遍 document 的事件。功能上看不出来，但那是白烧的。
   */
  const guideCards = useMemo(() => cardsOf(expId, {
    params: exp.params,
    seqPresets: exp.sequence?.presets,
    entPresets: exp.entitySpec?.presets,
    hasSequence: !!exp.sequence,
    hasEntities: !!exp.entitySpec,
  }), [expId, exp])
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

  /**
   * 实验单的两点状态：押的哪个、有没有出去动过手。
   *
   * 记在 localStorage，**不进后端同步** —— 同步的是学习成果（错题本、已掌握），
   * "我当时猜的是哪个"跨设备搬过去没有意义，还会把 sync.ts 里验过的合并规则搅浑。
   */
  const brief = briefFor(exp.id)
  const [briefRecs, setBriefRecs] = useState<Record<string, { guess: number | null; tried: boolean }>>(() => {
    try { return JSON.parse(localStorage.getItem('cslab.brief') ?? '{}') } catch { return {} }
  })
  const [briefOpen, setBriefOpen] = useState(false)
  //  只在**换实验**时决定要不要自动弹：第一次见才弹，之后靠页眉那颗按钮请回来
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setBriefOpen(!!briefFor(expId) && !briefRecs[expId]) }, [expId])
  const briefRec = briefRecs[exp.id] ?? { guess: null, tried: false }
  /*
   * 实验单摊开时把讲解浮层收起来。
   *
   * 两块解释同时在屏幕上，正是用户抱怨的那种"看不懂" —— 实验单答的是
   * "这实验是什么、要我做什么"，讲解答的是"屏幕上这块是什么"，
   * 头一回进来只该看见前者。走 body 上的一个属性而不是给浮层加 prop：
   * 浮层一卸载就会丢掉翻到第几页，而这里只是想让它先让开。
   */
  useEffect(() => {
    document.body.toggleAttribute('data-brief-open', briefOpen)
    return () => document.body.removeAttribute('data-brief-open')
  }, [briefOpen])
  const saveBrief = (patch: Partial<{ guess: number | null; tried: boolean }>) => {
    setBriefRecs(m => {
      const next = { ...m, [exp.id]: { ...(m[exp.id] ?? { guess: null, tried: false }), ...patch } }
      try { localStorage.setItem('cslab.brief', JSON.stringify(next)) } catch { /* 隐私模式 */ }
      return next
    })
  }

  const violations = useMemo(() => validateDocument(doc), [doc])

  const trace = useMemo(() => {
    if (violations.length > 0) return []
    try { return run(exp.kernel.compile(doc)) as never[] } catch { return [] }
  }, [exp, doc, violations])

  /**
   * ④ 的结论**现算** —— 拿用户此刻的配置重跑，不是一句写死的话。
   * 这是整个仓库的规矩（`docs/standards.md`）：屏幕上每个数都从验过的轨迹派生。
   */
  const verdict = useMemo(() => {
    if (!brief) return null
    //  实验单不认识 SimDocument（它要能被 node 里的内容测试 import），
    //  两边在 `unknown` 上握手，重跑的活还是 runDoc 自己干
    try { return brief.verdict({ doc: doc as never, trace, runDoc: runDoc as (d: unknown) => unknown[] }) }
    catch { return null }
  }, [brief, doc, trace, runDoc])

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
      //  **先落本地再推云端。** 本地那份是权威的读写目标，云端只是主本 ——
      //  网断了、没登录、后端挂了，都不该让用户少记一道题。
      if (cloud.kind === 'synced' || cloud.kind === 'saving' || cloud.kind === 'error') {
        sync.schedulePush(next, setCloud)
      }
      return next
    })
  }
  /**
   * 开页面时跟云端对一次。
   *
   * `useRef` 守着只跑一次：StrictMode 下 effect 会被故意执行两遍，
   * 两次 firstSync 会各拉一次、各推一次 —— 第二次必然撞 409 再合并一轮。
   * 结果虽然是对的，但那是一整套并发路径在开发环境里每次都跑，
   * **真出问题时反而分不清是 bug 还是 StrictMode**。
   */
  const synced = useRef(false)
  useEffect(() => {
    if (synced.current) return
    synced.current = true
    void sync.firstSync(progress.load()).then(({ store: merged, state }) => {
      setCloud(state)
      //  合并结果要落回本地：下次离线打开时看到的就是合并过的那份。
      if (state.kind === 'synced') { progress.save(merged); setStore(merged) }
    })
  }, [])

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
    //  真题现在在底部坞里 —— 跳过去得把那一格露出来，否则"跳到某一问"跳了个寂寞
    setDock('prob'); setDockFolded(false)
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
    <>
    {/* 平台横条在 .app 外面：它要通栏，而 .app 是 1420px 居中的。
        没并入主站时这两个组件什么都不渲染（连占位的空 div 都不留）。 */}
    <ChromeHeader />
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
          {brief && (
            <button className="chip bchip" onClick={() => setBriefOpen(true)}>
              实验单{briefRec.tried ? ' · 看结论' : ''}
            </button>
          )}
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
          {/*
            实验单盖的是**整个中列**，不只是舞台。
            四段文字放在舞台那块高度里，实测藏掉一半还多（276px 的框装 570px 的内容）——
            而"看不见后面还有什么"正是这一层要治的病。
            反正没动手之前，页签、编辑器、轴也都还没有意义。
          */}
          {brief && briefOpen && (
            <Brief
              brief={brief} guess={briefRec.guess} verdict={verdict} unlocked={briefRec.tried}
              onGuess={n => saveBrief({ guess: n })}
              onStart={() => { saveBrief({ tried: true }); setBriefOpen(false) }}
              onClose={() => { saveBrief({}); setBriefOpen(false) }}
            />
          )}
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
                    <FitBox>
                      <exp.Stage doc={doc} trace={trace} index={clamped} state={state} tab={tab} />
                    </FitBox>
                  </div>
                  <AxisBand
                    exp={exp} trace={trace} index={clamped}
                    playing={playing}
                    onSeek={seek}
                    onTogglePlay={() => setPlaying(p => !p)}
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

      {/* 底部坞：日志 / 真题 / 边界 三选一。
          改之前这三块竖着摞在舞台下面，光它们就 369px —— 而它们的共同点是
          「都在看完舞台之后才用」，谁也不需要跟舞台同时盯着。 */}
      <Dock
        tabs={[
          { id: 'log', label: '逐步日志' },
          { id: 'prob', label: '真题', badge: problems.length },
          { id: 'bounds', label: '边界' },
        ]}
        active={dock} onPick={setDock}
        folded={dockFolded} onToggle={() => setDockFolded(f => !f)}
      >
        <div className="dockpane" data-dock-tab="log" hidden={dock !== 'log'}>
          {state && <StepLog exp={exp} trace={trace} index={clamped} onSeek={seek} />}
        </div>
        <div className="dockpane" data-dock-tab="prob" hidden={dock !== 'prob'}>
          <ProblemPanel
            problems={problems} activeId={problemId} trace={trace} doc={doc}
            runDoc={runDoc} drifted={drifted}
            onPick={id => { pickProblem(id); setFocusQ(null) }}
            onRestore={restoreProblem} onSeek={seek}
            onAnswer={recordAnswer}
            statusOf={(pid, qi) => progress.statusOf(store.q[progress.keyOf(pid, qi)])}
            focusQ={focusQ}
          />
        </div>
        <div className="dockpane" data-dock-tab="bounds" hidden={dock !== 'bounds'}>
          <Bounds items={exp.bounds} />
        </div>
      </Dock>

      {showProgress && (
        <ProgressPanel
          store={store} experiments={EXPERIMENTS}
          onJump={jumpToQuestion}
          onClose={() => setShowProgress(false)}
          cloud={cloud}
          onClear={() => {
            progress.clearAll()
            setStore(progress.load())
            //  已同步的话云端那份也要清 —— 只清本地的话，下次开页面
            //  firstSync 会把云端那份原样拉回来，用户会觉得"清了个寂寞"。
            if (cloud.kind === 'synced' || cloud.kind === 'saving' || cloud.kind === 'error') {
              const at = cloud.rev
              void sync.clearCloud()
                .then(r => setCloud({ kind: 'synced', rev: r, at: Date.now() }))
                .catch(e => setCloud({ kind: 'error', message: String(e), rev: at }))
            }
          }}
        />
      )}
    </div>
    <GuideOverlay
      cards={guideCards}
      title={exp.title}
      closedRef={guideOff}
      onRequestClose={() => setGuideOff(true)}
      onReopen={() => setGuideOff(false)}
    />
    <TipLayer />
    <ChromeFooter />
    </>
  )
}
