/** 舞台：MESI 缓存一致性 —— 内存 x + 两个核的缓存行状态(M/E/S/I)与值，看写触发失效 */
import type { MesiState } from '@engine/kernels/mesi.ts'
import type { StageProps } from '../types.ts'

const STATE_NAME: Record<string, string> = { M: 'Modified 已改', E: 'Exclusive 独占', S: 'Shared 共享', I: 'Invalid 失效' }

export function MesiStage({ state }: StageProps<MesiState>) {
  const { memX, cores, cur, op, bus, invalidated, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>MESI 缓存一致性 <span className="hint">谁写了，别人的副本立刻失效</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'read' ? `C${cur} 读` : op === 'write' ? `C${cur} 写` : '完成'}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{memX}</span><span className="scdl">内存 x</span></div>
          <div className="scdk"><span className={`scdn ${invalidated ? 'miss' : ''}`}>{invalidated}</span><span className="scdl">失效次数</span></div>
        </div>

        {/* 总线消息 */}
        {bus && op !== 'done' && (
          <div className={`mesi-bus ${op === 'write' ? 'inval' : ''}`}>总线：{bus}</div>
        )}

        {/* 两个核的缓存行 */}
        <div className="mesi-cores">
          {cores.map(c => (
            <div key={c.id} className={`mesi-core s-${c.state} ${cur === c.id ? 'cur' : ''}`}>
              <b className="mesi-cid">C{c.id}</b>
              <span className={`mesi-badge s-${c.state}`}>{c.state}</span>
              <span className="mesi-sname">{STATE_NAME[c.state]}</span>
              <span className="mesi-cval">{c.state === 'I' ? '副本失效' : `x = ${c.value}`}</span>
            </div>
          ))}
          <div className="mesi-mem">
            <b className="mesi-cid">内存</b>
            <span className="mesi-cval">x = {memX}</span>
          </div>
        </div>

        {done
          ? <p className="scnote">只要有核写 x，其它核手里的副本立刻被置为 <b>I(失效)</b>——本例共失效 <b>{invalidated}</b> 次。所以「一个核的写，另一个核不会自动立刻看见」，得等它重新加载。这就是缓存一致性协议在硬件层做的事，也是 <b>volatile / 内存屏障</b>要存在的原因。</p>
          : <p className="scnote" style={{ opacity: .85 }}>
              每个核的缓存行有四态：<b>M</b>已改脏、<b>E</b>干净独占、<b>S</b>共享只读、<b>I</b>失效。读未命中要上总线找；写之前要把别人的副本全<b>失效</b>掉再升到 M。
            </p>}
      </div>
    </div>
  )
}
