/**
 * 内核：递归牛顿-欧拉 RNEA · 逆动力学 —— 给定 q,q̇,q̈ 高效算关节力矩 τ，两次扫描 O(n)，不显式组 M/C/G（具身智能 · 刚体动力学 / 面试八股）
 * 轴：step —— 引子(逆动力学=控制) → 外向扫描(基→梢:传速度/加速度,重力当基座假加速度) → 内向扫描(梢→基:传力/力矩,投影到关节轴) → 对拍(=M q̈+C q̇+G) → 收尾。
 *
 * 平面两连杆 RR 臂(与「机械臂运动方程」同一模型,可直接对拍)。RNEA(Featherstone《Rigid Body Dynamics Algorithms》ch.5 / 《Modern Robotics》§8.3):
 *   **外向(base→tip)**：ω_i=ω_{i−1}+q̇_i、α_i=α_{i−1}+q̈_i;关节/质心线加速度 a=a_prev+α×r−ω²r 逐连杆往外传。**重力技巧**:给基座一个假加速度 **a₀=−g**(向上 g)，每根连杆自动感到自重、无需单列重力项。
 *   **内向(tip→base)**：牛顿 F_i=m_i a_ci、欧拉 N_i=I_i α_i;力/力矩 f_i=f_{i+1}+F_i、n_i=N_i+n_{i+1}+r_ci×F_i+l_i×f_{i+1} 逐连杆往里传;**τ_i=n_i 投影到关节轴**。
 * 全 O(n)、内存 O(n)、不显式组 M/C/G——**实时前馈力矩/计算力矩控制的主力**。param 重力开关演示"基座假加速度"技巧。结果与 M q̈+C q̇+G 一模一样。全现算。连「机械臂运动方程/计算力矩控制」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Grav = 'on' | 'off'
export type OutLink = { link: number; theta: number; omega: number; alpha: number; aCom: [number, number] }
export type InLink = { link: number; F: [number, number]; N: number; tau: number }
export type RneaState = {
  i: number
  step: number
  stage: 'intro' | 'outward' | 'inward' | 'verify' | 'done'
  grav: Grav
  q: [number, number]; qd: [number, number]; qdd: [number, number]
  a0: [number, number]
  out: OutLink[]
  inw: InLink[]
  tau: [number, number]
  eomTau: [number, number]      // M q̈ + C q̇ (+G) 对拍值
  showOut: boolean; showIn: boolean; showVerify: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<RneaState, 'i'>

const M1 = 1, M2 = 1, L1 = 1, LC1 = 0.5, LC2 = 0.5, I1 = 0.083, I2 = 0.083, GA = 9.81
const Q = [30, 45] as [number, number]
const QD = [1, 1] as [number, number]
const QDD = [0.5, -0.5] as [number, number]
const r2 = (x: number) => Math.round(x * 100) / 100
const d2r = (d: number) => (d * Math.PI) / 180
const cross = (r: [number, number], f: [number, number]) => r[0] * f[1] - r[1] * f[0]   // (r×f)_z

export const rneaKernel: Kernel<RneaState> = {
  kind: 'rnea',
  compile(doc: SimDocument): CompiledModel<RneaState> {
    const grav: Grav = String(doc.params?.grav ?? '含重力').includes('无') ? 'off' : 'on'
    const a0: [number, number] = grav === 'on' ? [0, GA] : [0, 0]     // 重力技巧:基座假加速度 = −g（向上）

    // 绝对角、角速度、角加速度
    const th1 = d2r(Q[0]), th2 = d2r(Q[0] + Q[1])
    const om1 = QD[0], om2 = QD[0] + QD[1]
    const al1 = QDD[0], al2 = QDD[0] + QDD[1]
    // 单位方向
    const dir = (t: number): [number, number] => [Math.cos(t), Math.sin(t)]
    const perp = (t: number): [number, number] => [-Math.sin(t), Math.cos(t)]
    // 外向:线加速度 a = a_prev + α·perp·len − ω²·dir·len
    const accAt = (aPrev: [number, number], al: number, om: number, len: number, t: number): [number, number] => {
      const p = perp(t), d = dir(t)
      return [aPrev[0] + al * p[0] * len - om * om * d[0] * len, aPrev[1] + al * p[1] * len - om * om * d[1] * len]
    }
    const aC1 = accAt(a0, al1, om1, LC1, th1)
    const aJ2 = accAt(a0, al1, om1, L1, th1)
    const aC2 = accAt(aJ2, al2, om2, LC2, th2)

    const out: OutLink[] = [
      { link: 1, theta: Q[0], omega: om1, alpha: al1, aCom: [r2(aC1[0]), r2(aC1[1])] },
      { link: 2, theta: Q[0] + Q[1], omega: om2, alpha: al2, aCom: [r2(aC2[0]), r2(aC2[1])] },
    ]

    // 内向:牛顿F=m a_c、欧拉N=I α;力/力矩往基座传
    const F1: [number, number] = [M1 * aC1[0], M1 * aC1[1]]
    const F2: [number, number] = [M2 * aC2[0], M2 * aC2[1]]
    const N1 = I1 * al1, N2 = I2 * al2
    // link2 (梢)
    const rc2 = [LC2 * Math.cos(th2), LC2 * Math.sin(th2)] as [number, number]
    const n2 = N2 + cross(rc2, F2)
    const tau2 = n2
    // link1
    const rc1 = [LC1 * Math.cos(th1), LC1 * Math.sin(th1)] as [number, number]
    const l1v = [L1 * Math.cos(th1), L1 * Math.sin(th1)] as [number, number]
    const n1 = N1 + n2 + cross(rc1, F1) + cross(l1v, F2)   // f2=F2 (tip)
    const tau1 = n1
    const tau: [number, number] = [r2(tau1), r2(tau2)]

    const inw: InLink[] = [
      { link: 2, F: [r2(F2[0]), r2(F2[1])], N: r2(N2), tau: r2(tau2) },
      { link: 1, F: [r2(F1[0]), r2(F1[1])], N: r2(N1), tau: r2(tau1) },
    ]

    // 对拍:M q̈ + C q̇ (+G)
    const alp = I1 + I2 + M1 * LC1 * LC1 + M2 * (L1 * L1 + LC2 * LC2), bet = M2 * L1 * LC2, del = I2 + M2 * LC2 * LC2
    const c2 = Math.cos(d2r(Q[1])), s2 = Math.sin(d2r(Q[1]))
    const M = [[alp + 2 * bet * c2, del + bet * c2], [del + bet * c2, del]]
    const h = bet * s2
    const Cq = [-h * (2 * QD[0] * QD[1] + QD[1] * QD[1]), h * QD[0] * QD[0]]
    const cq1 = Math.cos(th1), cq12 = Math.cos(th2)
    const Gv = grav === 'on' ? [(M1 * LC1 + M2 * L1) * GA * cq1 + M2 * LC2 * GA * cq12, M2 * LC2 * GA * cq12] : [0, 0]
    const Mqdd = [M[0]![0]! * QDD[0] + M[0]![1]! * QDD[1], M[1]![0]! * QDD[0] + M[1]![1]! * QDD[1]]
    const eomTau: [number, number] = [r2(Mqdd[0]! + Cq[0]! + Gv[0]!), r2(Mqdd[1]! + Cq[1]! + Gv[1]!)]

    const frames: Frame[] = []
    const b0 = { grav, q: Q, qd: QD, qdd: QDD, a0: [r2(a0[0]), r2(a0[1])] as [number, number], out, inw, tau, eomTau, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showOut: boolean; showIn: boolean; showVerify: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showOut: false, showIn: false, showVerify: false,
      focus: `逆动力学:给定 q,q̇,q̈ 求关节力矩 τ。RNEA 用两次扫描 O(n) 算，不显式组 M/C/G。重力：${grav === 'on' ? '含' : '无'}`,
      log: `**RNEA 递归牛顿-欧拉:逆动力学的实时主力**\n**逆动力学** = 给定"想让臂怎么动"(q,q̇,q̈)、反求"每个关节该出多大力矩"τ。这是**控制**的核心(前馈力矩、计算力矩控制都要它)。\n上一课「机械臂运动方程」是显式组 M(q)、C(q,q̇)、G(q) 再相乘——O(n²)~O(n³)、慢。**RNEA 换个算法**:沿连杆链**两次扫描**、**O(n)**、不显式组任何矩阵:\n· **外向(基→梢)**:把角速度/角加速度、线加速度一根根往外传;\n· **内向(梢→基)**:把力/力矩一根根往里传、投影到关节轴得 τ。\n本例同一条两连杆臂,q=[${Q}]°、q̇=[${QD}]、q̈=[${QDD}]。重力用一个**技巧**:给基座假加速度 a₀=−g=[${r2(a0[0])},${r2(a0[1])}]。` })

    push({
      stage: 'outward', showOut: true, showIn: false, showVerify: false,
      focus: `外向扫描(基→梢):ω_i=ω_{i−1}+q̇_i、α_i=α_{i−1}+q̈_i;线加速度 a=a_prev+α×r−ω²r 往外传`,
      log: `**① 外向扫描(base → tip):传运动**\n从基座往梢,一根根算每根连杆的角速度/角加速度、和质心线加速度:\n· ω_i = ω_{i−1} + q̇_i、α_i = α_{i−1} + q̈_i(角量直接累加);\n· 质心线加速度 **a_ci = a_{关节i} + α_i×r_ci − ω_i²·r_ci**(往外传)。\n连杆1:ω=${om1}、α=${al1}、a_c1=[${out[0]!.aCom}];连杆2:ω=${om2}、α=${al2}、a_c2=[${out[1]!.aCom}]。\n**重力技巧**:基座起始加速度设成 **a₀=−g=[0,${r2(a0[1])}]**(向上 g),于是每根连杆自动感到自重的惯性力——**不用单列重力项**。${grav === 'off' ? '(本次无重力 a₀=0,纯惯性)' : ''}` })

    push({
      stage: 'inward', showOut: true, showIn: true, showVerify: false,
      focus: `内向扫描(梢→基):牛顿 F=m a_c、欧拉 N=I α;力/力矩往里传,投影到关节轴得 τ=[${tau[0]}, ${tau[1]}]`,
      log: `**② 内向扫描(tip → base):传力,得 τ**\n从梢往基座,用牛顿-欧拉算每根连杆的合力/合力矩,再把下游传来的力/力矩加上:\n· 牛顿 **F_i = m_i·a_ci**、欧拉 **N_i = I_i·α_i**;\n· 力 f_i = f_{i+1} + F_i;力矩 n_i = N_i + n_{i+1} + r_ci×F_i + l_i×f_{i+1};\n· **关节力矩 τ_i = n_i 投影到关节轴**(平面里就是 z 分量)。\n连杆2(梢):F₂=[${inw[0]!.F}]、N₂=${inw[0]!.N} → **τ₂=${tau[1]}**;连杆1:F₁=[${inw[1]!.F}]、N₁=${inw[1]!.N},把连杆2 传来的力/力矩加上 → **τ₁=${tau[0]}**。\n**τ = [${tau[0]}, ${tau[1]}] N·m**——两次扫描搞定、全程没组过 M/C/G 矩阵。` })

    push({
      stage: 'verify', showOut: true, showIn: true, showVerify: true,
      focus: `对拍:RNEA 的 τ=[${tau[0]},${tau[1]}] 与 M q̈+C q̇${grav === 'on' ? '+G' : ''}=[${eomTau[0]},${eomTau[1]}] 完全一致`,
      log: `**③ 对拍:RNEA = 机械臂运动方程,但 O(n)**\n用上一课的显式方法算同一个 τ = M(q)q̈ + C(q,q̇)q̇ ${grav === 'on' ? '+ G(q)' : '(无重力)'} = **[${eomTau[0]}, ${eomTau[1]}]**。\nRNEA 递归结果 = **[${tau[0]}, ${tau[1]}]**——**一模一样**。\n**区别只在算法效率**:显式组 M/C/G 是 O(n²)~O(n³)、还要存矩阵;RNEA 两次扫描 O(n)、O(n) 内存、不组任何矩阵。${grav === 'on' ? `重力技巧灵不灵?——切「无重力」,τ 会正好少掉 G=[${r2((M1 * LC1 + M2 * L1) * GA * cq1 + M2 * LC2 * GA * cq12)}, ${r2(M2 * LC2 * GA * cq12)}]。` : `本次无重力:τ=M q̈+C q̇,正好比含重力少一个 G。`}` })

    push({
      stage: 'done', showOut: true, showIn: true, showVerify: true, phase: 'done',
      focus: `收尾:RNEA 两次扫描 O(n) 算逆动力学 τ;重力当基座假加速度;是计算力矩控制/CRBA/ABA 的基石`,
      log: `**小结:RNEA 是逆动力学的实时算法**\n① **两次扫描**:外向传运动(ω/α/a)、内向传力(F/N/τ),把牛顿-欧拉沿链递归组织。\n② **O(n)** 时间与内存、**不显式组 M/C/G**——这是它成为实时前馈力矩主力的原因。\n③ **重力技巧**:基座假加速度 a₀=−g,每连杆自动含自重、省掉单独重力项(一行代码)。\n④ 结果与「机械臂运动方程」M q̈+C q̇+G **完全一致**——同一套动力学、换了个高效算法。\n**连到别的课**:计算力矩控制里的 Cq̇+G 前馈就是**一次 RNEA 调用**(令 q̈=q̈_d+Kd ė+Kp e);RNEA 也是 **CRBA**(令 q̈=eⱼ、q̇=0、g=0 读出 M 的第 j 列)和 **ABA(正向动力学)**的构件。面试延伸:为何 O(n) 而显式组 M 是 O(n²);重力技巧原理;逆动力学(控制)vs 正向动力学(仿真)。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showOut: false, showIn: false, showVerify: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'RNEA 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
