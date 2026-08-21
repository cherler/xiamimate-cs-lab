import * as Phaser from 'phaser'
import { Boot } from './scenes/Boot.ts'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#0e1524',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot],
}

const game = new Phaser.Game(config)
// 给冒烟脚本读真实引擎状态用（不靠像素猜）
;(window as unknown as { __game: Phaser.Game }).__game = game
