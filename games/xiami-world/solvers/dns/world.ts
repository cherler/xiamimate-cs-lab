/**
 * DNS 世界 · 权威数据 + 网络拓扑
 *
 * "权威侧"是这套仿真的真值来源：根知道每个 TLD 的权威在哪，
 * TLD 知道每个二级域的权威在哪，权威服务器持有最终的 A/CNAME 记录。
 * 递归服务器不"知道"答案，它替客户端把这一串问下来——这正是 DNS 的本质，
 * 也是为什么"递归服务器挂了、但你直接连 IP 没事"。
 */
import type { DnsRecord } from './types.ts'

/** 权威区域：一台权威服务器持有的记录 */
export type Zone = {
  /** 这台权威负责哪个后缀（'.' = 根，'com' = TLD，'example.com' = 二级） */
  suffix: string
  records: DnsRecord[]
}

/** 一台 DNS 服务器（递归或权威），有名字、地址、可达性、延迟 */
export type Server = {
  id: string
  name: string
  ip: string
  reachable: boolean
  /** 应答延迟 ms */
  latencyMs: number
}

/**
 * 内建的权威树（真值）。改这里 = 改"互联网上真实存在什么"。
 * 演示两个站点：一个直连 A，一个走 CNAME（www→别名→真身），
 * 好让时间线能展示"CNAME 得跟着再查一次"。
 */
export const AUTHORITY: Zone[] = [
  {
    suffix: '.', // 根
    records: [
      { name: 'com', type: 'NS', value: 'tld-com', ttl: 172800 },
      { name: 'net', type: 'NS', value: 'tld-net', ttl: 172800 },
    ],
  },
  {
    suffix: 'com', // .com TLD
    records: [
      { name: 'example.com', type: 'NS', value: 'auth-example', ttl: 172800 },
    ],
  },
  {
    suffix: 'net',
    records: [
      { name: 'game.example.net', type: 'NS', value: 'auth-game', ttl: 172800 },
    ],
  },
  {
    suffix: 'example.com', // 权威：最终 A 记录都在这
    records: [
      { name: 'example.com', type: 'A', value: '93.184.216.34', ttl: 3600 },
      // www 是个别名（CNAME），指向真身——查 www 得折返再查一次
      { name: 'www.example.com', type: 'CNAME', value: 'example.com', ttl: 3600 },
      // 一对互指的别名——造 CNAME 死循环，测环检测
      { name: 'loop-a.example.com', type: 'CNAME', value: 'loop-b.example.com', ttl: 3600 },
      { name: 'loop-b.example.com', type: 'CNAME', value: 'loop-a.example.com', ttl: 3600 },
    ],
  },
  {
    suffix: 'example.net',
    records: [
      { name: 'game.example.net', type: 'A', value: '203.0.113.20', ttl: 3600 },
    ],
  },
]

/** 在权威树里查一条记录（按后缀找到对的权威，再匹配名字+类型） */
export function authLookup(name: string, type: 'A' | 'CNAME' | 'NS'): DnsRecord | null {
  for (const zone of AUTHORITY) {
    for (const r of zone.records) {
      if (r.name === name && r.type === type) return r
    }
  }
  return null
}

/** 真值：一个域名最终对应的正确 IP（跟随 CNAME）。用来判"脏缓存解析成功却是错的" */
export function trueIp(name: string, depth = 0): string | null {
  if (depth > 8) return null
  const a = authLookup(name, 'A')
  if (a) return a.value
  const cname = authLookup(name, 'CNAME')
  if (cname) return trueIp(cname.value, depth + 1)
  return null
}

/** 常见递归 DNS 服务器 */
export const SERVERS: Record<string, Server> = {
  router: { id: 'router', name: '家里路由器', ip: '192.168.1.1', reachable: true, latencyMs: 20 },
  public: { id: 'public', name: '公共 DNS', ip: '223.5.5.5', reachable: true, latencyMs: 35 },
}
export const ROUTER_DNS = SERVERS.router!.ip
export const PUBLIC_DNS = SERVERS.public!.ip
