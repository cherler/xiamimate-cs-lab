/** 舞台：子 Agent/委派 —— 委派树逐个长出 + token 账本(子内部大、回传小=省) + 深度守卫 */
import type { SubState, Node } from '@engine/kernels/subagent.ts'
import type { StageProps } from '../types.ts'

export function SubAgentStage({ state }: StageProps<SubState>) {
  const { stage, seed, nodes, cur, parentCtx, internalTotal, returnTotal, depthCap, concCap, childStart, blocked } = state
  const saved = internalTotal - returnTotal
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0)
  const retPct = internalTotal ? (returnTotal / internalTotal) * 100 : 0

  return (
    <div className="card">
      <h3>子 Agent / 委派 <span className="hint">派活给子 agent：独立上下文、只回传结果、防 fork 炸弹</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{seed}<em className="cc-u"> · 子起 {childStart}t</em></span><span className="scdl">起始方式</span></div>
          <div className="scdk"><span className="scdn">{parentCtx}<em className="cc-u">t</em></span><span className="scdl">父上下文</span></div>
          <div className="scdk"><span className={`scdn ${blocked ? 'hot' : ''}`}>{maxDepth}<em className="cc-u">/{depthCap}</em></span><span className="scdl">最大深度</span></div>
        </div>

        {/* token 账本：子内部大块 vs 回传小块 = 省 */}
        <div className="sa-ledger">
          <div className="sa-led-h">token 账本：子干的活 vs 回传给父</div>
          <div className="sa-bar">
            <div className="sa-ret" style={{ width: `${retPct}%` }} title={`回传 ${returnTotal}t`} />
            <div className="sa-save" style={{ width: `${100 - retPct}%` }} title={`省下 ${saved}t（关在子里）`} />
          </div>
          <div className="sa-led-n">
            <span>子内部共 <b>{internalTotal}t</b></span>
            <span className="sa-ret-l">父只收 <b>{returnTotal}t</b></span>
            <span className="sa-save-l">省 <b>{saved}t</b>（大块探索关在子里、不污染父）</span>
          </div>
        </div>

        {/* 委派树 */}
        <div className="sa-tree">
          <div className="sa-node root"><span className="sa-nn">父 agent</span><span className="sa-nd">深度 0</span><span className="sa-nt">{parentCtx}t</span></div>
          {nodes.map((n: Node) => (
            <div key={n.id} className={`sa-node ${n.id === cur ? 'cur' : ''}`} style={{ marginLeft: `${n.depth * 20}px` }}>
              <span className="sa-nn">↳ {n.name}</span>
              <span className="sa-nd">d{n.depth}·父 {n.parentId}</span>
              <span className="sa-nt"><b>{n.internalTok}t</b> 内部 → <em>{n.returnTok}t</em> 回传</span>
              <span className="sa-nr">「{n.result}」</span>
            </div>
          ))}
          {stage === 'blocked' && (
            <div className="sa-node blocked" style={{ marginLeft: `${(depthCap + 1) * 20}px` }}>
              <span className="sa-nn">✗ 想再派（深度 {depthCap + 1}）</span>
              <span className="sa-nd">被拦</span>
              <span className="sa-nr">spawn 工具已摘 —— 防 fork 炸弹</span>
            </div>
          )}
        </div>

        <div className="sa-guards">
          <span className={maxDepth >= depthCap ? 'on' : ''}>深度 {maxDepth}/{depthCap}</span>
          <span>并发 ≤{concCap}</span>
          <span>只回传最终结果</span>
          <span>子权限不可自扩</span>
        </div>

        {stage === 'done'
          ? <p className="scnote"><b>子内部共 {internalTotal}t，父只涨 {returnTotal}t，省 {saved}t</b>。委派划算的头号理由：子在独立上下文里探索、<b>只把结论回传</b>，大块探索不污染父。四条铁律：独立上下文 · 只回传结果 · 深度/并发上限防 fork 炸弹 · 子权限不可自扩。spawn(新开)从空白起、fork(承接)带父前缀续得上；子崩了不连累父。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
