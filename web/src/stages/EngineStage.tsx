/** 舞台：推理引擎 —— 块池 + 运行批次(进度) + 等待队列 + 已完成，连续批处理一眼看清 */
import type { EngineState, Req } from '@engine/kernels/engine.ts'
import type { StageProps } from '../types.ts'

const COLORS: Record<string, string> = {
  R1: '#4A6FD4', R2: '#D46A6A', R3: '#4FA46A', R4: '#B07AD4',
}
const col = (id: string) => COLORS[id] ?? 'var(--f-tag)'

export function EngineStage({ state }: StageProps<EngineState>) {
  const { step, pool, free, running, waiting, done, gen, admitted, finished, phase } = state
  const isDone = phase === 'done'
  const used = pool - free

  // 把块池格子按在跑请求的占用摊开：每个请求占 r.blocks 格，剩下的是空闲
  const cells: { id: string | null }[] = []
  for (const r of running) for (let k = 0; k < r.blocks; k++) cells.push({ id: r.id })
  while (cells.length < pool) cells.push({ id: null })

  return (
    <div className="card">
      <h3>推理引擎 <span className="hint">调度器 + 块池 + prefill/decode = 连续批处理</span></h3>
      <div className="body">
        {/* 块池 */}
        <div className="engrow">
          <span className="englab">KV 块池（{used}/{pool} 用 · {free} 空）</span>
          <div className="engpool">
            {cells.slice(0, pool).map((c, k) => (
              <div key={k} className="engblk" title={c.id ? `${c.id} 的 KV 块` : '空闲块'}
                style={c.id ? { background: `color-mix(in srgb, ${col(c.id)} 70%, var(--panel))`, borderColor: col(c.id), color: '#fff' } : {}}>
                {c.id ?? '·'}
              </div>
            ))}
          </div>
        </div>

        {/* 三区：等待 → 运行批次 → 完成 */}
        <div className="engcols">
          {/* 等待队列 */}
          <div className="engcol">
            <div className="engch">等待队列（FCFS）</div>
            <div className="engchips">
              {waiting.length === 0 ? <span className="engempty">（空）</span>
                : waiting.map(id => <span key={id} className="engchip" style={{ borderColor: col(id), color: col(id) }}>{id}</span>)}
            </div>
          </div>

          {/* 运行批次 */}
          <div className="engcol wide">
            <div className="engch">运行批次（continuous batching）</div>
            <div className="engbatch">
              {running.length === 0 ? <span className="engempty">（空）</span> : running.map((r: Req) => {
                const total = r.prompt + r.maxNew
                const isNew = admitted.includes(r.id)
                return (
                  <div key={r.id} className={`engreq ${isNew ? 'admit' : ''}`} style={{ borderLeftColor: col(r.id) }}>
                    <div className="engreqh">
                      <b style={{ color: col(r.id) }}>{r.id}</b>
                      <span className={`engphase ${r.phase}`}>{r.phase === 'prefill' ? 'prefill' : 'decode'}</span>
                      <span className="engblkn">{r.blocks} 块</span>
                    </div>
                    <div className="engbar">
                      <span className="engbarfill" style={{ width: `${r.tokens / total * 100}%`, background: col(r.id) }} />
                      {/* prompt/gen 分界 */}
                      <span className="engbarmark" style={{ left: `${r.prompt / total * 100}%` }} />
                    </div>
                    <div className="engreqn">{r.tokens}/{total} token（prompt {r.prompt} + 已生成 {Math.max(0, r.tokens - r.prompt)}/{r.maxNew}）</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 已完成 */}
          <div className="engcol">
            <div className="engch">已完成</div>
            <div className="engchips">
              {done.length === 0 ? <span className="engempty">（空）</span>
                : done.map(id => <span key={id} className={`engchip done ${finished.includes(id) ? 'just' : ''}`} style={{ borderColor: col(id) }}>{id} ✓</span>)}
            </div>
          </div>
        </div>

        {/* 计数 */}
        <div className="engstats">
          <div className="engst"><span className="engsn">{step < 0 ? 0 : step}</span><span className="engsl">引擎步</span></div>
          <div className="engst"><span className="engsn hot">{gen}</span><span className="engsl">生成 token</span></div>
          <div className="engst"><span className="engsn">{done.length}/4</span><span className="engsl">完成请求</span></div>
          <div className="engst"><span className="engsn">{running.length}</span><span className="engsl">批内在跑</span></div>
        </div>

        {isDone && <p className="engnote">连续批处理：算完的请求立刻把块和位子让给等待的——所以批次每步都在变（{['R1','R2','R3','R4'].join('→')} 陆续进出），比"等整批跑完再换批"的静态批利用率高。这就是 vLLM/TGI 的核心调度。</p>}
      </div>
    </div>
  )
}
