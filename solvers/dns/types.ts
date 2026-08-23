/**
 * DNS 仿真 · 数据模型
 *
 * 设计核心（见 docs/plans/2026-08-23-dns-sim.md）：
 * 一次查询的产物**不是一个结论，是一条可回放的时间线**——
 * 每一跳发生了什么、去了哪、花了多久、命中没有、返回什么。
 * 这条时间线既是"知识被真正建模"的证据，也是可视化（信使逐跳跑）的数据源。
 */

/** DNS 记录类型。第一阶段做 A / CNAME / NS，够表现"CNAME 要跟着再查一遍" */
export type RecordType = 'A' | 'CNAME' | 'NS'

/** 一条 DNS 记录 */
export type DnsRecord = {
  name: string
  type: RecordType
  /** A→IP 字符串；CNAME→目标域名；NS→权威服务器名 */
  value: string
  /** 存活秒数。写进缓存时用它算过期时刻 */
  ttl: number
}

/**
 * 解析链上的一"站"。客户端一路往下问，直到拿到 A 记录。
 * root / tld / authoritative 一起构成"权威侧"，递归服务器替客户端跑完这一路。
 */
export type Hop =
  | 'browser-cache'   // 浏览器自己的缓存
  | 'os-cache'        // 操作系统缓存
  | 'hosts'           // hosts 文件（写死的映射）
  | 'recursive'       // 递归 DNS 服务器（路由器/公共），替你问下面这一串
  | 'root'            // 根服务器：告诉你 .com 的 TLD 在哪
  | 'tld'             // .com 权威：告诉你 example.com 的权威在哪
  | 'authoritative'   // example.com 权威：给你最终的 A 记录

/** 一跳的结果 */
export type StepOutcome =
  | 'hit'        // 命中，直接拿到答案（缓存/hosts）
  | 'referral'   // 转介：这一站不知道答案，但告诉你下一站去哪（root→tld→auth）
  | 'answer'     // 权威给出最终答案
  | 'miss'       // 没有记录，往下走
  | 'timeout'    // 等太久，放弃
  | 'unreachable'// 这一站根本连不上
  | 'cname'      // 拿到的是 CNAME，得换个名字重查

/** 时间线里的一步——可视化就照这个逐帧画 */
export type TimelineStep = {
  hop: Hop
  /** 这一步在查哪个名字（CNAME 折返后会变） */
  query: string
  outcome: StepOutcome
  /** 这一步耗时（毫秒），累加得到总耗时 */
  ms: number
  /** 拿到的记录（hit/answer/referral/cname 时有） */
  record?: DnsRecord
  /** 给人看的一句话（求解器产出，可视化和讲解层都用它，不另编） */
  note: string
}

/** 一次查询的完整结果 */
export type QueryResult = {
  /** 查的原始名字 */
  name: string
  /** 逐跳时间线——这是核心产物 */
  timeline: TimelineStep[]
  /** 最终解析到的 IP；null=失败 */
  ip: string | null
  /** 解析出的 IP 对不对（脏缓存时"成功"但错） */
  correct: boolean
  /** 总耗时 */
  totalMs: number
  /** 失败原因（成功时 null） */
  failure: 'timeout' | 'unreachable' | 'nxdomain' | 'cname-loop' | null
}

/** 一条缓存条目：记录 + 它什么时候过期 */
export type CacheEntry = { record: DnsRecord; expiresAt: number }

/** 一级缓存：域名+类型 → 条目。三级缓存各一份 */
export type Cache = Map<string, CacheEntry>
