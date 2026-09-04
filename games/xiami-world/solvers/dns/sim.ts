/**
 * DNS 仿真 · 对外门面（阶段一收口）
 *
 * 玩家能拧的一切都从这里走：发起查询、换 DNS、清缓存、编辑 hosts、调超时、推进时钟。
 * 上层（可视化/玩法）只依赖这个类，不碰内部五个文件。
 *
 * 设计原则：
 * - 一次 query() 返回一条**可回放时间线**（QueryResult），不是一个结论。
 * - 所有"玩家动作"都是显式方法，可被冒烟/单测调用，也可被可视化的按钮绑定。
 * - 求解器是真源：query 的每个数都由引擎算出，不预设。
 */
import type { NetState, FaultKind } from './state.ts'
import { initNet, clearCache } from './state.ts'
import type { QueryResult, DnsRecord } from './types.ts'
import { resolve } from './resolve.ts'
import { applyFault, randomFault } from './fault.ts'
import { cacheView } from './cache.ts'
import { SERVERS, PUBLIC_DNS, ROUTER_DNS, trueIp } from './world.ts'

export type CacheLevel = 'browser' | 'os' | 'recursive' | 'all'

/** 缓存快照：一级缓存里没过期的条目 + 剩余 TTL（给可视化画"记事本 + 倒计时"） */
export type CacheSnapshot = {
  level: Exclude<CacheLevel, 'all'>
  entries: { record: DnsRecord; ttlLeft: number }[]
}

export class DnsSim {
  private net: NetState

  constructor(net?: Partial<NetState>) {
    this.net = initNet(net)
  }

  /** 施加一种故障到某个名字（关卡初始化时用；随机故障用 seedFault） */
  setFault(fault: FaultKind, name: string): FaultKind {
    return applyFault(this.net, fault, name)
  }
  /** 用 seed 随机挑一种真故障施加——参数随机=防刷，每局不同 */
  seedFault(seed: number, name: string): FaultKind {
    return applyFault(this.net, randomFault(seed), name)
  }

  // ── 玩家动作 ──────────────────────────────

  /** 发起一次查询，返回逐跳时间线 */
  query(name: string): QueryResult {
    return resolve(this.net, name)
  }

  /** 换递归 DNS 服务器（'router' | 'public' | 任意 IP） */
  setDns(which: 'router' | 'public' | string): void {
    this.net.dnsServer = which === 'router' ? ROUTER_DNS
      : which === 'public' ? PUBLIC_DNS : which
    // 换到一台标称可达的服务器时，恢复可达（相当于换掉挂掉的那台）
    if (which === 'public' || which === 'router') this.net.serverReachable = true
  }

  /** 清缓存（某一级或全部）——注意"清缓存反而变慢"，也是脏缓存/过时TTL的对症修复 */
  clear(level: CacheLevel): void {
    clearCache(this.net, level)
  }

  /** 编辑 hosts：写一条 / 删一条（删=传 null）。hosts 劫持的对症修复 */
  editHosts(name: string, ip: string | null): void {
    if (ip === null) delete this.net.hosts[name]
    else this.net.hosts[name] = ip
  }

  /** 调查询超时阈值（ms）——server-slow 的对症修复 */
  setTimeout(ms: number): void {
    this.net.timeoutMs = ms
  }

  /** 推进逻辑时钟（秒）——让缓存按 TTL 过期，用来演"等一会儿再查" */
  advance(seconds: number): void {
    this.net.now += seconds * 1000
  }

  // ── 给可视化读的快照（只读，不改状态）──────────

  /** 三级缓存快照——画"记事本 + TTL 倒计时" */
  caches(): CacheSnapshot[] {
    return [
      { level: 'browser', entries: cacheView(this.net.browserCache, this.net.now) },
      { level: 'os', entries: cacheView(this.net.osCache, this.net.now) },
      { level: 'recursive', entries: cacheView(this.net.recursiveCache, this.net.now) },
    ]
  }

  /** 当前配的 DNS 服务器名 + IP */
  dnsInfo(): { name: string; ip: string } {
    const s = Object.values(SERVERS).find(x => x.ip === this.net.dnsServer)
    return { name: s?.name ?? '自定义', ip: this.net.dnsServer }
  }

  /** 当前逻辑时钟（秒） */
  clock(): number { return this.net.now / 1000 }

  /**
   * 【理论内核·间接层】直接拿"名字"去连那台机器——**必然失败**。
   * 因为机器只认门牌号(IP)，压根不知道 example.com 是谁。
   * 这是第一关让玩家亲手撞的墙：名字≠地址。
   */
  connectByName(name: string): { ok: false; reason: string } {
    return { ok: false, reason: `那台机器不认识"${name}"这个名字——它只认门牌号（IP）。` }
  }

  /**
   * 拿"门牌号"(IP)去连——通。前提是这个 IP 是对的。
   * 玩家得先把名字翻译成 IP（查号台/DNS），才拿得到这个号。
   */
  connectByIp(ip: string, name: string): { ok: boolean; reason: string } {
    const truth = this.net.authorityOverride[name] ?? trueIp(name)
    return ip === truth
      ? { ok: true, reason: `拨通了 ${ip}——这就是 ${name} 那台机器的门牌号。` }
      : { ok: false, reason: `${ip} 拨过去没人应——这个门牌号不对。` }
  }

  /** 查号台：把名字翻译成门牌号（就是查一次 DNS，拿最终 IP）。null=查不到 */
  lookupIp(name: string): string | null {
    return this.query(name).ip
  }

  /** 直接问到权威的"现在真值"——越过一切缓存/hosts，拿地址的最终出处(真相源)。只读。 */
  authoritativeIp(name: string): string | null {
    return this.net.authorityOverride[name] ?? trueIp(name)
  }

  /** 一个域名能不能正常打开（解析成功且地址正确） */
  canOpen(name: string): boolean {
    const r = resolve(this.net, name)
    return r.ip !== null && r.correct
  }
}
