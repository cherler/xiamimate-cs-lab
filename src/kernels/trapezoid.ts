/**
 * 内核：时间最优轨迹 · 梯形速度曲线 —— 路径规划出"走哪"，轨迹规划出"什么速度走"；受 v_max/a_max 约束下最快走完（具身智能 · 运动规划 / 面试八股）
 * 轴：step —— 引子(路径≠轨迹) → 加速段(t_a=v_max/a_max, d_a) → 判形(D vs 2 d_a：梯形 or 三角) → 分段(加速/匀速/减速 or 加速/减速) → 总时间 → 收尾。
 *
 * 走距离 D、约束最大速度 v_max、最大加速度 a_max,求**时间最优**的速度曲线:全程用 a_max 加速到 v_max、匀速、再用 a_max 减速到 0(bang-bang)。
 *   加速段:t_a=v_max/a_max、d_a=v_max²/(2a_max);减速段对称。**判形**:若 D ≥ 2 d_a → **梯形**(够长、能达 v_max),匀速段 d_c=D−2 d_a、t_c=d_c/v_max、总时 T=2 t_a+t_c;
 *   若 D < 2 d_a → **三角**(太短、达不到 v_max),峰值 v_peak=√(a_max·D)、总时 T=2√(D/a_max)。param 选长/短距离看两种形态。全现算。连「轨迹规划(三次多项式)/RRT(它出的路要配速度曲线)」。S 曲线(限 jerk 更平滑)在小结提。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Dist = 'long' | 'short'
export type TrapState = {
  i: number
  step: number
  stage: 'intro' | 'accel' | 'regime' | 'profile' | 'time' | 'done'
  dist: Dist
  distLabel: string
  D: number; vMax: number; aMax: number
  tA: number; dA: number
  isTrap: boolean
  vPeak: number
  dCruise: number; tCruise: number
  tTotal: number
  showAccel: boolean; showRegime: boolean; showProfile: boolean; showTime: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<TrapState, 'i'>

const V_MAX = 2, A_MAX = 1
const r2 = (x: number) => Math.round(x * 100) / 100

export const trapezoidKernel: Kernel<TrapState> = {
  kind: 'trapezoid',
  compile(doc: SimDocument): CompiledModel<TrapState> {
    const dist: Dist = String(doc.params?.distance ?? '长距离').includes('短') ? 'short' : 'long'
    const distLabel = dist === 'long' ? '长距离 D=10（梯形）' : '短距离 D=3（三角）'
    const D = dist === 'long' ? 10 : 3

    const tA = V_MAX / A_MAX
    const dA = (V_MAX * V_MAX) / (2 * A_MAX)
    const isTrap = D >= 2 * dA
    const vPeak = isTrap ? V_MAX : Math.sqrt(A_MAX * D)
    const dCruise = isTrap ? D - 2 * dA : 0
    const tCruise = isTrap ? dCruise / V_MAX : 0
    const tTotal = isTrap ? 2 * tA + tCruise : 2 * Math.sqrt(D / A_MAX)

    const frames: Frame[] = []
    const b0 = {
      dist, distLabel, D, vMax: V_MAX, aMax: A_MAX, tA: r2(tA), dA: r2(dA), isTrap, vPeak: r2(vPeak),
      dCruise: r2(dCruise), tCruise: r2(tCruise), tTotal: r2(tTotal), phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showAccel: boolean; showRegime: boolean; showProfile: boolean; showTime: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showAccel: false, showRegime: false, showProfile: false, showTime: false,
      focus: `路径规划出"走哪"、轨迹规划出"什么速度走"。梯形速度曲线=加速-匀速-减速,受 v_max/a_max 约束下最快。距离：${distLabel}`,
      log: `**梯形速度曲线:把路径变成能执行的轨迹**\n「RRT/A\*」规划出的是**几何路径**(走哪几个点),但电机执行需要**每一时刻的速度**——这就是**轨迹规划**。最经典的是**梯形速度曲线**:\n全程用最大加速度 a_max **加速**到最大速度 v_max → **匀速** → 再用 a_max **减速**到 0。这在 v_max/a_max 约束下**时间最优**(bang-bang:要么全力加速、要么全力减速)。\n本例:走距离 D=**${D}**、v_max=**${V_MAX}** m/s、a_max=**${A_MAX}** m/s²。当前 **${distLabel}**。算出它的速度曲线和总时间。` })

    push({
      stage: 'accel', showAccel: true, showRegime: false, showProfile: false, showTime: false,
      focus: `加速段:t_a=v_max/a_max=${b0.tA}s、走过 d_a=v_max²/(2a_max)=${b0.dA}m`,
      log: `**① 加速段(和对称的减速段)**\n从 0 用 a_max 加到 v_max:\n· 用时 **t_a = v_max / a_max** = ${V_MAX}/${A_MAX} = **${b0.tA}s**;\n· 走过 **d_a = ½·a_max·t_a² = v_max²/(2·a_max)** = ${V_MAX}²/(2·${A_MAX}) = **${b0.dA}m**。\n减速段完全**对称**(v_max 减到 0,也是 t_a、d_a)。所以光加减速就要走 **2·d_a = ${r2(2 * dA)}m**。够不够走完全程 D,决定曲线是梯形还是三角。` })

    push({
      stage: 'regime', showAccel: true, showRegime: true, showProfile: false, showTime: false,
      focus: `判形:D=${D} ${isTrap ? '≥' : '<'} 2·d_a=${r2(2 * dA)} → ${isTrap ? '梯形(够长、能达 v_max)' : '三角(太短、达不到 v_max)'}`,
      log: `**② 判断形态:梯形 还是 三角**\n比 D 和加减速总距离 2·d_a=**${r2(2 * dA)}**:\n**D=${D} ${isTrap ? '≥' : '<'} ${r2(2 * dA)}** → **${isTrap ? '梯形' : '三角'}**。\n${isTrap
        ? `D 够长:加速到 v_max、匀速一段、再减速——速度曲线是个**梯形**(顶是 v_max)。`
        : `D 太短:还没加到 v_max 就得开始减速了、根本达不到 v_max——速度曲线退化成**三角**。峰值 v_peak=√(a_max·D)=√(${A_MAX}·${D})=**${b0.vPeak}** m/s(< v_max ${V_MAX}、印证达不到)。`}` })

    push({
      stage: 'profile', showAccel: true, showRegime: true, showProfile: true, showTime: false,
      focus: isTrap ? `梯形分段:加速 ${b0.dA}m + 匀速 d_c=${b0.dCruise}m(t_c=${b0.tCruise}s) + 减速 ${b0.dA}m` : `三角分段:加速+减速各 ${r2(D / 2)}m,峰值 ${b0.vPeak} m/s`,
      log: `**③ 分段**\n${isTrap
        ? `**梯形**三段:\n· 加速 ${b0.dA}m(${b0.tA}s、0→v_max);\n· **匀速** d_c = D − 2·d_a = ${D}−${r2(2 * dA)} = **${b0.dCruise}m**,用时 t_c = d_c/v_max = ${b0.dCruise}/${V_MAX} = **${b0.tCruise}s**;\n· 减速 ${b0.dA}m(${b0.tA}s、v_max→0)。`
        : `**三角**两段:\n· 加速到峰值 v_peak=${b0.vPeak}(走 ${r2(D / 2)}m);\n· 减速到 0(走 ${r2(D / 2)}m)。\n每段用时 √(D/a_max)=${r2(Math.sqrt(D / A_MAX))}s。没有匀速段。`}` })

    push({
      stage: 'time', showAccel: true, showRegime: true, showProfile: true, showTime: true,
      focus: `总时间 T = ${isTrap ? `2·t_a + t_c = 2·${b0.tA}+${b0.tCruise}` : `2·√(D/a_max)`} = ${b0.tTotal}s（时间最优）`,
      log: `**④ 总时间(时间最优)**\n${isTrap
        ? `T = 2·t_a + t_c = 2·${b0.tA} + ${b0.tCruise} = **${b0.tTotal}s**。`
        : `T = 2·√(D/a_max) = 2·√(${D}/${A_MAX}) = **${b0.tTotal}s**。`}\n这就是在 v_max/a_max 约束下走完 D 的**最短时间**:任何更快都会违反加速度或速度上限。梯形速度曲线是数控/机械臂点到点运动最常用的轨迹。` })

    push({
      stage: 'done', showAccel: true, showRegime: true, showProfile: true, showTime: true, phase: 'done',
      focus: `收尾:梯形速度曲线=加速-匀速-减速(bang-bang 时间最优);短则退化三角;S 曲线限 jerk 更平滑;连轨迹规划/RRT`,
      log: `**小结:梯形速度曲线 = 受限下的时间最优**\n· **加速段** t_a=v_max/a_max、d_a=v_max²/(2a_max);· **判形** D≥2 d_a 梯形、否则三角(v_peak=√(a_max·D));· **总时间** 梯形 2 t_a+t_c、三角 2√(D/a_max)。\n· **bang-bang**:全程要么全力加速、要么全力减速(加速度取极值),所以时间最优。\n**S 曲线(进阶)**:梯形曲线的加速度是**阶跃**(突然从 0 跳到 a_max),会激起振动、冲击。**S 曲线**再限制 **jerk(加速度的变化率)**,让加速度也平滑上升——更柔、对机械更友好,代价是稍慢、更复杂。\n**连到别的课**:「轨迹规划」那课用**三次多项式**(位置平滑、起停速度为 0),是另一种插值;梯形/S 曲线是**速度受限**的时间最优版。「RRT/RRT\*/A\*」出的**几何路径**,每一段都要配一条这样的速度曲线才能真正执行。面试延伸:梯形 vs 三角判据、时间最优为何是 bang-bang、S 曲线限 jerk、和三次多项式的取舍、多轴同步(时间归一)。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showAccel: false, showRegime: false, showProfile: false, showTime: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '轨迹步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
