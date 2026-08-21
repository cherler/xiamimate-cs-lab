import * as Phaser from 'phaser'
import { FRIDGE } from '../../chapters/fridge/index.ts'
import { speak } from '../partner.ts'

/**
 * 副本·冷藏柜 —— 大空间。
 *
 * 视觉：一张像素冷藏柜内部图当背景（跟小镇同风格），交互层叠上去。
 * 关键（回应体验反馈）：**界面自明，不靠台词**——
 * 热成像开关首次点前一直脉冲呼吸；开热成像后，通红的散热片脉冲招呼点击。
 * 数据（温度）用等宽字，像仪表读数。求解器算的数、不手绘、不编。
 */
const IMG_W = 1536, IMG_H = 1024
// 组件在原图里的归一化位置（0–1），换背景图只改这里
const PARTPOS: Record<string, [number, number]> = {
  compressor: [0.163, 0.535],
  inside: [0.469, 0.500],
  condenser: [0.801, 0.488],
}
const NAME: Record<string, string> = { compressor: '压缩机', inside: '柜内', condenser: '散热片' }
const COL = { ink: '#e8e2d6', dim: '#9fb0c2', accent: 0xffb057 }

export class Instance extends Phaser.Scene {
  private thermalMode = false
  private drilled = ''
  private sx = 1; private ox = 0; private oy = 0
  private chips: { id: string; chip: Phaser.GameObjects.Text }[] = []
  private hint!: Phaser.GameObjects.Text
  private subtitle!: Phaser.GameObjects.Text
  private modeBtnT!: Phaser.GameObjects.Text
  private toolGlow!: Phaser.GameObjects.Rectangle
  private condPulse?: Phaser.GameObjects.Arc

  constructor() { super('Instance') }

  /** 图内归一化坐标 → 屏幕坐标（cover 铺满，居中裁切） */
  private toScreen(nx: number, ny: number): [number, number] {
    return [this.ox + nx * IMG_W * this.sx, this.oy + ny * IMG_H * this.sx]
  }

  create() {
    const W = this.scale.width, H = this.scale.height
    this.thermalMode = false; this.drilled = ''; this.chips = []

    // 背景：cover 铺满（保持比例，多出的上下裁掉）
    this.sx = Math.max(W / IMG_W, H / IMG_H)
    this.ox = (W - IMG_W * this.sx) / 2
    this.oy = (H - IMG_H * this.sx) / 2
    this.add.image(W / 2, H / 2, 'fridge').setDisplaySize(IMG_W * this.sx, IMG_H * this.sx)
    // 压一层暗罩，让叠加的 UI 读得清
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a1018, 0.18)

    this.add.text(40, 26, '冷藏柜 · 制冷回路', {
      fontFamily: 'sans-serif', fontSize: '22px', color: COL.ink,
      backgroundColor: 'rgba(10,16,24,0.55)', padding: { x: 8, y: 4 },
    })
    this.subtitle = this.add.text(40, 62, '柜子通着电，里面却是热的。热往哪儿去了？', {
      fontFamily: 'sans-serif', fontSize: '14px', color: COL.dim,
      backgroundColor: 'rgba(10,16,24,0.55)', padding: { x: 8, y: 3 },
    })

    this.buildParts()
    this.buildToolbar(W)

    this.hint = this.add.text(40, H - 78, '', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#ffcb7a',
      backgroundColor: 'rgba(8,12,20,0.82)', padding: { x: 10, y: 6 },
    })
    speak(t => this.hint.setText(t), { chapter: 'fridge', node: 'enter' })

    this.render()
    this.expose()
  }

  private buildParts() {
    for (const pt of FRIDGE.parts) {
      const pos = PARTPOS[pt.id]; if (!pos) continue
      const [x, y] = this.toScreen(pos[0], pos[1])

      if (pt.id === 'condenser') this.condPulse = this.add.circle(x, y, 70, 0xe0533a, 0)

      // 热成像读数芯片（默认藏，扫描后显）
      const chip = this.add.text(x, y - 74, '', {
        fontFamily: 'monospace', fontSize: '15px', color: '#0a0f16', fontStyle: 'bold',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setVisible(false)

      // 隐形热区（点击）
      const zone = this.add.rectangle(x, y, 150, 150, 0xffffff, 0).setInteractive({ useHandCursor: true })
      zone.on('pointerdown', () => this.onPart(pt.id))

      this.chips.push({ id: pt.id, chip })
    }
  }

  private buildToolbar(W: number) {
    this.toolGlow = this.add.rectangle(W - 120, 46, 208, 54, COL.accent, 0)
    const btn = this.add.rectangle(W - 120, 46, 196, 44, 0x1b2838, 0.92).setStrokeStyle(2, COL.accent).setInteractive({ useHandCursor: true })
    this.modeBtnT = this.add.text(W - 120, 46, '热成像　关', { fontFamily: 'sans-serif', fontSize: '15px', color: COL.ink }).setOrigin(0.5)
    btn.on('pointerdown', () => this.toggleThermal())
    this.tweens.add({ targets: this.toolGlow, alpha: { from: 0.06, to: 0.42 }, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  private toggleThermal() {
    this.thermalMode = !this.thermalMode
    this.tweens.killTweensOf(this.toolGlow); this.toolGlow.setAlpha(0)
    this.modeBtnT.setText(this.thermalMode ? '热成像　开' : '热成像　关')
    this.subtitle.setText(this.thermalMode
      ? '热全堆在散热片上出不去——点那块通红的，钻进去。'
      : '柜子通着电，里面却是热的。热往哪儿去了？')
    speak(t => this.hint.setText(t), this.thermalMode
      ? { chapter: 'fridge', node: 'anomaly', readings: { condenser: FRIDGE.tempOfPart('condenser', FRIDGE.initial) } }
      : { chapter: 'fridge', node: 'enter' })
    this.render()
    this.expose()
  }

  private tempColor(t: number): number {
    const k = Phaser.Math.Clamp(t / 80, 0, 1)
    const r = Math.round(74 + (224 - 74) * k)
    const g = Math.round(134 + (83 - 134) * k)
    const b = Math.round(197 + (58 - 197) * k)
    return (r << 16) | (g << 8) | b
  }
  private hex(c: number): string { return '#' + c.toString(16).padStart(6, '0') }

  private render() {
    for (const n of this.chips) {
      if (this.thermalMode) {
        const t = FRIDGE.tempOfPart(n.id, FRIDGE.initial)
        const c = this.tempColor(t)
        n.chip.setText(`${NAME[n.id]} ${t.toFixed(0)}℃`).setBackgroundColor(this.hex(c)).setVisible(true)
      } else {
        n.chip.setVisible(false)
      }
    }
    if (this.condPulse) {
      this.tweens.killTweensOf(this.condPulse)
      if (this.thermalMode) {
        this.condPulse.setScale(1)
        this.tweens.add({ targets: this.condPulse, alpha: { from: 0.15, to: 0.5 }, scale: { from: 1, to: 1.18 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      } else {
        this.condPulse.setAlpha(0).setScale(1)
      }
    }
  }

  private onPart(id: string) {
    if (this.thermalMode && id === FRIDGE.anomalyPart) {
      this.drilled = id
      this.expose()
      this.scene.start('Experiment')
    }
  }

  private expose() {
    const parts = this.chips.map(n => ({ id: n.id, temp: this.thermalMode ? FRIDGE.tempOfPart(n.id, FRIDGE.initial) : null }))
    ;(window as unknown as { __instanceState: object }).__instanceState = { scene: 'Instance', thermal: this.thermalMode, parts, drilled: this.drilled }
  }
}
