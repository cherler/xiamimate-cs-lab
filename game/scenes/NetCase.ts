import * as Phaser from 'phaser'
import { resolve, pingIp, canOpenSite, PUBLIC_DNS, ROUTER_DNS, type Net } from '../../solvers/dns.ts'
import { createDialogue, type Dialogue } from '../ui/dialogue.ts'
import { createPredict } from '../ui/predict.ts'
import { coverBg } from '../ui/bg.ts'
import { markFixed } from '../save.ts'

/**
 * 系列 A · 第一关《网页打不开，但游戏还能玩》
 *
 * 密：**网是通的，坏的是"查地址"那一步。**
 * 流程：症状 → 先押（网断了吗）→ 三件工具动手 → 结果先打脸 → 咕噜再解释 → 换 DNS 修好。
 *
 * 屏幕上每个结论都来自 `solvers/dns.ts`；咕噜只翻译，不算数、不编。
 */
const SITE = 'example.com'
const GAME_IP = '203.0.113.20'

type ToolId = 'ping-ip' | 'resolve' | 'switch-dns'

export class NetCase extends Phaser.Scene {
  private net!: Net
  private dlg!: Dialogue
  private log!: Phaser.GameObjects.Text
  private lines: string[] = []
  private guess: string | null = null
  private done: Record<ToolId, boolean> = { 'ping-ip': false, resolve: false, 'switch-dns': false }
  private btns: { id: ToolId; rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = []
  private fixBtn!: Phaser.GameObjects.Rectangle
  private fixT!: Phaser.GameObjects.Text

  constructor() { super('NetCase') }

  create() {
    const W = this.scale.width, H = this.scale.height
    this.lines = []; this.guess = null
    this.done = { 'ping-ip': false, resolve: false, 'switch-dns': false }
    this.btns = []

    // 故障：这一版固定 DNS 挂掉（后续可随机 server-slow / poisoned-cache）
    this.net = {
      linkUp: true, dnsServer: ROUTER_DNS, cache: {}, hosts: {},
      fault: 'server-down', latencyMs: 30, timeoutMs: 2000,
    }

    coverBg(this, 'net', 0.42)

    this.add.text(40, 26, '书房 · 网络', {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#e8e2d6',
      backgroundColor: 'rgba(10,16,24,0.5)', padding: { x: 8, y: 4 },
    })
    this.add.text(40, 62, '网页一直转圈，可游戏一点不卡。', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#9fb0c2',
      backgroundColor: 'rgba(10,16,24,0.5)', padding: { x: 8, y: 3 },
    })

    // 工具台
    this.buildTool('ping-ip', 'ping 一个 IP', 250, H - 250)
    this.buildTool('resolve', `解析 ${SITE}`, 250, H - 190)
    this.buildTool('switch-dns', '换个 DNS 服务器', 250, H - 130)

    // 读数区
    this.log = this.add.text(470, H - 268, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfe0f0', lineSpacing: 5,
      backgroundColor: 'rgba(8,14,22,0.72)', padding: { x: 12, y: 10 },
      wordWrap: { width: 560, useAdvancedWrap: true },
    })

    this.fixBtn = this.add.rectangle(W - 150, H - 60, 220, 46, 0x3a4038).setInteractive({ useHandCursor: true })
    this.fixT = this.add.text(W - 150, H - 60, '修好了，回房子', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#6f6759',
    }).setOrigin(0.5)
    this.fixBtn.on('pointerdown', () => {
      if (!canOpenSite(this.net, SITE)) return
      markFixed('router')
      this.scene.start('House')
    })

    this.dlg = createDialogue(this, 30, 96, 620)
    this.dlg.setText('网页转圈，游戏却一点不卡……先别急着重启路由器。')

    this.expose()
    // 押注：先押方向，再动手
    this.time.delayedCall(500, () => this.askPredict())
  }

  private askPredict() {
    createPredict(this, {
      question: '网页打不开，可游戏在线、语音也通。你觉得网断了吗？',
      anchor: `现状：游戏在线 · 语音正常 · 浏览器打不开 ${SITE}`,
      options: [
        { id: 'down', label: '网断了' },
        { id: 'other', label: '没断，别的毛病' },
      ],
      onDone: r => {
        this.guess = r.picked
        this.expose()
        this.dlg.setText(r.skipped
          ? '行，那先动手试试——工具在左边。'
          : '押好了。别听我的，自己拿工具量一量。')
      },
    })
  }

  private buildTool(id: ToolId, label: string, x: number, y: number) {
    const rect = this.add.rectangle(x, y, 300, 48, 0x1b2838, 0.94).setStrokeStyle(2, 0x5a7d9c).setInteractive({ useHandCursor: true })
    const t = this.add.text(x, y, label, { fontFamily: 'sans-serif', fontSize: '15px', color: '#e8e2d6' }).setOrigin(0.5)
    rect.on('pointerover', () => rect.setFillStyle(0x2f4668, 0.96))
    rect.on('pointerout', () => rect.setFillStyle(0x1b2838, 0.94))
    rect.on('pointerdown', () => this.useTool(id))
    this.btns.push({ id, rect, label: t })
  }

  private push(s: string) {
    this.lines.push(s)
    this.log.setText(this.lines.slice(-8).join('\n'))
  }

  private useTool(id: ToolId) {
    if (id === 'ping-ip') {
      const r = pingIp(this.net, GAME_IP)
      this.push(`$ ping ${GAME_IP}\n  ${r.ok ? `通，${r.ms}ms` : '不通'} —— ${r.note}`)
      this.done['ping-ip'] = true
      // 结果先打脸，咕噜再解释
      this.dlg.setText(this.guess === 'down'
        ? 'IP 是通的——网没断。你押断了，那现在问题在哪？'
        : 'IP 通着，网确实没断。那网页卡在哪一步？')
    } else if (id === 'resolve') {
      const r = resolve(this.net, SITE)
      const steps = r.steps.map(s => `  ${s.ok ? '✓' : '✗'} ${s.where}：${s.note}`).join('\n')
      this.push(`$ resolve ${SITE}\n${steps}\n  ${r.ip ?? '解析失败'}`)
      this.done.resolve = true
      this.dlg.setText(r.notes[r.notes.length - 1] ?? '解析这一步没过去。')
    } else {
      this.net = { ...this.net, dnsServer: PUBLIC_DNS }
      const r = resolve(this.net, SITE)
      this.push(`$ set dns ${PUBLIC_DNS}\n$ resolve ${SITE}\n  ${r.ip ?? '仍然失败'}`)
      this.done['switch-dns'] = true
      this.dlg.setText(r.ip
        ? `换了个 DNS，名字翻出来了：${r.ip}。网页开了——从头到尾，网都没断过。`
        : '换了还是不行，问题不在 DNS 服务器。')
    }
    this.refreshFix()
    this.expose()
  }

  private refreshFix() {
    const ok = canOpenSite(this.net, SITE)
    this.fixBtn.setFillStyle(ok ? 0xc0603a : 0x3a4038)
    this.fixT.setColor(ok ? '#141210' : '#6f6759')
  }

  private expose() {
    ;(window as unknown as { __netState: object }).__netState = {
      scene: 'NetCase', guess: this.guess, done: { ...this.done },
      dns: this.net.dnsServer, siteOpen: canOpenSite(this.net, SITE),
      pingOk: pingIp(this.net, GAME_IP).ok,
    }
  }
}
