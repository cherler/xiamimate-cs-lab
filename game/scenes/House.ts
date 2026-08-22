import * as Phaser from 'phaser'
import { DEVICES, COMMISSION } from '../data/house.ts'
import { isFixed } from '../save.ts'

/**
 * 世界层：你家的剖面。一件设备 = 一个副本。
 *
 * 暖色手绘剖面（"像家"）；钻进设备内部才是蓝图冷线框（"能读懂"）。
 * 有毛病的设备挂感叹号招呼点击；修好的变绿。没开放的设备灰着，是"以后会有"的承诺。
 */
export class House extends Phaser.Scene {
  private board!: Phaser.GameObjects.Container

  constructor() { super('House') }

  create() {
    const W = this.scale.width, H = this.scale.height
    // 背景 cover 铺满（图 1536x1024）
    const iw = 1536, ih = 1024
    const s = Math.max(W / iw, H / ih)
    this.add.image(W / 2, H / 2, 'house').setDisplaySize(iw * s, ih * s)

    for (const d of DEVICES) {
      const fixed = isFixed(d.id)
      const hasIssue = !!d.note && !fixed
      const color = fixed ? 0x6fbf73 : d.open ? 0xffcb7a : 0x6f6759
      const dot = this.add.circle(d.x, d.y, 10, color).setStrokeStyle(2, 0x141210)

      const note = fixed ? '已修好' : d.note
      this.add.text(d.x + 16, d.y - 10, `${d.name}${note ? ' · ' + note : ''}`, {
        fontFamily: 'sans-serif', fontSize: '14px', color: '#f0e9dc',
        backgroundColor: 'rgba(18,16,14,0.72)', padding: { x: 6, y: 3 },
      })

      if (d.open) {
        dot.setInteractive({ useHandCursor: true })
        dot.on('pointerdown', () => this.openBoard())
        // 感叹号：有毛病才挂，招呼点击（不靠台词）
        if (hasIssue) {
          const bang = this.add.text(d.x - 3, d.y - 44, '!', {
            fontFamily: 'sans-serif', fontSize: '26px', color: '#ff8a5b', fontStyle: 'bold',
            stroke: '#1a1410', strokeThickness: 4,
          })
          this.tweens.add({ targets: bang, y: bang.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        }
      }
    }

    this.board = this.buildBoard()
    this.board.setVisible(false)

    // 给冒烟读真实状态
    ;(window as unknown as { __houseState: object }).__houseState = {
      boardOpen: false, commission: '', fridgeFixed: isFixed('fridge'),
    }
  }

  private openBoard() {
    this.board.setVisible(true)
    const s = (window as unknown as { __houseState: { boardOpen: boolean; commission: string } }).__houseState
    s.boardOpen = true
    s.commission = COMMISSION.title
  }

  private buildBoard(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0)
    c.add(this.add.rectangle(1090, 210, 300, 320, 0x1a1613, 1).setStrokeStyle(1, 0x3a352c))
    c.add(this.add.text(960, 80, COMMISSION.title, {
      fontFamily: 'sans-serif', fontSize: '23px', color: '#e8e2d6', fontStyle: 'bold',
    }))
    c.add(this.add.text(960, 116, COMMISSION.brief, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#a49b8b',
      wordWrap: { width: 250, useAdvancedWrap: true },
    }))
    COMMISSION.steps.forEach((st, i) => {
      const x = 972 + i * 62
      c.add(this.add.circle(x, 214, 12, 0x2a2620).setStrokeStyle(1, 0x6f6759))
      c.add(this.add.text(x, 212, String(i + 1), { fontSize: '13px', color: '#a49b8b' }).setOrigin(0.5))
      c.add(this.add.text(x, 236, st, { fontSize: '12px', color: '#6f6759' }).setOrigin(0.5))
    })
    const btn = this.add.rectangle(1090, 302, 240, 44, 0xc0603a).setInteractive({ useHandCursor: true })
    const btnT = this.add.text(1090, 302, '钻进去看看 →', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#141210', fontStyle: 'bold',
    }).setOrigin(0.5)
    btn.on('pointerdown', () => this.scene.start('Instance'))
    c.add([btn, btnT])
    c.setDepth(100)
    return c
  }
}
