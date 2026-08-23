import * as Phaser from 'phaser'
import { Boot } from './scenes/Boot.ts'
import { House } from './scenes/House.ts'
import { Instance } from './scenes/Instance.ts'
import { Experiment } from './scenes/Experiment.ts'
import { Repair } from './scenes/Repair.ts'
import { NetCase } from './scenes/NetCase.ts'
import { DnsScene } from './dns/DnsScene.ts'
import { startBgm, toggleMuted, isMuted } from './ui/audio.ts'

// 去掉浏览器默认 body 边距：让 FIT 画布真正铺满 1280×720、scale=1.0、屏幕坐标==游戏坐标
document.documentElement.style.margin = document.body.style.margin = '0'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#0e1524',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, House, Instance, Experiment, Repair, NetCase, DnsScene],
}

const game = new Phaser.Game(config)
// 给冒烟脚本读真实引擎状态用（不靠像素猜）
;(window as unknown as { __game: Phaser.Game }).__game = game

// 首次交互启动 BGM（浏览器禁止无交互自动播放）
addEventListener('pointerdown', () => startBgm(), { once: true })

// 静音开关：DOM 常驻按钮（跨场景），放右下角避开游戏内控件
const muteBtn = document.createElement('button')
muteBtn.textContent = isMuted() ? '🔇' : '🔊'
muteBtn.style.cssText = 'position:fixed;bottom:12px;right:14px;z-index:10;background:rgba(16,20,26,.75);color:#e8e2d6;border:1px solid rgba(232,226,214,.22);border-radius:8px;font-size:18px;line-height:1;padding:6px 9px;cursor:pointer'
muteBtn.title = '静音 / 取消静音'
muteBtn.onclick = () => { muteBtn.textContent = toggleMuted() ? '🔇' : '🔊' }
document.body.appendChild(muteBtn)
