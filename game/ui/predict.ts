import * as Phaser from 'phaser'

/**
 * 押注：动手之前先押"会往哪走"。
 *
 * 这是本作的招牌机制。设计要点（见 docs/design.md）：
 * - **主力押方向/趋势**，不押具体数值（"多还是少"人人答得上，门槛低）
 * - **可跳过，但跳过不计榜**
 * - **押完不立刻评判**——先让玩家动手、让结果打脸，咕噜再进来解释
 * - 必须**先给锚点**（当前状态），没锚点的押注是抽奖不是理解
 */
export type PredictOption = { id: string; label: string }
export type PredictResult = { picked: string | null; skipped: boolean }

export type Predict = {
  container: Phaser.GameObjects.Container
  destroy: () => void
}

export function createPredict(
  scene: Phaser.Scene,
  opts: {
    question: string
    /** 锚点：押注前必须知道的现状 */
    anchor: string
    options: PredictOption[]
    onDone: (r: PredictResult) => void
  },
): Predict {
  const W = scene.scale.width, H = scene.scale.height
  const c = scene.add.container(0, 0).setDepth(200)

  c.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x070b12, 0.82).setInteractive())

  const panelW = 720, panelH = 300
  const px = W / 2, py = H / 2
  c.add(scene.add.rectangle(px, py, panelW, panelH, 0x141c26, 0.98).setStrokeStyle(2, 0x3f5a72))

  c.add(scene.add.text(px, py - panelH / 2 + 26, '先押一个', {
    fontFamily: 'sans-serif', fontSize: '13px', color: '#ffb057',
  }).setOrigin(0.5))

  c.add(scene.add.text(px, py - 76, opts.question, {
    fontFamily: 'sans-serif', fontSize: '19px', color: '#f0e9dc',
    wordWrap: { width: panelW - 80, useAdvancedWrap: true }, align: 'center',
  }).setOrigin(0.5))

  // 锚点：没有它，押注就是抽奖
  c.add(scene.add.text(px, py - 26, opts.anchor, {
    fontFamily: 'monospace', fontSize: '13px', color: '#8fa3ba',
    wordWrap: { width: panelW - 80, useAdvancedWrap: true }, align: 'center',
  }).setOrigin(0.5))

  const n = opts.options.length
  const bw = 190, gap = 16
  const totalW = n * bw + (n - 1) * gap
  opts.options.forEach((o, i) => {
    const bx = px - totalW / 2 + bw / 2 + i * (bw + gap)
    const r = scene.add.rectangle(bx, py + 44, bw, 52, 0x243447).setStrokeStyle(2, 0x5a7d9c).setInteractive({ useHandCursor: true })
    const t = scene.add.text(bx, py + 44, o.label, {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#e8e2d6',
      wordWrap: { width: bw - 18, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5)
    r.on('pointerover', () => r.setFillStyle(0x2f4668))
    r.on('pointerout', () => r.setFillStyle(0x243447))
    r.on('pointerdown', () => { close(); opts.onDone({ picked: o.id, skipped: false }) })
    c.add([r, t])
  })

  // 跳过：不拦人，但不计榜
  const skip = scene.add.text(px, py + panelH / 2 - 24, '先试试再押（不计榜）', {
    fontFamily: 'sans-serif', fontSize: '13px', color: '#6f8298',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true })
  skip.on('pointerdown', () => { close(); opts.onDone({ picked: null, skipped: true }) })
  c.add(skip)

  function close() { c.destroy(true) }
  return { container: c, destroy: close }
}
