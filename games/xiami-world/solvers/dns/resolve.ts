/**
 * DNS 解析引擎（S3：记录类型 A / CNAME / NS + CNAME 折返）
 *
 * 真的沿链逐跳走，产出一条**可回放的时间线**——不是返回一个结论。
 *   浏览器缓存 → 系统缓存 → hosts → 递归服务器 →（递归代你问）根 → TLD → 权威
 *
 * S3 新增：拿到的是 CNAME（别名）时，**跟着真身再查一遍**——时间线里能看到"折返"。
 * 例：查 www.example.com → 权威说它是 example.com 的别名 → 换成 example.com 重查 → 拿到 A。
 * 死循环（a→b→a）被检出，不死机。
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

/** 权威侧对 A 记录的“现在真值”查询：override（权威改过的新值）优先，否则查静态权威树。 */
function authLookupA(net: NetState, name: string): DnsRecord | null {
  const nv = net.authorityOverride[name]
  if (nv !== undefined) return { name, type: 'A', value: nv, ttl: 3600 }
  return authLookup(name, 'A')
}

/** 递归代客户端问权威侧：根 → TLD → 权威。返回权威给的记录（A 或 CNAME）。 */
function recurseAuthority(net: NetState, tl: TimelineStep[], name: string): DnsRecord | null {
  const tld = name.split('.').pop()!
  step(tl, 'root', name, 'referral', 8,
    `根服务器：${name} 归 .${tld} 管，去问 TLD。`,
    authLookup(tld, 'NS') ?? undefined)

  const secondLevel = name.split('.').slice(-2).join('.')
  step(tl, 'tld', name, 'referral', 12,
    `.${tld} 权威：${secondLevel} 的权威服务器我知道，去问它。`,
    authLookup(secondLevel, 'NS') ?? undefined)

  const rec = authLookupA(net, name) ?? authLookup(name, 'CNAME')
  if (rec) {
    step(tl, 'authoritative', name,
      rec.type === 'CNAME' ? 'cname' : 'answer', 15,
      rec.type === 'CNAME'
        ? `权威：${name} 是别名（CNAME）→ ${rec.value}，得换个名字再查一遍。`
        : `权威：${name} → ${rec.value}（TTL ${rec.ttl}s）。`,
      rec)
    return rec
  }
  step(tl, 'authoritative', name, 'miss', 15, `权威：查无 ${name}。`)
  return null
}

/**
 * 查一个名字，走【缓存→hosts→递归→权威】一整趟，把过程记进 tl。
 * 返回这一趟拿到的记录（A / CNAME / null）。CNAME 折返由上层 resolve 负责。
 */
function resolveOnce(net: NetState, name: string, tl: TimelineStep[]): DnsRecord | null {
  const now = net.now

  // ① hosts（真实 DNS：nsswitch files→dns，hosts 优先于任何缓存；
  //     所以 hosts 劫持清缓存没用、只能改 hosts——这个顺序是对抗验证逼出来的修正）
  const h = net.hosts[name]
  if (h !== undefined) {
    const rec: DnsRecord = { name, type: 'A', value: h, ttl: 0 }
    step(tl, 'hosts', name, 'hit', 1, `hosts 里写死了 ${name} → ${h}。`, rec)
    return rec
  }
  step(tl, 'hosts', name, 'miss', 1, 'hosts：没有记录。')

  // ② 浏览器缓存
  const bc = cacheGet(net.browserCache, name, 'A', now) ?? cacheGet(net.browserCache, name, 'CNAME', now)
  if (bc) {
    step(tl, 'browser-cache', name, 'hit', 1, `浏览器缓存命中：${name} → ${bc.value}。`, bc)
    return bc
  }
  step(tl, 'browser-cache', name, 'miss', 1, '浏览器缓存：没有（或已过期）。')

  // ③ 系统缓存
  const oc = cacheGet(net.osCache, name, 'A', now) ?? cacheGet(net.osCache, name, 'CNAME', now)
  if (oc) {
    step(tl, 'os-cache', name, 'hit', 1, `系统缓存命中：${name} → ${oc.value}。`, oc)
    cachePut(net.browserCache, oc, now)
    return oc
  }
  step(tl, 'os-cache', name, 'miss', 1, '系统缓存：没有（或已过期）。')

  // ④ 递归服务器
  const server = Object.values(SERVERS).find(s => s.ip === net.dnsServer)
  if (!server || !net.serverReachable) {
    step(tl, 'recursive', name, 'unreachable', net.timeoutMs,
      `递归 DNS ${net.dnsServer} 连不上——名字翻不成 IP。认 IP 的（游戏）没事，认名字的（网页）全废。`)
    return null
  }
  if (net.serverLatencyMs > net.timeoutMs) {
    step(tl, 'recursive', name, 'timeout', net.timeoutMs,
      `递归 DNS ${net.dnsServer} 答得太慢（${net.serverLatencyMs}ms > 超时 ${net.timeoutMs}ms），浏览器等不住放弃了。`)
    return null
  }
  const rc = cacheGet(net.recursiveCache, name, 'A', now) ?? cacheGet(net.recursiveCache, name, 'CNAME', now)
  if (rc) {
    step(tl, 'recursive', name, 'hit', net.serverLatencyMs,
      `${server.name} 缓存里有 ${name} → ${rc.value}，直接给你。`, rc)
    writeAllCaches(net, rc, now, false)
    return rc
  }
  step(tl, 'recursive', name, 'referral', net.serverLatencyMs,
    `问 ${server.name}（${server.ip}）：${name} 在哪？它缓存里没有，替你往上问……`)

  // ⑤ 递归代问权威
  const rec = recurseAuthority(net, tl, name)
  if (rec) writeAllCaches(net, rec, now, true)
  return rec
}

export function resolve(net: NetState, name: string): QueryResult {
  const tl: TimelineStep[] = []
  const seen = new Set<string>()   // CNAME 环检测
  let current = name

  //  跟着 CNAME 折返，直到拿到 A 记录 / 失败 / 检出环
  for (let hops = 0; hops < 16; hops++) {
    if (seen.has(current)) {
      step(tl, 'authoritative', current, 'miss', 1, `别名绕回了 ${current}——CNAME 死循环，停。`)
      return fail(name, tl, 'cname-loop')
    }
    seen.add(current)

    const rec = resolveOnce(net, current, tl)
    if (!rec) {
      // 区分递归不可达 / 超时 / 查无此名
      const last = tl[tl.length - 1]!
      const f = last.outcome === 'unreachable' ? 'unreachable'
        : last.outcome === 'timeout' ? 'timeout' : 'nxdomain'
      return fail(name, tl, f)
    }
    if (rec.type === 'A') {
      return finish(name, tl, rec.value, currentTrueIp(net, name))
    }
    if (rec.type === 'CNAME') {
      // 折返：换成真身再查一遍
      current = rec.value
      continue
    }
    // NS 不该作为最终答案返回给客户端
    return fail(name, tl, 'nxdomain')
  }
  return fail(name, tl, 'cname-loop')
}

/** 把记录写进三级缓存（各自按 TTL 过期） */
function writeAllCaches(net: NetState, rec: DnsRecord, now: number, fromRecursive: boolean): void {
  if (fromRecursive) cachePut(net.recursiveCache, rec, now)
  cachePut(net.osCache, rec, now)
  cachePut(net.browserCache, rec, now)
}

function total(tl: TimelineStep[]): number { return tl.reduce((s, x) => s + x.ms, 0) }

/** 现在的真值：权威改过就用新值，否则用权威树原值 */
export function currentTrueIp(net: NetState, name: string): string | null {
  return net.authorityOverride[name] ?? trueIp(name)
}
function finish(name: string, tl: TimelineStep[], ip: string | null, tIp: string | null): QueryResult {
  return {
    name, timeline: tl, ip,
    correct: ip !== null && ip === tIp,
    totalMs: total(tl), failure: ip === null ? 'nxdomain' : null,
  }
}
function fail(name: string, tl: TimelineStep[], failure: QueryResult['failure']): QueryResult {
  return { name, timeline: tl, ip: null, correct: false, totalMs: total(tl), failure }
}
