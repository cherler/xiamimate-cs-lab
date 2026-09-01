/** 舞台：记忆写入·冲突消解 —— 新事实 + 检索相似 + 决定操作；记忆库随 ADD/UPDATE/DELETE/NOOP 演变 */
import type { MemWState, Mem } from '@engine/kernels/memwrite.ts'
import type { StageProps } from '../types.ts'

const OP_CN: Record<string, string> = { ADD: '新建 ADD', UPDATE: '修正 UPDATE', DELETE: '删除 DELETE', NOOP: '不动 NOOP' }

export function MemWriteStage({ state }: StageProps<MemWState>) {
  const { stage, mode, store, cur, fact, similar, op } = state
  const stale = store.filter(m => m.stale).length

  return (
    <div className="card">
      <h3>记忆写入 · 冲突消解 <span className="hint">新事实 → 检索相似旧记忆 → ADD / UPDATE / DELETE / NOOP</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{mode}</span><span className="scdl">写入模式</span></div>
          <div className="scdk"><span className="scdn">{store.length}</span><span className="scdl">记忆库大小</span></div>
          <div className="scdk"><span className={`scdn ${stale ? 'hot' : ''}`}>{stale ? `${stale} 陈旧` : op ? OP_CN[op]?.split(' ')[0] : '—'}</span><span className="scdl">{stale ? '矛盾积累' : '本步操作'}</span></div>
        </div>

        {cur >= 0 && op && (
          <div className={`mw-fact op-${op}`}>
            <div className="mw-f-line"><span className="mw-f-lbl">新事实</span><span className="mw-f-txt">「{fact}」</span></div>
            <div className="mw-f-line"><span className="mw-f-lbl">检索相似</span><span className="mw-f-sim">{similar ? `命中 ${similar}` : '无相似记忆'}</span></div>
            <div className="mw-f-line"><span className="mw-f-lbl">决定</span><span className={`mw-op ${op}`}>{OP_CN[op]}</span></div>
          </div>
        )}

        <div className="mw-store">
          <div className="mw-h">记忆库</div>
          {store.map((m: Mem) => (
            <div key={m.id} className={`mw-m ${m.justOp ? 'op-' + m.justOp : ''} ${m.stale ? 'stale' : ''}`}>
              <span className="mw-mid">{m.id}</span>
              <span className="mw-mt">{m.text}</span>
              {m.justOp && <span className={`mw-badge ${m.justOp}`}>{OP_CN[m.justOp]}</span>}
              {m.stale && <span className="mw-badge stale">陈旧·矛盾</span>}
            </div>
          ))}
        </div>

        {stage === 'done'
          ? <p className="scnote"><b>写记忆不是无脑追加，要检索相似 + 消解冲突</b>。<b>四步</b>(mem0 论文)：ADD 新建 / UPDATE 修正 / DELETE 删矛盾 / NOOP 去重——库始终自洽({mode === '四步' ? `本例干净 ${store.length} 条` : '切到四步看'})。<b>单遍 ADD-only</b>(现 OSS 默认)：只加不改、简单快，但{mode === '单遍' ? `矛盾越积越多(现 ${stale} 条陈旧：美式咖啡 vs 戒咖啡、3.10 vs 3.12 并存)` : '会积累矛盾/陈旧'}。延伸：靠向量相似度找"该改哪条"、Zep/Graphiti 用双时间图给旧事实打"失效时间"而非真删。切「模式」对比。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。</p>}
      </div>
    </div>
  )
}
