import * as Phaser from 'phaser'

/** 生成背景图 cover 铺满 + 压暗罩，让上层 UI 读得清。副本内页共用。 */
const IW = 1536, IH = 1024
export function coverBg(scene: Phaser.Scene, key: string, darken = 0.55) {
  const W = scene.scale.width, H = scene.scale.height
  const s = Math.max(W / IW, H / IH)
  scene.add.image(W / 2, H / 2, key).setDisplaySize(IW * s, IH * s)
  scene.add.rectangle(W / 2, H / 2, W, H, 0x0a0f16, darken)
}
