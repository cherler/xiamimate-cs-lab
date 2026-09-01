/** 舞台：反思/巩固 —— 观察流(带重要度累积条) → 触发 → 提炼洞察(引用证据) */
import type { ReflState, ObsRow } from '@engine/kernels/reflection.ts'
import type { StageProps } from '../types.ts'

const rich = (s: string) => s.split(/(\*\*[^*]+\*\*)/).map((seg, i) => seg.startsWith('**') && seg.endsWith('**') ? <b key={i}>{seg.slice(2, -2)}</b> : <span key={i}>{seg}</span>)

export function ReflectionStage({ state }: StageProps<ReflState>) {
  const { stage, threshold, thresholdKey, obs, cum, insight } = state
  const shown = obs.filter(o => o.cum > 0 || stage === 'intro')
  const list = stage === 'intro' ? obs : (shown.length ? shown : obs)
  const pct = Math.min(100, (cum / threshold) * 100)
  const over = cum >= threshold

  return (
    <div className="card">
      <h3>反思 / 巩固 <span className="hint">观察攒够重要度 → 提炼高层洞察（带证据），入库成新记忆</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{threshold}<em className="cc-u"> {thresholdKey}</em></span><span className="scdl">反思阈值</span></div>
          <div className="scdk"><span className={`scdn ${over ? 'hot' : ''}`}>{cum}</span><span className="scdl">累计重要度</span></div>
          <div className="scdk"><span className="scdn">{insight ? '已提炼' : over ? '触发' : '累积中'}</span><span className="scdl">状态</span></div>
        </div>

        {/* 累计重要度 → 阈值 */}
        <div className="rf-cum">
          <span className="rf-cl">累计重要度</span>
          <div className="rf-bar"><div className={`rf-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} /><div className="rf-thr" /></div>
          <span className="rf-cv">{cum} / {threshold}</span>
        </div>

        {/* 观察流 */}
        <div className="rf-obs">
          <div className="rf-h">观察流（记忆流里的原始观察）</div>
          {list.map((o: ObsRow) => (
            <div key={o.id} className={`rf-o ${o.reflected ? 'used' : ''}`}>
              <span className="rf-oid">{o.id}</span>
              <span className="rf-ot">{o.text}</span>
              <span className="rf-oimp">重要度 {o.importance}{o.cum > 0 ? ` · 累计 ${o.cum}` : ''}</span>
            </div>
          ))}
        </div>

        {/* 提炼出的洞察 */}
        {insight && (
          <div className="rf-insight">
            <div className="rf-ih">💡 反思提炼出的洞察（新记忆，重要度 {insight.importance}）</div>
            <div className="rf-it">{rich(insight.text)}</div>
            <div className="rf-iev">↑ 证据：{insight.evidence.join(' · ')}（可追溯到上面这几条观察，不是凭空）</div>
          </div>
        )}

        {stage === 'done'
          ? <p className="scnote"><b>{insight?.evidence.length} 条零散观察 → 1 条高层洞察</b>。反思=定期把 raw 观察消化成 insight：<b>触发</b>靠重要度累积过阈值(论文约 150，琐事慢·要事快)；<b>提炼</b>时 LLM 综合观察成洞察并<b>引用证据</b>(可追溯)；洞察是<b>高重要度的新记忆</b>、还能被更高层反思 → <b>反思树</b>。和上下文压缩的摘要不同：压缩为省 token 压最近的，反思为长期理解把零散的往上抽象。切「阈值」看反思勤/懒。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
