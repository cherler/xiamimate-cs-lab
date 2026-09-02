/**
 * 内核：RRT-Connect 双向快速扩展 —— 从起点和终点同时长两棵树、用贪心 CONNECT 互相靠拢(具身智能 · 运动规划 / MoveIt·OMPL 默认 / 面试八股)
 * 轴：step —— 反复：采样 → EXTEND 一棵树迈一步得 q_new → 另一棵树 CONNECT 贪心朝 q_new 连续迈步(直到够到或撞障碍) → 两树相遇则拼出路径,否则交换两树再来。
 *
 * 单树 RRT 从起点一棵树慢慢长到终点。**RRT-Connect** 是它的加速版、也是 MoveIt/OMPL 里机械臂规划的默认算法:
 *   ① **两棵树**:一棵从**起点**长、一棵从**终点**长;
 *   ② **EXTEND**:随机采样,让当前树朝采样点**迈一步**得到 q_new(撞障碍就丢);
 *   ③ **CONNECT(贪心)**:让**另一棵树朝 q_new 连续迈步**(不是一步、是一路走)、直到**够到 q_new**(两树相遇)或**撞障碍停下**;
 *   ④ 两树一相遇 → 从相遇点分别沿父指针回溯、**拼成起点→终点的完整路径**;没相遇就**交换两树**再来。
 * 双向 + 贪心让搜索快得多(两头对着挖、且 CONNECT 一次走一串)。同样**概率完备、不最优**(路径要后处理平滑)。
 * 本例 10×10 世界、中央障碍、起点(1,1)↔终点(9,9),固定种子伪随机(可复现):两树各绕障碍一侧、CONNECT 把它们接上、拼出路径。采样/最近点/迈步/贪心连接/碰撞全真算、可手核。连「RRT / RRT* / PRM / Dubins(车上转移)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100
type Pt = { x: number; y: number }
type Node = { x: number; y: number; parent: number }
type Rect = { x0: number; y0: number; x1: number; y1: number }
export type RRTCState = {
  i: number
  step: number
  phase: 'intro' | 'grow' | 'done'
  op: 'intro' | 'extend' | 'connect' | 'reject' | 'summary'
  W: number
  start: Pt; goal: Pt; obstacles: Rect[]
  treeS: Node[]; treeG: Node[]          // 起点树 / 终点树（累积，各自 parent 指针内部有效）
  extendS: boolean                       // 本步 EXTEND 的是起点树吗
  sample: Pt | null
  qnew: Pt | null                        // EXTEND 得到的新点
  connectPath: Pt[] | null               // CONNECT 贪心走过的一串点
  connected: boolean
  rejected: number
  path: Pt[] | null                      // 相遇后拼出的完整路径
  found: boolean
  focus: string
  log: string
}
type Frame = Omit<RRTCState, 'i'>

const W = 10, STEP = 1.5, SEED = 6
const START: Pt = { x: 1, y: 1 }, GOAL: Pt = { x: 9, y: 9 }
const OBS: Rect[] = [{ x0: 2.5, y0: 3, x1: 7, y1: 6.5 }]
const inObs = (x: number, y: number) => OBS.some(o => x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1)
const edgeHits = (a: Pt, b: Pt) => { for (let t = 0; t <= 1; t += 0.2) { if (inObs(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return true } return false }
const nearest = (tree: Node[], p: Pt) => { let ni = 0, nd = 1e9; tree.forEach((n, k) => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < nd) { nd = d; ni = k } }); return ni }

export const rrtconnectKernel: Kernel<RRTCState> = {
  kind: 'rrtconnect',
  compile(_doc: SimDocument): CompiledModel<RRTCState> {
    const frames: Frame[] = []
    const snap = (n: Node[]) => n.map(x => ({ ...x }))
    let s = SEED >>> 0
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff }

    const treeS: Node[] = [{ x: START.x, y: START.y, parent: -1 }]
    const treeG: Node[] = [{ x: GOAL.x, y: GOAL.y, parent: -1 }]
    let extendS = true, rejected = 0
    let done = false

    const base = (over: Partial<Frame> & { op: Frame['op']; phase: Frame['phase']; focus: string; log: string }) =>
      frames.push({ step: frames.length, W, start: START, goal: GOAL, obstacles: OBS, treeS: snap(treeS), treeG: snap(treeG), extendS, sample: null, qnew: null, connectPath: null, connected: false, rejected, path: null, found: false, ...over } as Frame)

    base({
      op: 'intro', phase: 'intro',
      focus: 'RRT-Connect：起点、终点各长一棵树，EXTEND 迈一步 + CONNECT 贪心互相靠拢',
      log: `**RRT-Connect：双向长树 + 贪心连接**\n单树 RRT 从起点一棵树慢慢长到终点。RRT-Connect(MoveIt/OMPL 默认)更快:\n① **两棵树**——一棵从起点(${START.x},${START.y})、一棵从终点(${GOAL.x},${GOAL.y});\n② **EXTEND**:采样,让当前树朝采样点**迈一步**得 q_new(撞障碍就丢);\n③ **CONNECT(贪心)**:让**另一棵树朝 q_new 连续迈步**、直到够到(相遇)或撞障碍;\n④ 两树相遇 → 从相遇点回溯、**拼出起点→终点整条路**;没相遇就**交换两树**再来。\n${W}×${W} 世界、中央障碍。看两棵树怎么两头对着挖、接上。`,
    })

    for (let it = 0; it < 60 && !done; it++) {
      const E = extendS ? treeS : treeG, C = extendS ? treeG : treeS
      const sx = r2(rnd() * W), sy = r2(rnd() * W)
      const sample: Pt = { x: sx, y: sy }
      // EXTEND E 一步
      const ei = nearest(E, sample); const en = E[ei]!
      const edx = sx - en.x, edy = sy - en.y, eL = Math.hypot(edx, edy) || 1
      const qx = r2(en.x + edx / eL * STEP), qy = r2(en.y + edy / eL * STEP)
      const qnew: Pt = { x: qx, y: qy }
      if (qx < 0 || qx > W || qy < 0 || qy > W || inObs(qx, qy) || edgeHits(en, qnew)) {
        rejected += 1
        base({ op: 'reject', phase: 'grow', sample, qnew: null, focus: `EXTEND ${extendS ? '起点树' : '终点树'} 迈一步撞障碍/出界 → 丢弃、交换两树（累计丢 ${rejected}）`, log: `**EXTEND 失败：丢弃并交换**\n本步 EXTEND 的是**${extendS ? '起点树' : '终点树'}**:采样 (${sx},${sy}) → 最近节点 (${en.x},${en.y}) → 迈一步到 (${qx},${qy}) **撞障碍/出界**,这一步作废。RRT-Connect 随即**交换两棵树**、下一轮换另一棵树来 EXTEND(累计丢弃 ${rejected})。` })
        extendS = !extendS
        continue
      }
      E.push({ x: qx, y: qy, parent: ei })
      base({ op: 'extend', phase: 'grow', sample, qnew, focus: `EXTEND ${extendS ? '起点树' : '终点树'}：朝采样(${sx},${sy})迈一步 → q_new=(${qx},${qy})`, log: `**① EXTEND：${extendS ? '起点' : '终点'}树迈一步**\n采样 (${sx},${sy}),**${extendS ? '起点树' : '终点树'}**里最近节点 (${en.x},${en.y}) 朝它迈一步 step=${STEP} → **q_new=(${qx},${qy})**,没撞障碍、加进树。接下来让**另一棵树**贪心去够这个 q_new。` })

      // CONNECT C 贪心朝 q_new
      let ci = nearest(C, qnew)
      const connectPath: Pt[] = [{ x: C[ci]!.x, y: C[ci]!.y }]
      let connected = false, blocked = false
      for (let g = 0; g < 20; g++) {
        const cn = C[ci]!
        const d = Math.hypot(qx - cn.x, qy - cn.y)
        if (d < STEP) { if (!edgeHits(cn, qnew)) { connected = true }; break }
        const cx = r2(cn.x + (qx - cn.x) / d * STEP), cy = r2(cn.y + (qy - cn.y) / d * STEP)
        if (cx < 0 || cx > W || cy < 0 || cy > W || inObs(cx, cy) || edgeHits(cn, { x: cx, y: cy })) { blocked = true; break }
        C.push({ x: cx, y: cy, parent: ci }); ci = C.length - 1
        connectPath.push({ x: cx, y: cy })
      }

      if (connected) {
        // 拼路径：起点树根→q_new + 终点树根→ci（相遇），组合成 start..goal
        const walk = (tree: Node[], idx: number) => { const p: Pt[] = []; let c = idx; while (c >= 0) { p.push({ x: tree[c]!.x, y: tree[c]!.y }); c = tree[c]!.parent } return p } // 返回从该节点回溯到根
        const eIdx = E.length - 1
        const ePath = walk(E, eIdx)  // q_new -> E root
        const cPath = walk(C, ci)    // meet -> C root
        // start 树在前（从 start 到相遇），goal 树在后（相遇到 goal）
        let full: Pt[]
        if (extendS) full = [...ePath.reverse(), ...cPath]           // E=起点树: start..qnew ; C=终点树: meet..goal
        else full = [...cPath.reverse(), ...ePath]                   // E=终点树: qnew..goal ; C=起点树: start..meet
        base({ op: 'summary', phase: 'done', sample, qnew, connectPath, connected: true, path: full, found: true, focus: `CONNECT 够到 q_new！两树相遇、拼出 ${full.length - 1} 段路径`, log: `**③ CONNECT 成功：两树相遇！**\n**${extendS ? '终点树' : '起点树'}**从最近节点贪心朝 q_new=(${qx},${qy}) 连续迈步(走了 ${connectPath.length - 1} 步)、**够到了 q_new** —— 两棵树接上了!\n从相遇点分别沿父指针回溯、拼成完整路径:**${full.map(p => `(${p.x},${p.y})`).join(' → ')}**(共 **${full.length - 1} 段**)。\n\n**要点**:RRT-Connect 用**双向两棵树 + 贪心 CONNECT(一次走一串而非一步)**大幅加速——两头对着挖、中间接上,比单树 RRT 快很多,是 **MoveIt/OMPL 机械臂规划的默认**。同样**概率完备、不最优**(路径歪、要后处理平滑,或用双向 RRT*)。关键旋钮同 RRT:step、碰撞检测;高维关节空间照用。本例固定种子可复现、丢弃 ${rejected} 次。连「RRT(单树)/RRT*(最优)/PRM(多查询)/Dubins(车上两点转移换成曲线)」。` })
        done = true
      } else {
        base({ op: 'connect', phase: 'grow', sample, qnew, connectPath, connected: false, focus: `CONNECT ${extendS ? '终点树' : '起点树'} 贪心朝 q_new 走了 ${connectPath.length - 1} 步${blocked ? '被障碍挡下' : ''} → 未相遇、交换两树`, log: `**② CONNECT：${extendS ? '终点' : '起点'}树贪心去够 q_new**\n**${extendS ? '终点树' : '起点树'}**里最近节点朝 q_new=(${qx},${qy}) **连续迈步**(贪心、一路走):走了 ${connectPath.length - 1} 步到 (${connectPath[connectPath.length - 1]!.x},${connectPath[connectPath.length - 1]!.y})${blocked ? '、**撞障碍停下**' : ''} —— 还没够到 q_new。这一轮没相遇,**交换两棵树**、下轮换另一棵 EXTEND。(CONNECT 一次能走一串、这就是它比单步扩展快的原因。)` })
        extendS = !extendS
      }
    }

    const base0: Frame = { step: -1, phase: 'intro', op: 'intro', W, start: START, goal: GOAL, obstacles: OBS, treeS: [{ x: START.x, y: START.y, parent: -1 }], treeG: [{ x: GOAL.x, y: GOAL.y, parent: -1 }], extendS: true, sample: null, qnew: null, connectPath: null, connected: false, rejected: 0, path: null, found: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '扩展步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
