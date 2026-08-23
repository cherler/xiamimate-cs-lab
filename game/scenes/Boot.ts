import * as Phaser from 'phaser'
import houseUrl from '../../web/assets/gen/house.png'
import fridgeUrl from '../../web/assets/gen/fridge-concept.png'
import assistantUrl from '../../web/assets/gen/assistant.png'
import coilsUrl from '../../web/assets/gen/coils-bg.png'
import netUrl from '../../web/assets/gen/net-bg.png'
import dnsConceptUrl from '../../web/assets/gen/dns-concept.png'
import dnsMessenger from '../../web/assets/gen/dns/messenger-cut.png'
import dnsCabinet from '../../web/assets/gen/dns/cache-cabinet-cut.png'
import dnsDoorman from '../../web/assets/gen/dns/doorman-robot-cut.png'
import dnsTower from '../../web/assets/gen/dns/authority-tower-cut.png'

/** 预载场景：把资源读进来，再进小镇。 */
export class Boot extends Phaser.Scene {
  constructor() { super('Boot') }
  preload() {
    this.load.image('house', houseUrl)
    this.load.image('fridge', fridgeUrl)
    this.load.image('assistant', assistantUrl)
    this.load.image('coils', coilsUrl)
    this.load.image('net', netUrl)
    this.load.image('dns-concept', dnsConceptUrl)
    this.load.image('dns-messenger', dnsMessenger)
    this.load.image('dns-cabinet', dnsCabinet)
    this.load.image('dns-doorman', dnsDoorman)
    this.load.image('dns-tower', dnsTower)
  }
  create() {
    this.scene.start('House')
  }
}
