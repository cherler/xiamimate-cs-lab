/**
 * 灰盒「2」:长厂房探索 · RPG 玩家视角(镜头跟修理机、侧视卷动)+ 进机器维修闭环。
 * 巡线(← → / A D 走)→ 靠近坏机器按 E 进入 → 修好 → 出来那台变「已修」→ 下一台。DNS 用真维修(DnsRepair 类,接真 DnsSim);
 * TCP/IP 暂用占位维修(点一下算修好),先把闭环跑通。真美术:厂房背景 + 机器 sprite + 修理机小人(生图 API)。
 */
import { DnsRepair } from './repair.ts'
import bgUrl from '../../web/assets/gen/dns/bg-hall.webp'
import dnsUrl from '../../web/assets/gen/dns/mach-dns.webp'
import tcpUrl from '../../web/assets/gen/dns/mach-tcp.webp'
import ipUrl from '../../web/assets/gen/dns/mach-ip.webp'
import droneUrl from '../../web/assets/gen/dns/drone.webp'

const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()
const img = (u: string) => { const i = new Image(); i.src = u; return i }
const IMG = { bg: img(bgUrl), dns: img(dnsUrl), tcp: img(tcpUrl), ip: img(ipUrl), drone: img(droneUrl) }

const WORLD = 5200
type Mach = { id: string; im: HTMLImageElement; x: number; label: string; broken: boolean }
const machines: Mach[] = [
  { id: 'dns', im: IMG.dns, x: 900, label: 'DNS 查名机', broken: true },
  { id: 'tcp', im: IMG.tcp, x: 2500, label: 'TCP 握手站', broken: true },
  { id: 'ip', im: IMG.ip, x: 4100, label: 'IP 分拣岔道', broken: true },
]
const drone = { x: 320, face: 1, vx: 0 }
let cam = 0, t = 0, entered: Mach | null = null, repair: DnsRepair | null = null, walkTo: number | null = null
const keys: Record<string, boolean> = {}
addEventListener('keydown', e => {
  keys[e.key] = true
  if ((e.key === 'e' || e.key === 'E' || e.key === ' ') && near() && !entered) enter(near()!)
  if (e.key === 'Escape' && entered) exit()
})
addEventListener('keyup', e => { keys[e.key] = false })
cv.addEventListener('pointerdown', e => {
  if (entered) {
    if (repair) { if (repair.won) exit(); else repair.pointerdown(e.clientX, e.clientY, W, H) }
    else exit(true) // 占位维修:点一下=修好
    return
  }
  const worldX = e.clientX + cam
  const m = machines.find(mm => Math.abs(mm.x - worldX) < 170 && mm.broken)
  if (m && Math.abs(m.x - drone.x) < 240) { enter(m); return }
  walkTo = Math.max(80, Math.min(WORLD - 80, worldX))
})
function enter(m: Mach) { entered = m; repair = m.id === 'dns' ? new DnsRepair() : null; walkTo = null }
function exit(fixNow = false) { if (entered && (fixNow || (repair && repair.won))) entered.broken = false; entered = null; repair = null }
function floorY() { return H * 0.80 }
function near(): Mach | null { return machines.find(m => Math.abs(m.x - drone.x) < 210 && m.broken) ?? null }
function drawImgBottom(im: HTMLImageElement, cx: number, bottomY: number, targetH: number) { if (!im.complete || !im.naturalWidth) return; const s = targetH / im.naturalHeight, w = im.naturalWidth * s; ctx.drawImage(im, cx - w / 2, bottomY - targetH, w, targetH) }

function frame() {
  t += 1 / 60
  if (!entered) {
    let vx = 0
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) vx = -1
    if (keys['ArrowRight'] || keys['d'] || keys['D']) vx = 1
    if (vx !== 0) walkTo = null
    if (walkTo !== null) { const d = walkTo - drone.x; vx = Math.abs(d) < 6 ? 0 : Math.sign(d); if (vx === 0) walkTo = null }
    drone.vx += (vx * 5.2 - drone.vx) * 0.2
    drone.x = Math.max(80, Math.min(WORLD - 80, drone.x + drone.vx))
    if (vx !== 0) drone.face = vx
    cam += ((Math.max(0, Math.min(WORLD - W, drone.x - W * 0.42))) - cam) * 0.12
  }

  // 背景(视差 + 镜像平铺消缝)
  const bh = H, bw = IMG.bg.naturalWidth ? IMG.bg.naturalWidth * (bh / IMG.bg.naturalHeight) : W
  if (IMG.bg.complete && bw) { const shift = cam * 0.55, i0 = Math.floor((shift - bw) / bw); for (let i = i0; i * bw - shift < W + bw; i++) { const x = i * bw - shift; ctx.save(); if (((i % 2) + 2) % 2 === 1) { ctx.translate(x + bw, 0); ctx.scale(-1, 1); ctx.drawImage(IMG.bg, 0, 0, bw, bh) } else ctx.drawImage(IMG.bg, x, 0, bw, bh); ctx.restore() } }
  else { ctx.fillStyle = '#e9dcc2'; ctx.fillRect(0, 0, W, H) }
  const gg = ctx.createLinearGradient(0, floorY() - 30, 0, H); gg.addColorStop(0, 'rgba(20,16,10,0)'); gg.addColorStop(1, 'rgba(20,16,10,.35)'); ctx.fillStyle = gg; ctx.fillRect(0, floorY() - 30, W, H - floorY() + 30)

  const fy = floorY(), mH = Math.min(H * 0.52, 360)
  for (const m of machines) {
    const sx = m.x - cam; if (sx < -420 || sx > W + 420) continue
    if (m.broken) {
      ctx.save(); ctx.translate((Math.random() - .5) * 1.5, 0); drawImgBottom(m.im, sx, fy + 26, mH); ctx.restore()
      for (let i = 0; i < 2; i++) { const a = t * 6 + i * 3; ctx.globalAlpha = .5 + Math.sin(a) * .5; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * 30, fy + 26 - mH * .5 + Math.sin(a * 1.3) * 24, 3, 0, 7); ctx.fill() } ctx.globalAlpha = 1
      ctx.save(); ctx.translate(sx, fy - mH - 6 + Math.sin(t * 3) * 4); ctx.fillStyle = '#e0685e'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 1); ctx.restore()
    } else {
      drawImgBottom(m.im, sx, fy + 26, mH)
      ctx.save(); ctx.translate(sx, fy - mH - 6 + Math.sin(t * 2) * 3); ctx.fillStyle = '#49a791'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✓', 0, 1); ctx.restore()
    }
    ctx.fillStyle = 'rgba(20,16,10,.62)'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const tw = ctx.measureText(m.label).width + 20; ctx.beginPath(); ctx.roundRect(sx - tw / 2, fy + 34, tw, 24, 12); ctx.fill(); ctx.fillStyle = m.broken ? '#ffbfae' : '#9fe8b8'; ctx.fillText(m.label + (m.broken ? ' · 坏了' : ' · 已修'), sx, fy + 46)
  }

  { const dx = drone.x - cam, dy = fy + 6 + Math.sin(t * 4) * 5, dH = Math.min(H * 0.16, 120)
    ctx.globalAlpha = .18; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(dx, fy + 8, dH * .3, 7, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1
    ctx.save(); ctx.translate(dx, 0); if (drone.face < 0) ctx.scale(-1, 1); drawImgBottom(IMG.drone, 0, dy, dH); ctx.restore() }

  const nb = near()
  if (nb && !entered) { const sx = nb.x - cam; ctx.fillStyle = 'rgba(20,16,10,.8)'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const txt = '按 E / 点它 · 进入维修'; const tw = ctx.measureText(txt).width + 26; ctx.beginPath(); ctx.roundRect(sx - tw / 2, fy - mH - 44, tw, 30, 15); ctx.fill(); ctx.fillStyle = '#ffe6b0'; ctx.fillText(txt, sx, fy - mH - 29) }

  const allFixed = machines.every(m => !m.broken)
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(0, 0, W, 40)
  ctx.fillStyle = '#f1e7d3'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('虾米厂 · 修理机巡线', 20, 20)
  ctx.textAlign = 'right'; ctx.fillStyle = '#a99c87'; ctx.font = '13px system-ui'; ctx.fillText(allFixed ? '全线修好了!🎉' : '← → / A D 走路 · 靠近机器按 E 进入 · 三台都坏了,挨个修', W - 20, 20)
  { const mw = Math.min(320, W - 40), mx = W / 2 - mw / 2, my = H - 26; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(mx, my, mw, 10, 5); ctx.fill()
    for (const m of machines) { ctx.fillStyle = m.broken ? '#e0685e' : '#49a791'; const px = mx + mw * (m.x / WORLD); ctx.beginPath(); ctx.arc(px, my + 5, 5, 0, 7); ctx.fill() }
    ctx.fillStyle = '#ffe6b0'; ctx.beginPath(); ctx.arc(mx + mw * (drone.x / WORLD), my + 5, 4, 0, 7); ctx.fill() }

  // 进入维修
  if (entered) {
    if (repair) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(20,16,10,.94)'); g.addColorStop(1, 'rgba(12,9,6,.97)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      repair.update(); repair.render(ctx, W, H)
      if (repair.won && entered.broken) entered.broken = false
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#f1e7d3'; ctx.font = 'bold 16px system-ui'; ctx.fillText(`🛠️ 维修:${entered.label}`, W / 2, 24)
      if (repair.won) { ctx.fillStyle = '#9fe8b8'; ctx.font = 'bold 26px system-ui'; ctx.fillText('✅ 修好了!点击 / Esc 返回巡线', W / 2, H * 0.5) }
      else { ctx.fillStyle = '#c9bfae'; ctx.font = '13px system-ui'; ctx.fillText('Esc 返回(没修好会保持坏)', W / 2, 44) }
    } else {
      ctx.fillStyle = 'rgba(18,14,9,.86)'; ctx.fillRect(0, 0, W, H)
      drawImgBottom(entered.im, W / 2, H * 0.68, Math.min(H * 0.5, 420))
      ctx.fillStyle = '#f1e7d3'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`🛠️ 进入「${entered.label}」维修`, W / 2, H * 0.2)
      ctx.fillStyle = '#c9bfae'; ctx.font = '15px system-ui'; ctx.fillText('(这台的专属谜题还没做)· 点任意处「先修好」返回巡线', W / 2, H * 0.2 + 30)
    }
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

;(window as unknown as { __state: () => object }).__state = () => ({ droneX: Math.round(drone.x), cam: Math.round(cam), near: near()?.id ?? null, entered: entered?.id ?? null, repair: repair ? repair.snapshot() : null, machines: machines.map(m => ({ id: m.id, broken: m.broken })) })
;(window as unknown as { __walk: (x: number) => void }).__walk = (x) => { walkTo = x }
;(window as unknown as { __teleport: (x: number) => void }).__teleport = (x) => { drone.x = Math.max(80, Math.min(WORLD - 80, x)); walkTo = null }
;(window as unknown as { __enter: () => void }).__enter = () => { const n = near(); if (n) enter(n) }
;(window as unknown as { __repair: (t: string, p: string) => void }).__repair = (tl, p) => { if (repair) repair.op(tl, p, W, H) }
;(window as unknown as { __exit: () => void }).__exit = () => exit()
