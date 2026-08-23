/**
 * DNS 世界的可变状态——玩家能拧的一切都在这。
 * S1 先立字段；三级缓存/TTL 在 S2 真正接进 resolve，故障在 S4。
 */
import type { Cache } from './types.ts'
import { ROUTER_DNS } from './world.ts'

export type FaultKind =
  | 'none'
  | 'server-down'    // 递归服务器不可达
  | 'server-slow'    // 递归超时
  | 'poisoned-cache' // 缓存里被塞了错记录
  | 'ttl-too-long'   // TTL 过长，改了不生效
  | 'hosts-hijack'   // hosts 被写了错映射

export type NetState = {
  linkUp: boolean
  /** 当前配置的递归 DNS 服务器 IP */
  dnsServer: string
  /** 三级缓存：浏览器 / 系统 / 递归服务器 */
  browserCache: Cache
  osCache: Cache
  recursiveCache: Cache
  hosts: Record<string, string>
  /** 超过这个时间没应答就算超时 */
  timeoutMs: number
  /** 当前故障（可组合留到 S4，先单个） */
  fault: FaultKind
  /** 逻辑时钟（毫秒）——TTL 过期靠它，不用真实时间（可复现、可测） */
  now: number
}

/** 一个干净的初始世界 */
export function initNet(over: Partial<NetState> = {}): NetState {
  return {
    linkUp: true,
    dnsServer: ROUTER_DNS,
    browserCache: new Map(),
    osCache: new Map(),
    recursiveCache: new Map(),
    hosts: {},
    timeoutMs: 2000,
    fault: 'none',
    now: 0,
    ...over,
  }
}
