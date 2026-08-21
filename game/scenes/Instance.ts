import * as Phaser from 'phaser'
import { markFixed } from '../save.ts'
import { FRIDGE } from '../../chapters/fridge/index.ts'

/** 副本·冷藏柜（C1：大空间 + 热成像工具）。C2/C3 再加对照实验和修复链。 */
export class Instance extends Phaser.Scene {
  private thermalMode = false
  private drilled = ''
  private nodes: { id: string; arc: Phaser.GameObjects.Arc; temp: Phaser.GameObjects.Text }[] = []
  private hint!: Phaser.GameObjects.Text
  private modeBtnT!: Phaser.GameObjects.Text

  constructor() { super('Instance') }

  create() {
    const W = this.scale.width, H = this.scale.height
    this.thermalMode = false
    this.drilled = ''
    this.nodes = []
    this.add.rectangle(W / 2, H / 2, W, H, 0x14171f)
    this.add.text(40, 30, '冷藏柜内部', { fontFamily: 'sans-serif', fontSize: '22px', color: '#e8e2d6' })

    const byId = (id: string) => FRIDGE.parts.find(pt => pt.id === id)!
    const compressor = byId('compressor'), inside = byId('inside'), condenser = byId('condenser')
    const g = this.add.graphics()
    g.lineStyle(4, 0x3a3f4a)
    g.beginPath()
    g.moveTo(compressor.x, compressor.y)
    g.lineTo(inside.x, inside.y)
    g.lineTo(condenser.x, condenser.y)
    g.lineTo(compressor.x, compressor.y)
    g.strokePath()

    for (const pt of FRIDGE.parts) {
      const arc = this.add.circle(pt.x, pt.y, 34, 0x2a2f38).setStrokeStyle(2, 0x565c68)
      this.add.text(pt.x, pt.y + 46, pt.name, { fontFamily: 'sans-serif', fontSize: '15px', color: '#cfc9bd' }).setOrigin(0.5)
      const temp = this.add.text(pt.x, pt.y, '', { fontFamily: 'sans-serif', fontSize: '13px', color: '#141210', fontStyle: 'bold' }).setOrigin(0.5)
      arc.setInteractive({ useHandCursor: true })
      arc.on('pointerdown', () => this.onPart(pt.id))
      this.nodes.push({ id: pt.id, arc, temp })
    }

    this.hint = this.add.text(40, H - 74, '机器在转，柜里却是热的……拿热成像扫扫看？', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#ffcb7a',
      backgroundColor: 'rgba(20,18,15,0.7)', padding: { x: 8, y: 5 },
    })

    const btn = this.add.rectangle(W - 130, 46, 180, 40, 0x2f4668).setInteractive({ useHandCursor: true })
    this.modeBtnT = this.add.text(W - 130, 46, '热成像：关', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#e8e2d6',
    }).setOrigin(0.5)
    btn.on('pointerdown', () => this.toggleThermal())

    // 临时"完成修复"（保住闭环；C3 换成真修复链）
    const done = this.add.rectangle(W / 2, H - 30, 200, 40, 0x4a4038).setInteractive({ useHandCursor: true })
    this.add.text(W / 2, H - 30, '完成修复（临时）', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#cfc9bd',
    }).setOrigin(0.5)
    done.on('pointerdown', () => { markFixed('clinic'); this.scene.start('Town') })

    this.render()
    this.expose()
  }

  private toggleThermal() {
    this.thermalMode = !this.thermalMode
    this.modeBtnT.setText(this.thermalMode ? '热成像：开' : '热成像：关')
    this.hint.setText(this.thermalMode
      ? '看那片散热片——通红。热搬到这儿出不去了。点它钻进去。'
      : '机器在转，柜里却是热的……拿热成像扫扫看？')
    this.render()
    this.expose()
  }

  private tempColor(t: number): number {
    const k = Phaser.Math.Clamp(t / 80, 0, 1) // 0–80℃：蓝→红
    const r = Math.round(58 + (210 - 58) * k)
    const gg = Math.round(110 + (59 - 110) * k)
    const b = Math.round(165 + (46 - 165) * k)
    return (r << 16) | (gg << 8) | b
  }

  private render() {
    for (const n of this.nodes) {
      if (this.thermalMode) {
        const t = FRIDGE.tempOfPart(n.id, FRIDGE.initial)
        n.arc.setFillStyle(this.tempColor(t))
        n.temp.setText(`${t.toFixed(0)}℃`)
      } else {
        n.arc.setFillStyle(0x2a2f38)
        n.temp.setText('')
      }
    }
  }

  private onPart(id: string) {
    if (this.thermalMode && id === FRIDGE.anomalyPart) {
      this.drilled = id
      this.hint.setText('钻进散热片…（对照实验在下一步 C2）')
      this.expose()
    }
  }

  private expose() {
    const parts = this.nodes.map(n => ({
      id: n.id,
      temp: this.thermalMode ? FRIDGE.tempOfPart(n.id, FRIDGE.initial) : null,
    }))
    ;(window as unknown as { __instanceState: object }).__instanceState = {
      scene: 'Instance', thermal: this.thermalMode, parts, drilled: this.drilled,
    }
  }
}
