import * as Phaser from 'phaser'
import { Boot } from './scenes/Boot.ts'
import { Town } from './scenes/Town.ts'
import { Instance } from './scenes/Instance.ts'
import { Experiment } from './scenes/Experiment.ts'
import { Repair } from './scenes/Repair.ts'

// 去掉浏览器默认 body 边距：让 FIT 画布真正铺满 1280×720、scale=1.0、屏幕坐标==游戏坐标
document.documentElement.style.margin = document.body.style.margin = '0'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#0e1524',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Town, Instance, Experiment, Repair],
}

const game = new Phaser.Game(config)
// 给冒烟脚本读真实引擎状态用（不靠像素猜）
;(window as unknown as { __game: Phaser.Game }).__game = game
