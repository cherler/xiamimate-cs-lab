/**
 * 副本 Demo · B-light 正式版:一个连续的**路由器剖面走廊**,虾米君沿它往深处走,三台机器是走廊里的实体设备。
 *   开场(网断→接入) → 走路(镜头跟随,剖面走廊) → 走到发亮的机器按 E → 镜头平滑框住它、虾米君站在底座旁就地操作
 *   (真机关 CacheMachine/ShaftMachine/PoisonMachine,可嵌入,玩法不动)→ 解完拉回、往深走 → 三台修通抵核心 → 网恢复。
 * 角色全程在场,进机器无硬切换。替代了原「技师控制台」形态。
 */
import { CacheMachine } from '../gates/jiguan/cache-machine'
import { ShaftMachine } from '../gates/jiguan/shaft-machine'
import { PoisonMachine } from '../gates/jiguan/poison-machine'
import corridorUrl from '../../web/assets/gen/gates/corridor.webp'
import botUrl from '../../web/assets/gen/dns/drone.webp'
import { sfx } from './sfx'

const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()
const mk = (u: string) => { const i = new Image(); i.src = u; return i }
const BG = mk(corridorUrl), BOT = mk(botUrl)
const rdy = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0
const TEAL = '#49a791', AMBER = '#e8c98a', CREAM = '#efe6d2'

type Kind = 'cache' | 'shaft' | 'poison'
const STATIONS: { x: number; name: string; kind: Kind; machine: CacheMachine | ShaftMachine | PoisonMachine; done: boolean; intro: string }[] = [
  { x: 820, name: '查号缓存', kind: 'cache', machine: new CacheMachine(ctx), done: false, intro: '缓存被投毒了 —— 清掉紫的,把好信送出去。' },
  { x: 1950, name: '递归查号', kind: 'shaft', machine: new ShaftMachine(ctx), done: false, intro: '三段竖井堵了 —— 拨盘对上每层亮起的形状,放信穿到底。' },
  { x: 3080, name: '连接引擎', kind: 'poison', machine: new PoisonMachine(ctx), done: false, intro: '真地址卡在低处 —— 灌毒当动力,把青核心顶进窗口稳住。' },
]
const CORE_X = 3950, WORLD = 4300
let px = 140, pvx = 0, face = 1, camX = 0, bob = 0, t = 0, stepT = 0, finT = 0
type Mode = 'intro' | 'walk' | 'operate' | 'finale'
let mode: Mode = 'intro'
let zoom = 0, winHold = -1, activeIdx = -1
const keys: Record<string, boolean> = {}
let bubble: { text: string; t: number } | null = null
function say(s: string) { bubble = { text: s, t: 0 } }
function nextIdx() { return STATIONS.findIndex(s => !s.done) }
function allDone() { return STATIONS.every(s => s.done) }
function floorY() { return H * 0.82 }
function framed() { return { x: W * 0.13, y: H * 0.09, w: W * 0.74, h: H * 0.60 } }

function enter(i: number) { if (mode !== 'walk' || i !== nextIdx()) return; mode = 'operate'; activeIdx = i; STATIONS[i]!.machine.reset(); winHold = -1; sfx.dive(); say('虾米君跳上操作台 —— ' + STATIONS[i]!.intro) }
function leave(won: boolean) { const i = activeIdx; mode = 'walk'; activeIdx = -1; if (won && i >= 0) { STATIONS[i]!.done = true; sfx.chime(); const n = nextIdx(); say(n < 0 ? '信号贯通!去最深处的核心 →' : '修好了,信号往深处走 —— 下一台在前面。') } }
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true
  if (mode === 'intro') { if (k === ' ' || k === 'enter') { sfx.resume(); mode = 'walk'; say('沿着剖面往里走,走到发亮的机器按 E 修它。') } }
  else if (mode === 'walk') { if (k === 'e') { const i = nextIdx(); if (i >= 0 && Math.abs(px - STATIONS[i]!.x) < 150) enter(i); else if (allDone() && Math.abs(px - CORE_X) < 160) toFinale() } if (k === 'r') resetAll() }
  else if (mode === 'operate') { if (k === 'q' || k === 'escape') leave(false); else { if (k === ' ') e.preventDefault(); STATIONS[activeIdx]!.machine.key(e.key) } }
  else if (mode === 'finale') { if (k === 'r') resetAll() }
})
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false })
cv.addEventListener('pointerdown', e => { if (mode === 'operate' && zoom > 0.9 && activeIdx >= 0) STATIONS[activeIdx]!.machine.pointer(e.clientX, e.clientY) })
function toFinale() { mode = 'finale'; finT = 0; sfx.win() }
function resetAll() { STATIONS.forEach(s => { s.done = false; s.machine.reset() }); px = 140; pvx = 0; mode = 'intro'; activeIdx = -1; bubble = null }

// —— 画元件 ——
function drawBot(x: number, footY: number, h: number, f: number) { if (!rdy(BOT)) { ctx.fillStyle = '#8bd3c8'; ctx.fillRect(x - h * 0.2, footY - h, h * 0.4, h); return } const w = h * (BOT.naturalWidth / BOT.naturalHeight); ctx.save(); ctx.translate(x, footY - h / 2); ctx.scale(f, 1); ctx.drawImage(BOT, -w / 2, -h / 2, w, h); ctx.restore() }
function tileBg(scroll: number) { if (!rdy(BG)) { ctx.fillStyle = '#14100a'; ctx.fillRect(0, 0, W, H); return } const bw = H * (BG.naturalWidth / BG.naturalHeight); let idx = Math.floor(scroll / bw), x = -(scroll - idx * bw); for (; x < W; x += bw, idx++) { const flip = Math.abs(idx) % 2 === 1; ctx.save(); ctx.translate(x + (flip ? bw : 0), 0); ctx.scale(flip ? -1 : 1, 1); ctx.drawImage(BG, 0, 0, bw, H); ctx.restore() } }
function emblem(kind: Kind, x: number, y: number, col: string) { ctx.strokeStyle = col; ctx.lineWidth = 4; if (kind === 'cache') for (let i = 0; i < 3; i++) ctx.strokeRect(x - 42 + i * 30, y - 12, 22, 28); else if (kind === 'shaft') for (let i = 0; i < 3; i++) ctx.strokeRect(x - 24, y - 30 + i * 22, 48, 16); else { ctx.beginPath(); ctx.moveTo(x - 22, y - 16); ctx.lineTo(x + 22, y - 16); ctx.lineTo(x + 15, y + 20); ctx.lineTo(x - 15, y + 20); ctx.closePath(); ctx.stroke() } }
function facade(s: { x: number; name: string; kind: Kind; done: boolean }, sx: number, active: boolean) {
  const fy = floorY(), fw = 260, fh = 200, x = sx - fw / 2, y = fy - fh - 8
  ctx.fillStyle = 'rgba(18,14,9,.66)'; ctx.fillRect(x, y, fw, fh)
  ctx.strokeStyle = s.done ? TEAL : active ? AMBER : '#5a4e3a'; ctx.lineWidth = 4; ctx.globalAlpha = s.done || active ? 1 : .6; ctx.strokeRect(x, y, fw, fh)
  emblem(s.kind, sx, fy - fh / 2, s.done ? TEAL : active ? AMBER : '#6a5a3a')
  ctx.globalAlpha = 1
  ctx.fillStyle = s.done ? TEAL : active ? '#c8452e' : '#4a4030'; ctx.globalAlpha = active && !s.done ? .6 + .4 * Math.sin(t * 6) : .8; ctx.beginPath(); ctx.arc(x + fw - 18, y + 16, 7, 0, 7); ctx.fill(); ctx.globalAlpha = 1
  ctx.fillStyle = s.done ? TEAL : CREAM; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(s.done ? s.name + ' ✓' : s.name, sx, y - 12)
  if (active && !s.done && Math.abs(px - sx) < 150) { ctx.fillStyle = CREAM; ctx.font = 'bold 20px system-ui'; ctx.fillText('按 E 修', sx, y - 38) }
}
function bubbleBox() { if (!bubble) return; bubble.t += 1; const bw = Math.min(620, W - 40), bh = 54, bx = 20, by = H - 88; ctx.fillStyle = 'rgba(15,12,8,.9)'; ctx.strokeStyle = TEAL; ctx.lineWidth = 2; ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh); ctx.fillStyle = TEAL; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('虾米君', bx + 16, by + bh / 2); ctx.fillStyle = CREAM; ctx.font = '16px system-ui'; ctx.fillText(bubble.text, bx + 74, by + bh / 2); ctx.textBaseline = 'alphabetic' }
function hint(s: string) { ctx.fillStyle = 'rgba(20,16,12,.7)'; ctx.font = '15px system-ui'; ctx.textAlign = 'center'; const w = ctx.measureText(s).width + 24; ctx.fillRect(W / 2 - w / 2, 20, w, 28); ctx.fillStyle = AMBER; ctx.textBaseline = 'middle'; ctx.fillText(s, W / 2, 34); ctx.textBaseline = 'alphabetic' }

function tick() {
  t += 1 / 60
  zoom += ((mode === 'operate' ? 1 : 0) - zoom) * 0.14
  if (mode === 'walk') { let dir = 0; if (keys['a'] || keys['arrowleft']) dir = -1; if (keys['d'] || keys['arrowright']) dir = 1; pvx += (dir * 4 - pvx) * 0.16; px = Math.max(60, Math.min(WORLD - 60, px + pvx)); if (dir) face = dir; bob = Math.sin(t * 6) * 4; if (Math.abs(pvx) > 1) { stepT -= 1; if (stepT <= 0) { stepT = 18; sfx.step() } } }
  camX = Math.max(0, Math.min(WORLD - W, px - W * 0.42))

  if (mode === 'intro') { ctx.fillStyle = '#12100a'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = CREAM; ctx.font = 'bold 34px system-ui'; ctx.fillText('网,断了。', W / 2, H * 0.34); ctx.fillStyle = AMBER; ctx.font = '18px system-ui'; ctx.fillText('接入路由器,沿着剖面往里走、逐台修通信号……', W / 2, H * 0.34 + 40); hint('按 空格 接入'); requestAnimationFrame(tick); return }
  if (mode === 'finale') { finT += 1; const glow = Math.min(1, finT / 120); ctx.fillStyle = '#12100a'; ctx.fillRect(0, 0, W, H); tileBg(camX * 0.5); ctx.fillStyle = `rgba(73,167,145,${glow * 0.24})`; ctx.fillRect(0, 0, W, H); const cx = W / 2, cy = H * 0.42; for (let r = 3; r > 0; r--) { ctx.fillStyle = `rgba(73,167,145,${0.08 * glow * r})`; ctx.beginPath(); ctx.arc(cx, cy, 60 + r * 34 * glow, 0, 7); ctx.fill() } ctx.strokeStyle = TEAL; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 58, 0, 7); ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(cx - 24 + i * 24, cy + 2, 8, 0, 7); ctx.fill() } drawBot(cx, H * 0.82, 120, 1); ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.globalAlpha = glow; ctx.font = 'bold 34px system-ui'; ctx.fillText('核心重启 —— 网,回来了!', cx, H * 0.18); ctx.globalAlpha = 1; if (finT > 90) hint('按 R 再来一次'); requestAnimationFrame(tick); return }

  // —— 连续世界 ——
  ctx.fillStyle = '#14100a'; ctx.fillRect(0, 0, W, H)
  tileBg(camX * 0.5)
  ctx.fillStyle = 'rgba(12,9,5,.3)'; ctx.fillRect(0, floorY(), W, H - floorY())
  const ni = nextIdx()
  for (let i = 0; i < STATIONS.length; i++) { const s = STATIONS[i]!, sx = s.x - camX; if (sx > -180 && sx < W + 180) facade(s, sx, i === ni) }
  const cxs = CORE_X - camX; if (cxs > -140 && cxs < W + 140) { const lit = allDone(); ctx.strokeStyle = lit ? TEAL : '#5a4e3a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cxs, floorY() - 80, 44, 0, 7); ctx.stroke(); ctx.fillStyle = lit ? `rgba(73,167,145,${.3 + .2 * Math.sin(t * 4)})` : 'rgba(30,26,18,.6)'; ctx.beginPath(); ctx.arc(cxs, floorY() - 80, 38, 0, 7); ctx.fill(); for (let i = 0; i < 3; i++) { ctx.fillStyle = STATIONS[i]!.done ? '#ffd27a' : '#332a1e'; ctx.beginPath(); ctx.arc(cxs - 20 + i * 20, floorY() - 20, 6, 0, 7); ctx.fill() } if (lit && Math.abs(px - CORE_X) < 160) { ctx.fillStyle = CREAM; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('按 E 重启核心', cxs, floorY() - 150) } }
  if (zoom < 0.6) { ctx.globalAlpha = Math.max(0, 1 - zoom * 1.6); drawBot(px - camX, floorY() + bob, 120, face); ctx.globalAlpha = 1 }

  // —— 操作:镜头框住机器 ——
  if (zoom > 0.02 && activeIdx >= 0) {
    ctx.fillStyle = `rgba(9,7,4,${zoom * 0.74})`; ctx.fillRect(0, 0, W, H)
    const fr = framed(), ez = zoom, s = STATIONS[activeIdx]!
    const sf = { x: s.x - camX - 130, y: floorY() - 208, w: 260, h: 200 }
    const r = { x: sf.x + (fr.x - sf.x) * ez, y: sf.y + (fr.y - sf.y) * ez, w: sf.w + (fr.w - sf.w) * ez, h: sf.h + (fr.h - sf.h) * ez }
    if (mode === 'operate' && zoom > 0.9) s.machine.update(true)
    s.machine.render(r)
    drawBot(r.x + 44, r.y + r.h + 22, 92, 1)
    if (mode === 'operate') { if (winHold >= 0) { winHold++; if (winHold > 70) leave(true) } else if (s.machine.state === 'win') winHold = 0 }
    if (mode === 'operate' && zoom > 0.9) { ctx.fillStyle = AMBER; ctx.font = '13px system-ui'; ctx.textAlign = 'right'; ctx.fillText('按 Q 走开', W - 20, H - 16) }
  }

  if (mode === 'walk') { bubbleBox(); hint(allDone() ? '← → / A D 走路   ·   走到核心按 E 重启' : '← → / A D 走路   ·   走到发亮的机器按 E') }
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

// dev 钩子
;(window as unknown as { __world: () => object }).__world = () => ({ mode, zoom: +zoom.toFixed(2), px: Math.round(px), stations: STATIONS.map(s => s.done), active: nextIdx(), activeIdx })
;(window as unknown as { __walkTo: (x: number) => void }).__walkTo = (x) => { px = x }
;(window as unknown as { __enter: () => void }).__enter = () => { if (mode === 'walk') enter(nextIdx()) }
;(window as unknown as { __forceSolve: () => void }).__forceSolve = () => { if (mode === 'operate') leave(true) }
;(window as unknown as { __toCore: () => void }).__toCore = () => { if (mode === 'walk' && allDone()) toFinale() }
;(window as unknown as { __am: () => CacheMachine | ShaftMachine | PoisonMachine }).__am = () => STATIONS[activeIdx]!.machine
