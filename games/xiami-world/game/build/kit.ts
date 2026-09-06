/**
 * 「搭机器」两台机器共用的画法词汇 —— 物件即美术。
 *
 * 手工机械件的那一套:暖黄铜 / 钢 / 木 / 青玻璃(Opus Magnum 味)。
 * 每个零件都是一块**带渐变的面板 + 四颗铆钉 + 几条上色的通道**,而不是一个填色方块 ——
 * 这样一屏零件摆开时质感是齐的,而且「哪条通道亮着」本身就在讲机制。
 *
 * ⚠️ 原来这套只长在路由器那台机器里(editor.ts 的模块作用域),CPU 那台是灰盒方块。
 * 两台要长一个样,就不能各画各的 —— 抽到这里、由 ctx 参数化,两边同源。
 * 加新画法请加在这儿,别在某一台里就地写一份。
 */
export type Kit = ReturnType<typeof makeKit>

/** 一组常用的金属/玻璃配色(亮 / 中 / 暗,喂给 plate 的三段渐变)。 */
export const BRASS = ['#eccd8e', '#c39a55', '#6f5028']
export const STEEL = ['#565049', '#38342e', '#1f1c17']
export const VIOLET = ['#bda0dd', '#7d5fa8', '#3c2c58']
export const GOLD = ['#f0d485', '#cba54e', '#71531f']
export const GREEN = ['#aad79b', '#6fa85f', '#2c4c28']
export const AQUA = ['#9fd8e8', '#4f93ad', '#1e4457']
export const ROSE = ['#e6a898', '#b8564a', '#5a1f18']
export const INK = ['#7f8ea8', '#4a5568', '#232a36']

export function makeKit(ctx: CanvasRenderingContext2D) {
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath(); ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
  }
  /** 一块金属面板:三段竖向渐变 + 外深内亮两道描边(这一下就有厚度了)。 */
  const plate = (x: number, y: number, w: number, h: number, r: number, c: string[]) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, c[0]!); g.addColorStop(.5, c[1]!); g.addColorStop(1, c[2]!)
    rr(x, y, w, h, r); ctx.fillStyle = g; ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.42)'; ctx.lineWidth = 1.5; rr(x, y, w, h, r); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,244,214,.3)'; ctx.lineWidth = 1; rr(x + 1.5, y + 1.5, w - 3, h - 3, Math.max(1, r - 1)); ctx.stroke()
  }
  /** 铆钉:一个暗坑加一点高光。四角各来一颗,面板就「拧」在那儿了。 */
  const rivet = (x: number, y: number, rad: number) => {
    ctx.fillStyle = 'rgba(28,20,10,.85)'; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill()
    ctx.fillStyle = 'rgba(255,240,210,.32)'; ctx.beginPath(); ctx.arc(x - rad * .3, y - rad * .3, rad * .5, 0, 7); ctx.fill()
  }
  /** 一块方形外壳(面板 + 四角铆钉),尺寸按格子边长 cs 走。 */
  const housing = (cs: number, c: string[]) => {
    const m = cs * .12; plate(m, m, cs - 2 * m, cs - 2 * m, cs * .1, c)
    const o = cs * .06
    for (const [rx, ry] of [[m + o, m + o], [cs - m - o, m + o], [m + o, cs - m - o], [cs - m - o, cs - m - o]]) rivet(rx!, ry!, cs * .026)
  }
  /** 面板的横版:给不是正方形的卡片用(CPU 那台的阶段卡、微操作卡)。 */
  const panel = (x: number, y: number, w: number, h: number, c: string[], r = 10) => {
    plate(x, y, w, h, r, c)
    const o = 9
    for (const [rx, ry] of [[x + o, y + o], [x + w - o, y + o], [x + o, y + h - o], [x + w - o, y + h - o]]) rivet(rx!, ry!, 2.6)
  }
  /** 一条上色的通道 —— 机制走哪条路,就把哪条画亮。 */
  const channel = (x1: number, y1: number, x2: number, y2: number, w: number, col: string) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.lineCap = 'butt'
  }
  /** 流向箭头。 */
  const chevron = (x: number, y: number, s: number, col: string, lw: number) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(x - s * .5, y - s * .6); ctx.lineTo(x + s * .5, y); ctx.lineTo(x - s * .5, y + s * .6); ctx.stroke()
    ctx.lineCap = 'butt'
  }
  /** 中心轴:通道汇聚的那个点。 */
  const hub = (cx: number, cy: number, r: number, col = '#e8c98a') => {
    ctx.fillStyle = '#241d14'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill()
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke()
  }
  /** 铺一张底图(等比裁切填满),可加一层压暗。图没加载好就填个暗底,不闪白。 */
  const coverImg = (img: HTMLImageElement, x: number, y: number, w: number, h: number, dim = 0) => {
    if (!(img.complete && img.naturalWidth > 0)) { ctx.fillStyle = '#1a140d'; ctx.fillRect(x, y, w, h); return }
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
    if (dim) { ctx.fillStyle = `rgba(14,10,6,${dim})`; ctx.fillRect(x, y, w, h) }
    ctx.restore()
  }
  /** 一块半透明的深色底板:把一堆读数框在一起,别让它们浮在背景图上。 */
  const slab = (x: number, y: number, w: number, h: number, r = 12) => {
    rr(x, y, w, h, r); ctx.fillStyle = 'rgba(24,19,12,.9)'; ctx.fill()
    ctx.strokeStyle = '#4a3f2a'; ctx.lineWidth = 2; rr(x, y, w, h, r); ctx.stroke()
  }
  /** 按可用宽度折行 —— 直接 fillText 会顶出右边界被切掉。 */
  const wrapText = (t: string, x: number, y: number, maxw: number, lh: number, maxLines: number) => {
    if (!t) return
    let line = '', ln = 0
    for (const ch of [...t]) {
      if (ctx.measureText(line + ch).width > maxw) { ctx.fillText(line, x, y + ln * lh); ln++; line = ch; if (ln >= maxLines) return }
      else line += ch
    }
    if (ln < maxLines) ctx.fillText(line, x, y + ln * lh)
  }
  return { rr, plate, rivet, housing, panel, channel, chevron, hub, coverImg, slab, wrapText }
}
