/**
 * AI 学伴面板（坞的一个页签）。
 *
 * 三种用法，都打后端 /lab/ai/*（独立进程 server/index.ts，dev 由网关/vite 代理转发）：
 *   出题  —— 引擎算钉死答案，大模型只写题面；选完当场判对错 + 看讲解。
 *   答疑  —— 把当前实验的真实运行轨迹当唯一依据回答，问轨迹外会诚实说不知道。
 *   复习  —— 钉死事实卡 + 概念卡 + 小结。
 *
 * 后端目前只接了部分实验（见 /lab/ai/experiments）；没接的给一句友好提示，不报错。
 */
import { useEffect, useState } from 'react'
import { EXPERIMENTS, DISCIPLINE_OF_GROUP } from '../registry.ts'

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
  explanation: string; provenance: { engineAnswer: string; phrasedBy: 'llm' | 'fallback'; sourceStep?: number; evidence?: string }
}
type Card = { front: string; back: string; source: 'engine' | 'llm' }
type ReviewPack = { title: string; summary: string; factCards: Card[]; conceptCards: Card[] }

// 可出题实验（id → 事实题数）只取一次，跨面板共享。事实题数=该实验 AI 学伴掌握度的分母。
let SUPPORTED: Map<string, number> | null = null
let supportedPromise: Promise<Map<string, number>> | null = null
export function loadAiFacts(): Promise<Map<string, number>> {
  if (SUPPORTED) return Promise.resolve(SUPPORTED)
  if (!supportedPromise) {
    supportedPromise = fetch('/lab/ai/experiments')
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

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error((data as { error?: string })?.error ?? `HTTP ${r.status}`)
  return data as T
}

type Mode = 'quiz' | 'ask' | 'review' | 'interview'
type Turn = { role: 'interviewer' | 'candidate'; text: string }

/** AI 学伴出题作答的回调 —— 把 factId + 对错 + 出处 + 题面 报给 App 计入进度 */
export type OnFactAnswer = (factId: string, correct: boolean, expId: string, label: string) => void

export function AiCompanion({ expId, onCite, onFactAnswer }: { expId: string; onCite?: (step: number) => void; onFactAnswer?: OnFactAnswer }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [mode, setMode] = useState<Mode>('quiz')

  useEffect(() => {
    let live = true
    loadSupported().then(s => { if (live) setSupported(s.has(expId)) })
    return () => { live = false }
  }, [expId])

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
      {mode === 'quiz' && <QuizView expId={expId} onCite={onCite} onFactAnswer={onFactAnswer} />}
      {mode === 'ask' && <AskView expId={expId} onCite={onCite} />}
      {mode === 'review' && <ReviewView expId={expId} />}
      {mode === 'interview' && <InterviewView expId={expId} />}
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
// mdInline：只处理行内(粗体/代码/斜体)，用于气泡、卡片这类不便放块级元素的地方。
function mdInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|(?<![*\w])\*([^*\n]+)\*(?![*\w]))/g
  let last = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[2] != null) nodes.push(<strong key={k++}>{m[2]}</strong>)
    else if (m[3] != null) nodes.push(<code key={k++} className="aic-code">{m[3]}</code>)
    else nodes.push(<em key={k++}>{m[4]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
// Md：块级渲染(段落/小标题/有序·无序列表 + 行内)。用于答疑答案、参考答案、面试对话、讲解、复习小结等长文。
function Md({ text }: { text: string }) {
  const lines = (text ?? '').replace(/\r/g, '').split('\n')
  const out: React.ReactNode[] = []
  let para: string[] = []; let key = 0
  const flush = () => { if (para.length) { const p = para; out.push(<p key={key++}>{p.map((l, j) => <span key={j}>{j > 0 && <br />}{mdInline(l)}</span>)}</p>); para = [] } }
  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    if (!line.trim()) { flush(); i++; continue }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) { flush(); out.push(<p key={key++} className="aic-md-h">{mdInline(h[2])}</p>); i++; continue }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush(); const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      out.push(<ol key={key++}>{items.map((t, j) => <li key={j}>{mdInline(t)}</li>)}</ol>); continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      flush(); const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ''))
      out.push(<ul key={key++}>{items.map((t, j) => <li key={j}>{mdInline(t)}</li>)}</ul>); continue
    }
    para.push(line); i++
  }
  flush()
  return <div className="aic-md">{out}</div>
}

// ── 出题 ──
function QuizView({ expId, onCite, onFactAnswer }: { expId: string; onCite?: (step: number) => void; onFactAnswer?: OnFactAnswer }) {
  const [sub, setSub] = useState<'normal' | 'debate'>('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [qs, setQs] = useState<Question[] | null>(null)
  const [picked, setPicked] = useState<Record<number, number>>({})

  async function gen() {
    setLoading(true); setError(''); setPicked({})
    try {
      const d = await postJSON<{ questions: Question[] }>('/lab/ai/quiz', { expId })
      setQs(d.questions)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  const subtabs = (
    <div className="aic-subtabs">
      <button className={sub === 'normal' ? 'on' : ''} onClick={() => setSub('normal')}>常规题</button>
      <button className={sub === 'debate' ? 'on' : ''} onClick={() => setSub('debate')}>反驳同学</button>
    </div>
  )
  if (sub === 'debate') return <>{subtabs}<DebateView expId={expId} onCite={onCite} /></>

  return (
    <div className="aic-body">
      {subtabs}
      <button className="aic-go" disabled={loading} onClick={gen}>{loading ? '出题中…' : qs ? '换一组' : '出一组题'}</button>
      {error && <p className="aic-err">出错了：{error}</p>}
      {qs?.map((q, qi) => {
        const chosen = picked[qi]
        const answered = chosen != null
        return (
          <div key={qi} className="aic-q">
            <p className="aic-qtext">{qi + 1}. {q.question}</p>
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
                  <Md text={q.explanation} />
                  <span className="aic-prov">答案由引擎钉死{q.provenance.phrasedBy === 'llm' ? '，题面由大模型改写' : ''}</span>
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
    fetch(`/lab/ai/suggest?expId=${encodeURIComponent(expId)}`).then(r => r.json())
      .then(d => { if (live) setSuggest(d.questions ?? []) }).catch(() => { })
    return () => { live = false }
  }, [expId])

  async function ask(question: string, factId?: string) {
    if (!question.trim() || loading) return
    setLoading(true); setError(''); setAnswer(''); setProv(null); setAsked(question)
    try {
      const d = await postJSON<{ answer: string; provenance?: { step: number; evidence: string } }>('/lab/ai/ask', { expId, question, factId })
      setAnswer(d.answer); if (d.provenance) setProv(d.provenance)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
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
      {error && <p className="aic-err">出错了：{error}</p>}
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
      const d = await postJSON<ReviewPack>('/lab/ai/review', { expId })
      setPack(d)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  return (
    <div className="aic-body">
      <button className="aic-go" disabled={loading} onClick={gen}>{loading ? '生成中…' : pack ? '重新生成' : '生成复习包'}</button>
      {error && <p className="aic-err">出错了：{error}</p>}
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
      const d = await postJSON<{ reply: string; done: boolean }>('/lab/ai/interview', bodyFor(nextHistory))
      setHistory([...nextHistory, { role: 'interviewer', text: d.reply }])
      setDone(d.done)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  async function showRef() {
    if (refLoading || ref) return
    setRefLoading(true); setError('')
    try {
      const d = await postJSON<{ answer: string }>('/lab/ai/interview-answer', bodyFor(history))
      setRef(d.answer)
    } catch (e) { setError((e as Error).message) } finally { setRefLoading(false) }
  }

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
      {error && <p className="aic-err">出错了：{error}</p>}
    </div>
  )
}

// ── 反驳（会反驳的 AI 同学，选择题版：同学抛错主张，你选能驳倒 TA 的那句） ──
type DebateData = { factId: string; claim: string; options: string[]; correctIndex: number; answer: string; provenance: { label: string; step: number; evidence: string } }
function DebateView({ expId, onCite }: { expId: string; onCite?: (step: number) => void }) {
  const [data, setData] = useState<DebateData | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function start() {
    setLoading(true); setError(''); setPicked(null); setData(null)
    try {
      const d = await postJSON<DebateData>('/lab/ai/debate', { expId })
      setData(d)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  const answered = picked != null
  return (
    <div className="aic-body">
      {!data
        ? <>
            <p className="aic-hint">AI 当<b>爱抬杠的同学</b>：它抛一个<b>其实错的</b>常见误解，你从几句里<b>选出能驳倒 TA 的那句</b>。错误主张取自这道题<b>钉死的干扰项</b>，对错由引擎判（和出题一个口径，不用打字）。</p>
            <button className="aic-go" disabled={loading} onClick={start}>{loading ? '同学准备开怼…' : '来辩一场'}</button>
          </>
        : <>
            <div className="aic-chat">
              <div className="aic-msg interviewer"><span className="aic-msg-who">同学</span><div className="aic-msg-text"><Md text={data.claim} /></div></div>
            </div>
            <p className="aic-qtext">选一句驳倒 TA：</p>
            <div className="aic-opts">
              {data.options.map((opt, oi) => {
                let cls = 'aic-opt'
                if (answered) { if (oi === data.correctIndex) cls += ' correct'; else if (oi === picked) cls += ' wrong' }
                return <button key={oi} className={cls} disabled={answered} onClick={() => setPicked(oi)}>{opt}</button>
              })}
            </div>
            {answered && (
              <>
                <p className="aic-explain">
                  {picked === data.correctIndex ? '✓ 驳倒了！同学：哦……好像真是我错了。' : `✗ 没驳到点上。正解：${data.answer}。同学：看吧，你也没搞对。`}
                </p>
                <CiteChip step={data.provenance.step} label={data.provenance.label} evidence={data.provenance.evidence} onCite={onCite} />
                <button className="aic-go" onClick={start}>换个点再辩</button>
              </>
            )}
          </>}
      {error && <p className="aic-err">出错了：{error}</p>}
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
