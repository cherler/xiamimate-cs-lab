/** 舞台：KV 换出 —— GPU 槽（LRU）+ CPU 换出区，命中/换出/换入计数 */
import type { KvOffloadState } from '@engine/kernels/kvoffload.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function KvOffloadStage({ state }: StageProps<KvOffloadState>) {
  const { slots, seq, step, req, gpu, cpu, result, evicted, reloaded, hits, offloads, reloads, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>KV 换出 offload <span className="hint">GPU 装不下 → 换出到 CPU（LRU）</span></h3>
      <div className="body">
        {/* 访问序列 */}
        <div className="korow">
          <span className="kolab">访问序列</span>
          <div className="koseq">
            {seq.map((b, k) => <span key={k} className={`kosq ${k === step && !done ? 'cur' : k < step || done ? 'past' : ''}`}>{b}</span>)}
          </div>
        </div>

        {/* GPU 槽 */}
        <div className="korow">
          <span className="kolab">GPU 显存（{slots} 槽 · 右=最近用）</span>
          <div className="kotier gpu">
            {Array.from({ length: slots }, (_, k) => {
              const b = gpu[k]
              const isReq = b === req && !done
              return <div key={k} className={`koblk ${b === undefined ? 'empty' : ''} ${isReq && result === 'hit' ? 'hit' : isReq ? 'newin' : ''}`}>{b ?? '·'}</div>
            })}
          </div>
        </div>

        {/* CPU 换出区 */}
        <div className="korow">
          <span className="kolab">CPU 内存（换出区）</span>
          <div className="kotier cpu">
            {cpu.length === 0 ? <span className="koempty">（空）</span> : cpu.map((b, k) => (
              <div key={k} className={`koblk cpu ${b === evicted && !done ? 'justout' : ''}`}>{b}</div>
            ))}
          </div>
        </div>

        {/* 计数 */}
        <div className="kostats">
          <div className="kost"><span className="kosn hit">{hits}</span><span className="kosl">命中</span></div>
          <div className="kost"><span className="kosn out">{offloads}</span><span className="kosl">换出 CPU</span></div>
          <div className="kost"><span className="kosn in">{reloads}</span><span className="kosl">换入 GPU</span></div>
          {!done && <div className="kostag">{result === 'hit' ? '✓ 命中' : reloaded ? '换入' : evicted !== null ? `换出 ${evicted}` : '新块'}</div>}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
