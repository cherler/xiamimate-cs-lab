/**
 * 第一道门 · 查号图书馆(DNS)· Phaser 场景。副本世界的一段:侧视、镜头跟角色、边走边解密。
 * 手册规范:**零文字**——正常/异常全靠画面(紫=被投毒/毒往上淌;青=干净;修好后整片区点亮、包重新流动、掉素材)。
 * 玩法:走到发紫的档案柜 → 用冲刷枪(靠近按 空格/E 或点它)冲干净;但**源头(最右那格)会往上淌**,得先冲源头/全冲干净;
 *   三格全净 → 卡住的包拿到真地址、栅门落下、这片区活过来、掉「真地址签」→ 走过去捡 → 通关这道门。
 */
import * as Phaser from 'phaser'
import hallUrl from '../../web/assets/gen/gate/hall.webp'
import cabUrl from '../../web/assets/gen/gate/cabinet.webp'
import packUrl from '../../web/assets/gen/gate/packet.webp'
import crysUrl from '../../web/assets/gen/gate/crystal.webp'
import tagUrl from '../../web/assets/gen/gate/tag.webp'
import droneUrl from '../../web/assets/gen/dns/drone.webp'

const WW = 3000
const POISON = 0x9b6cc0

class DnsGate extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image
  private vx = 0; private face = 1
  private cabs: { img: Phaser.GameObjects.Image; sym: Phaser.GameObjects.Arc; drip: number; poison: number; x: number }[] = []
  private packet!: Phaser.GameObjects.Image
  private barrier!: Phaser.GameObjects.Rectangle
  private dark!: Phaser.GameObjects.Rectangle
  private prompt!: Phaser.GameObjects.Text
  private bg!: Phaser.GameObjects.TileSprite
  private floorY = 0
  private won = false; private got = false
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private lanterns: Phaser.GameObjects.Arc[] = []

  constructor() { super('dns-gate') }
  preload() { this.load.image('hall', hallUrl); this.load.image('cab', cabUrl); this.load.image('pack', packUrl); this.load.image('crys', crysUrl); this.load.image('tag', tagUrl); this.load.image('drone', droneUrl) }

  create() {
    const H = this.scale.height
    this.floorY = H * 0.80
    this.won = false; this.got = false; this.vx = 0
    this.bg = this.add.tileSprite(0, 0, this.scale.width, H, 'hall').setOrigin(0).setScrollFactor(0)
    const t = this.textures.get('hall').getSourceImage() as HTMLImageElement
    this.bg.setTileScale(H / t.height, H / t.height)
    this.cameras.main.setBounds(0, 0, WW, H)

    // 地面暗角
    this.add.rectangle(0, this.floorY, WW, H - this.floorY, 0x140f0a, 0.32).setOrigin(0, 0)
    // 灯(修好前暗、修好后亮)
    for (let i = 0; i < 8; i++) { const l = this.add.circle(200 + i * 340, H * 0.2, 16, 0xffdc8a, 0.12); this.lanterns.push(l) }

    // 真相源水晶(青 = 干净该长这样)
    this.add.image(300, this.floorY - 70, 'crys').setScale(H / 900 * 0.5)
    this.add.circle(300, this.floorY - 70, 40, 0x49a791, 0.18)

    // 三个缓存柜(0浏览器 1系统 2递归=源头,最右)
    const cs = H / 1024 * 0.42
    ;[820, 1120, 1420].forEach((x) => {
      const img = this.add.image(x, this.floorY, 'cab').setOrigin(0.5, 1).setScale(cs)
      const sym = this.add.circle(x, this.floorY - img.displayHeight + 22, 12, POISON) // 顶上符号:紫=脏/青=净
      this.cabs.push({ img, sym, drip: 0, poison: 1, x })
    })

    // 卡在栅门口的包(拿着假地址=紫)
    this.packet = this.add.image(1620, this.floorY - 4, 'pack').setOrigin(0.5, 1).setScale(H / 1024 * 0.16).setTint(POISON)
    this.barrier = this.add.rectangle(1720, this.floorY, 26, H * 0.42, 0x6a5236).setOrigin(0.5, 1)
    this.add.rectangle(1720, this.floorY - H * 0.42, 40, 16, 0x8a6a44).setOrigin(0.5, 0.5)

    // 修好前压一层暗(整片区没精神)
    this.dark = this.add.rectangle(0, 0, WW, H, 0x120b06, 0.42).setOrigin(0).setScrollFactor(0)

    // 玩家(修理机)
    this.player = this.add.image(150, this.floorY, 'drone').setOrigin(0.5, 1).setScale(H / 1024 * 0.16)
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09)
    ;(window as unknown as { __gate: DnsGate }).__gate = this

    // 交互提示图标(纯 emoji,无文字)
    this.prompt = this.add.text(0, 0, '💨', { fontSize: '30px' }).setOrigin(0.5).setVisible(false)

    // 输入
    this.keys = this.input.keyboard!.addKeys('A,D,LEFT,RIGHT,SPACE,E') as Record<string, Phaser.Input.Keyboard.Key>
    this.input.keyboard!.on('keydown-SPACE', () => this.tryFlush())
    this.input.keyboard!.on('keydown-E', () => this.tryFlush())
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.got) return
      const wx = p.worldX
      const c = this.nearCab(wx); if (c && Math.abs(c.x - this.player.x) < 150) this.flush(c)
    })
  }

  private nearCab(x: number) { return this.cabs.find(c => Math.abs(c.x - x) < 70) ?? null }
  private tryFlush() { const c = this.cabs.find(c => Math.abs(c.x - this.player.x) < 130 && c.poison > 0.1); if (c) this.flush(c) }
  private flush(c: { poison: number; x: number }) {
    if (this.won) return
    c.poison = 0
    // 冲刷喷溅
    for (let i = 0; i < 14; i++) { const s = this.add.circle(c.x + (Math.random() - .5) * 30, this.floorY - 40, 3 + Math.random() * 3, POISON); this.tweens.add({ targets: s, x: s.x + (Math.random() - .5) * 90, y: s.y + 40 + Math.random() * 40, alpha: 0, duration: 500, onComplete: () => s.destroy() }) }
    this.cameras.main.shake(120, 0.004)
  }

  update(_t: number, dt: number) {
    const d = dt / 16.7
    // 走路(手搓加速/摩擦,顺滑)
    let dir = 0
    if (this.keys.A?.isDown || this.keys.LEFT?.isDown) dir = -1
    if (this.keys.D?.isDown || this.keys.RIGHT?.isDown) dir = 1
    this.vx += (dir * 5 - this.vx) * 0.18 * d
    this.player.x = Phaser.Math.Clamp(this.player.x + this.vx * d, 60, WW - 60)
    if (dir !== 0) this.face = dir
    this.player.setScale((this.face < 0 ? -1 : 1) * Math.abs(this.player.scaleX), this.player.scaleY)
    this.player.y = this.floorY + Math.sin(this.time.now / 180) * 5
    this.bg.tilePositionX = this.cameras.main.scrollX * 0.5

    // 传播:源头(最右)往上淌;非源格朝「更深格的最大毒」爬
    if (!this.won) {
      for (let i = 0; i < this.cabs.length; i++) {
        if (i < this.cabs.length - 1) { const deep = Math.max(...this.cabs.slice(i + 1).map(c => c.poison)); if (deep > 0.35 && this.cabs[i]!.poison < deep) this.cabs[i]!.poison = Math.min(deep, this.cabs[i]!.poison + 0.012 * d) }
      }
    }
    // 柜子外观 = 毒值(紫染 + 顶符号色 + 滴)
    for (const c of this.cabs) {
      const p = c.poison
      c.img.setTint(Phaser.Display.Color.GetColor(255 - p * 90, 255 - p * 120, 255 - p * 40))
      c.sym.setFillStyle(p > 0.4 ? POISON : 0x49a791).setScale(1 + Math.sin(this.time.now / 300) * 0.08 * (p > .4 ? 1 : .3))
      if (p > 0.4) { c.drip -= d; if (c.drip <= 0) { c.drip = 14; const s = this.add.circle(c.x + (Math.random() - .5) * 34, this.floorY - c.img.displayHeight + 30, 3, POISON, 0.8); this.tweens.add({ targets: s, y: this.floorY - 8, alpha: 0, duration: 900, onComplete: () => s.destroy() }) } }
    }

    // 交互提示
    if (!this.got) { const c = this.cabs.find(c => Math.abs(c.x - this.player.x) < 130 && c.poison > 0.1); if (c) { this.prompt.setPosition(this.player.x, this.floorY - this.player.displayHeight - 20).setVisible(true) } else this.prompt.setVisible(false) }

    // 胜利判定:三格全净
    if (!this.won && this.cabs.every(c => c.poison < 0.15)) this.win()

    // 捡素材:走到「真地址签」上 → 收进右上角(纯图标,无文字)
    if (this.pickTag && !this.got && Math.abs(this.player.x - this.pickTag.x) < 80) {
      this.got = true; const H = this.scale.height, tg = this.pickTag
      this.tweens.add({ targets: tg, y: tg.y - 60, alpha: 0, duration: 500, onComplete: () => tg.destroy() })
      const hud = this.add.image(46, 46, 'tag').setScrollFactor(0).setScale(H / 1024 * 0.08)
      this.tweens.add({ targets: hud, scale: { from: hud.scale * 1.6, to: hud.scale }, duration: 400, ease: 'Back.out' })
      this.cameras.main.flash(200, 255, 240, 200)
    }
  }
  snapshot() { return { x: Math.round(this.player.x), poison: this.cabs.map(c => +c.poison.toFixed(2)), won: this.won, got: this.got } }
  devFlushAll() { for (const c of this.cabs) c.poison = 0 }
  devMove(x: number) { this.player.x = x }

  private win() {
    this.won = true; this.prompt.setVisible(false)
    // 包拿到真地址(转青)、栅门升起、整片区点亮
    this.tweens.add({ targets: this.packet, alpha: { from: 1, to: 1 }, duration: 200, onStart: () => this.packet.clearTint() })
    this.tweens.add({ targets: this.packet, x: 1760, alpha: 0, duration: 900, delay: 400 })
    this.tweens.add({ targets: this.barrier, scaleY: 0, y: this.floorY - this.barrier.height, duration: 700, ease: 'Back.in' })
    this.tweens.add({ targets: this.dark, alpha: 0, duration: 1100, ease: 'Sine.out' })
    for (const l of this.lanterns) this.tweens.add({ targets: l, fillAlpha: 0.7, scale: 1.5, duration: 900, ease: 'Sine.out' })
    this.cameras.main.flash(300, 255, 240, 200)
    // 掉「真地址签」素材
    this.time.delayedCall(700, () => {
      const H = this.scale.height, tag = this.add.image(1120, this.floorY - 260, 'tag').setScale(H / 1024 * 0.14)
      this.tweens.add({ targets: tag, y: this.floorY - 60, duration: 700, ease: 'Bounce.out' })
      this.tweens.add({ targets: tag, angle: 360, duration: 2400, repeat: -1 })
      this.add.circle(1120, this.floorY - 60, 26, 0xffdc8a, 0.25)
      this.pickTag = tag
    })
  }
  private pickTag?: Phaser.GameObjects.Image
}

const parent = document.getElementById('app')!
new Phaser.Game({ type: Phaser.AUTO, parent, backgroundColor: '#1a1510', scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight }, scene: [DnsGate] })
