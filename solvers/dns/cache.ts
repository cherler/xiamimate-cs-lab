/**
 * DNS 缓存 · 三级独立缓存 + TTL
 *
 * 真实 DNS 有多级缓存：浏览器、操作系统、递归服务器各存一份，各有各的 TTL。
 * 这就是为什么——
 *   · 第一次查慢（走全程），第二次快（命中缓存）
 *   · 清了浏览器缓存但系统缓存还在，仍然快
 *   · 三级全清或全过期，才真的重走全程（清缓存反而变慢，反直觉的密）
 *   · TTL 没到期时，权威那边改了地址你也看不到（"改了不生效"这类故障的根）
 *
 * 时钟用逻辑时钟（state.now，毫秒），不用真实时间——可复现、可测、可快进。
 */
import type { Cache, CacheEntry, DnsRecord } from './types.ts'

/** 缓存键：域名 + 记录类型（同名可有 A/CNAME/NS 多条） */
export function cacheKey(name: string, type: DnsRecord['type']): string {
  return `${name}|${type}`
}

/** 查一级缓存。过期的当作没有（并顺手清掉——真实解析器就是惰性过期） */
export function cacheGet(cache: Cache, name: string, type: DnsRecord['type'], now: number): DnsRecord | null {
  const k = cacheKey(name, type)
  const e = cache.get(k)
  if (!e) return null
  if (now >= e.expiresAt) { cache.delete(k); return null } // 过期即失效
  return e.record
}

/** 写一级缓存。过期时刻 = 现在 + TTL秒×1000 */
export function cachePut(cache: Cache, record: DnsRecord, now: number): void {
  const entry: CacheEntry = { record, expiresAt: now + record.ttl * 1000 }
  cache.set(cacheKey(record.name, record.type), entry)
}

/** 缓存里还没过期的条目 + 各自剩余 TTL 秒——给可视化用（记事本上的倒计时） */
export function cacheView(cache: Cache, now: number): { record: DnsRecord; ttlLeft: number }[] {
  const out: { record: DnsRecord; ttlLeft: number }[] = []
  for (const e of cache.values()) {
    const left = Math.max(0, Math.ceil((e.expiresAt - now) / 1000))
    if (left > 0) out.push({ record: e.record, ttlLeft: left })
  }
  return out
}

/** 清空一级缓存 */
export function cacheClear(cache: Cache): void { cache.clear() }
