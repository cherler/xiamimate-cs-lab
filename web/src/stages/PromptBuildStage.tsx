/** 舞台：提示词组装 —— 各段按 tools→system→messages 排，缓存断点分隔可缓存前缀(绿)与动态尾部(黄) + 两轮成本 */
import { Fragment } from 'react'
import type { PBState, Sec } from '@engine/kernels/promptbuild.ts'
import type { StageProps } from '../types.ts'

const TIER_CN: Record<string, string> = { tools: 'tools', system: 'system', messages: 'messages' }

export function PromptBuildStage({ state }: StageProps<PBState>) {
  const { stage, ordering, secs, prefixTok, tailTok, turn2Cached, turn2Full } = state
  const showBp = stage !== 'intro'
  const lastCachedId = secs.filter(s => s.cached).slice(-1)[0]?.id
  const showCost = stage === 'turn2' || stage === 'done'
  const savePct = Math.round((1 - turn2Cached / turn2Full) * 100)

  return (
    <div className="card">
      <h3>提示词组装 · 缓存友好排序 <span className="hint">静态前排、动态后排，前缀命中缓存省 90%</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{ordering}</span><span className="scdl">排序</span></div>
          <div className="scdk"><span className="scdn">{showBp ? prefixTok : '—'}<em className="cc-u">t</em></span><span className="scdl">可缓存前缀</span></div>
          <div className="scdk"><span className={`scdn ${showCost ? 'good' : ''}`}>{showCost ? `省 ${savePct}%` : '—'}</span><span className="scdl">第2轮</span></div>
        </div>

        <div className="pb-secs">
          {secs.map((s: Sec) => (
            <Fragment key={s.id}>
              <div className={`pb-sec ${showBp ? (s.cached ? 'cached' : 'dyn') : ''}`}>
                <span className="pb-tier">{TIER_CN[s.tier]}</span>
                <span className="pb-name">{s.name}</span>
                {showBp && <span className="pb-tag">{s.cached ? '静态·可缓存' : '动态·逐轮变'}</span>}
                <span className="pb-tok">{s.tok}t</span>
              </div>
              {showBp && s.id === lastCachedId && (
                <div className="pb-bp">⎯⎯ 缓存断点（前缀 {prefixTok}t 到此，命中只花 0.1×）⎯⎯</div>
              )}
            </Fragment>
          ))}
        </div>

        {showCost && (
          <div className="pb-cost">
            <div className="pb-cost-h">第 2 轮成本（前缀命中缓存 vs 不用缓存全价）</div>
            <div className="pb-cbar"><div className="pb-cfill cached" style={{ width: `${(turn2Cached / turn2Full) * 100}%` }} /></div>
            <div className="pb-cost-n"><span className="pb-good">缓存后等效 <b>{turn2Cached}t</b></span><span className="pb-full">全价 <b>{turn2Full}t</b></span><span className="pb-save">省 <b>{savePct}%</b></span></div>
          </div>
        )}

        {stage === 'done'
          ? <p className="scnote"><b>拼 prompt 的钱都在"排序"里</b>：前缀缓存是<b>最长相同前缀</b>匹配、命中只花 <b>0.1×</b>。所以静态排前(工具/身份/项目指令)、动态排后(运行时/历史/本轮)、断点放"逐轮不变的最后一块"。<b>别把逐轮变的塞进靠前的块</b>(时间戳/运行时快照)——前缀每轮不同、缓存永不命中(乱序就这翻车，只省 {savePct}%)。这也是 Claude Code 把 CLAUDE.md 当独立 user 消息放后面、DeepSeek 把运行时快照当单独消息注入的原因。和 KV 缓存、上下文压缩(重放系统提示保前缀)同源——都在护那段可复用前缀。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
