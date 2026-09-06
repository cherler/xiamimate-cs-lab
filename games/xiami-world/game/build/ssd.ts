/**
 * 「搭机器」第五台设备 · 固态硬盘 —— 页面层。
 *
 * 仿真不在这儿:全部在 game/build/ssd-core.ts(纯内核,零 DOM)。这一层只管画和点。
 *
 * 这一屏的主角是**闪存块阵列**:一行一个块,一格一页。
 *   · 青 = 有效(存着真数据)   · 暗红 = 作废(还占着位置的垃圾)   · 深空 = 干净
 * 右边跟着每块被擦了多少次。跑一遍就能看见:随机写把块搅成花的、垃圾回收把块整片擦干净的、
 * 以及贪心回收怎么一次次可着那几个块擦(磨损)。
 */
import { mountHub, type Hub } from '../hub'
import { makeKit, STEEL, VIOLET, GOLD, GREEN, AQUA, INK } from './kit'
import { LEVELS, runSSD, sameAsIdeal, wa, COST, type Cfg, type Part, type SSDRun } from './ssd-core'
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
const PART_NAME: Record<Part, string> = { ftl: 'FTL 映射', wcache: '写缓存', plp: '掉电保护', wear: '磨损均衡' }
const PART_SUB: Record<Part, string> = { ftl: '逻辑与物理分家', wcache: '先攒在内存里', plp: '断电还够刷完', wear: '别可着一块擦' }
const PART_SKIN: Record<Part, string[]> = { ftl: AQUA, wcache: GREEN, plp: GOLD, wear: VIOLET }

// —— 状态 ——
let lvl = 0
const L = () => LEVELS[lvl]!
let capacity = 8
let victim: Cfg['victim'] = 'greedy'
let on: Record<Part, boolean> = { ftl: false, wcache: false, plp: false, wear: false }
let run: SSDRun | null = null
let readOk = true
const cfg = (): Cfg => ({ capacity, victim, ...on })

//  进度归课堂外壳管(它开场就会把存档 write 回来),这里不自己读 localStorage
let best: Record<number, { time: number }> = {}
const passed = (i: number) => best[i] !== undefined
const unlocked = (i: number) => i === 0 || passed(i - 1)

function loadLevel(i: number) {
  lvl = Math.max(0, Math.min(LEVELS.length - 1, i))
  capacity = L().capOpts[0]!; victim = L().victimOpts[0]!
  on = { ftl: false, wcache: false, plp: false, wear: false }; run = null; readOk = true
}
/** 达标:读得对、时间够;卡了擦除次数的关还得再过那一条。 */
const meets = (r: SSDRun) => readOk && r.time <= L().par.time
  && (L().par.maxErase === undefined || r.maxErase <= L().par.maxErase!)
function doRun() {
  const tr = L().trace(capacity)
  try { run = runSSD(tr, cfg(), L().nblk, L().ppb) }
  catch { run = null; readOk = false; return }    // 预留空间小到搬不动 —— 内核会炸出来
  readOk = sameAsIdeal(tr, run)
  if (meets(run)) {
    best[lvl] = { time: Math.min(best[lvl]?.time ?? Infinity, run.time) }
    HUB?.save()   // 存盘交给课堂外壳:它同时管本机与账号同步
  }
}

/* 版面竖着码,别再让哪一块压到另一块上:
   关卡条 20~52 / 页眉 74~192 / 零件 205~273 / 旋钮两行 290~358 /
   右上读数 205~358 / 块阵列 386~(H-150) / 底部读数与按钮 (H-124)~ */
function geo() { return { x0: 44, rightX: W - 372, rightW: 328, mapY: 386 } }
function levelBtns() { const bw = Math.min(210, (W - 48) / LEVELS.length - 8); return LEVELS.map((_, i) => ({ i, x: 24 + i * (bw + 8), y: 20, bw, bh: 32 })) }
function partBtns() {
  const g = geo(), gap = 10, bw = Math.min(176, (g.rightX - g.x0 - 3 * gap) / 4)
  return L().parts.map((p, i) => ({ p, x: g.x0 + i * (bw + gap), y: 205, bw, bh: 68 }))
}
/** 对外容量的档位(只有一档就不画 —— 免得看着像能调其实不能)。 */
function capBtns() {
  const g = geo(), bw = 60, gap = 8
  if (L().capOpts.length <= 1) return []
  return L().capOpts.map((v, i) => ({ v, x: g.x0 + 240 + i * (bw + gap), y: 290, bw, bh: 28 }))
}
/** 回收策略。没装 FTL 就没有回收这回事,那两个按钮也不该杵在那儿。 */
function victimBtns() {
  const g = geo(), bw = 118, gap = 8
  if (L().victimOpts.length <= 1 || !on.ftl) return []
  return L().victimOpts.map((v, i) => ({ v, x: g.x0 + 240 + i * (bw + gap), y: 324, bw, bh: 28 }))
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
  for (const b of partBtns()) if (inBox(x, y, b)) { on = { ...on, [b.p]: !on[b.p] }; run = null; readOk = true; return }
  for (const b of capBtns()) if (inBox(x, y, b)) { capacity = b.v; run = null; readOk = true; return }
  for (const b of victimBtns()) if (inBox(x, y, b)) { victim = b.v; run = null; readOk = true; return }
})
addEventListener('keydown', e => {
  if (HUB?.isPaused()) return
  if (e.key === ' ') { e.preventDefault(); doRun() }
  if (e.key === 'ArrowRight' && unlocked(lvl + 1)) loadLevel(lvl + 1)
  if (e.key === 'ArrowLeft') loadLevel(lvl - 1)
})

// —— 画 —— 物件即美术,和前四台同源(共用 game/build/kit.ts)
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

  // —— 零件拨杆 ——
  for (const b of partBtns()) {
    K.panel(b.x, b.y, b.bw, b.bh, on[b.p] ? PART_SKIN[b.p] : STEEL, 8)
    label(PART_NAME[b.p], b.x + b.bw / 2, b.y + 26, 15)
    label(PART_SUB[b.p], b.x + b.bw / 2, b.y + 45, 11, 'rgba(255,244,220,.75)')
    const sx = b.x + b.bw / 2 - 24, sy = b.y + b.bh - 13
    K.slab(sx, sy - 6, 48, 12, 6)
    ctx.fillStyle = on[b.p] ? '#ffe6a8' : '#5b5245'
    ctx.beginPath(); ctx.arc(sx + (on[b.p] ? 38 : 10), sy, 7, 0, 7); ctx.fill()
  }

  // —— 旋钮:对外容量 / 回收策略 ——
  const phys = Lv.nblk * Lv.ppb
  if (capBtns().length) {
    plain(`对外容量 · 客户底线 ${Lv.minCap} 页`, g.x0, 309, 13, CREAM)
    for (const b of capBtns()) {
      const cur = b.v === capacity
      K.panel(b.x, b.y, b.bw, b.bh, cur ? GOLD : STEEL, 5)
      if (cur) plain(String(b.v), b.x + b.bw / 2, b.y + 19, 14, '#2c1d05', 'center', 700)
      else label(String(b.v), b.x + b.bw / 2, b.y + 19, 14)
    }
    plain(`声称 ${capacity} 页 / 物理 ${phys} 页 —— 预留 ${phys - capacity} 页给周转`,
      g.x0 + 240 + Lv.capOpts.length * 68 + 8, 309, 12, DIM)
  } else plain(`对外容量 ${capacity} 页 / 物理 ${phys} 页(这一关不给调)`, g.x0, 309, 13, DIM)
  if (victimBtns().length) {
    plain('垃圾回收先挑哪块', g.x0, 343, 13, CREAM)
    for (const b of victimBtns()) {
      const cur = b.v === victim
      K.panel(b.x, b.y, b.bw, b.bh, cur ? GOLD : STEEL, 5)
      const t = b.v === 'greedy' ? '有效页最少的' : '按块号轮着来'
      if (cur) plain(t, b.x + b.bw / 2, b.y + 19, 13, '#2c1d05', 'center', 700)
      else label(t, b.x + b.bw / 2, b.y + 19, 13)
    }
  } else if (Lv.victimOpts.length > 1) plain('(装上 FTL 映射才谈得上垃圾回收 —— 那两个选项才会出来)', g.x0, 343, 12, DIM)

  // —— 右上读数:写放大 / 擦除 / 丢失 ——
  {
    const x = g.rightX, w = g.rightW
    K.panel(x, 205, w, 153, INK, 8)
    label('这块盘跑下来', x + w / 2, 228, 13, 'rgba(255,244,220,.85)')
    if (!run) plain('(还没跑)', x + 20, 258, 14, DIM)
    else {
      const amp = wa(run)
      plain(`写放大 ${amp.toFixed(2)}`, x + 20, 258, 19, amp > 3 ? '#ffb4a2' : amp > 1.6 ? AMBER : TEAL, 'left', 700)
      plain(`用户写 ${run.hostWrites} 页 · 闪存实际写了 ${run.flashWrites} 页`, x + 20, 280, 12, DIM)
      plain(`擦除 ${run.erases} 次 · 回收 ${run.gcRuns} 轮 · 最惨那块擦了 ${run.maxErase} 次`, x + 20, 302, 12, CREAM)
      plain(run.lost ? `⚠️ 断电丢了 ${run.lost} 页还没落盘的数据` : '断电没丢数据', x + 20, 326, 13, run.lost ? RED : TEAL)
      plain(`(读 ${COST.read} 拍 · 写 ${COST.prog} 拍 · 擦 ${COST.erase} 拍)`, x + 20, 346, 11, DIM)
    }
  }

  // —— 闪存块阵列 ——
  {
    const bot = H - 150, avail = bot - g.mapY
    const rowH = Math.min(30, avail / Lv.nblk)
    const cw = Math.min(56, (W - g.x0 - 260) / Lv.ppb)
    plain('闪存:一行一个块,一格一页', g.x0, g.mapY - 10, 13, CREAM, 'left', 700)
    plain('青 = 有效    暗红 = 作废的垃圾    深 = 干净', g.x0 + 200, g.mapY - 10, 12, DIM)
    for (let b = 0; b < Lv.nblk; b++) {
      const y = g.mapY + b * rowH
      plain(`块 ${b}`, g.x0, y + rowH * .68, 11, DIM)
      for (let pi = 0; pi < Lv.ppb; pi++) {
        const x = g.x0 + 40 + pi * (cw + 3)
        const st = run?.snapshot[b]?.pages[pi]
        const col = st === 'valid' ? 'rgba(73,167,145,.92)' : st === 'invalid' ? 'rgba(150,70,58,.85)' : 'rgba(38,33,26,.85)'
        K.rr(x, y + 2, cw, rowH - 6, 3); ctx.fillStyle = col; ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke()
      }
      //  每块被擦了多少次 —— 一条长短正比的小条,磨损不均一眼看得出
      const ex = g.x0 + 40 + Lv.ppb * (cw + 3) + 12
      const e = run?.snapshot[b]?.erases ?? 0, mx = Math.max(1, run?.maxErase ?? 1)
      K.slab(ex, y + 3, 150, rowH - 8, 3)
      ctx.fillStyle = e >= mx ? '#c8452e' : '#7d6a4a'
      K.rr(ex + 2, y + 5, Math.max(1, 146 * e / mx), rowH - 12, 2); ctx.fill()
      plain(`擦 ${e}`, ex + 160, y + rowH * .68, 11, DIM)
    }
  }

  // —— 底部读数 ——
  {
    const y = H - 124, bw = W - 260
    K.slab(g.x0, y, bw, 100, 10)
    const par = Lv.par
    if (!run) {
      if (!readOk) label('这个容量报太满了,垃圾回收连搬家的落脚点都没有 —— 往下调', g.x0 + bw / 2, y + 56, 18, '#ffb4a2')
      else {
        plain('按「运行机器」把这串读写跑一遍。', g.x0 + 20, y + 34, 15, CREAM)
        plain(`目标:${par.time} 拍以内${par.maxErase ? `,而且最惨那块的擦除次数不超过 ${par.maxErase}` : ''}。`, g.x0 + 20, y + 62, 14, DIM)
      }
    } else {
      const okTime = run.time <= par.time, okE = par.maxErase === undefined || run.maxErase <= par.maxErase
      plain(`总时间 ${run.time} 拍`, g.x0 + 20, y + 40, 21, okTime ? TEAL : AMBER, 'left', 700)
      plain(`目标 ${par.time}`, g.x0 + 210, y + 40, 13, DIM)
      if (par.maxErase !== undefined) {
        plain(`最大擦除 ${run.maxErase} 次`, g.x0 + 310, y + 40, 21, okE ? TEAL : '#ffb4a2', 'left', 700)
        plain(`上限 ${par.maxErase}`, g.x0 + 500, y + 40, 13, DIM)
      }
      //  这一行是这台机器和 Cache/推理引擎最大的不同:它真的会读错
      plain(readOk ? '✓ 每一次读到的都和理想盘一样'
        : `✗ 读到了旧值 —— 断电那一下,写缓存里还没落盘的数据就没了(丢了 ${run.lost} 页)`,
        g.x0 + 20, y + 74, 14, readOk ? TEAL : RED)
      if (meets(run)) label(`达标!${Lv.finale ? '这块盘能卖了' : '下一关'}`, g.x0 + bw - 130, y + 40, 17, '#ffe6a8')
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
  title: '搭机器 · 固态硬盘',
  key: 'ssd',
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

// dev 钩子(冒烟脚本按这些来)—— 仿真本身在 ssd-core.ts 里,这里只把页面状态露出来
type Win = Record<string, unknown>
;(window as unknown as Win).__ssdLevels = () => LEVELS.map(l => l.name)
;(window as unknown as Win).__ssdTexts = () => LEVELS.flatMap(l => [l.name, l.short, l.story, l.hint])
;(window as unknown as Win).__ssdPlay = (i: number) => { loadLevel(i); return { nblk: L().nblk, ppb: L().ppb, minCap: L().minCap, capOpts: L().capOpts, parts: L().parts, par: L().par } }
;(window as unknown as Win).__ssdSet = (c: Partial<Cfg>) => {
  if (c.capacity !== undefined) capacity = c.capacity
  if (c.victim !== undefined) victim = c.victim
  on = { ftl: !!c.ftl, wcache: !!c.wcache, plp: !!c.plp, wear: !!c.wear }; run = null; readOk = true
}
;(window as unknown as Win).__ssdNow = () => ({ capacity, victim, ...on })
;(window as unknown as Win).__ssdRun = () => {
  doRun()
  return run ? { time: run.time, wa: +wa(run).toFixed(3), erases: run.erases, maxErase: run.maxErase, gcRuns: run.gcRuns, lost: run.lost, readOk, ok: meets(run) } : { readOk, blown: true }
}
;(window as unknown as Win).__ssdUI = () => ({ parts: partBtns(), caps: capBtns(), victims: victimBtns(), runBtn: runBtn(), top: cv.getBoundingClientRect().top })
