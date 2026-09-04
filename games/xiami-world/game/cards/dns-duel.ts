/**
 * 路由器副本 v2 · 多回合"对战" —— 和冰箱同一套规则(敌人=故障、故障主动反扑),接真 DnsSim。
 *
 * 守铁律"仿真是核心":症状/读数/成败全从真 DnsSim 来(query 的时间线、caches 快照);
 * 多回合的动态(断网时钟、脏缓存反扑)加在包一层的 DnsDuel 里,底下引擎不动。
 *   · 顶层症状总可见但只到"家族":解析就失败 vs 翻出错地址——不点名是哪种故障;
 *   · 探针取证:拨测服务器 / 翻缓存 / 查 hosts,各自坐实一类,读的是真时间线/真缓存;
 *   · 处置=真 sim 动作(换 DNS/清缓存/删 hosts/调超时),通没通由 query().correct 判;
 *   · 反扑:脏缓存类拖太久,上游递归被喂顽固——只清本地会被重新灌回,得先换掉这台 DNS 再清。
 */
import { DnsSim } from '../../solvers/dns/sim.ts'
import type { FaultKind } from '../../solvers/dns/state.ts'
import type { QueryResult } from '../../solvers/dns/types.ts'
import type { DuelCard, DuelView, RunMods } from './duel.ts'
import { NO_MODS } from './duel.ts'

export const SITE = 'www.example.com'
export type DnsReading = 'hosts' | 'cache' | 'server' | 'authority'

export type DnsCard =
  | { id: string; kind: 'probe'; name: string; note: string; reveal: DnsReading }
  | { id: string; kind: 'fix'; name: string; note: string; act: (s: DnsSim) => void }
  | { id: string; kind: 'wait'; name: string; note: string }

export const CARDS: DnsCard[] = [
  { id: 'probe-server', kind: 'probe', name: '拨测递归 DNS', note: '看那台服务器可达不、快不快', reveal: 'server' },
  { id: 'probe-cache', kind: 'probe', name: '翻本地缓存', note: '看缓存里存的是什么地址', reveal: 'cache' },
  { id: 'probe-hosts', kind: 'probe', name: '查 hosts 文件', note: '看有没有被写死一条', reveal: 'hosts' },
  { id: 'probe-authority', kind: 'probe', name: '下探·直接问权威', note: '越过缓存,拿地址的最终出处(真相),跟你手里的一比', reveal: 'authority' },
  { id: 'switch-dns', kind: 'fix', name: '换公共 DNS', note: '换掉可能挂了/被污染的那台', act: s => s.setDns('public') },
  { id: 'raise-timeout', kind: 'fix', name: '调大超时', note: '给慢的服务器多点时间', act: s => s.setTimeout(6000) },
  { id: 'clear-cache', kind: 'fix', name: '清缓存(全部)', note: '丢掉本地存的旧/脏地址', act: s => s.clear('all') },
  { id: 'edit-hosts', kind: 'fix', name: '删掉 hosts 那条', note: '去掉本机写死的指向', act: s => s.editHosts(SITE, null) },
  { id: 'wait', kind: 'wait', name: '刷新等一会儿', note: '不动手,让它自己走一步' },
]

const DOWN = 12, HOT_TURNS = 3
const PROBE_MUL = 0.4, WRONG_FIX = 24 // 探针"快又便宜"、错处置"慢又亏"(乱试代价大,逼你先取证)
const FIX_TARGET: Record<string, FaultKind[]> = { 'switch-dns': ['server-down'], 'raise-timeout': ['server-slow'], 'clear-cache': ['poisoned-cache', 'ttl-too-long'], 'edit-hosts': ['hosts-hijack'] }
const CACHEY: FaultKind[] = ['poisoned-cache', 'ttl-too-long'] // 会反扑的脏缓存类

export type DnsSnapshot = {
  turn: number
  status: string                            // 顶层症状(总可见,只到家族、不点名故障)
  ok: boolean
  downtime: number                          // 0..100 断网压力
  won: boolean; lost: boolean
  root: FaultKind                           // 真故障(内部/测试用)
  entrenched: boolean
  known: Partial<Record<DnsReading, string>> // 已探针读到的真值
  events: string[]
}

export class DnsDuel {
  sim = new DnsSim()
  root: FaultKind
  turn = 0
  downtime = 0
  won = false
  lost = false
  known: Partial<Record<DnsReading, string>> = {}
  events: string[] = []
  entrenched = false
  cards = CARDS
  mods: RunMods = NO_MODS   // 工具箱修饰符
  hardMul = 1               // 难度:精英/Boss 让时钟涨更快
  private bypassed = false
  private unfixed = 0
  private stepMul = 1   // 探针便宜
  private stepAdd = 0   // 错处置昂贵
  private last: QueryResult

  /** 数字=随机挑一种真故障(防刷);FaultKind=指定(关卡/测试)。mods/hardMul 由跑图层注入。 */
  constructor(initial: FaultKind | number, mods: RunMods = NO_MODS, hardMul = 1) {
    this.mods = mods; this.hardMul = hardMul
    this.root = typeof initial === 'number' ? this.sim.seedFault(initial, SITE) : this.sim.setFault(initial, SITE)
    this.last = this.sim.query(SITE)
    for (let i = 0; i < mods.startReveals; i++) this.revealOne()
  }

  /** 亮一个还没探到的读数(工具用)。 */
  revealOne(): boolean {
    for (const k of ['hosts', 'cache', 'server', 'authority'] as DnsReading[]) if (this.known[k] === undefined) { this.known[k] = this.reveal(k); return true }
    return false
  }
  /** 急救包:把断网压回一截。 */
  easeClock(amount: number): void { this.downtime = Math.max(0, this.downtime - amount) }

  private statusText(): string {
    if (this.last.correct) return '通了。'
    if (this.last.failure) return '打不开:名字根本没翻成地址(解析这一步就失败了)。'
    return '打不开:翻出了地址、可拨过去没人应(地址是错的)。'
  }

  /** 探针:读真时间线/真缓存,坐实一类,不改物理。 */
  private reveal(r: DnsReading): string {
    if (r === 'cache') {
      const hit = this.sim.caches().flatMap(c => c.entries).find(e => e.record.name === SITE)
      if (!hit) return '干净·没这条'
      return `脏:${hit.record.value}(TTL ${hit.ttlLeft}s${hit.ttlLeft > 86400 ? '·超长' : ''})`
    }
    if (r === 'authority') { // 下探到真相源,跟手里的地址一比
      const truth = this.sim.authoritativeIp(SITE), got = this.last.ip
      if (truth && got && got !== truth) return `真相 ${truth}·你手里 ${got} 不对!`
      if (truth && got === truth) return `真相 ${truth}·跟你手里一致`
      return truth ? `真相 ${truth}·可你还没拿到地址` : '权威也查不到'
    }
    const q = this.sim.query(SITE)
    if (r === 'server') {
      const rec = q.timeline.find(s => s.hop === 'recursive')
      if (!rec) return '本地就命中·没到服务器'
      if (rec.outcome === 'unreachable') return '连不上·像挂了'
      if (rec.outcome === 'timeout') return '超时·太慢(>2秒)'
      return '可达·正常'
    }
    const h = q.timeline.find(s => s.hop === 'hosts' && s.outcome === 'hit')
    return h ? `写死→${h.record?.value}` : '名单干净·没这条'
  }

  /** 世界回合:断网时钟走、脏缓存拖太久则被上游重新灌回(反扑)。 */
  private worldTurn() {
    if (CACHEY.includes(this.root) && !this.entrenched && !this.bypassed && !this.last.correct && this.unfixed >= HOT_TURNS) {
      this.entrenched = true
      this.events.push('⚡ 拖太久,连上游递归都被这条脏记录污染了——现在光清本地缓存,一会儿又会被重新灌回来。')
    }
    if (this.entrenched && !this.bypassed && CACHEY.includes(this.root)) this.sim.setFault(this.root, SITE) // 上游重新灌脏
    this.last = this.sim.query(SITE)
    if (!this.last.correct) { this.downtime = Math.min(100, this.downtime + (DOWN * this.stepMul + this.stepAdd) * this.mods.clockMul * this.hardMul); this.unfixed++ }
    else this.unfixed = 0
    this.stepMul = 1; this.stepAdd = 0
    for (let i = 0; i < this.mods.autoRevealPerTurn; i++) this.revealOne() // 监控仪:每回合自动亮一个
    this.turn++
    if (this.downtime >= 100) this.lost = true
    else if (this.last.correct) this.won = true
  }

  play(cardId: string): DnsSnapshot {
    if (this.won || this.lost) return this.snapshot()
    const card = CARDS.find(c => c.id === cardId)
    this.events = []
    if (!card) return this.snapshot()
    let msg: string, wasted = false
    if (card.kind === 'probe') { this.stepMul = PROBE_MUL; const v = this.reveal(card.reveal); this.known[card.reveal] = v; msg = `探针「${card.name}」→ ${v}` }
    else if (card.kind === 'fix') {
      if (card.id === 'switch-dns') this.bypassed = true
      wasted = !FIX_TARGET[card.id]?.includes(this.root) && !(card.id === 'switch-dns' && this.entrenched) // 拆错方向
      if (wasted) this.stepAdd = WRONG_FIX
      card.act(this.sim); msg = `处置「${card.name}」`
    }
    else msg = '刷新,等一会儿…'
    this.worldTurn()
    if (card.kind === 'fix') msg += this.last.correct ? ' → 通了!' : wasted ? ' → 拆错方向,白折腾(断网飙升)' : ' → 还没通(方向对、可能被反扑挡着)'
    this.events.unshift(msg)
    return this.snapshot()
  }

  snapshot(): DnsSnapshot {
    return {
      turn: this.turn, status: this.statusText(), ok: this.last.correct, downtime: Math.round(this.downtime),
      won: this.won, lost: this.lost, root: this.root, entrenched: this.entrenched, known: { ...this.known }, events: [...this.events],
    }
  }

  // —— 通用回合制外壳的适配 ——
  hand(): DuelCard[] { return CARDS.map(c => ({ id: c.id, kind: c.kind, name: c.name, note: c.note })) }
  view(): DuelView {
    const s = this.snapshot()
    const fam = s.ok ? '能打开' : this.last.failure ? '没解析出地址(解析就失败)' : '地址不对·拨不通'
    const sv = s.known.server, cv = s.known.cache, hv = s.known.hosts, av = s.known.authority
    return {
      title: '路由器 · 网页打不开',
      statusLabel: '网页', statusValue: s.ok ? '通了' : '打不开', statusOk: s.ok,
      clockLabel: '断网', clock: s.downtime, clockHint: '全家都在等,越拖越炸,满了就算修砸',
      // 读数即"逐跳链",从最先查(hosts)一层层下探到最深的真相源(权威)
      readings: [
        { label: '现象', value: fam, off: !s.ok, plain: (s.ok ? '网页能打开了' : this.last.failure ? '连地址都没查出来——卡在"把网址翻成 IP(门牌号)"这一步' : '地址查出来了、可连过去没人应——你手里这个是个错地址') + `(你现在拿到:${this.last.ip ?? '没拿到'})` },
        { label: 'hosts', value: hv ?? null, ref: '最先查·该没有', off: hv !== undefined && hv.includes('写死'), plain: hv === undefined ? undefined : hv.includes('写死') ? '第一站 hosts:被人手写死了一条错地址,它优先级最高、直接截胡——清缓存都没用,得删这条' : '第一站 hosts:名单干净,没被动过手脚' },
        { label: '本机缓存', value: cv ?? null, ref: '存过的·该新鲜', off: cv !== undefined && cv.includes('脏'), plain: cv === undefined ? undefined : cv.includes('脏') ? '第二站 本机缓存:存过的"网址→地址"里,这条是坏的/旧的——清掉就会重新去查对的' : '第二站 本机缓存:没这条,或存的是对的' },
        { label: '递归服务器', value: sv ?? null, ref: '替你往下问·该秒回', off: sv !== undefined && (sv.includes('连不上') || sv.includes('超时')), plain: sv === undefined ? undefined : sv.includes('连不上') ? '第三站 递归服务器:替你往下问的那台连不上了(像挂了)——换台公共 DNS 就能绕过' : sv.includes('超时') ? '第三站 递归服务器:答得太慢、超时了(正常一两秒)' : '第三站 递归服务器:没毛病' },
        { label: '权威·真相', value: av ?? null, ref: '地址的最终出处', off: av !== undefined && av.includes('不对'), plain: av === undefined ? undefined : av.includes('不对') ? '最深一站 权威(真相源):它给的地址跟你手里的不一样!——说明上面某一站(缓存/hosts)喂了你旧的/错的' : av.includes('还没拿到') ? '最深一站 权威(真相源)有真地址,可你上面就卡住了、根本没走到这儿' : '最深一站 权威:跟你手里的一致,地址没问题' },
      ],
      turn: s.turn, won: s.won, lost: s.lost, events: s.events,
      wonText: '🎉 通了!网页打开了', lostText: '💀 断网太久,家里人炸了',
    }
  }
}
