/**
 * 内核：刚体动力学 · 机械臂运动方程（拉格朗日 M(q)q̈ + C(q,q̇)q̇ + G(q) = τ）—— 机械臂不是几个独立电机，各关节被惯性/科氏/重力强耦合（具身智能 · 刚体动力学 / 面试八股）
 * 轴：step —— 引子(强耦合) → 质量矩阵 M(q)(构型相关+非对角耦合) → 科氏/离心 C(q,q̇)q̇(动了才有) → 重力 G(q) → 合成 τ=Mq̈+Cq̇+G → 收尾。
 *
 * 两连杆平面 RR 臂(标准 Spong/《Modern Robotics》ch.8)。参数 α=I1+I2+m1 lc1²+m2(l1²+lc2²)、β=m2 l1 lc2、δ=I2+m2 lc2²：
 *   **M(q)** = [[α+2β cos q2, δ+β cos q2],[δ+β cos q2, δ]]——**随构型变**、**非对角≠0 就是关节耦合**(动关节1 会甩到关节2)。
 *   **C(q,q̇)q̇**(科氏+离心) = [−β sin q2 (2 q̇1 q̇2 + q̇2²), β sin q2 q̇1²]——**q̇=0 时全为 0**，只在运动时出现。
 *   **G(q)** = [(m1 lc1+m2 l1)g cos q1 + m2 lc2 g cos(q1+q2), m2 lc2 g cos(q1+q2)]——**静止举着也要力矩**。
 * τ = M q̈ + C q̇ + G。param 选运动状态:静止保持(只 G)/匀速转动(+科氏)/加速起摆(全三项)。M/C/G/τ 全现算。
 * 连：这条 τ 正是「逆动力学 RNEA」要算的；「计算力矩控制」用它抵消非线性；「正向动力学」反解 q̈=M⁻¹(τ−Cq̇−G)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Motion = 'hold' | 'spin' | 'accel'
export type DynState = {
  i: number
  step: number
  stage: 'intro' | 'mass' | 'coriolis' | 'gravity' | 'assemble' | 'done'
  motion: Motion
  motionLabel: string
  q1: number; q2: number           // 关节角(度)
  qd: [number, number]             // 关节角速度
  qdd: [number, number]            // 关节角加速度
  alpha: number; beta: number; delta: number
  M: [[number, number], [number, number]]
  Cqd: [number, number]            // C(q,q̇)·q̇
  G: [number, number]
  Mqdd: [number, number]
  tau: [number, number]
  showM: boolean; showC: boolean; showG: boolean; showTau: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<DynState, 'i'>

const M1 = 1, M2 = 1, L1 = 1, L2 = 1, LC1 = 0.5, LC2 = 0.5, I1 = 0.083, I2 = 0.083, GA = 9.81
const Q1 = 30, Q2 = 45          // 构型(度)
const r2 = (x: number) => Math.round(x * 100) / 100
const d2r = (d: number) => (d * Math.PI) / 180

export const dyneomKernel: Kernel<DynState> = {
  kind: 'dyneom',
  compile(doc: SimDocument): CompiledModel<DynState> {
    const raw = String(doc.params?.motion ?? '加速起摆')
    const motion: Motion = raw.includes('静止') ? 'hold' : raw.includes('匀速') ? 'spin' : 'accel'
    const motionLabel = motion === 'hold' ? '静止保持(q̇=q̈=0)' : motion === 'spin' ? '匀速转动(q̇≠0,q̈=0)' : '加速起摆(q̇≠0,q̈≠0)'
    const qd: [number, number] = motion === 'hold' ? [0, 0] : [1.5, 1.5]
    const qdd: [number, number] = motion === 'accel' ? [2, 1] : [0, 0]

    const alpha = I1 + I2 + M1 * LC1 * LC1 + M2 * (L1 * L1 + LC2 * LC2)
    const beta = M2 * L1 * LC2
    const delta = I2 + M2 * LC2 * LC2
    const c2 = Math.cos(d2r(Q2)), s2 = Math.sin(d2r(Q2))
    const cq1 = Math.cos(d2r(Q1)), cq12 = Math.cos(d2r(Q1 + Q2))

    const M: [[number, number], [number, number]] = [
      [r2(alpha + 2 * beta * c2), r2(delta + beta * c2)],
      [r2(delta + beta * c2), r2(delta)],
    ]
    const Cqd: [number, number] = [
      r2(-beta * s2 * (2 * qd[0] * qd[1] + qd[1] * qd[1])),
      r2(beta * s2 * qd[0] * qd[0]),
    ]
    const G: [number, number] = [
      r2((M1 * LC1 + M2 * L1) * GA * cq1 + M2 * LC2 * GA * cq12),
      r2(M2 * LC2 * GA * cq12),
    ]
    const Mqdd: [number, number] = [
      r2(M[0][0] * qdd[0] + M[0][1] * qdd[1]),
      r2(M[1][0] * qdd[0] + M[1][1] * qdd[1]),
    ]
    const tau: [number, number] = [
      r2(Mqdd[0] + Cqd[0] + G[0]),
      r2(Mqdd[1] + Cqd[1] + G[1]),
    ]

    const frames: Frame[] = []
    const b0 = { motion, motionLabel, q1: Q1, q2: Q2, qd, qdd, alpha: r2(alpha), beta: r2(beta), delta: r2(delta), M, Cqd, G, Mqdd, tau, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showM: boolean; showC: boolean; showG: boolean; showTau: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showM: false, showC: false, showG: false, showTau: false,
      focus: `机械臂不是几个独立电机——关节被惯性/科氏/重力强耦合。运动方程 M(q)q̈+C(q,q̇)q̇+G(q)=τ。运动状态：${motionLabel}`,
      log: `**机械臂运动方程：为什么关节不是独立的**\n直觉里"一个电机管一个关节"是错的：动关节1，惯性会甩动关节2；转得快，会冒出科氏/离心力；举在半空，重力一直在拽。这些都写进一条方程：\n**M(q)·q̈ + C(q,q̇)·q̇ + G(q) = τ**\n· **M(q)** 质量矩阵(构型相关、非对角=关节耦合)；· **C(q,q̇)q̇** 科氏+离心(只在运动时)；· **G(q)** 重力；· **τ** 关节力矩。\n本例两连杆平面臂(m=${M1}kg、l=${L1}m、lc=${LC1}m、I=${I1}、构型 q=[${Q1}°,${Q2}°])。当前运动状态 **${motionLabel}**、q̇=[${qd}]、q̈=[${qdd}]。逐项算给你看。` })

    push({
      stage: 'mass', showM: true, showC: false, showG: false, showTau: false,
      focus: `质量矩阵 M(q)：随构型变，非对角项 ${M[0][1]}≠0 = 关节耦合(动一个甩另一个)`,
      log: `**① 质量矩阵 M(q)**（惯性怎么把关节绑一起）\n用三个常量 α=I1+I2+m1 lc1²+m2(l1²+lc2²)=${r2(alpha)}、β=m2 l1 lc2=${r2(beta)}、δ=I2+m2 lc2²=${r2(delta)}：\nM = [[α+2β cos q2, δ+β cos q2],[δ+β cos q2, δ]] = [[${M[0][0]}, ${M[0][1]}],[${M[1][0]}, ${M[1][1]}]]。\n**两个关键**：① M **随 q2 变**(cos q2)——同一个臂、姿势不同、惯性就不同；② **非对角项 ${M[0][1]}≠0** 就是**关节耦合**:给关节1 一个加速度，会通过 M[1][0] 在关节2 上产生力矩(反之亦然)。这就是"独立电机"直觉错在哪。` })

    push({
      stage: 'coriolis', showM: true, showC: true, showG: false, showTau: false,
      focus: `科氏/离心 C(q,q̇)q̇ = [${Cqd[0]}, ${Cqd[1]}]${motion === 'hold' ? '（q̇=0 → 全为 0）' : '（只在运动时出现）'}`,
      log: `**② 科氏 + 离心项 C(q,q̇)·q̇**（动起来才有的耦合力）\nC(q,q̇)·q̇ = [−β sin q2·(2 q̇1 q̇2 + q̇2²), β sin q2·q̇1²] = [${Cqd[0]}, ${Cqd[1]}]。\n${motion === 'hold'
        ? `本例**静止 q̇=[0,0] → C·q̇=[0,0]**：不动就没有科氏/离心，这一项消失。`
        : `本例 q̇=[${qd}] → 得到 [${Cqd[0]}, ${Cqd[1]}]。它**与速度平方成正比**：转得越快越大。**离心**(q̇²项)把连杆往外甩、**科氏**(q̇1 q̇2 交叉项)是两关节同时转时的耦合力。`}\n面试点：这项**只在运动时存在**、静态标定测不到，是高速下丢精度/振动的元凶。` })

    push({
      stage: 'gravity', showM: true, showC: true, showG: true, showTau: false,
      focus: `重力 G(q) = [${G[0]}, ${G[1]}]：静止举着也要这么大力矩`,
      log: `**③ 重力项 G(q)**（举在半空的代价）\nG = [(m1 lc1+m2 l1)g cos q1 + m2 lc2 g cos(q1+q2), m2 lc2 g cos(q1+q2)] = [${G[0]}, ${G[1]}] N·m。\n**即使 q̇=q̈=0(完全静止)，关节也要输出 τ=G 才不掉下来**——关节1 要 **${G[0]} N·m** 顶住整条臂的重力。这就是为什么伺服"重力补偿"(先把 G 前馈掉)如此重要:不补，PID 就得靠积分硬扛、必然有稳态下垂。G 随构型变(cos q1)——手臂越平举、力矩越大。` })

    push({
      stage: 'assemble', showM: true, showC: true, showG: true, showTau: true,
      focus: `合成 τ = M q̈ + C q̇ + G = [${tau[0]}, ${tau[1]}] N·m（三项贡献一目了然）`,
      log: `**④ 合成关节力矩 τ = M q̈ + C q̇ + G**\n把三项加起来(逐关节)：\n· 惯性项 M·q̈ = [${Mqdd[0]}, ${Mqdd[1]}]${motion !== 'accel' ? '（q̈=0 → 为 0）' : ''}；· 科氏/离心 C·q̇ = [${Cqd[0]}, ${Cqd[1]}]；· 重力 G = [${G[0]}, ${G[1]}]。\n**τ = [${tau[0]}, ${tau[1]}] N·m**。\n${motion === 'hold' ? '静止保持:τ 全来自重力 G。' : motion === 'spin' ? '匀速转动:τ=科氏+重力(没有惯性项、因 q̈=0)。' : '加速起摆:三项都在——这才是完整的动力学。'}这条 τ 就是"要让臂按 q̈ 运动、每个关节该出多大力矩"的答案。` })

    push({
      stage: 'done', showM: true, showC: true, showG: true, showTau: true, phase: 'done',
      focus: `收尾：M q̈+C q̇+G=τ 把惯性耦合/科氏/重力写进一条方程；连逆动力学RNEA/计算力矩控制/正向动力学`,
      log: `**小结：这条方程是刚体动力学的中枢**\n**M(q)q̈ + C(q,q̇)q̇ + G(q) = τ**：\n① **M(q)** 惯性、非对角=关节耦合、随构型变；② **C(q,q̇)q̇** 科氏+离心、正比 q̇²、只在运动时；③ **G(q)** 重力、静止也要顶。\n**连到别的课**：\n· **逆动力学(RNEA)**：给定 q,q̇,q̈ 高效算这条 τ(O(n) 递归、不用显式组 M/C/G)。\n· **计算力矩控制**：τ=M(q̈_d+Kd ė+Kp e)+Cq̇+G——用这条方程**抵消非线性**，剩下线性误差动力学。\n· **正向动力学(仿真)**：反过来解 q̈=M⁻¹(τ−Cq̇−G)。\n· **重力补偿**：只前馈 G 项，是最省的一档。\n面试延伸:为何不能把机械臂当 n 个独立单关节 PID(耦合+重力+科氏);M 为何一定对称正定;科氏项为何静态测不到。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showM: false, showC: false, showG: false, showTau: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '运动方程步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
