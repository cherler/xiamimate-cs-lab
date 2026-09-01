/**
 * 内核：正向动力学 · 仿真（q̈ = M⁻¹(τ − C(q,q̇)q̇ − G(q))）—— 给定关节力矩，求关节加速度；这是物理仿真每一步在做的事（具身智能 · 刚体动力学 / 面试八股）
 * 轴：step —— 引子(仿真=逆动力学的反问题) → 偏置 b=Cq̇+G(=一次 q̈=0 的 RNEA) → 质量矩阵 M 与逆(SPD→可逆、实际 Cholesky) → 解 q̈=M⁻¹(τ−b) → 半隐式欧拉积分一步 → 收尾。
 *
 * 平面两连杆 RR 臂(与「机械臂运动方程/RNEA」同模型)。**正向动力学**是逆动力学的反问题:逆动力学给运动求力矩(控制)，正向动力学**给力矩求运动(仿真)**。
 *   q̈ = **M(q)⁻¹·(τ − C(q,q̇)q̇ − G(q))**。偏置 b=Cq̇+G 用一次 RNEA(令 q̈=0)算;M 对称正定→一定可逆(实际用 Cholesky 解、不真求逆)。
 *   得 q̈ 后**半隐式欧拉**积分一步:q̇←q̇+q̈·dt、q←q+q̇·dt——这就是仿真器循环里的一步。param 力矩大小(偏小往下掉/平衡不动/发力起摆)。
 * M⁻¹/偏置/q̈/积分全现算。研究对拍:τ=[10,2]→q̈=[−3.89,9.16];round-trip(RNEA 的 τ 喂回来 q̈ 精确还原)。连「机械臂运动方程/RNEA/MPC(要仿真预测)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Tq = 'small' | 'balance' | 'push'
export type FwdState = {
  i: number
  step: number
  stage: 'intro' | 'bias' | 'massinv' | 'solve' | 'integrate' | 'done'
  tq: Tq
  tqLabel: string
  q: [number, number]; qd: [number, number]
  tau: [number, number]
  Cqd: [number, number]; G: [number, number]; bias: [number, number]
  M: [[number, number], [number, number]]; detM: number; Minv: [[number, number], [number, number]]
  qdd: [number, number]
  dt: number
  qdNext: [number, number]; qNext: [number, number]
  showBias: boolean; showMinv: boolean; showQdd: boolean; showInteg: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<FwdState, 'i'>

const M1 = 1, M2 = 1, L1 = 1, LC1 = 0.5, LC2 = 0.5, I1 = 0.083, I2 = 0.083, GA = 9.81
const Q = [30, 45] as [number, number]
const QD = [1, 1] as [number, number]
const DT = 0.01
const r2 = (x: number) => Math.round(x * 100) / 100
const r3 = (x: number) => Math.round(x * 1000) / 1000
const d2r = (d: number) => (d * Math.PI) / 180

export const fwddynKernel: Kernel<FwdState> = {
  kind: 'fwddyn',
  compile(doc: SimDocument): CompiledModel<FwdState> {
    const raw = String(doc.params?.torque ?? '偏小')
    const tq: Tq = raw.includes('平衡') ? 'balance' : raw.includes('发力') ? 'push' : 'small'
    const tqLabel = tq === 'small' ? '偏小(τ=[10,2])' : tq === 'balance' ? '平衡(τ=Cq̇+G)' : '发力(τ=[20,4])'

    const alp = I1 + I2 + M1 * LC1 * LC1 + M2 * (L1 * L1 + LC2 * LC2), bet = M2 * L1 * LC2, del = I2 + M2 * LC2 * LC2
    const c2 = Math.cos(d2r(Q[1])), s2 = Math.sin(d2r(Q[1]))
    const th1 = d2r(Q[0]), th12 = d2r(Q[0] + Q[1])
    const M: [[number, number], [number, number]] = [[alp + 2 * bet * c2, del + bet * c2], [del + bet * c2, del]]
    const h = bet * s2
    const Cqd: [number, number] = [-h * (2 * QD[0] * QD[1] + QD[1] * QD[1]), h * QD[0] * QD[0]]
    const G: [number, number] = [(M1 * LC1 + M2 * L1) * GA * Math.cos(th1) + M2 * LC2 * GA * Math.cos(th12), M2 * LC2 * GA * Math.cos(th12)]
    const bias: [number, number] = [Cqd[0] + G[0], Cqd[1] + G[1]]

    const tau: [number, number] = tq === 'small' ? [10, 2] : tq === 'push' ? [20, 4] : [r2(bias[0]), r2(bias[1])]

    const detM = M[0][0] * M[1][1] - M[0][1] * M[1][0]
    const Minv: [[number, number], [number, number]] = [[M[1][1] / detM, -M[0][1] / detM], [-M[1][0] / detM, M[0][0] / detM]]
    const rhs: [number, number] = [tau[0] - bias[0], tau[1] - bias[1]]
    const qdd: [number, number] = [Minv[0][0] * rhs[0] + Minv[0][1] * rhs[1], Minv[1][0] * rhs[0] + Minv[1][1] * rhs[1]]
    // 半隐式欧拉
    const qdNext: [number, number] = [QD[0] + qdd[0] * DT, QD[1] + qdd[1] * DT]
    const qNext: [number, number] = [Q[0] + qdNext[0] * DT * (180 / Math.PI), Q[1] + qdNext[1] * DT * (180 / Math.PI)]

    const Mr: [[number, number], [number, number]] = [[r2(M[0][0]), r2(M[0][1])], [r2(M[1][0]), r2(M[1][1])]]
    const Minvr: [[number, number], [number, number]] = [[r2(Minv[0][0]), r2(Minv[0][1])], [r2(Minv[1][0]), r2(Minv[1][1])]]

    const frames: Frame[] = []
    const b0 = {
      tq, tqLabel, q: Q, qd: QD, tau, Cqd: [r2(Cqd[0]), r2(Cqd[1])] as [number, number], G: [r2(G[0]), r2(G[1])] as [number, number], bias: [r2(bias[0]), r2(bias[1])] as [number, number],
      M: Mr, detM: r3(detM), Minv: Minvr, qdd: [r2(qdd[0]), r2(qdd[1])] as [number, number], dt: DT,
      qdNext: [r2(qdNext[0]), r2(qdNext[1])] as [number, number], qNext: [r2(qNext[0]), r2(qNext[1])] as [number, number], phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showBias: boolean; showMinv: boolean; showQdd: boolean; showInteg: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showBias: false, showMinv: false, showQdd: false, showInteg: false,
      focus: `正向动力学=仿真:给力矩 τ 求加速度 q̈,逆动力学的反问题。q̈=M⁻¹(τ−Cq̇−G)。力矩：${tqLabel}`,
      log: `**正向动力学:物理仿真每一步在做的事**\n和 RNEA(逆动力学:给运动求力矩、用于**控制**)相反,**正向动力学给力矩求运动、用于仿真**:\n**q̈ = M(q)⁻¹·(τ − C(q,q̇)q̇ − G(q))**\n就是把运动方程反解出加速度。步骤:①算偏置 b=Cq̇+G ②组质量矩阵 M 并求逆 ③解 q̈=M⁻¹(τ−b) ④积分一步得新状态。\n本例同一条两连杆臂,q=[${Q}]°、q̇=[${QD}]、施加力矩 τ=[${tau}](${tqLabel})。看它会怎么动。` })

    push({
      stage: 'bias', showBias: true, showMinv: false, showQdd: false, showInteg: false,
      focus: `偏置 b = C(q,q̇)q̇ + G(q) = [${b0.bias}]（速度+重力项，=一次 q̈=0 的 RNEA）`,
      log: `**① 偏置项 b = Cq̇ + G**\n先把与加速度无关的部分(科氏/离心 + 重力)算出来:\nC(q,q̇)q̇ = [${b0.Cqd}]、G(q) = [${b0.G}] → **b = [${b0.bias}]**。\n工程实现里,这一步正是**一次 RNEA 调用**(令 q̈=0):RNEA 给你 τ=M·0+Cq̇+G=b。所以正向动力学复用了逆动力学。` })

    push({
      stage: 'massinv', showBias: true, showMinv: true, showQdd: false, showInteg: false,
      focus: `质量矩阵 M 与逆:M 对称正定 → det=${b0.detM}≠0 一定可逆(实际用 Cholesky 解、不真求逆)`,
      log: `**② 质量矩阵 M(q) 与求逆**\nM = [[${Mr[0]}],[${Mr[1]}]]。**M 恒对称正定**(是动能度规)→ **det M=${b0.detM}≠0、一定可逆**、正向动力学良定义。\nM⁻¹ = [[${Minvr[0]}],[${Minvr[1]}]]。\n**工程注意**:实际不"显式求逆"——对 SPD 矩阵用 **Cholesky 分解解线性方程组 M q̈ = (τ−b)** 更快更稳(O(n³) 但常数小);大自由度用 **ABA(O(n))**、连 M 都不组。这里为看清楚才把 M⁻¹ 摆出来。` })

    push({
      stage: 'solve', showBias: true, showMinv: true, showQdd: true, showInteg: false,
      focus: `解 q̈ = M⁻¹·(τ − b) = [${b0.qdd}]${tq === 'balance' ? '（τ=b → q̈=0，匀速维持）' : ''}`,
      log: `**③ 解出关节加速度 q̈**\nq̈ = M⁻¹·(τ − b) = M⁻¹·([${tau}] − [${b0.bias}]) = M⁻¹·[${r2(tau[0] - bias[0])}, ${r2(tau[1] - bias[1])}] = **[${b0.qdd}] rad/s²**。\n${tq === 'balance'
        ? `**平衡**:力矩正好等于偏置 b(抵消重力+科氏)→ **q̈≈0**、关节匀速维持不加速。`
        : tq === 'small'
          ? `**力矩偏小**:不够顶住重力,关节1 加速度 q̈₁=${b0.qdd[0]}(<0、往重力方向掉)。`
          : `**发力**:力矩大于偏置,关节加速起摆 q̈=[${b0.qdd}]。`}\n(round-trip 验证:把 RNEA 对某个 q̈ 算出的 τ 喂回这里,会精确还原那个 q̈——正/逆动力学互逆。)` })

    push({
      stage: 'integrate', showBias: true, showMinv: true, showQdd: true, showInteg: true,
      focus: `半隐式欧拉积分一步:q̇←q̇+q̈·dt=[${b0.qdNext}]、q←q+q̇·dt——这就是仿真循环一步`,
      log: `**④ 积分一步:得到下一时刻状态(仿真循环)**\n有了 q̈,用 **半隐式欧拉**(dt=${DT}s)推进一步:\n· q̇ ← q̇ + q̈·dt = [${QD}] + [${b0.qdd}]×${DT} = **[${b0.qdNext}]**(先更新速度);\n· q ← q + q̇_new·dt = **[${b0.qNext}]°**(用新速度更新位置——这就是"半隐式"、比显式欧拉稳)。\n**这一步 = 物理仿真器(MuJoCo/Bullet)循环里的一次迭代**:读力矩→正向动力学求 q̈→积分→下一帧。反复跑就是一段仿真。积分器选择(半隐式欧拉/RK4)决定能量漂移,与动力学公式是两回事。` })

    push({
      stage: 'done', showBias: true, showMinv: true, showQdd: true, showInteg: true, phase: 'done',
      focus: `收尾:正向动力学 q̈=M⁻¹(τ−Cq̇−G) 是仿真;M SPD 用 Cholesky/ABA;逆动力学是控制。二者互逆`,
      log: `**小结:正向动力学 = 仿真的心脏**\n**q̈ = M(q)⁻¹·(τ − C(q,q̇)q̇ − G(q))**,四步:①偏置 b=Cq̇+G(一次 RNEA) ②M 对称正定→可逆(Cholesky 解、不真求逆;大自由度用 ABA O(n)) ③解 q̈ ④半隐式欧拉积分一步。\n**正向 vs 逆动力学**:正向给力矩求运动=**仿真**;逆(RNEA)给运动求力矩=**控制**。二者**互逆**(round-trip 精确还原)。\n**连到别的课**:物理仿真器(MuJoCo/Bullet/Drake)核心就是这个循环;**MPC** 要靠它在内部"预测未来"若干步;**RL** 训练在仿真里跑的也是它。面试延伸:M 为何一定可逆;为何用 Cholesky 不显式求逆;ABA O(n) vs 组 M O(n³);积分器与动力学公式的分工。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showBias: false, showMinv: false, showQdd: false, showInteg: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '正向动力学步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
