/** 舞台：散列表 —— 槽位表 + 探查序列 + ASL */
import { asl } from '@engine/kernels/hashtable.ts'
import type { HashState } from '@engine/kernels/hashtable.ts'
import type { StageProps } from '../types.ts'

export function HashStage({ doc, trace, index, state, tab }: StageProps<HashState>) {
  const size = doc.params.size as number
  const method = String(doc.params.method)
  const step2 = doc.params.rehashStep as number
  if (tab === 'asl') return <Asl state={state} size={size} method={method} step2={step2} trace={trace} />
  return <Table state={state} size={size} method={method} />
}

/** 槽位表：拉链法画成链，开放定址画成单格 */
function Table({ state, size, method }: { state: HashState; size: number; method: string }) {
  const probes = new Set(state.probes)
  const chain = method === '拉链'
  return (
    <div className="card">
      <h3>散列表 <span className="hint">{method} · H(key) = key mod {size}</span></h3>
      <div className="body scroll">
        <div className="hslots">
          {state.table.map((slot, k) => (
            <div key={k} className={[
              'hslot',
              k === state.home ? 'home' : '',
              k === state.slot ? 'landed' : '',
              probes.has(k) && k !== state.slot ? 'probed' : '',
              slot.length === 0 ? 'empty' : '',
            ].filter(Boolean).join(' ')}>
              <span className="idx">{k}</span>
              <div className="vals">
                {slot.length === 0 ? <em>空</em>
                  : slot.map((v, j) => (
                    <span key={j} className={v === state.key ? 'cur' : ''}>{v}</span>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="hlegend">
          <span><i className="hw home" />H(key) 初始位置</span>
          <span><i className="hw probed" />探查经过</span>
          <span><i className="hw landed" />最终落点</span>
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">本次插入</span><span className="v">{state.key}</span></div>
          <div className="pr"><span className="k">初始地址</span>
            <span className="v">{state.key} mod {size} = {state.home}</span></div>
          <div className="pr"><span className="k">探查序列</span>
            <span className="v">{state.probes.join(' → ')}</span></div>
          <div className="pr"><span className="k">比较次数</span>
            <span className="v">{state.compares}</span></div>
          <div className="pr"><span className="k">是否冲突</span>
            <span className="v" style={{ color: state.collided ? 'var(--miss)' : 'var(--hit)' }}>
              {state.collided ? '有冲突' : '无冲突'}</span></div>
        </div>
        {chain && (
          <p className="tnote">
            拉链法把冲突的键挂成链表：<b>表长可以小于键数</b>，也不会出现"堆积"。
            代价是多了指针开销，且查找要走链。
          </p>
        )}
      </div>
    </div>
  )
}

/** ASL：考卷上最常问的那个量 */
function Asl({ state, size, method, step2, trace }: {
  state: HashState; size: number; method: string; step2: number; trace: HashState[]
}) {
  const a = asl(state.table, size, method, step2)
  const n = state.table.reduce((s, x) => s + x.length, 0)
  const rows = trace.filter(s => s.i <= state.i)
  return (
    <div className="card">
      <h3>平均查找长度 <span className="hint">装填因子 α = {n} / {size} = {(n / size).toFixed(3)}</span></h3>
      <div className="body scroll">
        <div className="aslbig">
          <div className="aslcard">
            <span className="k">ASL 成功</span>
            <b>{a.success.toFixed(3)}</b>
            <em>各元素查找长度之和 ÷ 元素个数</em>
          </div>
          <div className="aslcard">
            <span className="k">ASL 失败</span>
            <b>{a.fail.toFixed(3)}</b>
            <em>从每个初始地址探到空槽为止 ÷ 表长</em>
          </div>
        </div>
        <table className="ptab">
          <thead><tr><th>序</th><th>键</th><th>H(key)</th><th>探查序列</th><th>比较次数</th><th>落点</th></tr></thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.i} className={s.i === state.i ? 'past' : ''}>
                <td>{s.i + 1}</td>
                <td>{s.key}</td>
                <td>{s.home}</td>
                <td className="seq"><span>{s.probes.join(' → ')}</span></td>
                <td className={s.compares > 1 ? 'no' : ''}>{s.compares}</td>
                <td>{s.slot >= 0 ? s.slot : '装不下'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tnote">
          ASL 只跟<b>装填因子</b>有关，跟表有多大无关 —— 这是散列表能做到 O(1) 的原因。
          α 越接近 1，开放定址的堆积越严重，ASL 涨得越快。
        </p>
      </div>
    </div>
  )
}
