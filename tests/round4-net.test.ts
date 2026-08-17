/**
 * 第四批内核：网络四件套 —— CRC / 海明码 / 子网划分 / TCP 连接管理
 *
 * 这批的判据大多能写成**代数性质**，比对着教材抄数字强得多：
 *   CRC   码字必须整除生成多项式；单比特错必须被检出
 *   海明码 校验子必须恰好等于出错位号（这是海明码的定义，不是巧合）
 *   子网   网络地址 ≤ 任意主机地址 ≤ 广播地址；掩码按位与是幂等的
 *   握手   状态迁移必须合法，且丢包时不能停在半开状态
 */
import { run } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { crcKernel, type CrcState } from '../src/kernels/crc.ts'
import { hammingKernel, hammingR, type HammingState } from '../src/kernels/hamming.ts'
import { subnetKernel, ipToNum, type SubnetState } from '../src/kernels/subnet.ts'
import { handshakeKernel, type HsState } from '../src/kernels/handshake.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

// ═══ CRC ═══════════════════════════════════════════════
console.log('\n【CRC 循环冗余校验】')

const crcDoc = (data: string, generator: string, operation = 'encode', errorAt = -1): SimDocument => ({
  kind: 'crc',
  params: { generator, operation, errorAt },
  entities: [],
  streams: [{ name: 'dataBits', values: data.split('').map(Number) }],
})
const crcRun = (data: string, gen: string, op = 'encode', err = -1) =>
  run(crcKernel.compile(crcDoc(data, gen, op, err))) as CrcState[]

/** 独立参照：不逐步、直接算模 2 余数 */
function refCrc(data: string, gen: string): string {
  const r = gen.length - 1
  const a = (data + '0'.repeat(r)).split('').map(Number)
  const g = gen.split('').map(Number)
  for (let i = 0; i + r < a.length; i++) {
    if (a[i] !== 1) continue
    for (let k = 0; k < g.length; k++) a[i + k] ^= g[k]
  }
  return a.slice(a.length - r).join('')
}

// ── 1. FCS 必须与独立实现一致 ──────────────────────────
{
  const CASES: [string, string][] = [
    ['1101011011', '10011'], ['101110', '1001'], ['11010', '110'],
    ['1', '11'], ['100000000', '110101'], ['1010101010101010', '10001000000100001'],
  ]
  const wrong: string[] = []
  for (const [d, g] of CASES) {
    const mine = crcRun(d, g).at(-1)!.remainder
    const ref = refCrc(d, g)
    if (mine !== ref) wrong.push(`${d}/${g}: ${mine} ≠ ${ref}`)
  }
  wrong.length === 0
    ? ok(`${CASES.length} 组 FCS 与独立实现一致（含 CRC-16 那种 17 位生成多项式）`)
    : bad(`FCS 不一致：${wrong.join(' / ')}`)
}

// ── 2. 码字必须能被生成多项式整除（CRC 的定义） ─────────
{
  const CASES: [string, string][] = [['1101011011', '10011'], ['101110', '1001'], ['11010', '110']]
  const wrong: string[] = []
  for (const [d, g] of CASES) {
    const code = crcRun(d, g).at(-1)!.dividend
    //  整除 = 再除一次余数为 0。用独立实现算，且这次不再补零
    const a = code.split('').map(Number)
    const gg = g.split('').map(Number)
    for (let i = 0; i + gg.length - 1 < a.length; i++) {
      if (a[i] !== 1) continue
      for (let k = 0; k < gg.length; k++) a[i + k] ^= gg[k]
    }
    if (a.some(x => x !== 0)) wrong.push(`${code} 不能被 ${g} 整除`)
  }
  wrong.length === 0
    ? ok('生成的码字都能被生成多项式整除 —— 这就是 CRC 成立的全部依据')
    : bad(wrong.join(' / '))
}

// ── 3. 任意单比特错都必须被检出 ────────────────────────
{
  const d = '1101011011', g = '10011'
  const codeLen = d.length + g.length - 1
  const missed: number[] = []
  for (let pos = 0; pos < codeLen; pos++) {
    const t = crcRun(d, g, 'check', pos)
    const rem = t.at(-1)!.remainder
    if (/^0*$/.test(rem)) missed.push(pos + 1)
  }
  missed.length === 0
    ? ok(`码字共 ${codeLen} 位，逐位翻转 ${codeLen} 次，每一次都被检出（余数非 0）`)
    : bad(`这些位翻转后没被检出：第 ${missed.join('、')} 位`)
}

// ── 4. 不注入错误时余数必须为 0 ────────────────────────
{
  //  下一行以 / 开头，上一行必须留分号，否则会被当成除法（ASI 的经典坑）
  const rem = crcRun('1101011011', '10011', 'check', -1).at(-1)!.remainder;
  /^0*$/.test(rem)
    ? ok(`传输无差错时余数为 ${rem}（全 0）→ 判定通过`)
    : bad(`无差错却算出非零余数 ${rem}`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const a = crcRun('1101011011', '10011').at(-1)!.remainder
  const b = crcRun('1101011010', '10011').at(-1)!.remainder
  a !== b ? ok(`自检：数据改一位 FCS 就变（${a} → ${b}）—— 判据不是走过场`)
    : bad('自检失败：数据变了 FCS 没变')
}

// ═══ 海明码 ════════════════════════════════════════════
console.log('\n【海明码】')

const hamDoc = (data: string, operation = 'encode', errorAt = 0): SimDocument => ({
  kind: 'hamming',
  params: { operation, errorAt, evenParity: 1 },
  entities: [],
  streams: [{ name: 'dataBits', values: data.split('').map(Number) }],
})
const hamRun = (data: string, op = 'encode', err = 0) =>
  run(hammingKernel.compile(hamDoc(data, op, err))) as HammingState[]

// ── 1. 校验位个数必须满足 2^r ≥ k+r+1 ─────────────────
{
  const wrong: string[] = []
  for (const k of [1, 4, 5, 8, 11, 16, 26]) {
    const r = hammingR(k)
    if (Math.pow(2, r) < k + r + 1) wrong.push(`k=${k} r=${r} 不够`)
    if (r > 0 && Math.pow(2, r - 1) >= k + (r - 1) + 1) wrong.push(`k=${k} r=${r} 不是最小`)
  }
  wrong.length === 0
    ? ok('校验位个数对 7 种数据长度都是满足 2^r ≥ k+r+1 的最小值')
    : bad(wrong.join(' / '))
}

// ── 2. 编出的码字，每一组校验都必须成立 ────────────────
{
  const wrong: string[] = []
  for (const data of ['1011', '1010101', '11010110', '1']) {
    const code = hamRun(data).at(-1)!.bits
    const n = code.length
    let r = 0
    while (Math.pow(2, r) < n + 1 && Math.pow(2, r) <= n) r++
    for (let p = 1; p <= n; p <<= 1) {
      let ones = 0
      for (let pos = 1; pos <= n; pos++) if ((pos & p) !== 0 && code[pos - 1] === '1') ones++
      if (ones % 2 !== 0) wrong.push(`${data}: P${p} 组有 ${ones} 个 1（偶校验应为偶数）`)
    }
  }
  wrong.length === 0
    ? ok('四组数据编出的码字，每个校验位所辖分组里 1 的个数都是偶数')
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 3. 校验子必须恰好等于出错位号 —— 海明码的定义 ───────
{
  const data = '1011'
  const n = data.length + hammingR(data.length)
  const wrong: string[] = []
  for (let pos = 1; pos <= n; pos++) {
    const last = hamRun(data, 'check', pos).at(-1)!
    if (last.syndrome !== pos) wrong.push(`第 ${pos} 位出错，校验子却是 ${last.syndrome}`)
  }
  wrong.length === 0
    ? ok(`码字 ${n} 位，逐位注入错误 ${n} 次，校验子每次都**恰好等于出错位号**`)
    : bad(`校验子对不上位号：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 4. 纠错后必须还原成原码字 ──────────────────────────
{
  const data = '1010101'
  const clean = hamRun(data).at(-1)!.bits
  const n = clean.length
  const wrong: number[] = []
  for (let pos = 1; pos <= n; pos++) {
    const fixed = hamRun(data, 'check', pos).at(-1)!.bits
    if (fixed !== clean) wrong.push(pos)
  }
  wrong.length === 0
    ? ok(`任意单比特错都能纠正回原码字 ${clean}`)
    : bad(`这些位纠错后没还原：${wrong.join('、')}`)
}

// ── 5. 无错时校验子必须为 0 ────────────────────────────
{
  const s = hamRun('1011', 'check', 0).at(-1)!.syndrome
  s === 0 ? ok('传输无差错时校验子为 0 → 不做任何纠正')
    : bad(`无差错却算出校验子 ${s}`)
}

// ═══ 子网划分 ══════════════════════════════════════════
console.log('\n【子网划分与最长前缀匹配】')

const subDoc = (ip: number, prefix: number, splitBits = 0): SimDocument => ({
  kind: 'subnet',
  params: { operation: 'subnet', prefix, splitBits },
  entities: [],
  streams: [{ name: 'addresses', values: [ip] }],
})
const subRun = (ip: number, prefix: number, split = 0) =>
  run(subnetKernel.compile(subDoc(ip, prefix, split))) as SubnetState[]

const IP = ipToNum(192, 168, 10, 130)

// ── 1. 网络地址 / 广播地址与独立位运算一致 ──────────────
{
  const wrong: string[] = []
  for (const prefix of [8, 16, 24, 25, 26, 30]) {
    const t = subRun(IP, prefix)
    const m = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0
    const net = (IP & m) >>> 0
    const bcast = (net | (~m >>> 0)) >>> 0
    const netStep = t.find(s => s.phase === 'network')!
    const bStep = t.find(s => s.phase === 'broadcast')!
    if (parseInt(netStep.bits, 2) !== net) wrong.push(`/${prefix} 网络地址错`)
    if (parseInt(bStep.bits, 2) !== bcast) wrong.push(`/${prefix} 广播地址错`)
  }
  wrong.length === 0
    ? ok('6 种前缀长度的网络地址与广播地址均与独立位运算一致')
    : bad(wrong.join(' / '))
}

// ── 2. 网络地址 ≤ 原地址 ≤ 广播地址（区间必须包住自己）──
{
  const wrong: string[] = []
  for (const prefix of [8, 16, 24, 26, 30]) {
    const t = subRun(IP, prefix)
    const net = parseInt(t.find(s => s.phase === 'network')!.bits, 2)
    const bc = parseInt(t.find(s => s.phase === 'broadcast')!.bits, 2)
    if (!(net <= IP && IP <= bc)) wrong.push(`/${prefix}: ${net} ≤ ${IP} ≤ ${bc} 不成立`)
  }
  wrong.length === 0
    ? ok('每种前缀下都满足 网络地址 ≤ 该地址 ≤ 广播地址')
    : bad(wrong.join(' / '))
}

// ── 3. 借 b 位划子网 → 子网数 2^b，每个子网可用主机对得上 ──
{
  const wrong: string[] = []
  for (const [prefix, b] of [[24, 2], [24, 3], [16, 4]] as [number, number][]) {
    const t = subRun(IP, prefix, b)
    const sp = t.find(s => s.phase === 'split')!
    const subs = Number(sp.detail['子网个数'])
    const hosts = Number(sp.detail['每个子网可用主机'])
    const expectSubs = Math.pow(2, b)
    const expectHosts = Math.pow(2, 32 - prefix - b) - 2
    if (subs !== expectSubs) wrong.push(`/${prefix}借${b}位: 子网数 ${subs} ≠ ${expectSubs}`)
    if (hosts !== expectHosts) wrong.push(`/${prefix}借${b}位: 主机数 ${hosts} ≠ ${expectHosts}`)
  }
  wrong.length === 0
    ? ok('借位划子网的子网个数与每子网可用主机数都与公式一致')
    : bad(wrong.join(' / '))
}

// ── 4. 最长前缀匹配必须选出前缀最长的那条 ──────────────
{
  const routes = [
    { id: 'R1', network: ipToNum(192, 168, 0, 0), prefix: 16, nextHop: 'A' },
    { id: 'R2', network: ipToNum(192, 168, 10, 0), prefix: 24, nextHop: 'B' },
    { id: 'R3', network: ipToNum(192, 168, 10, 128), prefix: 25, nextHop: 'C' },
    { id: 'R4', network: ipToNum(10, 0, 0, 0), prefix: 8, nextHop: 'D' },
  ]
  const doc: SimDocument = {
    kind: 'subnet',
    params: { operation: 'lpm', prefix: 0, splitBits: 0 },
    entities: routes.map(r => ({
      id: r.id, type: 'route',
      attrs: { network: r.network, prefix: r.prefix, nextHop: r.nextHop },
    })),
    streams: [{ name: 'addresses', values: [IP] }],
  }
  const t = run(subnetKernel.compile(doc)) as SubnetState[]
  const pick = t.at(-1)!
  //  独立算：所有匹配项里 prefix 最大的那条
  const matched = routes.filter(r => {
    const m = r.prefix === 0 ? 0 : (0xFFFFFFFF << (32 - r.prefix)) >>> 0
    return ((IP & m) >>> 0) === ((r.network & m) >>> 0)
  })
  const want = matched.reduce((a, b) => (b.prefix > a.prefix ? b : a))
  pick.best === want.id && pick.detail['下一跳'] === want.nextHop
    ? ok(`192.168.10.130 匹配 ${matched.length} 条，选中前缀最长的 ${want.id}（/${want.prefix} → ${want.nextHop}）`)
    : bad(`选错了：选中 ${pick.best}，应为 ${want.id}`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const a = subRun(IP, 24).find(s => s.phase === 'network')!.bits
  const b = subRun(IP, 25).find(s => s.phase === 'network')!.bits
  a !== b ? ok('自检：/24 与 /25 算出的网络地址不同 —— 判据认得出前缀长度')
    : bad('自检失败：换前缀网络地址没变')
}

// ═══ TCP 连接管理 ══════════════════════════════════════
console.log('\n【TCP 三次握手与四次挥手】')

const hsDoc = (scenario: string, lost: number[] = []): SimDocument => ({
  kind: 'handshake',
  params: { scenario, clientSeq: 100, serverSeq: 300 },
  entities: lost.map((nth, k) => ({ id: `L${k + 1}`, type: 'loss', attrs: { nth } })),
  streams: [],
})
const hsRun = (scenario: string, lost: number[] = []) =>
  run(handshakeKernel.compile(hsDoc(scenario, lost))) as HsState[]

// ── 1. 建连必须恰好三个报文段，且两端都到 ESTABLISHED ───
{
  const t = hsRun('connect')
  const segs = t.at(-1)!.history
  const last = t.at(-1)!
  segs.length === 3 && last.client === 'ESTABLISHED' && last.server === 'ESTABLISHED'
    ? ok(`三次握手：${segs.map(s => s.flags).join(' → ')}，两端均达 ESTABLISHED`)
    : bad(`握手不对：${segs.length} 个报文段，末态 ${last.client}/${last.server}`)
}

// ── 2. 断连必须四个报文段，且末态两端都 CLOSED ──────────
{
  const t = hsRun('close')
  const segs = t.at(-1)!.history
  const last = t.at(-1)!
  segs.length === 4 && last.client === 'CLOSED' && last.server === 'CLOSED'
    ? ok(`四次挥手：${segs.map(s => s.flags).join(' → ')}，两端均达 CLOSED`)
    : bad(`挥手不对：${segs.length} 个报文段，末态 ${last.client}/${last.server}`)
}

// ── 3. 客户端状态迁移必须走合法路径，不能跳站 ───────────
{
  const LEGAL: Record<string, string[]> = {
    CLOSED: ['SYN_SENT'],
    SYN_SENT: ['ESTABLISHED', 'CLOSED'],
    ESTABLISHED: ['FIN_WAIT_1'],
    FIN_WAIT_1: ['FIN_WAIT_2'],
    FIN_WAIT_2: ['TIME_WAIT'],
    TIME_WAIT: ['CLOSED'],
  }
  const t = hsRun('both')
  const seen = t.map(s => s.client).filter((x, k, a) => k === 0 || x !== a[k - 1])
  const wrong: string[] = []
  for (let k = 1; k < seen.length; k++)
    if (!(LEGAL[seen[k - 1]] ?? []).includes(seen[k])) wrong.push(`${seen[k - 1]} → ${seen[k]}`)
  wrong.length === 0
    ? ok(`客户端迁移路径合法：${seen.join(' → ')}`)
    : bad(`非法迁移：${wrong.join('、')}`)
}

// ── 4. 服务器必须经过 CLOSE_WAIT —— 四次挥手的成因 ──────
{
  const t = hsRun('close')
  const seen = t.map(s => s.server)
  seen.includes('CLOSE_WAIT') && seen.includes('LAST_ACK')
    ? ok('服务器经过 CLOSE_WAIT 与 LAST_ACK —— 它的 ACK 与 FIN 不能合并，所以挥手是四次')
    : bad(`服务器状态缺失：${[...new Set(seen)].join('、')}`)
}

// ── 5. 丢包时必须重传，且最终仍能建立连接 ───────────────
{
  const t = hsRun('connect', [1])           // 第一个 SYN 丢了
  const last = t.at(-1)!
  const segs = last.history
  segs.length > 3 && segs.some(s => s.lost) && last.client === 'ESTABLISHED'
    ? ok(`第一个 SYN 丢失：共发了 ${segs.length} 个报文段（含重传），最终仍建立连接`)
    : bad(`丢包处理不对：${segs.length} 个报文段，末态 ${last.client}`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const clean = hsRun('connect').at(-1)!.history.length
  const lossy = hsRun('connect', [1]).at(-1)!.history.length
  lossy > clean
    ? ok(`自检：丢包后报文段数 ${clean} → ${lossy} —— 判据认得出丢包配置`)
    : bad('自检失败：丢包没有任何影响')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
