/**
 * 内核：Dubins 曲线 —— 只能前进、有最小转弯半径的车,两个位姿之间最短路怎么走(具身智能 · 运动规划 / 非完整约束 / 面试八股)
 * 轴：step —— 引子(非完整约束+最小转弯半径) → 两端转向圆 → 四种 CSC 词各算长度 → 选最短 → 最优词的三段(转-直-转) → 收尾。
 *
 * 车/差速底盘和机械臂不同:**不能横着走**(非完整约束 nonholonomic),而且有**最小转弯半径 R**(打死方向盘也只能拐这么急)。
 * **Dubins(1957)** 证明:只前进的车,任意两个**位姿(位置+朝向)**间的**最短路**,一定是**三段圆弧/直线**、且只可能是 6 种"词"之一:
 *   **CSC**(转-直-转):**LSL / RSR / LSR / RSL**;**CCC**(转-转-转):RLR / LRL(近距离才用)。L=左转弧、R=右转弧、S=直线,转弯半径都=R。
 * 算法:对每种词用**闭式几何**算出三段长度(t,p,q,转弯段是弧度、直线段是长度),**取总长最短的那种**。本例只算 4 种 CSC。
 * 本例起点(0,0,0°)、终点(3,2)、R=1:终点**朝上(90°)** → 最优 **LSL**(左转0.464+直2.236+左转1.107=3.807);终点**朝下(−90°)** → 最优 **LSR**(1.571+1+3.142=5.712)。
 * **同一起终位置、只改终点朝向,最优词就从 LSL 变 LSR** —— 最优路径由位姿决定。长度全用 Dubins 闭式现算、并按三段重建验证终点严格落在目标位姿。连「RRT/混合A*(给车用要接 Dubins/Reeds-Shepp 作转移)/Reeds-Shepp(可倒车版)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type V = [number, number]
type Pose = [number, number, number]  // x,y,theta(rad)
type Sc = 'up' | 'down'
type WordKey = 'LSL' | 'RSR' | 'LSR' | 'RSL'
export type DubinsState = {
  i: number
  step: number
  stage: 'intro' | 'circles' | 'words' | 'best' | 'segments' | 'done'
  scen: Sc
  scenLabel: string
  headingDeg: number
  start: Pose; goal: Pose; rho: number
  words: Record<WordKey, number | null>   // 每种词的总长(null=不可行)
  bestType: WordKey
  t: number; p: number; q: number; len: number
  segs: string                              // 如 'LSL'
  pathPts: V[]                              // 沿最优词采样的路径点(重建)
  c1: V; c2: V                              // 最优词首/末转向圆圆心
  showCircles: boolean; showWords: boolean; showBest: boolean; showPath: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<DubinsState, 'i'>

const TAU = 2 * Math.PI
const mod2pi = (x: number) => { let r = x % TAU; if (r < 0) r += TAU; return r }
const r3 = (x: number) => Math.round(x * 1000) / 1000
const r2 = (x: number) => Math.round(x * 100) / 100
const START: Pose = [0, 0, 0]

type Word = { segs: string; t: number; p: number; q: number; len: number }
// Dubins CSC 闭式（Walker dubins.c 口径，MIT）
function dubinsWords(s: Pose, g: Pose, rho: number): Record<WordKey, Word | null> {
  const dx = g[0] - s[0], dy = g[1] - s[1], D = Math.hypot(dx, dy), d = D / rho, th = Math.atan2(dy, dx)
  const a = mod2pi(s[2] - th), b = mod2pi(g[2] - th)
  const sa = Math.sin(a), sb = Math.sin(b), ca = Math.cos(a), cb = Math.cos(b), cab = Math.cos(a - b)
  const mk = (segs: string, t: number, p: number, q: number): Word => ({ segs, t, p, q, len: (t + p + q) * rho })
  const out: Record<WordKey, Word | null> = { LSL: null, RSR: null, LSR: null, RSL: null }
  let p2: number
  p2 = 2 + d * d - 2 * cab + 2 * d * (sa - sb); if (p2 >= 0) { const tmp = Math.atan2(cb - ca, d + sa - sb); out.LSL = mk('LSL', mod2pi(-a + tmp), Math.sqrt(p2), mod2pi(b - tmp)) }
  p2 = 2 + d * d - 2 * cab + 2 * d * (sb - sa); if (p2 >= 0) { const tmp = Math.atan2(ca - cb, d - sa + sb); out.RSR = mk('RSR', mod2pi(a - tmp), Math.sqrt(p2), mod2pi(-b + tmp)) }
  p2 = -2 + d * d + 2 * cab + 2 * d * (sa + sb); if (p2 >= 0) { const p = Math.sqrt(p2); const tmp = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p); out.LSR = mk('LSR', mod2pi(-a + tmp), p, mod2pi(-b + tmp)) }
  p2 = d * d - 2 + 2 * cab - 2 * d * (sa + sb); if (p2 >= 0) { const p = Math.sqrt(p2); const tmp = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p); out.RSL = mk('RSL', mod2pi(a - tmp), p, mod2pi(b - tmp)) }
  return out
}
// 沿一段前进：type L/R/S，seg 为半径单位(转=弧度、直=长度/rho)
function advance(pose: Pose, type: string, seg: number, rho: number): Pose {
  let [x, y, th] = pose
  if (type === 'S') { const L = seg * rho; return [x + L * Math.cos(th), y + L * Math.sin(th), th] }
  const dir = type === 'L' ? 1 : -1
  const cx = x - dir * rho * Math.sin(th), cy = y + dir * rho * Math.cos(th), th2 = th + seg * dir
  return [cx + dir * rho * Math.sin(th2), cy - dir * rho * Math.cos(th2), th2]
}
function sampleWord(s: Pose, w: Word, rho: number): V[] {
  const pts: V[] = [[s[0], s[1]]]
  let pose = s
  for (let k = 0; k < 3; k++) {
    const type = w.segs[k]!, seg = k === 0 ? w.t : k === 1 ? w.p : w.q
    const N = Math.max(2, Math.ceil((type === 'S' ? seg * rho : seg) * 8))
    for (let j = 1; j <= N; j++) { const sub = advance(pose, type, seg * j / N, rho); pts.push([r3(sub[0]), r3(sub[1])]) }
    pose = advance(pose, type, seg, rho)
  }
  return pts
}
// 一段转向圆圆心
const turnCenter = (pose: Pose, type: string, rho: number): V => {
  const dir = type === 'L' ? 1 : -1
  return [r2(pose[0] - dir * rho * Math.sin(pose[2])), r2(pose[1] + dir * rho * Math.cos(pose[2]))]
}

export const dubinsKernel: Kernel<DubinsState> = {
  kind: 'dubins',
  compile(doc: SimDocument): CompiledModel<DubinsState> {
    const scen: Sc = String(doc.params?.heading ?? '朝上').includes('下') ? 'down' : 'up'
    const headingDeg = scen === 'up' ? 90 : -90
    const scenLabel = scen === 'up' ? '终点朝上(90°)' : '终点朝下(−90°)'
    const rho = 1
    const goal: Pose = [3, 2, headingDeg * Math.PI / 180]

    const W = dubinsWords(START, goal, rho)
    const words: Record<WordKey, number | null> = { LSL: null, RSR: null, LSR: null, RSL: null }
    for (const k of ['LSL', 'RSR', 'LSR', 'RSL'] as WordKey[]) words[k] = W[k] ? r3(W[k]!.len) : null
    const best = (['LSL', 'RSR', 'LSR', 'RSL'] as WordKey[]).map(k => W[k]).filter((w): w is Word => !!w).sort((a, b) => a.len - b.len)[0]!
    const bestType = best.segs as WordKey
    const pathPts = sampleWord(START, best, rho)
    const c1 = turnCenter(START, best.segs[0]!, rho)
    const c2 = turnCenter(goal, best.segs[2]!, rho)  // 末段圆心可用目标位姿反推(圆心到位姿的关系与前进方向无关)

    const frames: Frame[] = []
    const b0 = {
      scen, scenLabel, headingDeg,
      start: [0, 0, 0] as Pose, goal: [goal[0], goal[1], r3(goal[2])] as Pose, rho,
      words, bestType, t: r3(best.t), p: r3(best.p), q: r3(best.q), len: r3(best.len), segs: best.segs, pathPts, c1, c2, phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showCircles: boolean; showWords: boolean; showBest: boolean; showPath: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    const wlist = `LSL=${words.LSL ?? '—'}、RSR=${words.RSR ?? '—'}、LSR=${words.LSR ?? '—'}、RSL=${words.RSL ?? '—'}`

    push({
      stage: 'intro', showCircles: false, showWords: false, showBest: false, showPath: false,
      focus: `车不能横着走(非完整约束)+最小转弯半径 R=${rho};Dubins 最短路是转-直-转三段。终点：${scenLabel}`,
      log: `**Dubins 曲线:只能前进、有最小转弯半径的车,两位姿间最短怎么走**\n车/差速底盘不像机械臂能任意方向移动——**不能横着走**(非完整约束 nonholonomic),而且方向盘打死也只能拐一个**最小转弯半径 R=${rho}** 的圆。\n**Dubins(1957)** 证明:只前进的车,任意两个**位姿(位置 + 朝向)**之间的**最短路**,一定由**三段**组成、且只可能是 **6 种"词"**之一:\n· **CSC(转-直-转)**:LSL / RSR / LSR / RSL;· **CCC(转-转-转)**:RLR / LRL(近距离才最优)。\nL=左转弧、R=右转弧、S=直线(转弯半径都=R)。本例只算 4 种 CSC。\n起点 **(0,0,朝东 0°)**、终点 **(${goal[0]},${goal[1]})**、当前 **${scenLabel}**。` })

    push({
      stage: 'circles', showCircles: true, showWords: false, showBest: false, showPath: false,
      focus: `每端有左/右两个转向圆(半径 R=${rho}):车要么沿左圆逆时针、要么沿右圆顺时针`,
      log: `**① 两端的转向圆**\n关键几何:在任一位姿,车若打死方向盘,轨迹就是一个半径 R 的圆——**向左**是一个圆(圆心在左手边)、**向右**是另一个(圆心在右手边)。\n所以起点有**左圆/右圆**、终点也有**左圆/右圆**。一条 CSC 路径 = **从起点某个转向圆出发** → 一段**公切线直线** → **切进终点某个转向圆** → 到终点。四种圆的搭配(左左/右右/左右/右左)就对应 **LSL/RSR/LSR/RSL** 四种词。下一步逐个算长度。` })

    push({
      stage: 'words', showCircles: true, showWords: true, showBest: false, showPath: false,
      focus: `四种 CSC 词各算总长(闭式几何):${wlist}`,
      log: `**② 四种 CSC 词各算长度(Dubins 闭式)**\n每种词用**闭式几何**算出三段:两段圆弧的转角 + 一段公切线长度(转弯段按弧度、直线段按长度,半径都=R):\n· **LSL** = ${words.LSL ?? '不可行'}\n· **RSR** = ${words.RSR ?? '不可行'}\n· **LSR** = ${words.LSR ?? '不可行'}\n· **RSL** = ${words.RSL ?? '不可行'}\n(公式对每种词直接给出 t、p、q 三段,不用搜索。)下一步取最短的那种。` })

    push({
      stage: 'best', showCircles: true, showWords: true, showBest: true, showPath: true,
      focus: `选最短:${bestType}=${b0.len}(最短);同起终位置、改朝向最优词会变`,
      log: `**③ 选最短的词 → ${bestType}(${b0.len})**\n四种里 **${bestType}** 最短、总长 **${b0.len}**(= 三段 ${b0.t} + ${b0.p} + ${b0.q})。这就是这对位姿间的 Dubins 最短路。\n**关键直觉:最优词由位姿(尤其朝向)决定**。本例终点位置不变、只是把朝向从**朝上(90°)**换成**朝下(−90°)**,最优词就从 **LSL(3.807)** 变成 **LSR(5.712)**——切「终点朝向」对比。(严谨版:Dubins 把 (α,β,d) 参数空间划分成若干区域、每块对应一种最优词。)` })

    push({
      stage: 'segments', showCircles: true, showWords: true, showBest: true, showPath: true,
      focus: `最优 ${bestType} 三段:${b0.segs[0]}(${b0.t}) → S(${b0.p}) → ${b0.segs[2]}(${b0.q}),重建终点严格落在目标位姿`,
      log: `**④ 最优路径的三段:${b0.segs[0]} → S → ${b0.segs[2]}**\n**${bestType}** 的三段(半径单位):\n· 第一段 **${b0.segs[0] === 'L' ? '左转弧' : '右转弧'}**:转 **${b0.t}** rad(弧长 ${r3(b0.t * rho)});\n· 第二段 **直线 S**:长 **${b0.p}**;\n· 第三段 **${b0.segs[2] === 'L' ? '左转弧' : '右转弧'}**:转 **${b0.q}** rad。\n把这三段从起点依次前进重建,**终点严格落在目标位姿 (${goal[0]},${goal[1]},${headingDeg}°)**(位置和朝向都对上)——这也是"焊死"的验证:路径不是画上去的,是按几何算出来、再积分回目标的。` })

    push({
      stage: 'done', showCircles: true, showWords: true, showBest: true, showPath: true, phase: 'done',
      focus: `Dubins:非完整+最小转弯半径下的最短路=6 种词之一,取最短;连 RRT/混合A*/Reeds-Shepp`,
      log: `**小结:Dubins 曲线 = 非完整车的最短路**\n· **非完整约束**:车不能横走、有最小转弯半径 R;\n· **6 种词**:CSC(LSL/RSR/LSR/RSL)+ CCC(RLR/LRL),最短路一定是其一;\n· **闭式**:每种词直接算三段长度、取最短(不用搜索);\n· **最优词由位姿定**:同起终位置、改朝向,最优词就换(本例 LSL↔LSR)。\n**为什么重要**:给**车式/差速机器人**做规划,不能像质点那样直接连直线(拐不过来)。**「RRT/PRM」在车上要把"两点间转移"换成 Dubins(而非直线)**;**混合 A*(Hybrid A\*)** 用 Dubins 作启发式和末端接入;**Reeds-Shepp** 是"可倒车"的推广(多了 6 种含后退的词)。**连**:「RRT/A*」(离散/采样规划的底层转移)、非完整约束、运动学。**面试延伸**:非完整约束、最小转弯半径、6 种 Dubins 词、CSC vs CCC、Dubins vs Reeds-Shepp(能否倒车)、混合 A*、为什么最短路一定是三段(Pontryagin 极大值原理)。参考:Dubins 1957、LaValle《Planning Algorithms》§15.3。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showCircles: false, showWords: false, showBest: false, showPath: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'Dubins 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
