/**
 * DNS 缓存罐维修 · 可复用场景类(被 dns-machine.html 单独用,也被 factory 巡线「进入维修」调用)。
 * 全 Canvas 画:三缓存罐(紫=投毒/青=干净、冒泡)、毒往下淌的管子、旋转查名鼓、真相源水晶、工具带、修理机小人 + juice。
 * 底下接真 DnsSim(免费搭赠);won=true 时宿主可标记「这台修好了」并退回巡线。
 * 宿主每帧调 update() + render(ctx,W,H);点击转 pointerdown(mx,my,W,H)。
 */
import { DnsSim } from '../../solvers/dns/sim.ts'

const CREAM = '#F1E7D3', METAL = '#C9A97E', METALD = '#9c7f56', TEAL = '#3fa78f', POISON = '#8b5cc0', POISOND = '#6a3f9e', CORAL = '#e0685e', GOLD = '#e0a94b', GLASS = 'rgba(230,240,238,0.16)'
const SITE = 'www.example.com'
type Fault = 'poison' | 'hijack' | 'down'
const FMAP: Record<Fault, 'poisoned-cache' | 'hosts-hijack' | 'server-down'> = { poison: 'poisoned-cache', hijack: 'hosts-hijack', down: 'server-down' }
const TOOLS = [
  { id: 'probe', icon: '🔍', name: '探针镜' }, { id: 'sniffer', icon: '📼', name: '抓包器' },
  { id: 'flush', icon: '💨', name: '冲刷枪' }, { id: 'wrench', icon: '🔧', name: '道岔扳手' },
  { id: 'knife', icon: '✂️', name: '涂改刀' }, { id: 'load', icon: '▶', name: '发起加载' },
]
const TARGETS: Record<string, string[]> = { probe: ['d-browser', 'd-os', 'd-recursive', 'hosts', 'track', 'auth', 'reroute'], sniffer: ['gate', 'track'], flush: ['d-browser', 'd-os', 'd-recursive'], wrench: ['reroute'], knife: ['hosts'], load: ['gate'] }
type Tank = { level: 'browser' | 'os' | 'recursive'; label: string; fill: number; targetFill: number; state: 'poison' | 'clean' | 'empty' }
type Pt = { x: number; y: number; vx: number; vy: number; life: number; c: string; r: number }

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }

export class DnsRepair {
  won = false; lost = false
  private sim!: DnsSim; fault!: Fault; down = 0; moves = 0; hostsBad = false; trackDead = false
  private tool = 'flush'; private t = 0; private shake = 0; private flash = 0
  private parts: Pt[] = []; private drone = { x: 0, y: 0, tx: 0, ty: 0 }
  private tanks: Tank[] = [
    { level: 'browser', label: '浏览器', fill: 1, targetFill: 1, state: 'poison' },
    { level: 'os', label: '系统', fill: 1, targetFill: 1, state: 'poison' },
    { level: 'recursive', label: '递归·源头', fill: 1, targetFill: 1, state: 'poison' },
  ]
  constructor(f?: Fault) { this.boot(f) }
  boot(f?: Fault) {
    this.fault = f ?? (['poison', 'hijack', 'down'] as Fault[])[Math.floor(Math.random() * 3)]!
    this.sim = new DnsSim(); this.sim.setFault(FMAP[this.fault], SITE)
    this.down = 0; this.moves = 0; this.won = false; this.lost = false; this.tool = 'flush'; this.parts = []; this.shake = 0
    this.syncFlags(this.sim.query(SITE).timeline); this.syncTanks(); for (const tk of this.tanks) tk.fill = tk.targetFill
  }
  private truth() { return this.sim.authoritativeIp(SITE) }
  private cost(n: number) { this.down = Math.min(100, this.down + n); if (this.down >= 100) this.lost = true }
  private syncTanks() {
    const truth = this.truth()
    for (const tk of this.tanks) { const e = this.sim.caches().find(c => c.level === tk.level)!.entries[0]; if (!e) { tk.state = 'empty'; tk.targetFill = 0.05 } else { const v = e.record.value, isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(v); tk.state = isIp && v !== truth ? 'poison' : 'clean'; tk.targetFill = 0.9 } }
  }
  private syncFlags(tl: { hop: string; outcome: string }[]) { this.hostsBad = !!tl.find(x => x.hop === 'hosts' && x.outcome === 'hit'); this.trackDead = tl.some(x => x.hop === 'recursive' && (x.outcome === 'unreachable' || x.outcome === 'timeout')) }
  private burst(x: number, y: number, cols: string[], n: number, spread: number, up = false) { for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: (Math.random() - .5) * spread, vy: up ? -Math.random() * 260 - 40 : (Math.random() - .5) * spread, life: 1, c: cols[Math.floor(Math.random() * cols.length)]!, r: 2 + Math.random() * 4 }) }

  private L(W: number, H: number) {
    const cx = W * 0.42, cy = H * 0.52, s = Math.min(W / 1000, H / 780)
    return { cx, cy, s,
      gate: { x: cx, y: cy - 250 * s, r: 46 * s }, drum: { x: cx - 280 * s, y: cy - 20 * s, r: 70 * s },
      tanks: this.tanks.map((_, i) => ({ x: cx - 120 * s, y: cy - 120 * s + i * 120 * s, w: 190 * s, h: 96 * s })),
      hosts: { x: cx + 190 * s, y: cy - 130 * s, w: 130 * s, h: 78 * s }, auth: { x: cx + 220 * s, y: cy + 150 * s, r: 44 * s },
      reroute: { x: cx - 120 * s, y: cy + 220 * s, w: 190 * s, h: 54 * s }, track: { x: cx + 120 * s, y: cy + 40 * s, w: 150 * s, h: 60 * s } }
  }
  private hit(mx: number, my: number, W: number, H: number): string | null {
    const L = this.L(W, H)
    if (Math.hypot(mx - L.gate.x, my - L.gate.y) < L.gate.r) return 'gate'
    if (Math.hypot(mx - L.auth.x, my - L.auth.y) < L.auth.r) return 'auth'
    for (let i = 0; i < 3; i++) { const b = L.tanks[i]!; if (mx > b.x - b.w / 2 && mx < b.x + b.w / 2 && my > b.y - b.h / 2 && my < b.y + b.h / 2) return 'd-' + this.tanks[i]!.level }
    const inR = (b: { x: number; y: number; w: number; h: number }) => mx > b.x - b.w / 2 && mx < b.x + b.w / 2 && my > b.y - b.h / 2 && my < b.y + b.h / 2
    if (inR(L.hosts)) return 'hosts'; if (inR(L.reroute)) return 'reroute'; if (inR(L.track)) return 'track'
    return null
  }
  private partPos(id: string, W: number, H: number): { x: number; y: number } {
    const L = this.L(W, H)
    if (id === 'gate') return L.gate; if (id === 'auth') return L.auth; if (id === 'hosts') return L.hosts; if (id === 'reroute') return L.reroute; if (id === 'track') return L.track
    const i = this.tanks.findIndex(tk => 'd-' + tk.level === id); return L.tanks[i] ?? L.gate
  }
  /** 冒烟/宿主用:直接用某工具于某部件 */
  op(toolId: string, part: string, W = 1000, H = 780) { this.tool = toolId; this.use(part, W, H) }
  snapshot() { return { fault: this.fault, won: this.won, lost: this.lost, down: Math.round(this.down), moves: this.moves, tool: this.tool, tanks: this.tanks.map(tk => tk.state), canOpen: this.sim.canOpen(SITE) } }
  private use(part: string, W: number, H: number) {
    if (this.won || this.lost) return
    const P = this.partPos(part, W, H); this.drone.tx = P.x; this.drone.ty = P.y - 46
    if (!(TARGETS[this.tool] ?? []).includes(part)) { this.shake = 5; return }
    if (this.tool === 'probe' || this.tool === 'sniffer') { this.flash = .3; return }
    this.moves++; this.cost(5)
    if (this.tool === 'flush') { const lv = part.slice(2) as 'browser' | 'os' | 'recursive'; this.sim.clear(lv); this.burst(P.x, P.y + 30, [POISON, POISOND, '#c9a6ff'], 22, 260); this.shake = 6 }
    else if (this.tool === 'wrench') { this.sim.setDns('public'); this.flash = .4 }
    else if (this.tool === 'knife') { this.sim.editHosts(SITE, null); this.burst(P.x, P.y, [CORAL, GOLD], 14, 180) }
    else if (this.tool === 'load') { const q = this.sim.query(SITE); this.syncFlags(q.timeline); if (q.correct) { this.won = true; this.burst(P.x, P.y, [TEAL, GOLD, CREAM, '#9fe8b8'], 60, 380, true) } else { this.cost(15); this.shake = 12; this.flash = .5 } }
    this.syncTanks()
  }
  pointerdown(mx: number, my: number, W: number, H: number) {
    if (my > H - 74) { const n = TOOLS.length, bw = Math.min(150, (W - 40) / n), x0 = W / 2 - (bw * n) / 2, i = Math.floor((mx - x0) / bw); if (i >= 0 && i < n) { this.tool = TOOLS[i]!.id; return } }
    if (this.lost && my < H * 0.62 && my > H * 0.38) { this.boot(); return }
    const p = this.hit(mx, my, W, H); if (p) this.use(p, W, H)
  }
  update() { this.t += 1 / 60; this.shake = Math.max(0, this.shake - .5); this.flash = Math.max(0, this.flash - .03); for (const tk of this.tanks) tk.fill += (tk.targetFill - tk.fill) * 0.15; this.drone.x += (this.drone.tx - this.drone.x) * 0.16; this.drone.y += (this.drone.ty - this.drone.y) * 0.16 }

  private tank(ctx: CanvasRenderingContext2D, b: { x: number; y: number; w: number; h: number }, tk: Tank, glow: boolean) {
    const x = b.x - b.w / 2, y = b.y - b.h / 2, t = this.t
    if (glow) { ctx.save(); ctx.shadowColor = GOLD; ctx.shadowBlur = 22 }
    ctx.fillStyle = '#2a2018'; rr(ctx, x, y, b.w, b.h, 12); ctx.fill(); if (glow) ctx.restore()
    const liq = tk.state === 'poison' ? POISON : tk.state === 'clean' ? TEAL : '#3a3630'
    const fh = (b.h - 10) * tk.fill, fy = y + b.h - 5 - fh
    ctx.save(); rr(ctx, x + 4, y + 4, b.w - 8, b.h - 8, 9); ctx.clip()
    ctx.fillStyle = liq; ctx.fillRect(x, fy, b.w, fh + 20)
    ctx.fillStyle = tk.state === 'poison' ? POISOND : tk.state === 'clean' ? '#2f8a78' : '#2a2620'
    ctx.beginPath(); ctx.moveTo(x, fy); for (let i = 0; i <= b.w; i += 8) ctx.lineTo(x + i, fy + Math.sin(t * 3 + i * 0.15) * 2.4); ctx.lineTo(x + b.w, fy + 8); ctx.lineTo(x, fy + 8); ctx.fill()
    if (tk.state !== 'empty') for (let i = 0; i < 3; i++) { const bx = x + 20 + ((i * 53 + t * 30) % (b.w - 40)), by = y + b.h - 8 - ((t * 40 + i * 30) % fh); ctx.globalAlpha = .35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1 }
    ctx.restore()
    ctx.strokeStyle = GLASS; ctx.lineWidth = 2; rr(ctx, x, y, b.w, b.h, 12); ctx.stroke()
    ctx.strokeStyle = METALD; ctx.lineWidth = 3; rr(ctx, x, y, b.w, b.h, 12); ctx.stroke()
    ctx.fillStyle = CREAM; ctx.font = `bold ${Math.max(11, b.h * 0.16)}px system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(tk.label, x + 10, y + 15)
    if (tk.state === 'poison') { ctx.fillStyle = '#ffd0ff'; ctx.textAlign = 'right'; ctx.fillText('☠', x + b.w - 10, y + 15) }
  }
  private pipe(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, w: number, poison: boolean) {
    ctx.strokeStyle = METALD; ctx.lineWidth = w + 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke()
    ctx.strokeStyle = METAL; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke()
    if (poison) for (let i = 0; i < 4; i++) { const f = ((this.t * 0.4 + i / 4) % 1); const yy = y1 + (y2 - y1) * f; ctx.globalAlpha = 0.8 * (1 - Math.abs(f - .5) * 0.6); ctx.fillStyle = POISON; ctx.beginPath(); ctx.arc(x, yy, w * 0.32, 0, 7); ctx.fill() }
    ctx.globalAlpha = 1
  }
  render(ctx: CanvasRenderingContext2D, W: number, H: number, hover: string | null = null) {
    const t = this.t, L = this.L(W, H), poisonFlow = this.tanks.some(tk => tk.state === 'poison')
    ctx.save(); if (this.shake > 0) ctx.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake)
    this.pipe(ctx, L.tanks[0]!.x, L.tanks[0]!.y + L.tanks[0]!.h / 2, L.tanks[1]!.y - L.tanks[1]!.h / 2, 10 * L.s, poisonFlow)
    this.pipe(ctx, L.tanks[1]!.x, L.tanks[1]!.y + L.tanks[1]!.h / 2, L.tanks[2]!.y - L.tanks[2]!.h / 2, 10 * L.s, poisonFlow)
    this.pipe(ctx, L.tanks[0]!.x, L.gate.y + L.gate.r, L.tanks[0]!.y - L.tanks[0]!.h / 2, 12 * L.s, false)
    this.pipe(ctx, L.reroute.x, L.tanks[2]!.y + L.tanks[2]!.h / 2, L.reroute.y - L.reroute.h / 2, 10 * L.s, false)
    // 查名鼓
    ctx.save(); ctx.translate(L.drum.x, L.drum.y); ctx.rotate(t * 0.5); ctx.fillStyle = METAL; ctx.beginPath(); ctx.arc(0, 0, L.drum.r, 0, 7); ctx.fill(); ctx.strokeStyle = METALD; ctx.lineWidth = 5; ctx.stroke()
    for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i / 8 * 7); ctx.fillStyle = CREAM; rr(ctx, -8, -L.drum.r + 8, 16, 12, 3); ctx.fill(); ctx.restore() }
    ctx.fillStyle = METALD; ctx.beginPath(); ctx.arc(0, 0, L.drum.r * 0.28, 0, 7); ctx.fill(); ctx.restore()
    // 罐
    this.tanks.forEach((tk, i) => this.tank(ctx, L.tanks[i]!, tk, hover === 'd-' + tk.level && (TARGETS[this.tool] ?? []).includes('d-' + tk.level)))
    // hosts
    { const b = L.hosts, x = b.x - b.w / 2, y = b.y - b.h / 2; ctx.fillStyle = this.hostsBad ? '#3a2018' : '#2a2620'; rr(ctx, x, y, b.w, b.h, 8); ctx.fill(); ctx.strokeStyle = this.hostsBad ? CORAL : METALD; ctx.lineWidth = 3; rr(ctx, x, y, b.w, b.h, 8); ctx.stroke()
      ctx.fillStyle = CREAM; ctx.font = `bold ${12 * L.s + 2}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('📓 hosts 账本', b.x, y + 16 * L.s); ctx.fillStyle = this.hostsBad ? '#ffb0a0' : '#7a7266'; ctx.font = `${10 * L.s + 2}px system-ui`; ctx.fillText(this.hostsBad ? '⚠ 被写死一条' : '干净', b.x, y + b.h - 14 * L.s) }
    // 道岔
    { const b = L.reroute, x = b.x - b.w / 2, y = b.y - b.h / 2; ctx.fillStyle = '#2b2438'; rr(ctx, x, y, b.w, b.h, 8); ctx.fill(); ctx.strokeStyle = '#6a5aa0'; ctx.lineWidth = 3; rr(ctx, x, y, b.w, b.h, 8); ctx.stroke(); ctx.fillStyle = CREAM; ctx.font = `bold ${12 * L.s + 1}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔀 进料道岔 · ' + this.sim.dnsInfo().name, b.x, b.y) }
    // 轨道
    { const b = L.track, x = b.x - b.w / 2, y = b.y - b.h / 2; ctx.strokeStyle = this.trackDead ? CORAL : METALD; ctx.lineWidth = 3; ctx.setLineDash(this.trackDead ? [4, 6] : [2, 8]); rr(ctx, x, y, b.w, b.h, 8); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = this.trackDead ? '#ffb0a0' : CREAM; ctx.font = `${11 * L.s + 2}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.trackDead ? '🏃 路断了 ⚠' : '🏃 跑腿→权威', b.x, b.y); if (!this.trackDead) { const f = (t * 0.6) % 1; ctx.fillStyle = TEAL; ctx.beginPath(); ctx.arc(x + b.w * f, b.y, 4, 0, 7); ctx.fill() } }
    // 真相源
    { const a = L.auth; ctx.save(); ctx.shadowColor = TEAL; ctx.shadowBlur = 16 + Math.sin(t * 2) * 6; ctx.fillStyle = '#1c3a30'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 7); ctx.fill(); ctx.restore(); ctx.strokeStyle = TEAL; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 7); ctx.stroke(); ctx.fillStyle = CREAM; ctx.font = `${11 * L.s + 2}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏛 真相源', a.x, a.y - 8 * L.s); ctx.fillStyle = '#9fe8c8'; ctx.font = `bold ${11 * L.s + 1}px ui-monospace,monospace`; ctx.fillText(this.truth() ?? '—', a.x, a.y + 12 * L.s) }
    // 出口地球
    { const gt = L.gate; ctx.save(); ctx.shadowColor = this.won ? TEAL : CORAL; ctx.shadowBlur = this.won ? 34 : 12; ctx.fillStyle = this.won ? '#1c3a2a' : '#3a1c18'; ctx.beginPath(); ctx.arc(gt.x, gt.y, gt.r, 0, 7); ctx.fill(); ctx.restore(); ctx.strokeStyle = this.won ? TEAL : CORAL; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(gt.x, gt.y, gt.r, 0, 7); ctx.stroke(); ctx.font = `${gt.r * 0.9}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.won ? '🌐' : '📵', gt.x, gt.y + 2) }
    // 修理机小人
    { if (this.drone.x === 0) { this.drone.x = L.gate.x; this.drone.y = L.gate.y } const dx = this.drone.x, dy = this.drone.y + Math.sin(t * 3) * 4
      ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(dx, dy, 15, 0, 7); ctx.fill(); ctx.strokeStyle = METALD; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(dx, dy, 15, 0, 7); ctx.stroke()
      ctx.strokeStyle = METAL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dx - 16, dy - 20); ctx.lineTo(dx + 16, dy - 20); ctx.stroke()
      ctx.fillStyle = TEAL; ctx.beginPath(); ctx.arc(dx, dy, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx + 2, dy - 1, 2, 0, 7); ctx.fill()
      const tt = TOOLS.find(x => x.id === this.tool)!; ctx.font = '16px system-ui'; ctx.fillText(tt.icon, dx - 22, dy) }
    // 粒子
    this.parts = this.parts.filter(p => p.life > 0); for (const p of this.parts) { p.life -= 1 / 60 * 1.4; p.x += p.vx / 60; p.y += p.vy / 60; p.vy += 420 / 60; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill() } ctx.globalAlpha = 1
    ctx.restore()
    // HUD:断网条 + 工具带
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, 20, 48, 240, 20, 10); ctx.fill(); ctx.fillStyle = this.down >= 70 ? '#c0392b' : GOLD; rr(ctx, 20, 48, Math.max(6, 240 * this.down / 100), 20, 10); ctx.fill(); ctx.fillStyle = CREAM; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`断网 ${Math.round(this.down)}%`, 30, 58)
    { const n = TOOLS.length, bw = Math.min(150, (W - 40) / n), x0 = W / 2 - (bw * n) / 2, y = H - 66; ctx.fillStyle = 'rgba(20,16,10,.85)'; rr(ctx, x0 - 8, y - 8, bw * n + 16, 60, 12); ctx.fill()
      TOOLS.forEach((tl, i) => { const bx = x0 + i * bw, sel = tl.id === this.tool; ctx.fillStyle = sel ? GOLD : 'rgba(255,255,255,.06)'; rr(ctx, bx + 4, y, bw - 8, 46, 9); ctx.fill(); ctx.fillStyle = sel ? '#241a10' : CREAM; ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tl.icon, bx + bw / 2, y + 17); ctx.font = 'bold 11px system-ui'; ctx.fillText(tl.name, bx + bw / 2, y + 36) }) }
    if (this.flash > 0) { ctx.fillStyle = `rgba(224,104,94,${this.flash})`; ctx.fillRect(0, 0, W, H) }
  }
}
