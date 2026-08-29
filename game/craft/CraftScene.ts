import * as Phaser from 'phaser'
import { CraftEngine, guruLine, type ReactResult } from './engine.ts'
import { LAYERS } from './types.ts'
import { createDialogue, type Dialogue } from '../ui/dialogue.ts'

/**
 * 反应台 · 化学合成原型
 *
 * 玩法核心不在这个文件里——在 engine.ts(仿真核心,已测)。这里只是壳:
 * 把握着的原子/组件点进反应台,按「反应!」→ 引擎判定 → **只有懂原理凑对的那组才会反应**,
 * 反应成功的一刻,料收拢、闪光、**变态**成产物该有的形象,咕噜念出那条原理;产物进库存,能当更大反应的料。
 * 规则藏在知识里(像化学,不像乐高看形状),这就是"知识=游戏机制"。
 */
const LAYER_COLOR: Record<string, number> = {
  物理层: 0x6b8cff, 数据链路层: 0x4fb6a3, 网络层: 0xe0a94b, 传输层: 0xd1685f, 应用层: 0xa879d6,
}
const BENCH_MAX = 6
const PAL_X = 24, PAL_Y = 62, PAL_W = 536, PAL_H = 632
const STAGE_X = 760 // 反应台中心 x

type Token = { name: string; product: boolean; c: Phaser.GameObjects.Container; w: number }

export class CraftScene extends Phaser.Scene {
  private engine!: CraftEngine
  private bench: string[] = []
  private dlg!: Dialogue
  private palette!: Phaser.GameObjects.Container
  private palScroll = 0
  private palContentH = 0
  private benchTokens = new Map<string, Phaser.GameObjects.Container>()
  private benchSlots: Phaser.GameObjects.Rectangle[] = []
  private progressT!: Phaser.GameObjects.Text
  private cardG!: Phaser.GameObjects.Container
  private busy = false

  constructor() { super('Craft') }

  create() {
    this.engine = new CraftEngine()
    this.bench = []
    this.benchTokens.clear()
    this.add.rectangle(640, 360, 1280, 720, 0x0e1524).setDepth(-10)

    // 标题 + 进度
    this.add.text(24, 16, '反应台 · 化学合成', {
      fontFamily: 'sans-serif', fontSize: '24px', color: '#f0e9dc', fontStyle: 'bold',
    })
    this.add.text(300, 24, '把原子拼成组件,组件拼成实物——但得懂原理才拼得出', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#8a93a6',
    })
    this.progressT = this.add.text(1256, 22, '', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#ffcb7a',
    }).setOrigin(1, 0)

    // 元素/库存面板(左,可滚)
    this.add.rectangle(PAL_X + PAL_W / 2, PAL_Y + PAL_H / 2, PAL_W, PAL_H, 0x121a28, 0.9)
      .setStrokeStyle(1, 0x2a3446)
    this.palette = this.add.container(0, 0)
    const maskR = this.add.rectangle(PAL_X + PAL_W / 2, PAL_Y + PAL_H / 2, PAL_W - 4, PAL_H - 4, 0xffffff).setVisible(false)
    this.palette.setMask(maskR.createGeometryMask())
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const min = Math.min(0, PAL_H - 20 - this.palContentH)
      this.palScroll = Phaser.Math.Clamp(this.palScroll - dy * 0.5, min, 0)
      this.palette.y = this.palScroll
    })

    // 反应台(中)
    this.add.text(STAGE_X, 96, '反应台', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#e8e2d6',
    }).setOrigin(0.5)
    this.benchSlots = []
    for (let i = 0; i < BENCH_MAX; i++) {
      const sx = STAGE_X - (BENCH_MAX - 1) * 46 / 2 + i * 46
      this.benchSlots.push(
        this.add.rectangle(sx, 150, 40, 40, 0x0c1220, 0.6).setStrokeStyle(1, 0x33405a),
      )
    }

    // 按钮
    this.mkButton(STAGE_X - 78, 350, 140, 46, '反应!', 0xc0603a, () => this.fireReact())
    this.mkButton(STAGE_X + 92, 350, 90, 46, '清空', 0x2a3242, () => this.clearBench())

    // 产物卡(变态后的形象在这里揭示)
    this.cardG = this.add.container(0, 0)

    // 咕噜
    this.dlg = createDialogue(this, 588, 604, 668)
    this.dlg.setText('这是最底层的"元素"。先拿两样物理层的东西(比如 电平 和 时间)放上台,按反应,看看会长出什么。')

    this.rebuildPalette()
    this.refresh()
  }

  // —— 公开给冒烟脚本确定性驱动 ——
  benchAdd(name: string): boolean {
    if (this.busy) return false
    if (!this.engine.owns(name)) return false
    if (this.bench.includes(name) || this.bench.length >= BENCH_MAX) return false
    this.bench.push(name)
    this.layoutBench()
    this.refresh()
    return true
  }
  benchRemove(name: string) {
    this.bench = this.bench.filter(n => n !== name)
    this.layoutBench()
    this.refresh()
  }
  clearBench() { this.bench = []; this.layoutBench(); this.refresh() }
  getEngine() { return this.engine }

  // —— 试反应 ——
  fireReact(): ReactResult {
    const res = this.engine.react([...this.bench])
    if (res.ok && !res.already) {
      this.metamorphose(res.reaction.output)
      this.dlg.setText(`咕噜:${guruLine(res)}`)
      this.showCard(res.reaction.output, res.reaction.form, res.reaction.emergent)
    } else if (res.ok && res.already) {
      this.dlg.setText(`咕噜:${guruLine(res)}`)
      this.clearBench()
    } else {
      this.dlg.setText(`咕噜:${guruLine(res)}`)
      this.shakeBench()
    }
    this.refresh(res)
    return res
  }

  private metamorphose(product: string) {
    this.busy = true
    const toks = [...this.benchTokens.values()]
    // 料收拢到反应台中心
    toks.forEach(t => this.tweens.add({
      targets: t, x: STAGE_X, y: 150, scale: 0.4, alpha: 0.2, duration: 380, ease: 'Cubic.easeIn',
    }))
    this.time.delayedCall(380, () => {
      toks.forEach(t => t.destroy())
      this.benchTokens.clear()
      this.bench = []
      // 闪光
      const glow = this.add.circle(STAGE_X, 150, 10, 0xffcb7a, 0.9).setDepth(40)
      this.tweens.add({ targets: glow, radius: 90, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => glow.destroy() })
      // 产物变态登场
      const tk = this.mkToken(product, true)
      tk.c.setPosition(STAGE_X, 150).setDepth(45).setScale(0)
      this.tweens.add({
        targets: tk.c, scale: 1.3, angle: 360, duration: 520, ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({ targets: tk.c, scale: 1, duration: 160 })
          // 飞进库存
          this.time.delayedCall(520, () => {
            this.tweens.add({
              targets: tk.c, x: PAL_X + 60, y: PAL_Y + 30, scale: 0.5, alpha: 0, duration: 420, ease: 'Cubic.easeIn',
              onComplete: () => { tk.c.destroy(); this.rebuildPalette(); this.busy = false; this.refresh() },
            })
          })
        },
      })
    })
  }

  private shakeBench() {
    const slots = this.benchSlots
    this.tweens.add({ targets: slots, x: '+=6', duration: 60, yoyo: true, repeat: 3 })
  }

  private showCard(name: string, form: string, emergent: string) {
    this.cardG.removeAll(true)
    const x = 588, y = 404, w = 668, h = 172
    this.cardG.add(this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x1c2740, 0.95).setStrokeStyle(1, 0xffcb7a))
    this.cardG.add(this.add.text(x + 16, y + 12, `✦ 变态成了:${name}`, {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ffcb7a', fontStyle: 'bold',
    }))
    this.cardG.add(this.add.text(x + 16, y + 46, `形象:${form}`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#e8e2d6',
      wordWrap: { width: w - 32, useAdvancedWrap: true }, lineSpacing: 3,
    }))
    this.cardG.add(this.add.text(x + 16, y + 104, `涌现:${emergent}`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#9fd0b0',
      wordWrap: { width: w - 32, useAdvancedWrap: true }, lineSpacing: 3,
    }))
  }

  // —— 面板/反应台渲染 ——
  private rebuildPalette() {
    this.palette.removeAll(true)
    let y = 10
    for (const L of LAYERS) {
      const owned = this.engine.inventory().filter(n => {
        const a = this.engine.atomOf(n); const r = this.engine.reactionOf(n)
        return (a?.layer ?? r?.layer) === L
      })
      if (!owned.length) continue
      this.palette.add(this.add.text(PAL_X + 12, PAL_Y + y, L, {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#8a93a6', fontStyle: 'bold',
      }))
      y += 24
      let x = PAL_X + 12
      for (const name of owned) {
        const isProd = !this.engine.isAtom(name)
        const tk = this.mkToken(name, isProd)
        if (x + tk.w > PAL_X + PAL_W - 12) { x = PAL_X + 12; y += 34 }
        tk.c.setPosition(x + tk.w / 2, PAL_Y + y + 13)
        tk.c.setData('name', name)
        const hit = tk.c.getByName('hit') as Phaser.GameObjects.Rectangle
        hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.benchAdd(name))
        this.palette.add(tk.c)
        x += tk.w + 8
      }
      y += 40
    }
    this.palContentH = y
  }

  private layoutBench() {
    for (const [name, c] of this.benchTokens) if (!this.bench.includes(name)) { c.destroy(); this.benchTokens.delete(name) }
    this.bench.forEach((name, i) => {
      const sx = STAGE_X - (BENCH_MAX - 1) * 46 / 2 + i * 46
      let c = this.benchTokens.get(name)
      if (!c) {
        const tk = this.mkToken(name, !this.engine.isAtom(name))
        c = tk.c.setDepth(20)
        const hit = c.getByName('hit') as Phaser.GameObjects.Rectangle
        hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.benchRemove(name))
        this.benchTokens.set(name, c)
      }
      c.setPosition(sx, 150)
    })
  }

  /** 一个"料"的形象块:原子=层色描边,产物=金边带✦。返回容器+宽度。 */
  private mkToken(name: string, product: boolean): Token {
    const layer = this.engine.atomOf(name)?.layer ?? this.engine.reactionOf(name)?.layer ?? '物理层'
    const w = Math.max(44, name.length * 15 + 22)
    const c = this.add.container(0, 0)
    const fill = product ? 0x2a2416 : 0x151d2b
    const stroke = product ? 0xffcb7a : (LAYER_COLOR[layer] ?? 0x6b8cff)
    const rect = this.add.rectangle(0, 0, w, 28, fill, 0.98).setStrokeStyle(2, stroke).setName('hit')
    const label = (product ? '✦' : '') + name
    const t = this.add.text(0, 0, label, {
      fontFamily: 'sans-serif', fontSize: '13px', color: product ? '#ffe6b0' : '#dfe6f0',
    }).setOrigin(0.5)
    c.add([rect, t])
    return { name, product, c, w }
  }

  private mkButton(x: number, y: number, w: number, h: number, label: string, color: number, on: () => void) {
    const r = this.add.rectangle(x + w / 2, y, w, h, color).setStrokeStyle(1, 0x000000, 0.2).setInteractive({ useHandCursor: true })
    this.add.text(x + w / 2, y, label, {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#141210', fontStyle: 'bold',
    }).setOrigin(0.5)
    r.on('pointerover', () => r.setAlpha(0.85))
    r.on('pointerout', () => r.setAlpha(1))
    r.on('pointerdown', on)
  }

  private refresh(res?: ReactResult) {
    const p = this.engine.progress()
    this.progressT.setText(`已点亮 ${p.made} / ${p.total}`)
    ;(window as unknown as { __craftState: object }).__craftState = {
      scene: 'Craft', made: p.made, total: p.total, busy: this.busy,
      owned: this.engine.inventory().length,
      bench: [...this.bench],
      lastOk: res ? res.ok : null,
      lastReason: res && !res.ok ? res.reason : null,
      lastProduct: res && res.ok ? res.reaction.output : null,
      craftableNow: this.engine.craftableNow().length,
    }
  }
}
