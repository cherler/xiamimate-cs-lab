/**
 * DNS 解析引擎（S1 骨架）
 *
 * 真的沿链逐跳走，产出一条**可回放的时间线**——不是返回一个结论。
 * 走法就是真实 DNS：
 *   浏览器缓存 → 系统缓存 → hosts → 递归服务器 →（递归代你问）根 → TLD → 权威
 * 递归服务器不知道答案，它替你把 根→TLD→权威 这一串问下来（referral 链）。
 *
 * S1 只做"缓存都没命中、走全程"的主干；缓存命中/TTL 在 S2 加，CNAME 折返在 S3 加。
 */
import type { NetState } from './state.ts'
import type { QueryResult, TimelineStep, Hop, DnsRecord } from './types.ts'
import { authLookup, SERVERS, trueIp } from './world.ts'

/** 往时间线追加一步的小工具 */
function step(
  tl: TimelineStep[], hop: Hop, query: string,
  outcome: TimelineStep['outcome'], ms: number, note: string, record?: DnsRecord,
): void {
  tl.push({ hop, query, outcome, ms, note, record })
}

/**
 * 递归服务器代客户端问权威侧：根 → TLD → 权威。
 * 这是 DNS 最本质的一段——一层层转介（referral），最后权威给出答案。
 * 返回最终 A/CNAME 记录（或 null=查无此名）。把每一跳都记进时间线。
 */
function recurseAuthority(tl: TimelineStep[], name: string): DnsRecord | null {
  // 根：告诉你该问哪个 TLD
  step(tl, 'root', name, 'referral', 8,
    `根服务器：${name} 归 .${name.split('.').pop()} 管，去问 TLD。`,
    authLookup(name.split('.').pop()!, 'NS') ?? undefined)

  // TLD：告诉你该问哪个权威
  const tld = name.split('.').slice(-1)[0]!
  const secondLevel = name.split('.').slice(-2).join('.')
  step(tl, 'tld', name, 'referral', 12,
    `.${tld} 权威：${secondLevel} 的权威服务器我知道，去问它。`,
    authLookup(secondLevel, 'NS') ?? undefined)

  // 权威：给出最终记录
  const a = authLookup(name, 'A')
  const cname = authLookup(name, 'CNAME')
  const rec = a ?? cname
  if (rec) {
    step(tl, 'authoritative', name,
      rec.type === 'CNAME' ? 'cname' : 'answer', 15,
      rec.type === 'CNAME'
        ? `权威：${name} 是别名，真身是 ${rec.value}。`
        : `权威：${name} → ${rec.value}（TTL ${rec.ttl}s）。`,
      rec)
    return rec
  }
  step(tl, 'authoritative', name, 'miss', 15, `权威：查无 ${name}。`)
  return null
}

/**
 * 解析一个域名，返回完整时间线。S1 主干：缓存/hosts 都没命中 → 走递归全程。
 */
export function resolve(net: NetState, name: string): QueryResult {
  const tl: TimelineStep[] = []

  // ① 浏览器缓存（S2 填真逻辑，S1 先记一步 miss）
  step(tl, 'browser-cache', name, 'miss', 1, '浏览器缓存：没有记录。')
  // ② 系统缓存
  step(tl, 'os-cache', name, 'miss', 1, '系统缓存：没有记录。')
  // ③ hosts
  const h = net.hosts[name]
  if (h !== undefined) {
    const rec: DnsRecord = { name, type: 'A', value: h, ttl: 0 }
    step(tl, 'hosts', name, 'hit', 1, `hosts 里写死了 ${name} → ${h}。`, rec)
    return finish(name, tl, h)
  }
  step(tl, 'hosts', name, 'miss', 1, 'hosts：没有记录。')

  // ④ 递归服务器
  const server = Object.values(SERVERS).find(s => s.ip === net.dnsServer)
  if (!server || !server.reachable) {
    step(tl, 'recursive', name, 'unreachable', net.timeoutMs,
      `递归 DNS ${net.dnsServer} 连不上——名字翻不成 IP。认 IP 的（游戏）没事，认名字的（网页）全废。`)
    return fail(name, tl, 'unreachable')
  }
  step(tl, 'recursive', name, 'referral', server.latencyMs,
    `问 ${server.name}（${server.ip}）：${name} 在哪？它替你往上问……`)

  // ⑤ 递归代问权威侧
  const rec = recurseAuthority(tl, name)
  if (!rec) return fail(name, tl, 'nxdomain')
  if (rec.type === 'CNAME') {
    // S1：CNAME 折返留到 S3；这里先把 CNAME 目标的真 IP 收尾，保证有结果
    const ip = trueIp(name)
    return finish(name, tl, ip)
  }
  return finish(name, tl, rec.value)
}

function total(tl: TimelineStep[]): number { return tl.reduce((s, x) => s + x.ms, 0) }

function finish(name: string, tl: TimelineStep[], ip: string | null): QueryResult {
  return {
    name, timeline: tl, ip,
    correct: ip !== null && ip === trueIp(name),
    totalMs: total(tl), failure: ip === null ? 'nxdomain' : null,
  }
}
function fail(name: string, tl: TimelineStep[], failure: QueryResult['failure']): QueryResult {
  return { name, timeline: tl, ip: null, correct: false, totalMs: total(tl), failure }
}
