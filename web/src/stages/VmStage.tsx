/** 舞台：虚拟地址转换 + TLB —— 地址位域 + 查找链 + TLB/页表 */
import type { VmState } from '@engine/kernels/vm.ts'
import type { StageProps } from '../types.ts'
import { BitField, type BitSeg } from '../shell/BitField.tsx'

export function VmStage({ doc, state, tab }: StageProps<VmState>) {
  const virtualBits = doc.params.virtualBits as number
  const pageSize = doc.params.pageSizeBytes as number
  const offsetBits = Math.log2(pageSize)
  const vpnBits = virtualBits - offsetBits
  if (tab === 'tables') return <Tables doc={doc} state={state} />
  return <Chain state={state} vpnBits={vpnBits} offsetBits={offsetBits} virtualBits={virtualBits} pageSize={pageSize} />
}

/** 一次访问的完整查找链：拆地址 → 查 TLB → 查页表 → 拼物理地址 */
function Chain({ state, vpnBits, offsetBits, virtualBits, pageSize }: {
  state: VmState; vpnBits: number; offsetBits: number; virtualBits: number; pageSize: number
}) {
  const vbits = state.vaddr.toString(2).padStart(virtualBits, '0')
  const segs: BitSeg[] = [
    { label: '虚页号 VPN', from: 0, len: vpnBits, tone: 'tag' },
    { label: '页内偏移', from: vpnBits, len: offsetBits, tone: 'off' },
  ]
  const pbits = state.paddr === null ? null
    : state.paddr.toString(2).padStart(virtualBits, '0')
  const psegs: BitSeg[] = [
    { label: '物理页框号', from: 0, len: vpnBits, tone: 'idx' },
    { label: '页内偏移（原样照抄）', from: vpnBits, len: offsetBits, tone: 'off' },
  ]

  const steps = [
    { on: true, ok: true, t: `拆地址：高 ${vpnBits} 位是虚页号 ${state.vpn}，低 ${offsetBits} 位是页内偏移 ${state.offset}` },
    { on: true, ok: state.outcome === 'tlbHit',
      t: state.outcome === 'tlbHit' ? `查 TLB：命中，直接拿到页框 ${state.frame}` : '查 TLB：未命中' },
    { on: state.outcome !== 'tlbHit', ok: state.outcome === 'ptHit',
      t: state.outcome === 'ptHit' ? `查页表：有效位为 1，页框 ${state.frame}，回填 TLB`
        : '查页表：有效位为 0 → 缺页中断' },
    { on: state.paddr !== null, ok: true,
      t: `拼物理地址：页框 ${state.frame} × ${pageSize} + 偏移 ${state.offset} = ${state.paddr}` },
  ]

  return (
    <div className="card">
      <h3>地址转换 <span className="hint">页内偏移原样照抄 —— 变的只有页号那一段</span></h3>
      <div className="body">
        <div className="vmlabel">虚拟地址 0x{state.vaddr.toString(16).toUpperCase()}</div>
        <BitField bits={vbits} segments={segs} />
        <ol className="vmchain">
          {steps.filter(s => s.on).map((s, k) => (
            <li key={k} className={s.ok ? 'ok' : 'no'}>{s.t}</li>
          ))}
        </ol>
        <div className="vmlabel">
          物理地址 {state.paddr === null
            ? <em className="miss">缺页，尚无物理地址</em>
            : <>0x{state.paddr.toString(16).toUpperCase()}</>}
        </div>
        {pbits ? <BitField bits={pbits} segments={psegs} /> : null}
      </div>
    </div>
  )
}

/** TLB 与页表的当前内容 */
function Tables({ doc, state }: { doc: StageProps<VmState>['doc']; state: VmState }) {
  const cap = doc.params.tlbEntries as number
  const ptes = doc.entities.filter(e => e.type === 'pte')
  return (
    <div className="card">
      <h3>TLB 与页表 <span className="hint">TLB 按最近使用排序，末尾最新</span></h3>
      <div className="body">
        <div className="entcap">TLB（{state.tlb.length} / {cap} 项）</div>
        <div className="vmtlb">
          {Array.from({ length: cap }, (_, k) => {
            const e = state.tlb[k]
            const isHit = e && e[0] === state.vpn && state.outcome === 'tlbHit'
            const isNew = e && e[0] === state.vpn && state.outcome === 'ptHit'
            return (
              <div key={k} className={`vmslot ${!e ? 'empty' : ''} ${isHit ? 'hit' : ''} ${isNew ? 'fresh' : ''}`}>
                <span className="k">槽 {k}</span>
                {e ? <b>页 {e[0]} → 框 {e[1]}</b> : <em>空</em>}
              </div>
            )
          })}
        </div>
        {state.evicted !== null && (
          <p className="vmevict">本步按 LRU 换出了页 {state.evicted}（最久没用过的那个）</p>
        )}

        <div className="entcap" style={{ marginTop: 14 }}>页表</div>
        <div className="entscroll">
          <table className="ptab">
            <thead><tr><th>页号</th><th>页框号</th><th>有效位</th><th /></tr></thead>
            <tbody>
              {ptes.map(e => {
                const cur = Number(e.id) === state.vpn
                const valid = Number(e.attrs.valid) === 1
                return (
                  <tr key={e.id} className={cur ? 'past' : ''}>
                    <th>{e.id}</th>
                    <td>{String(e.attrs.frame)}</td>
                    <td className={valid ? 'yes' : 'no'}>{valid ? 1 : 0}</td>
                    <td className="dim">{cur ? '← 本步查的就是它' : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
