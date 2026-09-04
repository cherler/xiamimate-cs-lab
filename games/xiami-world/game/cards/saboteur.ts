/**
 * 捣蛋鬼对战 · 骨架(路由器版,接真 DnsSim)。
 * 终于有敌人了:捣蛋鬼手里一叠**破坏卡**(每张=往系统注一个真故障),每回合出一张、亮意图;
 * 你手里是**对应卡**(每张=真防御/真修复),看懂它动的哪层、出对的那张挡回去。
 *   · 挡对一招 → 捣蛋鬼士气 −1(它随即又出下一招);士气清零 = 你熬赢了它。
 *   · 挡错方向 = 白折腾(断网飙升);断网满 = 被它得逞,输。
 * 成没成由**真 DnsSim 判**(query.correct),不是写死血条。破坏↔对应这一对一对,就是知识点。
 */
import { DnsSim } from '../../solvers/dns/sim.ts'
import type { FaultKind } from '../../solvers/dns/state.ts'

export const SITE = 'www.example.com'

/** 破坏卡:真攻击(注真故障)+ 意图提示(它盯上哪层,不直接报答案) */
export const ATTACK_INFO: Record<string, { name: string; hint: string }> = {
  'poisoned-cache': { name: '投毒缓存', hint: '往你存的地址本里塞假条' },
  'ttl-too-long': { name: '灌过期旧值', hint: '塞个旧地址、把保质期拉超长' },
  'hosts-hijack': { name: '改 hosts', hint: '在你名单最前头写死一条' },
  'server-down': { name: '掐掉 DNS 服务器', hint: '把替你问路的那台弄下线' },
  'server-slow': { name: '拖慢 DNS', hint: '让那台慢到超时' },
}
export const ATTACK_POOL: FaultKind[] = ['poisoned-cache', 'ttl-too-long', 'hosts-hijack', 'server-down', 'server-slow']

/** 对应卡:真防御(=真 sim 动作)。fixes=它能挡住的攻击(这一对一对就是要学的知识)。 */
export type Counter = { id: string; name: string; note: string; fixes: FaultKind[]; act: (s: DnsSim) => void }
export const COUNTERS: Counter[] = [
  { id: 'clear-cache', name: '清缓存', note: '丢掉本机存的脏/旧地址', fixes: ['poisoned-cache', 'ttl-too-long'], act: s => s.clear('all') },
  { id: 'edit-hosts', name: '删 hosts 那条', note: '去掉写死的错指向', fixes: ['hosts-hijack'], act: s => s.editHosts(SITE, null) },
  { id: 'switch-dns', name: '换公共 DNS', note: '换掉挂了/被盯上的那台', fixes: ['server-down'], act: s => s.setDns('public') },
  { id: 'raise-timeout', name: '调大超时', note: '给慢的那台多点时间', fixes: ['server-slow'], act: s => s.setTimeout(6000) },
]

const DOWN = 16, WRONG = 22 // 每回合断网涨幅;挡错方向的额外代价

export type SabView = {
  title: string
  systemOk: boolean; systemText: string
  morale: number; moraleMax: number       // 捣蛋鬼士气(=还剩几招没挡下)
  activeName: string | null                // 它现在这一招(已亮明)
  intent: string | null                    // 下一招(意图预告)
  clock: number; clockLabel: string; clockHint: string
  hand: { id: string; name: string; note: string }[]
  events: string[]
  won: boolean; lost: boolean
}

export class Saboteur {
  sim = new DnsSim()
  attacks: FaultKind[]                      // 捣蛋鬼这一场的破坏卡序列(由外部随机排,防刷)
  cursor = 0                               // 现在在扛第几招
  beaten = 0
  downtime = 0
  turn = 0
  won = false
  lost = false
  events: string[] = []
  private stepAdd = 0

  constructor(attacks: FaultKind[]) {
    this.attacks = attacks.length ? attacks : ['poisoned-cache']
    this.inject(this.attacks[0]!) // 开场第一招已经打出来了
  }
  /** 出一招:先把缓存清冷,再注故障——保证这招真咬人(不被暖着的缓存兜掉)。 */
  private inject(f: FaultKind): void { this.sim.clear('all'); this.sim.setFault(f, SITE) }
  private active(): FaultKind | null { return this.cursor < this.attacks.length ? this.attacks[this.cursor]! : null }
  private ok(): boolean { return this.sim.query(SITE).correct }

  hand() { return COUNTERS.map(c => ({ id: c.id, name: c.name, note: c.note })).concat([{ id: 'wait', name: '缓一手', note: '不出手先扛一回合(断网会涨)' }]) }

  play(cardId: string): SabView {
    if (this.won || this.lost) return this.view()
    this.events = []; this.stepAdd = 0
    if (cardId === 'wait') this.events.push('缓了一手…')
    else {
      const c = COUNTERS.find(x => x.id === cardId)
      if (c) {
        const act = this.active(), right = act !== null && c.fixes.includes(act)
        c.act(this.sim)
        if (right && this.ok()) {
          this.beaten++; this.cursor++
          this.events.push(`「${c.name}」挡回去了!捣蛋鬼士气 −1`)
          const nxt = this.active()
          if (nxt) { this.inject(nxt); this.events.push(`捣蛋鬼又出手:${ATTACK_INFO[nxt]!.name}!`) }
          else this.events.push('捣蛋鬼没招了,灰溜溜跑了!')
        } else { this.stepAdd = WRONG; this.events.push(`「${c.name}」拆错方向,白折腾(断网飙升)`) }
      }
    }
    this.turn++
    const up = this.ok()
    if (!up) this.downtime = Math.min(100, this.downtime + DOWN + this.stepAdd)
    if (this.downtime >= 100) this.lost = true
    else if (this.beaten >= this.attacks.length && up) this.won = true
    return this.view()
  }

  view(): SabView {
    const act = this.active(), nextI = this.cursor + 1, next = nextI < this.attacks.length ? this.attacks[nextI]! : null
    const q = this.sim.query(SITE)
    return {
      title: '路由器 · 捣蛋鬼来了',
      systemOk: q.correct, systemText: q.correct ? '网页通了' : '网页打不开',
      morale: Math.max(0, this.attacks.length - this.beaten), moraleMax: this.attacks.length,
      activeName: this.won || act === null ? null : `${ATTACK_INFO[act]!.name} · ${ATTACK_INFO[act]!.hint}`,
      intent: next ? `${ATTACK_INFO[next]!.name}` : this.won ? null : '这是最后一招了',
      clock: Math.round(this.downtime), clockLabel: '断网', clockHint: '全家都在等,满了就算被它得逞',
      hand: this.hand(), events: [...this.events], won: this.won, lost: this.lost,
    }
  }
}
