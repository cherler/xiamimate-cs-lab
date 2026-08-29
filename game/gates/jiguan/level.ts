/**
 * 机关的「关卡层」:给每个机关套上**目标 / 赢 / 输**,让玩家一眼看懂在干嘛。零文字,全靠图标与格子。
 *   目标(青格):做对一次填一格,填满 → 右端的**门开** = 赢,掉维修素材。
 *   容错(红格):出一次错填一格,填满 → 机器**罢工(红屏)** = 输,按 ↻ 重来。
 * 用法:mechanism 里 new Level(goal, failMax);做对调 good()、做错调 bad();
 *   frame 末尾 level.render(ctx,W,H);state!=='play' 时冻结推进;按 R → level.reset()+机关自身复位。
 */
export type LState = 'play' | 'win' | 'lose'

export class Level {
  progress = 0; fail = 0; state: LState = 'play'; winFx = 0; loseFx = 0; goodFx = 0; badFx = 0
  constructor(public goal: number, public failMax: number) {}
  good(n = 1) { if (this.state !== 'play') return; this.progress = Math.min(this.goal, this.progress + n); this.goodFx = 1; if (this.progress >= this.goal) { this.state = 'win'; this.winFx = 1 } }
  bad(n = 1) { if (this.state !== 'play') return; this.fail = Math.min(this.failMax, this.fail + n); this.badFx = 1; if (this.fail >= this.failMax) { this.state = 'lose'; this.loseFx = 1 } }
  reset() { this.progress = 0; this.fail = 0; this.state = 'play'; this.winFx = 0; this.loseFx = 0; this.goodFx = 0; this.badFx = 0 }
  snapshot() { return { progress: this.progress, goal: this.goal, fail: this.fail, failMax: this.failMax, state: this.state } }

  render(ctx: CanvasRenderingContext2D, W: number, _H: number, t = 0) {
    this.winFx = Math.max(0, this.winFx - .02); this.loseFx = Math.max(0, this.loseFx - .02)
    this.goodFx = Math.max(0, this.goodFx - .06); this.badFx = Math.max(0, this.badFx - .06)
    const pip = 20, gapx = 6, cx = W / 2
    // —— 目标条(青):做对 progress/goal;末端一扇门,满了就开 ——
    const gw = this.goal * (pip + gapx)
    const gx0 = cx - gw / 2 - 40, gy = 30
    for (let i = 0; i < this.goal; i++) {
      const x = gx0 + i * (pip + gapx), on = i < this.progress
      ctx.fillStyle = on ? '#49a791' : '#26332e'; ctx.strokeStyle = '#3a5a50'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(x, gy, pip / 2, 0, 7); ctx.fill(); ctx.stroke()
      if (on && i === this.progress - 1 && this.goodFx > 0) { ctx.globalAlpha = this.goodFx; ctx.strokeStyle = '#bff5e4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, gy, pip / 2 + 4, 0, 7); ctx.stroke(); ctx.globalAlpha = 1 }
    }
    // 门(目标末端):关=两扇合拢暗;赢=分开+亮
    const dx = gx0 + this.goal * (pip + gapx) + 6, open = this.state === 'win'
    ctx.strokeStyle = open ? '#7fe8c0' : '#5a6a60'; ctx.lineWidth = 3
    ctx.strokeRect(dx - 2 - (open ? 10 : 0), gy - 14, 12, 28); ctx.strokeRect(dx + 6 + (open ? 10 : 0), gy - 14, 12, 28)

    // —— 容错条(红):做错 fail/failMax;末端一个警示 ——
    const fx0 = cx - (this.failMax * (pip + gapx)) / 2 + 8, fy = 58
    for (let i = 0; i < this.failMax; i++) {
      const x = fx0 + i * (pip + gapx), on = i < this.fail
      ctx.fillStyle = on ? '#c8452e' : '#332624'; ctx.strokeStyle = '#5a3a34'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(x, fy - pip / 2); ctx.lineTo(x + pip / 2, fy + pip / 2); ctx.lineTo(x - pip / 2, fy + pip / 2); ctx.closePath(); ctx.fill(); ctx.stroke()
      if (on && i === this.fail - 1 && this.badFx > 0) { ctx.globalAlpha = this.badFx; ctx.strokeStyle = '#ff9a80'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, fy - pip / 2 - 4); ctx.lineTo(x + pip / 2 + 4, fy + pip / 2 + 3); ctx.lineTo(x - pip / 2 - 4, fy + pip / 2 + 3); ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1 }
    }

    // —— 赢/输 覆盖层 ——
    if (this.state === 'win') {
      ctx.fillStyle = `rgba(40,90,74,${.22 + this.winFx * .28})`; ctx.fillRect(0, 0, W, _H)
      ctx.strokeStyle = '#7fe8c0'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 46, _H / 2); ctx.lineTo(cx - 8, _H / 2 + 40); ctx.lineTo(cx + 54, _H / 2 - 44); ctx.stroke(); ctx.lineCap = 'butt' // ✓
      retryIcon(ctx, cx, _H / 2 + 110, t)
    } else if (this.state === 'lose') {
      ctx.fillStyle = `rgba(90,26,22,${.28 + this.loseFx * .3})`; ctx.fillRect(0, 0, W, _H)
      ctx.strokeStyle = '#ff9a80'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 40, _H / 2 - 40); ctx.lineTo(cx + 40, _H / 2 + 40); ctx.moveTo(cx + 40, _H / 2 - 40); ctx.lineTo(cx - 40, _H / 2 + 40); ctx.stroke(); ctx.lineCap = 'butt' // ✕
      retryIcon(ctx, cx, _H / 2 + 110, t)
    }
  }
}

/** 左下角操作说明面板:一句玩法 + 快捷键行(用户要求"某处给出快捷键说明")。 */
export function drawLegend(ctx: CanvasRenderingContext2D, _W: number, H: number, rule: string, rows: { k: string; t: string }[]) {
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  const lh = 24, padx = 12, pady = 10, w = 340, h = pady * 2 + 22 + rows.length * lh
  const x = 16, y = H - h - 16
  ctx.fillStyle = 'rgba(20,16,12,.78)'; ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#4a4030'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h)
  ctx.font = '13px system-ui'; ctx.fillStyle = '#e8c98a'; ctx.fillText(rule, x + padx, y + pady + 11)
  rows.forEach((r, i) => {
    const ry = y + pady + 22 + i * lh + lh / 2
    ctx.font = 'bold 12px ui-monospace, monospace'
    const kw = Math.max(30, ctx.measureText(r.k).width + 14)
    ctx.fillStyle = '#3a342a'; ctx.fillRect(x + padx, ry - 9, kw, 18); ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1; ctx.strokeRect(x + padx, ry - 9, kw, 18)
    ctx.fillStyle = '#efe6d2'; ctx.fillText(r.k, x + padx + 7, ry)
    ctx.font = '13px system-ui'; ctx.fillStyle = '#c8bfa8'; ctx.fillText(r.t, x + padx + kw + 10, ry)
  })
  ctx.restore()
}

function retryIcon(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) { // ↻ 循环箭头 = 按 R 重来
  ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 18, -0.4 + t, Math.PI * 1.7 + t); ctx.stroke()
  const a = Math.PI * 1.7 + t, hx = x + Math.cos(a) * 18, hy = y + Math.sin(a) * 18
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 8, hy - 2); ctx.moveTo(hx, hy); ctx.lineTo(hx - 2, hy - 9); ctx.stroke()
}
