/**
 * 二叉树视图 —— 共享视觉原语（AVL / 哈夫曼 / 后续的 B+ 树）。
 *
 * 坐标由引擎侧的 layout() 算（中序定列、深度定行），
 * 这里只负责画 —— 换个前端也能画成同样的形状。
 */
import { NIL, layout, type TreeNode } from '@engine/core/tree.ts'

export type NodeTone = 'plain' | 'focus' | 'pivot' | 'picked' | 'merged' | 'dim'

export function TreeView({
  nodes, roots, toneOf, labelOf, subOf, caption,
}: {
  nodes: TreeNode[]
  /** 可以是一棵（AVL）也可以是一片森林（哈夫曼） */
  roots: number[]
  toneOf?: (n: number) => NodeTone
  /** 结点里显示什么，默认显示 key */
  labelOf?: (n: number) => string
  /** 结点下方的小字（AVL 显示平衡因子，哈夫曼显示字符） */
  subOf?: (n: number) => string
  caption?: string
}) {
  //  多棵树横向排开：每棵各自布局，再按累计列数平移
  let offset = 0
  const placed: { n: number; x: number; y: number }[] = []
  let maxDepth = 0
  for (const root of roots) {
    if (root === NIL) continue
    const pos = layout(nodes, root)
    const cols = Object.keys(pos).length
    for (const [k, p] of Object.entries(pos)) {
      placed.push({ n: Number(k), x: p.x + offset, y: p.y })
      if (p.y > maxDepth) maxDepth = p.y
    }
    offset += cols + 1                      // 树与树之间留一列空隙
  }
  const totalCols = Math.max(1, offset)
  const at = (n: number) => placed.find(p => p.n === n)

  const CW = 46, RH = 62
  const W = totalCols * CW
  const H = (maxDepth + 1) * RH

  return (
    <div className="tv">
      <div className="tvscroll">
        <div className="tvbox" style={{ width: W, height: H }}>
          <svg width={W} height={H} aria-hidden="true">
            {placed.map(p => {
              const node = nodes[p.n]
              return ([node.left, node.right] as const).map((c, side) => {
                if (c === NIL) return null
                const q = at(c)
                if (!q) return null
                return (
                  <line key={`${p.n}-${side}`}
                    x1={p.x * CW + CW / 2} y1={p.y * RH + 17}
                    x2={q.x * CW + CW / 2} y2={q.y * RH + 17}
                    className="tvedge" />
                )
              })
            })}
          </svg>
          {placed.map(p => {
            const tone = toneOf?.(p.n) ?? 'plain'
            return (
              <div key={p.n} className={`tvnode ${tone}`}
                   style={{ left: p.x * CW + CW / 2, top: p.y * RH + 17 }}>
                <b>{labelOf?.(p.n) ?? nodes[p.n].key}</b>
                {subOf?.(p.n) ? <em>{subOf(p.n)}</em> : null}
              </div>
            )
          })}
          {placed.length === 0 && <div className="tvempty">空树</div>}
        </div>
      </div>
      {caption ? <p className="tvcap">{caption}</p> : null}
    </div>
  )
}
