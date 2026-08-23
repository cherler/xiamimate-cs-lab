/**
 * DNS 解析引擎（S2：三级缓存 + TTL）
 *
 * 真的沿链逐跳走，产出一条**可回放的时间线**——不是返回一个结论。
 * 走法就是真实 DNS：
 *   浏览器缓存 → 系统缓存 → hosts → 递归服务器 →（递归代你问）根 → TLD → 权威
 * 递归服务器不知道答案，它替你把 根→TLD→权威 这一串问下来（referral 链）。
 *
 * S2 把三级缓存真正接进来：
 *   · 任一级缓存命中 → 从那级返回，跳数变少、更快
 *   · 递归解析成功 → 自顶向下把答案写进三级缓存（各带 TTL）
 *   · 缓存按 state.now 惰性过期 → 过期后重查又走全程（清缓存/等过期都变慢，反直觉的密）
 * CNAME 折返在 S3，故障在 S4。
 */
import type { NetState } from './state.ts'
import type { QueryResult, TimelineStep, Hop, DnsRecord } from './types.ts'
import { authLookup, SERVERS, trueIp } from './world.ts'
import { cacheGet, cachePut } from './cache.ts'

function step(
  tl: TimelineStep[], hop: Hop, query: string,
  outcome: TimelineStep['outcome'], ms: number, note: string, record?: DnsRecord,
): void {
  tl.push({ hop, query, outcome, ms, note, record })
}

/** 递归代客户端问权威侧：根 → TLD → 权威。DNS 最本质的一段。 */
function recurseAuthority(tl: TimelineStep[], name: string): DnsRecord | null {
  const tld = name.split('.').pop()!
  step(tl, 'root', name, 'referral', 8,
    `根服务器：${name} 归 .${tld} 管，去问 TLD。`,
    authLookup(tld, 'NS') ?? undefined)

  const secondLevel = name.split('.').slice(-2).join('.')
  step(tl, 'tld', name, 'referral', 12,
    `.${tld} 权威：${secondLevel} 的权威服务器我知道，去问它。`,
    authLookup(secondLevel, 'NS') ?? undefined)

  const rec = authLookup(name, 'A') ?? authLookup(name, 'CNAME')
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

export function resolve(net: NetState, name: string): QueryResult {
  const tl: TimelineStep[] = []
  const now = net.now

  // ① 浏览器缓存
  const bc = cacheGet(net.browserCache, name, 'A', now)
  if (bc) {
    step(tl, 'browser-cache', name, 'hit', 1, `浏览器缓存命中：${name} → ${bc.value}（还没过期）。`, bc)
    return finish(name, tl, bc.value)
  }
  step(tl, 'browser-cache', name, 'miss', 1, '浏览器缓存：没有（或已过期）。')

  // ② 系统缓存
  const oc = cacheGet(net.osCache, name, 'A', now)
  if (oc) {
    step(tl, 'os-cache', name, 'hit', 1, `系统缓存命中：${name} → ${oc.value}。`, oc)
    // 命中系统缓存时，顺手回填浏览器缓存（真实解析器行为）
    cachePut(net.browserCache, oc, now)
    return finish(name, tl, oc.value)
  }
  step(tl, 'os-cache', name, 'miss', 1, '系统缓存：没有（或已过期）。')

  // ③ hosts（写死的映射，无 TTL，永远命中）
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

  // ④a 递归服务器自己的缓存（它也存）
  const rc = cacheGet(net.recursiveCache, name, 'A', now)
  if (rc) {
    step(tl, 'recursive', name, 'hit', server.latencyMs,
      `${server.name} 缓存里有 ${name} → ${rc.value}，直接给你（不用再问权威）。`, rc)
    // 回填系统+浏览器缓存
    writeAllCaches(net, rc, now, /* fromRecursive */ false)
    return finish(name, tl, rc.value)
  }
  step(tl, 'recursive', name, 'referral', server.latencyMs,
    `问 ${server.name}（${server.ip}）：${name} 在哪？它缓存里没有，替你往上问……`)

  // ⑤ 递归代问权威侧
  const rec = recurseAuthority(tl, name)
  if (!rec) return fail(name, tl, 'nxdomain')

  // ⑥ 拿到答案，自顶向下写进三级缓存（各带 TTL）
  const aRec: DnsRecord = rec.type === 'A'
    ? rec
    : { name, type: 'A', value: trueIp(name) ?? '', ttl: rec.ttl } // CNAME 折返留 S3，先按真值写
  const ip = rec.type === 'A' ? rec.value : trueIp(name)
  if (ip) writeAllCaches(net, aRec, now, /* fromRecursive */ true)
  return finish(name, tl, ip)
}

/** 把一条 A 记录写进三级缓存（各自按 TTL 过期） */
function writeAllCaches(net: NetState, rec: DnsRecord, now: number, fromRecursive: boolean): void {
  if (fromRecursive) cachePut(net.recursiveCache, rec, now)
  cachePut(net.osCache, rec, now)
  cachePut(net.browserCache, rec, now)
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
