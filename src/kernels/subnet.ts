/**
 * 内核：子网划分与最长前缀匹配（计算机网络 · 网络层）
 * 轴：step
 *
 * 两种模式：
 *   subnet  拆一个 IP/前缀：掩码 → 网络地址 → 广播地址 → 可用主机数 → 划分子网
 *   lpm     最长前缀匹配：拿目的地址逐条比路由表，前缀最长的那条胜出
 *
 * 关键在于：这一切都是**按位与**。所以位域视觉在这里不是装饰，就是算法本身。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type SubnetState = {
  i: number
  /** 32 位地址串 */
  bits: string
  /** 掩码位串 */
  mask: string
  /** 本步高亮的位 */
  touched: number[]
  /** 网络号位数 */
  prefix: number
  phase: 'addr' | 'mask' | 'network' | 'broadcast' | 'hosts' | 'split' | 'match' | 'pick'
  /** lpm 模式：本步比较的路由表项 id 与是否匹配 */
  entry: string
  hit: boolean
  /** lpm 模式：目前最长的匹配 */
  best: string
  detail: Record<string, string>
  log: string
}

export const SUBNET_VISIBLE = [
  'i', 'bits', 'mask', 'touched', 'prefix', 'phase', 'entry', 'hit', 'best', 'detail', 'log',
] as const

type Frame = Omit<SubnetState, 'i'>

const toBits = (v: number) => (v >>> 0).toString(2).padStart(32, '0')
const toDotted = (v: number) =>
  [24, 16, 8, 0].map(sh => ((v >>> sh) & 255)).join('.')
const maskOf = (p: number) => (p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0)
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k)

export const subnetKernel: Kernel<SubnetState> = {
  kind: 'subnet',

  compile(doc: SimDocument): CompiledModel<SubnetState> {
    const operation = str(doc.params, 'operation')      // 'subnet' | 'lpm'
    const prefix = num(doc.params, 'prefix')
    const splitBits = num(doc.params, 'splitBits')      // 再借几位划子网
    const addrs = (doc.streams.find(s => s.name === 'addresses')?.values ?? []) as number[]

    const frames: Frame[] = []
    const put = (f: Partial<Frame> & { phase: Frame['phase']; log: string }) => frames.push({
      bits: frames.at(-1)?.bits ?? '0'.repeat(32),
      mask: frames.at(-1)?.mask ?? '0'.repeat(32),
      touched: [], prefix, entry: '', hit: false,
      best: frames.at(-1)?.best ?? '', detail: {}, ...f,
    })

    if (operation === 'subnet') {
      const ip = addrs[0] ?? 0
      const m = maskOf(prefix)
      const net = (ip & m) >>> 0
      const bcast = (net | (~m >>> 0)) >>> 0
      const hostBits = 32 - prefix

      put({
        phase: 'addr', bits: toBits(ip), mask: toBits(m),
        detail: { 地址: toDotted(ip), 前缀: `/${prefix}` },
        log: `地址 ${toDotted(ip)}/${prefix} 写成二进制：${toBits(ip).match(/.{8}/g)!.join(' ')}`,
      })
      put({
        phase: 'mask', bits: toBits(ip), mask: toBits(m),
        touched: range(0, prefix),
        detail: { 子网掩码: toDotted(m), 网络号: `${prefix} 位`, 主机号: `${hostBits} 位` },
        log: `子网掩码 /${prefix} = ${toDotted(m)}：前 ${prefix} 位是网络号，后 ${hostBits} 位是主机号`,
      })
      put({
        phase: 'network', bits: toBits(net), mask: toBits(m),
        touched: range(prefix, 32),
        detail: { 网络地址: toDotted(net), 算法: 'IP AND 掩码 —— 主机号全部置 0' },
        log: `网络地址 = IP 按位与掩码 → 主机号那 ${hostBits} 位全部清零 → ${toDotted(net)}`,
      })
      put({
        phase: 'broadcast', bits: toBits(bcast), mask: toBits(m),
        touched: range(prefix, 32),
        detail: { 广播地址: toDotted(bcast), 算法: '主机号全部置 1' },
        log: `广播地址 = 主机号那 ${hostBits} 位全部置 1 → ${toDotted(bcast)}`,
      })
      const total = Math.pow(2, hostBits)
      put({
        phase: 'hosts', bits: toBits(net), mask: toBits(m),
        detail: {
          地址总数: String(total),
          可用主机数: hostBits <= 1 ? '0（/31 与 /32 没有可分配的主机地址）' : String(total - 2),
          为什么减二: '网络地址与广播地址不能分配给主机',
        },
        log: `主机号 ${hostBits} 位 → 共 2^${hostBits} = ${total} 个地址，`
          + `可用主机数 = ${total} − 2 = ${Math.max(0, total - 2)}`,
      })

      if (splitBits > 0) {
        const np = prefix + splitBits
        const subs = Math.pow(2, splitBits)
        const size = Math.pow(2, 32 - np)
        const list = Array.from({ length: Math.min(subs, 8) }, (_, k) =>
          `${toDotted((net + k * size) >>> 0)}/${np}`)
        put({
          phase: 'split', bits: toBits(net), mask: toBits(maskOf(np)),
          touched: range(prefix, np),
          detail: {
            借位: `${splitBits} 位`,
            新前缀: `/${np}`,
            子网个数: String(subs),
            每个子网可用主机: String(Math.max(0, size - 2)),
            前几个子网: list.join('  ') + (subs > 8 ? ' …' : ''),
          },
          log: `从主机号再借 ${splitBits} 位做子网号 → 前缀变成 /${np}，`
            + `划出 ${subs} 个子网，每个可用主机 ${Math.max(0, size - 2)} 个`,
        })
      }
    } else {
      // ── 最长前缀匹配 ────────────────────────────────
      const routes = doc.entities.filter(e => e.type === 'route').map(e => ({
        id: e.id,
        net: Number(e.attrs.network ?? 0),
        len: Number(e.attrs.prefix ?? 0),
        via: String(e.attrs.nextHop ?? '—'),
      }))
      const dst = addrs[0] ?? 0
      put({
        phase: 'addr', bits: toBits(dst), mask: '0'.repeat(32),
        detail: { 目的地址: toDotted(dst) },
        log: `目的地址 ${toDotted(dst)}，逐条比对路由表（共 ${routes.length} 条）`,
      })

      let best = { id: '', len: -1, via: '' }
      for (const r of routes) {
        const m = maskOf(r.len)
        const hit = ((dst & m) >>> 0) === ((r.net & m) >>> 0)
        if (hit && r.len > best.len) best = { id: r.id, len: r.len, via: r.via }
        put({
          phase: 'match', bits: toBits(dst), mask: toBits(m),
          touched: range(0, r.len), entry: r.id, hit, best: best.id,
          detail: {
            路由项: `${toDotted(r.net)}/${r.len} → ${r.via}`,
            比较: `目的地址前 ${r.len} 位 ${hit ? '=' : '≠'} 该项网络号`,
            当前最优: best.id ? `${best.id}（/${best.len}）` : '还没有匹配项',
          },
          log: `比 ${r.id}（${toDotted(r.net)}/${r.len}）：前 ${r.len} 位`
            + `${hit ? '相同 → 匹配' : '不同 → 不匹配'}`
            + (hit && best.id === r.id ? '，成为当前最长前缀' : ''),
        })
      }
      put({
        phase: 'pick', bits: toBits(dst), mask: toBits(maskOf(Math.max(0, best.len))),
        touched: range(0, Math.max(0, best.len)), best: best.id,
        detail: best.id
          ? { 选中: best.id, 前缀长度: `/${best.len}`, 下一跳: best.via,
              为什么: '匹配的可能有好几条，取前缀最长的那条 —— 它对目的地址的描述最精确' }
          : { 结果: '无匹配项，按默认路由或丢弃处理' },
        log: best.id
          ? `最长前缀匹配结果：走 ${best.id}（/${best.len}），下一跳 ${best.via}`
          : `没有任何路由项匹配`,
      })
    }

    if (frames.length === 0) put({ phase: 'addr', log: '没有地址' })

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({
        i: -1, bits: '0'.repeat(32), mask: '0'.repeat(32), touched: [],
        prefix, phase: 'addr', entry: '', hit: false, best: '', detail: {}, log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}

export const ipToNum = (a: number, b: number, c: number, d: number) =>
  ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
export const numToDotted = toDotted
