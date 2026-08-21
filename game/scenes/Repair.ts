import * as Phaser from 'phaser'
import { markFixed } from '../save.ts'
import { solveControl } from '../../solvers/control.ts'

const PRESETS = [
  { id: 'freezer', name: '冷冻 −18~−15℃', low: -18, high: -15, x: 400 },
  { id: 'cool',    name: '微凉 9~12℃',    low: 9,   high: 12,  x: 640 },
  { id: 'fridge',  name: '冷藏 3~6℃',     low: 3,   high: 6,   x: 880 },
]
const COOLING_FLOOR = -6

/** 修复（C3）：清灰恢复散热 → 反转：柜子往冰点冲 → 给温控定安全窗口 2–8℃。 */
export class Repair extends Phaser.Scene {
  private cleaned = false
  private windowSafe = false
  private hint!: Phaser.GameObjects.Text
  private verdict!: Phaser.GameObjects.Text
  private doneBtn!: Phaser.GameObjects.Rectangle
  private doneT!: Phaser.GameObjects.Text

  constructor() { super('Repair') }

  create() {
    const W = this.scale.width, H = this.scale.height
    this.cleaned = false; this.windowSafe = false
    this.add.rectangle(W / 2, H / 2, W, H, 0x14171f)
    this.add.text(40, 30, '修复 · 散热片 + 温控', { fontFamily: 'sans-serif', fontSize: '22px', color: '#e8e2d6' })
    this.hint = this.add.text(40, 74, '先把散热片的积灰清了——热才搬得出去。', { fontFamily: 'sans-serif', fontSize: '15px', color: '#ffcb7a' })

    const clean = this.add.rectangle(640, 300, 260, 52, 0xc0603a).setInteractive({ useHandCursor: true })
    const cleanT = this.add.text(640, 300, '清理散热片积灰', { fontFamily: 'sans-serif', fontSize: '17px', color: '#141210', fontStyle: 'bold' }).setOrigin(0.5)
    clean.on('pointerdown', () => {
      if (this.cleaned) return
      this.cleaned = true
      clean.destroy(); cleanT.destroy()
      this.afterClean()
    })

    this.verdict = this.add.text(640, 490, '', { fontFamily: 'sans-serif', fontSize: '15px', color: '#cfc9bd' }).setOrigin(0.5)
    this.doneBtn = this.add.rectangle(640, 560, 220, 48, 0x3a4038).setInteractive({ useHandCursor: true })
    this.doneT = this.add.text(640, 560, '完成修复', { fontFamily: 'sans-serif', fontSize: '16px', color: '#6f6759' }).setOrigin(0.5)
    this.doneBtn.on('pointerdown', () => {
      if (!this.windowSafe) return
      markFixed('clinic')
      this.scene.start('Town')
    })
    this.expose()
  }

  private afterClean() {
    this.hint.setText('散热通了，柜子开始制冷——可它在往冰点冲。给温控定个窗口：疫苗冻了跟热了一样废。')
    this.add.text(400, 390, '设定温控窗口：', { fontFamily: 'sans-serif', fontSize: '14px', color: '#a49b8b' }).setOrigin(0, 0.5)
    for (const pr of PRESETS) {
      const rect = this.add.rectangle(pr.x, 430, 220, 44, 0x2a2f38).setStrokeStyle(1, 0x565c68).setInteractive({ useHandCursor: true })
      this.add.text(pr.x, 430, pr.name, { fontFamily: 'sans-serif', fontSize: '14px', color: '#cfc9bd' }).setOrigin(0.5)
      rect.on('pointerdown', () => this.pickWindow(pr))
    }
    this.expose()
  }

  private pickWindow(pr: { low: number; high: number }) {
    const s = solveControl({ setLow: pr.low, setHigh: pr.high, coolingFloor: COOLING_FLOOR })
    this.windowSafe = s.safe
    this.verdict.setColor(s.safe ? '#6fbf73' : '#e0744f')
    this.verdict.setText(s.notes.length ? s.notes[s.notes.length - 1]! : '')
    this.doneBtn.setFillStyle(s.safe ? 0xc0603a : 0x3a4038)
    this.doneT.setColor(s.safe ? '#141210' : '#6f6759')
    this.expose()
  }

  private expose() {
    ;(window as unknown as { __repairState: object }).__repairState = {
      scene: 'Repair', cleaned: this.cleaned, windowSafe: this.windowSafe,
    }
  }
}
