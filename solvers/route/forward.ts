/**
 * 逐跳转发引擎 · N1 路由的真核心
 *
 * 一个包被一跳跳送到目标：每台路由器**独立地**拿目标 IP 在自己的路由表里做
 * **最长前缀匹配**，只回答"从我这儿往哪个下一跳出去"，TTL 减一，把包甩给下一跳，
 * 由下一跳再查一遍。全局可达 = 无数个本地决策拼出来，没有任何节点存着完整的路。
 *
 * 产出**逐跳轨迹**（每跳：在谁那儿、命中哪条路由表项、往哪个下一跳、目标 MAC 是谁）。
 * 可注入：删掉某条路由（比如默认网关）→ 引擎真算出"外网不可达"，不是切张图。
 *
 * 这层的理论内核（从运算里长出来，不是旁白）：
 *   地址不是位置，是问路的钥匙——每一跳只认得下一步，收件人(IP)全程不变、
 *   门牌(下一跳MAC)每跳被撕掉重贴。
 */
import { ipToInt, inPrefix, sameSubnet, parsePrefix, type Prefix } from './ip.ts'

/** 一条路由表项：目标前缀 → 下一跳（或"直连"） */
export type Route = {
  prefix: Prefix
  /** 下一跳路由器 id；null = 直连（目标就在本段，用 ARP 直接投递） */
  via: string | null
  /** 从哪个接口出去（画拓扑用） */
  iface?: string
}

/** 一台设备（主机或路由器）：有若干接口 IP、一张路由表、直连哪些设备 */
export type Node = {
  id: string
  name: string
  /** 这台设备各接口的 IP（简化：一台一个主 IP 表示身份） */
  ip: string
  /** 它所在的直连网段（同段的设备能 ARP 直达） */
  subnet: string        // 如 "192.168.1.0/24"
  routes: Route[]
  /** 直连邻居 id（同一段/点对点链路） */
  neighbors: string[]
}

export type Topology = { nodes: Record<string, Node> }

export type HopOutcome = 'forward' | 'deliver' | 'no-route' | 'ttl-expired' | 'arp-fail'

/** 逐跳轨迹里的一步 */
export type Hop = {
  at: string            // 当前在哪台设备
  dstIp: string         // 收件人（全程不变）—— 用来演"IP 不变"
  matchedRoute: string | null   // 命中的路由表项（最长前缀匹配的结果）
  nextHop: string | null        // 下一跳设备 id（null=直连投递/失败）
  dstMac: string | null         // 这一跳封包时的目标 MAC（每跳会变）—— 用来演"门牌每跳换"
  ttl: number
  outcome: HopOutcome
  note: string
}

export type Delivery = {
  from: string
  dstIp: string
  hops: Hop[]
  delivered: boolean
  failure: HopOutcome | null
}

/** 一台设备的 MAC（用 id 假装，够演"逐跳换门牌"） */
const macOf = (id: string) => `MAC:${id}`

/**
 * 最长前缀匹配：在路由表里选**掩码最长（最具体）**的命中项。
 * 这是路由查表的灵魂——谁对这个方向懂得更细，听谁的。
 */
export function longestPrefixMatch(node: Node, dst: number): Route | null {
  let best: Route | null = null
  for (const r of node.routes) {
    if (inPrefix(dst, r.prefix)) {
      if (!best || r.prefix.len > best.prefix.len) best = r
    }
  }
  return best
}

/** 发一个包，逐跳转发，返回完整轨迹 */
export function sendPacket(topo: Topology, fromId: string, dstIp: string, ttl0 = 8): Delivery {
  const hops: Hop[] = []
  const dst = ipToInt(dstIp)
  let cur = topo.nodes[fromId]
  let ttl = ttl0
  if (!cur) return { from: fromId, dstIp, hops, delivered: false, failure: 'no-route' }

  const dstSubnetLen = 24 // 简化：网段都用 /24

  while (true) {
    if (ttl <= 0) {
      hops.push({ at: cur.id, dstIp, matchedRoute: null, nextHop: null, dstMac: null, ttl,
        outcome: 'ttl-expired', note: 'TTL 耗尽，包被丢弃（防止无限打转）。' })
      return done(false, 'ttl-expired')
    }

    // ① 目标就在我这台设备？→ 到了
    if (cur.ip === dstIp) {
      hops.push({ at: cur.id, dstIp, matchedRoute: null, nextHop: null, dstMac: macOf(cur.id), ttl,
        outcome: 'deliver', note: `到了：${dstIp} 就是「${cur.name}」自己。` })
      return done(true, null)
    }

    // ② 目标在我的直连网段？→ ARP 直接投递给它（同段能找到就成，找不到=arp-fail）
    if (sameSubnet(ipToInt(cur.ip), dst, dstSubnetLen)) {
      const target = Object.values(topo.nodes).find(n => n.ip === dstIp && cur!.neighbors.includes(n.id))
      if (target) {
        hops.push({ at: cur.id, dstIp, matchedRoute: '直连', nextHop: target.id, dstMac: macOf(target.id), ttl,
          outcome: 'deliver', note: `目标在同一网段：ARP 广播"谁是 ${dstIp}?"→「${target.name}」应答，直接投递。目标 MAC=${macOf(target.id)}。` })
        return done(true, null)
      }
      hops.push({ at: cur.id, dstIp, matchedRoute: '直连', nextHop: null, dstMac: null, ttl,
        outcome: 'arp-fail', note: `同网段里没人应答 ${dstIp} 的 ARP——找不到这台机器。` })
      return done(false, 'arp-fail')
    }

    // ③ 查路由表（最长前缀匹配）选下一跳
    const route = longestPrefixMatch(cur, dst)
    if (!route || route.via === null) {
      // 没有匹配的路由，也不直连 → 不可达（删掉默认网关就会走到这）
      hops.push({ at: cur.id, dstIp, matchedRoute: route?.prefix.text ?? null, nextHop: null, dstMac: null, ttl,
        outcome: 'no-route', note: route
          ? `路由表命中 ${route.prefix.text} 却是直连、可目标又不在本段——送不出去。`
          : `「${cur.name}」的路由表里没有能送到 ${dstIp} 的路——外网不可达（默认网关那条没了？）。` })
      return done(false, 'no-route')
    }
    const next = topo.nodes[route.via]
    if (!next) {
      hops.push({ at: cur.id, dstIp, matchedRoute: route.prefix.text, nextHop: route.via, dstMac: null, ttl,
        outcome: 'no-route', note: `下一跳「${route.via}」不存在。` })
      return done(false, 'no-route')
    }
    // 关键：收件人(dstIp)不变，但封包的目标 MAC 换成"下一跳"的 MAC
    hops.push({ at: cur.id, dstIp, matchedRoute: route.prefix.text, nextHop: next.id, dstMac: macOf(next.id), ttl,
      outcome: 'forward',
      note: `最长前缀匹配命中 ${route.prefix.text} → 下一跳「${next.name}」。收件人还是 ${dstIp}，但门牌(目标MAC)换成 ${macOf(next.id)}。TTL ${ttl}→${ttl - 1}。` })
    cur = next
    ttl--
  }

  function done(delivered: boolean, failure: HopOutcome | null): Delivery {
    return { from: fromId, dstIp, hops, delivered, failure }
  }
}

/** 造一条路由（语法糖） */
export function route(cidr: string, via: string | null, iface?: string): Route {
  return { prefix: parsePrefix(cidr), via, iface }
}
