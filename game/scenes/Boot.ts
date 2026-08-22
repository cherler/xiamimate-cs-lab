import * as Phaser from 'phaser'
import houseUrl from '../../web/assets/gen/house.png'
import fridgeUrl from '../../web/assets/gen/fridge-concept.png'
import assistantUrl from '../../web/assets/gen/assistant.png'
import coilsUrl from '../../web/assets/gen/coils-bg.png'

/** 预载场景：把资源读进来，再进小镇。 */
export class Boot extends Phaser.Scene {
  constructor() { super('Boot') }
  preload() {
    this.load.image('house', houseUrl)
    this.load.image('fridge', fridgeUrl)
    this.load.image('assistant', assistantUrl)
    this.load.image('coils', coilsUrl)
  }
  create() {
    this.scene.start('House')
  }
}
