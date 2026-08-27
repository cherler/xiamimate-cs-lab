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

type Question = {
  factId: string; question: string; options: string[]; correctIndex: number
  explanation: string; provenance: { engineAnswer: string; phrasedBy: 'llm' | 'fallback' }
}
type Card = { front: string; back: string; source: 'engine' | 'llm' }
type ReviewPack = { title: string; summary: string; factCards: Card[]; conceptCards: Card[] }

// 支持的实验清单只取一次，跨面板共享。
let SUPPORTED: Set<string> | null = null
let supportedPromise: Promise<Set<string>> | null = null
function loadSupported(): Promise<Set<string>> {
  if (SUPPORTED) return Promise.resolve(SUPPORTED)
  if (!supportedPromise) {
    supportedPromise = fetch('/lab/ai/experiments')
      .then(r => r.json())
      .then((d: { experiments: { id: string }[] }) => {
        SUPPORTED = new Set(d.experiments.map(e => e.id))
        return SUPPORTED
      })
      .catch(() => { SUPPORTED = new Set(); return SUPPORTED })
  }
  return supportedPromise
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error((data as { error?: string })?.error ?? `HTTP ${r.status}`)
  return data as T
}

type Mode = 'quiz' | 'ask' | 'review'

export function AiCompanion({ expId }: { expId: string }) {
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
      </div>
      {mode === 'quiz' && <QuizView expId={expId} />}
      {mode === 'ask' && <AskView expId={expId} />}
      {mode === 'review' && <ReviewView expId={expId} />}
    </div>
  )
}

// ── 出题 ──
function QuizView({ expId }: { expId: string }) {
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

  return (
    <div className="aic-body">
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
                    onClick={() => setPicked(p => ({ ...p, [qi]: oi }))}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {answered && (
              <p className="aic-explain">
                {chosen === q.correctIndex ? '✓ 对了。' : `✗ 正确答案：${q.options[q.correctIndex]}。`}
                {' '}{q.explanation}
                <span className="aic-prov">答案由引擎钉死{q.provenance.phrasedBy === 'llm' ? '，题面由大模型改写' : ''}</span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 答疑 ──
function AskView({ expId }: { expId: string }) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState('')

  async function ask() {
    if (!q.trim()) return
    setLoading(true); setError(''); setAnswer('')
    try {
      const d = await postJSON<{ answer: string }>('/lab/ai/ask', { expId, question: q })
      setAnswer(d.answer)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  return (
    <div className="aic-body">
      <p className="aic-hint">按这个实验<b>实际跑出来的每一步</b>回答。问轨迹里没有的，它会直说不知道。</p>
      <textarea className="aic-ta" value={q} placeholder="例如：第 0 步为什么往右半查找？"
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask() }} />
      <button className="aic-go" disabled={loading || !q.trim()} onClick={ask}>{loading ? '思考中…' : '问（⌘/Ctrl+Enter）'}</button>
      {error && <p className="aic-err">出错了：{error}</p>}
      {answer && <div className="aic-answer">{answer}</div>}
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
          {pack.summary && <div className="aic-summary"><b>复习小结</b><p>{pack.summary}</p></div>}
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

function Flashcard({ card }: { card: Card }) {
  const [open, setOpen] = useState(false)
  return (
    <button className={`aic-card ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
      <span className="aic-card-front">{card.front}</span>
      {open && <span className="aic-card-back">{card.back}</span>}
      {!open && <span className="aic-card-flip">点击看答案</span>}
    </button>
  )
}
