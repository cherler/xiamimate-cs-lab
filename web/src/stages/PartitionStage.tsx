/** 舞台：动态分区分配 —— 内存条 + 分区表 */
import type { PartState } from '@engine/kernels/partition.ts'
import type { StageProps } from '../types.ts'

export function PartitionStage({ doc, trace, index, state, tab }: StageProps<PartState>) {
  const total = doc.params.memorySize as number
  if (tab === 'table') return <Table state={state} total={total} trace={trace} index={index} />
  return <Bar state={state} total={total} />
}

/** 内存条：一眼看出碎片长什么样 */
function Bar({ state, total }: { state: PartState; total: number }) {
  const scanned = new Set(state.scanned)
  return (
    <div className="card">
      <h3>内存布局 <span className="hint">总容量 {total} KB · 灰色是空闲</span></h3>
      <div className="body">
        <div className="membar">
          {state.blocks.map((b, k) => (
            <div key={k}
              className={[
                'memblk',
                b.owner ? 'used' : 'free',
                b.start === state.at ? 'cur' : '',
                scanned.has(b.start) && b.start !== state.at ? 'scanned' : '',
              ].filter(Boolean).join(' ')}
              style={{ flexGrow: b.size }}
              title={`起址 ${b.start} · ${b.size} KB · ${b.owner || '空闲'}`}>
              <span className="nm">{b.owner || '空闲'}</span>
              <span className="sz">{b.size}</span>
            </div>
          ))}
        </div>
        <div className="memaxis">
          <span>0</span><span>{total} KB</span>
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
          <div className="pr"><span className="k">空闲总量</span>
            <span className="v">{state.freeTotal} KB（{state.blocks.filter(b => !b.owner).length} 块）</span></div>
          <div className="pr"><span className="k">其中外碎片</span>
            <span className="v" style={{ color: state.external > 0 ? 'var(--miss)' : undefined }}>
              {state.external} KB（小到装不下任何作业的零头）</span></div>
        </div>
      </div>
    </div>
  )
}

/** 分区表：教材上要求填的那张 */
function Table({ state, total, trace, index }: {
  state: PartState; total: number; trace: PartState[]; index: number
}) {
  return (
    <div className="card">
      <h3>分区表与请求序列 <span className="hint">已分配 + 空闲 恒等于 {total} KB</span></h3>
      <div className="body scroll">
        <table className="ptab">
          <thead><tr><th>起址</th><th>大小</th><th>状态</th><th /></tr></thead>
          <tbody>
            {state.blocks.map((b, k) => (
              <tr key={k}>
                <th>{b.start}</th>
                <td>{b.size} KB</td>
                <td className={b.owner ? 'yes' : ''}>{b.owner || '空闲'}</td>
                <td className="dim">{b.start === state.at ? '← 本步' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="entcap" style={{ marginTop: 14 }}>请求序列</div>
        <table className="ptab">
          <thead><tr><th>序</th><th>作业</th><th>动作</th><th>结果</th></tr></thead>
          <tbody>
            {trace.map(s => (
              <tr key={s.i} className={s.i > index ? 'future' : s.i === index ? 'past' : ''}>
                <td>{s.i + 1}</td>
                <th>{s.job}</th>
                <td>{s.act === 'free' ? '释放' : `申请 ${s.size} KB`}</td>
                <td className={s.act === 'fail' ? 'no' : s.act === 'alloc' ? 'yes' : ''}>
                  {s.act === 'fail' ? '失败'
                    : s.act === 'free' ? (s.merged > 0 ? `合并了 ${s.merged} 块` : '已释放')
                    : `落在起址 ${s.at}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tnote">
          <b>释放时必须合并相邻空闲区</b> —— 这是最容易漏的一步。不合并的话，
          内存很快会碎成一堆装不下任何作业的零头（外碎片），
          明明空闲总量够，却谁也分配不了。
        </p>
      </div>
    </div>
  )
}
