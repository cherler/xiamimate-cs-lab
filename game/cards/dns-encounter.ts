/**
 * DNS 副本 · 诊断卡牌遭遇战 —— 接真求解器(production 核心,守铁律"仿真是核心")。
 *
 * 不再手写症状/答案:注入一种**真故障**到 DnsSim → query() 产出**真症状**(读时间线得来)
 * → 玩家出一张卡 = 一个**真 sim 动作** → 重新 query() → **由 sim 判**成没成。
 * 出对了 sim 真的通,出错了 sim 真的还失败。症状与成败都不是我编的。
 *
 * 卡=数据(id/名/note/apply),一个解释器跑所有卡(照 gamedev-skills 的 card-game 架构)。
 */
import { DnsSim } from '../../solvers/dns/sim.ts'
import type { QueryResult, TimelineStep } from '../../solvers/dns/types.ts'
import type { FaultKind } from '../../solvers/dns/state.ts'
import type { Encounter, Card as ECard } from './encounter.ts'

export const SITE = 'www.example.com'

export type Card = { id: string; name: string; note: string; apply: (s: DnsSim) => void }

/** 手牌:对症的真动作 + 看着都相关的干扰(治不了) */
export const CARDS: Card[] = [
  { id: 'switch-dns', name: '换个 DNS 服务器', note: '换掉可能挂了的那台', apply: s => s.setDns('public') },
  { id: 'raise-timeout', name: '多等等(调大超时)', note: '给慢的服务器更多时间', apply: s => s.setTimeout(6000) },
  { id: 'clear-cache', name: '清缓存重查', note: '丢掉本地存的旧/脏地址', apply: s => s.clear('all') },
  { id: 'fix-hosts', name: '删掉 hosts 那条', note: '去掉本机写死的指向', apply: s => s.editHosts(SITE, null) },
  { id: 'reboot', name: '重启路由器', note: '万金油?其实治不了大多数', apply: () => {} },
  { id: 'bandwidth', name: '加大带宽', note: '网速?可名字都还没翻出来', apply: () => {} },
]

/** 从真时间线里读出"人看得懂的症状"——不点名该出哪张卡,只如实描述发生了什么。 */
export function symptomOf(q: QueryResult): string {
  if (q.correct) return '通了。'
  if (q.failure === 'unreachable') return '问递归 DNS 服务器:连不上它——名字根本翻不成地址。'
  if (q.failure === 'timeout') return '问递归 DNS 服务器:它答得太慢,浏览器等不住、超时放弃了。'
  if (q.failure === 'nxdomain') return '一路问到权威:查无此名。'
  // 拿到了地址但不对(hosts 劫持 / 脏缓存 / 过时 TTL)
  const hostsHit = q.timeline.find((s: TimelineStep) => s.hop === 'hosts' && s.outcome === 'hit')
  if (hostsHit) return `hosts 里写死了一条:${SITE} → ${hostsHit.record?.value}——可那不是它真正的地址。`
  const cacheHit = q.timeline.find((s: TimelineStep) => (s.hop === 'browser-cache' || s.hop === 'os-cache' || s.hop === 'recursive') && s.outcome === 'hit')
  if (cacheHit) return `本地缓存直接给了个地址:${q.ip}——可它是错的(旧地址 / 被污染的)。`
  return `拿到地址 ${q.ip},可它连不对。`
}

export type PlayResult = { fixed: boolean; symptom: string; won: boolean; hp: number; card: string }

export class DnsEncounter implements Encounter {
  title = '路由器 · 网页打不开'
  goal = '让 https://www.example.com 打开'
  cards: ECard[] = CARDS.map(c => ({ id: c.id, name: c.name, note: c.note }))
  sim: DnsSim
  fault: FaultKind
  hp = 3
  won = false
  last: QueryResult
  log: string[] = []

  constructor(faultOrSeed: FaultKind | number) {
    this.sim = new DnsSim()
    // 数字=随机挑一种真故障(防刷);FaultKind=指定(设计关卡/测试用)
    this.fault = typeof faultOrSeed === 'number'
      ? this.sim.seedFault(faultOrSeed, SITE)
      : this.sim.setFault(faultOrSeed, SITE)
    this.last = this.sim.query(SITE)              // 真症状
  }
  symptom(): string { return symptomOf(this.last) }

  /** 出一张卡:调真 sim 动作 → 重查 → sim 判。 */
  play(cardId: string): PlayResult {
    const card = CARDS.find(c => c.id === cardId)
    if (!card || this.won || this.hp <= 0) return { fixed: this.won, symptom: this.symptom(), won: this.won, hp: this.hp, card: cardId }
    card.apply(this.sim)
    this.last = this.sim.query(SITE)
    if (this.last.correct) { this.won = true; this.log.push(`${card.name} → 通了`) }
    else { this.hp--; this.log.push(`${card.name} → 没治好`) }
    return { fixed: this.last.correct, symptom: this.symptom(), won: this.won, hp: this.hp, card: cardId }
  }
}
