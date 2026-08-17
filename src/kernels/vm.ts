/**
 * 内核：虚拟地址转换 + TLB（计算机组成原理 / 操作系统）
 * 轴：step —— 每步是一次访存的完整查找链
 *
 * 一次访问要走的路：
 *   拆地址（VPN + 页内偏移）→ 查 TLB → 命中就出物理地址
 *                            → 未命中就查页表 → 有效位为 1 出物理地址、回填 TLB
 *                                             → 有效位为 0 → 缺页
 *
 * entities：{ type:'pte', id:'0', attrs:{ frame, valid } }  —— 页表，id 就是页号
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type VmState = {
  i: number
  /** 本次访问的虚拟地址 */
  vaddr: number
  vpn: number
  offset: number
  /** 结果：TLB 命中 / 页表命中 / 缺页 */
  outcome: 'tlbHit' | 'ptHit' | 'fault'
  /** 物理地址；缺页时为 null */
  paddr: number | null
  frame: number | null
  /** 当前 TLB 内容：[vpn, frame]，按最近使用排序（末尾最新） */
  tlb: [number, number][]
  /** 本步被 TLB 换出的项 */
  evicted: number | null
  tlbHits: number
  ptHits: number
  faults: number
  log: string
}

export const VM_VISIBLE = [
  'i', 'vaddr', 'vpn', 'offset', 'outcome', 'paddr', 'frame',
  'tlb', 'evicted', 'tlbHits', 'ptHits', 'faults', 'log',
] as const

export const vmKernel: Kernel<VmState> = {
  kind: 'vm',

  compile(doc: SimDocument): CompiledModel<VmState> {
    const virtualBits = num(doc.params, 'virtualBits')
    const pageSizeBytes = num(doc.params, 'pageSizeBytes')
    const tlbEntries = num(doc.params, 'tlbEntries')

    const offsetBits = Math.log2(pageSizeBytes)
    const seq = (doc.streams.find(s => s.name === 'virtualAddresses')?.values ?? []) as number[]

    /** 页表：页号 → { frame, valid } */
    const pt = new Map<number, { frame: number; valid: boolean }>()
    for (const e of doc.entities.filter(x => x.type === 'pte')) {
      pt.set(Number(e.id), {
        frame: Number(e.attrs.frame ?? 0),
        valid: Number(e.attrs.valid ?? 1) === 1,
      })
    }

    const initial = (): VmState => ({
      i: -1, vaddr: 0, vpn: 0, offset: 0, outcome: 'fault', paddr: null, frame: null,
      tlb: [], evicted: null, tlbHits: 0, ptHits: 0, faults: 0, log: '',
    })

    return {
      axis: { kind: 'step', label: '访问序号' },
      initial,
      describe: s => s.log,

      step(prev) {
        const base = prev ?? initial()
        const i = base.i + 1
        if (i >= seq.length) return null

        const vaddr = seq[i]
        const vpn = Math.floor(vaddr / pageSizeBytes)
        const offset = vaddr % pageSizeBytes

        //  状态必须自足：TLB 深拷贝，不能改 base 的数组
        const tlb: [number, number][] = base.tlb.map(x => [x[0], x[1]])
        let outcome: VmState['outcome']
        let frame: number | null = null
        let evicted: number | null = null
        let log: string

        const hexV = '0x' + vaddr.toString(16).toUpperCase()
        const at = tlb.findIndex(x => x[0] === vpn)

        if (at >= 0) {
          frame = tlb[at][1]
          //  LRU：命中的挪到末尾
          const [hit] = tlb.splice(at, 1)
          tlb.push(hit)
          outcome = 'tlbHit'
          log = `访问 ${hexV} → 页号 ${vpn}、页内偏移 ${offset}；TLB 命中，页框 ${frame}`
        } else {
          const e = pt.get(vpn)
          if (e && e.valid) {
            frame = e.frame
            outcome = 'ptHit'
            //  回填 TLB
            if (tlb.length >= tlbEntries) {
              const old = tlb.shift()!
              evicted = old[0]
            }
            tlb.push([vpn, frame])
            log = `访问 ${hexV} → 页号 ${vpn}、页内偏移 ${offset}；TLB 未命中 → 查页表，`
              + `有效位为 1，页框 ${frame}，回填 TLB`
              + (evicted !== null ? `（按 LRU 换出页号 ${evicted}）` : '')
          } else {
            outcome = 'fault'
            log = `访问 ${hexV} → 页号 ${vpn}；TLB 未命中，页表项`
              + (e ? '有效位为 0' : '不存在')
              + ` → 缺页中断，需从外存调入`
          }
        }

        const paddr = frame === null ? null : frame * pageSizeBytes + offset

        return {
          state: {
            i, vaddr, vpn, offset, outcome, paddr, frame, tlb, evicted,
            tlbHits: base.tlbHits + (outcome === 'tlbHit' ? 1 : 0),
            ptHits: base.ptHits + (outcome === 'ptHit' ? 1 : 0),
            faults: base.faults + (outcome === 'fault' ? 1 : 0),
            log,
          },
          done: i === seq.length - 1,
        }
      },
    }
  },
}

/** 地址位域拆分，供视图用 */
export const vmFields = (virtualBits: number, pageSizeBytes: number) => {
  const offsetBits = Math.log2(pageSizeBytes)
  return { vpnBits: virtualBits - offsetBits, offsetBits }
}
