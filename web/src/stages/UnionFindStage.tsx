/**
 * 舞台：并查集 —— **画成树**：一棵树 = 一个集合，树根就是这个集合的代表
 *
 * 2026-09-08 重画。用户：「我看着像是寻找根，同一个跟就属于同一个集合。
 * 实验示例是几个方块，没有可视化的集合过滤。可以用树来表示。」
 *
 * 他把这个数据结构说对了，而原来那一版画的是**一排方块**，每块底下写个 `↑3`。
 * 「同一个根 = 同一个集合」这句话，在一排方块上是**读不出来**的：
 * 你得顺着 ↑ 一跳一跳地在脑子里连线，而那正是这个结构唯一要你看见的东西。
 * union 把两棵树接起来、find 顺着边往上爬、路径压缩把长链一次拍平 ——
 * 三个动作全是**树形上的动作**，画成树才看得见。
 *
 * 坐标自己算（子树占宽 → 父结点居中盖在孩子上方，不会重叠），
 * 边画在 SVG 上、结点绝对定位盖在上面 —— 跟 B+ 树那一屏同一套路子。
 */
import type { UnionFindState } from '@engine/kernels/unionfind.ts'
import type { StageProps } from '../types.ts'

const HUES = [205, 150, 32, 280, 340, 95, 55]   // 按根染色，同色=一伙

const NODE = 34      // 结点直径
const GAPX = 12      // 同层相邻结点最小间距
const ROW = 46       // 上下两层的行距（含结点自身）
const PAD = 6        // 树盒子内边距

type Placed = { n: number; x: number; y: number }

export function UnionFindStage({ state }: StageProps<UnionFindState>) {
  const {
    n, parent, act, a, b, ra, rb, path, root, comps, depths, phase,
    findSteps, maxDepth, unionKind, compress, seq, totalSteps, finalDepth, scale, slope, degraded,
  } = state
  const done = phase === 'done'

  //  孩子表：parent[x] === x 的是根，其余挂在 parent[x] 下
  const kids: number[][] = Array.from({ length: n }, () => [])
  const roots: number[] = []
  for (let x = 0; x < n; x++) {
    if (parent[x] === x) roots.push(x)
    else kids[parent[x]].push(x)
  }

  const onPath = new Set(act === 'find' || act === 'compress' ? [...path, root] : [])

  return (
    <div className="card">
      <h3>并查集 <span className="hint">一棵树 = 一个集合，树根就是这个集合的代表</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{comps}</span><span className="scdl">集合个数（＝树的棵数）</span></div>
          <div className="scdk"><span className="scdn hot">{act === 'union' ? `${a}∪${b}` : act === 'find' || act === 'compress' ? `find(${a})` : '—'}</span><span className="scdl">本步操作</span></div>
          <div className="scdk">
            <span className={`scdn ${maxDepth >= n - 1 ? 'bad' : ''}`}>{maxDepth}</span>
            <span className="scdl">最深链（find 最多爬几步）</span>
          </div>
          {/*  ⭐ 补厚的落点：树深只是表象，**find 一共爬了多少步**才是"快不快"的硬指标 */}
          <div className="scdk"><span className="scdn hot">{findSteps}</span><span className="scdl">find 累计爬了几步</span></div>
          <div className="scdk">
            <span className={`scdn ${degraded ? 'bad' : 'good'}`}>{slope.toFixed(2)}</span>
            <span className="scdl">实测增长指数（线性=1）</span>
          </div>
        </div>

        {/*  一棵树一个盒子 —— 「哪些点是一伙的」就是"框在同一个盒子里的那些"，
             不用再顺着箭头在脑子里连。 */}
        <div className="ufforest">
          {roots.map(r => (
            <Tree key={r} r={r} kids={kids} depths={depths} onPath={onPath}
              act={act} ra={ra} rb={rb} focusRoot={root}
              hue={HUES[r % HUES.length]} />
          ))}
        </div>

        <div className="orcap">
          {act === '' ? `按「下一步」开始：${n} 个点各自成树 = ${n} 个集合。合并方式「${unionKind}」、${compress}、操作序列「${seq}」`
            : act === 'union' ? (ra === rb
              ? `union(${a},${b})：${a} 和 ${b} 的根都是 ${ra}，本来就在同一棵树里 —— 不用并`
              : `union(${a},${b})：根 ${ra} ≠ 根 ${rb} → 把整棵「${ra} 树」挂到根 ${rb} 底下，两棵并成一棵`)
              : act === 'find' ? `find(${a})：从 ${a} 顺着边往上爬 ${[...path, root].join(' → ')}，到根 ${root} 停 —— 爬了 ${path.length} 步`
                : act === 'compress' ? `路径压缩：把刚才爬过的 ${path.join('、')} 全部**直接挂到根 ${root} 底下** —— 长链一次拍平，下次 find 一步到位`
                  : `并成 1 棵树 = 1 个集合；"是不是一伙"就是"爬到的根同不同"`}
        </div>

        {/*  规模验证：四种组合各跑一遍同一串操作，只计数不出帧。
             「均摊近乎 O(1)」和「朴素退化成 n²」都在这四行上，不在旁白里。 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>合并 / 压缩</span><span>n=256 步数</span><span>树深</span><span>增长指数</span></div>
            {scale.map(sc => {
              const big = sc.rows[sc.rows.length - 1]
              const mineRow = sc.unionKind === unionKind && sc.compress === compress
              return (
                <div className="qsrow" key={`${sc.unionKind}/${sc.compress}`}>
                  <span>{sc.unionKind.startsWith('按秩') ? '按秩' : '朴素'} + {sc.compress === '不压缩' ? '不压缩' : '压缩'}{mineRow ? ' ◀' : ''}</span>
                  <span className={sc.slope > 1.5 ? 'bad' : ''}>{big.steps}</span>
                  <span className={big.depth >= big.n - 1 ? 'bad' : 'dimv'}>{big.depth}</span>
                  <span className={sc.slope > 1.5 ? 'bad' : 'good'}>{sc.slope.toFixed(2)}</span>
                </div>
              )
            })}
            <div className="orcap">
              同一串操作（序列「{seq}」）在 n=8…256 上各跑一遍，只计数不出帧。
              指数 1 = 线性（<b>均摊每次操作是常数</b>），2 = O(n²)。
            </div>
          </div>
        )}

        {done
          ? (
            <p className="scnote">
              n={n} 时 find 一共爬了 <b>{totalSteps}</b> 步，最终最大树深 <b>{finalDepth}</b>。
              {degraded ? (
                <>　⚠️ <b>这一档退化了</b>：增长指数 <b>{slope.toFixed(2)}</b>，也就是 O(n²)。
                  朴素合并<b>不看谁高谁矮</b>，最坏序列下正好把树长成一条链，而每次 find 都要从底爬到顶。
                  <b>"并查集很快"的前提是这两个优化至少上一个</b> —— 打开任意一个，指数立刻掉到 1 附近。</>
              ) : (
                <>　增长指数 <b>{slope.toFixed(2)}</b>，接近线性 —— <b>均摊下来每次操作是常数级</b>，这就是"近乎 O(1)"的实际含义。
                  注意它不是"每次 find 都一步到根"：压缩是<b>事后</b>把爬过的链拍平（第一次爬那条链的钱照付），
                  按秩合并是从<b>源头</b>不让树长高。摊到 n 次操作上才是常数。</>
              )}
              <br />
              <b>两个优化各自都够用，但理由不同</b>：看规模表里「树深」那一列 ——
              按秩合并让它从一开始就没高过（两两归并那条序列上正好是 log₂n），
              路径压缩则是把它一次拍平到 1。它是 Kruskal 最小生成树、网络连通性、账号合并、图像连通域的核心零件。
            </p>
          )
          : <p className="scnote" style={{ opacity: .85 }}>每个虚线框 = 一个集合（一棵树）；框头那个数是这棵树的<b>根</b>。结点里的大数是编号、下面的小字是它到根要爬几步。盯着读数里的<b>「find 累计爬了几步」</b>：树深是表象，那个数才是代价。</p>}
      </div>
    </div>
  )
}

/** 一棵树：先算坐标（子树占宽 → 父居中），再画边、摆点 */
function Tree({ r, kids, depths, onPath, act, ra, rb, focusRoot, hue }: {
  r: number; kids: number[][]; depths: number[]; onPath: Set<number>
  act: string; ra: number; rb: number; focusRoot: number; hue: number
}) {
  const span = (x: number): number => {
    const cs = kids[x]
    if (cs.length === 0) return NODE
    return Math.max(NODE, cs.reduce((s, c) => s + span(c), 0) + GAPX * (cs.length - 1))
  }
  const placed: Placed[] = []
  const place = (x: number, left: number, d: number) => {
    const s = span(x)
    placed.push({ n: x, x: left + (s - NODE) / 2, y: d })
    let cx = left + (s - (kids[x].reduce((t, c) => t + span(c), 0) + GAPX * (kids[x].length - 1))) / 2
    for (const c of kids[x]) { place(c, cx, d + 1); cx += span(c) + GAPX }
  }
  place(r, 0, 0)

  const at = (x: number) => placed.find(p => p.n === x)!
  const deep = placed.reduce((m, p) => Math.max(m, p.y), 0)
  const W = span(r)
  const H = deep * ROW + NODE
  const cx = (p: Placed) => p.x + NODE / 2
  const cy = (p: Placed) => p.y * ROW + NODE / 2

  //  这棵树里的成员，按编号排一遍 —— 「集合里有谁」直接写出来
  const members = placed.map(p => p.n).sort((x, y) => x - y)

  return (
    <div className={`uftree${act === 'union' && (r === ra || r === rb) ? ' hot' : ''}`}
      style={{ ['--hue' as string]: hue }}>
      <div className="ufhead">根 <b>{r}</b> · {members.length} 个成员</div>
      <div className="ufbox" style={{ width: W + PAD * 2, height: H + PAD }}>
        <svg width={W + PAD * 2} height={H + PAD}>
          {placed.map(p => kids[p.n].map(c => {
            const q = at(c)
            const lit = onPath.has(c) && onPath.has(p.n)
            return (
              <line key={`${p.n}-${c}`} className={`ufedge${lit ? ' lit' : ''}`}
                x1={cx(q) + PAD} y1={cy(q) + PAD - NODE / 2}
                x2={cx(p) + PAD} y2={cy(p) + PAD + NODE / 2} />
            )
          }))}
        </svg>
        {placed.map(p => {
          const cls = ['ufn',
            p.n === r ? 'root' : '',
            onPath.has(p.n) ? (act === 'compress' ? 'squash' : 'walk') : '',
            act === 'union' && p.n === ra ? 'movesrc' : '',
            act === 'union' && p.n === rb ? 'movedst' : '',
            act === 'find' && p.n === focusRoot ? 'goal' : '',
          ].filter(Boolean).join(' ')
          return (
            <div key={p.n} className={cls}
              style={{ left: p.x + PAD, top: p.y * ROW + PAD, width: NODE, height: NODE }}>
              <span className="ufid">{p.n}</span>
              <span className="ufdep">{depths[p.n]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
