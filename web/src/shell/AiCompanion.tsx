/**
 * AI 学伴面板（坞的一个页签）。
 *
 * 三种用法，都打后端 /cslab/ai/*（独立进程 server/index.ts，dev 由网关/vite 代理转发）：
 *   出题  —— 引擎算钉死答案，大模型只写题面；选完当场判对错 + 看讲解。
 *   答疑  —— 把当前实验的真实运行轨迹当唯一依据回答，问轨迹外会诚实说不知道。
 *   复习  —— 钉死事实卡 + 概念卡 + 小结。
 *
 * 后端目前只接了部分实验（见 /cslab/ai/experiments）；没接的给一句友好提示，不报错。
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { EXPERIMENTS, DISCIPLINE_OF_GROUP } from '../registry.ts'
import { Md, mdInline } from './md.tsx'
import { GITHUB_PAGES } from '../platform.ts'

// 当前实验所在职业线的全部实验 id（用于「整轨面试」跨主题抽题；后端会自动过滤没接 catalog 的）
function trackExpIdsOf(expId: string): string[] {
  const exp = EXPERIMENTS.find(e => e.id === expId)
  const disc = exp && DISCIPLINE_OF_GROUP[exp.group]
  if (!disc) return [expId]
  return EXPERIMENTS.filter(e => DISCIPLINE_OF_GROUP[e.group] === disc).map(e => e.id)
}
function trackTitleOf(expId: string): string {
  const exp = EXPERIMENTS.find(e => e.id === expId)
  return (exp && DISCIPLINE_OF_GROUP[exp.group]?.title) ?? '这条职业线'
}

type Question = {
  factId: string; question: string; options: string[]; correctIndex: number
  /** 原理题还是计数题 —— 标出来,读的人一眼知道这道题在考理解还是在考跟着跑一遍。
   *  服务端旧版本没有这个字段,所以是可选的。 */
  genre?: 'concept' | 'count'
  /** 'odd-one-out' = 「下列说法错误的是」,四个选项全是钉死的真/假命题 */
  variant?: 'direct' | 'odd-one-out'
  explanation: string; provenance: { engineAnswer: string; phrasedBy: 'llm' | 'fallback'; sourceStep?: number; evidence?: string }
}
type Card = { front: string; back: string; source: 'engine' | 'llm' }
type ReviewPack = { title: string; summary: string; factCards: Card[]; conceptCards: Card[] }

// 可出题实验（id → 事实题数）只取一次，跨面板共享。事实题数=该实验 AI 学伴掌握度的分母。
let SUPPORTED: Map<string, number> | null = null
let supportedPromise: Promise<Map<string, number>> | null = null
export function loadAiFacts(): Promise<Map<string, number>> {
  if (GITHUB_PAGES) return Promise.resolve(new Map())
  if (SUPPORTED) return Promise.resolve(SUPPORTED)
  if (!supportedPromise) {
    supportedPromise = fetch('/cslab/ai/experiments')
      .then(r => r.json())
      .then((d: { experiments: { id: string; facts?: number }[] }) => {
        SUPPORTED = new Map(d.experiments.map(e => [e.id, e.facts ?? 0]))
        return SUPPORTED
      })
      .catch(() => { SUPPORTED = new Map(); return SUPPORTED })
  }
  return supportedPromise
}
const loadSupported = loadAiFacts   // 内部沿用旧名（返回值有 .has(id)，判断是否接入不变）

/**
 * 这一次调用花了多少 —— **服务端一直在返回,以前前端收下就丢了。**
 *
 * 每个 AI 学伴响应都带 `billing: { metered, credits, tokens, note }`
 * （server/llm.ts 的 Meter 出的）。2026-09-10 之前界面上一处都不显示,
 * 于是「计费没接通、全程免费」和「接通了、正常扣分」**在屏幕上长得一模一样** ——
 * 那正是这套东西白送了一路却没人发现的原因。
 *
 * 截在 postJSON 这一层而不是六个调用点上:新加的接口自动就带上了,漏不掉。
 */
export type Billing = {
  metered: boolean; credits: number; tokens: number; note: string
  /** 这一次走的是游客试用额度（没登录）；下面两个字段才有意义 */
  guest?: boolean; used?: number; limit?: number
}
let lastBilling: Billing | null = null
const billingSubs = new Set<() => void>()
function setBilling(b: Billing | null) {
  lastBilling = b
  for (const fn of billingSubs) fn()
}
/** 给 React 订阅用（useSyncExternalStore 的两个参数）。 */
export const subscribeBilling = (fn: () => void) => { billingSubs.add(fn); return () => { billingSubs.delete(fn) } }
export const getBilling = () => lastBilling

/**
 * 游客标识 —— **跟主站共用同一个 key**（`xm:vid`，见 tools-frontend 的 lib/usage.ts）。
 *
 * 线上 `/cslab/` 与主站同源，localStorage 是同一份，所以这里读到的就是主站那个 id。
 * 各写各的会让同一个人在两边各拿一份游客额度 —— 而额度桶是全平台共用的一份，
 * 那就等于把限流开了个口子。**共用 key 是有意的，别改名。**
 *
 * 未登录时后端靠 (visitor_id, IP) 计当天用量；登录了就走账户，这个 id 不起作用。
 */
/**
 * 后端回的错分两类，**说法不该一样**：
 *   · 额度用完（guest_limit / no_credits）—— 这不是故障，是正常的业务答复。
 *     写成「出错了：…」会让人以为产品坏了，转身就走。
 *   · 其余（网络、500、模型挂了）—— 那才是出错了。
 */
export class AiError extends Error {
  constructor(message: string, readonly code = '') { super(message); this.name = 'AiError' }
}
const QUOTA_CODES = new Set(['guest_limit', 'no_credits', 'guest_unidentified'])
function fmtErr(e: unknown): string {
  const msg = (e as Error)?.message ?? String(e)
  const code = e instanceof AiError ? e.code : ''
  return QUOTA_CODES.has(code) ? msg : `出错了：${msg}`
}

const VISITOR_KEY = 'xm:vid'
function visitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY)
    if (!v) {
      v = 'v_' + (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
      localStorage.setItem(VISITOR_KEY, v)
    }
    return v
  } catch { return '' }   // 隐私模式：拿不到就只按 IP 计，宁可严一点
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  if (GITHUB_PAGES) throw new AiError('请前往虾米伙伴使用在线 AI 学伴')
  const vid = visitorId()
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(vid ? { 'X-Visitor-Id': vid } : {}) },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new AiError((data as { error?: string })?.error ?? `HTTP ${r.status}`,
                               (data as { code?: string })?.code ?? '')
  const b = (data as { billing?: Billing })?.billing
  //  没带 billing 的接口（比如 /quiz 走引擎不调模型）不去覆盖上一次的结果
  if (b && typeof b.note === 'string') {
    setBilling(b)
    /**
     * 真扣了分就通知页眉那颗积分胶囊重新拉余额 —— 跟主站 lib/api.ts 同一个约定
     * （`xm-credits-changed`）。不发的话胶囊要等切页/刷新才变：
     * **面板说"还剩 3 积分"、胶囊说"今日 4 积分"，同一屏两个数**。
     * 没计上费（metered=false）时不发 —— 余额没动，白拉一次。
     */
    if (b.metered) {
      try { window.dispatchEvent(new CustomEvent('xm-credits-changed')) } catch { /* 老浏览器 */ }
    }
  }
  return data as T
}

/**
 * 本次消耗条。三种状态**分开说**,因为用户该做的事完全不同：
 *   扣了分   → 正常，告诉他花了几分
 *   没调模型 → 这一步本来就免费（引擎出题），不是漏计
 *   该扣没扣 → **异常**，必须显眼：闸口没通/没登录，钱在流而账没记
 */
function BillingNote() {
  const b = useSyncExternalStore(subscribeBilling, getBilling, getBilling)
  if (!b) return null
  if (!b.metered && b.note === '未调用大模型') {
    return <p className="aic-bill">这一步没调用大模型（引擎现出的题），<b>不计费</b>。</p>
  }
  if (b.metered && b.guest) {
    /**
     * ⚠️ **单位是积分，不是"次"。**
     *
     * 这里一度写成「今天还剩 4 / 5 次」—— 那是积分制**之前**的说法，早废弃了。
     * 全平台一律按积分讲：页眉那颗胶囊未登录时写「◈ 今日 N 积分 · 未登录」，
     * 登录后写余额；`/v1/guest/quota` 返回的 limit/used/left 也都是积分。
     * 把积分换算成"次"看着更好懂，实际是把口径拆成两套 ——
     * 一次调用未必正好 1 分（token 多就不止），"次"根本对不上账。
     */
    const left = Math.max(0, (b.limit ?? 0) - (b.used ?? 0))
    return (
      <p className="aic-bill">
        本次消耗 <b>{b.credits}</b> 积分（{b.tokens} tokens）——
        今日游客额度还剩 <b>{left}</b> 积分
        {left === 0 && <>，<b>登录</b>后每天领 10 积分</>}
      </p>
    )
  }
  if (b.metered) {
    return <p className="aic-bill">本次消耗 <b>{b.credits}</b> 积分（{b.tokens} tokens）。</p>
  }
  //  metered=false 又不是"没调模型" —— 模型真调了、钱真花了、账没记上
  return <p className="aic-bill aic-bill-warn">⚠️ 调用了大模型但<b>没能计费</b>：{b.note}</p>
}

type Mode = 'quiz' | 'ask' | 'review' | 'interview'
type Turn = { role: 'interviewer' | 'candidate'; text: string }

/** AI 学伴出题作答的回调 —— 把 factId + 对错 + 出处 + 题面 报给 App 计入进度 */
export type OnFactAnswer = (factId: string, correct: boolean, expId: string, label: string) => void

export function AiCompanion({ expId, onCite, onFactAnswer, drillFactId, onDrillConsumed }: {
  expId: string; onCite?: (step: number) => void; onFactAnswer?: OnFactAnswer
  /** 从进度面板「去练最弱那条」跳来时,要定向出题的 factId(仅当它属于当前实验) */
  drillFactId?: string; onDrillConsumed?: () => void
}) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [mode, setMode] = useState<Mode>('quiz')
  //  已进过的模式:只挂载访问过的 View,并保持挂载——切页签不再清空答过的题/问答/半场面试。
  const [visited, setVisited] = useState<Set<Mode>>(() => new Set<Mode>(['quiz']))

  useEffect(() => {
    let live = true
    loadSupported().then(s => { if (live) setSupported(s.has(expId)) })
    return () => { live = false }
  }, [expId])

  useEffect(() => { setVisited(v => v.has(mode) ? v : new Set(v).add(mode)) }, [mode])
  //  从进度面板「去练最弱那条」跳来:自动切到出题模式,别让定向题落在别的页签后头看不见。
  useEffect(() => { if (drillFactId) setMode('quiz') }, [drillFactId])

  if (GITHUB_PAGES) return (
    <div className="aic aic-muted">
      <p>当前为 GitHub Pages 版。交互实验、已有练习和本地学习进度可直接使用。</p>
      <p>AI 学伴需要在线服务；如服务开放，可前往虾米伙伴继续当前实验。</p>
      <p><a href={`https://xiamimate.com/cslab/?exp=${encodeURIComponent(expId)}`} target="_blank" rel="noopener noreferrer">打开虾米伙伴在线版 ↗</a></p>
      <p className="aic-hint">虾米伙伴由作者自行维护，可能随时暂停或关闭。这里只传递实验编号，不会自动传送问题或学习记录。</p>
    </div>
  )
  if (supported === null) return <div className="aic aic-muted">加载中…</div>
  if (!supported) {
    return (
      <div className="aic aic-muted">
        <p>此实验暂未接入 <b>AI 学伴</b>。</p>
        <p className="aic-hint">已接入的实验会在这里提供：引擎出题、按真实轨迹答疑、复习卡。</p>
      </div>
    )
  }

  return (
    <div className="aic">
      <div className="aic-modes">
        <button className={mode === 'quiz' ? 'on' : ''} onClick={() => setMode('quiz')}>出题</button>
        <button className={mode === 'ask' ? 'on' : ''} onClick={() => setMode('ask')}>答疑</button>
        <button className={mode === 'review' ? 'on' : ''} onClick={() => setMode('review')}>复习</button>
        <button className={mode === 'interview' ? 'on' : ''} onClick={() => setMode('interview')}>面试</button>
      </div>
      {/*  本次消耗：四个模式共用一条，就摆在页签下方——**花了钱要让人看见**。 */}
      <BillingNote />
      {/*  访问过的模式全保持挂载,只切显示——状态不随页签切换丢失。 */}
      {visited.has('quiz') && <div style={{ display: mode === 'quiz' ? undefined : 'none' }}><QuizView expId={expId} onCite={onCite} onFactAnswer={onFactAnswer} drillFactId={drillFactId} onDrillConsumed={onDrillConsumed} /></div>}
      {visited.has('ask') && <div style={{ display: mode === 'ask' ? undefined : 'none' }}><AskView expId={expId} onCite={onCite} /></div>}
      {visited.has('review') && <div style={{ display: mode === 'review' ? undefined : 'none' }}><ReviewView expId={expId} /></div>}
      {visited.has('interview') && <div style={{ display: mode === 'interview' ? undefined : 'none' }}><InterviewView expId={expId} /></div>}
    </div>
  )
}

// 引用小标签：点一下把舞台跳回引擎算出这个值的那一步（citation chip，可点回溯）
function CiteChip({ step, label, evidence, onCite }: { step: number; label?: string; evidence?: string; onCite?: (s: number) => void }) {
  const clickable = !!onCite && step != null
  return (
    <button className={`aic-cite${clickable ? ' clickable' : ''}`} disabled={!clickable}
      title={clickable ? `${evidence ?? ''}${evidence ? '　' : ''}点击跳到第 ${step} 步` : evidence}
      onClick={() => clickable && onCite!(step)}>
      <span className="aic-cite-tag">依据</span>
      <span className="aic-cite-text">{label ? label + ' · ' : ''}第 {step} 步 · 引擎钉死{clickable ? ' ↩ 回溯' : ''}</span>
    </button>
  )
}

// ── 轻量 markdown 渲染 ──
// 大模型输出带 **粗体** / `代码` / ## 小标题 / 有序·无序列表；不引第三方库，就地渲染这一小撮语法。

// ── 出题 ──
function QuizView({ expId, onCite, onFactAnswer, drillFactId, onDrillConsumed }: {
  expId: string; onCite?: (step: number) => void; onFactAnswer?: OnFactAnswer
  drillFactId?: string; onDrillConsumed?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qs, setQs] = useState<Question[] | null>(null)
  const [picked, setPicked] = useState<Record<number, number>>({})
  /*  讲解按需取:出题接口现在是全同步的(引擎 10 毫秒级,题面就是我们写好的那句),
      讲解才是要等大模型的那一步 —— 而它只在答完之后显示,所以答完再去取。
      取不回来也不要紧:题目自带一份引擎兜底讲解(标准答案 + 出处)。 */
  const [why, setWhy] = useState<Record<string, string>>({})
  const [whyLoading, setWhyLoading] = useState<Record<string, boolean>>({})
  async function fetchWhy(q: Question) {
    const factId = q.factId
    if (why[factId] || whyLoading[factId]) return
    setWhyLoading(w => ({ ...w, [factId]: true }))
    try {
      //  题面与选项一并回传:「找错的」那种题型服务端推不回来。
      //  但「哪个是对的」由服务端拿引擎认识的字符串校验,客户端说了不算。
      const d = await postJSON<{ explanation: string; source: string }>('/cslab/ai/explain',
        { expId, factId, question: q.question, options: q.options, correctIndex: q.correctIndex })
      if (d.source === 'llm' && d.explanation) setWhy(w => ({ ...w, [factId]: d.explanation }))
    } catch { /* 兜底讲解已经在题目里了,取不到就用它 */ }
    finally { setWhyLoading(w => ({ ...w, [factId]: false })) }
  }
  const [drilled, setDrilled] = useState(false)   // 这组是不是"定向出的最弱那条"

  async function gen(factId?: string) {
    setLoading(true); setError(''); setPicked({}); setDrilled(!!factId)
    try {
      const d = await postJSON<{ questions: Question[] }>('/cslab/ai/quiz', { expId, factId })
      setQs(d.questions)
    } catch (e) { setError(fmtErr(e)) } finally { setLoading(false) }
  }

  //  从进度面板「去练最弱那条」跳进来:自动出那条 factId 的题。
  useEffect(() => {
    if (!drillFactId) return
    void gen(drillFactId)
    onDrillConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillFactId])

  const answeredCount = Object.keys(picked).length
  const correctCount = qs ? Object.entries(picked).filter(([qi, oi]) => qs[+qi]?.correctIndex === oi).length : 0

  return (
    <div className="aic-body">
      {drilled && qs && <p className="aic-hint">这是你在本实验<b>最弱的一条</b>——练到掌握它就出师。</p>}
      <button className="aic-go" disabled={loading} onClick={() => gen()}>{loading ? '出题中…' : qs ? '换一组' : '出一组题'}</button>
      {error && <p className="aic-err">{error}</p>}
      {qs && answeredCount > 0 && (
        <p className="aic-tally">本组已答 {answeredCount}/{qs.length} · 对 <b>{correctCount}</b> 道
          {answeredCount === qs.length && <span className="aic-tally-pct">　正确率 {Math.round(correctCount / qs.length * 100)}%</span>}</p>
      )}
      {qs?.map((q, qi) => {
        const chosen = picked[qi]
        const answered = chosen != null
        return (
          <div key={qi} className="aic-q">
            <p className="aic-qtext">
              {qi + 1}. {q.question}
              {q.variant === 'odd-one-out'
                ? <span className="aic-genre">找错的</span>
                : q.genre && <span className="aic-genre">{q.genre === 'concept' ? '原理' : '算一遍'}</span>}
            </p>
            <div className="aic-opts">
              {q.options.map((opt, oi) => {
                let cls = 'aic-opt'
                if (answered) {
                  if (oi === q.correctIndex) cls += ' correct'
                  else if (oi === chosen) cls += ' wrong'
                }
                return (
                  <button key={oi} className={cls} disabled={answered}
                    onClick={() => {
                      if (picked[qi] != null) return   // 已答过不重复记账
                      setPicked(p => ({ ...p, [qi]: oi }))
                      //  讲解**答完才取** —— 它本来就只在这时候显示,提前给三道都生成是白等 10 秒
                      void fetchWhy(q)
                      //  作答即计入进度:factId + 对错 + 出处实验 + 题面(错题本要显示)
                      onFactAnswer?.(q.factId, oi === q.correctIndex, expId, q.question)
                    }}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {answered && (
              <>
                <div className="aic-explain">
                  <p className="aic-explain-verdict">{chosen === q.correctIndex ? '✓ 对了。' : `✗ 正确答案：${q.options[q.correctIndex]}。`}</p>
                  <Md text={why[q.factId] ?? q.explanation} />
                  {whyLoading[q.factId] && <p className="aic-hint">讲解生成中…</p>}
                  <span className="aic-prov">答案由引擎钉死、题面照原样出{why[q.factId] ? '，讲解由大模型据要点生成' : ''}</span>
                </div>
                {q.provenance.sourceStep != null && <CiteChip step={q.provenance.sourceStep} evidence={q.provenance.evidence} onCite={onCite} />}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 答疑 ──
function AskView({ expId, onCite }: { expId: string; onCite?: (step: number) => void }) {
  const [suggest, setSuggest] = useState<{ factId: string; ask: string }[]>([])
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState('')
  const [prov, setProv] = useState<{ step: number; evidence: string } | null>(null)
  const [customOpen, setCustomOpen] = useState(false)

  useEffect(() => {
    let live = true
    setSuggest([]); setAnswer(''); setAsked('')
    fetch(`/cslab/ai/suggest?expId=${encodeURIComponent(expId)}`).then(r => r.json())
      .then(d => { if (live) setSuggest(d.questions ?? []) }).catch(() => { })
    return () => { live = false }
  }, [expId])

  async function ask(question: string, factId?: string) {
    if (!question.trim() || loading) return
    setLoading(true); setError(''); setAnswer(''); setProv(null); setAsked(question)
    try {
      const d = await postJSON<{ answer: string; provenance?: { step: number; evidence: string } }>('/cslab/ai/ask', { expId, question, factId })
      setAnswer(d.answer); if (d.provenance) setProv(d.provenance)
    } catch (e) { setError(fmtErr(e)) } finally { setLoading(false) }
  }

  return (
    <div className="aic-body">
      <p className="aic-hint">点一个想弄懂的问题——按这个实验<b>真跑出来的每一步 + 钉死要点</b>回答（轨迹里没有的会直说不知道）。</p>
      <div className="aic-suggest">
        {suggest.map(s => (
          <button key={s.factId} className={`aic-sug${asked === s.ask ? ' on' : ''}`} disabled={loading} onClick={() => ask(s.ask, s.factId)}>{s.ask}</button>
        ))}
      </div>
      <button className="aic-linkbtn" onClick={() => setCustomOpen(o => !o)}>{customOpen ? '收起自定义提问' : '或者自己问一句…'}</button>
      {customOpen && <>
        <textarea className="aic-ta" value={q} placeholder="例如：第 0 步为什么往右半查找？（⌘/Ctrl+Enter 提交）"
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(q) }} />
        <button className="aic-go" disabled={loading || !q.trim()} onClick={() => ask(q)}>{loading ? '助教思考中…' : '问'}</button>
      </>}
      {loading && <p className="aic-hint" style={{ opacity: .7 }}>助教思考中…</p>}
      {error && <p className="aic-err">{error}</p>}
      {answer && <div className="aic-answer"><Md text={answer} /></div>}
      {answer && prov && <CiteChip step={prov.step} evidence={prov.evidence} onCite={onCite} />}
    </div>
  )
}

// ── 复习 ──
function ReviewView({ expId }: { expId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pack, setPack] = useState<ReviewPack | null>(null)

  async function gen() {
    setLoading(true); setError('')
    try {
      const d = await postJSON<ReviewPack>('/cslab/ai/review', { expId })
      setPack(d)
    } catch (e) { setError(fmtErr(e)) } finally { setLoading(false) }
  }

  return (
    <div className="aic-body">
      <button className="aic-go" disabled={loading} onClick={gen}>{loading ? '生成中…' : pack ? '重新生成' : '生成复习包'}</button>
      {error && <p className="aic-err">{error}</p>}
      {pack && (
        <>
          {pack.summary && <div className="aic-summary"><b>复习小结</b><Md text={pack.summary} /></div>}
          {pack.factCards.length > 0 && (
            <div className="aic-cards">
              <div className="aic-cards-h">要点卡 <span className="aic-badge engine">答案钉死</span></div>
              {pack.factCards.map((c, i) => <Flashcard key={i} card={c} />)}
            </div>
          )}
          {pack.conceptCards.length > 0 && (
            <div className="aic-cards">
              <div className="aic-cards-h">概念卡 <span className="aic-badge llm">大模型</span></div>
              {pack.conceptCards.map((c, i) => <Flashcard key={i} card={c} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── 面试（模拟面试官，多轮对话） ──
function InterviewView({ expId }: { expId: string }) {
  const [scope, setScope] = useState<'one' | 'track'>('one')
  const [history, setHistory] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ref, setRef] = useState('')        // 参考答案(点"看参考答案"才拉)
  const [refLoading, setRefLoading] = useState(false)

  function bodyFor(nextHistory: Turn[]) {
    return scope === 'track'
      ? { expId, expIds: trackExpIdsOf(expId), trackTitle: trackTitleOf(expId), history: nextHistory }
      : { expId, history: nextHistory }
  }

  async function post(nextHistory: Turn[]) {
    setLoading(true); setError(''); setRef('')     // 新问题来了，清掉上题的参考答案
    try {
      const d = await postJSON<{ reply: string; done: boolean }>('/cslab/ai/interview', bodyFor(nextHistory))
      setHistory([...nextHistory, { role: 'interviewer', text: d.reply }])
      setDone(d.done)
    } catch (e) { setError(fmtErr(e)) } finally { setLoading(false) }
  }

  async function showRef() {
    if (refLoading || ref) return
    setRefLoading(true); setError('')
    try {
      const d = await postJSON<{ answer: string }>('/cslab/ai/interview-answer', bodyFor(history))
      setRef(d.answer)
    } catch (e) { setError(fmtErr(e)) } finally { setRefLoading(false) }
  }

  const TOTAL_ROUNDS = 3   // 与后端 interview.ts 的 MAX_ROUNDS 对齐:答满 3 轮进总评
  const answeredRounds = history.filter(t => t.role === 'candidate').length

  function start() { setHistory([]); setDone(false); setRef(''); post([]) }
  function answer() {
    if (!input.trim() || loading || done) return
    const next: Turn[] = [...history, { role: 'candidate', text: input.trim() }]
    setHistory(next); setInput('')
    post(next)
  }

  return (
    <div className="aic-body">
      {history.length === 0
        ? <>
            <div className="aic-subtabs">
              <button className={scope === 'one' ? 'on' : ''} onClick={() => setScope('one')}>本实验</button>
              <button className={scope === 'track' ? 'on' : ''} onClick={() => setScope('track')}>整轨（{trackTitleOf(expId)}）</button>
            </div>
            <p className="aic-hint">{scope === 'one'
              ? <>AI 当<b>面试官</b>，就<b>本实验</b>面你：问 → 你答 → 点评+追问，几轮后给评分。答案由实验要点<b>钉死</b>当判据，挑得出你哪里没答到。</>
              : <>AI 当<b>面试官</b>，覆盖<b>整条「{trackTitleOf(expId)}」职业线</b>跨主题面你：每轮换一个知识点考广度，几轮后给评分。判据由这条线各实验要点<b>钉死</b>——像真面试那样不只问一个点。</>}</p>
            <button className="aic-go" disabled={loading} onClick={start}>{loading ? '面试官准备中…' : scope === 'track' ? '开始整轨面试' : '开始模拟面试'}</button>
          </>
        : <>
            <div className="aic-ivprog">
              {done ? <span className="aic-ivprog-done">面试结束 · 共 {TOTAL_ROUNDS} 轮,看下方总评与评分</span>
                : <>第 <b>{Math.min(answeredRounds + 1, TOTAL_ROUNDS)}</b> / {TOTAL_ROUNDS} 轮
                  <span className="aic-ivprog-dots">{Array.from({ length: TOTAL_ROUNDS }, (_, i) => <i key={i} className={i < answeredRounds ? 'done' : i === answeredRounds ? 'cur' : ''} />)}</span></>}
            </div>
            <div className="aic-chat">
              {history.map((t, i) => (
                <div key={i} className={`aic-msg ${t.role}`}>
                  <span className="aic-msg-who">{t.role === 'interviewer' ? '面试官' : '你'}</span>
                  <div className="aic-msg-text"><Md text={t.text} /></div>
                </div>
              ))}
              {loading && <div className="aic-msg interviewer"><span className="aic-msg-who">面试官</span><span className="aic-msg-text" style={{ opacity: .6 }}>思考中…</span></div>}
            </div>
            {ref && <div className="aic-ref"><span className="aic-ref-tag">参考答案 · 由实验要点钉死</span><div className="aic-ref-body"><Md text={ref} /></div></div>}
            {done
              ? <button className="aic-go" onClick={start}>再面一轮</button>
              : <>
                  <textarea className="aic-ta" value={input} placeholder="输入你的回答（⌘/Ctrl+Enter 提交）"
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) answer() }} />
                  <div className="aic-row">
                    <button className="aic-go" disabled={loading || !input.trim()} onClick={answer}>{loading ? '面试官思考中…' : '回答'}</button>
                    {!ref && <button className="aic-ghost" disabled={refLoading || loading} onClick={showRef}>{refLoading ? '取参考答案…' : '看参考答案'}</button>}
                  </div>
                </>}
          </>}
      {error && <p className="aic-err">{error}</p>}
    </div>
  )
}

function Flashcard({ card }: { card: Card }) {
  const [open, setOpen] = useState(false)
  return (
    <button className={`aic-card ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
      <span className="aic-card-front">{mdInline(card.front)}</span>
      {open && <span className="aic-card-back">{mdInline(card.back)}</span>}
      {!open && <span className="aic-card-flip">点击看答案</span>}
    </button>
  )
}
