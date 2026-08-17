/** 舞台：信号量 —— 三个信号量 + 缓冲区 + 两段代码 */
import type { SemState } from '@engine/kernels/semaphore.ts'
import { codeFor } from '@engine/kernels/semaphore.ts'
import type { StageProps } from '../types.ts'

export function SemaphoreStage({ doc, state, tab }: StageProps<SemState>) {
  const size = doc.params.bufferSize as number
  const order = String(doc.params.order)
  if (tab === 'code') return <Code state={state} order={order} />
  return <Live state={state} size={size} />
}

function Live({ state, size }: { state: SemState; size: number }) {
  const dead = state.act === 'deadlock'
  return (
    <div className="card">
      <h3>信号量与缓冲区 <span className="hint">empty 空位数 · full 产品数 · mutex 互斥锁</span></h3>
      <div className="body">
        <div className="sems">
          {([['empty', state.empty, '还有几个空位'],
             ['full', state.full, '已有几个产品'],
             ['mutex', state.mutex, '临界区的锁（0 或 1）']] as [string, number, string][])
            .map(([n, v, why]) => (
              <div key={n} className={`semcard ${v === 0 ? 'zero' : ''} ${state.sem === n ? 'hot' : ''}`}>
                <span className="k">{n}</span>
                <b>{v}</b>
                <em>{why}</em>
              </div>
            ))}
        </div>

        <div className="entcap" style={{ marginTop: 4 }}>缓冲区（{state.buffer.length} / {size}）</div>
        <div className="sbuf">
          {Array.from({ length: size }, (_, k) => (
            <div key={k} className={`sslot ${k < state.buffer.length ? 'full' : ''}`}>
              {k < state.buffer.length ? state.buffer[k] : ''}
            </div>
          ))}
        </div>

        <div className="entcap" style={{ marginTop: 14 }}>线程状态</div>
        <div className="thrs">
          {Object.keys(state.pc).map(t => (
            <div key={t} className={`thr ${state.blocked[t] ? 'blocked' : ''} ${state.who === t ? 'hot' : ''}`}>
              <b>{t}</b>
              <span>{state.blocked[t] ? `阻塞在 ${state.blocked[t]}` : `第 ${(state.pc[t] % 5) + 1} 条语句`}</span>
            </div>
          ))}
        </div>

        {dead && (
          <p className="semdead">全部线程都阻塞了 —— 死锁</p>
        )}
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 两段代码并排，把 P 的顺序摆出来 */
function Code({ state, order }: { state: SemState; order: string }) {
  const wrong = order === 'wrong'
  return (
    <div className="card">
      <h3>生产者 / 消费者代码
        <span className="hint">{wrong ? '当前是**错误顺序**：P(mutex) 在前' : '当前是正确顺序'}</span></h3>
      <div className="body">
        <div className="codes">
          {(['producer', 'consumer'] as const).map(role => (
            <div key={role} className="codecol">
              <div className="entcap">{role === 'producer' ? '生产者' : '消费者'}</div>
              <ol className="codelist">
                {codeFor(role, order).map((line, k) => {
                  const isMine = (role === 'producer' ? state.who.startsWith('P') : state.who.startsWith('C'))
                  const at = isMine && (state.pc[state.who] % 5) === k
                  return (
                    <li key={k} className={`${at ? 'cur' : ''} ${line.startsWith('P(mutex') && wrong ? 'warn' : ''}`}>
                      {line}
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </div>
        <p className="tnote">
          <b>为什么 P(mutex) 不能放在前面</b>：生产者拿着锁去等 empty，
          而唯一能让 empty 变大的消费者，又卡在 P(mutex) 上进不来 ——
          两边互相等，谁也动不了。<br />
          规律是：<b>先申请资源信号量，再申请互斥信号量；释放时顺序无所谓。</b>
          把右侧的「P 的顺序」切到 wrong，再拖时间轴，就能看到死锁真的发生。
        </p>
      </div>
    </div>
  )
}
