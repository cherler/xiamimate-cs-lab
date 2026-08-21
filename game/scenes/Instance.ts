import * as Phaser from 'phaser'
import { markFixed } from '../save.ts'

/** 副本（占位）：硬切进来的独立场景。真玩法（扫→对照→修）在 C 阶段填。 */
export class Instance extends Phaser.Scene {
  constructor() { super('Instance') }
  create() {
    const W = this.scale.width, H = this.scale.height
    this.add.rectangle(W / 2, H / 2, W, H, 0x0e1524)
    this.add.text(W / 2, H / 2 - 60, '副本 · 冷藏柜（占位）', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#e8e2d6',
    }).setOrigin(0.5)
    this.add.text(W / 2, H / 2 - 20, '这里以后是：扫出异常 → 对照实验 → 修好', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#a49b8b',
    }).setOrigin(0.5)
    const btn = this.add.rectangle(W / 2, H / 2 + 60, 240, 48, 0xc0603a).setInteractive({ useHandCursor: true })
    this.add.text(W / 2, H / 2 + 60, '完成修复', {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#141210', fontStyle: 'bold',
    }).setOrigin(0.5)
    btn.on('pointerdown', () => {
      markFixed('clinic')
      this.scene.start('Town')
    })
    ;(window as unknown as { __sceneKey: string }).__sceneKey = 'Instance'
  }
}
