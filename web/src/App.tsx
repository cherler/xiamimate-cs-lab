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
import { EXPERIMENTS, BASED_ON, USED_BY, DISCIPLINES, SOFT_LINKS } from './registry.ts'
import { AxisBand } from './shell/AxisBand.tsx'
import { WhyBand, WhyRail } from './shell/WhyBand.tsx'
import { rich } from './shell/rich.tsx'
import { StepLog, ParamPanel, Readouts, Violations, Bounds } from './shell/Panels.tsx'
import { ProblemPanel } from './shell/ProblemPanel.tsx'
import { SequenceEditor, parseSequence, formatSequence } from './shell/SequenceEditor.tsx'
import { EntityEditor } from './shell/EntityEditor.tsx'
import { problemsFor } from './problems.ts'
import { ProgressPanel } from './shell/ProgressPanel.tsx'
import { ChromeHeader, ChromeFooter } from './shell/PlatformChrome.tsx'
import { Dock } from './shell/Dock.tsx'
import { AiCompanion } from './shell/AiCompanion.tsx'
import { GuideOverlay } from './shell/GuideOverlay.tsx'
import { GuideDiagramModal, GUIDE_DIAGRAMS } from './shell/GuideDiagram.tsx'
import { LabGuide } from './shell/LabGuide.tsx'
import { FitBox } from './shell/FitBox'
import { GuidedNote } from './shell/GuidedNote.tsx'
import { briefFor } from './brief.ts'
import { TipLayer } from './shell/Tip.tsx'
import { cardsOf, GUIDES } from './guide.ts'
import * as progress from './progress.ts'
import * as sync from './sync.ts'

/**
 * 头部「可视化 / 游戏」位 —— 按当前职业(discipline key)换的一颗按钮。
 * 原来是写死的「🔬 Transformer 图解」，但那是**大模型职业**的东西，在算法/408 页上看着不搭。
 * 现在每个职业指向自己的可视化或配套游戏：
 *   llm  → Transformer 图解（现成，/lab/explainer）
 *   algo → 算法卡牌（xiamimate-algo-cards，还没配 /lab 同源部署，先占位）
 *   base → 408 探索游戏（在 xiami-world 项目里做，另一条会话在推进，先占位）
 * 没有 href 的就渲染成「开发中」的占位灰钮；没列进来的职业（后端/具身/安全）这颗按钮不显示。
 * 游戏做完部署到 /lab/<x> 后，把 href 填上即可（照 llm 那样）。
 */
const VIZ_OF_DISC: Record<string, { icon: string; label: string; href?: string; tip: string }> = {
  llm:  { icon: '🔬', label: 'Transformer 图解', href: '/lab/explainer', tip: '在浏览器里看 Qwen 怎么想：注意力 + 下一词预测（服务器推理，可切 0.5B/1.5B）' },
  algo: { icon: '🎴', label: '算法卡牌', tip: '卡是算法、敌人是有性质的数据，血条是时间预算（游戏开发中，做完接上）' },
  base: { icon: '🧩', label: '探索游戏', tip: '在游戏里吃透 408 四门（xiami-world，开发中，做完接上）' },
}

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
  /**
   * 讲解浮层开关。关掉的状态存 localStorage —— 学会了的人不该每换一个实验就再关一次。
   *
   * ⚠️ 试过把它并成旁栏的第五格（实验区吃满高度之后浮层落哪儿都压东西），
   * 用户否了：**浮层这个形态本身是对的**，要改的是往里面塞更多内容。
   * 于是保留浮层，只在矮屏（≤820px）上默认不弹 —— 那一屏是真的没有空地。
   */
  const [guideOff, setGuideOff] = useState(() => {
    try {
      const saved = localStorage.getItem('cslab.guide.closed')
      if (saved !== null) return saved === '1'
      return window.innerHeight <= 820
    } catch { return false }
  })
  /** 「看懂这一屏」引导图弹层开关 */
  const [diagramOpen, setDiagramOpen] = useState(false)
  //  学科切换（默认 cs；不落本机——每次加载都回到有内容的计算机学科，冒烟也稳）
  const [activeDisc, setActiveDisc] = useState('base')
  const [guideOpen, setGuideOpen] = useState(false)


  /** 从错题本跳过来时要高亮的那一问 */
  const [focusQ, setFocusQ] = useState<number | null>(null)
  /** 底部坞：同一时刻只露一块（日志 / 真题 / 边界），以及收不收起 */
  /**
   * 编辑器（序列表 / 实体表）默认**收起**。
   * 它们是设置，不是内容 —— 改之前实测它跟舞台一样大（各占屏 8.7%），
   * 而舞台被挤到只剩 8.7%，比底部日志抽屉还小一半。
   * 记在本机：改过一次的人下次进来还是展开的。
   */
  const [edOpen, setEdOpen] = useState(() => {
    try { return localStorage.getItem('cslab.editor') === 'open' } catch { return false }
  })
  const toggleEd = () => setEdOpen(v => {
    const n = !v
    try { localStorage.setItem('cslab.editor', n ? 'open' : 'shut') } catch { /* 隐私模式 */ }
    return n
  })

  /**
   * 左右两栏收起来，把整屏让给舞台。
   *
   * 用户原话：「左右两侧空白太多了。整个布局挤死了作为核心的实验区」。
   * 解掉外壳宽度上限之后中列已经吃到 1530px，但目录和参数**一直占着** ——
   * 想盯着一张图看的时候，那 414px 是纯粹的干扰。
   *
   * ⚠️ 收起之后各留一条 22px 的窄轨，不是收成 0。
   * 收成 0 的话，再打开的按钮就得另找地方摆 —— 而「东西从哪儿没的，
   * 就该从哪儿找回来」这一条已经在讲解卡上栽过一次（关掉之后没人找得到）。
   *
   * 跟「展示模式」不是一回事：那个藏掉全部外壳、锁画幅，是录屏用的；
   * 这个是日常看图时临时腾地方，两栏各收各的，刷新之后还记得。
   */
  const [navOpen, setNavOpen] = useState(() => {
    try { return localStorage.getItem('cslab.nav') !== 'shut' } catch { return true }
  })
  const [sideOpen, setSideOpen] = useState(() => {
    try { return localStorage.getItem('cslab.side') !== 'shut' } catch { return true }
  })
  const toggleCol = (which: 'nav' | 'side') => {
    const [v, set] = which === 'nav' ? [navOpen, setNavOpen] as const : [sideOpen, setSideOpen] as const
    const n = !v
    set(n)
    try { localStorage.setItem(`cslab.${which}`, n ? 'open' : 'shut') } catch { /* 隐私模式 */ }
  }
  /**
   * 展示模式 —— **给录屏用的，不是给用户用的**。
   *
   * 走 URL 参数而不是界面开关，是因为它要能被脚本直接打开：
   * `?show=1&ratio=9:16&tour=1` 就是一条可复现的拍摄指令，
   * 换个实验、换个画幅只是换一段 URL，不用有人坐在那儿点。
   *
   * 三件事：藏掉一切不上镜的壳 · 锁死画幅（取景框）· 自己走一遍（巡演）。
   */
  const show = useMemo(() => {
    const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search)
    const ratio = q.get('ratio') === '9:16' ? '9:16' : '16:9'
    return { on: q.get('show') === '1', ratio, tour: q.get('tour') === '1' }
  }, [])

  /*  默认停在「本步推演」：走步时最该看见的是它，
      而日志/真题/边界都是"看完这一步之后才用"的。 */
  const [dock, setDock] = useState('why')
  /*  抽屉默认收着：坞的三样都是"看完舞台之后才用"，开着就盖住舞台下沿。
      原来它是常驻横带、默认摊开 —— 抽屉化之后语义变了，默认值跟着变。 */
  /**
   * 旁栏的折叠状态。
   *
   * **按实验记**：默认值由实验自己定（`stageExplains` 的那些默认收着），
   * 用户在某个实验里拉开过，就只影响那一个实验。
   * 写成单个布尔的那版有个必然的错：在 Cache 里收起来，切到别的实验也跟着收了 ——
   * 而别的实验的旁栏是它唯一的推演出处。
   *
   * **落本机**：跟左右两栏（`cslab.nav` / `cslab.side`）一个规矩 ——
   * 收起来是用户腾地方的动作，刷新一次就忘了等于白收。
   * 以前它不落盘也看不出来，因为默认值恒为"展开"，刷新前后一样宽；
   * 默认值一旦随实验变，冒烟当场量出舞台刷新后从 1429 跳到 1857px。
   */
  const [dockFold, setDockFold] = useState<Record<string, boolean>>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('cslab.dockfold') ?? '{}')
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
    } catch { return {} }
  })
  const putDockFold = (id: string, v: boolean) => setDockFold(f => {
    const n = { ...f, [id]: v }
    try { localStorage.setItem('cslab.dockfold', JSON.stringify(n)) } catch { /* 隐私模式 */ }
    return n
  })
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

  /**
   * 旁栏默认收不收，由实验的 `stageExplains` 决定。
   *
   * 推演已经搬去右栏的实验（目前只有 Cache），旁栏默认**收成一条 32px 的窄轨**
   * （见 styles.css 的 `.dock.folded`）—— 用户原话：
   * 「概念图里没有的多余东西删掉就好，比如实验区左侧的解释区域」。
   *
   * ⚠️ **收，不是删。** 试过把「本步推演」那一格整个摘掉，代价是
   * `GUIDES.cache.step` 那四段再没有任何地方渲染 —— 死数据比没有数据更糟，
   * 而且这个仓没有版本控制，删了找不回来。收起之后屏幕上它确实不在了，
   * 想看时点一下窄轨就出来，日志/真题/边界也都还在一次点击的距离上。
   * 「东西从哪儿没的就该从哪儿找回来」这一条在讲解卡上已经栽过一次。
   */
  const dockFolded = dockFold[expId] ?? !!exp.whyInRail
  /*
   * ⚠️ `dock` 是**跨实验共用**的一个字符串。推演搬去右栏的实验没有 'why' 这一格，
   * 而用户可能带着 dock='why' 从别的实验切过来 —— 不兜底就会几格全 hidden，
   * 旁栏拉开是一片空白（"选中的那一项不在列表里"）。
   * 所以真正生效的是 `dockActive`：先在现有页签里找，找不到落到第一格。
   */
  const dockTabs = useMemo(() => [
    ...(exp.whyInRail ? [] : [{ id: 'why', label: '本步推演' }]),
    { id: 'log', label: '逐步日志' },
    { id: 'prob', label: '真题', badge: problems.length },
    { id: 'bounds', label: '边界' },
    //  AI学伴 不再是这里的一格 —— 它搬去头部按钮开的独立全屏面板了。
  ], [exp, problems.length])
  const dockActive = dockTabs.some(t => t.id === dock) ? dock : dockTabs[0].id

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
    /*  「选择器」型参数：它自己不进仿真，只决定某条流装哪份数据（见 types.ts 的 `stream`）。
        只在**这份 doc 的参数里真有值**时才改写 —— 真题带来的 doc 没有这个参数，
        它自带的流就不该被默认值覆盖掉。 */
    for (const spec of exp.params) {
      if (!spec.stream) continue
      const v = d.params[spec.key]
      if (v === undefined) continue
      const vals = spec.stream.values(v as never)
      d.streams = d.streams.map(s => (s.name === spec.stream!.name ? { ...s, values: vals } : s))
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
  //  AI 学伴：从底部「实验记录」抽屉里抽出来，改成头部一颗按钮开的**独立全屏面板**。
  //  抽屉那格太挤（出题/答疑/复习/面试四种用法各要一块地方），全屏才放得开。
  const [aiOpen, setAiOpen] = useState(false)
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
  //  AI 学伴全屏面板：Esc 关。挂在 window 上，只在开着时监听。
  useEffect(() => {
    if (!aiOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAiOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aiOpen])

  useEffect(() => {
    if (!show.on) return
    document.body.setAttribute('data-show', show.ratio)
    document.body.toggleAttribute('data-tour', show.tour)
    //  Esc 退出：录废了不用回地址栏改参数
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') location.href = location.pathname }
    window.addEventListener('keydown', esc)
    return () => {
      document.body.removeAttribute('data-show')
      document.body.removeAttribute('data-tour')
      window.removeEventListener('keydown', esc)
    }
  }, [show])
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

  /**
   * 常驻目标 —— 和 ④ 用同一份轨迹现算，不额外跑引擎。
   *
   * 跟 ④ 的关键区别是**不锁**：④ 要押过注、动过手才揭晓（那是"先猜再验"的节奏），
   * 目标反过来，得一直在页眉上告诉你还差多少 —— 收起实验单之后它是唯一还在场的那一句。
   */
  const goal = useMemo(() => {
    if (!brief?.goal) return null
    try { return brief.goal.state({ doc: doc as never, trace, runDoc: runDoc as (d: unknown) => unknown[] }) }
    catch { return null }
  }, [brief, doc, trace, runDoc])

  const clamped = Math.min(index, Math.max(0, trace.length - 1))
  const state = trace[clamped]

  /**
   * 走完过的配置 —— **一样的配置再看一遍，那是重播，不是第一次**。
   *
   * 轴和日志默认不预告没走到的步（免得一进页面就把答案铺满），
   * 但走完一整遍之后再回来看，就没有可剧透的了：结果你已经看过。
   * 键是整份配置（参数 + 序列 + 实体），所以"换到 8 路再换回 2 路"
   * 认得出是同一条轨迹，不会因为数组是新的就重新藏起来。
   *
   * 只记在内存里：这是"这次会话里看过没有"，不是学习成果，不值得落盘。
   */
  const docKey = useMemo(
    () => JSON.stringify([exp.id, doc.params, doc.streams, doc.entities]),
    [exp.id, doc])
  const walked = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (trace.length > 0 && clamped >= trace.length - 1) walked.current.add(docKey)
  }, [clamped, trace.length, docKey])
  const replay = walked.current.has(docKey)

  /**
   * 巡演在哪儿停一下 —— **用已有的 `tone()` 判，不为巡演另写一份内容**。
   *
   * `tone()` 返回这一步的语义状态（命中/缺失、服务/空跑、运行/空闲…），
   * 30 个实验都有，而且轴上的柱色本来就是它染的、有测试盯着。
   * 状态一变，就是这条轨迹上「发生了事」的那一步 —— 镜头该多留半秒的正是那儿。
   * 要是为巡演单写一份关键步清单，等于同一件事记两遍，迟早对不上。
   */
  const keySteps = useMemo(() => {
    const set = new Set<number>()
    let prev: string | null = null
    trace.forEach((s, i) => {
      let k: string
      try { k = exp.tone(s as never).key } catch { return }
      if (prev !== null && k !== prev) set.add(i)
      prev = k
    })
    return set
  }, [exp, trace])
  /**
   * 当前这一步的四段推演。算不出来（没状态、这个实验还没写 `step`）就是空数组，
   * 带子整条不渲染 —— 留一条空带子占着地方，比没有更糟。
   *
   * `try` 包住：`step` 读的是各内核自己的末态字段，配置改坏了可能拿到 undefined，
   * 而**讲解层出错不该把整个实验台带下去**。
   */
  const whyParts = useMemo(() => {
    const f = GUIDES[exp.id]?.step
    if (!f || !state) return []
    try { return f(state as never, doc) } catch (e) {
      /*  ⚠️ 不要静默。讲解层出错不该把实验台带下去，但**悄悄少一条带子**
          比报错更糟：屏幕上只是"这一步没有解释"，看不出是坏了还是本来就没写。
          我第一版写的是 `catch { return [] }`，握手实验有两步的带子整条消失，
          查了一轮才发现异常一直被咽着。 */
      console.error(`[讲解] ${exp.id} 的「本步推演」算不出来：`, e)
      return []
    }
  }, [exp.id, state, doc])

  /** 关键步多留一拍；平时快一点，4 秒里塞得下更多变化 */
  const stepMs = show.tour ? (keySteps.has(clamped) ? 1500 : 560) : 800

  //  巡演：进来就从头自己走。不循环 —— 轨迹放完停在末态，跟手动播放同一条规矩
  const toured = useRef(false)
  useEffect(() => {
    if (!show.tour || toured.current || trace.length === 0) return
    toured.current = true
    setIndex(0); setPlaying(true)
  }, [show.tour, trace.length])

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
    /*  联动：有些参数被另一个定死（停止等待的窗口只能是 1）。
        不跟着调的话，用户一按就撞校验，屏幕上只剩一行"配置不合法" ——
        内核那条校验没错，错的是让人先撞了才知道。见 `types.ts` 的 `syncs`。 */
    const spec = exp.params.find(x => x.key === key)
    const extra = spec?.syncs?.(v, { ...doc.params, [key]: v }) ?? null
    setOverrides(o => ({ ...o, [exp.id]: { ...(o[exp.id] ?? {}), [key]: v, ...(extra ?? {}) } }))
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
    setDock('prob'); putDockFold(experimentId, false)
    setFocusQ(qi)
  }

  /** 页眉上的进度数字 —— 全量统计一次，便宜 */
  //  实验数与进度都**按当前学科**统计（跟着顶条职业切换走），不再是全站合计。见 activeDisc 处。

  /*
   * 坞里的四格，**抽出来一份，两个位置共用**。
   *
   * 推演搬去右栏的实验把坞挂在走带底下（「实验记录」），其余的仍挂在舞台左边。
   * 抄两份的话，加一格要改两处 —— 而漏改的那一处不会报错，只是那一格没了。
   */
  const dockPanes = (
    <>
      {/*  推演搬去右栏的实验，这一格不再存在 —— 内容**搬了家**不是删了。 */}
      {!exp.whyInRail && (
        <div className="dockpane" data-dock-tab="why" hidden={dockActive !== 'why'}>
          <WhyBand parts={whyParts} />
        </div>
      )}
      <div className="dockpane" data-dock-tab="log" hidden={dockActive !== 'log'}>
        {state && <StepLog exp={exp} trace={trace} index={clamped} replay={replay} onSeek={seek} />}
      </div>
      <div className="dockpane" data-dock-tab="prob" hidden={dockActive !== 'prob'}>
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
      <div className="dockpane" data-dock-tab="bounds" hidden={dockActive !== 'bounds'}>
        <Bounds items={exp.bounds} />
      </div>
    </>
  )
  /** 舞台左边那一栏的形态 —— 推演没搬家的实验用它 */
  const dockNode = (
    <Dock
      tabs={dockTabs}
      active={dockActive} onPick={setDock}
      folded={dockFolded}
      onToggle={() => putDockFold(expId, !dockFolded)}
    >{dockPanes}</Dock>
  )

  const grouped = EXPERIMENTS.reduce<Record<string, typeof EXPERIMENTS>>((acc, e) => {
    (acc[e.group] ??= []).push(e); return acc
  }, {})

  //  学科为骨架：把子模块(group)按当前学科过滤。现有实验全在「计算机」下，默认展开它。
  const activeDiscObj = DISCIPLINES.find(d => d.key === activeDisc) ?? DISCIPLINES[0]
  //  子模块按学科**声明的 groups 顺序**渲染，而不是实验插入顺序——
  //  否则新加的组(如经典算法后建)会掉到目录最下面，跟声明的次序对不上。
  //  软链接：一个实验可在多个子模块目录里出现。原生实验(e.group===g) + 借来的(SOFT_LINKS[g])。
  //  借来的真身仍在原 group，这里只是多给一个导航入口；目录里以 e.group!==g 判定并标「↗」。
  const activeGroups: [string, typeof EXPERIMENTS][] = activeDiscObj.groups
    .map(g => {
      const native = grouped[g] ?? []
      const linked = (SOFT_LINKS[g] ?? [])
        .map(id => EXPERIMENTS.find(e => e.id === id))
        .filter((e): e is typeof EXPERIMENTS[number] => !!e && !native.includes(e))
      return [g, [...native, ...linked]] as [string, typeof EXPERIMENTS]
    })
    .filter(([, list]) => list && list.length > 0)

  //  当前学科的实验集合（含软链），用来把"N 个实验 / 进度"按学科统计（跟顶条切换）。
  const discExpIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [, list] of activeGroups) for (const e of list) ids.add(e.id)
    return ids
  }, [activeDisc])   // activeGroups 由 activeDisc 决定；EXPERIMENTS 运行期不变
  const discCount = discExpIds.size
  //  当前学科第一个实验（切换职业时自动选它，让面包屑/主区跟着换）。
  const firstExpOfDisc = (dk: string) => {
    const d = DISCIPLINES.find(x => x.key === dk); if (!d) return undefined
    for (const g of d.groups) {
      if (grouped[g]?.length) return grouped[g]![0]
      const lid = (SOFT_LINKS[g] ?? [])[0]
      const le = lid ? EXPERIMENTS.find(e => e.id === lid) : undefined
      if (le) return le
    }
    return undefined
  }
  const { mastered, totalQ, reviewCount } = useMemo(() => {
    const all = [...discExpIds].flatMap(id => problemsFor(id)).flatMap(p => p.questions.map((_, qi) => ({ problemId: p.id, qi })))
    const st = progress.statOf(store, all)
    return { mastered: st.mastered, totalQ: st.total, reviewCount: progress.reviewQueue(store, all).length }
  }, [store, discExpIds])

  return (
    <>
    {/* 平台横条在 .app 外面：它要通栏，而 .app 是 1420px 居中的。
        没并入主站时这两个组件什么都不渲染（连占位的空 div 都不留）。 */}
    <ChromeHeader />
    {/*  展示模式退出键：展示模式藏掉了全部外壳(含 .chips)，Esc 万一不灵就没出口。
         这颗按钮定位在 .chips 之外、固定在右上角，只在展示模式显示，点一下退出。 */}
    {show.on && <button className="showexit" onClick={() => { location.href = location.pathname }} title="退出展示模式（也可按 Esc）">✕ 退出展示</button>}
    <div className="app">
      {/*
        * 学科切换 = 最高一级菜单：独立成一条通栏顶条，不再塞在左栏目录上头。
        * 用户原话：「学科切换应该独立成最高一级菜单」「计算机地图与实验目录放一起没问题」。
        * 用 <button>——它在 .app 顶层、不在 .nav 里，冒烟数 `.nav button` 不受影响；类名也避开 .chip/.tabs。
        */}
      <div className="disctabs" role="tablist" aria-label="学科">
        {DISCIPLINES.map(d => (
          <button key={d.key} type="button" role="tab"
            aria-selected={d.key === activeDisc}
            className={`disctab ${d.key === activeDisc ? 'on' : ''} ${d.status === 'planned' ? 'soon' : ''}`}
            onClick={() => {
              setActiveDisc(d.key)
              //  切职业时自动跳到该职业第一个实验：面包屑/主舞台/读数一起跟着换，
              //  而不是停在上一个职业的实验上（用户原话：目录换了、这里没换）。
              if (d.status !== 'planned') { const f = firstExpOfDisc(d.key); if (f && f.id !== expId) selectExp(f.id) }
            }}
            title={d.status === 'planned' ? `${d.title} · 即将开放（guide：从${d.guide.from}到${d.guide.to}）` : `${d.title} 学科`}>
            <span className="dti">{d.icon}</span>
            <span className="dtn">{d.title}</span>
            {d.status === 'planned' && <i className="dtsoon">即将</i>}
          </button>
        ))}
      </div>
      <header className="top">
        {/*
          第一行是"这是什么实验"，第二行是**"这一屏在问什么"**。
          第二行以前只活在讲解卡的第 1 页 —— 用户原话：「没有这个背景解释，
          很多人（包括我）都不知道这是在做什么」。一句本来就写好、还被测试验过的话，
          埋在一个要点开、要翻页才看得到的地方，等于没写。
        */}
        {/*
          * 顶梁是**模块级**的，不是实验级的。
          *
          * 用户原话：「目录是一级路由、某一个实验才是二级路由。应该把目录放在
          * 实验名的上级，而不是像现在这样，实验名称『Cache 命中率』包含目录」。
          * 原来 `<h1>Cache 命中率</h1>` 摆在整页最上面，底下才是目录栏 ——
          * 读起来目录成了这个实验的一部分，层级正好反了。
          *
          * 现在这条只说"你在目录的哪一格"（分组名 + 三十个实验里的第几个），
          * 实验名连同副题、问句、页签一起下沉到主区自己的抬头里。
          */}
        <div className="crumb">
          <button className="crumbdir" onClick={() => toggleCol('nav')}
                  aria-expanded={navOpen}
                  title={navOpen ? '收起实验目录' : '展开实验目录'}>实验目录</button>
          <span className="crumbsep">›</span>
          <span className="crumbgrp">{exp.group}</span>
        </div>
        <div className="chips">
          {/*  ⚠️ 顺态下不再印「N 步」：走带右端就写着「第 x 步，共 N 步」，
               同一个数在一屏上出现两次，读者得先确认这俩是不是一回事。
               出错那一档留着 —— 「配置不合法」在别处没有第二个出处。 */}
          {violations.length > 0 && <span className="chip warn">配置不合法</span>}
          {problem && <span className="chip on">{problem.source}</span>}
          {/*  导览（原「实验笔记」）：教你走一遍这个实验的引导浮层。
               名字固定不跳 —— 看过结论只在按钮上点一个 ✓，不再改成「实验笔记·看结论」。
               改名是为了和底部「实验记录」区分开：一个教你走一遍、一个是操作时的日志/真题。 */}
          {brief && (
            <button className="chip bchip" onClick={() => setBriefOpen(true)}
               data-tip="带我走一遍这个实验：问句 + 每步推演 + 任务 + 结论">
              导览{briefRec.tried && <b className="briefok" title="已看过结论"> ✓</b>}
            </button>
          )}
          {/*  AI 学伴：头部唯一入口（原来还藏在底部抽屉一格里，已抽出）。
               点开是**独立全屏面板**：出题 / 答疑 / 复习 / 面试四种用法，抽屉那格太挤放不开。 */}
          <button className="chip aichip" onClick={() => setAiOpen(true)}
             data-tip="AI 学伴：就着这个实验，焊死引擎出题 / 答疑 / 复习 / 当面试官（答案钉在真实步骤上、少幻觉）">
            🤖 AI 学伴
          </button>
          {/*  可视化 / 游戏位：跟着顶条职业换。大模型→Transformer 图解（现成）；
               算法→算法卡牌、408→探索游戏（都还在开发，先占位，做完再接链接）；
               其余职业暂不显示。映射见文件顶部 VIZ_OF_DISC。 */}
          {(() => {
            const v = VIZ_OF_DISC[activeDisc]
            if (!v) return null
            return v.href
              ? <a className="chip livetoggle attn" href={v.href} data-tip={v.tip}>{v.icon} {v.label}</a>
              : <button className="chip vizsoon" disabled data-tip={v.tip} title={v.tip}>{v.icon} {v.label}<em className="soon">开发中</em></button>
          })()}
          {/*  实验数 + 进度合并成一颗（都按当前职业统计，跟顶条走）。
               没写真题的职业（如具身，totalQ=0）只印实验数，不印「掌握 0/0」。 */}
          <button className="chip act" onClick={() => setShowProgress(true)}>
            {discCount} 实验{totalQ > 0 ? ` · 掌握 ${mastered}/${totalQ}` : ''}
            {reviewCount > 0 && <b className="dot">{reviewCount}</b>}
          </button>
        </div>
      </header>

      {<div className="grid" data-nav={navOpen ? 'open' : 'shut'} data-side={sideOpen ? 'open' : 'shut'}>
        {/*
          * ⚠️ 这两颗收起钮**不放在栏里面**。
          * 第一版塞进 `<nav class="nav">`，冒烟第 1 组当场炸了 ——
          * 它是拿 `.nav button` 数实验的，凭空多出一个叫「‹」的实验。
          * 加一个 `:not(.colfold)` 能治标，但下一处按同样方式遍历的代码还会中招。
          * 摆在栏外面、用绝对定位贴到栏的边上，问题从根上不存在。
          */}
        <button className="colfold nav-fold" onClick={() => toggleCol('nav')}
                aria-expanded={navOpen} aria-label={navOpen ? '收起实验目录' : '展开实验目录'}
                title={navOpen ? '收起目录，把地方让给舞台' : '展开实验目录'}>
          {navOpen ? '‹' : '›'}
        </button>
        <button className="colfold side-fold" onClick={() => toggleCol('side')}
                aria-expanded={sideOpen} aria-label={sideOpen ? '收起参数与读数' : '展开参数与读数'}
                title={sideOpen ? '收起参数与读数' : '展开参数与读数'}>
          {sideOpen ? '›' : '‹'}
        </button>
        {/* 左：实验目录 */}
        <nav className="card nav" aria-label="实验目录">
          {/*  当前学科的 guide 页入口（div，非 button）—— 从地基通到那件职业/造物。
               学科切换已上移成通栏顶条；这里只留「本学科地图」入口，和实验目录放一起。 */}
          <div className="discguide" role="button" tabIndex={0}
            onClick={() => setGuideOpen(true)}
            onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setGuideOpen(true) } }}
            title={`${activeDiscObj.title}地图`}>
            🗺️ <b>{activeDiscObj.title}地图</b>：从 {activeDiscObj.guide.from} 到 {activeDiscObj.guide.toIcon}{activeDiscObj.guide.to}
          </div>

          {activeGroups.length > 0 ? activeGroups.map(([group, list]) => (
            <div key={group}>
              <div className="grp">{group}</div>
              {list.map((e) => {
                const soft = e.group !== group   // 软链接：真身在别的子模块，这里是借来的入口
                return (
                  <button
                    key={e.id}
                    className={`${e.id === expId ? 'on' : ''} ${soft ? 'soft' : ''}`}
                    onClick={() => selectExp(e.id)}
                    aria-current={e.id === expId}
                    title={soft ? `软链接：真身在「${e.group}」，这里是一个导航入口` : undefined}
                  >
                    <span className="n">{String(EXPERIMENTS.indexOf(e) + 1).padStart(2, '0')}</span>
                    <span>{e.title}</span>
                    {soft && <span className="softmark" aria-hidden>↗</span>}
                  </button>
                )
              })}
            </div>
          )) : (
            <div className="navsoon">
              「{activeDiscObj.title}」学科即将开放<br />
              <small>guide 会是一条「从 {activeDiscObj.guide.from} 到 {activeDiscObj.guide.toIcon}{activeDiscObj.guide.to}」的路</small>
            </div>
          )}
        </nav>

        {/* 中：舞台 + 轴 + 日志 */}
        <div className="col main">
        <header className="exphead">
          <h1>{exp.title}</h1>
          {/*  招牌上写**这一屏在问什么**，不写它属于哪一类 ——
               分类（"组相联映射 · 替换策略"）在左边目录的分组标题里已经有了。 */}
          <span className="sub">{GUIDES[exp.id]?.question ?? exp.subtitle}</span>
          {/*  地基链：把"从地基通到引擎"变成能一键跳的路 —— 这个节点坐在哪些基础实验上、又撑起了谁。
               `.bochip` 不是 `.nav button`，冒烟数实验数不受影响。 */}
          {(BASED_ON[exp.id] || USED_BY[exp.id]) && (
            <div className="basedon">
              {BASED_ON[exp.id] && (
                <span className="borow">
                  <span className="bol">坐在地基</span>
                  {BASED_ON[exp.id].map(b => (
                    <button key={b.id} className="bochip" onClick={() => selectExp(b.id)}
                            title={`跳到「${EXPERIMENTS.find(e => e.id === b.id)?.title ?? b.id}」`}>
                      {EXPERIMENTS.find(e => e.id === b.id)?.title ?? b.id}<i>{b.why}</i>
                    </button>
                  ))}
                </span>
              )}
              {USED_BY[exp.id] && (
                <span className="borow">
                  <span className="bol up">撑起</span>
                  {USED_BY[exp.id].map(id => (
                    <button key={id} className="bochip up" onClick={() => selectExp(id)}
                            title={`跳到「${EXPERIMENTS.find(e => e.id === id)?.title ?? id}」`}>
                      {EXPERIMENTS.find(e => e.id === id)?.title ?? id}
                    </button>
                  ))}
                </span>
              )}
            </div>
          )}
          {/*
            * ⚠️ 「挑战」药丸从页眉**撤掉了**（2026-08-21，用户拍板）。
            *
            * 它做的事其实很薄：拧参数达标后药丸变绿显示「✓ 挑战完成」——
            * 没有积分/徽章/解锁/进度，就是个变绿的对勾。代价却不小：
            * 只有 16/30 实验有（一半没有，presence 不一致）、占页眉地方、还挤到过标题。
            * 那点"变绿"的 payoff 撑不起这些成本，所以撤。
            *
            * **数据没删**：`brief.goal` / `goal`（现算达成态）都留着，
            * brief-content.test 仍逐个验它们 —— 将来要做真正的达成反馈
            * （比如接进真题进度），这份现算能力现成可复用。这里只是不再渲染那颗药丸。
            */}
          {/*  「看懂这一屏」：只有登记了引导图的实验才出现（见 GuideDiagram 的 GUIDE_DIAGRAMS）。
               用户原话：「这些格子根本看不懂是个什么东西」—— 这个入口点开就是一张把
               地址→tag/index/offset→组/路 画清楚的静态讲解图。 */}
          {GUIDE_DIAGRAMS[exp.id] && (
            <button className="seehint" onClick={() => setDiagramOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
              看懂这一屏
            </button>
          )}
          {/*  页签跟着实验名走：它换的是**这个实验**的视图，不是整页的 */}
          <div className="tabs" role="tablist">
            {exp.tabs.map(t => (
              <button
                key={t.id} role="tab"
                aria-selected={t.id === tab}
                onClick={() => setTab(t.id)}
              >{t.label}</button>
            ))}
          </div>
        </header>
          {/*
            实验单盖的是**整个中列**，不只是舞台。
            四段文字放在舞台那块高度里，实测藏掉一半还多（276px 的框装 570px 的内容）——
            而"看不见后面还有什么"正是这一层要治的病。
            反正没动手之前，页签、编辑器、轴也都还没有意义。
          */}
          {/*
            * **引导式实验笔记** —— 替掉了原来的「实验单」。
            *
            * 实验单赌的是动手之前那一下（先猜 → 去试 → 揭晓），治的是"不知道要做什么"。
            * 而用户反复指的另一个病是"字都认识、连起来不知道在说什么" ——
            * 那是**一轮推演读不下来**，跟动力无关。所以这一屏改成把当前这一步摊开：
            * 输入是什么 → 按什么规则判 → 判出了什么。
            *
            * 「② 先猜一下」和「④ 判对错」随实验单一起下掉了（概念图上没有这一段）；
            * 结论本身还在 —— 它现在叫「本次发现」，数还是 `brief.verdict` 现算的那一份。
            * 「拿真题验一遍」那块入口也随实验单去掉了；**真题功能本身没动**。
            */}
          {brief && briefOpen && (
            <GuidedNote
              title={exp.title}
              no={String(EXPERIMENTS.indexOf(exp) + 1).padStart(2, '0')}
              question={GUIDES[exp.id]?.question ?? exp.subtitle}
              parts={whyParts}
              tone={state ? exp.tone(state) : null}
              verdict={briefRec.tried ? verdict : null}
              tasks={brief.tasks}
              index={clamped}
              total={Math.max(1, trace.length)}
              where={exp.tickLabel && state ? exp.tickLabel(state, clamped) : `第 ${clamped + 1} 步`}
              stage={state
                ? <FitBox min={0.5} max={1.2}>
                    <exp.Stage doc={doc} trace={trace} index={clamped} state={state} tab={exp.tabs[0].id} />
                  </FitBox>
                : null}
              chips={trace.map((s, i) => {
                const t = exp.tone(s)
                return (
                  <button key={i} onClick={() => seek(i)}
                          className={`gnchip ${i <= clamped ? t.key : 'unseen'}${i === clamped ? ' cur' : ''}`}
                          aria-current={i === clamped}
                          title={`第 ${i + 1} 步`}>
                    <b>{i + 1}</b>
                    {exp.tickChip && <em>{exp.tickChip(s as never, i)}</em>}
                  </button>
                )
              })}
              onPrev={() => seek(Math.max(0, clamped - 1))}
              onNext={() => seek(Math.min(trace.length - 1, clamped + 1))}
              onClose={() => { saveBrief({ tried: true }); setBriefOpen(false) }}
            />
          )}

          {exp.sequence && (
            <SequenceEditor
              spec={exp.sequence} text={seqRaw}
              onText={editSeq} onReset={resetSeq}
              open={edOpen} onToggle={toggleEd}
              index={clamped} onSeek={seek}
            />
          )}

          {exp.entitySpec && (
            <EntityEditor
              spec={exp.entitySpec} doc={doc} dirty={entDrifted}
              onChange={editEntities} onReset={resetEntities}
              open={edOpen} onToggle={toggleEd}
            />
          )}

          {violations.length > 0
            ? <Violations items={violations} />
            : state
              ? <>
                  {/* 舞台外面套一层稳定容器：测试要认出"哪块是舞台"，
                      不能靠"中列第几张卡片"猜 —— 每加一个编辑器就会误判一次 */}
                  {/*
                    * 舞台和推演**并排**（宽屏上），不是上下摞着。
                    *
                    * 用户原话：「三个红框：就感觉空间还是挺大的。为啥中间的实验区
                    * 就是显得那么挤呢」。账是这么算的：中列是五条**占满宽度**的横带子
                    * 从上往下摞 —— 序列、舞台、推演、轴、坞。每一条都吃掉一段高度，
                    * 于是舞台只分到全高的 38%；而推演那条其实只用得上 500px 宽，
                    * 右边一千多像素全空着。
                    *
                    * 把推演挪到舞台右边之后：舞台的高度多出推演那一条（约 110px），
                    * 推演也拿到了它本来就该有的窄栏。窄屏上仍然上下摞
                    * （见 `.stagerow` 的容器查询）。
                    */}
                  <div className="stagerow">
                    {/*
                      * 旁栏：**推演 · 逐步日志 · 真题 · 边界**，四格共用一条页签。
                      *
                      * 用户原话：「『逐步日志｜真题｜边界』包含到实验区的内部怎么样？
                      * 箭头指的地方是实验区左侧（那片地方比较空，放的解释文字
                      * 也可以作为一个 tab 合在一起）」。
                      *
                      * 账很清楚：这四样都是**围着当前这一步说话**的文字，
                      * 而舞台的左边本来就是空的（图居中画）。合成一栏之后，
                      * 底部那条独立的坞整条消失，页面从五条横带子减到三条。
                      * 「本步推演」当默认格 —— 走步时最该看见的是它。
                      */}
                    {!exp.whyInRail && dockNode}
                    <div className="stagewrap">
                      <FitBox>
                        <exp.Stage doc={doc} trace={trace} index={clamped} state={state} tab={tab} />
                      </FitBox>
                    </div>
                  </div>
                  <AxisBand
                    exp={exp} trace={trace} index={clamped} doc={doc} replay={replay}
                    playing={playing} stepMs={stepMs}
                    onSeek={seek}
                    //  停在末态时再按 ▶ = 从头放一遍（自动停之后最想做的就是这个）
                    onTogglePlay={() => {
                      if (!playing && clamped >= trace.length - 1) setIndex(0)
                      setPlaying(p => !p)
                    }}
                  />
                  {/*
                    * **实验记录**：走带底下一条。收起时只有一行"已验证的结论"
                    * （概念图上就是这一条），点右边展开，里面是逐步日志 / 真题 / 边界。
                    *
                    * 它替掉了舞台左边那条 32px 的折叠窄轨。窄轨的毛病不在窄，
                    * 在于**它是一条什么都不写的竖条**：收起来既不占内容也不给信息。
                    * 挪到底部之后，收起态那一行本身就是内容。
                    */}
                  {exp.whyInRail && (
                    <Dock
                      tabs={dockTabs}
                      active={dockActive} onPick={setDock}
                      folded={dockFolded}
                      onToggle={() => putDockFold(expId, !dockFolded)}
                      place="bottom"
                      lead={
                        <span className="docklead">
                          <i className="dockicon" aria-hidden>▤</i>
                          <b>实验记录</b>
                          {briefRec.tried && verdict
                            ? <><em className="ok">已验证：</em><span className="say">{rich(verdict.say)}</span></>
                            : <span className="say idle">
                                逐步日志 {trace.length} 条 · 真题 {problems.length} 道 · 边界 {exp.bounds.length} 条
                              </span>}
                        </span>
                      }
                    >{dockPanes}</Dock>
                  )}
                </>
              : <div className="viol"><div className="t">无轨迹</div><p>当前配置跑不出任何一步。</p></div>}
        </div>

        {/*
          * 右栏：**本步推演 → 实验控制 → 读数**。
          *
          * 顺序就是读者的顺序：先问"这一步为什么这样"，再想"那我改点什么试试"，
          * 最后看"改完累计变成多少"。推演放最上面，是因为它跟舞台讲的是同一步；
          * 读数放最下面，是因为它是**跨步累计**，看它的时候人已经不盯着这一步了。
          */}
        <div className="col side" data-rail={exp.whyInRail ? 'cards' : undefined}>
          {exp.whyInRail && whyParts.length > 0 &&
            <WhyRail parts={whyParts} tone={state ? exp.tone(state) : undefined}
                     verdict={state ? GUIDES[exp.id]?.verdict?.(state as never, doc) : undefined} />}
          <ParamPanel specs={exp.params} values={doc.params} onChange={setParam}
                      emptyNote={exp.paramsNote}
                      dirty={Object.keys(overrides[exp.id] ?? {}).length > 0}
                      onReset={() => setOverrides(o => ({ ...o, [exp.id]: {} }))} />
          {state && <Readouts items={exp.readouts(state, doc, clamped)} />}
        </div>
      </div>}


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
    {diagramOpen && <GuideDiagramModal expId={exp.id} onClose={() => setDiagramOpen(false)} />}
    {guideOpen && (
      <LabGuide discKey={activeDisc} experiments={EXPERIMENTS}
        onPick={selectExp} onSwitch={setActiveDisc} onClose={() => setGuideOpen(false)} />
    )}
    {/*  AI 学伴 独立全屏面板 —— 从底部抽屉抽出来后的新家。点背景 / Esc / ✕ 都能关。 */}
    {aiOpen && (
      <div className="aipanel-back" onClick={() => setAiOpen(false)}>
        <div className="aipanel" role="dialog" aria-label="AI 学伴"
             onClick={e => e.stopPropagation()}>
          <div className="aipanel-head">
            <b>🤖 AI 学伴 · {exp.title}</b>
            <span className="aipanel-sub">出题 / 答疑 / 复习 / 面试 —— 答案钉在这个实验真跑出来的步骤上</span>
            <button className="aipanel-x" onClick={() => setAiOpen(false)} title="关闭（Esc）">✕</button>
          </div>
          <div className="aipanel-body">
            <AiCompanion expId={exp.id} />
          </div>
        </div>
      </div>
    )}
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
