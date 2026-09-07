/**
 * 「搭机器」第六台设备 · 内存条(DRAM 控制器)—— 页面层。
 *
 * 仿真不在这儿:全部在 game/build/dram-core.ts(纯内核,零 DOM)。这一层只管画和点。
 *
 * 这一屏有两个主角:
 *   · 上面的**地址位条** —— 又是「在地址上下刀」,这回切出 [ row | bank | col ]。
 *     和路由器切网络号、Cache 切 tag/index、固态硬盘按页取整是同一个动作,考的却是并行度。
 *   · 下面的 **bank 时间线** —— 一行一个 bank,暗段是开销(PRE/ACT),亮段才是真正取数。
 *     行命中就只剩亮段;几个 bank 的暗段互相错开,那就是 bank 并行。
 */
import { mountHub, type Hub } from '../hub'
import { makeKit, BRASS, STEEL, VIOLET, GOLD, GREEN, ROSE, INK } from './kit'
import { LEVELS, runDram, sameAsInOrder, decode, T, COLBITS, NBITS, type Cfg, type Part, type DramRun } from './dram-core'
import corrUrl from '../../web/assets/gen/gates/corridor.webp'

let HUB: Hub | null = null
const CORR = (() => { const i = new Image(); i.src = corrUrl; return i })()
const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
//  画布上面还有一条「虾米课堂」外壳条,所以量画布自己的尺寸 —— 读 innerHeight 会多算 36px
function resize() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()

const CREAM = '#efe6d2', AMBER = '#e8c98a', TEAL = '#49a791', RED = '#c8452e', DIM = '#9a8a6a'
const PART_NAME: Record<Part, string> = { sched: '行命中优先调度', wbuf: '写缓冲', fwd: '写回读转发' }
const PART_SUB: Record<Part, string> = { sched: '往后看,凑同一行', wbuf: '写攒起来批量排', fwd: '读之前翻一眼缓冲' }
const PART_SKIN: Record<Part, string[]> = { sched: GREEN, wbuf: ROSE, fwd: GOLD }

// —— 状态 ——
let lvl = 0
const L = () => LEVELS[lvl]!
let page: Cfg['page'] = 'closed'
let banks = 1
let bankBits: Cfg['bankBits'] = 'low'
let win = 1
let on: Record<Part, boolean> = { sched: false, wbuf: false, fwd: false }
let run: DramRun | null = null
let readOk = true
const cfg = (): Cfg => ({ banks, bankBits, window: win, page, ...on })

//  进度归课堂外壳管(它开场就会把存档 write 回来),这里不自己读 localStorage
let best: Record<number, { time: number }> = {}
const passed = (i: number) => best[i] !== undefined
const unlocked = (i: number) => i === 0 || passed(i - 1)

function loadLevel(i: number) {
  lvl = Math.max(0, Math.min(LEVELS.length - 1, i))
  page = L().pageOpts[0]!; banks = L().bankOpts[0]!; bankBits = L().bankBitOpts[0]!; win = L().winOpts[0]!
  on = { sched: false, wbuf: false, fwd: false }; run = null; readOk = true
}
const meets = (r: DramRun) => readOk && r.time <= L().par.time
function doRun() {
  run = runDram(L().reqs, cfg())
  readOk = sameAsInOrder(L().reqs, run)
  if (meets(run)) {
    best[lvl] = { time: Math.min(best[lvl]?.time ?? Infinity, run.time) }
    HUB?.save()   // 存盘交给课堂外壳:它同时管本机与账号同步
  }
}

/* 版面竖着码,别再让哪一块压到另一块上:
   关卡条 20~52 / 页眉 74~192 / 地址位条 205~255(段标签到 278)/
   旋钮两行 296~366(左右两栏)/ 右侧零件 205~273、读数 290~382 /
   bank 时间线 400~(H-150) / 底部读数与按钮 (H-124)~ */
function geo() {
  const barX = 44, barW = Math.min(760, W - 480)
  return { barX, barW, cw: barW / NBITS, barY: 205, barH: 50, rightX: W - 372, rightW: 328, colR: 470 }
}
function levelBtns() { const bw = Math.min(210, (W - 48) / LEVELS.length - 8); return LEVELS.map((_, i) => ({ i, x: 24 + i * (bw + 8), y: 20, bw, bh: 32 })) }
function partBtns() {
  const g = geo(), gap = 10, bw = (g.rightW - 2 * gap) / 3
  return L().parts.map((p, i) => ({ p, x: g.rightX + i * (bw + gap), y: 205, bw, bh: 68 }))
}
/** 四个旋钮排成两行两栏。只有一档的那个不画 —— 免得看着像能调其实不能。 */
type KnobKey = 'page' | 'banks' | 'bankBits' | 'win'
function knobRows(): { key: KnobKey; label: string; opts: (string | number)[]; val: string | number; x: number; y: number }[] {
  const g = geo(), Lv = L(), out: ReturnType<typeof knobRows> = []
  const cand: [KnobKey, string, (string | number)[], string | number, number, number][] = [
    ['page', '页策略', Lv.pageOpts, page, g.barX, 296],
    ['banks', 'bank 数', Lv.bankOpts, banks, g.barX, 334],
    ['bankBits', 'bank 位切在', Lv.bankBitOpts, bankBits, g.barX + g.colR, 296],
    ['win', '调度窗口', Lv.winOpts, win, g.barX + g.colR, 334],
  ]
  for (const [key, label, opts, val, x, y] of cand) {
    if (opts.length <= 1) continue
    if (key === 'bankBits' && banks === 1) continue      // 一个 bank,切法没意义
    if (key === 'win' && !on.sched) continue             // 没装调度器,窗口没意义
    out.push({ key, label, opts, val, x, y })
  }
  return out
}
const knobText = (k: KnobKey, v: string | number) =>
  k === 'page' ? (v === 'open' ? '开页' : '关页') : k === 'bankBits' ? (v === 'low' ? '交织(低位)' : '取高位') : String(v)
function knobBtns() {
  return knobRows().flatMap(r => r.opts.map((v, i) => {
    const bw = r.key === 'page' ? 64 : r.key === 'bankBits' ? 104 : 52
    return { r, v, x: r.x + 116 + i * (bw + 8), y: r.y, bw, bh: 28 }
  }))
}
function runBtn() { const bw = 168, bh = 52; return { x: W - bw - 24, y: H - bh - 18, bw, bh } }

/** 画布上面是「虾米课堂」外壳条,命中判断一律用画布内坐标。 */
const at = (e: { clientX: number; clientY: number }) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
const inBox = (x: number, y: number, b: { x: number; y: number; bw: number; bh: number }) => x >= b.x && x <= b.x + b.bw && y >= b.y && y <= b.y + b.bh
cv.addEventListener('pointerdown', ev => {
  if (HUB?.isPaused()) return
  const { x, y } = at(ev)
  for (const b of levelBtns()) if (unlocked(b.i) && inBox(x, y, b)) { loadLevel(b.i); return }
  if (inBox(x, y, runBtn())) { doRun(); return }
  for (const b of partBtns()) if (inBox(x, y, b)) {
    on = { ...on, [b.p]: !on[b.p] }
    //  刚装上调度器却还留着窗口 1,那等于装了个不干活的零件
    if (b.p === 'sched' && on.sched && win === 1) win = L().winOpts.find(w => w > 1) ?? 1
    run = null; readOk = true; return
  }
  for (const b of knobBtns()) if (inBox(x, y, b)) {
    if (b.r.key === 'page') page = b.v as Cfg['page']
    else if (b.r.key === 'banks') banks = b.v as number
    else if (b.r.key === 'bankBits') bankBits = b.v as Cfg['bankBits']
    else win = b.v as number
    run = null; readOk = true; return
  }
})
addEventListener('keydown', e => {
  if (HUB?.isPaused()) return
  if (e.key === ' ') { e.preventDefault(); doRun() }
  if (e.key === 'ArrowRight' && unlocked(lvl + 1)) loadLevel(lvl + 1)
  if (e.key === 'ArrowLeft') loadLevel(lvl - 1)
})

// —— 画 —— 物件即美术,和前五台同源(共用 game/build/kit.ts)
const K = makeKit(ctx)
/** 面板上的字:亮填充 + 深描边。深色字压在冷钢/黄铜上会糊成一团 —— 前面栽过。 */
function label(t: string, x: number, y: number, size: number, fill = '#fff3dc', align: CanvasTextAlign = 'center') {
  ctx.font = `700 ${size}px ui-sans-serif,system-ui`; ctx.textAlign = align
  ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = 'rgba(18,12,6,.72)'; ctx.lineJoin = 'round'
  ctx.strokeText(t, x, y); ctx.fillStyle = fill; ctx.fillText(t, x, y)
}
const plain = (t: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', weight = 400) => {
  ctx.font = `${weight} ${size}px ui-sans-serif,system-ui`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(t, x, y)
}

function frame() {
  ctx.clearRect(0, 0, W, H)
  K.coverImg(CORR, 0, 0, W, H, .78)   // 同一条走廊,压暗 —— 你还在这台机器肚子里
  const g = geo(), Lv = L()

  // 关卡条
  for (const b of levelBtns()) {
    const state = b.i === lvl ? GOLD : passed(b.i) ? GREEN : unlocked(b.i) ? STEEL : ['#2b2822', '#211e19', '#141210']
    K.panel(b.x, b.y, b.bw, b.bh, state, 6)
    const txt = `${b.i}. ${LEVELS[b.i]!.short}`
    //  选中那块是亮金色,亮字压上去糊成一片 —— 这一块反过来用深字
    if (b.i === lvl) plain(txt, b.x + b.bw / 2, b.y + 21, 13, '#2c1d05', 'center', 700)
    else label(txt, b.x + b.bw / 2, b.y + 21, 13, unlocked(b.i) ? '#fff3dc' : '#6b6357')
  }

  // 页眉
  plain(Lv.name, 44, 92, 22, CREAM, 'left', 700)
  plain(Lv.story, 44, 116, 14, AMBER)
  ctx.font = '13px ui-sans-serif,system-ui'; ctx.fillStyle = DIM; ctx.textAlign = 'left'
  K.wrapText(Lv.hint, 44, 140, W - 88, 19, 4)

  // —— 地址位条:[ row | bank | col ] ——
  {
    const bb = Math.round(Math.log2(banks))
    plain('一个地址进来,先切成三段:哪一行、哪个 bank、行里第几个字', g.barX, 196, 13, DIM)
    for (let bit = NBITS - 1; bit >= 0; bit--) {
      const x = g.barX + (NBITS - 1 - bit) * g.cw
      //  哪几位当 bank,取决于 bank 位切在低位还是高位 —— 这就是这一屏最要紧的那把刀
      const isCol = bit < COLBITS
      const isBank = bb > 0 && (bankBits === 'low'
        ? bit >= COLBITS && bit < COLBITS + bb
        : bit >= NBITS - bb)
      K.panel(x + 2, g.barY, g.cw - 4, g.barH, isCol ? BRASS : isBank ? VIOLET : STEEL, 5)
      label(String(bit), x + g.cw / 2, g.barY + 22, 13)
      label(isCol ? '字' : isBank ? 'bank' : 'row', x + g.cw / 2, g.barY + 40, 10, 'rgba(255,244,220,.8)')
    }
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; K.rr(g.barX, g.barY - 3, g.barW, g.barH + 6, 7); ctx.stroke()
    plain(`一行 ${1 << COLBITS} 个字 · ${banks} 个 bank · bank 位取${bankBits === 'low' ? '低位(相邻的行摊到不同 bank)' : '高位(一大片地址全压在一个 bank 上)'}`,
      g.barX, g.barY + g.barH + 22, 12, bankBits === 'low' || banks === 1 ? DIM : '#ffb4a2')
  }

  // —— 旋钮 ——
  for (const r of knobRows()) plain(r.label, r.x, r.y + 19, 13, CREAM)
  for (const b of knobBtns()) {
    const cur = b.r.val === b.v
    K.panel(b.x, b.y, b.bw, b.bh, cur ? GOLD : STEEL, 5)
    const t = knobText(b.r.key, b.v)
    if (cur) plain(t, b.x + b.bw / 2, b.y + 19, 13, '#2c1d05', 'center', 700)
    else label(t, b.x + b.bw / 2, b.y + 19, 13)
  }

  // —— 零件拨杆 ——
  for (const b of partBtns()) {
    K.panel(b.x, b.y, b.bw, b.bh, on[b.p] ? PART_SKIN[b.p] : STEEL, 8)
    label(PART_NAME[b.p], b.x + b.bw / 2, b.y + 24, 13)
    label(PART_SUB[b.p], b.x + b.bw / 2, b.y + 43, 10, 'rgba(255,244,220,.75)')
    const sx = b.x + b.bw / 2 - 22, sy = b.y + b.bh - 13
    K.slab(sx, sy - 6, 44, 12, 6)
    ctx.fillStyle = on[b.p] ? '#ffe6a8' : '#5b5245'
    ctx.beginPath(); ctx.arc(sx + (on[b.p] ? 34 : 10), sy, 6.5, 0, 7); ctx.fill()
  }

  // —— 右侧读数 ——
  {
    const x = g.rightX, w = g.rightW
    K.panel(x, 290, w, 92, INK, 8)
    if (!run) plain('(还没跑 —— 按「运行机器」)', x + 20, 322, 13, DIM)
    else {
      const tot = run.hits + run.conflicts + run.empties
      plain(`行命中 ${run.hits} / ${tot}(${Math.round(100 * run.hits / Math.max(1, tot))}%)   行冲突 ${run.conflicts}`, x + 20, 316, 13, CREAM)
      plain(`总线掉头 ${run.turns} 次 · 重排 ${run.reordered} 次 · 撞写缓冲 ${run.hazards} 次`, x + 20, 338, 12, run.hazards ? '#ffb4a2' : DIM)
      plain(`(ACT ${T.act} · CAS ${T.cas} · PRE ${T.pre} · 掉头 ${T.turn})`, x + 20, 362, 11, DIM)
    }
  }

  // —— bank 时间线 ——
  {
    const y0 = 400, bot = H - 150
    const rowH = Math.min(46, (bot - y0 - 24) / banks)
    const tx = g.barX + 80, tw = W - tx - 44
    const total = run?.time || 1
    plain('每个 bank 什么时候在忙', g.barX, y0 - 10, 13, CREAM, 'left', 700)
    plain(run ? '暗 = 开销(关行 / 激活)    亮 = 真正取数    青=行命中 红=行冲突 黄=行是空的' : '(还没跑)',
      g.barX + 170, y0 - 10, 12, DIM)
    for (let b = 0; b < banks; b++) {
      const y = y0 + b * rowH
      plain(`bank ${b}`, g.barX, y + rowH * .6, 12, DIM)
      K.slab(tx, y + 2, tw, rowH - 8, 3)
      if (!run) continue
      for (const e of run.timeline) {
        if (e.bank !== b) continue
        const x1 = tx + tw * (e.bankStart / total), x2 = tx + tw * (e.start / total), x3 = tx + tw * (e.end / total)
        //  暗段:这个 bank 为它做的准备(关掉旧行 / 激活新行)
        if (x2 > x1 + .4) { ctx.fillStyle = 'rgba(120,104,78,.75)'; ctx.fillRect(x1, y + 4, Math.max(.6, x2 - x1), rowH - 12) }
        //  亮段:真正取数那一下
        ctx.fillStyle = e.kind === 'hit' ? 'rgba(73,167,145,.95)' : e.kind === 'conflict' ? 'rgba(200,69,46,.95)' : 'rgba(232,201,138,.95)'
        ctx.fillRect(x2, y + 4, Math.max(1, x3 - x2), rowH - 12)
      }
      //  这个 bank 一共忙了多久 —— bank 之间差得多不多,一眼看得出
      plain(`忙 ${run.busy[b] ?? 0}`, tx + tw + 4, y + rowH * .6, 11, DIM, 'right')
    }
    if (run) for (let t = 0; t <= 4; t++) {
      const x = tx + tw * t / 4
      plain(String(Math.round(total * t / 4)), x, y0 + banks * rowH + 14, 11, DIM, t === 4 ? 'right' : 'left')
    }
  }

  // —— 底部读数 ——
  {
    const y = H - 124, bw = W - 260
    K.slab(g.barX, y, bw, 100, 10)
    if (!run) {
      plain('按「运行机器」把这串读写跑一遍。', g.barX + 20, y + 34, 15, CREAM)
      plain(`目标:${Lv.par.time} 拍以内。`, g.barX + 20, y + 62, 14, DIM)
    } else {
      plain(`总时间 ${run.time} 拍`, g.barX + 20, y + 42, 21, run.time <= Lv.par.time ? TEAL : AMBER, 'left', 700)
      plain(`目标 ${Lv.par.time}`, g.barX + 210, y + 42, 13, DIM)
      plain(readOk ? '✓ 每一次读到的都和「按到达顺序一个个做」一样'
        : `✗ 读到了旧值 —— 它要的东西还躺在写缓冲里没排下去(撞了 ${run.hazards} 次)`,
        g.barX + 20, y + 76, 14, readOk ? TEAL : RED)
      if (meets(run)) label(`达标!${Lv.finale ? '这条内存总线通了' : '下一关'}`, g.barX + bw - 130, y + 42, 17, '#ffe6a8')
    }
  }
  const R = runBtn()
  K.panel(R.x, R.y, R.bw, R.bh, GREEN, 9)
  label('▶ 运行机器', R.x + R.bw / 2, R.y + R.bh / 2 + 6, 17, '#f2fff0')
  requestAnimationFrame(frame)
}

loadLevel(0)
requestAnimationFrame(frame)

// —— 虾米课堂外壳:返回主页 / 暂停 / 关卡进度(本机 + 账号同步)——
HUB = mountHub({
  title: '搭机器 · 内存条 DRAM',
  key: 'dram',
  links: [
    { label: '← 回房子 · 路由器', href: new URL('./', location.href).href },
    { label: '← Cache 内存层级', href: new URL('cache.html', location.href).href },
  ],
  read: () => best,
  write: d => { if (d && typeof d === 'object') best = d as Record<number, { time: number }> },
  reset: () => { best = {}; loadLevel(0) },
  summary: () => {
    const done = LEVELS.filter((_, i) => passed(i)).length
    const lines = [`通过 ${done} / ${LEVELS.length} 关`]
    LEVELS.forEach((Lv, i) => {
      const b = best[i]
      lines.push(b ? `${i}. ${Lv.short} —— 最好 ${b.time} 拍(目标 ${Lv.par.time})` : `${i}. ${Lv.short} —— ${unlocked(i) ? '还没通' : '未解锁'}`)
    })
    return lines
  },
})

// dev 钩子(冒烟脚本按这些来)—— 仿真本身在 dram-core.ts 里,这里只把页面状态露出来
type Win = Record<string, unknown>
;(window as unknown as Win).__dramLevels = () => LEVELS.map(l => l.name)
;(window as unknown as Win).__dramTexts = () => LEVELS.flatMap(l => [l.name, l.short, l.story, l.hint])
;(window as unknown as Win).__dramPlay = (i: number) => { loadLevel(i); return { reqs: L().reqs.length, pageOpts: L().pageOpts, bankOpts: L().bankOpts, bankBitOpts: L().bankBitOpts, winOpts: L().winOpts, parts: L().parts, par: L().par } }
;(window as unknown as Win).__dramSet = (c: Partial<Cfg>) => {
  if (c.page !== undefined) page = c.page
  if (c.banks !== undefined) banks = c.banks
  if (c.bankBits !== undefined) bankBits = c.bankBits
  if (c.window !== undefined) win = c.window
  on = { sched: !!c.sched, wbuf: !!c.wbuf, fwd: !!c.fwd }; run = null; readOk = true
}
;(window as unknown as Win).__dramNow = () => ({ banks, bankBits, window: win, page, ...on })
;(window as unknown as Win).__dramRun = () => {
  doRun()
  return run ? { time: run.time, hits: run.hits, conflicts: run.conflicts, turns: run.turns, reordered: run.reordered, hazards: run.hazards, busy: [...run.busy], readOk, ok: meets(run) } : null
}
;(window as unknown as Win).__dramUI = () => ({ parts: partBtns(), knobs: knobBtns().map(b => ({ key: b.r.key, v: b.v, x: b.x, y: b.y, bw: b.bw, bh: b.bh })), runBtn: runBtn(), top: cv.getBoundingClientRect().top })
;(window as unknown as Win).__dramDecode = (a: number) => decode(a, cfg())
