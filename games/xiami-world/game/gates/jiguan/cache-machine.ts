/**
 * 缓存机关的**可嵌入**版:渲染进一个 rect(不再独占整屏),给 B-light 连续世界用。
 * 逻辑/美术与 cache-lane.ts 一致(缓存槽=抽屉/信=染色信封/投毒扩散/目标15容错6),只是坐标全部相对 rect。
 * 用法:const m = new CacheMachine(ctx); 每帧 m.update(active); m.render({x,y,w,h}); 输入 m.pointer(x,y)/m.key(k)。
 */
import { Level } from './level'
import { drawHudRect, legendRect } from './embed-hud'
import skinUrl from '../../../web/assets/gen/gates/cache.webp'
import slotUrl from '../../../web/assets/gen/gates/obj/slot.webp'
import envUrl from '../../../web/assets/gen/gates/obj/envelope.webp'

export type Rect = { x: number; y: number; w: number; h: number }
const COLS = ['#e0954b', '#5b8def', '#3fa78f'], POISON = '#8b5cc0', TEAL = '#49a791'
type Phase = 'in' | 'fast' | 'toLook' | 'fromLook'
type Pk = { x: number; y: number; ty: number; shape: number; stamp: number | null; phase: Phase; decided: boolean; done: boolean }
type Slot = { state: 'empty' | 'good' | 'poison'; ttl: number }
const SKIN = new Image(); SKIN.src = skinUrl
const SLOT_IMG = new Image(); SLOT_IMG.src = slotUrl
const ENV_IMG = new Image(); ENV_IMG.src = envUrl
const rdy = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0

export class CacheMachine {
  ctx: CanvasRenderingContext2D
  rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
  pk: Pk[] = []
  slots: Slot[] = [{ state: 'empty', ttl: 0 }, { state: 'empty', ttl: 0 }, { state: 'empty', ttl: 0 }]
  good = 0; bad = 0; spawnT = 0; poisonT = 2.5; spreadT = 3; t = 0
  bins: number[] = []
  fl = [0, 0, 0]; flush = [0, 0, 0]; flushBad = [0, 0, 0]
  level = new Level(15, 6)
  envTint: HTMLCanvasElement[] = []
  constructor(ctx: CanvasRenderingContext2D) { this.ctx = ctx }

  get state() { return this.level.state }
  reset() { this.pk = []; this.good = 0; this.bad = 0; this.bins.length = 0; this.slots.forEach(s => { s.state = 'empty'; s.ttl = 0 }); this.flushBad = [0, 0, 0]; this.spawnT = 0; this.poisonT = 2.5; this.spreadT = 3; this.level.reset() }

  L() {
    const { x, y, w, h } = this.rect
    const jx = x + w * 0.40, fastY = y + h * 0.40, slowY = y + h * 0.56, lookY = y + h * 0.75, slotY = y + h * 0.22
    return { x0: x + w * 0.05, jx, lookX: x + w * 0.78, exitX: x + w * 0.88, binX: x + w * 0.88 + 26, fastY, slowY, lookY, slotY, slotX: [jx - w * 0.10, jx, jx + w * 0.10] as const }
  }
  spawn(shape = Math.floor(Math.random() * 3)) { const g = this.L(); this.pk.push({ x: g.x0, y: g.slowY, ty: g.slowY, shape, stamp: null, phase: 'in', decided: false, done: false }) }
  doFlush(i: number) { const s = this.slots[i]; if (!s) return; if (s.state === 'good') { this.level.bad(); this.flushBad[i] = 1 } else this.flush[i] = 1; s.state = 'empty'; s.ttl = 0 }
  flushAll() { for (let i = 0; i < 3; i++) this.doFlush(i) }
  poison() { const goods = this.slots.map((s, i) => s.state === 'good' ? i : -1).filter(i => i >= 0); const pick = goods.length ? goods[Math.floor(Math.random() * goods.length)]! : Math.floor(Math.random() * 3); this.slots[pick] = { state: 'poison', ttl: 1 } }
  spread() { const hasP = this.slots.some(s => s.state === 'poison'); const goods = this.slots.map((s, i) => s.state === 'good' ? i : -1).filter(i => i >= 0); if (hasP && goods.length) this.slots[goods[Math.floor(Math.random() * goods.length)]!] = { state: 'poison', ttl: 1 } }
  pointer(px: number, py: number) { const g = this.L(); for (let i = 0; i < 3; i++) if (Math.abs(px - g.slotX[i]!) < this.rect.w * 0.06 && Math.abs(py - g.slotY) < this.rect.h * 0.11) { this.doFlush(i); return } }
  key(k: string) { if (k >= '1' && k <= '3') this.doFlush(+k - 1); if (k === ' ') this.flushAll(); if (k === 'r' || k === 'R') this.reset() }

  update(active: boolean) {
    this.t += 1 / 60; const playing = active && this.level.state === 'play'
    for (let i = 0; i < 3; i++) { this.fl[i] = Math.max(0, this.fl[i]! - .05); this.flush[i] = Math.max(0, this.flush[i]! - .04); this.flushBad[i] = Math.max(0, this.flushBad[i]! - .03) }
    if (playing) { this.spawnT -= 1 / 60; if (this.spawnT <= 0) { this.spawnT = 1.2; this.spawn() } }
    if (playing) { this.poisonT -= 1 / 60; if (this.poisonT <= 0) { this.poisonT = 3.5; this.poison() } }
    if (playing) { this.spreadT -= 1 / 60; if (this.spreadT <= 0) { this.spreadT = 3; this.spread() } }
    if (playing) for (const s of this.slots) { if (s.state !== 'empty') { s.ttl -= 1 / 60 / 18; if (s.ttl <= 0) s.state = 'empty' } }
    if (!playing) return
    const g = this.L()
    for (const p of this.pk) {
      const spd = (p.phase === 'fast' ? 320 : p.phase === 'fromLook' ? 200 : 130) / 60 * (this.rect.w / 1280)
      p.x += spd; p.y += (p.ty - p.y) * 0.22
      if (p.phase === 'in' && !p.decided && p.x >= g.jx) { p.decided = true; const s = this.slots[p.shape]!; if (s.state === 'good') { p.phase = 'fast'; p.ty = g.fastY; p.stamp = p.shape; this.fl[p.shape] = 1 } else if (s.state === 'poison') { p.phase = 'fast'; p.ty = g.fastY; p.stamp = (p.shape + 1) % 3; this.fl[p.shape] = 1 } else { p.phase = 'toLook'; p.ty = g.slowY } }
      if (p.phase === 'toLook') { p.ty = p.x >= g.lookX - 60 ? g.lookY : g.slowY; if (p.stamp === null && p.x >= g.lookX) { p.stamp = p.shape; const s = this.slots[p.shape]!; if (s.state === 'empty') this.slots[p.shape] = { state: 'good', ttl: 1 }; p.phase = 'fromLook'; p.ty = g.fastY } }
      if ((p.phase === 'fast' || p.phase === 'fromLook') && !p.done && p.x >= g.exitX && p.stamp !== null) { p.done = true; if (p.stamp === p.shape) { this.good++; this.level.good() } else { this.bad++; this.bins.push(p.shape); this.level.bad() } }
    }
    this.pk = this.pk.filter(p => p.x < this.rect.x + this.rect.w + 40)
  }

  private shapeMark(x: number, y: number, r: number, shape: number, col: string) {
    const c = this.ctx; c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath()
    if (shape === 0) { c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath() }
    else if (shape === 1) c.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7)
    else c.arc(x, y, r, 0, 7)
    c.fill(); c.stroke()
  }
  private rr(x: number, y: number, w: number, h: number, r: number) { const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
  private buildEnvTints() { if (this.envTint.length || !rdy(ENV_IMG)) return; for (let s = 0; s < 3; s++) { const cc = document.createElement('canvas'); cc.width = ENV_IMG.naturalWidth; cc.height = ENV_IMG.naturalHeight; const x = cc.getContext('2d')!; x.drawImage(ENV_IMG, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.5; x.fillStyle = COLS[s]!; x.fillRect(0, 0, cc.width, cc.height); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; this.envTint[s] = cc } }
  private belt(x0: number, x1: number, y: number, sp: number, col = '#4a4030') { const c = this.ctx; c.strokeStyle = '#2c261e'; c.lineWidth = 16; c.beginPath(); c.moveTo(x0, y + 22); c.lineTo(x1, y + 22); c.stroke(); c.fillStyle = col; for (let x = x0 - ((this.t * sp) % 36); x < x1; x += 36) if (x >= x0) c.fillRect(x, y + 17, 18, 10) }

  private drawSlot(i: number, sx: number, sy: number, fastY: number) {
    const c = this.ctx, s = this.slots[i]!, SW = Math.min(150, this.rect.w * 0.12), SH = SW
    c.strokeStyle = '#6a5636'; c.lineWidth = 8; c.beginPath(); c.moveTo(sx, sy + SH * 0.36); c.lineTo(sx, fastY + 8); c.stroke()
    if (rdy(SLOT_IMG)) { const h = SW * (SLOT_IMG.naturalHeight / SLOT_IMG.naturalWidth); c.drawImage(SLOT_IMG, sx - SW / 2, sy - h / 2, SW, h) }
    else { c.fillStyle = '#241d16'; c.fillRect(sx - SW / 2, sy - SH / 2, SW, SH); c.strokeStyle = '#5a4e3a'; c.strokeRect(sx - SW / 2, sy - SH / 2, SW, SH) }
    const compY = sy - SH * 0.03, cw = SW * 0.46, ch = SH * 0.30
    c.save(); this.rr(sx - cw / 2, compY - ch / 2, cw, ch, 6); c.clip()
    if (s.state === 'good') {
      const gl = c.createRadialGradient(sx, compY, 3, sx, compY, cw * 0.75); gl.addColorStop(0, `rgba(90,230,190,${.55 * Math.max(.35, s.ttl)})`); gl.addColorStop(1, 'rgba(90,230,190,0)'); c.fillStyle = gl; c.fillRect(sx - cw / 2, compY - ch / 2, cw, ch)
      c.globalAlpha = Math.max(.45, s.ttl); this.rr(sx - 17, compY - 13, 34, 26, 4); c.fillStyle = '#efe6d2'; c.fill(); c.strokeStyle = '#9c7f56'; c.lineWidth = 1.5; c.stroke(); this.shapeMark(sx, compY, 8, i, COLS[i]!); c.globalAlpha = 1
    } else if (s.state === 'poison') {
      const hh = ch * Math.max(.55, s.ttl); c.fillStyle = POISON; c.beginPath(); c.moveTo(sx - cw / 2, compY + ch / 2)
      for (let wx = -cw / 2; wx <= cw / 2; wx += 6) c.lineTo(sx + wx, compY + ch / 2 - hh + Math.sin((wx + this.t * 40) / 9) * 3)
      c.lineTo(sx + cw / 2, compY + ch / 2); c.closePath(); c.fill()
    }
    c.restore()
    const lampC = s.state === 'poison' ? POISON : s.state === 'good' ? '#49e0b0' : '#2a2416', lampY = sy - SH * 0.38
    c.globalAlpha = s.state === 'empty' ? .35 : .6 + .4 * Math.sin(this.t * 4)
    const lg = c.createRadialGradient(sx, lampY, 1, sx, lampY, 16); lg.addColorStop(0, lampC); lg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = lg; c.beginPath(); c.arc(sx, lampY, 16, 0, 7); c.fill(); c.globalAlpha = 1
    this.shapeMark(sx, sy + SH * 0.33, 7, i, s.state === 'empty' ? '#8a7a5a' : COLS[i]!)
    if (s.state === 'poison') { c.fillStyle = '#ffd0ff'; c.font = '20px system-ui'; c.textAlign = 'center'; c.fillText('☠', sx, sy - SH * 0.52) }
    if (this.fl[i]! > 0) { c.globalAlpha = this.fl[i]!; c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(sx, sy + SH * 0.36); c.lineTo(sx, fastY + 8); c.stroke(); c.globalAlpha = 1 }
    if (this.flush[i]! > 0) { c.globalAlpha = this.flush[i]!; c.fillStyle = '#fff'; c.font = '22px system-ui'; c.textAlign = 'center'; c.fillText('💧', sx, compY); c.globalAlpha = 1 }
    if (this.flushBad[i]! > 0) { c.globalAlpha = this.flushBad[i]!; c.strokeStyle = '#ff6a4a'; c.lineWidth = 5; c.beginPath(); c.moveTo(sx - 15, compY - 15); c.lineTo(sx + 15, compY + 15); c.moveTo(sx + 15, compY - 15); c.lineTo(sx - 15, compY + 15); c.stroke(); c.globalAlpha = 1 }
  }

  render(rect: Rect) {
    this.rect = rect; const c = this.ctx, g = this.L()
    c.save(); this.rr(rect.x, rect.y, rect.w, rect.h, 14); c.clip()
    // 皮:缓存大厅(cover-fit rect)+ 压暗
    if (rdy(SKIN)) { const s = Math.max(rect.w / SKIN.naturalWidth, rect.h / SKIN.naturalHeight), dw = SKIN.naturalWidth * s, dh = SKIN.naturalHeight * s; c.drawImage(SKIN, rect.x + (rect.w - dw) / 2, rect.y + (rect.h - dh) / 2, dw, dh); c.fillStyle = 'rgba(16,12,8,.62)'; c.fillRect(rect.x, rect.y, rect.w, rect.h) }
    else { c.fillStyle = '#1e1a14'; c.fillRect(rect.x, rect.y, rect.w, rect.h) }
    this.belt(g.jx, g.exitX, g.fastY, 320, '#5a6a4a'); this.belt(g.x0, g.jx, g.slowY, 120)
    c.strokeStyle = '#2c261e'; c.lineWidth = 10; c.beginPath(); c.moveTo(g.jx, g.slowY + 22); c.lineTo(g.lookX - 50, g.slowY + 22); c.lineTo(g.lookX, g.lookY + 22); c.lineTo(g.exitX, g.fastY + 22); c.stroke()
    c.strokeStyle = '#3a342a'; c.lineWidth = 9; c.beginPath(); c.moveTo(g.jx, g.slowY + 22); c.lineTo(g.jx, g.fastY + 22); c.stroke()
    c.fillStyle = '#3a4636'; c.fillRect(g.lookX - 26, g.lookY - 38, 52, 58); c.fillStyle = '#9fe8b8'; c.beginPath(); c.arc(g.lookX, g.lookY - 30, 8, 0, 7); c.fill()
    for (let i = 0; i < 3; i++) this.shapeMark(g.lookX - 14 + i * 14, g.lookY + 4, 4, i, COLS[i]!)
    c.strokeStyle = TEAL; c.lineWidth = 4; c.strokeRect(g.exitX - 4, g.fastY - 44, 8, 66)
    c.fillStyle = '#5a2420'; c.fillRect(g.binX, g.fastY + 56, 82, 130); c.strokeStyle = '#a83c2e'; c.lineWidth = 3; c.strokeRect(g.binX, g.fastY + 56, 82, 130)
    this.buildEnvTints()
    for (let i = 0; i < 3; i++) this.drawSlot(i, g.slotX[i]!, g.slotY, g.fastY)
    for (const p of this.pk) {
      const tint = this.envTint[p.shape], ew = 40, eh = ew * (rdy(ENV_IMG) ? ENV_IMG.naturalHeight / ENV_IMG.naturalWidth : 0.7)
      if (tint) c.drawImage(tint, p.x - ew / 2, p.y - eh / 2, ew, eh)
      else { c.fillStyle = COLS[p.shape]!; c.fillRect(p.x - 14, p.y - 10, 28, 20) }
      this.shapeMark(p.x, p.y + eh * 0.02, 6, p.shape, '#fff4dc')
      if (p.stamp !== null) { const ok = p.stamp === p.shape; c.fillStyle = ok ? '#2f8a5a' : POISON; c.beginPath(); c.arc(p.x + ew * 0.34, p.y - eh * 0.34, 7, 0, 7); c.fill(); this.shapeMark(p.x + ew * 0.34, p.y - eh * 0.34, 3.5, p.stamp, '#fff') }
    }
    this.bins.slice(-20).forEach((b, i) => this.shapeMark(g.binX + 16 + (i % 4) * 20, g.fastY + 170 - Math.floor(i / 4) * 20, 7, b, POISON))
    c.restore()
    legendRect(c, rect, '紫槽=被投毒:只冲那个紫的。拆好槽(青)会扣分', [{ k: '点槽/1 2 3', t: '冲掉那格缓存' }, { k: '空格', t: '全冲(慎用)' }, { k: 'Q', t: '走开' }])
    drawHudRect(c, rect, this.level)
  }
}
