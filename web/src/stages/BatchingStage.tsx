/** 舞台：连续批处理 —— GPU batch 槽 + 排队 + 完成 + 利用率 */
import type { BatchState } from '@engine/kernels/batching.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function BatchingStage({ state }: StageProps<BatchState>) {
  const { slots, active, done, admitted, waiting, finished, util } = state
  //  本步槽位：正在跑的 + 本步完成的（还占着这一步）
  const inBatch = [...active, ...done]
  const cells = Array.from({ length: slots }, (_, k) => inBatch[k] ?? null)

  return (
    <div className="card">
      <h3>连续批处理 <span className="hint">空槽随时补进排队的请求，GPU 尽量不空转</span></h3>
      <div className="body">
        <div className="bqsect">GPU batch（{slots} 个槽） <span className="bqcap">利用率 {Math.round(util * 100)}%</span></div>
        <div className="bqslots">
          {cells.map((id, k) => {
            const isDone = id !== null && done.includes(id)
            const isNew = id !== null && admitted.includes(id)
            return (
              <div key={k} className={`bqslot ${id ? 'on' : 'empty'} ${isDone ? 'leaving' : ''} ${isNew ? 'joining' : ''}`}>
                {id ? <><span className="bqid">{id}</span>{isDone && <span className="bqtag">✓ 离场</span>}{isNew && <span className="bqtag jn">补入</span>}</> : '空'}
              </div>
            )
          })}
        </div>

        <div className="bqqueue">
          <div className="bqrow"><span className="bqk">排队中</span>
            <div className="bqchips">{waiting.length ? waiting.map(id => <span key={id} className="bqchip wait">{id}</span>) : <span className="bqnone">无</span>}</div>
          </div>
          <div className="bqrow"><span className="bqk">已完成</span>
            <div className="bqchips">{finished.length ? finished.map(id => <span key={id} className="bqchip fin">{id}</span>) : <span className="bqnone">无</span>}</div>
          </div>
        </div>

        <div className="bqmode">{state.mode === 'cont' ? '连续批处理：吐完就离场、空槽立刻补' : '静态批处理：整批一起跑完才收下一批'}</div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
