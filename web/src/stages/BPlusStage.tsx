/** 舞台：B+ 树 —— 多叉树形 + 叶子链 */
import { useLayoutEffect, useReducer, useRef } from 'react'
import type { BPlusState, BNode } from '@engine/kernels/bplus.ts'
import { leafChain } from '@engine/kernels/bplus.ts'
import type { StageProps } from '../types.ts'

export function BPlusStage({ doc, trace, index, state, tab }: StageProps<BPlusState>) {
  if (tab === 'leaves') return <Leaves state={state} order={doc.params.order as number} />
  return <Tree state={state} order={doc.params.order as number} />
}

const GAPX = 18       // 同层相邻结点之间至少留这么宽
/*  上下两层之间留出的高度 —— 连线画在这段里。
    ⚠️ 树一深就得收紧：4 层的树（「递增插入」预置）本来就顶到 FitBox 0.58 的缩放下限，
    再宽松 6px，底下的图例和「本步」那行就被挤出屏幕。实测定的这两个数：
    4 层时整张图 190px，跟改造前那版三行 flex（186px）基本持平，没把地方吃掉。 */
const rowgap = (depth: number) => (depth >= 3 ? 20 : 26)
/*  顶上恒定留一条，给「中间键往上送」那枚标记站位。
    **恒定**是要紧的：只在分裂帧才留的话，盒子高度会一帧一帧变，
    FitBox 盯着内容尺寸重算缩放 —— 整个舞台会跟着一下一下地缩放。 */
const PADTOP = 26
const MAXDEPTH = 8

type Placed = { n: number; x: number; y: number; w: number }

/**
 * 按层排开：B+ 树是多叉的，不能用二叉的 TreeView。
 *
 * 2026-09-08 用户报了两处，都是真的（先量后改，见下）：
 *
 * ## 一、结点之间没有连线
 *
 * 原来是三行居中的 flex：方块摆在那儿，谁是谁的孩子全靠猜 —— 而 B+ 树这一课
 * 讲的恰恰是「键往上提、分支往下挂」，没有线就等于没画。
 * 现在照 TreeView 的路子：先算坐标，线画在 SVG 上，结点绝对定位盖在上面。
 *
 * 跟二叉树不同的是**结点宽度不一样**（1…m−1 个键，键还有几位数之分），
 * 所以坐标得先知道宽度。宽度不敢在 JS 里照 CSS 的 padding 硬算 —— 字号带着
 * `--xm-font-scale` 会变，算死了在别的字号下就错位。于是量真身：
 * 结点按内容签名缓存宽度，`useLayoutEffect` 在**上屏前**把估值改成实测值。
 * ⚠️ 量用 `offsetWidth` 不用 `getBoundingClientRect()`：舞台外面套着 FitBox，
 * 它拿 `transform:scale` 缩放，rect 量到的是缩放后的数，喂回布局会越缩越歪。
 *
 * ## 二、分裂那一步，右半边整棵不见了
 *
 * 原来只画「从根可达」的结点。可是分裂帧里新结点**还没挂到父结点上**
 * （内核是下一步才往父结点写指针），于是这一帧恰好把这一步的主角藏了：
 * 日志写着「左 [10] / 右 [20 30]」，屏幕上只有左边那半。
 * 实测默认序列 23 帧里 **7 个分裂帧全中**；其中内部结点分裂的两帧，
 * 连右结点带它的两个孩子**一次消失 3 个**，就是用户说的「右边树没了」。
 *
 * 现在把它摆在**它本该去的位置**（左半边的右手边），用虚线框标明还悬着，
 * 再画一条往上的虚线，把「中间键送上去」这个动作画出来 —— 这一步的全部内容。
 */
function Tree({ state, order }: { state: BPlusState; order: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  /*  宽度只由「这个结点印出来的那串字」决定，所以按内容签名缓存：
      同一串键在几十帧里反复出现，量一次管到底。 */
  const wcache = useRef(new Map<string, number>())
  const hcache = useRef(26)
  const [, remeasure] = useReducer((x: number) => x + 1, 0)

  const sigOf = (n: number) => {
    const nd = state.nodes[n]
    if (!nd) return '?'
    //  本步的键会加粗（.cur），加粗可能更宽，所以签名里得带上它，
    //  否则同一串键会拿到另一种状态下量出来的宽度。
    return `${nd.leaf ? 'L' : 'I'}:${nd.keys.map(k => (k === state.key ? `${k}*` : k)).join(',')}`
  }
  //  还没量到的先用估值占位；useLayoutEffect 会在这一帧上屏之前把它改对，看不到跳动
  const widthOf = (n: number) => {
    const hit = wcache.current.get(sigOf(n))
    if (hit !== undefined) return hit
    const nd = state.nodes[n]
    return nd?.keys.length
      ? nd.keys.reduce((a, k) => a + 20 + String(k).length * 8, 0) + 2
      : 42
  }

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    let changed = false
    box.querySelectorAll<HTMLElement>('[data-sig]').forEach(el => {
      const s = el.dataset.sig!
      const w = el.offsetWidth, h = el.offsetHeight
      if (w > 0 && wcache.current.get(s) !== w) { wcache.current.set(s, w); changed = true }
      if (h > 0 && hcache.current !== h) { hcache.current = h; changed = true }
    })
    if (changed) remeasure()
  })

  //  谁是谁的孩子
  const parentOf = new Map<number, number>()
  state.nodes.forEach((nd, i) => nd?.children.forEach(c => parentOf.set(c, i)))
  /*  分裂帧的 focus 是 [左半边, 刚裂出来的右半边]，而右半边此刻还没有父结点。
      认它靠「在 focus 里 + 没有父 + 不是根」三条同时成立 —— 不是靠 act 字段，
      这样万一内核换了动作名也不会又把它藏起来。 */
  const ghost = state.focus.length === 2
    && state.focus[1] !== state.root
    && !parentOf.has(state.focus[1])
    && state.nodes[state.focus[1]]
    ? state.focus[1] : -1
  const anchor = ghost >= 0 ? state.focus[0] : -1

  type L = { n: number; kids: L[] }
  const build = (n: number, d: number): L => {
    const kids: L[] = []
    if (d < MAXDEPTH) {
      for (const c of state.nodes[n]?.children ?? []) {
        kids.push(build(c, d + 1))
        //  悬着的右半边排在它左手边那个结点后面：位置就是它下一步要落的位置
        if (c === anchor) kids.push(build(ghost, d + 1))
      }
    }
    return { n, kids }
  }
  const roots: L[] = [build(state.root, 0)]
  //  根自己裂开时没有父结点可挂，就在根的右手边另起一棵
  if (ghost >= 0 && anchor === state.root) roots.push(build(ghost, 0))

  //  子树占宽：结点自己和孩子们排开后谁宽算谁，父结点再居中盖在孩子上方 —— 不会重叠
  const spanCache = new Map<number, number>()
  const span = (l: L): number => {
    const hit = spanCache.get(l.n)
    if (hit !== undefined) return hit
    const kids = l.kids.length
      ? l.kids.reduce((a, k) => a + span(k), 0) + GAPX * (l.kids.length - 1) : 0
    const v = Math.max(widthOf(l.n), kids)
    spanCache.set(l.n, v)
    return v
  }
  const placed: Placed[] = []
  const place = (l: L, left: number, depth: number) => {
    const s = span(l), w = widthOf(l.n)
    placed.push({ n: l.n, x: left + (s - w) / 2, y: depth, w })
    if (!l.kids.length) return
    const kidsW = l.kids.reduce((a, k) => a + span(k), 0) + GAPX * (l.kids.length - 1)
    let cx = left + (s - kidsW) / 2
    for (const k of l.kids) { place(k, cx, depth + 1); cx += span(k) + GAPX }
  }
  let cursor = 0
  for (const r of roots) { place(r, cursor, 0); cursor += span(r) + GAPX * 2 }

  const NH = hcache.current
  const deep = placed.reduce((m, p) => Math.max(m, p.y), 0)
  const rowY = (d: number) => PADTOP + d * (NH + rowgap(deep))
  const at = (n: number) => placed.find(p => p.n === n)
  const W = Math.max(1, cursor - GAPX * 2)
  const H = rowY(deep) + NH

  //  「中间键往上送」：从两半中间往上引一条虚线，指到父结点底下；根裂开时上面还没有父，就指向空处
  const A = anchor >= 0 ? at(anchor) : undefined
  const G = ghost >= 0 ? at(ghost) : undefined
  const P = anchor >= 0 && parentOf.has(anchor) ? at(parentOf.get(anchor)!) : undefined
  const up = A && G ? (() => {
    const x = (A.x + A.w + G.x) / 2, y = rowY(G.y) - 4
    const tx = P ? P.x + P.w / 2 : x
    const ty = P ? rowY(P.y) + NH : y - 22
    return { x, y, tx, ty, bx: (x + tx) / 2, by: (y + ty) / 2 }
  })() : undefined

  return (
    <div className="card">
      <h3>B+ 树 <span className="hint">{order} 阶 · 每个结点最多 {order - 1} 个关键字</span></h3>
      <div className="body scroll">
        <div className="bptbox" ref={boxRef} style={{ width: W, height: H }}>
          <svg width={W} height={H} aria-hidden="true">
            {placed.map(p => (state.nodes[p.n]?.children ?? []).map(c => {
              const q = at(c)
              if (!q) return null
              return (
                <line key={`${p.n}-${c}`} className="bptedge"
                  x1={p.x + p.w / 2} y1={rowY(p.y) + NH}
                  x2={q.x + q.w / 2} y2={rowY(q.y)} />
              )
            }))}
            {up && (
              <>
                <defs>
                  <marker id="bptarrow" viewBox="0 0 8 8" refX="7" refY="4"
                    markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M0 0 L8 4 L0 8 z" className="bptarrowhead" />
                  </marker>
                </defs>
                <path className="bptup" markerEnd="url(#bptarrow)"
                  d={`M ${up.x} ${up.y} L ${up.tx} ${up.ty}`} />
              </>
            )}
          </svg>
          {placed.map(p => {
            const nd: BNode = state.nodes[p.n]
            if (!nd) return null
            return (
              <div key={p.n} data-sig={sigOf(p.n)}
                className={`bptnode ${nd.leaf ? 'leaf' : 'inner'}`
                  + (state.focus.includes(p.n) ? ' hot' : '')
                  + (p.n === ghost ? ' fresh' : '')}
                style={{ left: p.x, top: rowY(p.y) }}>
                {nd.keys.map((k, j) => (
                  <span key={j} className={k === state.key ? 'cur' : ''}>{k}</span>
                ))}
                {nd.keys.length === 0 ? <em>空</em> : null}
              </div>
            )
          })}
          {up && (
            //  标签摆在虚线**旁边**不是压在上面 —— 那条线本身就是这一步要看的东西
            <div className="bptup-tag" style={{ left: up.bx + 8, top: up.by }}>
              {state.splitLeaf ? '复制' : '上移'} {state.upKey} ↑
            </div>
          )}
        </div>
        <div className="bplegend">
          <span><i className="bw inner" />内部结点（只当索引）</span>
          <span><i className="bw leaf" />叶子（所有关键字都在这一层）</span>
          {ghost >= 0 && <span><i className="bw fresh" />刚裂出来的右半边（父结点下一步才接上）</span>}
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{state.log}</span></div>
        </div>
      </div>
    </div>
  )
}

/** 叶子链：B+ 树相对 B 树的最大好处就在这条链上 */
function Leaves({ state, order }: { state: BPlusState; order: number }) {
  const chain = leafChain(state.nodes, state.root)
  //  收集叶子结点本身，画成链
  const leaves: number[] = []
  let cur = state.root
  while (state.nodes[cur] && !state.nodes[cur].leaf) cur = state.nodes[cur].children[0]
  while (cur !== -1 && state.nodes[cur]) { leaves.push(cur); cur = state.nodes[cur].next }

  return (
    <div className="card">
      <h3>叶子链 <span className="hint">所有关键字都在这一层，且串成有序链表</span></h3>
      <div className="body scroll">
        <div className="bpchain">
          {leaves.map((n, k) => (
            <div key={n} className="bpleaf">
              <div className="ks">
                {state.nodes[n].keys.map((x, j) => <span key={j}>{x}</span>)}
              </div>
              {k < leaves.length - 1 ? <span className="arrow">→</span> : null}
            </div>
          ))}
        </div>
        <div className="phasenow">
          <div className="pr"><span className="k">叶子个数</span><span className="v">{leaves.length}</span></div>
          <div className="pr"><span className="k">链上关键字</span>
            <span className="v">{chain.join(' ')}</span></div>
          <div className="pr"><span className="k">树高</span><span className="v">{state.height} 层</span></div>
          <div className="pr"><span className="k">分裂次数</span><span className="v">{state.splits}</span></div>
        </div>
        <p className="tnote">
          B+ 树相对 B 树的两点差别，也正是它适合做数据库索引的原因：<br />
          <b>1. 所有关键字都在叶子层</b> —— 内部结点只放索引，一个结点能塞下更多分支，树更矮，磁盘 I/O 更少。<br />
          <b>2. 叶子串成有序链表</b> —— 范围查询（"找出 30 到 60 之间的所有记录"）顺着链走就行，不用回树上。<br />
          还有一处最容易记反：<b>叶子分裂时中间键复制上去（叶子自己留一份），内部结点分裂时中间键上移（自己不留）</b>。
        </p>
      </div>
    </div>
  )
}
