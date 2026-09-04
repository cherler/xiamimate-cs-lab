/**
 * DNS 解析链求解器 —— 《网页打不开，但游戏还能玩》的真理源。
 *
 * 这一关的「密」：**网是通的，坏的是"查地址"那一步。**
 * 网页得先把域名翻成 IP 才能连；DNS 挂了，网就半死不活——
 * 认 IP 的（游戏、语音、已连上的长连接）照常跑，认名字的全废。
 *
 * ## 模型（教学级离散链，不是真 DNS 实现）
 *
 *   查名字 → ①本机缓存 → ②hosts → ③配置的 DNS 服务器 → ④上游根/权威
 *   任何一步命中就返回；配的 DNS 不可达/超时，整条链断。
 *
 * ## 边界
 * - 不建模 TTL 过期、递归/迭代查询细节、DoH/DoT
 * - "连通性"只分 IP 直连可达 / 名字可解析两层——够讲清这一关的因果
 */

/** 故障类型：这一关随机挑一个（参数随机=防刷） */
export type DnsFault =
  | 'none'          // 没毛病
  | 'server-down'   // 配的 DNS 服务器不可达（最典型）
  | 'server-slow'   // DNS 超时（能解析，但慢到浏览器放弃）
  | 'poisoned-cache'// 本机缓存里存了错的 IP（解析"成功"却连不上）

export type Net = {
  /** 物理链路通不通（网线/WiFi） */
  linkUp: boolean
  /** 当前配置的 DNS 服务器 */
  dnsServer: string
  /** 本机 DNS 缓存：域名→IP */
  cache: Record<string, string>
  hosts: Record<string, string>
  fault: DnsFault
  /** DNS 响应耗时 ms（超过 timeoutMs 视为失败） */
  latencyMs: number
  timeoutMs: number
}

/** 已知的"正确"地址簿——上游权威的真值 */
const AUTHORITY: Record<string, string> = {
  'example.com': '93.184.216.34',
  'game.example.net': '203.0.113.20',
}
/** 公共 DNS，换上它就能解析（除非链路本身断了） */
export const PUBLIC_DNS = '223.5.5.5'
/** 家里路由器默认的 DNS（这一关坏的就是它） */
export const ROUTER_DNS = '192.168.1.1'

export type Step = { where: string; ok: boolean; note: string }

export type Resolved = {
  /** 最终解析到的 IP，null=解析失败 */
  ip: string | null
  /** 解析出的 IP 是不是对的（poisoned 时"成功"但错） */
  correct: boolean
  ms: number
  steps: Step[]
  notes: string[]
}

/** 直接按 IP 连——不经过 DNS。游戏/语音走的就是这条 */
export function pingIp(net: Net, _ip: string): { ok: boolean; ms: number; note: string } {
  if (!net.linkUp) return { ok: false, ms: 0, note: '网线/WiFi 断了，IP 也 ping 不通。' }
  return { ok: true, ms: 12, note: '按 IP 直连是通的——网本身没断。' }
}

/** 按域名解析（网页要走这条） */
export function resolve(net: Net, name: string): Resolved {
  const steps: Step[] = []
  const notes: string[] = []

  if (!net.linkUp) {
    steps.push({ where: '链路', ok: false, note: '网线/WiFi 断了' })
    notes.push('链路都不通，解析无从谈起。')
    return { ip: null, correct: false, ms: 0, steps, notes }
  }

  // ① 本机缓存
  const cached = net.cache[name]
  if (cached !== undefined) {
    const correct = cached === AUTHORITY[name]
    steps.push({ where: '本机缓存', ok: true, note: `命中 ${cached}` })
    notes.push(correct
      ? `本机缓存里就有 ${name} → ${cached}，没走 DNS。`
      : `本机缓存里存的是 ${cached}，但真身是 ${AUTHORITY[name]} —— 缓存脏了，"解析成功"却连不上。`)
    return { ip: cached, correct, ms: 1, steps, notes }
  }
  steps.push({ where: '本机缓存', ok: false, note: '没有记录' })

  // ② hosts
  const h = net.hosts[name]
  if (h !== undefined) {
    steps.push({ where: 'hosts 文件', ok: true, note: `命中 ${h}` })
    notes.push(`hosts 里写死了 ${name} → ${h}。`)
    return { ip: h, correct: h === AUTHORITY[name], ms: 1, steps, notes }
  }
  steps.push({ where: 'hosts 文件', ok: false, note: '没有记录' })

  // ③ 问配置的 DNS 服务器
  if (net.fault === 'server-down' && net.dnsServer === ROUTER_DNS) {
    steps.push({ where: `DNS ${net.dnsServer}`, ok: false, note: '不可达' })
    notes.push(`问 ${net.dnsServer} 要地址，没人应答——域名翻不成 IP。`)
    notes.push('认 IP 的（游戏、语音）照常跑；认名字的（网页）全废。')
    return { ip: null, correct: false, ms: net.timeoutMs, steps, notes }
  }
  if (net.fault === 'server-slow' && net.dnsServer === ROUTER_DNS && net.latencyMs > net.timeoutMs) {
    steps.push({ where: `DNS ${net.dnsServer}`, ok: false, note: `${net.latencyMs}ms 超时` })
    notes.push(`${net.dnsServer} 答得太慢（${net.latencyMs}ms > ${net.timeoutMs}ms），浏览器等不住就放弃了。`)
    return { ip: null, correct: false, ms: net.timeoutMs, steps, notes }
  }

  // ④ 解析成功
  const ip = AUTHORITY[name]
  if (ip === undefined) {
    steps.push({ where: `DNS ${net.dnsServer}`, ok: false, note: '查无此名' })
    notes.push(`${name} 这个名字，上游也不认识。`)
    return { ip: null, correct: false, ms: net.latencyMs, steps, notes }
  }
  steps.push({ where: `DNS ${net.dnsServer}`, ok: true, note: `返回 ${ip}` })
  notes.push(`${net.dnsServer} 把 ${name} 翻成了 ${ip}，网页能开了。`)
  return { ip, correct: true, ms: net.latencyMs, steps, notes }
}

/** 网页能不能打开：要解析出来、而且解析对 */
export function canOpenSite(net: Net, name: string): boolean {
  const r = resolve(net, name)
  return r.ip !== null && r.correct
}
