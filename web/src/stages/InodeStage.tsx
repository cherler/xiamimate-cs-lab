/** 舞台：文件索引寻址 —— 分级示意 + 寻址链 */
import type { InodeState } from '@engine/kernels/inode.ts'
import { maxFileSize } from '@engine/kernels/inode.ts'
import type { StageProps } from '../types.ts'

const NAME: Record<string, string> = {
  direct: '直接地址', single: '一级间接', double: '二级间接', triple: '三级间接', oob: '越界',
}
const TONE: Record<string, string> = {
  direct: 'l0', single: 'l1', double: 'l2', triple: 'l3', oob: 'oob',
}

export function InodeStage({ doc, state, tab }: StageProps<InodeState>) {
  const bs = doc.params.blockSizeBytes as number
  const ps = doc.params.pointerSizeBytes as number
  const dc = doc.params.directCount as number
  if (tab === 'levels') return <Levels state={state} bs={bs} ps={ps} dc={dc} />
  return <Chain state={state} bs={bs} ps={ps} />
}

/** 寻址链：这一块要经过哪几层索引 */
function Chain({ state, bs, ps }: { state: InodeState; bs: number; ps: number }) {
  const K = Math.floor(bs / ps)
  return (
    <div className="card">
      <h3>寻址链 <span className="hint">一个索引块能放 {bs} ÷ {ps} = {K} 个指针</span></h3>
      <div className="body">
        <div className={`inbadge ${TONE[state.level]}`}>
          逻辑块 {state.lbn} → {NAME[state.level]}
          {state.level !== 'oob' && <b>{state.reads} 次磁盘访问</b>}
        </div>
        <div className="inchain">
          {state.path.map((p, k) => (
            <div key={k} className="instep">
              <span className="n">{k + 1}</span>
              <span className="t">{p}</span>
              {k < state.path.length - 1 && <span className="ar">→</span>}
            </div>
          ))}
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 分级示意：每一级覆盖哪个区间、能存多大的文件 */
function Levels({ state, bs, ps, dc }: {
  state: InodeState; bs: number; ps: number; dc: number
}) {
  const K = Math.floor(bs / ps)
  const max = maxFileSize(bs, ps, dc)
  const mb = (n: number) => (n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(2)} GB`
    : n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`)

  return (
    <div className="card">
      <h3>混合索引结构 <span className="hint">块大小 {bs}B · 指针 {ps}B · 直接地址 {dc} 个</span></h3>
      <div className="body scroll">
        <table className="ptab">
          <thead>
            <tr><th>级别</th><th>逻辑块区间</th><th>能覆盖块数</th><th>可寻址容量</th><th>访问磁盘次数</th></tr>
          </thead>
          <tbody>
            {state.ranges.map((r, k) => (
              <tr key={r.name} className={state.level === ['direct','single','double','triple'][k] ? 'past' : ''}>
                <th>{r.name}</th>
                <td>{r.from} – {r.to}</td>
                <td>{r.count}{k > 0 ? `（= ${['', 'K', 'K²', 'K³'][k]}，K=${K}）` : ''}</td>
                <td>{mb(r.count * bs)}</td>
                <td className="work">{k + 1}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th colSpan={3}>文件最大长度</th>
              <td className="work" colSpan={2}>{mb(max)}</td></tr>
          </tfoot>
        </table>
        <p className="tnote">
          考题永远问两件事：<b>这一块落在哪一级</b>（比区间）和 <b>要访问几次磁盘</b>（级数 + 1）。
          注意区间是<b>累加</b>的 —— 一级间接从第 {dc} 块开始，不是从第 0 块。
        </p>
      </div>
    </div>
  )
}
