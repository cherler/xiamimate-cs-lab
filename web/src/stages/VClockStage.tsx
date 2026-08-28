/** 舞台：向量时钟 —— 三进程各持一向量，本地+1/收消息取max，最后判因果 vs 并发 */
import type { VClockState } from '@engine/kernels/vectorclock.ts'
import type { StageProps } from '../types.ts'

const P = ['P0', 'P1', 'P2']

function Vec({ v, active, glow }: { v: number[]; active?: boolean; glow?: number }) {
  return (
    <span className={`vc-vec ${active ? 'act' : ''}`}>
      [{v.map((n, k) => <i key={k} className={glow === k ? 'g' : ''}>{n}{k < 2 ? ',' : ''}</i>)}]
    </span>
  )
}

export function VClockStage({ state }: StageProps<VClockState>) {
  const { op, proc, clocks, msg, label, cmp, phase } = state
  const done = phase === 'done'
  const actLabel = op === 'local' ? '本地事件 · 自己+1' : op === 'send' ? '发消息 · 自己+1 带走向量' : op === 'recv' ? '收消息 · 逐位max后自己+1' : op === 'compare' ? '判定先后' : '就绪'

  return (
    <div className="card">
      <h3>向量时钟 <span className="hint">分布式判先后：谁因果先行、谁只是并发</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{label ? `事件 ${label}` : op === 'compare' ? '判定' : '布局'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{proc >= 0 ? P[proc] : '—'}</span><span className="scdl">动作进程</span></div>
          <div className="scdk"><span className="scdn">{actLabel}</span><span className="scdl">规则</span></div>
        </div>

        <div className="vc-procs">
          {clocks.map((v, pi) => (
            <div key={pi} className={`vc-proc ${proc === pi ? 'on' : ''}`}>
              <span className="vc-pname">{P[pi]}</span>
              <Vec v={v} active={proc === pi} glow={proc === pi ? pi : undefined} />
            </div>
          ))}
        </div>

        {msg && (op === 'send' || op === 'recv') && (
          <div className={`vc-msg ${op}`}>
            {op === 'send' ? '📤 随消息带走' : '📥 收到并 max'} <span className="vc-mvec">[{msg.join(',')}]</span>
          </div>
        )}

        {done && cmp.length > 0 && (
          <div className="vc-cmp">
            {cmp.map((c, i) => {
              const concurrent = c.rel.startsWith('并发')
              return (
                <div key={i} className={`vc-crow ${concurrent ? 'conc' : 'causal'}`}>
                  <span className="vc-cev">{c.x}<b>[{c.xv.join(',')}]</b></span>
                  <span className="vc-crel">{concurrent ? '⟂' : '→'}</span>
                  <span className="vc-cev">{c.y}<b>[{c.yv.join(',')}]</b></span>
                  <span className="vc-cverdict">{concurrent ? '并发（谁也不 ≤ 谁）' : `因果先行（${c.x} 每位 ≤ ${c.y}）`}</span>
                </div>
              )
            })}
          </div>
        )}

        {done
          ? <p className="scnote">规则：<b>每位都 ≤ 且不全等 ⟺ 因果先行</b>；<b>互相都不 ≤ ⟺ 并发</b>。a→e 因为 a 的向量每位都 ≤ e（a→b→c→d→e 这条链全记在 e 里）；f 与 e 互不 ≤（f 的 P0 更大、e 的 P1 更大）→ 并发。不靠物理时间就能分清"真有先后依赖"和"只是碰巧"。用在因果一致性、冲突检测（Dynamo 购物车合并）、分布式调试。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。盯三个向量：本地事件只动自己那位；收消息时逐位取两边的 max（把对方的"见闻"并进来）再自增。向量里带着一个事件"知道"的全部因果历史。</p>}
      </div>
    </div>
  )
}
