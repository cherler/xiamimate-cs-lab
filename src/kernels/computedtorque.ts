/**
 * 内核：计算力矩控制 · 反馈线性化（τ = M(q)(q̈_d+Kd ė+Kp e) + C(q,q̇)q̇ + G(q)）—— 用动力学模型抵消非线性，剩下干净的线性误差动力学（具身智能 · 刚体动力学 / 面试八股）
 * 轴：step —— 引子(为何纯PID不够) → 误差 e,ė → 伺服律 v=q̈_d+Kd ė+Kp e → 组力矩 τ(按模式含 M/Cq̇/G) → 误差动力学 ë+Kd ė+Kp e=0(线性/残留) → 收尾。
 *
 * 平面两连杆 RR 臂(与「机械臂运动方程」同模型)。**计算力矩控制**(=逆动力学控制/反馈线性化):把 PD 修正过的期望加速度 v=q̈_d+Kd ė+Kp e 代进运动方程当"想要的 q̈"，
 * 算出力矩 **τ=M·v+Cq̇+G**。代回被控对象 M q̈+Cq̇+G=τ，**Cq̇+G 抵消、M 约掉**，剩下**解耦的线性误差动力学 ë+Kd ė+Kp e=0**——每个关节变成独立二阶系统、可任意配极点(Kp=ωₙ²、Kd=2ζωₙ、Kd=2√Kp 临界阻尼)。
 * param 三档:计算力矩(全模型抵消,误差动力学线性解耦)/只重力补偿(τ=Kp e+Kd ė+G,消重力留科氏耦合)/纯PID(τ=Kp e+Kd ė,啥都不消、稳态下垂)。研究对拍 τ=[21.70,3.08]、内环 v=[6,−8]。全现算。连「机械臂运动方程/RNEA/PID」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Mode = 'ctc' | 'gravcomp' | 'pid'
export type CtcState = {
  i: number
  step: number
  stage: 'intro' | 'error' | 'law' | 'torque' | 'errordyn' | 'done'
  mode: Mode
  modeLabel: string
  e: [number, number]; ed: [number, number]; qddDes: [number, number]
  Kp: number; Kd: number
  M: [[number, number], [number, number]]; Cqd: [number, number]; G: [number, number]
  innerV: [number, number]; Mv: [number, number]
  pdPart: [number, number]
  tau: [number, number]
  useM: boolean; useCor: boolean; useGrav: boolean
  linear: boolean            // 误差动力学是否解耦线性
  showErr: boolean; showLaw: boolean; showTau: boolean; showDyn: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<CtcState, 'i'>

const M1 = 1, M2 = 1, L1 = 1, LC1 = 0.5, LC2 = 0.5, I1 = 0.083, I2 = 0.083, GA = 9.81
const Q = [30, 45] as [number, number]
const QD = [1, 1] as [number, number]
const E = [0.1, -0.1] as [number, number]
const ED = [-0.2, 0.1] as [number, number]
const QDD_DES = [0, 0] as [number, number]
const KP = 100, KD = 20   // Kd=2√Kp=20 临界阻尼
const r2 = (x: number) => Math.round(x * 100) / 100
const d2r = (d: number) => (d * Math.PI) / 180

export const computedtorqueKernel: Kernel<CtcState> = {
  kind: 'computedtorque',
  compile(doc: SimDocument): CompiledModel<CtcState> {
    const raw = String(doc.params?.mode ?? '计算力矩')
    const mode: Mode = raw.includes('重力') ? 'gravcomp' : raw.includes('PID') || raw.includes('pid') ? 'pid' : 'ctc'
    const modeLabel = mode === 'ctc' ? '计算力矩(全模型抵消)' : mode === 'gravcomp' ? '只重力补偿' : '纯 PID(无前馈)'
    const useM = mode === 'ctc', useCor = mode === 'ctc', useGrav = mode === 'ctc' || mode === 'gravcomp'
    const linear = mode === 'ctc'

    const alp = I1 + I2 + M1 * LC1 * LC1 + M2 * (L1 * L1 + LC2 * LC2), bet = M2 * L1 * LC2, del = I2 + M2 * LC2 * LC2
    const c2 = Math.cos(d2r(Q[1])), s2 = Math.sin(d2r(Q[1]))
    const th1 = d2r(Q[0]), th12 = d2r(Q[0] + Q[1])
    const M: [[number, number], [number, number]] = [[alp + 2 * bet * c2, del + bet * c2], [del + bet * c2, del]]
    const h = bet * s2
    const Cqd: [number, number] = [-h * (2 * QD[0] * QD[1] + QD[1] * QD[1]), h * QD[0] * QD[0]]
    const G: [number, number] = [(M1 * LC1 + M2 * L1) * GA * Math.cos(th1) + M2 * LC2 * GA * Math.cos(th12), M2 * LC2 * GA * Math.cos(th12)]

    const innerV: [number, number] = [QDD_DES[0] + KD * ED[0] + KP * E[0], QDD_DES[1] + KD * ED[1] + KP * E[1]]
    const Mv: [number, number] = [M[0][0] * innerV[0] + M[0][1] * innerV[1], M[1][0] * innerV[0] + M[1][1] * innerV[1]]
    const pdPart: [number, number] = [KP * E[0] + KD * ED[0], KP * E[1] + KD * ED[1]]

    // 组力矩:计算力矩 τ=M·v+Cq̇+G;只重力补偿 τ=PD+G;纯PID τ=PD
    let tau: [number, number]
    if (mode === 'ctc') tau = [Mv[0] + Cqd[0] + G[0], Mv[1] + Cqd[1] + G[1]]
    else if (mode === 'gravcomp') tau = [pdPart[0] + G[0], pdPart[1] + G[1]]
    else tau = [pdPart[0], pdPart[1]]

    const Mr: [[number, number], [number, number]] = [[r2(M[0][0]), r2(M[0][1])], [r2(M[1][0]), r2(M[1][1])]]

    const frames: Frame[] = []
    const b0 = {
      mode, modeLabel, e: E, ed: ED, qddDes: QDD_DES, Kp: KP, Kd: KD, M: Mr,
      Cqd: [r2(Cqd[0]), r2(Cqd[1])] as [number, number], G: [r2(G[0]), r2(G[1])] as [number, number],
      innerV: [r2(innerV[0]), r2(innerV[1])] as [number, number], Mv: [r2(Mv[0]), r2(Mv[1])] as [number, number],
      pdPart: [r2(pdPart[0]), r2(pdPart[1])] as [number, number], tau: [r2(tau[0]), r2(tau[1])] as [number, number],
      useM, useCor, useGrav, linear, phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showErr: boolean; showLaw: boolean; showTau: boolean; showDyn: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showErr: false, showLaw: false, showTau: false, showDyn: false,
      focus: `纯 PID 用固定增益硬扛非线性(重力/惯性耦合/科氏)→高速丢精度。计算力矩用模型抵消它们。模式：${modeLabel}`,
      log: `**计算力矩控制:用模型抵消非线性,剩下线性误差**\n上一课「PID」用固定增益直接控关节,但机械臂是**非线性、强耦合**的(重力随构型变、惯性耦合、科氏∝q̇²)。固定增益的 PID 只能保守整定、高速大幅时跟踪误差长。\n**计算力矩控制(=逆动力学控制/反馈线性化)**换个思路:**用动力学模型 M/C/G 主动抵消非线性**,把非线性系统"拉直"成线性的。\nτ = **M(q)·(q̈_d + Kd ė + Kp e) + C(q,q̇)q̇ + G(q)**。当前模式 **${modeLabel}**。看它怎么把误差动力学变成 ë+Kd ė+Kp e=0。` })

    push({
      stage: 'error', showErr: true, showLaw: false, showTau: false, showDyn: false,
      focus: `跟踪误差 e=q_d−q=[${E}]、ė=q̇_d−q̇=[${ED}]；增益 Kp=${KP}、Kd=${KD}(=2√Kp 临界阻尼)`,
      log: `**① 跟踪误差**\ne = q_d − q = [${E}]（位置误差）、ė = q̇_d − q̇ = [${ED}]（速度误差）。\n增益 **Kp=${KP}、Kd=${KD}**。注意 **Kd=2√Kp=2×10=20** 正好是**临界阻尼**(ζ=1)——等会误差动力学配成临界阻尼、无超调最快收敛。` })

    push({
      stage: 'law', showErr: true, showLaw: true, showTau: false, showDyn: false,
      focus: `伺服律:把 PD 修正当"想要的加速度" v = q̈_d + Kd ė + Kp e = [${b0.innerV}]`,
      log: `**② 伺服律:PD 作用在"加速度"上**\n不像纯 PID 直接把 Kp e+Kd ė 当力矩,计算力矩先把它当成**想要的加速度** v:\n**v = q̈_d + Kd ė + Kp e** = [${QDD_DES}] + ${KD}·[${ED}] + ${KP}·[${E}] = **[${b0.innerV}]**。\n这是"外环":告诉动力学"我想让关节以 v 的加速度朝目标走"。${mode !== 'ctc' ? `(本模式是 ${modeLabel}、后面不乘 M——先看这个 PD 量:Kp e+Kd ė=[${b0.pdPart}]。)` : ''}` })

    push({
      stage: 'torque', showErr: true, showLaw: true, showTau: true, showDyn: false,
      focus: `组力矩 τ = ${useM ? 'M·v + Cq̇ + G' : useGrav ? 'Kp e+Kd ė + G' : 'Kp e+Kd ė'} = [${b0.tau}] N·m`,
      log: `**③ 组关节力矩 τ**\n${mode === 'ctc'
        ? `**计算力矩(全模型)**:τ = **M·v + Cq̇ + G** = [${b0.Mv}] + [${b0.Cqd}] + [${b0.G}] = **[${b0.tau}] N·m**。M·v 提供想要的加速度、Cq̇+G 前馈抵消科氏和重力。`
        : mode === 'gravcomp'
          ? `**只重力补偿**:τ = **(Kp e+Kd ė) + G** = [${b0.pdPart}] + [${b0.G}] = **[${b0.tau}] N·m**。只前馈掉重力 G、没有 M 和 Cq̇。`
          : `**纯 PID**:τ = **Kp e+Kd ė** = **[${b0.tau}] N·m**。什么都不前馈——重力、惯性耦合、科氏全靠反馈硬扛。`}` })

    push({
      stage: 'errordyn', showErr: true, showLaw: true, showTau: true, showDyn: true,
      focus: linear ? `代回被控对象:Cq̇+G抵消、M约掉 → 误差动力学 ë+Kd ė+Kp e=0(线性、解耦、可配极点)` : `残留非线性:${mode === 'gravcomp' ? '重力消了、惯性耦合+科氏没消' : '重力/耦合/科氏全没消、还会稳态下垂'}`,
      log: `**④ 误差动力学:抵消得干不干净,决定好不好控**\n把 τ 代回被控对象 M q̈ + Cq̇ + G = τ:\n${mode === 'ctc'
        ? `**计算力矩**:Cq̇+G 两边抵消、M 约掉 → **ë + Kd ė + Kp e = 0**。每个关节变成**独立、解耦的二阶线性系统**!可任意配极点:Kp=ωₙ²、Kd=2ζωₙ,本例 Kd=2√Kp=临界阻尼、无超调。而且**一套增益全局适用**(线性化后每个工作点都一样、无需增益调度)。`
        : mode === 'gravcomp'
          ? `**只重力补偿**:重力被前馈消掉(所以静止能定住、无稳态下垂),但 **M⁻¹ 把增益按构型缩放、科氏 Cq̇ 没消** → 误差动力学**仍非线性耦合**、高速时退化。是"够用又省"的折中(设定点调节够,轨迹跟踪差)。`
          : `**纯 PID**:重力、惯性耦合、科氏**全没抵消**,固定增益硬扛 → 误差动力学**强非线性**、必须保守整定;更糟的是**重力项让它稳态下垂**(积分才能勉强纠、但慢)。`}` })

    push({
      stage: 'done', showErr: true, showLaw: true, showTau: true, showDyn: true, phase: 'done',
      focus: `收尾:计算力矩用 M/C/G 抵消非线性→线性解耦误差动力学、一套增益全局用;重力补偿是省档;都要 RNEA`,
      log: `**小结:计算力矩控制=用模型把非线性"拉直"**\nτ = **M(q̈_d+Kd ė+Kp e) + Cq̇ + G**:M·v 给想要的加速度、**Cq̇+G 前馈抵消科氏和重力**。代回被控对象 → **ë+Kd ė+Kp e=0**、每关节独立二阶线性、可配极点、**一套增益全局适用**(无需增益调度)。\n**三档对比(切模式)**:计算力矩(全抵消、线性解耦、最好)> 只重力补偿(消重力留耦合、设定点够用)> 纯 PID(啥都不消、稳态下垂、要保守整定)。\n**连到别的课**:里面的 **Cq̇+G 前馈 = 一次 RNEA 调用**(令 q̈=q̈_d+Kd ė+Kp e);它是「PID」的模型升级版;需要**准确模型**(M/C/G),模型有误差会重新引入非线性残差(→自适应/鲁棒计算力矩、Slotine-Li)。面试延伸:为何叫"反馈线性化";为何增益能固定(线性化后全局一致);重力补偿 vs 全计算力矩的取舍;模型误差的影响。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showErr: false, showLaw: false, showTau: false, showDyn: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '计算力矩步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
