/**
 * 诊断卡牌 demo · 暖色修理小屋(场景层 + 多回合对战 · 整屋通用)。
 * 入口 = 房子横切面,电器待在各自房间;点它 → zoom 进内部副本场景,打一场**多回合诊断对战**:
 *   探针取证 → 推断 → 对症处置,故障每回合主动反扑(蔓延/次生),时钟(变质/断网)施压。
 * 冰箱走热力学、路由器走 DNS,同一套回合制外壳(Duel 接口)复用。
 * 助手「小修」接真 MiniMax:先即时列全手牌作用,再叠加"读证据→下一步方法→病因方向"(不给答案)。
 * 症状/读数/成败全由真求解器判(守铁律"仿真是核心")。
 */
import { ThermalDuel } from './thermal-duel.ts'
import { DnsDuel } from './dns-duel.ts'
import { Saboteur, ATTACK_POOL } from './saboteur.ts'
import { StackBattle, LAYERS as STK_LAYERS } from './stack.ts'
import { Combat, makeWaves, type Domain } from './combat.ts'
import { NET } from './combat-net.ts'
import { FRIDGE } from './combat-fridge.ts'
import type { Duel, DuelCard } from './duel.ts'
import { NO_MODS } from './duel.ts'
import { startRun, currentNode, runMods, onWin, onLose, advance, rewardChoices, takeTool, buyTool, TOOLS, ALL_TOOLS, type RunState, type ToolId } from './run.ts'
import { askDuel, interpretReadings } from './assistant.ts'
import houseUrl from '../../web/assets/gen/home/house-cutaway.webp'
import guluUrl from '../../web/assets/gen/home/gulu.webp'
import fridgeUrl from '../../web/assets/gen/home/fridge.webp'
import routerUrl from '../../web/assets/gen/home/router.webp'
import sceneFridgeUrl from '../../web/assets/gen/home/instance-fridge.webp'
import sceneRouterUrl from '../../web/assets/gen/home/instance-router.webp'
import gremlinUrl from '../../web/assets/gen/home/gremlin.webp'

const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()

const img = (u: string) => { const i = new Image(); i.src = u; return i }
const IMG = {
  house: img(houseUrl), gulu: img(guluUrl), gremlin: img(gremlinUrl),
  router: img(routerUrl), fridge: img(fridgeUrl),
  sceneRouter: img(sceneRouterUrl), sceneFridge: img(sceneFridgeUrl),
}
// 卡面图标:按文件名(=卡 id)建映射,不用逐个 import
const ICON_URLS = import.meta.glob('../../web/assets/gen/home/cards/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const CARD_ICON: Record<string, HTMLImageElement> = {}
for (const [p, url] of Object.entries(ICON_URLS)) { const id = p.split('/').pop()!.replace('.webp', ''); CARD_ICON[id] = img(url) }
// 少数卡复用已有图标
const DUEL_ICON: Record<string, string> = { wait: 'raise-timeout', 'edit-hosts': 'fix-hosts' }
// 对战卡图标:新图按卡 id 命名(c-forge.webp…)自动载入;能复用的老图标走别名
const CMB_ICON_ALIAS: Record<string, string> = { 'c-poison': 'clear-cache', 'c-hijack': 'switch-dns', 'f-setpoint': 'colder-set', 'f-refill': 'refill', 'f-rest': 'rest-compressor', 'f-coils': 'clean-coils', 'f-gasket': 'fix-seal' }
const cmbIcon = (type: string): HTMLImageElement | undefined => CARD_ICON[type] ?? CARD_ICON[CMB_ICON_ALIAS[type] ?? '']
const KIND = { probe: { tag: '🔍 探针', col: '#4FB6A3' }, fix: { tag: '🔧 处置', col: '#E0954B' }, wait: { tag: '⏳ 等待', col: '#9a8f7a' } }

// 调色板(暖色绘本)
const CREAM = '#F4ECDA', WOOD = '#B98A5A', TERRA = '#E0954B', DARK = '#3a2e22', CORAL = '#EE6C5A', GREEN = '#7Fb56b'

type Spot = { id: string; room: string; name: string; problem: string; avatar: HTMLImageElement; scene: HTMLImageElement; anchor: { x: number; y: number } }
const APPLIANCES: Spot[] = [
  { id: 'router', room: '书房', name: '路由器', problem: '网页打不开', avatar: IMG.router, scene: IMG.sceneRouter, anchor: { x: 0.14, y: 0.35 } },
  { id: 'fridge', room: '厨房', name: '冰箱', problem: '不制冷', avatar: IMG.fridge, scene: IMG.sceneFridge, anchor: { x: 0.735, y: 0.70 } },
]
type View = 'house' | 'map' | 'duel' | 'shop' | 'sab' | 'stk' | 'cmb'
let view: View = 'house'
let duel: Duel | null = null
let sab: Saboteur | null = null         // 捣蛋鬼对战(DNS 骨架版)
let stk: StackBattle | null = null      // 捣蛋鬼跨层对战(合体版)
let cmb: Combat | null = null           // 当前这一仗(领域引擎:网络/冰箱通用)
let armedCard: number | null = null     // 已选中、待点某层施加的手牌下标
// 一个「副本」= 弧线三关:小怪波 → 精英 → Boss(捣蛋鬼一回合连打多层),中间三选一收牌构筑
type Dungeon = { dom: Domain; deck: string[]; stage: number; reward: string[] | null; cleared: boolean }
let dg: Dungeon | null = null
const STAGES: { kind: 'trash' | 'elite' | 'boss'; label: string; sub: string }[] = [
  { kind: 'trash', label: '第 1 关 · 小怪波', sub: '几个小捣蛋,单张单招' },
  { kind: 'elite', label: '第 2 关 · 精英捣蛋鬼', sub: '偶尔一回合连打两层' },
  { kind: 'boss', label: 'BOSS · 大捣蛋鬼', sub: '一回合连打多层,末招三连' },
]
let cur: Spot = APPLIANCES[0]!
let run: RunState | null = null        // 跑图中的一局(自由练习时为 null)
let reward: ToolId[] | null = null     // 修好后待选的三件工具
let toast = '', toastT = 0
let xiuText = '', xiuLoading = false, xiuOpen = false
let intro = 0, flash = 0, shake = 0
let spark: { x: number; y: number; vx: number; vy: number; life: number }[] = []
let mouse = { x: -1, y: -1 }
let t = 0

function seed() { return Math.floor(Math.random() * 100000) }
// 自由练习:从横切面点电器,单副本、无 run(裸装)
function enter(a: Spot) { cur = a; run = null; duel = a.id === 'fridge' ? new ThermalDuel(seed(), NO_MODS, 1) : new DnsDuel(seed(), NO_MODS, 1); view = 'duel'; intro = 1; xiuLoading = false; xiuOpen = false; xiuText = '' }
function back() { view = run ? 'map' : 'house'; duel = null; xiuOpen = false }

// —— 跑图流程 ——
function startRunFlow() { run = startRun(); reward = null; toast = ''; view = 'map' }
function enterNode() {
  if (!run || run.over || reward) return
  const node = currentNode(run)
  if (node.type === 'shop') { view = 'shop'; return }
  cur = APPLIANCES.find(a => a.id === node.appliance) ?? APPLIANCES[0]!
  duel = node.appliance === 'fridge'
    ? new ThermalDuel(node.type === 'boss' ? ['coils', 'seal'] : seed(), runMods(run), node.hardMul) // Boss 冰箱=双故障
    : new DnsDuel(seed(), runMods(run), node.hardMul)
  view = 'duel'; intro = 1; xiuOpen = false; xiuText = ''; xiuLoading = false
}
function resolveDuel() {
  if (!run || !duel) { back(); return }
  if (duel.won) { onWin(run); reward = run.over ? null : rewardChoices(run) }
  else { onLose(run); toast = '修砸了 · 口碑 −1'; toastT = 3; if (!run.over) advance(run) }
  duel = null; view = 'map'
}
function pickReward(id: ToolId) { if (!run) return; takeTool(run, id); reward = null; advance(run) }
function useFirstaid() { if (run && duel && run.firstaid > 0 && !duel.won && !duel.lost) { duel.easeClock(40); run.firstaid-- } }

// —— 捣蛋鬼对战 ——
function startSab() { const seq = Array.from({ length: 3 }, () => ATTACK_POOL[Math.floor(Math.random() * ATTACK_POOL.length)]!); sab = new Saboteur(seq); run = null; view = 'sab'; intro = 1 }
function sabPlay(cardId: string) {
  if (!sab || sab.won || sab.lost) return
  const v = sab.play(cardId); flash = 1
  if (v.won) { for (let i = 0; i < 44; i++) spark.push({ x: W / 2, y: H * 0.4, vx: (Math.random() - .5) * 340, vy: -70 - Math.random() * 280, life: 1 }) }
  else if (v.events.some(e => e.includes('拆错') || e.includes('又出手'))) shake = 13
}
// 捣蛋鬼跨层对战(合体版)
function startStk() { const seq = Array.from({ length: 3 }, () => STK_LAYERS[Math.floor(Math.random() * STK_LAYERS.length)]!); stk = new StackBattle(seq); run = null; view = 'stk'; intro = 1 }
function stkPlay(cardId: string) {
  if (!stk || stk.won || stk.lost) return
  const v = stk.play(cardId); flash = 1
  if (v.won) { for (let i = 0; i < 44; i++) spark.push({ x: W / 2, y: H * 0.4, vx: (Math.random() - .5) * 340, vy: -70 - Math.random() * 280, life: 1 }) }
  else if (v.events.some(e => e.includes('白折腾') || e.includes('又往'))) shake = 13
}
// 捣蛋鬼副本(领域引擎 + 弧线三关 + Boss 连打 + 关键词)
function startDungeon(dom: Domain) { dg = { dom, deck: [...dom.startDeck], stage: 0, reward: null, cleared: false }; startStage() }
function startStage() {
  if (!dg) return
  const s = STAGES[dg.stage]!
  const waves = makeWaves(dg.dom, s.kind, n => Math.floor(Math.random() * n))
  const deck = [...dg.deck].sort(() => Math.random() - 0.5)
  cmb = new Combat(dg.dom, deck, waves); armedCard = null; run = null; view = 'cmb'; intro = 1
}
function cmbSpark() { for (let i = 0; i < 44; i++) spark.push({ x: W / 2, y: H * 0.4, vx: (Math.random() - .5) * 340, vy: -70 - Math.random() * 280, life: 1 }) }
function onCmbWin() {
  if (!dg) return
  cmbSpark()
  if (dg.stage >= STAGES.length - 1) { dg.cleared = true } // 打完 Boss = 副本通关
  else dg.reward = [...dg.dom.rewardPool].sort(() => Math.random() - 0.5).slice(0, 3) // 过一关 → 三选一收牌
}
function cmbPickCard(i: number) {
  if (!cmb || cmb.won || cmb.lost) return
  const card = cmb.view().hand[i]; if (!card || !card.playable) return
  if (!card.targeted) { const v = cmb.play(i); armedCard = null; flash = 1; if (v.won) onCmbWin() }
  else armedCard = armedCard === i ? null : i
}
function cmbTarget(l: string) {
  if (!cmb || armedCard === null || !cmb.canPlay(armedCard, l)) return
  const v = cmb.play(armedCard, l); armedCard = null; flash = 1; if (v.won) onCmbWin()
}
function cmbEnd() {
  if (!cmb || cmb.won || cmb.lost) return
  const v = cmb.endTurn(); armedCard = null; flash = 1
  if (v.won) onCmbWin(); else if (!v.connected) shake = v.boss ? 16 : 10
}
function cmbPickReward(type: string) { if (!dg) return; dg.deck.push(type); dg.reward = null; dg.stage++; startStage() }
function duelPlay(cardId: string) {
  if (!duel || duel.won || duel.lost) return
  duel.play(cardId); const v = duel.view(); flash = 1
  if (v.won || v.lost) xiuOpen = false
  if (v.won) { for (let i = 0; i < 44; i++) spark.push({ x: W / 2, y: H * 0.4, vx: (Math.random() - .5) * 340, vy: -70 - Math.random() * 280, life: 1 }) }
  else if (v.events.some(e => e.includes('⚡') || e.includes('还是') || e.includes('白费'))) shake = 15
}
function askXiu() {
  if (!duel) return
  const v = duel.view(), cards = duel.hand()
  xiuOpen = true
  xiuText = interpretReadings(v.readings) // 先给最要紧的:大白话读数解读(即时、可靠、不靠网)
  if (xiuLoading) return
  xiuLoading = true
  const known = v.readings.filter(r => r.value !== null).map(r => `${r.label} ${r.value}${r.ref ? `(${r.ref})` : ''}${r.off ? ' ⚠偏离' : ' 正常'}`)
  const state = `${v.statusValue}、${v.clockLabel} ${v.clock}%、第 ${v.turn} 回合`
  askDuel({ appliance: cur.name, state, known, hand: cards }).then(x => { xiuText = interpretReadings(v.readings) + '\n\n— 小修再叨叨两句 —\n' + x }).finally(() => { xiuLoading = false })
}

// —— canvas 小工具 ——
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function rr(x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
function wrap(s: string, cx: number, cy: number, maxw: number, lh: number) { let line = ''; const ls: string[] = []; for (const ch of s) { if (ctx.measureText(line + ch).width > maxw && line) { ls.push(line); line = ch } else line += ch } ls.push(line); ls.forEach((l, i) => ctx.fillText(l, cx, cy + i * lh)); return ls.length }
function bubble(cx: number, cy: number, w: number, text: string, tint: string) {
  ctx.font = '14px sans-serif'
  const lines = Math.max(1, Math.ceil(ctx.measureText(text).width / (w - 36)))
  const h = 22 + lines * 20
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4
  ctx.fillStyle = '#fffaf0'; rr(cx - w / 2, cy - h, w, h, 16); ctx.fill(); ctx.restore()
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 2); ctx.lineTo(cx + 12, cy - 2); ctx.lineTo(cx, cy + 13); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = tint; ctx.lineWidth = 2.5; rr(cx - w / 2, cy - h, w, h, 16); ctx.stroke()
  ctx.fillStyle = DARK; ctx.textAlign = 'center'; wrap(text, cx, cy - h + 26, w - 36, 20)
}

let hot: { x: number; y: number; w: number; h: number; fn: () => void }[] = []
const btn = (x: number, y: number, w: number, h: number, fn: () => void) => hot.push({ x, y, w, h, fn })
const inRect = (b: { x: number; y: number; w: number; h: number }) => mouse.x > b.x && mouse.x < b.x + b.w && mouse.y > b.y && mouse.y < b.y + b.h
cv.addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY } })
cv.addEventListener('pointerdown', e => { for (const b of hot) if (e.clientX > b.x && e.clientX < b.x + b.w && e.clientY > b.y && e.clientY < b.y + b.h) { b.fn(); return } })

function drawImgFit(im: HTMLImageElement, cx: number, cy: number, maxW: number, maxH: number) {
  if (!im.complete || !im.naturalWidth) return
  const s = Math.min(maxW / im.naturalWidth, maxH / im.naturalHeight)
  ctx.drawImage(im, cx - im.naturalWidth * s / 2, cy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s)
}
function drawContain(im: HTMLImageElement) { const s = Math.min(W / im.naturalWidth, H / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s, dx = (W - dw) / 2, dy = (H - dh) / 2; ctx.drawImage(im, dx, dy, dw, dh); return { dx, dy, dw, dh } }
function drawCover(im: HTMLImageElement, scale = 1) { if (!im.complete || !im.naturalWidth) { ctx.fillStyle = '#20242E'; ctx.fillRect(0, 0, W, H); return } const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * scale, dw = im.naturalWidth * s, dh = im.naturalHeight * s; ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh) }

function houseView() {
  ctx.fillStyle = '#e9dcc2'; ctx.fillRect(0, 0, W, H)
  const r = IMG.house.complete && IMG.house.naturalWidth ? drawContain(IMG.house) : { dx: 0, dy: 0, dw: W, dh: H }
  ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'
  const tt = '虾米家 · 挑一台坏了的电器,钻进去修', tw = ctx.measureText(tt).width, ty = r.dy + 44
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3
  ctx.fillStyle = 'rgba(244,236,218,.95)'; rr(W / 2 - tw / 2 - 22, ty - 27, tw + 44, 40, 20); ctx.fill(); ctx.restore()
  ctx.fillStyle = '#4a3b2a'; ctx.fillText(tt, W / 2, ty)
  APPLIANCES.forEach((a, i) => {
    const sx = r.dx + a.anchor.x * r.dw, sy = r.dy + a.anchor.y * r.dh
    const bob = Math.sin(t * 2 + i) * 3
    const cw = 208, ch = 60, cx = clamp(sx, cw / 2 + 10, W - cw / 2 - 10), cyTop = sy - 104 + bob
    const b = { x: cx - cw / 2, y: cyTop, w: cw, h: ch }, hov = inRect(b), lift = hov ? -4 : 0
    const pr = 15 + Math.sin(t * 3 + i) * 3 + (hov ? 6 : 0)
    ctx.strokeStyle = CORAL; ctx.lineWidth = 3; ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(sx, sy, pr, 0, 7); ctx.stroke()
    ctx.globalAlpha = .35; ctx.beginPath(); ctx.arc(sx, sy, pr + 8, 0, 7); ctx.stroke(); ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(74,59,42,.55)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx, b.y + ch + lift); ctx.lineTo(sx, sy - pr); ctx.stroke(); ctx.setLineDash([])
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = hov ? 18 : 10; ctx.shadowOffsetY = 5
    ctx.fillStyle = CREAM; rr(b.x, b.y + lift, cw, ch, 14); ctx.fill(); ctx.restore()
    ctx.strokeStyle = hov ? TERRA : WOOD; ctx.lineWidth = 2.5; rr(b.x, b.y + lift, cw, ch, 14); ctx.stroke()
    drawImgFit(a.avatar, b.x + 34, b.y + ch / 2 + lift, 50, 50)
    ctx.textAlign = 'left'; ctx.fillStyle = DARK; ctx.font = 'bold 17px sans-serif'; ctx.fillText(`${a.room} · ${a.name}`, b.x + 66, b.y + 26 + lift)
    ctx.fillStyle = CORAL; ctx.font = '13px sans-serif'; ctx.fillText('⚠ ' + a.problem, b.x + 66, b.y + 46 + lift)
    btn(b.x, b.y + lift, cw, ch, () => enter(a))
  })
  // 开始跑图(肉鸽一局) + 捣蛋鬼对战(试)
  // 三个入口:跑图诊断 / 路由器捣蛋鬼副本 / 冰箱捣蛋鬼副本(后两者=弧线三关卡牌对战)
  const bw3 = 236, bg3 = 16, bx0 = W / 2 - (bw3 * 3 + bg3 * 2) / 2, by3 = H - 66
  { const b = { x: bx0, y: by3, w: bw3, h: 44 }, hov = inRect(b); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3; ctx.fillStyle = hov ? '#f0a85e' : TERRA; rr(b.x, b.y, b.w, b.h, 22); ctx.fill(); ctx.restore(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▶ 跑一局(诊断)', b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, startRunFlow) }
  { const b = { x: bx0 + bw3 + bg3, y: by3, w: bw3, h: 44 }, hov = inRect(b); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3; ctx.fillStyle = hov ? '#9a6cc8' : '#7B4F9E'; rr(b.x, b.y, b.w, b.h, 22); ctx.fill(); ctx.restore(); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('😈 路由器副本', b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, () => startDungeon(NET)) }
  { const b = { x: bx0 + (bw3 + bg3) * 2, y: by3, w: bw3, h: 44 }, hov = inRect(b); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3; ctx.fillStyle = hov ? '#4f9ec0' : '#3E7DA0'; rr(b.x, b.y, b.w, b.h, 22); ctx.fill(); ctx.restore(); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🧊 冰箱副本', b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, () => startDungeon(FRIDGE)) }
  ctx.fillStyle = '#6b5a44'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('捣蛋鬼副本 = 小怪波→精英→Boss 三关卡牌对战(见招拆招、攒牌构筑) · 或跑图诊断 · 或点电器单练', W / 2, H - 8)
}

const NODE_EMOJI: Record<string, string> = { repair: '🔧', shop: '🏪', elite: '👑', boss: '🚨' }
function drawRunHud(r: RunState) {
  ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5
  ctx.fillStyle = CORAL; ctx.font = 'bold 18px sans-serif'; ctx.fillText('口碑 ' + ('❤'.repeat(Math.max(0, r.rep)) || '—'), 24, 34)
  ctx.fillStyle = '#ffd98a'; ctx.fillText('💰 ' + r.money, 210, 34)
  ctx.fillStyle = '#e6dcc8'; ctx.font = '14px sans-serif'
  const tools = r.tools.map(id => TOOLS[id].name).join(' · ') + (r.firstaid ? `  🩹×${r.firstaid}` : '')
  ctx.fillText('🧰 ' + (tools.trim() || '还没工具'), 300, 33); ctx.restore()
}
function toolRow(id: ToolId, x: number, y: number, w: number, showPrice: boolean, owned: boolean, fn: () => void) {
  const h = 62, b = { x, y, w, h }, hov = !owned && inRect(b)
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = hov ? 16 : 8; ctx.shadowOffsetY = 3
  ctx.globalAlpha = owned ? 0.5 : 1; ctx.fillStyle = CREAM; rr(x, y, w, h, 12); ctx.fill(); ctx.restore()
  ctx.globalAlpha = owned ? 0.5 : 1; ctx.strokeStyle = hov ? TERRA : WOOD; ctx.lineWidth = 2.4; rr(x, y, w, h, 12); ctx.stroke()
  ctx.textAlign = 'left'; ctx.fillStyle = DARK; ctx.font = 'bold 15px sans-serif'; ctx.fillText(TOOLS[id].name, x + 16, y + 24)
  ctx.fillStyle = '#8a7a5a'; ctx.font = '12px sans-serif'; wrapLeft(TOOLS[id].desc, x + 16, y + 44, w - 90)
  ctx.textAlign = 'right'
  if (owned) { ctx.fillStyle = '#9a8f7a'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('已有', x + w - 16, y + 36) }
  else if (showPrice) { ctx.fillStyle = TERRA; ctx.font = 'bold 15px sans-serif'; ctx.fillText('💰' + TOOLS[id].price, x + w - 16, y + 36) }
  else { ctx.fillStyle = TERRA; ctx.font = 'bold 15px sans-serif'; ctx.fillText('选 →', x + w - 16, y + 36) }
  ctx.globalAlpha = 1
  if (!owned) btn(x, y, w, h, fn)
}
function wrapLeft(s: string, x: number, y: number, maxw: number) { let line = '', yy = y; for (const ch of s) { if (ctx.measureText(line + ch).width > maxw && line) { ctx.fillText(line, x, yy); yy += 15; line = ch } else line += ch } ctx.fillText(line, x, yy) }

function mapView() {
  if (!run) { view = 'house'; return }
  if (IMG.house.complete && IMG.house.naturalWidth) drawContain(IMG.house); else { ctx.fillStyle = '#e9dcc2'; ctx.fillRect(0, 0, W, H) }
  ctx.fillStyle = 'rgba(20,16,10,0.52)'; ctx.fillRect(0, 0, W, H)
  drawRunHud(run)
  { const b = { x: W - 104, y: 18, w: 84, h: 32 }; ctx.fillStyle = inRect(b) ? '#3a4636' : 'rgba(42,50,66,.85)'; ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('← 回家', b.x + b.w / 2, b.y + 21); btn(b.x, b.y, b.w, b.h, () => { run = null; view = 'house' }) }
  ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6; ctx.fillText('今天的活儿 · 路线', W / 2, 76); ctx.restore()

  const nodes = run.map, n = nodes.length, gapW = Math.min(280, (W - 260) / (n - 1)), x0 = W / 2 - gapW * (n - 1) / 2, y = H * 0.46
  for (let i = 0; i < n - 1; i++) { ctx.strokeStyle = i < run.pos ? GREEN : 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; if (i >= run.pos) ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(x0 + i * gapW + 40, y); ctx.lineTo(x0 + (i + 1) * gapW - 40, y); ctx.stroke(); ctx.setLineDash([]) }
  nodes.forEach((node, i) => {
    const x = x0 + i * gapW, done = i < run!.pos, curN = i === run!.pos
    const rad = curN ? 40 : 34
    if (curN && !reward && !run!.over) { const pr = rad + 6 + Math.sin(t * 3) * 3; ctx.strokeStyle = TERRA; ctx.lineWidth = 3; ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(x, y, pr, 0, 7); ctx.stroke(); ctx.globalAlpha = 1 }
    ctx.fillStyle = done ? '#6b8f5a' : curN ? CREAM : 'rgba(90,83,70,.85)'; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill()
    ctx.strokeStyle = node.type === 'boss' ? '#c0392b' : node.type === 'elite' ? '#b06a2c' : WOOD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.stroke()
    ctx.font = curN ? '30px sans-serif' : '26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(done ? '✓' : NODE_EMOJI[node.type]!, x, y + (curN ? 10 : 9))
    ctx.fillStyle = curN ? '#fff6e6' : '#d8cdb6'; ctx.font = (curN ? 'bold ' : '') + '13px sans-serif'; wrap(node.label, x, y + rad + 20, gapW - 20, 15)
  })

  if (!reward && !run.over) {
    const node = currentNode(run), b = { x: W / 2 - 150, y: H - 84, w: 300, h: 46 }, hov = inRect(b)
    ctx.fillStyle = hov ? '#f0a85e' : TERRA; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12; rr(b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.restore()
    ctx.fillStyle = '#3a2410'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText((node.type === 'shop' ? '🏪 进店:' : '进入:') + node.label, b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, enterNode)
  }

  if (reward) { // 三选一
    ctx.fillStyle = 'rgba(18,14,9,.72)'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = GREEN; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🎉 修好了!挑一件工具带走', W / 2, H * 0.3)
    const rw = 300, gp = 24, tot = reward.length * rw + (reward.length - 1) * gp, rx0 = W / 2 - tot / 2
    reward.forEach((id, i) => toolRow(id, rx0 + i * (rw + gp), H * 0.4, rw, false, false, () => pickReward(id)))
  }
  if (run.over) drawRunOver(run.over)
  if (toastT > 0) { ctx.fillStyle = 'rgba(192,57,43,.92)'; const tw = ctx.measureText(toast).width + 36; rr(W / 2 - tw / 2, 92, tw, 30, 15); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(toast, W / 2, 112) }
}

function drawRunOver(kind: 'win' | 'lose') {
  ctx.fillStyle = 'rgba(18,14,9,.8)'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = kind === 'win' ? GREEN : '#c0392b'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12
  ctx.fillText(kind === 'win' ? '🏆 全屋修好了!今天收工' : '💀 口碑没了,被扫地出门', W / 2, H / 2 - 20); ctx.restore()
  const b1 = { x: W / 2 - 190, y: H / 2 + 20, w: 176, h: 46 }, hov1 = inRect(b1); ctx.fillStyle = hov1 ? '#f0a85e' : TERRA; rr(b1.x, b1.y, b1.w, b1.h, 12); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('▶ 再来一局', b1.x + b1.w / 2, b1.y + 29); btn(b1.x, b1.y, b1.w, b1.h, startRunFlow)
  const b2 = { x: W / 2 + 14, y: H / 2 + 20, w: 176, h: 46 }; ctx.fillStyle = 'rgba(42,50,66,.9)'; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.fill(); ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.fillText('← 回家', b2.x + b2.w / 2, b2.y + 29); btn(b2.x, b2.y, b2.w, b2.h, () => { run = null; view = 'house' })
}

function shopView() {
  if (!run) { view = 'house'; return }
  if (IMG.house.complete && IMG.house.naturalWidth) drawContain(IMG.house); else { ctx.fillStyle = '#e9dcc2'; ctx.fillRect(0, 0, W, H) }
  ctx.fillStyle = 'rgba(20,16,10,0.55)'; ctx.fillRect(0, 0, W, H)
  drawRunHud(run)
  ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6; ctx.fillText('🏪 五金店 · 补货', W / 2, 92); ctx.restore()
  const rw = 420, x = W / 2 - rw / 2
  ALL_TOOLS.forEach((id, i) => {
    const owned = !TOOLS[id].consumable && run!.tools.includes(id)
    toolRow(id, x, 130 + i * 74, rw, true, owned, () => buyTool(run!, id))
  })
  const b = { x: W / 2 - 90, y: 130 + ALL_TOOLS.length * 74 + 12, w: 180, h: 44 }, hov = inRect(b)
  ctx.fillStyle = hov ? '#f0a85e' : TERRA; rr(b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('离开 → 继续', b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, () => { advance(run!); view = 'map' })
}

function drawDuelCard(c: DuelCard, x: number, y: number, w: number, h: number, dim: boolean, onPlay: (id: string) => void = duelPlay) {
  const b = { x, y, w, h }, hov = !dim && inRect(b), lift = hov ? -14 : 0, top = y + lift
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = hov ? 20 : 11; ctx.shadowOffsetY = 5
  ctx.globalAlpha = dim ? 0.5 : 1; ctx.fillStyle = dim ? '#d8cdb6' : CREAM; rr(x, top, w, h, 12); ctx.fill(); ctx.restore()
  ctx.globalAlpha = dim ? 0.5 : 1; ctx.lineWidth = 2.4; ctx.strokeStyle = hov ? TERRA : WOOD; rr(x, top, w, h, 12); ctx.stroke()
  const k = KIND[c.kind]
  ctx.fillStyle = k.col; rr(x + 8, top + 8, 70, 19, 9); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(k.tag, x + 43, top + 21)
  const icon = CARD_ICON[DUEL_ICON[c.id] ?? c.id]
  ctx.fillStyle = '#fbf4e4'; ctx.beginPath(); ctx.arc(x + w / 2, top + 64, 33, 0, 7); ctx.fill()
  if (icon) drawImgFit(icon, x + w / 2, top + 64, 58, 58)
  ctx.globalAlpha = 1; ctx.fillStyle = DARK; ctx.font = 'bold 14px sans-serif'; const nl = wrap(c.name, x + w / 2, top + 106, w - 16, 16)
  ctx.fillStyle = '#8a7a5a'; ctx.font = '10px sans-serif'; wrap(c.note, x + w / 2, top + 106 + nl * 16 + 2, w - 14, 12)
  if (!dim) btn(b.x, b.y, b.w, b.h, () => onPlay(c.id))
}

function duelView(d: Duel) {
  const v = d.view(), over = v.won || v.lost
  drawCover(cur.scene, 1 + 0.05 * intro)
  let g = ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(18,14,9,.62)'); g.addColorStop(1, 'rgba(18,14,9,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 220)
  g = ctx.createLinearGradient(0, H - 420, 0, H); g.addColorStop(0, 'rgba(18,14,9,0)'); g.addColorStop(1, 'rgba(18,14,9,.66)'); ctx.fillStyle = g; ctx.fillRect(0, H - 420, W, 420)

  // 顶栏
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 22px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.fillText(v.title, 22, 38); ctx.restore()
  ctx.fillStyle = '#e6dcc8'; ctx.font = '13px sans-serif'; ctx.fillText(`第 ${v.turn} 回合`, 22, 58)
  { const b = { x: W - 104, y: 18, w: 84, h: 32 }; ctx.fillStyle = inRect(b) ? '#3a4636' : 'rgba(42,50,66,.85)'; ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('← 回家', b.x + b.w / 2, b.y + 21); btn(b.x, b.y, b.w, b.h, back) }
  if (run) { ctx.textAlign = 'left'; ctx.fillStyle = CORAL; ctx.font = 'bold 13px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText(`口碑 ${'❤'.repeat(Math.max(0, run.rep)) || '—'}  💰${run.money}`, 22, 76); ctx.restore() }
  if (run && run.firstaid > 0 && !over) { const b = { x: W - 104, y: 56, w: 84, h: 26 }, hov = inRect(b); ctx.fillStyle = hov ? '#d06b5a' : 'rgba(192,57,43,.85)'; rr(b.x, b.y, b.w, b.h, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`🩹 急救 ×${run.firstaid}`, b.x + b.w / 2, b.y + 18); btn(b.x, b.y, b.w, b.h, useFirstaid) }

  // 状态面板:主读数 + 时钟条
  const pw = 440, px = W / 2 - pw / 2, py = 14, ph = 82
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4; ctx.fillStyle = 'rgba(244,236,218,.96)'; rr(px, py, pw, ph, 14); ctx.fill(); ctx.restore()
  ctx.textAlign = 'left'; ctx.fillStyle = '#8a7a5a'; ctx.font = '12px sans-serif'; ctx.fillText(v.statusLabel, px + 22, py + 26)
  ctx.fillStyle = v.statusOk ? GREEN : CORAL; ctx.font = 'bold 28px sans-serif'; ctx.fillText(v.statusValue, px + 20, py + 62)
  const bx = px + 200, bw = 214
  ctx.fillStyle = '#8a7a5a'; ctx.font = '12px sans-serif'; ctx.fillText(v.clockLabel, bx, py + 26); ctx.textAlign = 'right'; ctx.fillStyle = DARK; ctx.font = 'bold 13px sans-serif'; ctx.fillText(`${v.clock}%`, bx + bw, py + 26)
  ctx.fillStyle = '#e4d8c0'; rr(bx, py + 36, bw, 16, 8); ctx.fill()
  const frac = Math.min(1, v.clock / 100); if (frac > 0) { ctx.fillStyle = v.clock >= 70 ? '#c0392b' : CORAL; rr(bx, py + 36, Math.max(10, bw * frac), 16, 8); ctx.fill() }
  ctx.fillStyle = '#a89878'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(v.clockHint, bx + bw / 2, py + 70)

  // 证据盘:探到才亮真值,没探的是问号
  const n = v.readings.length, cw = 150, cg = 12, ct = n * cw + (n - 1) * cg, cx0 = W / 2 - ct / 2, cy = 128
  v.readings.forEach((r, i) => {
    const x = cx0 + i * (cw + cg), known = r.value !== null, bad = known && r.off
    ctx.fillStyle = bad ? 'rgba(201,74,58,.92)' : known ? 'rgba(79,150,120,.92)' : 'rgba(58,50,40,.6)'; rr(x, cy, cw, 54, 10); ctx.fill()
    ctx.strokeStyle = bad ? '#a83c2e' : known ? '#3f8a6a' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; rr(x, cy, cw, 54, 10); ctx.stroke()
    ctx.fillStyle = known ? '#fff' : '#c9bfae'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(r.label + (bad ? ' ⚠' : known ? ' ✓' : ''), x + cw / 2, cy + 15)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; wrap(r.value ?? '?', x + cw / 2, cy + 33, cw - 14, 14)
  })

  // 事件行(⚡反扑高亮)
  if (v.events.length && !over) {
    const txt = v.events.join('  ·  '), heat = txt.includes('⚡')
    ctx.font = '13px sans-serif'; const tw = Math.min(W - 80, ctx.measureText(txt).width + 32)
    ctx.fillStyle = heat ? 'rgba(238,108,90,.94)' : 'rgba(58,50,40,.82)'; rr(W / 2 - tw / 2, 194, tw, 26, 13); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, W / 2, 211)
  }

  // 手牌:分组两行——先取证、再对症;等待单独一个按钮
  const hand = d.hand(), probes = hand.filter(c => c.kind === 'probe'), fixes = hand.filter(c => c.kind === 'fix'), waitCard = hand.find(c => c.kind === 'wait')
  if (!over && waitCard) { const b = { x: W / 2 - 92, y: 232, w: 184, h: 30 }; const hov = inRect(b); ctx.fillStyle = hov ? 'rgba(154,143,122,.95)' : 'rgba(90,83,70,.8)'; rr(b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.fillStyle = '#fff6e6'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`⏳ ${waitCard.name}(推进一回合)`, b.x + b.w / 2, b.y + 20); btn(b.x, b.y, b.w, b.h, () => duelPlay(waitCard.id)) }
  const LEFTPAD = 272, cwd = 152, cch = 152, gap = 12
  const drawRow = (list: DuelCard[], y: number, label: string) => {
    const tot = list.length * cwd + (list.length - 1) * gap, x0 = Math.max(LEFTPAD, LEFTPAD + (W - LEFTPAD - 12 - tot) / 2)
    ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.fillText(label, x0 + 2, y - 8); ctx.restore()
    list.forEach((c, i) => drawDuelCard(c, x0 + i * (cwd + gap), y, cwd, cch, over))
  }
  drawRow(probes, H - 348, '🔍 先取证(只查不修,弄清是哪儿的毛病)')
  drawRow(fixes, H - 168, '🔧 再对症处置(修错白费一回合,故障还会恶化)')

  // 小修:左下角;懵了点它 → 先静态列手牌作用,再叠加 LLM 具体建议
  drawImgFit(IMG.gulu, 60, H - 58, 88, 88)
  ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.fillText('小修', 60, H - 6); ctx.restore()
  if (!over) { const b = { x: 108, y: H - 92, w: 128, h: 32 }; const hov = inRect(b); ctx.fillStyle = hov ? '#f0a85e' : TERRA; rr(b.x, b.y, b.w, b.h, 9); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💡 问问小修', b.x + b.w / 2, b.y + 21); btn(b.x, b.y, b.w, b.h, askXiu) }
  if (xiuOpen) {
    const pX = 12, pY = 118, pW = 258, pH = H - pY - 140
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16; ctx.fillStyle = 'rgba(255,250,240,.97)'; rr(pX, pY, pW, pH, 14); ctx.fill(); ctx.restore()
    ctx.strokeStyle = TERRA; ctx.lineWidth = 2.5; rr(pX, pY, pW, pH, 14); ctx.stroke()
    ctx.fillStyle = TERRA; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('小修 · 帮你捋捋', pX + 16, pY + 24)
    { const cb = { x: pX + pW - 34, y: pY + 8, w: 26, h: 24 }; ctx.fillStyle = inRect(cb) ? '#e0d4bd' : 'transparent'; rr(cb.x, cb.y, cb.w, cb.h, 6); ctx.fill(); ctx.fillStyle = '#8a7a5a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✕', cb.x + 13, cb.y + 17); btn(cb.x, cb.y, cb.w, cb.h, () => { xiuOpen = false }) }
    ctx.fillStyle = DARK; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'
    let yy = pY + 48
    for (const para of xiuText.split('\n')) { const used = wrap(para, pX + 16, yy, pW - 32, 19); yy += used * 19 + 4 }
    if (xiuLoading) { ctx.fillStyle = '#a8977a'; ctx.font = 'italic 12px sans-serif'; ctx.fillText('小修在想更具体的…', pX + 16, yy + 6) }
  }

  // 胜负
  if (over) {
    ctx.fillStyle = v.won ? GREEN : '#c0392b'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.fillText(v.won ? v.wonText : v.lostText, W / 2, H / 2 - 10); ctx.restore()
    if (run) {
      const b = { x: W / 2 - 100, y: H / 2 + 24, w: 200, h: 44 }, hov = inRect(b); ctx.fillStyle = hov ? '#f0a85e' : TERRA; rr(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(v.won ? '继续跑图 →' : '认了,继续 →', b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, resolveDuel)
    } else if (v.won) {
      const b = { x: W / 2 - 92, y: H / 2 + 24, w: 184, h: 44 }; ctx.fillStyle = TERRA; rr(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('← 回家', b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, back)
    } else {
      const b1 = { x: W / 2 - 190, y: H / 2 + 24, w: 176, h: 44 }; ctx.fillStyle = TERRA; rr(b1.x, b1.y, b1.w, b1.h, 10); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('↻ 再修一次', b1.x + b1.w / 2, b1.y + 28); btn(b1.x, b1.y, b1.w, b1.h, () => enter(cur))
      const b2 = { x: W / 2 + 14, y: H / 2 + 24, w: 176, h: 44 }; ctx.fillStyle = 'rgba(42,50,66,.9)'; rr(b2.x, b2.y, b2.w, b2.h, 10); ctx.fill(); ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b2.x, b2.y, b2.w, b2.h, 10); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.fillText('← 回家', b2.x + b2.w / 2, b2.y + 28); btn(b2.x, b2.y, b2.w, b2.h, back)
    }
  }
}

// —— 小修面板 + 胜负,两种战斗视图共用 ——
function drawXiuPanel(over: boolean) {
  drawImgFit(IMG.gulu, 60, H - 58, 88, 88)
  ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.fillText('小修', 60, H - 6); ctx.restore()
  if (!over) { const b = { x: 108, y: H - 92, w: 128, h: 32 }; const hov = inRect(b); ctx.fillStyle = hov ? '#f0a85e' : TERRA; rr(b.x, b.y, b.w, b.h, 9); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💡 问问小修', b.x + b.w / 2, b.y + 21); btn(b.x, b.y, b.w, b.h, askXiu) }
  if (xiuOpen) {
    const pX = 12, pY = 118, pW = 258, pH = H - pY - 140
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16; ctx.fillStyle = 'rgba(255,250,240,.97)'; rr(pX, pY, pW, pH, 14); ctx.fill(); ctx.restore()
    ctx.strokeStyle = TERRA; ctx.lineWidth = 2.5; rr(pX, pY, pW, pH, 14); ctx.stroke()
    ctx.fillStyle = TERRA; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('小修 · 帮你捋捋', pX + 16, pY + 24)
    { const cb = { x: pX + pW - 34, y: pY + 8, w: 26, h: 24 }; ctx.fillStyle = inRect(cb) ? '#e0d4bd' : 'transparent'; rr(cb.x, cb.y, cb.w, cb.h, 6); ctx.fill(); ctx.fillStyle = '#8a7a5a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✕', cb.x + 13, cb.y + 17); btn(cb.x, cb.y, cb.w, cb.h, () => { xiuOpen = false }) }
    ctx.fillStyle = DARK; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'
    let yy = pY + 48
    for (const para of xiuText.split('\n')) { const used = wrap(para, pX + 16, yy, pW - 32, 19); yy += used * 19 + 4 }
    if (xiuLoading) { ctx.fillStyle = '#a8977a'; ctx.font = 'italic 12px sans-serif'; ctx.fillText('小修在想更具体的…', pX + 16, yy + 6) }
  }
}
function drawWinLose(v: ReturnType<Duel['view']>) {
  if (v.won) {
    ctx.fillStyle = GREEN; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.fillText(v.wonText, W / 2, H / 2 - 10); ctx.restore()
    if (run) { const b = { x: W / 2 - 100, y: H / 2 + 24, w: 200, h: 44 }, hov = inRect(b); ctx.fillStyle = hov ? '#f0a85e' : TERRA; rr(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('继续跑图 →', b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, resolveDuel) }
    else { const b = { x: W / 2 - 92, y: H / 2 + 24, w: 184, h: 44 }; ctx.fillStyle = TERRA; rr(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('← 回家', b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, back) }
  } else if (v.lost) {
    ctx.fillStyle = '#c0392b'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.fillText(v.lostText, W / 2, H / 2 - 10); ctx.restore()
    if (run) { const b = { x: W / 2 - 100, y: H / 2 + 24, w: 200, h: 44 }, hov = inRect(b); ctx.fillStyle = hov ? '#f0a85e' : TERRA; rr(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('认了,继续 →', b.x + b.w / 2, b.y + 28); btn(b.x, b.y, b.w, b.h, resolveDuel) }
    else { const b1 = { x: W / 2 - 190, y: H / 2 + 24, w: 176, h: 44 }; ctx.fillStyle = TERRA; rr(b1.x, b1.y, b1.w, b1.h, 10); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('↻ 再修一次', b1.x + b1.w / 2, b1.y + 28); btn(b1.x, b1.y, b1.w, b1.h, () => enter(cur)); const b2 = { x: W / 2 + 14, y: H / 2 + 24, w: 176, h: 44 }; ctx.fillStyle = 'rgba(42,50,66,.9)'; rr(b2.x, b2.y, b2.w, b2.h, 10); ctx.fill(); ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b2.x, b2.y, b2.w, b2.h, 10); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.fillText('← 回家', b2.x + b2.w / 2, b2.y + 28); btn(b2.x, b2.y, b2.w, b2.h, back) }
  }
}
function drawBattleTop(v: ReturnType<Duel['view']>, over: boolean, sub: string) {
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 22px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.fillText(v.title, 22, 38); ctx.restore()
  ctx.fillStyle = '#e6dcc8'; ctx.font = '13px sans-serif'; ctx.fillText(sub, 22, 58)
  { const b = { x: W - 104, y: 18, w: 84, h: 32 }; ctx.fillStyle = inRect(b) ? '#3a4636' : 'rgba(42,50,66,.85)'; ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('← 回家', b.x + b.w / 2, b.y + 21); btn(b.x, b.y, b.w, b.h, back) }
  if (run) { ctx.textAlign = 'left'; ctx.fillStyle = CORAL; ctx.font = 'bold 13px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText(`口碑 ${'❤'.repeat(Math.max(0, run.rep)) || '—'}  💰${run.money}`, 22, 76); ctx.restore() }
  if (run && run.firstaid > 0 && !over) { const b = { x: W - 104, y: 56, w: 84, h: 26 }, hov = inRect(b); ctx.fillStyle = hov ? '#d06b5a' : 'rgba(192,57,43,.85)'; rr(b.x, b.y, b.w, b.h, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`🩹 急救 ×${run.firstaid}`, b.x + b.w / 2, b.y + 18); btn(b.x, b.y, b.w, b.h, useFirstaid) }
}

const DESCENT_PROBE: Record<string, string> = { 'hosts': 'probe-hosts', '本机缓存': 'probe-cache', '递归服务器': 'probe-server', '权威·真相': 'probe-authority' }
function descentView(d: Duel) {
  const v = d.view(), over = v.won || v.lost
  drawCover(cur.scene, 1 + 0.05 * intro)
  let g = ctx.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, 'rgba(18,14,9,.6)'); g.addColorStop(1, 'rgba(18,14,9,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 150)
  g = ctx.createLinearGradient(0, H - 340, 0, H); g.addColorStop(0, 'rgba(18,14,9,0)'); g.addColorStop(1, 'rgba(18,14,9,.7)'); ctx.fillStyle = g; ctx.fillRect(0, H - 340, W, 340)
  drawBattleTop(v, over, `第 ${v.turn} 回合 · 顺着这条链一层层查下去`)

  // 断网时钟(右上小条)
  { const bx = W - 320, bw = 190, by = 26; ctx.textAlign = 'left'; ctx.fillStyle = '#e6dcc8'; ctx.font = '12px sans-serif'; ctx.fillText(`${v.clockLabel} ${v.clock}%`, bx, by - 3); ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(bx, by, bw, 12, 6); ctx.fill(); const fr = Math.min(1, v.clock / 100); if (fr > 0) { ctx.fillStyle = v.clock >= 70 ? '#c0392b' : CORAL; rr(bx, by, Math.max(8, bw * fr), 12, 6); ctx.fill() } }

  // 顶部:你现在拿到的地址(现象)
  const phenom = v.readings[0]
  ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif'; const pw = Math.min(760, W - 120)
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 12; ctx.fillStyle = 'rgba(244,236,218,.96)'; rr(W / 2 - pw / 2, 92, pw, 34, 16); ctx.fill(); ctx.restore()
  ctx.fillStyle = v.statusOk ? GREEN : CORAL; ctx.fillText((v.statusOk ? '✓ ' : '✕ ') + (phenom?.value ?? ''), W / 2, 114)

  // 逐跳链:hosts → 本机缓存 → 递归 → 权威,点一站看一站,越往下越深
  const stations = v.readings.slice(1)
  const spineX = W / 2 - 250, top0 = 150, gap = 70, boxW = 500, boxH = 58
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.moveTo(spineX, top0 + 20); ctx.lineTo(spineX, top0 + (stations.length - 1) * gap + 20); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = '#e6dcc8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText('↓ 越往下越深,最底下是真相源', spineX - 6, top0 - 6); ctx.restore()
  stations.forEach((r, i) => {
    const y = top0 + i * gap, known = r.value !== null, bad = known && !!r.off, truth = r.label.includes('权威')
    ctx.fillStyle = bad ? '#c94a3a' : known ? (truth ? '#4f9a6a' : '#3f9a8a') : 'rgba(90,83,70,.92)'
    ctx.beginPath(); ctx.arc(spineX, y + 20, 12, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(spineX, y + 20, 12, 0, 7); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), spineX, y + 24)
    const b = { x: spineX + 26, y, w: boxW, h: boxH }, hov = !known && !over && inRect(b)
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = hov ? 16 : 9; ctx.shadowOffsetY = 3
    ctx.fillStyle = known ? (bad ? 'rgba(250,235,231,.97)' : truth ? 'rgba(233,247,238,.97)' : 'rgba(238,247,245,.97)') : hov ? 'rgba(60,54,46,.82)' : 'rgba(30,27,22,.66)'
    rr(b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.restore()
    ctx.strokeStyle = bad ? '#c0392b' : known ? (truth ? '#4f9a6a' : '#3f9a8a') : hov ? TERRA : 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; rr(b.x, b.y, b.w, b.h, 12); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = known ? '#7a6a4e' : '#d8cdb6'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(`第 ${i + 1} 站 · ${r.label}`, b.x + 16, b.y + 21)
    if (known) { ctx.fillStyle = bad ? '#c0392b' : truth ? '#3f8a5a' : DARK; ctx.font = 'bold 13px sans-serif'; ctx.fillText(r.value!, b.x + 16, b.y + 43) }
    else { ctx.fillStyle = '#e8dcc4'; ctx.font = '13px sans-serif'; ctx.fillText(truth ? '？ 点这里 · 下探到真相源' : '？ 点一下 · 看这一站', b.x + 16, b.y + 43); const pid = DESCENT_PROBE[r.label]; if (pid) btn(b.x, b.y, b.w, b.h, () => duelPlay(pid)) }
  })

  // 底部:处置手牌(弄清哪站坏了,在那站对症处置)+ 等待
  const fixes = d.hand().filter(c => c.kind !== 'probe'), LEFTPAD = 272, cwd = 150, gap2 = 12
  const tot = fixes.length * cwd + (fixes.length - 1) * gap2, x0 = Math.max(LEFTPAD, LEFTPAD + (W - LEFTPAD - 12 - tot) / 2), rowY = H - 168
  ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.fillText('🔧 弄清哪一站坏了,就在那儿对症处置(拆错站白折腾)', x0 + 2, rowY - 10); ctx.restore()
  fixes.forEach((c, i) => drawDuelCard(c, x0 + i * (cwd + gap2), rowY, cwd, 150, over))

  drawXiuPanel(over)
  drawWinLose(v)
}

function saboteurView(s: Saboteur) {
  const v = s.view(), over = v.won || v.lost
  drawCover(IMG.sceneRouter, 1 + 0.05 * intro)
  let g = ctx.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, 'rgba(18,14,9,.6)'); g.addColorStop(1, 'rgba(18,14,9,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 170)
  g = ctx.createLinearGradient(0, H - 300, 0, H); g.addColorStop(0, 'rgba(18,14,9,0)'); g.addColorStop(1, 'rgba(18,14,9,.7)'); ctx.fillStyle = g; ctx.fillRect(0, H - 300, W, 300)

  // 顶栏
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 22px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.fillText(v.title, 22, 38); ctx.restore()
  ctx.fillStyle = '#e6dcc8'; ctx.font = '13px sans-serif'; ctx.fillText('见招拆招:它出破坏卡,你出对应卡挡回去', 22, 58)
  { const b = { x: W - 104, y: 18, w: 84, h: 32 }; ctx.fillStyle = inRect(b) ? '#3a4636' : 'rgba(42,50,66,.85)'; ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('← 回家', b.x + b.w / 2, b.y + 21); btn(b.x, b.y, b.w, b.h, () => { sab = null; view = 'house' }) }
  { const bx = W - 300, bw = 176, by = 64; ctx.textAlign = 'left'; ctx.fillStyle = '#e6dcc8'; ctx.font = '12px sans-serif'; ctx.fillText(`${v.clockLabel} ${v.clock}%`, bx, by - 3); ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(bx, by, bw, 12, 6); ctx.fill(); const fr = Math.min(1, v.clock / 100); if (fr > 0) { ctx.fillStyle = v.clock >= 70 ? '#c0392b' : CORAL; rr(bx, by, Math.max(8, bw * fr), 12, 6); ctx.fill() } }

  // 你在守的:网页状态
  { const bx = 24, by = 92; ctx.textAlign = 'left'; ctx.fillStyle = v.systemOk ? GREEN : CORAL; ctx.font = 'bold 16px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.fillText((v.systemOk ? '🌐 ✓ ' : '🌐 ✕ ') + v.systemText, bx, by); ctx.restore() }

  // 捣蛋鬼 + 士气 + 意图
  const gx = W * 0.75, gy = H * 0.42, bob = over ? 0 : Math.sin(t * 2) * 4
  drawImgFit(IMG.gremlin, gx, gy + bob + (v.won ? 260 : 0), 236, 236)
  if (!v.won) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 13px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText(`捣蛋鬼 · 还剩 ${v.morale} 招`, gx, gy - 140); ctx.restore()
    for (let i = 0; i < v.moraleMax; i++) { const px = gx - (v.moraleMax - 1) * 11 + i * 22, py = gy - 122; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fillStyle = i < v.morale ? CORAL : 'rgba(255,255,255,.22)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke() }
    if (v.intent && !over) bubble(gx - 70, gy - 44, 210, `下一招盘算:${v.intent}`, '#8a5cc0')
  }

  // 它这一招(现在要你挡的)
  if (v.activeName && !over) {
    ctx.font = 'bold 15px sans-serif'; const tw = Math.min(560, W - 460)
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 14; ctx.fillStyle = 'rgba(206,78,56,.96)'; rr(W * 0.4 - tw / 2, 128, tw, 40, 20); ctx.fill(); ctx.restore()
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('⚡ 它这招:' + v.activeName, W * 0.4, 153)
  }
  // 攻防回合日志
  if (v.events.length && !over) { const txt = v.events.join('   ·   '); ctx.font = '14px sans-serif'; const tw = Math.min(W - 80, ctx.measureText(txt).width + 32); ctx.fillStyle = 'rgba(58,50,40,.82)'; rr(W * 0.4 - tw / 2, 182, tw, 28, 14); ctx.fill(); ctx.fillStyle = '#fff6e6'; ctx.textAlign = 'center'; ctx.fillText(txt, W * 0.4, 201) }

  // 你的手牌:对应卡 + 缓一手
  const hand = v.hand.map(c => ({ id: c.id, kind: (c.id === 'wait' ? 'wait' : 'fix') as DuelCard['kind'], name: c.name, note: c.note }))
  const cwd = 150, gap = 12, tot = hand.length * cwd + (hand.length - 1) * gap, x0 = W / 2 - tot / 2, rowY = H - 168
  ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.fillText('🛡 你的对应卡:看懂它这招,出对的那张挡回去(挡错=白折腾)', x0 + 2, rowY - 10); ctx.restore()
  hand.forEach((c, i) => drawDuelCard(c, x0 + i * (cwd + gap), rowY, cwd, 150, over, sabPlay))

  // 胜负
  if (over) {
    ctx.fillStyle = v.won ? GREEN : '#c0392b'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.fillText(v.won ? '🎉 熬赢了!捣蛋鬼灰溜溜跑了' : '💀 被捣蛋鬼得逞了,断网太久', W / 2, H / 2 - 20); ctx.restore()
    const b1 = { x: W / 2 - 190, y: H / 2 + 20, w: 176, h: 46 }, hov1 = inRect(b1); ctx.fillStyle = hov1 ? '#f0a85e' : TERRA; rr(b1.x, b1.y, b1.w, b1.h, 12); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('▶ 再来一场', b1.x + b1.w / 2, b1.y + 29); btn(b1.x, b1.y, b1.w, b1.h, startSab)
    const b2 = { x: W / 2 + 14, y: H / 2 + 20, w: 176, h: 46 }; ctx.fillStyle = 'rgba(42,50,66,.9)'; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.fill(); ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.fillText('← 回家', b2.x + b2.w / 2, b2.y + 29); btn(b2.x, b2.y, b2.w, b2.h, () => { sab = null; view = 'house' }) }
}

function stackView(s: StackBattle) {
  const v = s.view(), over = v.won || v.lost
  drawCover(IMG.sceneRouter, 1 + 0.05 * intro)
  let g = ctx.createLinearGradient(0, 0, 0, 180); g.addColorStop(0, 'rgba(18,14,9,.62)'); g.addColorStop(1, 'rgba(18,14,9,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 180)
  g = ctx.createLinearGradient(0, H - 300, 0, H); g.addColorStop(0, 'rgba(18,14,9,0)'); g.addColorStop(1, 'rgba(18,14,9,.7)'); ctx.fillStyle = g; ctx.fillRect(0, H - 300, W, 300)

  // 顶栏
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 21px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.fillText(v.title, 22, 36); ctx.restore()
  ctx.fillStyle = '#e6dcc8'; ctx.font = '13px sans-serif'; ctx.fillText('它暗中打某一层,你顺着栈钻下去、搞懂那层为什么,才认得出、才挡得对', 22, 56)
  { const b = { x: W - 104, y: 16, w: 84, h: 32 }; ctx.fillStyle = inRect(b) ? '#3a4636' : 'rgba(42,50,66,.85)'; ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('← 回家', b.x + b.w / 2, b.y + 21); btn(b.x, b.y, b.w, b.h, () => { stk = null; view = 'house' }) }
  { const bx = W - 300, bw = 176, by = 60; ctx.textAlign = 'left'; ctx.fillStyle = '#e6dcc8'; ctx.font = '12px sans-serif'; ctx.fillText(`${v.clockLabel} ${v.clock}%`, bx, by - 3); ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(bx, by, bw, 12, 6); ctx.fill(); const fr = Math.min(1, v.clock / 100); if (fr > 0) { ctx.fillStyle = v.clock >= 70 ? '#c0392b' : CORAL; rr(bx, by, Math.max(8, bw * fr), 12, 6); ctx.fill() } }
  // 你在守的
  { ctx.textAlign = 'left'; ctx.fillStyle = v.connected ? GREEN : CORAL; ctx.font = 'bold 15px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.fillText((v.connected ? '🌐 ✓ ' : '🌐 ✕ ') + v.statusText, 22, 84); ctx.restore() }

  // 捣蛋鬼 + 士气 + 意图
  const gx = W * 0.84, gy = H * 0.40, bob = over ? 0 : Math.sin(t * 2) * 4
  drawImgFit(IMG.gremlin, gx, gy + bob + (v.won ? 260 : 0), 190, 190)
  if (!v.won) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 12px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText(`捣蛋鬼 · 还剩 ${v.morale} 招`, gx, gy - 116); ctx.restore()
    for (let i = 0; i < v.moraleMax; i++) { const px = gx - (v.moraleMax - 1) * 11 + i * 22, py = gy - 100; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fillStyle = i < v.morale ? CORAL : 'rgba(255,255,255,.22)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke() }
    if (v.intentName) bubble(gx - 66, gy - 26, 190, `下一招盯:${v.intentName.split(' · ')[0]}`, '#8a5cc0')
  }

  // 它这招落在哪半栈(逼你钻)
  if (v.attackRegion && !over) { ctx.font = 'bold 15px sans-serif'; const tw = Math.min(600, W - 430); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 14; ctx.fillStyle = 'rgba(206,78,56,.96)'; rr(W * 0.4 - tw / 2, 100, tw, 36, 18); ctx.fill(); ctx.restore(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`⚡ 它这招落在:${v.attackRegion} —— 钻下去找是哪层`, W * 0.4, 123) }

  // 连接栈:从上(应用侧)往下(物理侧),点每层下探,坏层揪出来
  const spineX = W / 2 - 250, top0 = 152, gap = 72, boxW = 468, boxH = 58
  ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 3; ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.moveTo(spineX, top0 + 20); ctx.lineTo(spineX, top0 + (v.layers.length - 1) * gap + 20); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = '#e6dcc8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText('↓ 越往下越接近物理层', spineX - 6, top0 - 4); ctx.restore()
  v.layers.forEach((r, i) => {
    const y = top0 + i * gap, bad = r.broken, known = r.known
    ctx.fillStyle = bad ? '#c94a3a' : known ? '#3f9a8a' : 'rgba(90,83,70,.9)'; ctx.beginPath(); ctx.arc(spineX, y + 20, 12, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(spineX, y + 20, 12, 0, 7); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), spineX, y + 24)
    const b = { x: spineX + 26, y, w: boxW, h: boxH }, hov = !known && !over && inRect(b)
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = hov ? 16 : 9; ctx.shadowOffsetY = 3
    ctx.fillStyle = known ? (bad ? 'rgba(250,235,231,.97)' : 'rgba(236,247,244,.97)') : hov ? 'rgba(60,54,46,.82)' : 'rgba(30,27,22,.64)'
    rr(b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.restore()
    ctx.strokeStyle = bad ? '#c0392b' : known ? '#3f9a8a' : hov ? TERRA : 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; rr(b.x, b.y, b.w, b.h, 12); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = known ? '#7a6a4e' : '#d8cdb6'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(`第 ${i + 1} 层 · ${r.name}`, b.x + 16, b.y + 21)
    if (known) { ctx.fillStyle = bad ? '#c0392b' : DARK; ctx.font = '12.5px sans-serif'; ctx.fillText(r.reading!, b.x + 16, b.y + 42) }
    else { ctx.fillStyle = '#e8dcc4'; ctx.font = '13px sans-serif'; ctx.fillText('？ 点一下 · 下探这层(看它真状态、学它为什么)', b.x + 16, b.y + 42); btn(b.x, b.y, b.w, b.h, () => stkPlay('see-' + r.key)) }
  })

  // 攻防日志
  if (v.events.length && !over) { const txt = v.events.join('   ·   '); ctx.font = '13px sans-serif'; const tw = Math.min(W - 80, ctx.measureText(txt).width + 32); ctx.fillStyle = 'rgba(58,50,40,.82)'; rr(W / 2 - tw / 2, H - 250, tw, 26, 13); ctx.fill(); ctx.fillStyle = '#fff6e6'; ctx.textAlign = 'center'; ctx.fillText(txt, W / 2, H - 231) }

  // 对应卡手牌
  const cs = v.hand.filter(c => c.kind === 'counter' || c.kind === 'wait').map(c => ({ id: c.id, kind: (c.kind === 'wait' ? 'wait' : 'fix') as DuelCard['kind'], name: c.name, note: c.note }))
  const cwd = 148, gap2 = 11, tot = cs.length * cwd + (cs.length - 1) * gap2, x0 = W / 2 - tot / 2, rowY = H - 168
  ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.fillText('🛡 对应卡:认清它打了哪层,修那一层(修错层=白折腾)', x0 + 2, rowY - 10); ctx.restore()
  cs.forEach((c, i) => drawDuelCard(c, x0 + i * (cwd + gap2), rowY, cwd, 150, over, stkPlay))

  // 胜负
  if (over) {
    ctx.fillStyle = v.won ? GREEN : '#c0392b'; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.fillText(v.won ? '🎉 熬赢了!整条栈守住,捣蛋鬼跑了' : '💀 被捣蛋鬼得逞了,断网太久', W / 2, H / 2 - 24); ctx.restore()
    const b1 = { x: W / 2 - 190, y: H / 2 + 14, w: 176, h: 46 }, hov1 = inRect(b1); ctx.fillStyle = hov1 ? '#f0a85e' : TERRA; rr(b1.x, b1.y, b1.w, b1.h, 12); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('▶ 再来一场', b1.x + b1.w / 2, b1.y + 29); btn(b1.x, b1.y, b1.w, b1.h, startStk)
    const b2 = { x: W / 2 + 14, y: H / 2 + 14, w: 176, h: 46 }; ctx.fillStyle = 'rgba(42,50,66,.9)'; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.fill(); ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.fillText('← 回家', b2.x + b2.w / 2, b2.y + 29); btn(b2.x, b2.y, b2.w, b2.h, () => { stk = null; view = 'house' }) }
}

const LAYER_PAL = ['#4FB6A3', '#C084D8', '#E0954B', '#5B8DEF', '#7B9E4F', '#D9772C']
const KIND_COL: Record<string, string> = { shield: '#5a7ec0', quickfix: '#c0562c', foresee: '#8a5cc0', stabilize: '#4f9a8a', taunt: '#b0568f' }
const KW_LABEL: Record<string, string> = { reflect: '反弹', taunt: '嘲讽', chain: '连锁', aoe: '群修', buffer: '缓冲', bulwark: '铁壁' }
function cardCol(dom: Domain, type: string): string {
  const def = dom.cardDef[type]; if (!def) return '#9a8f7a'
  if (def.kw && def.kw.length) return '#c9922f' // 关键词卡:金色一眼认出
  if (def.kind === 'fix' && def.layer) return LAYER_PAL[dom.layers.indexOf(def.layer) % LAYER_PAL.length]!
  return KIND_COL[def.kind] ?? '#9a8f7a'
}
function combatView(c: Combat) {
  const v = c.view(), over = v.won || v.lost, isFridge = c.dom.id === 'fridge', unit = isFridge ? '环' : '层'
  drawCover(isFridge ? IMG.sceneFridge : IMG.sceneRouter, 1 + 0.05 * intro)
  let g = ctx.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, 'rgba(18,14,9,.62)'); g.addColorStop(1, 'rgba(18,14,9,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 170)
  g = ctx.createLinearGradient(0, H - 320, 0, H); g.addColorStop(0, 'rgba(18,14,9,0)'); g.addColorStop(1, 'rgba(18,14,9,.72)'); ctx.fillStyle = g; ctx.fillRect(0, H - 320, W, 320)

  // 顶栏 + 副本进度(小怪→精英→Boss 弧线)
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 21px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.fillText(v.title, 22, 36); ctx.restore()
  ctx.fillStyle = '#e6dcc8'; ctx.font = '13px sans-serif'; ctx.fillText('看它打出的破坏卡 → 出对症的那张防御卡修回来;加固照意图预防、预判看后手、恶化要压', 22, 56)
  if (dg) {
    const st = STAGES[dg.stage]!, sx = W - 300
    ctx.textAlign = 'left'; ctx.fillStyle = st.kind === 'boss' ? '#ff8a6e' : '#ffd98a'; ctx.font = 'bold 13px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText(st.label, sx, 30); ctx.restore()
    for (let i = 0; i < STAGES.length; i++) { const px = sx + i * 20; ctx.beginPath(); ctx.arc(px, 42, 6, 0, 7); ctx.fillStyle = i < dg.stage ? GREEN : i === dg.stage ? (st.kind === 'boss' ? '#ff6a4e' : '#ffcf5e') : 'rgba(255,255,255,.25)'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke() }
    ctx.fillStyle = '#c9bfae'; ctx.font = '11px sans-serif'; ctx.fillText(st.sub, sx + STAGES.length * 20 + 6, 46)
  }
  { const b = { x: W - 104, y: 14, w: 84, h: 32 }; ctx.fillStyle = inRect(b) ? '#3a4636' : 'rgba(42,50,66,.85)'; ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b.x, b.y, b.w, b.h, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('← 回家', b.x + b.w / 2, b.y + 21); btn(b.x, b.y, b.w, b.h, () => { cmb = null; dg = null; armedCard = null; view = 'house' }) }
  { const bx = W - 300, bw = 176, by = 64; ctx.textAlign = 'left'; ctx.fillStyle = '#e6dcc8'; ctx.font = '12px sans-serif'; ctx.fillText(`${v.clockLabel} ${v.clock}%`, bx, by - 3); ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(bx, by, bw, 12, 6); ctx.fill(); const fr = Math.min(1, v.clock / 100); if (fr > 0) { ctx.fillStyle = v.clock >= 70 ? '#c0392b' : CORAL; rr(bx, by, Math.max(8, bw * fr), 12, 6); ctx.fill() } }
  // 系统 + 能量
  ctx.textAlign = 'left'; ctx.fillStyle = v.connected ? GREEN : CORAL; ctx.font = 'bold 15px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.fillText((v.connected ? (isFridge ? '🧊 ✓ ' : '🌐 ✓ ') : (isFridge ? '🧊 ✕ ' : '🌐 ✕ ')) + v.statusText, 22, 82); ctx.restore()
  if (v.metric) { ctx.textAlign = 'left'; ctx.fillStyle = '#bfe0d4'; ctx.font = '11px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4; ctx.fillText(`⚙ ${isFridge ? 'solveThermal' : 'DnsSim'} 真判:${v.metric}`, 22, 100); ctx.restore() }
  { ctx.textAlign = 'left'; ctx.fillStyle = '#ffd98a'; ctx.font = 'bold 14px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText('能量', 300, 82); ctx.restore(); for (let i = 0; i < v.energyMax; i++) { const px = 348 + i * 22; ctx.beginPath(); ctx.arc(px, 77, 8, 0, 7); ctx.fillStyle = i < v.energy ? '#ffcf5e' : 'rgba(255,255,255,.2)'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke() } ctx.textAlign = 'left'; ctx.fillStyle = '#c9bfae'; ctx.font = '12px sans-serif'; ctx.fillText(`🂠 牌库 ${v.deckCount} · 弃 ${v.discardCount}`, 430, 82) }

  // 捣蛋鬼 + 波次 + 意图 + 它打出的破坏卡(Boss 一回合连打多张)
  const boss = v.boss || v.intentBoss, gsz = boss ? 210 : 172
  const gx = W * 0.85, gy = H * 0.36, bob = over ? 0 : Math.sin(t * 2) * 4
  if (boss && !v.won) { const pr = gsz / 2 + 10 + Math.sin(t * 3) * 4; ctx.strokeStyle = 'rgba(238,108,90,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(gx, gy + bob + 6, pr, 0, 7); ctx.stroke() }
  drawImgFit(IMG.gremlin, gx, gy + bob + (v.won ? 300 : 0), gsz, gsz)
  if (!v.won) {
    ctx.textAlign = 'center'; ctx.fillStyle = boss ? '#ff8a6e' : '#fff6e6'; ctx.font = 'bold 12px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText(`${boss ? '大捣蛋鬼(BOSS)' : '捣蛋鬼'} · 还要作乱 ${v.wavesLeft} 回`, gx, gy - gsz / 2 - 20); ctx.restore()
    for (let i = 0; i < v.wavesMax; i++) { const px = gx - (v.wavesMax - 1) * 10 + i * 20, py = gy - gsz / 2 - 4; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fillStyle = i < v.wavesLeft ? CORAL : 'rgba(255,255,255,.22)'; ctx.fill() }
    if (v.intent) bubble(gx - 62, gy - gsz / 2 + 40, 216, `${v.intentBoss ? '⚠ 连打:' : '下一张破坏卡:'}${v.intent}`, v.intentBoss ? '#c0392b' : '#8a5cc0')
    const extra: string[] = []
    if (v.foresight.length) extra.push('🔮 预判后手:' + v.foresight.join(' → '))
    if (v.decoy) extra.push('🪤 诱饵已布好,引开它下一击一' + unit)
    extra.forEach((s, i) => { ctx.textAlign = 'center'; ctx.fillStyle = s[0] === '🪤' ? '#e8c07a' : '#caa6ff'; ctx.font = '11px sans-serif'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText(s, gx, gy + gsz / 2 + 18 + i * 16); ctx.restore() })
  }
  // 它这回合打出的破坏卡:红卡摆台面(Boss 连打就并排扇开好几张,不再是一句话)
  if (v.enemyCards.length && !over) {
    const ec = v.enemyCards, ew = ec.length > 1 ? 150 : 172, eh = 96
    ec.forEach((card, k) => {
      const parts = card.split(' · '), nm = parts[0] ?? card, wh = parts[1] ?? '', spread = k - (ec.length - 1) / 2
      const ex = gx - ew / 2 + spread * (ew * 0.62), ey = gy + gsz / 2 - 6 + Math.abs(spread) * 8 + bob
      ctx.save(); ctx.translate(ex + ew / 2, ey + eh / 2); ctx.rotate(spread * 0.06 || -0.04); ctx.translate(-(ex + ew / 2), -(ey + eh / 2))
      ctx.shadowColor = 'rgba(201,74,58,.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 4
      ctx.fillStyle = '#6f1d14'; rr(ex, ey, ew, eh, 12); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#ee6c5a'; ctx.lineWidth = 2.5; rr(ex, ey, ew, eh, 12); ctx.stroke()
      ctx.fillStyle = '#ee6c5a'; rr(ex + 8, ey + 8, 60, 17, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('😈 破坏卡', ex + 12, ey + 20)
      ctx.fillStyle = '#ffe3db'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(nm, ex + ew / 2, ey + 52)
      ctx.fillStyle = '#f2b3a8'; ctx.font = '11px sans-serif'; ctx.fillText(wh, ex + ew / 2, ey + 74)
      ctx.restore()
    })
  }

  // 连接栈盘面:6 层全亮着(它打哪层都看得见),坏层显示是哪张破坏卡打的 + 对症该出哪张(理论落在这)
  const spineX = W / 2 - 250, top0 = 150, gap = 72, boxW = 468, boxH = 58
  ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.moveTo(spineX, top0 + 20); ctx.lineTo(spineX, top0 + (v.layers.length - 1) * gap + 20); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = '#e6dcc8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4; ctx.fillText(`↓ 一${unit}扣一${unit} · ${v.layers.length} ${unit}全好才${isFridge ? '够凉' : '连通'}`, spineX - 6, top0 - 4); ctx.restore()
  v.layers.forEach((r, i) => {
    const y = top0 + i * gap, st = r.broken ? 'bad' : r.decay > 0 ? 'warn' : 'ok'
    const target = !over && armedCard !== null && (v.hand[armedCard]?.targeted ?? false) && c.canPlay(armedCard, r.key)
    const nodeCol = st === 'bad' ? '#c94a3a' : st === 'warn' ? '#d98a2c' : '#3f9a8a'
    ctx.fillStyle = nodeCol; ctx.beginPath(); ctx.arc(spineX, y + 20, 12, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(spineX, y + 20, 12, 0, 7); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), spineX, y + 24)
    const b = { x: spineX + 26, y, w: boxW, h: boxH }
    if (target) { const pr = 3 + Math.sin(t * 5) * 2; ctx.strokeStyle = TERRA; ctx.lineWidth = 3 + pr; ctx.globalAlpha = .5; rr(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 14); ctx.stroke(); ctx.globalAlpha = 1 }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = target ? 18 : 9; ctx.shadowOffsetY = 3
    ctx.fillStyle = st === 'bad' ? 'rgba(250,235,231,.97)' : st === 'warn' ? 'rgba(250,242,228,.97)' : 'rgba(236,247,244,.97)'
    rr(b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.restore()
    ctx.strokeStyle = target ? TERRA : st === 'bad' ? '#c0392b' : st === 'warn' ? '#c0842c' : '#3f9a8a'; ctx.lineWidth = 2; rr(b.x, b.y, b.w, b.h, 12); ctx.stroke()
    ctx.textAlign = 'left'; ctx.fillStyle = '#7a6a4e'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(`第 ${i + 1} ${unit} · ${r.name}`, b.x + 14, b.y + 20)
    ctx.font = '12px sans-serif'
    if (st === 'bad') { ctx.fillStyle = '#c0392b'; ctx.fillText(`⚡被【${r.attack}】· ${r.reading}`, b.x + 14, b.y + 40) }
    else if (st === 'warn') { ctx.fillStyle = '#b0741f'; ctx.fillText('⚠ ' + r.reading, b.x + 14, b.y + 40) }
    else { ctx.fillStyle = '#6b8f6a'; ctx.fillText(r.why, b.x + 14, b.y + 40) }
    // 右侧:坏层给对症提示(教「哪张防御卡治哪层」);加固徽标
    if (st === 'bad') { ctx.fillStyle = '#3f8a5a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`对症→${r.counter}`, b.x + boxW - 12, b.y + 20) }
    if (r.shield > 0) { ctx.fillStyle = r.reflect ? '#c9922f' : '#5a7ec0'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`${r.reflect ? '🛡↩' : '🛡'} ${r.shield}`, b.x + boxW - 12, b.y + 44) }
    if (target) btn(b.x, b.y, b.w, b.h, () => cmbTarget(r.key))
  })

  // 攻防日志
  if (v.events.length && !over) { const txt = v.events.join('   ·   '); ctx.font = '13px sans-serif'; const tw = Math.min(W - 80, ctx.measureText(txt).width + 32); ctx.fillStyle = 'rgba(58,50,40,.82)'; rr(W / 2 - tw / 2, H - 262, tw, 26, 13); ctx.fill(); ctx.fillStyle = '#fff6e6'; ctx.textAlign = 'center'; ctx.fillText(txt, W / 2, H - 243) }

  // 手牌:抽到的 5 张,挑几张打(带目标的选完点层;万用表/双修/稳压直接生效)+ 结束回合
  const hand = v.hand, cwd = 132, cardH = 132, gap2 = 10, tot = hand.length * cwd + (hand.length - 1) * gap2, x0 = W / 2 - tot / 2 - 76, rowY = H - 164
  ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5
  ctx.fillText(armedCard !== null ? `已选【${hand[armedCard]?.name}】—— 点上面发光的那层施加(再点取消)` : '对症出牌:坏哪层就出治那层的卡(点了直接生效);加固/急修先选卡再点层', x0 + 2, rowY - 12); ctx.restore()
  hand.forEach((cd, i) => {
    const bx = x0 + i * (cwd + gap2), sel = armedCard === i, can = !over && cd.playable, col = cardCol(c.dom, cd.type), ic = cmbIcon(cd.type)
    const b = { x: bx, y: rowY, w: cwd, h: cardH }, hov = can && inRect(b), lift = (sel || hov) ? -8 : 0
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = sel ? 22 : hov ? 16 : 10; ctx.shadowOffsetY = 5
    ctx.globalAlpha = can ? 1 : 0.42; ctx.fillStyle = sel ? '#fff3dd' : CREAM; rr(bx, rowY + lift, cwd, cardH, 12); ctx.fill(); ctx.restore()
    ctx.globalAlpha = can ? 1 : 0.42; ctx.lineWidth = sel ? 3.5 : 2.2; ctx.strokeStyle = sel ? col : WOOD; rr(bx, rowY + lift, cwd, cardH, 12); ctx.stroke()
    // 图标(有就画绘本插画,没有画个同色圆当占位)
    if (ic && ic.complete && ic.naturalWidth) drawImgFit(ic, bx + cwd / 2, rowY + lift + 36, 52, 52)
    else { ctx.globalAlpha = (can ? 1 : 0.42) * 0.18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx + cwd / 2, rowY + lift + 36, 22, 0, 7); ctx.fill(); ctx.globalAlpha = can ? 1 : 0.42 }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx + 18, rowY + lift + 18, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(cd.cost), bx + 18, rowY + lift + 22)
    if (cd.kw.length) { const kw = KW_LABEL[cd.kw[0]!] ?? cd.kw[0]!; ctx.fillStyle = '#c9922f'; rr(bx + cwd - 46, rowY + lift + 7, 38, 18, 9); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(kw, bx + cwd - 27, rowY + lift + 20) }
    ctx.fillStyle = DARK; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; const nl = wrap(cd.name, bx + cwd / 2, rowY + lift + 78, cwd - 16, 15)
    ctx.fillStyle = '#8a7a5a'; ctx.font = '10px sans-serif'; wrap(cd.note, bx + cwd / 2, rowY + lift + 78 + nl * 15 + 3, cwd - 16, 12)
    ctx.globalAlpha = 1
    if (can) btn(b.x, b.y + lift, b.w, b.h, () => cmbPickCard(i))
  })
  if (!over) { const b = { x: W / 2 + tot / 2 - 76 + 22, y: rowY + 36, w: 150, h: 58 }, hov = inRect(b); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 12; ctx.fillStyle = hov ? '#6a7488' : '#4a5468'; rr(b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#7a86a0'; ctx.lineWidth = 2; rr(b.x, b.y, b.w, b.h, 12); ctx.stroke(); ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('结束回合 ⏭', b.x + b.w / 2, b.y + 26); ctx.fillStyle = '#c9bfae'; ctx.font = '10px sans-serif'; ctx.fillText('(弃手牌·它出手·重抽5张)', b.x + b.w / 2, b.y + 44); btn(b.x, b.y, b.w, b.h, cmbEnd) }

  // 胜负 · 弧线推进:过关三选一 / Boss 通关 / 失败
  if (over && dg) {
    const dname = isFridge ? '冰箱' : '路由器'
    ctx.fillStyle = 'rgba(18,14,9,.74)'; ctx.fillRect(0, 0, W, H)
    if (v.won && dg.cleared) {
      ctx.fillStyle = GREEN; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12; ctx.fillText(`🏆 ${dname}副本通关!大捣蛋鬼被打跑了`, W / 2, H / 2 - 26); ctx.restore()
      ctx.fillStyle = '#e8dcc4'; ctx.font = '14px sans-serif'; ctx.fillText(`小怪波 → 精英 → Boss 一路守住,牌库攒到 ${dg.deck.length} 张`, W / 2, H / 2 + 8)
      const b1 = { x: W / 2 - 194, y: H / 2 + 34, w: 184, h: 46 }, hov1 = inRect(b1); ctx.fillStyle = hov1 ? '#f0a85e' : TERRA; rr(b1.x, b1.y, b1.w, b1.h, 12); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▶ 再刷一遍', b1.x + b1.w / 2, b1.y + 29); btn(b1.x, b1.y, b1.w, b1.h, () => startDungeon(c.dom))
      const b2 = { x: W / 2 + 10, y: H / 2 + 34, w: 184, h: 46 }; ctx.fillStyle = 'rgba(42,50,66,.9)'; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.fill(); ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.fillText('← 回家', b2.x + b2.w / 2, b2.y + 29); btn(b2.x, b2.y, b2.w, b2.h, () => { cmb = null; dg = null; armedCard = null; view = 'house' })
    } else if (v.won && dg.reward) {
      const done = STAGES[dg.stage]!
      ctx.fillStyle = GREEN; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.fillText(`🎉 过了${done.label}!挑张牌带走,壮大牌库`, W / 2, H * 0.28); ctx.restore()
      const rw = 244, gp = 22, rt = dg.reward.length * rw + (dg.reward.length - 1) * gp, rx0 = W / 2 - rt / 2
      dg.reward.forEach((ct, i) => {
        const def = c.dom.cardDef[ct]!, col = cardCol(c.dom, ct), bx = rx0 + i * (rw + gp), b = { x: bx, y: H * 0.4, w: rw, h: 140 }, hov = inRect(b)
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = hov ? 22 : 12; ctx.fillStyle = CREAM; rr(bx, b.y, rw, 140, 14); ctx.fill(); ctx.restore()
        ctx.lineWidth = hov ? 3.5 : 2.4; ctx.strokeStyle = hov ? col : WOOD; rr(bx, b.y, rw, 140, 14); ctx.stroke()
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx + 26, b.y + 28, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(def.cost), bx + 26, b.y + 32)
        if (def.kw && def.kw.length) { const kw = KW_LABEL[def.kw[0]!] ?? def.kw[0]!; ctx.fillStyle = '#c9922f'; rr(bx + rw - 60, b.y + 16, 46, 20, 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(kw, bx + rw - 37, b.y + 30) }
        ctx.fillStyle = DARK; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; const nl = wrap(def.name, bx + rw / 2, b.y + 60, rw - 30, 20)
        ctx.fillStyle = '#8a7a5a'; ctx.font = '12px sans-serif'; wrap(def.note, bx + rw / 2, b.y + 60 + nl * 20 + 4, rw - 28, 15)
        btn(b.x, b.y, b.w, b.h, () => cmbPickReward(ct))
      })
      ctx.fillStyle = '#c9bfae'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('(挑一张加进牌库 → 打下一关,捣蛋鬼更凶、还会连打)', W / 2, H * 0.4 + 176)
    } else {
      ctx.fillStyle = '#c0392b'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.fillText(`💀 被${STAGES[dg.stage]!.kind === 'boss' ? '大' : ''}捣蛋鬼得逞了(倒在${STAGES[dg.stage]!.label})`, W / 2, H / 2 - 24); ctx.restore()
      const b1 = { x: W / 2 - 194, y: H / 2 + 14, w: 184, h: 46 }, hov1 = inRect(b1); ctx.fillStyle = hov1 ? '#f0a85e' : TERRA; rr(b1.x, b1.y, b1.w, b1.h, 12); ctx.fill(); ctx.fillStyle = '#3a2410'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▶ 从头再打', b1.x + b1.w / 2, b1.y + 29); btn(b1.x, b1.y, b1.w, b1.h, () => startDungeon(c.dom))
      const b2 = { x: W / 2 + 10, y: H / 2 + 14, w: 184, h: 46 }; ctx.fillStyle = 'rgba(42,50,66,.9)'; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.fill(); ctx.strokeStyle = '#5a6577'; ctx.lineWidth = 1.5; rr(b2.x, b2.y, b2.w, b2.h, 12); ctx.stroke(); ctx.fillStyle = '#e6dcc8'; ctx.fillText('← 回家', b2.x + b2.w / 2, b2.y + 29); btn(b2.x, b2.y, b2.w, b2.h, () => { cmb = null; dg = null; armedCard = null; view = 'house' }) }
  }
}

function frame() {
  t += 1 / 60; flash = Math.max(0, flash - .03); shake = Math.max(0, shake - .6); intro = Math.max(0, intro - .05); toastT = Math.max(0, toastT - 1 / 60); hot = []
  ctx.save(); if ((view === 'duel' || view === 'sab' || view === 'stk' || view === 'cmb') && shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake)
  if (view === 'house') houseView(); else if (view === 'map') mapView(); else if (view === 'shop') shopView(); else if (view === 'sab' && sab) saboteurView(sab); else if (view === 'stk' && stk) stackView(stk); else if (view === 'cmb' && cmb) combatView(cmb); else if (view === 'duel' && duel) (cur.id === 'router' ? descentView : duelView)(duel)
  ctx.restore()
  spark = spark.filter(s => s.life > 0)
  for (const s of spark) { s.life -= 1 / 60 * 1.4; s.x += s.vx / 60; s.y += s.vy / 60; s.vy += 400 / 60; ctx.globalAlpha = Math.max(0, s.life); ctx.fillStyle = ['#E0954B', '#7Fb56b', '#4FB6A3'][Math.floor(Math.abs(s.x)) % 3]!; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill() }
  ctx.globalAlpha = 1
  if (intro > 0) { ctx.fillStyle = `rgba(244,236,218,${intro * 0.6})`; ctx.fillRect(0, 0, W, H) }
  const dbg = duel as unknown as { faults?: Set<string>; root?: string; entrenched?: boolean } | null
  ;(window as unknown as { __demo: object }).__demo = { view, cur: cur.id, xiu: xiuText, xiuLoading, xiuOpen, duel: duel ? duel.view() : null, sab: sab ? sab.view() : null, stk: stk ? stk.view() : null, cmb: cmb ? cmb.view() : null, dg: dg ? { dom: dg.dom.id, stage: dg.stage, deck: dg.deck.length, reward: dg.reward, cleared: dg.cleared } : null, debug: dbg ? { faults: dbg.faults ? [...dbg.faults] : null, root: dbg.root ?? null, entrenched: dbg.entrenched ?? false } : null, run: run ? { rep: run.rep, money: run.money, tools: run.tools, firstaid: run.firstaid, pos: run.pos, over: run.over, node: currentNode(run) } : null, reward }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
;(window as unknown as { __pick: (id: string) => void }).__pick = (id) => { const a = APPLIANCES.find(x => x.id === id); if (a) enter(a) }
;(window as unknown as { __duelPlay: (id: string) => void }).__duelPlay = duelPlay
;(window as unknown as { __askXiu: () => void }).__askXiu = askXiu
;(window as unknown as { __back: () => void }).__back = back
;(window as unknown as { __startRun: () => void }).__startRun = startRunFlow
;(window as unknown as { __enterNode: () => void }).__enterNode = enterNode
;(window as unknown as { __resolveDuel: () => void }).__resolveDuel = resolveDuel
;(window as unknown as { __pickReward: (id: string) => void }).__pickReward = (id) => pickReward(id as ToolId)
;(window as unknown as { __shopBuy: (id: string) => void }).__shopBuy = (id) => { if (run) buyTool(run, id as ToolId) }
;(window as unknown as { __leaveShop: () => void }).__leaveShop = () => { if (run) { advance(run); view = 'map' } }
;(window as unknown as { __startSab: () => void }).__startSab = startSab
;(window as unknown as { __sabPlay: (id: string) => void }).__sabPlay = sabPlay
;(window as unknown as { __startStk: () => void }).__startStk = startStk
;(window as unknown as { __stkPlay: (id: string) => void }).__stkPlay = stkPlay
;(window as unknown as { __startCombat: () => void }).__startCombat = () => startDungeon(NET)
;(window as unknown as { __startDungeon: (id: string) => void }).__startDungeon = (id) => startDungeon(id === 'fridge' ? FRIDGE : NET)
;(window as unknown as { __cmbPlayType: (t: string, l?: string) => void }).__cmbPlayType = (type, layer) => { if (cmb && !cmb.won && !cmb.lost) { const i = cmb.hand.indexOf(type); if (i >= 0 && cmb.canPlay(i, layer)) { cmb.play(i, layer); if (cmb.won) onCmbWin() } } }
;(window as unknown as { __cmbEnd: () => void }).__cmbEnd = () => cmbEnd()
;(window as unknown as { __cmbReward: (t: string) => void }).__cmbReward = (type) => cmbPickReward(type)
