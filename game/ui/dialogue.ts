import * as Phaser from 'phaser'

/**
 * 对话框：AI 助手（小机器人）头像 + 一句话。
 * 照 UI 概念图那套——羊皮纸/木框底 + 圆形头像。全场景复用，speak() 把话喂给它。
 */
export type Dialogue = { setText: (t: string) => void; container: Phaser.GameObjects.Container }

export function createDialogue(scene: Phaser.Scene, x: number, y: number, w: number): Dialogue {
  const h = 96, r = 40
  const c = scene.add.container(0, 0).setDepth(50)

  const panel = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x201811, 0.92).setStrokeStyle(2, 0x7a5f37)
  // 头像：圆形裁切
  const cx = x + 20 + r, cy = y + h / 2
  const av = scene.add.image(cx, cy, 'assistant').setDisplaySize(2 * r + 6, 2 * r + 6)
  const m = scene.add.circle(cx, cy, r, 0xffffff).setVisible(false)
  av.setMask(m.createGeometryMask())
  const ring = scene.add.circle(cx, cy, r + 2).setStrokeStyle(3, 0xffcb7a)
  const name = scene.add.text(x + 20 + 2 * r + 16, y + 14, '助手', {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#ffcb7a',
  })
  const txt = scene.add.text(x + 20 + 2 * r + 16, y + 34, '', {
    fontFamily: 'sans-serif', fontSize: '15px', color: '#f0e9dc',
    wordWrap: { width: w - (2 * r + 56) }, lineSpacing: 4,
  })
  c.add([panel, av, ring, name, txt])
  return { setText: (t: string) => txt.setText(t), container: c }
}
