import * as Phaser from 'phaser'
import { PLACES, COMMISSION } from '../data/town.ts'

/** 小镇场景：像素背景 + 可点地点 + 委托板。 */
export class Town extends Phaser.Scene {
  private board!: Phaser.GameObjects.Container

  constructor() { super('Town') }

  create() {
    const W = this.scale.width, H = this.scale.height
    // 背景铺满
    this.add.image(W / 2, H / 2, 'town').setDisplaySize(W, H)

    // 地点标记 + 标签；只有 interactive 的能点
    for (const pl of PLACES) {
      const dot = this.add.circle(pl.x, pl.y, 10, pl.interactive ? 0xffcb7a : 0x6f6759)
        .setStrokeStyle(2, 0x141210)
      const label = `${pl.name}${pl.note ? ' · ' + pl.note : ''}`
      this.add.text(pl.x + 16, pl.y - 10, label, {
        fontFamily: 'sans-serif', fontSize: '15px', color: '#e8e2d6',
        backgroundColor: 'rgba(20,18,15,0.7)', padding: { x: 6, y: 3 },
      })
      if (pl.interactive) {
        dot.setInteractive({ useHandCursor: true })
        // "!" 提示
        this.add.text(pl.x - 4, pl.y - 34, '!', {
          fontFamily: 'sans-serif', fontSize: '22px', color: '#ff8a5b', fontStyle: 'bold',
        })
        dot.on('pointerdown', () => this.openBoard())
      }
    }

    this.board = this.buildBoard()
    this.board.setVisible(false)

    // 给冒烟读真实状态
    ;(window as unknown as { __townState: object }).__townState = { boardOpen: false, commission: '', enterClicked: false }
  }

  private openBoard() {
    this.board.setVisible(true)
    const s = (window as unknown as { __townState: { boardOpen: boolean; commission: string } }).__townState
    s.boardOpen = true
    s.commission = COMMISSION.title
  }

  private buildBoard(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0)
    const panel = this.add.rectangle(1090, 210, 300, 320, 0x1a1613, 0.94).setStrokeStyle(1, 0x3a352c)
    const title = this.add.text(960, 80, COMMISSION.title, {
      fontFamily: 'sans-serif', fontSize: '24px', color: '#e8e2d6', fontStyle: 'bold',
    })
    const brief = this.add.text(960, 118, COMMISSION.brief, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#a49b8b', wordWrap: { width: 260 },
    })
    c.add([panel, title, brief])
    // 四步骨架
    COMMISSION.steps.forEach((st, i) => {
      const x = 972 + i * 62
      c.add(this.add.circle(x, 210, 12, 0x2a2620).setStrokeStyle(1, 0x6f6759))
      c.add(this.add.text(x, 208, String(i + 1), { fontSize: '13px', color: '#a49b8b' }).setOrigin(0.5))
      c.add(this.add.text(x, 232, st, { fontSize: '12px', color: '#6f6759' }).setOrigin(0.5))
    })
    // 进入副本 按钮（B2 只置一个标记；B3 再接 scene.start('Instance')）
    const btn = this.add.rectangle(1090, 300, 240, 44, 0xc0603a).setInteractive({ useHandCursor: true })
    const btnT = this.add.text(1090, 300, '进入副本 →', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#141210', fontStyle: 'bold',
    }).setOrigin(0.5)
    btn.on('pointerdown', () => {
      ;(window as unknown as { __townState: { enterClicked: boolean } }).__townState.enterClicked = true
      // B3 将在此处 this.scene.start('Instance')
    })
    c.add([btn, btnT])
    return c
  }
}
