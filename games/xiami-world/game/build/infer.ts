/**
 * 「搭机器」第四台设备 · 大模型推理引擎 —— 页面层。
 *
 * 仿真不在这儿:全部在 game/build/infer-core.ts(纯内核,零 DOM)。这一层只管画和点。
 * (这条规矩是 Cache 那台立下的,好处见那边的文件头。)
 *
 * 这一屏的主角是**甘特图**:每个请求一行,横轴是时间。
 *   · 绿 = 它在生成
 *   · 灰 = 它已经说完了,却还占着位置陪跑 —— 这就是静态批的「气泡」
 * 装上〈连续批处理〉之后灰段整个消失、后面的请求往前挤 —— 那一下比任何文案都清楚。
 */
import { mountHub, type Hub } from '../hub'
import { makeKit, STEEL, VIOLET, GOLD, GREEN, AQUA, ROSE, INK } from './kit'
import { LEVELS, runEngine, sameAsNaive, COST, type Cfg, type Part, type EngineRun } from './infer-core'
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
const PART_NAME: Record<Part, string> = { kvcache: 'KV Cache', paged: '分页 KV', cont: '连续批处理', speculate: '投机解码' }
const PART_SUB: Record<Part, string> = { kvcache: '算过的存下来', paged: '一页一页地放', cont: '谁说完谁就走', speculate: '小模型先抢答' }
const PART_SKIN: Record<Part, string[]> = { kvcache: AQUA, paged: VIOLET, cont: GREEN, speculate: ROSE }

// —— 状态 ——
let lvl = 0
const L = () => LEVELS[lvl]!
let batch = 1, page = 8, spec = 0
let on: Record<Part, boolean> = { kvcache: false, paged: false, cont: false, speculate: false }
let run: EngineRun | null = null
const cfg = (): Cfg => ({ batch, page, spec, ...on })

//  进度归课堂外壳管(它开场就会把存档 write 回来),这里不自己读 localStorage
let best: Record<number, { time: number }> = {}
const passed = (i: number) => best[i] !== undefined
const unlocked = (i: number) => i === 0 || passed(i - 1)

function loadLevel(i: number) {
  lvl = Math.max(0, Math.min(LEVELS.length - 1, i))
  batch = L().batchOpts[0]!; page = L().pageOpts[0]!; spec = L().specOpts[0]!
  on = { kvcache: false, paged: false, cont: false, speculate: false }; run = null
}
/** 达标:时间要够;卡了吐字间隔的关还得再过那一条。 */
const meets = (r: EngineRun) => r.time <= L().par.time && (L().par.tpot === undefined || r.tpot <= L().par.tpot!)
function doRun() {
  run = runEngine(L().reqs, cfg(), L().vram, L().maxLen)
  if (meets(run)) {
    best[lvl] = { time: Math.min(best[lvl]?.time ?? Infinity, run.time) }
    HUB?.save()   // 存盘交给课堂外壳:它同时管本机与账号同步
  }
}

/* 版面竖着码,别再让哪一块压到另一块上:
   关卡条 20~52 / 页眉 74~192 / 零件 205~273 / 旋钮 290~392(三行)/
   显存条右上 205~273 / 甘特图 420~(H-150) / 底部读数与按钮 (H-124)~ */
function geo() { return { x0: 44, rightX: W - 372, rightW: 328, ganttX: 250, ganttY: 420 } }
function levelBtns() { const bw = Math.min(210, (W - 48) / LEVELS.length - 8); return LEVELS.map((_, i) => ({ i, x: 24 + i * (bw + 8), y: 20, bw, bh: 32 })) }
function partBtns() {
  const g = geo(), gap = 10, bw = Math.min(176, (g.rightX - g.x0 - 3 * gap) / 4)
  return L().parts.map((p, i) => ({ p, x: g.x0 + i * (bw + gap), y: 205, bw, bh: 68 }))
}
/** 三个旋钮各占一行:一行档位按钮。没得选(只有一档)的旋钮不画 —— 免得看着像能调其实不能。 */
type Knob = { key: 'batch' | 'page' | 'spec'; label: string; opts: number[]; val: number; row: number }
function knobs(): Knob[] {
  const Lv = L(), out: Knob[] = []
  const rows: [Knob['key'], string, number[], number][] = [
    ['batch', '批大小 · 一次跑几个请求', Lv.batchOpts, batch],
    ['page', '页大小 · 几个 token 一页', Lv.pageOpts, page],
    ['spec', '草稿长度 · 一次先猜几个', Lv.specOpts.filter(k => k > 0), spec],
  ]
  let r = 0
  for (const [key, label, opts, val] of rows) {
    if (opts.length <= 1) continue                          // 这一关没给这个旋钮
    if (key === 'page' && !on.paged) continue               // 没装分页,页大小没有意义
    if (key === 'spec' && !on.speculate) continue           // 没装投机,草稿长度没有意义
    out.push({ key, label, opts, val, row: r++ })
  }
  return out
}
function knobBtns() {
  const g = geo(), bw = 52, gap = 8
  return knobs().flatMap(k => k.opts.map((v, i) => ({ k, v, x: g.x0 + 240 + i * (bw + gap), y: 290 + k.row * 34, bw, bh: 28 })))
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
    //  刚装上投机却还没定草稿长度的话,给它一个能用的默认值 —— 留 0 等于装了个不干活的零件
    if (b.p === 'speculate' && on.speculate && spec === 0) spec = L().specOpts.find(k => k > 0) ?? 1
    run = null; return
  }
  for (const b of knobBtns()) if (inBox(x, y, b)) {
    if (b.k.key === 'batch') batch = b.v; else if (b.k.key === 'page') page = b.v; else spec = b.v
    run = null; return
  }
})
addEventListener('keydown', e => {
  if (HUB?.isPaused()) return
  if (e.key === ' ') { e.preventDefault(); doRun() }
  if (e.key === 'ArrowRight' && unlocked(lvl + 1)) loadLevel(lvl + 1)
  if (e.key === 'ArrowLeft') loadLevel(lvl - 1)
})

// —— 画 —— 物件即美术,和前三台同源(共用 game/build/kit.ts)
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

  // —— 零件拨杆(这台机器的零件不占位置,所以是机身上的开关,不是托盘里的件)——
  for (const b of partBtns()) {
    K.panel(b.x, b.y, b.bw, b.bh, on[b.p] ? PART_SKIN[b.p] : STEEL, 8)
    label(PART_NAME[b.p], b.x + b.bw / 2, b.y + 26, 15)
    label(PART_SUB[b.p], b.x + b.bw / 2, b.y + 45, 11, 'rgba(255,244,220,.75)')
    const sx = b.x + b.bw / 2 - 24, sy = b.y + b.bh - 13
    K.slab(sx, sy - 6, 48, 12, 6)
    ctx.fillStyle = on[b.p] ? '#ffe6a8' : '#5b5245'
    ctx.beginPath(); ctx.arc(sx + (on[b.p] ? 38 : 10), sy, 7, 0, 7); ctx.fill()
  }

  // —— 旋钮:一行一个 ——
  for (const k of knobs()) plain(k.label, g.x0, 290 + k.row * 34 + 19, 13, CREAM)
  for (const b of knobBtns()) {
    const cur = b.k.val === b.v
    K.panel(b.x, b.y, b.bw, b.bh, cur ? GOLD : STEEL, 5)
    if (cur) plain(String(b.v), b.x + b.bw / 2, b.y + 19, 14, '#2c1d05', 'center', 700)
    else label(String(b.v), b.x + b.bw / 2, b.y + 19, 14)
  }
  if (!knobs().length) plain('(这一关没有旋钮可调 —— 只看那个零件装不装)', g.x0, 309, 13, DIM)

  // —— 显存条:HBM 是给死的 ——
  {
    const x = g.rightX, w = g.rightW
    const peak = run?.peak ?? 0
    K.panel(x, 205, w, 68, INK, 8)
    label('显存', x + 46, 232, 13, 'rgba(255,244,220,.85)')
    label(`${peak} / ${Lv.vram}`, x + 46, 254, 15)
    K.slab(x + 92, 222, w - 112, 20, 5)
    ctx.fillStyle = peak > Lv.vram ? RED : TEAL
    K.rr(x + 95, 225, Math.max(2, (w - 118) * Math.min(1, peak / Lv.vram)), 14, 4); ctx.fill()
    plain(on.paged ? `分页:一个请求按它自己要的页数占` : `不分页:一个请求要按最长上下文 ${Lv.maxLen} 连续预留`,
      x + 92, 262, 12, on.paged ? TEAL : '#ffb4a2')
  }

  // —— 甘特图:每个请求一行 ——
  {
    const n = Lv.reqs.length
    const bot = H - 150, avail = bot - g.ganttY
    const rowH = Math.min(30, avail / n)
    const gx = g.ganttX, gw = W - gx - 44
    const total = run?.time || 1
    plain('每个请求什么时候在跑', g.x0, g.ganttY - 10, 13, CREAM, 'left', 700)
    plain(run ? '绿 = 正在生成    灰 = 已经说完了,却还占着位置陪跑(气泡)' : '(还没跑 —— 按「运行机器」)',
      g.x0 + 170, g.ganttY - 10, 12, DIM)
    for (let i = 0; i < n; i++) {
      const y = g.ganttY + i * rowH, r = Lv.reqs[i]!
      plain(`请求 ${i} · 提示 ${r.prompt.length} 字 · 要说 ${r.out} 字`, g.x0, y + rowH * .68, 12, DIM)
      K.slab(gx, y + 2, gw, rowH - 6, 3)
      if (!run) continue
      const sx = gx + gw * (run.startAt[i]! / total)
      const fx = gx + gw * (run.finish[i]! / total)
      const lx = gx + gw * (run.leaveAt[i]! / total)
      ctx.fillStyle = 'rgba(73,167,145,.92)'; K.rr(sx, y + 3, Math.max(2, fx - sx), rowH - 8, 3); ctx.fill()
      if (lx > fx + 1) {   // 陪跑段 —— 静态批才有
        ctx.fillStyle = 'rgba(120,110,92,.85)'; K.rr(fx, y + 3, lx - fx, rowH - 8, 3); ctx.fill()
      }
    }
    if (run) {
      //  时间轴:四个刻度,让「总时间」不是一个抽象数字
      for (let t = 0; t <= 4; t++) {
        const x = gx + gw * t / 4
        ctx.strokeStyle = 'rgba(160,146,120,.35)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x, g.ganttY - 2); ctx.lineTo(x, g.ganttY + n * rowH); ctx.stroke()
        plain(String(Math.round(total * t / 4)), x, g.ganttY + n * rowH + 15, 11, DIM, t === 4 ? 'right' : 'left')
      }
    }
  }

  // —— 底部读数 ——
  {
    const y = H - 124, bw = W - 260
    K.slab(g.x0, y, bw, 100, 10)
    const par = Lv.par
    if (!run) {
      plain('按「运行机器」把这批请求跑一遍。', g.x0 + 20, y + 34, 15, CREAM)
      plain(`目标:${par.time} 拍以内${par.tpot ? `,而且最坏吐字间隔不超过 ${par.tpot} 拍` : ''}。`, g.x0 + 20, y + 62, 14, DIM)
    } else {
      const okTime = run.time <= par.time, okTpot = par.tpot === undefined || run.tpot <= par.tpot
      plain(`吞吐 ${run.tput} token/千拍    走了 ${run.steps} 步    显存峰值 ${run.peak}`
        + (on.speculate ? `    猜了 ${run.drafted} 中了 ${run.accepted}(${Math.round(100 * run.accepted / Math.max(1, run.drafted))}%)` : ''),
        g.x0 + 20, y + 28, 14, CREAM)
      plain(`总时间 ${run.time} 拍`, g.x0 + 20, y + 58, 21, okTime ? TEAL : AMBER, 'left', 700)
      plain(`目标 ${par.time}`, g.x0 + 205, y + 58, 13, DIM)
      if (par.tpot !== undefined) {
        plain(`吐字间隔 ${run.tpot} 拍`, g.x0 + 300, y + 58, 21, okTpot ? TEAL : '#ffb4a2', 'left', 700)
        plain(`上限 ${par.tpot}`, g.x0 + 530, y + 58, 13, DIM)
      }
      //  这一行由引擎每次现对撞,不是写死的一句话 —— 投机解码全靠它兜底
      const same = sameAsNaive(Lv.reqs, run)
      plain(same ? '✓ 吐出来的 token 和「老老实实一个一个生成」逐字相同 —— 你在调的是时间,不是答案。'
        : '✗ 输出和参考对不上 —— 这是引擎的 bug,不是你的锅,请报一声。',
        g.x0 + 20, y + 84, 13, same ? TEAL : RED)
      if (meets(run)) label(`达标!${Lv.finale ? '整台引擎搭完了' : '下一关'}`, g.x0 + bw - 130, y + 58, 17, '#ffe6a8')
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
  title: '搭机器 · 大模型推理引擎',
  key: 'infer',
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

// dev 钩子(冒烟脚本按这些来)—— 仿真本身在 infer-core.ts 里,这里只把页面状态露出来
type Win = Record<string, unknown>
;(window as unknown as Win).__inferLevels = () => LEVELS.map(l => l.name)
;(window as unknown as Win).__inferTexts = () => LEVELS.flatMap(l => [l.name, l.short, l.story, l.hint])
;(window as unknown as Win).__inferPlay = (i: number) => { loadLevel(i); return { reqs: L().reqs.length, vram: L().vram, maxLen: L().maxLen, parts: L().parts, par: L().par } }
;(window as unknown as Win).__inferSet = (c: Partial<Cfg>) => {
  if (c.batch !== undefined) batch = c.batch; if (c.page !== undefined) page = c.page; if (c.spec !== undefined) spec = c.spec
  on = { kvcache: !!c.kvcache, paged: !!c.paged, cont: !!c.cont, speculate: !!c.speculate }; run = null
}
;(window as unknown as Win).__inferNow = () => ({ batch, page, spec, ...on })
;(window as unknown as Win).__inferRun = () => {
  doRun()
  return run ? { time: run.time, tpot: run.tpot, tput: run.tput, steps: run.steps, peak: run.peak, drafted: run.drafted, accepted: run.accepted, same: sameAsNaive(L().reqs, run), ok: meets(run) } : null
}
;(window as unknown as Win).__inferUI = () => ({ parts: partBtns(), knobs: knobBtns().map(b => ({ key: b.k.key, v: b.v, x: b.x, y: b.y, bw: b.bw, bh: b.bh })), runBtn: runBtn(), top: cv.getBoundingClientRect().top, cost: COST })
