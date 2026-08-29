/**
 * 捣蛋鬼对战 · 通用引擎(v5:领域可插拔 + Boss 多层连打 + 关键词连招)。
 * 引擎不认识具体是网络还是冰箱——它只认一个 Domain(层 + 具名攻击 + 卡)。
 *   · 网络领域 combat-net.ts(6 层连接栈,12 招),冰箱领域 combat-fridge.ts(冷链 5 层)。
 * 一场仗 = 一串「波」;每波是捣蛋鬼打出的一张(或 Boss 一回合几张)破坏卡,砸一层或几层。
 * 关键词:反弹(挡下顺手抽一张)/嘲讽(诱饵引开它下一击一层)/连锁(修好顺手再抽一张)。
 * 连不连由整栈真判(守铁律);攻防一对对 = 知识;出错的药挡不住。
 */
export type Mode = 'break' | 'worsen'
export type Keyword = 'reflect' | 'taunt' | 'chain' | 'aoe' | 'buffer' | 'bulwark'
export type CardKind = 'fix' | 'shield' | 'foresee' | 'quickfix' | 'stabilize' | 'taunt' | 'aoe' | 'buffer' | 'bulwark'
export type AttackDef = { layer: string; name: string; broken: string; mode: Mode; counter: string }
export type CardDef = { name: string; cost: number; kind: CardKind; atk?: string; layer?: string; targeted: boolean; note: string; kw?: Keyword[] }
/** 判定快照:每层现在被哪招打着(active)、坏没坏、恶化几档。领域拿它跑真求解器算总成败。 */
export type JudgeSnap = { key: string; active: string | null; broken: boolean; decay: number }
export type JudgeResult = { ok: boolean; metric?: string }
export type Domain = {
  id: string; title: string; statusOk: string; statusBad: string
  layers: string[]
  layerInfo: Record<string, { name: string; why: string }>
  attacks: Record<string, AttackDef>
  cardDef: Record<string, CardDef>
  startDeck: string[]; rewardPool: string[]
  /** 总成败由真求解器判(守铁律):网络走 DnsSim、冰箱走 solveThermal。不给就退回「全好即通」。 */
  judge?: (snap: JudgeSnap[]) => JudgeResult
}
/** 一波 = 捣蛋鬼这回合打出的破坏卡;小怪一张(atks 长度 1),Boss 一回合连打几层(长度 2~3)。 */
export type Wave = { atks: string[]; boss?: boolean }

type LStat = { broken: boolean; active: string | null; decay: number; shield: number; reflect: boolean }
// 断网/变质按「现在坏着几层」加压(越落后越疼)——Boss 一回合连打多层会飙得很快
const ENERGY_MAX = 3, HAND_SIZE = 5, DECAY_CRIT = 3, DOWN_PER = 9, MISS = 8

export type CombatView = {
  title: string
  connected: boolean; statusText: string; metric: string
  energy: number; energyMax: number; deckCount: number; discardCount: number
  wavesLeft: number; wavesMax: number; boss: boolean
  enemyCards: string[]                       // 捣蛋鬼这回合打出的破坏卡(Boss 可能好几张)
  intent: string | null                      // 下一波:打哪层·什么攻击(Boss 连打用 + 连起来)
  intentBoss: boolean
  foresight: string[]                         // 预判卡揭开的接下来两波
  decoy: boolean                              // 诱饵已布好(嘲讽)
  clock: number; clockLabel: string; clockHint: string
  layers: { key: string; name: string; why: string; broken: boolean; decay: number; shield: number; reflect: boolean; attack: string; counter: string; counterType: string; reading: string }[]
  hand: { type: string; name: string; cost: number; targeted: boolean; note: string; kw: Keyword[]; playable: boolean }[]
  events: string[]
  won: boolean; lost: boolean
}

export class Combat {
  dom: Domain
  board: Record<string, LStat>
  energy = ENERGY_MAX
  drawPile: string[]; hand: string[] = []; discard: string[] = []
  waves: Wave[]; cursor = 0; pending: Wave | null
  enemyCards: string[] = []
  private foresee = 0
  decoy = false                               // 嘲讽布下的诱饵:抵消它下一波的一层
  downtime = 0; turn = 0
  won = false; lost = false
  events: string[] = []
  private _ok = false; private _metric = ''    // 真求解器算出的总成败 + 读数(缓存,每次状态变动重算)

  constructor(dom: Domain, deck: string[], waves: Wave[]) {
    this.dom = dom
    this.board = Object.fromEntries(dom.layers.map(l => [l, { broken: false, active: null, decay: 0, shield: 0, reflect: false } as LStat]))
    this.drawPile = deck.length ? [...deck] : [...dom.startDeck]
    this.waves = waves.length ? waves : [{ atks: [dom.layers[0] ? Object.keys(dom.attacks)[0]! : ''] }]
    this.applyWave(this.waves[0]!, true); this.cursor = 1
    this.pending = this.cursor < this.waves.length ? this.waves[this.cursor]! : null
    this.draw(HAND_SIZE)
    this.recompute()
  }
  /** 把当前盘面喂给领域的真求解器,算出总成败 + 读数(缓存进 _ok/_metric)。 */
  private recompute(): void {
    if (this.dom.judge) { const snap = this.dom.layers.map(l => { const s = this.board[l]!; return { key: l, active: s.active, broken: s.broken, decay: s.decay } }); const r = this.dom.judge(snap); this._ok = r.ok; this._metric = r.metric ?? '' }
    else { this._ok = this.dom.layers.every(l => { const s = this.board[l]!; return !s.broken && s.decay < DECAY_CRIT }); this._metric = '' }
  }
  private brokenCount(): number { return this.dom.layers.filter(l => { const s = this.board[l]!; return s.broken || s.decay > 0 }).length }
  private short(l: string) { return this.dom.layerInfo[l]?.name.split(' · ')[0] ?? l }
  private cardName(t: string) { return this.dom.cardDef[t]?.name ?? t }
  private draw(n: number): void { for (let i = 0; i < n; i++) { if (!this.drawPile.length) { this.drawPile = this.discard; this.discard = [] } const c = this.drawPile.shift(); if (c) this.hand.push(c) } }

  private applyWave(w: Wave, opening = false): void {
    this.enemyCards = []
    let atks = [...w.atks]
    if (this.decoy && atks.length) { this.decoy = false; const dropped = atks.shift()!; const a = this.dom.attacks[dropped]!; this.events.unshift(`🪤 诱饵引开了【${a.name}】——这一层没挨着!`) }
    for (const id of atks) {
      const a = this.dom.attacks[id]; if (!a) continue
      const st = this.board[a.layer]!
      this.enemyCards.push(`${a.name} · 打【${this.short(a.layer)}】`)
      if (st.shield > 0) { const ref = st.reflect; st.shield = 0; st.reflect = false; this.events.unshift(`💥 加固挡住了【${a.name}】!`); if (ref) { this.draw(1); this.events.unshift('↩️ 反弹!顺手抽一张') }; continue }
      st.active = id
      if (a.mode === 'worsen') st.decay = Math.max(1, st.decay); else st.broken = true
      if (!opening) this.events.unshift(`捣蛋鬼打出【${a.name}】,砸向 ${this.short(a.layer)}!`)
    }
  }
  private reading(l: string): string {
    const st = this.board[l]!
    if (st.broken && st.active) return this.dom.attacks[st.active]!.broken
    if (st.decay > 0 && st.active) return `${this.dom.attacks[st.active]!.name} 在加重(${st.decay}/${DECAY_CRIT} 档)——再拖就崩`
    return '正常'
  }
  connected(): boolean { return this._ok }

  canPlay(handIdx: number, layer?: string): boolean {
    if (this.won || this.lost) return false
    const c = this.hand[handIdx]; if (c === undefined) return false
    const def = this.dom.cardDef[c]; if (!def || this.energy < def.cost) return false
    if (def.kind === 'shield') { const st = layer !== undefined ? this.board[layer] : undefined; return !!st && st.shield === 0 }
    if (def.kind === 'quickfix') { const st = layer !== undefined ? this.board[layer] : undefined; return !!st && (st.broken || st.decay > 0) }
    if (def.kind === 'stabilize') return this.dom.layers.some(l => this.board[l]!.decay > 0)
    if (def.kind === 'foresee') return this.foresee === 0
    if (def.kind === 'taunt') return !this.decoy
    if (def.kind === 'aoe') return this.brokenCount() > 0
    if (def.kind === 'buffer') return this.downtime > 0
    if (def.kind === 'bulwark') return true
    return true // 对症卡:总能打(打错招=白费,逼你分清同层不同招)
  }
  play(handIdx: number, layer?: string): CombatView {
    if (!this.canPlay(handIdx, layer)) return this.view()
    const c = this.hand[handIdx]!, def = this.dom.cardDef[c]!
    this.events = []; this.energy -= def.cost
    if (def.kind === 'fix') {
      const L = def.layer!, st = this.board[L]!, hurt = st.broken || st.decay > 0
      if (hurt && st.active === def.atk) {
        st.broken = false; st.decay = 0; st.active = null; this.events.push(`【${def.name}】对症!修好 ${this.short(L)} ✓`)
        if (def.kw?.includes('chain')) { this.draw(1); this.events.push('🔗 连锁:顺手再抽一张') }
      } else if (hurt && st.active) { this.downtime = Math.min(100, this.downtime + MISS); this.events.push(`没治对:${this.short(L)} 被的是【${this.dom.attacks[st.active]!.name}】,不是这药治的——白费`) }
      else { this.downtime = Math.min(100, this.downtime + MISS); this.events.push(`【${def.name}】可 ${this.short(L)} 这层没坏——用错了,白费`) }
    } else if (def.kind === 'shield') { const st = this.board[layer!]!; st.shield = 2; st.reflect = def.kw?.includes('reflect') ?? false; this.events.push(`加固 ${this.short(layer!)}${st.reflect ? '(反弹)' : ''} → 顶住它下一击`) }
    else if (def.kind === 'taunt') { this.decoy = true; this.events.push('🪤 嘲讽:布下诱饵,引开它下一击的一层') }
    else if (def.kind === 'quickfix') { const st = this.board[layer!]!; st.broken = false; st.decay = 0; st.active = null; this.events.push(`${def.name} → 硬修好 ${this.short(layer!)} ✓`); if (def.kw?.includes('chain')) { this.draw(1); this.events.push('🔗 连锁:顺手再抽一张') } }
    else if (def.kind === 'stabilize') { for (const l of this.dom.layers) { const st = this.board[l]!; if (st.decay > 0) { st.decay = 0; if (!st.broken) st.active = null } } this.events.push('稳压 → 压住了恶化') }
    else if (def.kind === 'aoe') { let n = 0; for (const l of this.dom.layers) { const st = this.board[l]!; if (st.broken || st.decay > 0) { st.broken = false; st.decay = 0; st.active = null; n++ } } this.events.push(`${def.name} → 一口气修好 ${n} 层 ✓`) }
    else if (def.kind === 'buffer') { const cut = Math.min(this.downtime, 25); this.downtime -= cut; this.events.push(`${def.name} → 稳住局面,断网回退 ${cut}%`) }
    else if (def.kind === 'bulwark') { for (const l of this.dom.layers) { const st = this.board[l]!; st.shield = 2; st.reflect = false } this.events.push(`${def.name} → 全栈顶住它下一波(挡整轮连打)`) }
    else { this.foresee = 2; this.events.push('预判 → 看清它接下来两波破坏卡') }
    this.hand.splice(handIdx, 1); this.discard.push(c)
    this.recompute()
    if (this.connected() && this.cursor >= this.waves.length) this.won = true
    return this.view()
  }
  endTurn(): CombatView {
    if (this.won || this.lost) return this.view()
    this.events = []; this.enemyCards = []
    this.discard.push(...this.hand); this.hand = []
    if (this.pending) { this.applyWave(this.pending); this.cursor++; this.pending = this.cursor < this.waves.length ? this.waves[this.cursor]! : null }
    for (const l of this.dom.layers) { const st = this.board[l]!; if (st.decay > 0 && !st.broken) { st.decay++; if (st.decay >= DECAY_CRIT) { st.broken = true; this.events.push(`⚡ ${this.short(l)} 恶化到顶,崩了!`) } } }
    for (const l of this.dom.layers) { const st = this.board[l]!; if (st.shield > 0) { st.shield--; if (st.shield === 0) st.reflect = false } }
    if (this.foresee > 0) this.foresee--
    this.turn++
    this.recompute()
    if (!this.connected()) this.downtime = Math.min(100, this.downtime + Math.max(1, this.brokenCount()) * DOWN_PER) // 坏几层就加几份,越落后越疼
    if (this.downtime >= 100) this.lost = true
    else if (this.connected() && this.cursor >= this.waves.length) this.won = true
    this.energy = ENERGY_MAX; this.draw(HAND_SIZE)
    return this.view()
  }

  private waveLabel(w: Wave): string { return w.atks.map(id => { const a = this.dom.attacks[id]!; return `${a.name}·${this.short(a.layer)}` }).join(' + ') }
  view(): CombatView {
    const upcoming = this.waves.slice(this.cursor, this.cursor + 2).map(w => this.waveLabel(w))
    return {
      title: this.dom.title,
      connected: this.connected(), statusText: this.connected() ? this.dom.statusOk : this.dom.statusBad, metric: this._metric,
      energy: this.energy, energyMax: ENERGY_MAX, deckCount: this.drawPile.length, discardCount: this.discard.length,
      wavesLeft: Math.max(0, this.waves.length - this.cursor), wavesMax: this.waves.length, boss: this.pending?.boss ?? false,
      enemyCards: [...this.enemyCards],
      intent: this.pending && !this.won ? this.waveLabel(this.pending) : (this.won ? null : '它招数出尽了'),
      intentBoss: this.pending?.boss ?? false,
      foresight: this.foresee > 0 ? upcoming : [],
      decoy: this.decoy,
      clock: Math.round(this.downtime), clockLabel: '断网', clockHint: '全家都在等,满了就算被它得逞',
      layers: this.dom.layers.map(l => {
        const st = this.board[l]!, hurt = st.broken || st.decay > 0
        return { key: l, name: this.dom.layerInfo[l]!.name, why: this.dom.layerInfo[l]!.why, broken: st.broken, decay: st.decay, shield: st.shield, reflect: st.reflect, attack: hurt && st.active ? this.dom.attacks[st.active]!.name : '', counter: hurt && st.active ? this.cardName(this.dom.attacks[st.active]!.counter) : '', counterType: hurt && st.active ? this.dom.attacks[st.active]!.counter : '', reading: this.reading(l) }
      }),
      hand: this.hand.map((c, i) => { const def = this.dom.cardDef[c]!; return { type: c, name: def.name, cost: def.cost, targeted: def.targeted, note: def.note, kw: def.kw ?? [], playable: def.targeted ? this.dom.layers.some(l => this.canPlay(i, l)) : this.canPlay(i) } }),
      events: [...this.events], won: this.won, lost: this.lost,
    }
  }
}

/** 生成一场仗的波序。kind 决定强度:小怪单张、精英偶尔双张、Boss 多张连打。 */
export function makeWaves(dom: Domain, kind: 'trash' | 'elite' | 'boss', pick: (n: number) => number): Wave[] {
  const ids = Object.keys(dom.attacks)
  const one = () => ids[pick(ids.length)]!
  const uniq = (n: number) => { const s: string[] = []; let guard = 0; while (s.length < n && guard++ < 40) { const a = one(); if (!s.includes(a)) s.push(a) } return s }
  if (kind === 'trash') return Array.from({ length: 3 }, () => ({ atks: [one()] }))
  if (kind === 'elite') return Array.from({ length: 4 }, (_, i) => ({ atks: i === 2 ? uniq(2) : [one()] }))
  // boss:6 波,第 2/4/6 波连打 2~3 层,最后一波三连
  return Array.from({ length: 6 }, (_, i) => {
    if (i === 5) return { atks: uniq(3), boss: true }
    if (i % 2 === 1) return { atks: uniq(2), boss: true }
    return { atks: [one()] }
  })
}
