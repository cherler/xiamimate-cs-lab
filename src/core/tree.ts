/**
 * 树的共享表示 —— AVL / 哈夫曼 / 后续的 B+ 树都用它。
 *
 * 用**扁平数组 + 下标**，不用对象引用：
 * 状态必须能 JSON 往返（验收标准 2），带循环引用的指针结构过不去。
 * 这也是 DSL 那条"不能递归"的限制在内核状态里的回响。
 */
export type TreeNode = {
  /** 显示用的键；哈夫曼树内部结点用权值 */
  key: number
  /** 附加标签（哈夫曼的字符、AVL 的平衡因子文本） */
  label?: string
  left: number
  right: number
  /** 子树高度（AVL 用） */
  h?: number
  /** 权值（哈夫曼用） */
  w?: number
}

export const NIL = -1

/** 按层序算出每个结点的坐标，供视图直接用 —— 各实验不必各排一遍 */
export function layout(nodes: TreeNode[], root: number): Record<number, { x: number; y: number; depth: number }> {
  const pos: Record<number, { x: number; y: number; depth: number }> = {}
  if (root === NIL) return pos
  //  中序遍历定 x（每个结点占一列），深度定 y —— 二叉树最常用的排法
  let col = 0
  const walk = (n: number, depth: number) => {
    if (n === NIL) return
    walk(nodes[n].left, depth + 1)
    pos[n] = { x: col++, y: depth, depth }
    walk(nodes[n].right, depth + 1)
  }
  walk(root, 0)
  return pos
}

export const heightOf = (nodes: TreeNode[], n: number): number =>
  n === NIL ? 0 : (nodes[n].h ?? 0)

/** 深拷贝结点表 —— step() 里每一步都要，免得改到上一帧 */
export const cloneNodes = (nodes: TreeNode[]): TreeNode[] => nodes.map(x => ({ ...x }))

/** 中序遍历序列，用来验"BST 性质" */
export function inorder(nodes: TreeNode[], root: number): number[] {
  const out: number[] = []
  const walk = (n: number) => {
    if (n === NIL) return
    walk(nodes[n].left); out.push(nodes[n].key); walk(nodes[n].right)
  }
  walk(root)
  return out
}

/** 真实高度（重新算，不信 h 字段）—— 验证 h 维护得对不对 */
export function trueHeight(nodes: TreeNode[], n: number): number {
  if (n === NIL) return 0
  return 1 + Math.max(trueHeight(nodes, nodes[n].left), trueHeight(nodes, nodes[n].right))
}
