/**
 * 内核：GJK 碰撞检测 —— 两个凸多边形碰没碰?(具身智能 · 运动规划 / 碰撞检测原语 / 面试八股)
 * 轴：step —— 引子(Minkowski 差) → 逐轮:朝原点取支撑点 → 判 a·d(越过原点没?) → 单纯形演化(线/三角、朝原点收) → 三角形含原点=碰 / a·d<0=不碰 → 收尾。
 *
 * 运动规划每走一步都要问"机器人和障碍碰了吗"。GJK(Gilbert–Johnson–Keerthi)是**凸形碰撞检测**的标准算法,核心两招:
 *   ①**Minkowski 差 A⊖B={a−b}**:两凸形相交 ⟺ **原点落在 A⊖B 里**(把"两形碰不碰"变成"一个形含不含原点")。
 *   ②**支撑函数 support(d)=沿方向 d 最远的顶点**:不用显式建出整个 A⊖B,每次只朝一个方向要一个最远点 s(d)=support_A(d)−support_B(−d),**懒惰**地围原点建**单纯形**(2D 最多三角形)。
 *   每轮:朝当前方向取支撑点 a;若 **a·d<0**(最远都没越过原点)→ 原点在外、**不碰**、停;否则把 a 加进单纯形、doSimplex 丢掉离原点远的点、把方向指向原点;**三角形一旦含原点=碰**。
 * 本例两个正方形:相交场景 GJK 几轮把原点围进三角形→碰;分离场景某轮 a·d<0→不碰。支撑点/单纯形/方向全现算。连「运动规划(碰撞检测是每步前提)/EPA 求穿透深度」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type V = [number, number]
type Sc = 'hit' | 'miss'
export type GjkState = {
  i: number
  step: number
  stage: 'intro' | 'support' | 'simplex' | 'result' | 'done'
  scen: Sc
  scenLabel: string
  A: V[]; B: V[]
  mink: V[]           // Minkowski 差 A⊖B 的凸包(仅作展示,GJK 本身不显式建它)
  iterNo: number
  dir: V              // 当前搜索方向
  a: V               // 本轮支撑点(Minkowski 差上)
  sA: V; sB: V       // a 来自 A、B 的哪两个顶点(a = sA - sB)
  adot: number       // a·d
  passed: boolean    // a·d >= 0? (越过原点)
  simplex: V[]       // 当前单纯形(Minkowski 差空间)
  contained: boolean // 三角形含原点?
  collide: boolean | null
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<GjkState, 'i'>

const SQ_A: V[] = [[1, 1], [4, 1], [4, 4], [1, 4]]
const SQ_B_HIT: V[] = [[3, 2], [6, 2], [6, 5], [3, 5]]
const SQ_B_MISS: V[] = [[6, 2], [9, 2], [9, 5], [6, 5]]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]]
const neg = (a: V): V => [-a[0], -a[1]]
// 三重积 (a×b)×c，2D：返回垂直于 a 指向 c 那侧的向量
const triple = (a: V, b: V, c: V): V => { const ac = dot(a, c), bc = dot(b, c); return [b[0] * ac - a[0] * bc, b[1] * ac - a[1] * bc] }
const support = (verts: V[], d: V): V => verts.reduce((best, v) => (dot(v, d) > dot(best, d) ? v : best), verts[0]!)
const cen = (verts: V[]): V => [verts.reduce((s, v) => s + v[0], 0) / verts.length, verts.reduce((s, v) => s + v[1], 0) / verts.length]
// 凸包(Andrew 单调链) —— 仅用于把 A⊖B 画出来
const hull = (pts: V[]): V[] => {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: V, a: V, b: V) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo: V[] = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q) }
  const up: V[] = []; for (let k = p.length - 1; k >= 0; k--) { const q = p[k]!; while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop(); up.push(q) }
  return [...lo.slice(0, -1), ...up.slice(0, -1)]
}

export const gjkKernel: Kernel<GjkState> = {
  kind: 'gjk',
  compile(doc: SimDocument): CompiledModel<GjkState> {
    const scen: Sc = String(doc.params?.scenario ?? '相交').includes('分离') ? 'miss' : 'hit'
    const scenLabel = scen === 'hit' ? '相交(会碰)' : '分离(不碰)'
    const A = SQ_A, B = scen === 'hit' ? SQ_B_HIT : SQ_B_MISS

    // Minkowski 支撑：s(d) = support_A(d) - support_B(-d)
    const supMink = (d: V): { a: V; sA: V; sB: V } => { const sA = support(A, d), sB = support(B, neg(d)); return { a: sub(sA, sB), sA, sB } }

    type Iter = { dir: V; a: V; sA: V; sB: V; adot: number; passed: boolean; simplex: V[]; contained: boolean; done: null | boolean }
    const iters: Iter[] = []
    let d: V = sub(cen(B), cen(A))          // 初始方向
    let s0 = supMink(d)
    let simplex: V[] = [s0.a]
    d = neg(s0.a)                            // 朝原点
    let verdict: boolean | null = null
    for (let guard = 0; guard < 8 && verdict === null; guard++) {
      const dIn: V = [d[0], d[1]]            // 本轮取支撑点用的入方向(下面 doSimplex 会改 d)
      const { a, sA, sB } = supMink(d)
      const adot = dot(a, d)
      if (adot < 0) { iters.push({ dir: dIn, a, sA, sB, adot, passed: false, simplex: [...simplex], contained: false, done: false }); verdict = false; break }
      simplex = [...simplex, a]
      // doSimplex
      let contained = false
      if (simplex.length === 2) {
        const [b, aa] = [simplex[0]!, simplex[1]!]
        const ab = sub(b, aa), ao = neg(aa)
        d = triple(ab, ao, ab); simplex = [b, aa]
        if (d[0] === 0 && d[1] === 0) d = [-ab[1], ab[0]]  // 退化：取垂线
      } else {
        const [c, b, aa] = [simplex[0]!, simplex[1]!, simplex[2]!]
        const ab = sub(b, aa), ac = sub(c, aa), ao = neg(aa)
        const abPerp = triple(ac, ab, ab), acPerp = triple(ab, ac, ac)
        if (dot(abPerp, ao) > 0) { simplex = [b, aa]; d = abPerp }
        else if (dot(acPerp, ao) > 0) { simplex = [c, aa]; d = acPerp }
        else contained = true
      }
      iters.push({ dir: dIn, a, sA, sB, adot, passed: true, simplex: [...simplex], contained, done: contained ? true : null })
      if (contained) verdict = true
    }

    const collide = verdict

    const mink = hull(A.flatMap(a => B.map(bb => sub(a, bb))))

    const frames: Frame[] = []
    const b0 = { scen, scenLabel, A, B, mink, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; focus: string; log: string }) =>
      frames.push({ ...b0, iterNo: 0, dir: [0, 0], a: [0, 0], sA: [0, 0], sB: [0, 0], adot: 0, passed: true, simplex: [], contained: false, collide, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', focus: `GJK:两凸形碰不碰 = 原点在不在 Minkowski 差 A⊖B 里。场景：${scenLabel}`,
      log: `**GJK:把"两个凸形碰不碰"变成"一个形含不含原点"**\n运动规划每走一步都要做碰撞检测。GJK 是凸形碰撞检测的标准算法,两招:\n· **① Minkowski 差 A⊖B={a−b | a∈A,b∈B}**:两凸形相交 ⟺ **原点∈A⊖B**;\n· **② 支撑函数 support(d)=沿方向 d 最远的顶点**:不显式建整个 A⊖B,每次只朝一个方向要一个最远点 **s(d)=support_A(d)−support_B(−d)**,懒惰地围着原点建**单纯形**(2D 最多三角形)。\n本例两个矩形,A=[1,1]~[4,4];当前场景 **${scenLabel}**(B=${scen === 'hit' ? '[3,2]~[6,5]、和 A 重叠' : '[6,2]~[9,5]、和 A 分开'})。下面逐轮跑。` })

    iters.forEach((it, k) => {
      const dirNow = it.dir
      push({
        stage: 'support', iterNo: k + 1, dir: dirNow, a: it.a, sA: it.sA, sB: it.sB, adot: Math.round(it.adot * 100) / 100, passed: it.passed, simplex: it.simplex, contained: it.contained,
        focus: `第 ${k + 1} 轮:朝 d=[${dirNow}] 取支撑点 a=support_A−support_B=[${it.a}];a·d=${Math.round(it.adot * 100) / 100} ${it.passed ? '≥0 越过原点' : '<0 没越过→不碰'}`,
        log: `**第 ${k + 1} 轮 · 取支撑点**\n朝当前方向 **d=[${dirNow}]**(指向原点)在 Minkowski 差上取最远点:\n**a = support_A(d) − support_B(−d) = [${it.sA}] − [${it.sB}] = [${it.a}]**。\n**关键判据 a·d = ${Math.round(it.adot * 100) / 100}**:${it.passed
          ? '≥0 → 沿 d 最远都能越过原点,原点还"够得着",继续把 a 加进单纯形。'
          : '**<0 → 连最远点都没越过原点**,说明原点在 A⊖B 之外 → **两形不碰**、GJK 提前停(这就是它高效的原因)。'}` })
      if (it.passed) {
        push({
          stage: it.contained ? 'result' : 'simplex', iterNo: k + 1, dir: dirNow, a: it.a, sA: it.sA, sB: it.sB, adot: Math.round(it.adot * 100) / 100, passed: true, simplex: it.simplex, contained: it.contained,
          focus: it.contained
            ? `单纯形成三角形 [${it.simplex.map(p => `(${p})`).join(',')}] 且含原点 → 两形相交、碰!`
            : `doSimplex:丢掉离原点远的点、方向指向原点,单纯形=${it.simplex.map(p => `(${p})`).join(',')}`,
          log: it.contained
            ? `**第 ${k + 1} 轮 · 单纯形含原点 → 碰!**\n把 a 加进单纯形后成**三角形 [${it.simplex.map(p => `(${p})`).join(', ')}]**,做 doSimplex 发现**原点落在三角形内部**——即原点∈A⊖B → **两个凸形相交(碰撞)**。GJK 结束。\n(想进一步求**穿透深度/最小平移向量**,接 **EPA** 从这个含原点的单纯形往外扩。)`
            : `**第 ${k + 1} 轮 · doSimplex 演化单纯形**\n把 a 加进单纯形,然后 **doSimplex**:判原点在单纯形哪个区域,**丢掉离原点最远、对"包住原点"没用的那个顶点**,把**搜索方向 d 重新指向原点**(垂直于保留边、朝原点那侧)。当前单纯形=**${it.simplex.map(p => `(${p})`).join(', ')}**,带着新方向进下一轮。` })
      }
    })

    push({
      stage: 'done', iterNo: iters.length, collide,
      simplex: iters[iters.length - 1]?.simplex ?? [],
      focus: collide ? `结论:原点∈A⊖B → 两形相交(碰)。GJK 用支撑函数懒惰围原点、几轮定论` : `结论:某轮 a·d<0、原点∈A⊖B 之外 → 两形不碰。GJK 提前停、不必建整个差集`,
      log: `**小结:GJK = Minkowski 差 + 支撑函数 + 单纯形**\n· **Minkowski 差**:两凸形碰 ⟺ 原点∈A⊖B(把碰撞变成"含不含原点");\n· **支撑函数**:每轮只朝一个方向要一个最远点、不显式建整个差集(所以对任意凸形都快);\n· **单纯形演化**:懒惰地围原点建三角形,doSimplex 丢无用点、方向指向原点;\n· **两个出口**:三角形**含原点→碰**;某轮**a·d<0→不碰**(提前停)。\n**本例结论:${scenLabel} → ${collide ? '碰撞' : '不碰'}**(用了 ${iters.length} 轮)。\n**为什么重要**:「运动规划」(RRT/PRM/RRT*)每采一个点、每连一条边都要碰撞检测,GJK 是最常用的凸-凸检测;对任意凸形只需支撑函数(圆/胶囊/多面体都行)、无需预建差集。**连**:求穿透深度接 **EPA**;凹形要先凸分解或用别的法。面试延伸:Minkowski 差直觉、支撑函数、单纯形/doSimplex、a·d 提前退出、GJK vs SAT(分离轴)、EPA、连续碰撞检测(CCD)。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, iterNo: 0, dir: [0, 0], a: [0, 0], sA: [0, 0], sB: [0, 0], adot: 0, passed: true, simplex: [], contained: false, collide, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'GJK 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
