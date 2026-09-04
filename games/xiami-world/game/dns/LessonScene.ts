import * as Phaser from 'phaser'
import { DnsSim } from '../../solvers/dns/sim.ts'
import { createDialogue, type Dialogue } from '../ui/dialogue.ts'
import { createPredict } from '../ui/predict.ts'
import { markFixed } from '../save.ts'

/**
 * DNS 第一课《名字连不上，翻译一下才通》
 *
 * 理论内核（重心）：**间接层——名字≠地址，中间藏着一次翻译。**
 * 设计原则：**玩中懂**，不考试。理解是玩家亲手操作出来的：
 *   你想上 example.com → 亲手用"名字"去连 → 撞墙(机器不认名字)
 *   → 亲手拿名字去查号台换成"门牌号"(IP) → 用号拨通 → 啊哈。
 * 咕噜在操作的当口点因果，不总结、不判分。
 *
 * 角色/精灵复用送信世界那套；故障、诊断全部推到后面的进阶关，这一课只讲"为什么要有这层翻译"。
 */
type Phase = 'intro' | 'try-name' | 'lookup' | 'connect-ip' | 'done'

export class LessonScene extends Phaser.Scene {
  private sim!: DnsSim
  private dlg!: Dialogue
  private phase: Phase = 'intro'
  private ip: string | null = null
  private site = 'example.com'
  // UI
  private nameCard!: Phaser.GameObjects.Container   // 写着 example.com 的名字卡
  private ipCard?: Phaser.GameObjects.Container     // 翻译出来的门牌号卡
  private machine!: Phaser.GameObjects.Container     // 远端那台机器
  private deskBtns: Phaser.GameObjects.Container[] = []
  private hint!: Phaser.GameObjects.Text

  constructor() { super('LessonScene') }

  create() {
    const W = this.scale.width, H = this.scale.height
    this.sim = new DnsSim()
    this.phase = 'intro'; this.ip = null; this.deskBtns = []

    this.add.rectangle(W / 2, H / 2, W, H, 0x0c1420)
    const grad = this.add.graphics(); grad.fillStyle(0x14243a, 0.5); grad.fillRect(0, 0, W, H * 0.5)

    this.add.text(40, 26, 'DNS 第一课 · 你想上一个网站', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#e8e2d6',
    })
    this.hint = this.add.text(40, 60, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#9fb0c2' })

    // 你的电脑（左）
    this.add.rectangle(150, 400, 120, 90, 0x2a3a4e).setStrokeStyle(2, 0x5a7d9c)
    this.add.rectangle(150, 388, 92, 58, 0x1a86c8).setStrokeStyle(1, 0x0e1622)
    this.add.text(150, 470, '你的电脑', { fontFamily: 'sans-serif', fontSize: '13px', color: '#9fb0c2' }).setOrigin(0.5)

    // 远端那台机器（右）—— example.com 真正所在
    this.machine = this.buildMachine(1050, 380)

    // 名字卡（手里攥着的 example.com）
    this.nameCard = this.buildCard(150, 300, this.site, 0xffcb7a, '你想去的网站')

    // 查号台（中，DNS）—— 用门房精灵当查号员
    const clerk = this.add.image(620, 400, 'dns-doorman')
    clerk.setScale(150 / clerk.height)
    this.add.text(620, 490, '查号台（DNS）', { fontFamily: 'sans-serif', fontSize: '13px', color: '#9fb0c2' }).setOrigin(0.5)

    this.dlg = createDialogue(this, 30, H - 116, 620)
    this.buildDesk(W, H)
    this.goPhase('intro')
  }

  private buildMachine(x: number, y: number): Phaser.GameObjects.Container {
    const box = this.add.rectangle(0, 0, 110, 130, 0x33404e).setStrokeStyle(2, 0x5a7d9c)
    const face = this.add.text(0, -10, '?', { fontFamily: 'sans-serif', fontSize: '40px', color: '#6f8298' }).setOrigin(0.5)
    const label = this.add.text(0, 84, 'example.com\n那台机器', { fontFamily: 'sans-serif', fontSize: '12px', color: '#9fb0c2', align: 'center' }).setOrigin(0.5, 0)
    return this.add.container(x, y, [box, face, label])
  }

  private buildCard(x: number, y: number, text: string, color: number, sub: string): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 168, 54, 0x1b2838).setStrokeStyle(2, color)
    const t = this.add.text(0, -6, text, { fontFamily: 'monospace', fontSize: '16px', color: '#f0e9dc' }).setOrigin(0.5)
    const s = this.add.text(0, 16, sub, { fontFamily: 'sans-serif', fontSize: '10px', color: '#8fa3ba' }).setOrigin(0.5)
    return this.add.container(x, y, [bg, t, s]).setDepth(20)
  }

  /** 底部动作台：每个阶段换按钮。动作**不写答案**，写玩家意图 */
  private buildDesk(_W: number, H: number) {
    // 占位，goPhase 时重建
    void H
  }

  private setDesk(buttons: { label: string; cb: () => void }[]) {
    this.deskBtns.forEach(b => b.destroy())
    this.deskBtns = []
    const H = this.scale.height
    buttons.forEach((b, i) => {
      const x = 720 + i * 250
      const bg = this.add.rectangle(0, 0, 230, 50, 0xc0603a).setInteractive({ useHandCursor: true })
      const t = this.add.text(0, 0, b.label, { fontFamily: 'sans-serif', fontSize: '15px', color: '#141210', fontStyle: 'bold' }).setOrigin(0.5)
      bg.on('pointerover', () => bg.setFillStyle(0xd0703a))
      bg.on('pointerout', () => bg.setFillStyle(0xc0603a))
      bg.on('pointerdown', b.cb)
      this.deskBtns.push(this.add.container(x, H - 44, [bg, t]).setDepth(15))
    })
  }

  private goPhase(phase: Phase) {
    this.phase = phase
    this.expose()
    if (phase === 'intro') {
      this.hint.setText('你想打开 example.com。你手里攥着这个"名字"。')
      this.dlg.setText('想上 example.com 对吧？你手里这张卡就是网站的名字。直接拿它去连那台机器试试？')
      this.setDesk([{ label: '拿"名字"去连那台机器', cb: () => this.tryName() }])
    }
  }

  /** 阶段①：亲手用名字直连 → 撞墙。先押注制造啊哈 */
  private tryName() {
    createPredict(this, {
      question: '你觉得电脑能直接用 "example.com" 这个名字连上那台机器吗？',
      anchor: '你手里只有名字 example.com，还没有它的门牌号',
      options: [{ id: 'yes', label: '能，直接连' }, { id: 'no', label: '不能' }],
      onDone: () => this.doTryName(),
    })
  }

  private doTryName() {
    // 名字卡飞向机器 → 弹回来（连不上）
    this.tweens.add({
      targets: this.nameCard, x: 950, duration: 600, ease: 'Sine.easeIn',
      onComplete: () => {
        const r = this.sim.connectByName(this.site)
        // 机器一脸懵
        ;(this.machine.list[1] as Phaser.GameObjects.Text).setText('？！').setColor('#ff8a5b')
        this.tweens.add({ targets: this.nameCard, x: 150, duration: 500, ease: 'Sine.easeOut' })
        this.hint.setText('连不上——那台机器不认识这个名字。')
        this.dlg.setText(r.reason + ' 它只认门牌号（IP）。名字是给你记的，机器不用名字。')
        this.time.delayedCall(900, () => this.goLookup())
      },
    })
  }

  /** 阶段②：拿名字去查号台换门牌号 */
  private goLookup() {
    this.phase = 'lookup'; this.expose()
    this.hint.setText('得先把"名字"翻译成"门牌号"。查号台（DNS）就是干这个的。')
    this.dlg.setText('所以得先去查号台问一声：example.com 的门牌号是多少？拿名字去查一下。')
    this.setDesk([{ label: '拿"名字"去查号台问门牌号', cb: () => this.doLookup() }])
  }

  private doLookup() {
    // 名字卡飞到查号台 → 变出门牌号卡
    this.tweens.add({
      targets: this.nameCard, x: 620, y: 300, duration: 600, ease: 'Sine.easeInOut',
      onComplete: () => {
        this.ip = this.sim.lookupIp(this.site)
        this.tweens.add({ targets: this.nameCard, x: 150, y: 300, duration: 500 })
        this.ipCard = this.buildCard(620, 300, this.ip ?? '???', 0x6fbf73, '门牌号（IP）')
        this.ipCard.setScale(0)
        this.tweens.add({ targets: this.ipCard, scale: 1, duration: 300, ease: 'Back.easeOut' })
        this.hint.setText(`查号台把 ${this.site} 翻译成了门牌号 ${this.ip}。`)
        this.dlg.setText(`查到了！${this.site} → ${this.ip}。这串数字才是那台机器的门牌号。现在拿号去连。`)
        this.time.delayedCall(900, () => this.goConnect())
      },
    })
  }

  /** 阶段③：拿门牌号拨通 */
  private goConnect() {
    this.phase = 'connect-ip'; this.expose()
    this.setDesk([{ label: '拿"门牌号"去连那台机器', cb: () => this.doConnect() }])
  }

  private doConnect() {
    if (!this.ipCard || !this.ip) return
    this.tweens.add({
      targets: this.ipCard, x: 950, y: 380, duration: 600, ease: 'Sine.easeIn',
      onComplete: () => {
        const r = this.sim.connectByIp(this.ip!, this.site)
        ;(this.machine.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(3, 0x6fbf73)
        ;(this.machine.list[1] as Phaser.GameObjects.Text).setText('✓').setColor('#6fbf73')
        this.hint.setText('通了！' + r.reason)
        this.dlg.setText('拨通了。看明白没——你每次上网，背后都先偷偷做了这一步：把名字翻译成门牌号。这层翻译，就是 DNS。')
        this.finish()
      },
    })
  }

  private finish() {
    this.phase = 'done'; this.expose()
    markFixed('dns-lesson-1')
    this.setDesk([{ label: '我懂了，回房子', cb: () => this.scene.start('House') }])
  }

  private expose() {
    ;(window as unknown as { __lesson: object }).__lesson = {
      scene: 'LessonScene', phase: this.phase, ip: this.ip,
      done: this.phase === 'done',
    }
  }
}
