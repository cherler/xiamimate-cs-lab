/**
 * 机关灰盒①·v3:缓存快线 vs 投毒。blockout 纯色块,状态零文字全靠色/形/流动。
 *
 * 读法(一眼看得出这是台"查号+缓存"流水线):
 *   信从左边进 → 到中间岔口,抬头看它这形状的**缓存槽**:
 *     · 槽里有干净地址章(青) → 被"吊"上**上层快线**,直接冲到右边出闸(又快又对)。
 *     · 槽空 → 只能走**下层慢道**,绕到最右的**查号台**盖对章,顺手把这形状缓存进槽(下次就快),再回来出闸。
 *     · 槽被毒(紫) → 信也被吊上快线,但盖的是**错章** → 冲到出闸掉进红废桶。
 *   于是"缓存命中=省掉那段绕路"是看得见的:命中的信在顶上一溜烟,没命中的在底下绕大圈。
 *
 * 取舍(咬人):捣蛋鬼每隔一阵毒掉一个好槽;**毒不清会往邻槽扩散**。
 *   · 早发现、只冲那一个紫槽 = 便宜(该形状慢一小会,很快重新缓存)。
 *   · 拖久了紫槽扩成两三个 = 慌了按"全冲"(空格) = 干净但丢光攒好的全部快线,整条线变慢。
 *   · 等 TTL 自然过期 = 期间匹配的信一直掉红桶,废信堆积。
 * 深度:①一动作多后果(冲槽=清毒但也丢快线);②时序(投毒→扩散→你反应的窗口 + 好槽TTL会掉);③一物多用(同一"冲刷"对好/坏槽后果相反,得先认出哪个坏)。
 */
import { Level, drawLegend } from './level'
import skinUrl from '../../../web/assets/gen/gates/cache.webp'
import slotUrl from '../../../web/assets/gen/gates/obj/slot.webp'
import envUrl from '../../../web/assets/gen/gates/obj/envelope.webp'
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()
const SKIN = new Image(); SKIN.src = skinUrl
const SLOT_IMG = new Image(); SLOT_IMG.src = slotUrl
const ENV_IMG = new Image(); ENV_IMG.src = envUrl
const imgReady = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0
function drawSkin(a = .62) { // 场景皮:查号缓存大厅(压暗+暗角,让前景物件跳出来)
  if (imgReady(SKIN)) { const s = Math.max(W / SKIN.naturalWidth, H / SKIN.naturalHeight), dw = SKIN.naturalWidth * s, dh = SKIN.naturalHeight * s; ctx.drawImage(SKIN, (W - dw) / 2, (H - dh) / 2, dw, dh); ctx.fillStyle = `rgba(16,12,8,${a})`; ctx.fillRect(0, 0, W, H)
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H) }
  else { ctx.fillStyle = '#1e1a14'; ctx.fillRect(0, 0, W, H) }
}
function spriteC(img: HTMLImageElement, cx: number, cy: number, w: number) { if (!imgReady(img)) return; const h = w * (img.naturalHeight / img.naturalWidth); ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h) }
// 三色信封(整封染色=身份):离屏预染一次
const envTint: HTMLCanvasElement[] = []
function buildEnvTints() { if (envTint.length || !imgReady(ENV_IMG)) return; for (let s = 0; s < 3; s++) { const c = document.createElement('canvas'); c.width = ENV_IMG.naturalWidth; c.height = ENV_IMG.naturalHeight; const x = c.getContext('2d')!; x.drawImage(ENV_IMG, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.5; x.fillStyle = COLS[s]!; x.fillRect(0, 0, c.width, c.height); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; envTint[s] = c } }

const COLS = ['#e0954b', '#5b8def', '#3fa78f'] // 三形状色:△方○ 对应 shape 0/1/2
const POISON = '#8b5cc0'

type Phase = 'in' | 'fast' | 'toLook' | 'fromLook'
type Pk = { x: number; y: number; ty: number; shape: number; stamp: number | null; phase: Phase; decided: boolean; done: boolean }
type Slot = { state: 'empty' | 'good' | 'poison'; ttl: number }
let pk: Pk[] = []
const slots: Slot[] = [{ state: 'empty', ttl: 0 }, { state: 'empty', ttl: 0 }, { state: 'empty', ttl: 0 }]
const D = Math.max(1, +(new URLSearchParams(location.search).get('d') || 1)) // 难度(副本层数越深越大):威胁越密
const POISON_CYCLE = Math.max(1.6, 3.5 - (D - 1) * 0.7), SPREAD_CYCLE = Math.max(1.4, 3 - (D - 1) * 0.5)
let good = 0, bad = 0, spawnT = 0, poisonT = 2.5, spreadT = 3, t = 0, auto = true // 一进来就快点上毒(别让玩家干等)
const bins: { shape: number }[] = []
const fl = [0, 0, 0]      // 每槽:被抄近路时的下料闪光
const flush = [0, 0, 0]   // 每槽:被冲刷时的白闪
const flushBad = [0, 0, 0] // 每槽:冲了"好槽"=失误的红闪
const level = new Level(15, 6) // 目标:送出 15 封好信=开门赢;红桶攒到 6 封=机器罢工输
function resetAll() { pk = []; good = 0; bad = 0; bins.length = 0; slots.forEach(s => { s.state = 'empty'; s.ttl = 0 }); flushBad[0] = flushBad[1] = flushBad[2] = 0; spawnT = 0; poisonT = 2.5; spreadT = 3; level.reset() }

function L() {
  const jx = W * 0.40, fastY = H * 0.40, slowY = H * 0.56, lookY = H * 0.75, slotY = H * 0.22
  return { x0: 56, jx, lookX: W * 0.78, exitX: W * 0.88, binX: W * 0.88 + 30, fastY, slowY, lookY, slotY, slotX: [jx - 132, jx, jx + 132] as const }
}
function spawn(shape = Math.floor(Math.random() * 3)) { const g = L(); pk.push({ x: g.x0, y: g.slowY, ty: g.slowY, shape, stamp: null, phase: 'in', decided: false, done: false }) }
function doFlush(i: number) { const s = slots[i]; if (!s) return; if (s.state === 'good') { level.bad(); flushBad[i] = 1 } else flush[i] = 1; s.state = 'empty'; s.ttl = 0 } // 冲紫槽=对;冲好槽=拆了在用的缓存=失误
function flushAll() { for (let i = 0; i < 3; i++) doFlush(i) }
function poisonRandom() {
  const goods = slots.map((s, i) => s.state === 'good' ? i : -1).filter(i => i >= 0)
  const pick = goods.length ? goods[Math.floor(Math.random() * goods.length)]! : Math.floor(Math.random() * 3)
  slots[pick] = { state: 'poison', ttl: 1 }
}
function spread() { // 毒扩散:有毒且有好槽时,把一个好槽也染紫
  const hasP = slots.some(s => s.state === 'poison')
  const goods = slots.map((s, i) => s.state === 'good' ? i : -1).filter(i => i >= 0)
  if (hasP && goods.length) slots[goods[Math.floor(Math.random() * goods.length)]!] = { state: 'poison', ttl: 1 }
}

function hitSlot(x: number, y: number) { const g = L(); for (let i = 0; i < 3; i++) if (Math.abs(x - g.slotX[i]!) < 52 && Math.abs(y - (g.slotY + 6)) < 70) return i; return -1 }
cv.addEventListener('pointerdown', e => { const i = hitSlot(e.clientX, e.clientY); if (i >= 0) doFlush(i) })
addEventListener('keydown', e => { if (e.key >= '1' && e.key <= '3') doFlush(+e.key - 1); if (e.key === ' ') { e.preventDefault(); flushAll() }; if (e.key === 'p') poisonRandom(); if (e.key === 'r' || e.key === 'R') resetAll() })

function shapeMark(x: number, y: number, r: number, shape: number, col: string) {
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.beginPath()
  if (shape === 0) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath() }
  else if (shape === 1) ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7)
  else ctx.arc(x, y, r, 0, 7)
  ctx.fill(); ctx.stroke()
}
function belt(x0: number, x1: number, y: number, sp: number, col = '#4a4030') {
  ctx.strokeStyle = '#2c261e'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(x0, y + 24); ctx.lineTo(x1, y + 24); ctx.stroke()
  ctx.fillStyle = col; for (let x = x0 - ((t * sp) % 40); x < x1; x += 40) if (x >= x0) ctx.fillRect(x, y + 18, 20, 12)
}
function rr(x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
function drawSlot(i: number, sx: number, sy: number, fastY: number) {
  const s = slots[i]!, SW = 138, SH = 138
  ctx.strokeStyle = '#6a5636'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(sx, sy + SH * 0.36); ctx.lineTo(sx, fastY + 10); ctx.stroke()
  ctx.strokeStyle = '#2a2114'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy + SH * 0.36); ctx.lineTo(sx, fastY + 10); ctx.stroke()
  if (imgReady(SLOT_IMG)) spriteC(SLOT_IMG, sx, sy, SW)
  else { ctx.fillStyle = '#241d16'; ctx.fillRect(sx - SW / 2, sy - SH / 2, SW, SH); ctx.strokeStyle = '#5a4e3a'; ctx.strokeRect(sx - SW / 2, sy - SH / 2, SW, SH) }
  const compY = sy - SH * 0.03, cw = SW * 0.46, ch = SH * 0.30
  ctx.save(); rr(sx - cw / 2, compY - ch / 2, cw, ch, 6); ctx.clip()
  if (s.state === 'good') {
    const gl = ctx.createRadialGradient(sx, compY, 3, sx, compY, cw * 0.75); gl.addColorStop(0, `rgba(90,230,190,${.55 * Math.max(.35, s.ttl)})`); gl.addColorStop(1, 'rgba(90,230,190,0)'); ctx.fillStyle = gl; ctx.fillRect(sx - cw / 2, compY - ch / 2, cw, ch)
    ctx.globalAlpha = Math.max(.45, s.ttl); rr(sx - 17, compY - 13, 34, 26, 4); ctx.fillStyle = '#efe6d2'; ctx.fill(); ctx.strokeStyle = '#9c7f56'; ctx.lineWidth = 1.5; ctx.stroke(); shapeMark(sx, compY, 8, i, COLS[i]!); ctx.globalAlpha = 1
  } else if (s.state === 'poison') {
    const h = ch * Math.max(.55, s.ttl); ctx.fillStyle = POISON; ctx.beginPath(); ctx.moveTo(sx - cw / 2, compY + ch / 2)
    for (let wx = -cw / 2; wx <= cw / 2; wx += 6) ctx.lineTo(sx + wx, compY + ch / 2 - h + Math.sin((wx + t * 40) / 9) * 3)
    ctx.lineTo(sx + cw / 2, compY + ch / 2); ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(201,166,255,.5)'; ctx.fillRect(sx - cw / 2, compY + ch / 2 - h, cw, 3)
  }
  ctx.restore()
  const lampC = s.state === 'poison' ? POISON : s.state === 'good' ? '#49e0b0' : '#2a2416'
  const lampY = sy - SH * 0.38
  ctx.globalAlpha = s.state === 'empty' ? .35 : .6 + .4 * Math.sin(t * 4)
  const lg = ctx.createRadialGradient(sx, lampY, 1, sx, lampY, 16); lg.addColorStop(0, lampC); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(sx, lampY, 16, 0, 7); ctx.fill(); ctx.globalAlpha = 1
  shapeMark(sx, sy + SH * 0.33, 7, i, s.state === 'empty' ? '#8a7a5a' : COLS[i]!)
  if (s.state === 'poison') { ctx.fillStyle = '#ffd0ff'; ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('☠', sx, sy - SH * 0.52) }
  if (fl[i]! > 0) { ctx.globalAlpha = fl[i]!; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx, sy + SH * 0.36); ctx.lineTo(sx, fastY + 10); ctx.stroke(); ctx.globalAlpha = 1 }
  if (flush[i]! > 0) { ctx.globalAlpha = flush[i]!; ctx.fillStyle = '#fff'; ctx.font = '24px system-ui'; ctx.textAlign = 'center'; ctx.fillText('💧', sx, compY); ctx.globalAlpha = 1 }
  if (flushBad[i]! > 0) { ctx.globalAlpha = flushBad[i]!; ctx.strokeStyle = '#ff6a4a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sx - 15, compY - 15); ctx.lineTo(sx + 15, compY + 15); ctx.moveTo(sx + 15, compY - 15); ctx.lineTo(sx - 15, compY + 15); ctx.stroke(); ctx.globalAlpha = 1 }
}

function frame() {
  t += 1 / 60; const g = L(); const playing = level.state === 'play'
  for (let i = 0; i < 3; i++) { fl[i] = Math.max(0, fl[i]! - .05); flush[i] = Math.max(0, flush[i]! - .04); flushBad[i] = Math.max(0, flushBad[i]! - .03) }
  if (playing) spawnT -= 1 / 60; if (playing && spawnT <= 0) { spawnT = 1.2; spawn() }
  if (playing && auto) { poisonT -= 1 / 60; if (poisonT <= 0) { poisonT = POISON_CYCLE; poisonRandom() } }
  if (playing && auto) { spreadT -= 1 / 60; if (spreadT <= 0) { spreadT = SPREAD_CYCLE; spread() } }
  if (playing && auto) for (const s of slots) { if (s.state !== 'empty') { s.ttl -= 1 / 60 / 18; if (s.ttl <= 0) s.state = 'empty' } }

  // 背景:场景皮
  drawSkin()
  // 上层快线(顶)· 下层慢道(中)· 查号绕道(慢道尽头下探到查号台再回出闸)
  belt(g.jx, g.exitX, g.fastY, 340, '#5a6a4a')                 // 快线:亮一点
  belt(g.x0, g.jx, g.slowY, 130)                              // 进料段
  // 慢道绕行:从岔口沿慢道到 lookX,下探到 lookY(查号台),再抬回 exit
  ctx.strokeStyle = '#2c261e'; ctx.lineWidth = 12; ctx.beginPath()
  ctx.moveTo(g.jx, g.slowY + 24); ctx.lineTo(g.lookX - 60, g.slowY + 24); ctx.lineTo(g.lookX, g.lookY + 24); ctx.lineTo(g.exitX, g.fastY + 24); ctx.stroke()

  // 岔口立柱(慢道→快线的"吊车")
  ctx.strokeStyle = '#3a342a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(g.jx, g.slowY + 24); ctx.lineTo(g.jx, g.fastY + 24); ctx.stroke()

  // 查号台(慢道尽头:盖对章 + 回填缓存)
  ctx.fillStyle = '#3a4636'; ctx.fillRect(g.lookX - 30, g.lookY - 42, 60, 66)
  ctx.fillStyle = '#9fe8b8'; ctx.beginPath(); ctx.arc(g.lookX, g.lookY - 32, 9, 0, 7); ctx.fill()
  for (let i = 0; i < 3; i++) shapeMark(g.lookX - 16 + i * 16, g.lookY + 6, 5, i, COLS[i]!) // 台上摆着三形状真章

  // 出闸门 + 红废桶
  ctx.strokeStyle = '#49a791'; ctx.lineWidth = 4; ctx.strokeRect(g.exitX - 4, g.fastY - 46, 8, 70)
  ctx.fillStyle = '#5a2420'; ctx.fillRect(g.binX, g.fastY + 60, 92, 150); ctx.strokeStyle = '#a83c2e'; ctx.lineWidth = 3; ctx.strokeRect(g.binX, g.fastY + 60, 92, 150)

  // 三个缓存槽:画成"地址抽屉"实物,状态靠顶灯/地址卡/紫浆
  buildEnvTints()
  for (let i = 0; i < 3; i++) drawSlot(i, g.slotX[i]!, g.slotY, g.fastY)

  // 信:走状态机
  for (const p of pk) {
    if (playing) {
      const spd = (p.phase === 'fast' ? 320 : p.phase === 'fromLook' ? 200 : 130) / 60
      p.x += spd; p.y += (p.ty - p.y) * 0.22
      if (p.phase === 'in' && !p.decided && p.x >= g.jx) {
        p.decided = true; const s = slots[p.shape]!
        if (s.state === 'good') { p.phase = 'fast'; p.ty = g.fastY; p.stamp = p.shape; fl[p.shape] = 1 }
        else if (s.state === 'poison') { p.phase = 'fast'; p.ty = g.fastY; p.stamp = (p.shape + 1) % 3; fl[p.shape] = 1 }
        else { p.phase = 'toLook'; p.ty = g.slowY }
      }
      if (p.phase === 'toLook') { p.ty = p.x >= g.lookX - 60 ? g.lookY : g.slowY; if (p.stamp === null && p.x >= g.lookX) { p.stamp = p.shape; const s = slots[p.shape]!; if (s.state === 'empty') slots[p.shape] = { state: 'good', ttl: 1 }; p.phase = 'fromLook'; p.ty = g.fastY } }
      if ((p.phase === 'fast' || p.phase === 'fromLook') && !p.done && p.x >= g.exitX && p.stamp !== null) {
        p.done = true; if (p.stamp === p.shape) { good++; level.good() } else { bad++; bins.push({ shape: p.shape }); level.bad() }
      }
    }
    // 画信:染色信封(整封色=身份)+ 封蜡形状 + 盖的章
    const tint = envTint[p.shape], ew = 42, eh = ew * (imgReady(ENV_IMG) ? ENV_IMG.naturalHeight / ENV_IMG.naturalWidth : 0.7)
    if (tint) ctx.drawImage(tint, p.x - ew / 2, p.y - eh / 2, ew, eh)
    else { ctx.fillStyle = COLS[p.shape]!; ctx.strokeStyle = '#9c7f56'; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(p.x - 15, p.y - 11, 30, 22); ctx.fill(); ctx.stroke() }
    shapeMark(p.x, p.y + eh * 0.02, 6, p.shape, '#fff4dc') // 封蜡上的形状(浅色,压在信封上更清)
    if (p.stamp !== null) { const ok = p.stamp === p.shape; ctx.fillStyle = ok ? '#2f8a5a' : POISON; ctx.beginPath(); ctx.arc(p.x + ew * 0.34, p.y - eh * 0.34, 7, 0, 7); ctx.fill(); shapeMark(p.x + ew * 0.34, p.y - eh * 0.34, 3.5, p.stamp, '#fff') }
  }
  pk = pk.filter(p => p.x < W + 40)

  // 废桶堆坏信(物理堆叠;计分归上方目标/容错条)
  bins.slice(-24).forEach((b, i) => shapeMark(g.binX + 18 + (i % 4) * 22, g.fastY + 196 - Math.floor(i / 4) * 22, 8, b.shape, POISON))
  drawLegend(ctx, W, H, '紫槽=被投毒:只冲那个紫的。拆掉好槽(青)会扣分', [
    { k: '点槽/1 2 3', t: '冲掉那一格缓存' },
    { k: '空格', t: '全冲(慎用:会连好缓存一起拆)' },
    { k: 'R', t: '重来' },
  ])
  level.render(ctx, W, H, t)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

;(window as unknown as { __state: () => object }).__state = () => ({ good, bad, slots: slots.map(s => s.state), packets: pk.length, level: level.snapshot() })
;(window as unknown as { __reset2: () => void }).__reset2 = resetAll
;(window as unknown as { __flush: (i: number) => void }).__flush = (i) => doFlush(i)
;(window as unknown as { __flushAll: () => void }).__flushAll = flushAll
;(window as unknown as { __spawn: (s: number) => void }).__spawn = (s) => spawn(s)
;(window as unknown as { __poison: () => void }).__poison = poisonRandom
;(window as unknown as { __spread: () => void }).__spread = spread
;(window as unknown as { __auto: (on: boolean) => void }).__auto = (on) => { auto = on }

export {}
;(window as unknown as { __level: (g: number, f: number) => void }).__level = (g, f) => { level.goal = g; level.failMax = f; level.reset() }
