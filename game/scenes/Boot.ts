import * as Phaser from 'phaser'
import townUrl from '../../web/assets/xiami-town-dusk.png'

/** 预载场景：把资源读进来，再进小镇。 */
export class Boot extends Phaser.Scene {
  constructor() { super('Boot') }
  preload() {
    this.load.image('town', townUrl)
  }
  create() {
    this.scene.start('Town')
  }
}
