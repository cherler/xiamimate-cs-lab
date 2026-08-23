import * as Phaser from 'phaser'
import { DnsSim } from '../../solvers/dns/sim.ts'
import type { QueryResult, TimelineStep } from '../../solvers/dns/types.ts'
import { STATIONS, HOME, stationOf } from './layout.ts'

/**
 * DNS 活场景（V1 第一块：信使沿链逐跳跑）
 *
 * 核心：一次 sim.query() 产出的时间线，被**逐帧演出来**——
 * 信使精灵从电脑出发，沿链一站一站移动，到站停顿，命中/miss/卡住有反馈。
 * 这不是静态图：信使真的在动，走到哪一步由求解器的时间线决定。
 *
 * V1 后续再加：缓存记事本+TTL倒数、旋钮联动、CNAME 折返演出。
 */
const COL = { path: 0x3f5a72, pathLit: 0xffcb7a, node: 0x243447, nodeLine: 0x5a7d9c, ink: '#e8e2d6', dim: '#9fb0c2' }

export class DnsScene extends Phaser.Scene {
  private sim!: DnsSim
  private messenger!: Phaser.GameObjects.Container
  private pathG!: Phaser.GameObjects.Graphics
  private nodeDots = new Map<string, Phaser.GameObjects.Arc>()
  private playing = false
  private statusText!: Phaser.GameObjects.Text
  private site = 'example.com'
  /** 冒烟/调试读的当前演出进度 */
  private lastResult: QueryResult | null = null
  private curHop = ''
  private notes = new Map<string, Phaser.GameObjects.Text>()
  private clockText!: Phaser.GameObjects.Text

  constructor() { super('DnsScene') }

  create() {
    const W = this.scale.width, H = this.scale.height
    this.sim = new DnsSim()
    this.add.rectangle(W / 2, H / 2, W, H, 0x0e1622)
    this.drawGrid(W, H)

    this.add.text(40, 26, 'DNS · 送信之路', {
      fontFamily: 'sans-serif', fontSize: '22px', color: COL.ink,
    })
    this.statusText = this.add.text(40, 60, '点「发起查询」，看信使走这一趟。', {
      fontFamily: 'sans-serif', fontSize: '14px', color: COL.dim,
    })

    this.drawPath()
    this.drawNodes()
    this.buildMessenger()
    this.buildNotes()
    this.buildControls(W, H)
    this.clockText = this.add.text(W - 40, 30, '', { fontFamily: 'monospace', fontSize: '13px', color: COL.dim }).setOrigin(1, 0)
    this.refreshCaches()

    this.expose()
  }

  private drawGrid(W: number, H: number) {
    const g = this.add.graphics()
    g.lineStyle(1, 0x16202e, 1)
    for (let x = 0; x <= W; x += 44) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.strokePath() }
    for (let y = 0; y <= H; y += 44) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath() }
  }

  /** 画从电脑串起所有站点的路 */
  private drawPath() {
    this.pathG = this.add.graphics()
    const pts = [HOME, ...STATIONS]
    this.pathG.lineStyle(6, COL.path, 1)
    this.pathG.beginPath()
    this.pathG.moveTo(pts[0]!.x, pts[0]!.y)
    for (const p of pts.slice(1)) this.pathG.lineTo(p.x, p.y)
    this.pathG.strokePath()
  }

  private drawNodes() {
    // 电脑（家）
    this.add.rectangle(HOME.x, HOME.y, 60, 48, 0x2a3a4e).setStrokeStyle(2, COL.nodeLine)
    this.add.text(HOME.x, HOME.y + 40, '你的电脑', { fontFamily: 'sans-serif', fontSize: '12px', color: COL.dim }).setOrigin(0.5)
    for (const s of STATIONS) {
      const dot = this.add.circle(s.x, s.y, 22, COL.node).setStrokeStyle(2, COL.nodeLine)
      this.add.text(s.x, s.y + 34, s.name, { fontFamily: 'sans-serif', fontSize: '12px', color: COL.dim }).setOrigin(0.5)
      this.nodeDots.set(s.hop, dot)
    }
  }

  /** 信使：一个小圆身 + 一封信 */
  private buildMessenger() {
    const body = this.add.circle(0, 0, 13, 0xffb057).setStrokeStyle(2, 0x8a5a1e)
    const env = this.add.rectangle(9, -2, 12, 9, 0xfff4e0).setStrokeStyle(1, 0x8a5a1e)
    this.messenger = this.add.container(HOME.x, HOME.y, [body, env]).setDepth(20)
  }

  private buildControls(_W: number, H: number) {
    const mk = (x: number, label: string, cb: () => void) => {
      const r = this.add.rectangle(x, H - 40, 150, 44, 0x1b2838, 0.95).setStrokeStyle(2, COL.nodeLine).setInteractive({ useHandCursor: true })
      this.add.text(x, H - 40, label, { fontFamily: 'sans-serif', fontSize: '14px', color: COL.ink }).setOrigin(0.5)
      r.on('pointerover', () => r.setFillStyle(0x2f4668))
      r.on('pointerout', () => r.setFillStyle(0x1b2838, 0.95))
      r.on('pointerdown', cb)
      return r
    }
    // 上排：发起 + 演示故障 + 重置
    mk(100, '发起查询', () => this.runQuery())
    mk(262, '（演示）弄坏', () => { this.rebuild(); this.sim.setFault('server-down', this.site); this.status('递归服务器被弄挂了，发起查询看信使卡哪。') })
    mk(424, '重置', () => { this.rebuild(); this.status('已重置。') })
    // 下排：玩家旋钮（都走 DnsSim 门面，改完刷新图）
    const my = H - 92
    const mk2 = (x: number, label: string, cb: () => void) => {
      const r = this.add.rectangle(x, my, 132, 38, 0x141c26, 0.95).setStrokeStyle(1, 0x3f5a72).setInteractive({ useHandCursor: true })
      this.add.text(x, my, label, { fontFamily: 'sans-serif', fontSize: '12px', color: COL.dim }).setOrigin(0.5)
      r.on('pointerover', () => r.setFillStyle(0x22303e))
      r.on('pointerout', () => r.setFillStyle(0x141c26, 0.95))
      r.on('pointerdown', () => { cb(); this.refreshCaches() })
      return r
    }
    mk2(90, '换公共DNS', () => { this.sim.setDns('public'); this.status('换了公共 DNS。') })
    mk2(232, '清全部缓存', () => { this.sim.clear('all'); this.status('清了三级缓存——下次又得走全程。') })
    mk2(374, '调大超时', () => { this.sim.setTimeout(8000); this.status('超时放宽到 8s。') })
    mk2(516, '快进1小时', () => { this.sim.advance(3600); this.status('时钟快进 1 小时——缓存可能过期了。') })
  }

  /** 三个缓存站各挂一块"记事本"，显示缓存条目 + 剩余 TTL */
  private buildNotes() {
    for (const hop of ['hosts', 'browser-cache', 'os-cache', 'recursive'] as const) {
      const st = stationOf(hop); if (!st) continue
      const y = st.hop === 'recursive' ? st.y - 84 : st.y + 56
      const t = this.add.text(st.x, y, '', {
        fontFamily: 'monospace', fontSize: '10px', color: '#8fb3d0', align: 'center',
        backgroundColor: 'rgba(10,16,24,0.7)', padding: { x: 4, y: 3 },
      }).setOrigin(0.5, 0)
      this.notes.set(hop, t)
    }
  }

  /** 用 sim.caches() 刷新记事本 + 时钟——图跟着仿真状态走 */
  private refreshCaches() {
    const byLevel = Object.fromEntries(this.sim.caches().map(c => [c.level, c.entries]))
    const put = (hop: string, level: 'browser' | 'os' | 'recursive') => {
      const t = this.notes.get(hop); if (!t) return
      const es = byLevel[level] ?? []
      t.setText(es.length ? es.map(e => `${e.record.name}\n→${e.record.value} ${e.ttlLeft}s`).join('\n') : '（空）')
      t.setColor(es.length ? '#8fb3d0' : '#4a5a6a')
    }
    put('browser-cache', 'browser')
    put('os-cache', 'os')
    put('recursive', 'recursive')
    // hosts 显示写死映射
    const hostsNote = this.notes.get('hosts')
    if (hostsNote) hostsNote.setText('（无劫持）').setColor('#4a5a6a')
    this.clockText.setText(`逻辑时钟 ${this.sim.clock().toFixed(0)}s`)
  }

  private rebuild() {
    this.sim = new DnsSim()
    this.nodeDots.forEach(d => d.setFillStyle(COL.node))
    this.refreshCaches()
  }
  private status(s: string) { this.statusText.setText(s); }

  /** 发起查询：拿时间线，逐跳演出信使移动 */
  private runQuery() {
    if (this.playing) return
    this.playing = true
    this.nodeDots.forEach(d => d.setFillStyle(COL.node)) // 复位站点颜色
    const result = this.sim.query(this.site)
    this.lastResult = result
    this.playStep(result, 0)
  }

  /** 递归地一站一站演。station 找不到坐标的 hop（都在 STATIONS 里）跳过。 */
  private playStep(result: QueryResult, i: number) {
    if (i >= result.timeline.length) {
      this.finishPlay(result)
      return
    }
    const stepData = result.timeline[i]!
    const st = stationOf(stepData.hop)
    if (!st) { this.playStep(result, i + 1); return }
    this.curHop = stepData.hop
    this.expose()

    // 信使移到这一站
    this.tweens.add({
      targets: this.messenger,
      x: st.x, y: st.y - 26,
      duration: 260,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.reactAtStation(stepData)
        // 到站停顿一下，再走下一站
        this.time.delayedCall(240, () => this.playStep(result, i + 1))
      },
    })
  }

  /** 到站的反馈：命中变绿、miss 灰、卡住闪红 */
  private reactAtStation(step: TimelineStep) {
    const dot = this.nodeDots.get(step.hop)
    if (!dot) return
    if (step.outcome === 'hit' || step.outcome === 'answer') {
      dot.setFillStyle(0x2f8f4e) // 命中/答案：绿
      this.status(step.note)
    } else if (step.outcome === 'unreachable' || step.outcome === 'timeout') {
      dot.setFillStyle(0xc0402e) // 卡住：红
      this.tweens.add({ targets: dot, scale: { from: 1, to: 1.5 }, yoyo: true, repeat: 2, duration: 180 })
      this.status('⚠ ' + step.note)
    } else if (step.outcome === 'referral' || step.outcome === 'cname') {
      dot.setFillStyle(0x3f6fa0) // 转介：蓝
      this.status(step.note)
    } else {
      dot.setFillStyle(0x33404e) // miss：暗
    }
  }

  private finishPlay(result: QueryResult) {
    if (result.ip && result.correct) {
      // 信使拿着答案跑回家
      this.tweens.add({
        targets: this.messenger, x: HOME.x, y: HOME.y, duration: 420, ease: 'Sine.easeInOut',
        onComplete: () => { this.status(`✓ 网页打开了：${result.ip}（走了 ${result.timeline.length} 跳，${result.totalMs}ms）`); this.playing = false; this.refreshCaches(); this.expose() },
      })
    } else {
      this.status(`✗ 没成：${result.failure}。信使卡住了，网页转圈。`)
      this.playing = false
      this.expose()
    }
  }

  private expose() {
    ;(window as unknown as { __dnsScene: object }).__dnsScene = {
      scene: 'DnsScene', playing: this.playing, curHop: this.curHop,
      lastIp: this.lastResult?.ip ?? null, lastCorrect: this.lastResult?.correct ?? null,
      timelineLen: this.lastResult?.timeline.length ?? 0,
    }
  }
}
