/** 舞台：上下文压缩 —— token 计量条 + 消息列表按区域染色，逐帧压缩、列表收缩 */
import type { CompactState, ViewMsg } from '@engine/kernels/ctxcompact.ts'
import type { StageProps } from '../types.ts'

const ROLE_ICON: Record<string, string> = {
  system: '⚙️', user: '🧑', assistant: '🤖', tool_call: '🔧', tool_result: '📄',
}
const REGION_CN: Record<string, string> = {
  head: '留头', middle: '中间', tail: '留尾', pruned: '已剪', summary: '摘要', elide: '省略',
}

function Gauge({ N, running, threshold, before }: { N: number; running: number; threshold: number; before: number }) {
  const pct = (v: number) => `${Math.min(100, (v / N) * 100)}%`
  const over = running >= threshold
  return (
    <div className="cc-gauge">
      <div className="cc-bar">
        {/* 压缩前的原始水位（淡）*/}
        {before > running && <div className="cc-before" style={{ width: pct(before) }} title={`压缩前 ${before}t`} />}
        {/* 当前水位 */}
        <div className={`cc-fill ${over ? 'over' : 'ok'}`} style={{ width: pct(running) }} />
        {/* 阈值线 */}
        <div className="cc-thr" style={{ left: pct(threshold) }} title={`阈值 ${threshold}t`} />
      </div>
      <div className="cc-scale">
        <span>0</span>
        <span className="cc-thrlab" style={{ left: pct(threshold) }}>阈值 {threshold}</span>
        <span>窗口 {N}</span>
      </div>
    </div>
  )
}

export function CtxCompactStage({ state }: StageProps<CompactState>) {
  const { stage, msgs, running, threshold, N, before, meter, strategy, relievedByPrune, focus } = state
  const done = stage === 'rebuild'
  const over = running >= threshold

  return (
    <div className="card">
      <h3>上下文压缩 <span className="hint">token 爆了 → 留头 + 留最近 + 中间压掉</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className={`scdn ${over ? 'hot' : ''}`}>{running}<em className="cc-u">/{N}</em></span><span className="scdl">累计 token</span></div>
          <div className="scdk"><span className="scdn">{threshold}</span><span className="scdl">压缩阈值</span></div>
          <div className="scdk"><span className="scdn">{before}→{running}</span><span className="scdl">压缩前后</span></div>
        </div>

        <Gauge N={N} running={running} threshold={threshold} before={before} />

        {/* 量 token 的坑：中文被估算低估 */}
        {stage === 'meter' && meter && (
          <div className="cc-meter">
            <div className="cc-meter-s">「{meter.sample}」<em>{meter.chars} 字</em></div>
            <div className="cc-meter-r">
              <span className="cc-est">估算(4字/token) <b>{meter.est}</b></span>
              <span className="cc-arrow">≪</span>
              <span className="cc-real">实际 <b>{meter.real}</b></span>
              <span className="cc-mult">低估 {(meter.real / meter.est).toFixed(1)}×</span>
            </div>
            <div className="cc-meter-n">中文/JSON 被「4字/token」严重低估 → 压缩容易触发得偏晚</div>
          </div>
        )}

        {/* 消息列表：按区域染色，逐帧收缩 */}
        <div className="cc-list">
          {msgs.map((m: ViewMsg) => (
            <div key={m.id} className={`cc-row cc-${m.region}`}>
              <span className="cc-ic">{ROLE_ICON[m.role] ?? '•'}</span>
              <span className="cc-tag">{REGION_CN[m.region]}</span>
              <span className="cc-label">{m.label}</span>
              <span className={`cc-tok ${m.note ? 'cut' : ''}`}>{m.note ?? `${m.shownTok}t`}</span>
            </div>
          ))}
        </div>

        {done
          ? <p className="scnote"><b>压缩完成</b>：{before} → {running} tokens。喂给模型的是「头 + {relievedByPrune ? '剪枝后的中间' : strategy === '总结' ? '摘要' : '省略标记'} + 尾」，落回阈值之下、会话能继续。🔑 <b>原始日志一条没删</b>（append-only，可回放可审计）；系统提示+工具原样在最前，保住 KV/前缀缓存。面试落点：量token(中文被低估)→到阈值触发→留头+留尾(别拆 call/result 对)→先剪超大工具输出→还超就总结(有损·花钱·记得住)或省略(免费·确定·失忆)。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。</p>}
      </div>
    </div>
  )
}
