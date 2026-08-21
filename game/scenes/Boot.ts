import * as Phaser from 'phaser'
import townUrl from '../../web/assets/xiami-town-dusk.png'
import fridgeUrl from '../../web/assets/gen/fridge-concept.png'

/** 预载场景：把资源读进来，再进小镇。 */
export class Boot extends Phaser.Scene {
  constructor() { super('Boot') }
  preload() {
    this.load.image('town', townUrl)
    this.load.image('fridge', fridgeUrl)
  }
  create() {
    this.scene.start('Town')
  }
}
