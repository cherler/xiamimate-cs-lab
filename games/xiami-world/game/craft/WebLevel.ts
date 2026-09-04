import * as Phaser from 'phaser'
import { LEVEL_WEBSITE, indexLevel, type Level, type LNode } from './levels.ts'
import { createDialogue, type Dialogue } from '../ui/dialogue.ts'

/**
 * 关卡:打开网页 —— 无限画布 · 拖拽建树 · 点亮。
 *
 * 开局画布上只有一个根节点(目标)。左侧素材库里是全套可拖的块(组件/素材/结构/字段),
 * 但只显"当前可放的"(父节点已在画布上的)。把块拖到它正确的父节点上 → 接成树枝(拖错弹回+咕噜说为啥)。
 * 叶子拖上去即点亮;一条树枝的孩子全点亮 → 冒泡点亮它自己;组件整枝亮 → 目标亮 = 通关。
 * 画布可平移,节点可点开/收拢。爽点=从一个根,亲手把整棵倒长的知识树拖出来、点亮连片。
 */
const NW = 152, NH = 46, HGAP = 26, VGAP = 92
const DARK = 0x1a2230, DARK_STROKE = 0x33405a
const LIT = 0x24406a, LIT_STROKE = 0xffcb7a
const LIB_W = 210
const LAYER_TINT: Record<string, number> = { 目标: 0x9be29b, 组件: 0xffcb7a, 素材: 0x6b8cff, 结构: 0x4fb6a3, 字段: 0xa879d6 }

export class WebLevel extends Phaser.Scene {
  private level: Level = LEVEL_WEBSITE
  private idx = indexLevel(LEVEL_WEBSITE)
  private placed = new Set<string>()
  private lit = new Set<string>()
  private collapsed = new Set<string>()
  private world!: Phaser.GameObjects.Container
  private links!: Phaser.GameObjects.Graphics
  private views = new Map<string, Phaser.GameObjects.Container>()
  private lib!: Phaser.GameObjects.Container
  private libScroll = 0; private libH = 0
  private dlg!: Dialogue
  private progT!: Phaser.GameObjects.Text
  private drag: { id: string; ghost: Phaser.GameObjects.Container } | null = null
  private pan: { sx: number; sy: number; wx: number; wy: number } | null = null
  private userView = false  // 用户手动缩放/平移后置真,暂停自动适配(缩放机制未完成,先留自动适配)

  constructor() { super('WebLevel') }

  create() {
    this.placed = new Set(['goal']); this.lit = new Set(); this.collapsed = new Set()
    this.views.clear(); this.drag = null; this.pan = null; this.libScroll = 0

    // 画布背景(平移热区)
    this.add.rectangle(640, 360, 1280, 720, 0x0e1524).setDepth(-10)
    const bg = this.add.rectangle(640 + LIB_W / 2, 360, 1280 - LIB_W, 720, 0x0e1524, 0.01)
      .setInteractive().setDepth(-5)
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => { this.pan = { sx: p.x, sy: p.y, wx: this.world.x, wy: this.world.y } })

    this.world = this.add.container(0, 0).setDepth(0)
    this.links = this.add.graphics(); this.world.add(this.links)

    // 顶栏
    this.add.text(LIB_W + 20, 14, '目标 · 打开网页', { fontFamily: 'sans-serif', fontSize: '20px', color: '#f0e9dc', fontStyle: 'bold' }).setDepth(20)
    this.progT = this.add.text(1264, 18, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffcb7a' }).setOrigin(1, 0).setDepth(20)

    // 素材库(左,常驻)
    this.add.rectangle(LIB_W / 2, 360, LIB_W, 720, 0x141c2b, 1).setStrokeStyle(1, 0x2a3446).setInteractive().setDepth(9)
    this.add.text(16, 16, '素材库', { fontFamily: 'sans-serif', fontSize: '16px', color: '#e8e2d6', fontStyle: 'bold' }).setDepth(11)
    this.add.text(16, 40, '拖到画布上正确的节点', { fontFamily: 'sans-serif', fontSize: '11px', color: '#7f8ba0' }).setDepth(11)
    this.lib = this.add.container(0, 0).setDepth(11)
    const maskR = this.add.rectangle(LIB_W / 2, 400, LIB_W - 8, 620, 0xffffff).setVisible(false)
    this.lib.setMask(maskR.createGeometryMask())

    this.dlg = createDialogue(this, LIB_W + 40, 600, 640)
    this.dlg.setText('画布上只有一个"打开网页"。从左边把「组件」拖到它上面,先把五大步搭起来,再往里填。')

    // 全局拖拽/平移
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag) this.drag.ghost.setPosition(p.x, p.y)
      else if (this.pan) { this.world.x = this.pan.wx + (p.x - this.pan.sx); this.world.y = this.pan.wy + (p.y - this.pan.sy) }
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.drag) { this.resolveDrop(p); }
      this.pan = null
    })
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const min = Math.min(0, 700 - this.libH)
      this.libScroll = Phaser.Math.Clamp(this.libScroll - dy * 0.5, min, 0)
      this.lib.y = this.libScroll
    })

    this.ensureView(this.level.root)
    this.layout(false)
    this.rebuildLib()
    this.refresh()
  }

  // —— 建树核心 ——
  private isLeaf(n: LNode) { return !n.children || n.children.length === 0 }

  /** 把块 childId 放到 targetId 上。返回结果码,供拖拽与冒烟共用。 */
  dropNode(childId: string, targetId: string | null): 'ok' | 'dup' | 'wrong' | 'noparent' {
    if (this.placed.has(childId)) return 'dup'
    const parent = this.idx.parentOf.get(childId)
    if (!parent || targetId !== parent) return 'wrong'
    if (!this.placed.has(parent)) return 'noparent'
    this.placed.add(childId)
    const n = this.idx.byId.get(childId)!
    this.ensureView(n)
    if (this.isLeaf(n)) this.lit.add(childId)
    this.bubble()
    this.layout()
    this.rebuildLib()
    this.dlg.setText(`咕噜:${n.note}`)
    if (this.lit.has('goal')) this.win()
    this.refresh()
    return 'ok'
  }

  private bubble() {
    let changed = true
    while (changed) {
      changed = false
      const walk = (n: LNode) => {
        (n.children ?? []).forEach(walk)
        if (n.children?.length && this.placed.has(n.id) && !this.lit.has(n.id)
          && n.children.every(c => this.lit.has(c.id))) { this.lit.add(n.id); changed = true }
      }
      walk(this.level.root)
    }
  }

  private win() {
    this.dlg.setText(`咕噜:${this.level.goalWhen}`)
    const f = this.add.rectangle(640, 360, 1280, 720, 0x9be29b, 0).setDepth(60)
    this.tweens.add({ targets: f, fillAlpha: 0.2, duration: 240, yoyo: true, onComplete: () => f.destroy() })
  }

  // —— 布局(倒长树,根居中固定) ——
  private visKids(n: LNode): LNode[] {
    return this.collapsed.has(n.id) ? [] : (n.children ?? []).filter(c => this.placed.has(c.id))
  }
  private layout(animate = true) {
    const pos = new Map<string, { x: number; y: number }>()
    let leafX = 0
    const rec = (n: LNode, depth: number): number => {
      const kids = this.visKids(n)
      if (!kids.length) { const x = leafX; leafX += NW + HGAP; pos.set(n.id, { x, y: depth * VGAP }); return x }
      const xs = kids.map(k => rec(k, depth + 1))
      const x = (xs[0]! + xs[xs.length - 1]!) / 2
      pos.set(n.id, { x, y: depth * VGAP }); return x
    }
    rec(this.level.root, 0)
    const rx = pos.get('goal')!.x
    for (const [id, v] of this.views) {
      const p = pos.get(id)
      v.setVisible(!!p)          // 收拢/未展开的子节点真正隐藏,不再遮挡
      if (!p) continue
      const tx = p.x - rx, ty = p.y
      if (animate) this.tweens.add({ targets: v, x: tx, y: ty, duration: 300, ease: 'Cubic.easeOut' })
      else v.setPosition(tx, ty)
    }
    if (!this.userView) this.fitView(pos, rx)   // 用户没手动缩放/平移时,自动把整树缩放居中
    this.redrawLinks(pos, rx)
    if (animate) this.time.delayedCall(300, () => this.redrawLinks(pos, rx))
  }

  /** 把整棵已放的树缩放居中到画布区域(自动适配)。 */
  private fitView(pos: Map<string, { x: number; y: number }>, rx: number) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const id of this.views.keys()) {
      const p = pos.get(id); if (!p) continue
      const x = p.x - rx
      minX = Math.min(minX, x - NW / 2); maxX = Math.max(maxX, x + NW / 2)
      minY = Math.min(minY, p.y - NH / 2); maxY = Math.max(maxY, p.y + NH / 2)
    }
    if (!isFinite(minX)) return
    const treeW = Math.max(1, maxX - minX), treeH = Math.max(1, maxY - minY)
    const availW = 1280 - LIB_W - 60, availH = 470
    const s = Math.min(1.2, availW / treeW, availH / treeH)
    this.world.setScale(s)
    this.world.x = LIB_W + (1280 - LIB_W) / 2 - ((minX + maxX) / 2) * s
    this.world.y = 150 + availH / 2 - ((minY + maxY) / 2) * s
  }
  private redrawLinks(pos: Map<string, { x: number; y: number }>, rx: number) {
    this.links.clear()
    const draw = (n: LNode) => {
      const pp = pos.get(n.id); if (!pp) return
      for (const k of this.visKids(n)) {
        const kp = pos.get(k.id)!
        const on = this.lit.has(k.id)
        this.links.lineStyle(on ? 3 : 1.5, on ? 0xffcb7a : 0x2a3446, on ? 0.9 : 0.6)
        this.links.beginPath()
        this.links.moveTo(pp.x - rx, pp.y + NH / 2); this.links.lineTo(kp.x - rx, kp.y - NH / 2)
        this.links.strokePath()
        draw(k)
      }
    }
    draw(this.level.root)
  }

  // —— 节点视图 ——
  private ensureView(n: LNode) {
    if (this.views.has(n.id)) return
    const con = this.add.container(0, 0)
    const box = this.add.rectangle(0, 0, NW, NH, DARK, 1).setStrokeStyle(2, DARK_STROKE).setName('box')
      .setInteractive({ useHandCursor: true })
    const nm = this.add.text(0, -3, n.name, { fontFamily: 'sans-serif', fontSize: '15px', color: '#dfe6f0', fontStyle: 'bold' }).setOrigin(0.5).setName('nm')
    con.add([box, nm, this.chip(-NW / 2 + 26, NH / 2 - 9, n.layer)])
    box.on('pointerdown', () => { if (n.children?.length && this.placed.has(n.id)) this.toggleCollapse(n) })
    this.views.set(n.id, con); this.world.add(con)
    this.paintView(n)
  }
  private paintView(n: LNode) {
    const con = this.views.get(n.id); if (!con) return
    const on = this.lit.has(n.id)
    const box = con.getByName('box') as Phaser.GameObjects.Rectangle
    box.setFillStyle(on ? LIT : DARK, 1).setStrokeStyle(on ? 3 : 2, on ? LIT_STROKE : DARK_STROKE)
    const nm = con.getByName('nm') as Phaser.GameObjects.Text
    nm.setColor(on ? '#f0e9dc' : '#dfe6f0').setText((on ? '✦ ' : '') + n.name + (this.collapsed.has(n.id) ? ' ⊕' : ''))
  }
  private toggleCollapse(n: LNode) {
    if (this.collapsed.has(n.id)) this.collapsed.delete(n.id); else this.collapsed.add(n.id)
    this.paintView(n); this.layout()
  }

  // —— 素材库(只显当前可放:父已在画布、自己没放) ——
  private rebuildLib() {
    this.lib.removeAll(true)
    const placeable = this.idx.all.filter(n => n.id !== 'goal' && this.placed.has(this.idx.parentOf.get(n.id)!) && !this.placed.has(n.id))
    const byLayer = new Map<string, LNode[]>()
    for (const n of placeable) { const a = byLayer.get(n.layer) ?? []; a.push(n); byLayer.set(n.layer, a) }
    let y = 64
    for (const layer of ['组件', '素材', '结构', '字段']) {
      const arr = byLayer.get(layer); if (!arr?.length) continue
      this.lib.add(this.add.text(16, y, layer, { fontFamily: 'sans-serif', fontSize: '12px', color: '#7f8ba0', fontStyle: 'bold' }))
      y += 22
      for (const n of arr) { this.lib.add(this.mkPill(n, 16, y)); y += 38 }
      y += 8
    }
    this.libH = y
    if (!placeable.length) this.lib.add(this.add.text(16, 64, '(把已放的节点填满,或已全部放上)', { fontFamily: 'sans-serif', fontSize: '12px', color: '#5f6b80', wordWrap: { width: LIB_W - 32 } }))
  }
  private mkPill(n: LNode, x: number, y: number): Phaser.GameObjects.Container {
    const w = LIB_W - 32
    const con = this.add.container(x + w / 2, y + 14)
    const tint = LAYER_TINT[n.layer] ?? 0x6b8cff
    const box = this.add.rectangle(0, 0, w, 30, 0x1b2740, 0.98).setStrokeStyle(2, tint, 0.7).setInteractive({ useHandCursor: true })
    con.add([box, this.add.text(-w / 2 + 10, 0, n.name, { fontFamily: 'sans-serif', fontSize: '13px', color: '#dfe6f0' }).setOrigin(0, 0.5)])
    box.on('pointerdown', (p: Phaser.Input.Pointer) => this.startDrag(n.id, p))
    return con
  }

  // —— 拖拽 ——
  private startDrag(id: string, p: Phaser.Input.Pointer) {
    if (this.drag) return
    const n = this.idx.byId.get(id)!
    const ghost = this.add.container(p.x, p.y).setDepth(50)
    const tint = LAYER_TINT[n.layer] ?? 0x6b8cff
    ghost.add([
      this.add.rectangle(0, 0, NW, NH, 0x24406a, 0.95).setStrokeStyle(2, tint),
      this.add.text(0, 0, n.name, { fontFamily: 'sans-serif', fontSize: '15px', color: '#f0e9dc', fontStyle: 'bold' }).setOrigin(0.5),
    ])
    this.drag = { id, ghost }
  }
  private resolveDrop(p: Phaser.Input.Pointer) {
    const drag = this.drag!; this.drag = null
    drag.ghost.destroy()
    // 命中哪个已放节点?(世界坐标)
    const wx = p.x - this.world.x, wy = p.y - this.world.y
    let hit: string | null = null
    for (const [id, v] of this.views) {
      if (Math.abs(wx - v.x) <= NW / 2 && Math.abs(wy - v.y) <= NH / 2) { hit = id; break }
    }
    const r = this.dropNode(drag.id, hit)
    if (r === 'wrong') {
      const n = this.idx.byId.get(drag.id)!
      const want = this.idx.byId.get(this.idx.parentOf.get(drag.id)!)!
      this.dlg.setText(`咕噜:${n.name} 不该放这儿——它是「${want.name}」的一部分,拖到那上面去。`)
    }
  }

  private chip(x: number, y: number, layer: string): Phaser.GameObjects.Container {
    const c = this.add.container(x, y)
    const t = this.add.text(0, 0, layer, { fontFamily: 'sans-serif', fontSize: '10px', color: '#0e1524' }).setOrigin(0.5)
    c.add([this.add.rectangle(0, 0, t.width + 10, 15, LAYER_TINT[layer] ?? 0x6b8cff, 0.85), t.setDepth(1)])
    return c
  }

  private refresh() {
    for (const id of this.placed) { const n = this.idx.byId.get(id); if (n) this.paintView(n) }
    const leaves = this.idx.all.filter(n => this.isLeaf(n))
    const litLeaves = leaves.filter(n => this.lit.has(n.id)).length
    const comps = this.level.root.children!
    this.progT.setText(`已点亮 ${litLeaves}/${leaves.length} · 组件 ${comps.filter(c => this.lit.has(c.id)).length}/${comps.length}`)
    ;(window as unknown as { __levelState: object }).__levelState = {
      scene: 'WebLevel', placed: [...this.placed], lit: [...this.lit],
      litLeaves, totalLeaves: leaves.length, goalDone: this.lit.has('goal'),
    }
  }

  // 冒烟用:直接把某块放到它正确的父上(等价拖对)
  placeCorrect(id: string): string { return this.dropNode(id, this.idx.parentOf.get(id) ?? null) }
  allIds(): string[] { return this.idx.all.map(n => n.id).filter(id => id !== 'goal') }
  parentOf(id: string): string | undefined { return this.idx.parentOf.get(id) }
}
