import * as Phaser from 'phaser'
import { FRIDGE } from '../../chapters/fridge/index.ts'

/** 对照实验台（C2）：选一个变量、跑 A/B、看两条温度曲线分叉。曲线终点来自求解器。 */
export class Experiment extends Phaser.Scene {
  private chosen = ''
  private ran = false
  private understood = false
  private endA = 0
  private endB = 0
  private varBtns: { id: string; rect: Phaser.GameObjects.Rectangle }[] = []
  private hint!: Phaser.GameObjects.Text
  private conclusion!: Phaser.GameObjects.Text
  private chart!: Phaser.GameObjects.Graphics
  private endLabels: Phaser.GameObjects.Text[] = []
  private backBtn!: Phaser.GameObjects.Container

  constructor() { super('Experiment') }

  create() {
    const W = this.scale.width, H = this.scale.height
    this.chosen = ''; this.ran = false; this.understood = false; this.varBtns = []; this.endLabels = []
    this.add.rectangle(W / 2, H / 2, W, H, 0x14171f)
    this.add.text(40, 30, '对照实验 · 散热片', { fontFamily: 'sans-serif', fontSize: '22px', color: '#e8e2d6' })
    this.hint = this.add.text(40, 74, '先猜：把散热片弄通，柜里会变凉，还是没区别？挑一个变量，只改它，跑一遍。', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#ffcb7a',
    })
    this.add.text(60, 150, '只改这一个：', { fontFamily: 'sans-serif', fontSize: '14px', color: '#a49b8b' })
    FRIDGE.experiment.vars.forEach((v, i) => {
      const y = 190 + i * 56
      const rect = this.add.rectangle(160, y, 200, 44, 0x2a2f38).setStrokeStyle(1, 0x565c68).setInteractive({ useHandCursor: true })
      this.add.text(160, y, v.name, { fontFamily: 'sans-serif', fontSize: '15px', color: '#cfc9bd' }).setOrigin(0.5)
      rect.on('pointerdown', () => this.choose(v.id))
      this.varBtns.push({ id: v.id, rect })
    })
    const runY = 190 + 3 * 56 + 20
    const runBtn = this.add.rectangle(160, runY, 200, 46, 0x3a4048).setStrokeStyle(1, 0x565c68).setInteractive({ useHandCursor: true })
    this.add.text(160, runY, '跑', { fontFamily: 'sans-serif', fontSize: '17px', color: '#cfc9bd', fontStyle: 'bold' }).setOrigin(0.5)
    runBtn.on('pointerdown', () => this.run())

    this.add.rectangle(760, 320, 470, 300, 0x1a1d24).setStrokeStyle(1, 0x3a3f4a)
    this.chart = this.add.graphics()
    this.conclusion = this.add.text(60, 560, '', { fontFamily: 'sans-serif', fontSize: '15px', color: '#cfc9bd', wordWrap: { width: 1120 } })
    this.backBtn = this.buildBack()
    this.backBtn.setVisible(false)
    this.expose()
  }

  private choose(id: string) {
    this.chosen = id
    for (const b of this.varBtns) b.rect.setFillStyle(b.id === id ? 0x2f4668 : 0x2a2f38)
    this.expose()
  }

  private run() {
    if (!this.chosen) { this.hint.setText('先挑一个变量。'); return }
    const r = FRIDGE.runExperiment(this.chosen)
    this.endA = r.endA; this.endB = r.endB; this.ran = true
    this.understood = this.chosen === FRIDGE.experiment.correctVar && r.endB < 10
    this.drawChart(r.endA, r.endB, r.labelA, r.labelB)
    if (this.understood) {
      this.conclusion.setColor('#6fbf73')
      this.conclusion.setText(`制冷=把热搬出去。把散热片弄通（${r.labelB}），柜里从 ${r.endA.toFixed(1)}℃ 掉到 ${r.endB.toFixed(1)}℃ —— 问题就在散热堵了。`)
      this.backBtn.setVisible(true)
    } else {
      this.conclusion.setColor('#cfc9bd')
      this.conclusion.setText(`两组：${r.labelA} ${r.endA.toFixed(1)}℃ / ${r.labelB} ${r.endB.toFixed(1)}℃。有区别，但都还偏高——问题不在「${r.name}」。换个变量试试。`)
    }
    this.expose()
  }

  private drawChart(endA: number, endB: number, labelA: string, labelB: string) {
    const x0 = 540, x1 = 980, yTop = 180, yBot = 460
    const tempY = (t: number) => yBot - (Phaser.Math.Clamp(t, 0, 40) / 40) * (yBot - yTop)
    this.chart.clear()
    const series: [number, number][] = [[endA, 0xd23b2e], [endB, 0x4aa3d9]]
    for (const [end, color] of series) {
      this.chart.lineStyle(3, color)
      this.chart.beginPath()
      const N = 40
      for (let i = 0; i <= N; i++) {
        const t = i / N
        const temp = end + (30 - end) * Math.exp(-3 * t)
        const x = x0 + t * (x1 - x0)
        const y = tempY(temp)
        if (i === 0) this.chart.moveTo(x, y); else this.chart.lineTo(x, y)
      }
      this.chart.strokePath()
    }
    for (const l of this.endLabels) l.destroy()
    this.endLabels = [
      this.add.text(x1 + 6, tempY(endA) - 8, `${labelA} ${endA.toFixed(1)}℃`, { fontSize: '13px', color: '#d23b2e' }),
      this.add.text(x1 + 6, tempY(endB) - 8, `${labelB} ${endB.toFixed(1)}℃`, { fontSize: '13px', color: '#4aa3d9' }),
    ]
  }

  private buildBack(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0)
    const btn = this.add.rectangle(760, 620, 240, 46, 0xc0603a).setInteractive({ useHandCursor: true })
    const t = this.add.text(760, 620, '看懂了，回去修 →', { fontFamily: 'sans-serif', fontSize: '16px', color: '#141210', fontStyle: 'bold' }).setOrigin(0.5)
    btn.on('pointerdown', () => this.scene.start('Repair'))
    c.add([btn, t])
    return c
  }

  private expose() {
    ;(window as unknown as { __expState: object }).__expState = {
      scene: 'Experiment', chosen: this.chosen, ran: this.ran, endA: this.endA, endB: this.endB, understood: this.understood,
    }
  }
}
