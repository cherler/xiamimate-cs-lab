/**
 * DNS 故障 · 施加 + 随机生成
 *
 * 每种故障都有**可观察、可区分的时间线特征**，玩家靠观察就能分辨——
 * 这是"知识解密"成立的前提（不是靠提示告诉你哪坏了）。
 *
 * | 故障 | 观察到的现象 | 断点/命中在哪 | 什么能修好 |
 * |------|------------|-------------|-----------|
 * | server-down    | 解析失败      | 递归·unreachable  | 换 DNS 服务器 |
 * | server-slow    | 解析失败      | 递归·timeout      | 调大超时 / 换 DNS |
 * | poisoned-cache | 成功却连不上   | 缓存·hit(错IP,普通TTL) | 清缓存 |
 * | ttl-too-long   | 成功却连不上   | 缓存·hit(错IP,超长TTL) | 清缓存（权威早改了，你还拿旧的） |
 * | hosts-hijack   | 成功却连不上   | hosts·hit(错IP)   | 改 hosts（清缓存没用） |
 *
 * poisoned 和 ttl-too-long 都"缓存命中错IP"，区分在**那条记录剩余 TTL**：
 * ttl-too-long 的 TTL 长得离谱（几天/几周），poisoned 是正常 TTL。
 */
import type { NetState, FaultKind } from './state.ts'
import { cachePut } from './cache.ts'
import { trueIp } from './world.ts'

/** 给某个名字施加一种故障，改动 net（原地）。返回被施加的故障，便于记录。 */
export function applyFault(net: NetState, fault: FaultKind, name: string): FaultKind {
  switch (fault) {
    case 'none':
      break
    case 'server-down':
      net.serverReachable = false
      break
    case 'server-slow':
      net.serverLatencyMs = 5000 // > 默认 timeout 2000 → 超时
      break
    case 'poisoned-cache': {
      // 递归缓存（上游）被塞了错记录，正常 TTL。命中会向下回填三级，
      // 所以修复动作是"清全部缓存"（flush），清一级不够。
      const wrong = { name, type: 'A' as const, value: '10.0.0.66', ttl: 600 }
      cachePut(net.browserCache, wrong, net.now)
      cachePut(net.osCache, wrong, net.now)
      cachePut(net.recursiveCache, wrong, net.now)
      break
    }
    case 'ttl-too-long': {
      // 权威已经把地址改成新值；但三级缓存里还压着"旧的、曾经正确的"记录，TTL 超长（一周）不过期。
      // 于是你一直拿旧值、连不上。清缓存 → 走权威拿到新值 → 修好（这正是故障表宣称的修法）。
      const oldIp = trueIp(name) ?? '93.184.216.34'
      const stale = { name, type: 'A' as const, value: oldIp, ttl: 604800 }
      cachePut(net.browserCache, stale, net.now)
      cachePut(net.osCache, stale, net.now)
      cachePut(net.recursiveCache, stale, net.now)
      net.authorityOverride[name] = '93.184.216.99' // 权威改了新地址（解析引擎现在真的会读它）
      break
    }
    case 'hosts-hijack':
      net.hosts[name] = '10.66.66.66'
      break
  }
  return fault
}

/**
 * 随机挑一种故障（含 none 以外的真故障）。
 * seed 决定选哪个——**参数随机=防刷**：每局故障不同，玩家不能靠记答案通关，只能靠观察。
 * 不用 Math.random（求解器要可复现、可测），seed 由外部传入。
 */
const REAL_FAULTS: FaultKind[] = [
  'server-down', 'server-slow', 'poisoned-cache', 'ttl-too-long', 'hosts-hijack',
]
export function randomFault(seed: number): FaultKind {
  const i = Math.abs(Math.floor(seed)) % REAL_FAULTS.length
  return REAL_FAULTS[i]!
}
export const ALL_REAL_FAULTS = REAL_FAULTS
