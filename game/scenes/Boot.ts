import * as Phaser from 'phaser'

/** 启动场景 —— 先证 Phaser 真的画得出东西（不是白屏）。 */
export class Boot extends Phaser.Scene {
  constructor() { super('Boot') }
  create() {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, '虾米镇', {
        fontFamily: 'sans-serif',
        fontSize: '48px',
        color: '#e8e2d6',
      })
      .setOrigin(0.5)
  }
}
