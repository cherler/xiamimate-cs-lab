/**
 * 内核：手眼标定 AX=XB —— 相机装在机械臂手腕上,相机相对夹爪的固定变换 X 怎么标出来(具身智能 · 机器人感知/标定 · 面试八股)
 * 轴：step —— 引子(手眼问题+AX=XB) → 两组运动对(A_i 手动、B_i 眼动) → 旋转角必须相等(θ_A=θ_B,约束/自检) → 解旋转 R_X(轴对应 n_A=R_X n_B) → 解平移 t_X(线性方程) → 收尾。
 *
 * 视觉引导抓取:相机装在夹爪上("eye-in-hand")。要用相机看到的东西指挥手,先得知道**相机相对夹爪的固定变换 X**(手眼关系)。
 * 让机器人动几下:每次**夹爪的相对运动 A**(由关节角+正运动学 FK 算)、**相机的相对运动 B**(由相机观测固定标定板算)。因为相机固连在夹爪上,必有 **A·X = X·B**(经典手眼方程)。
 *   ①**旋转先解**:R_A R_X = R_X R_B ⟹ R_A、R_B **旋转角必相等**(θ_A=θ_B、自检),且 **R_X 把 B 的转轴转到 A 的转轴**(n_A=R_X n_B);≥2 组不共线运动就定出 R_X(Tsai-Lenz)。
 *   ②**平移再解**:(R_A−I) t_X = R_X t_B − t_A,是个**线性方程**,≥2 组凑满秩解出 t_X。
 * 本例构造真值 X=绕z转90°+平移[0.1,0,0.05],用两组运动(A₁绕x90°、A₂绕y90°)生成 B=X⁻¹AX,再按上法**还原出 X**(R_X 还原=Rz(90°)、t_X 还原=[0.1,0,0.05],和真值一致)。全用矩阵现算+还原验证。连「正运动学FK(算A)/相机标定/位姿」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type M3 = number[][]
type V3 = [number, number, number]
type Sc = 'z90' | 'z45'
export type HandEyeState = {
  i: number
  step: number
  stage: 'intro' | 'motions' | 'angle' | 'rotation' | 'translation' | 'done'
  scen: Sc
  scenLabel: string
  RXtrue: M3; tXtrue: V3
  motions: { angA: number; angB: number; axA: V3; axB: V3; tA: V3; tB: V3 }[]
  RXrec: M3; tXrec: V3
  angleMatch: boolean
  rotOK: boolean; transOK: boolean
  showMotions: boolean; showAngle: boolean; showRot: boolean; showTrans: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<HandEyeState, 'i'>

const mm = (A: M3, B: M3): M3 => { const n = A.length, m = B[0]!.length, p = B.length; const C = Array.from({ length: n }, () => Array(m).fill(0)); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) for (let k = 0; k < p; k++) C[i]![j] += A[i]![k]! * B[k]![j]!; return C }
const T = (A: M3): M3 => A[0]!.map((_, j) => A.map(r => r[j]!))
const mv = (A: M3, v: V3): V3 => A.map(r => r.reduce((s, x, k) => s + x * v[k]!, 0)) as V3
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const sub = (A: M3, B: M3): M3 => A.map((r, i) => r.map((x, j) => x - B[i]![j]!))
const Rx = (t: number): M3 => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]]
const Ry = (t: number): M3 => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]]
const Rz = (t: number): M3 => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]]
const I3: M3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
const z0 = (x: number) => (Object.is(x, -0) ? 0 : x)
const r3 = (x: number) => z0(Math.round(x * 1000) / 1000)
const rM = (A: M3): M3 => A.map(r => r.map(r3))
const rV = (v: V3): V3 => v.map(r3) as V3
const det3 = (m: M3) => m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) - m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) + m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!)
function solve3(M: M3, c: V3): V3 { const d = det3(M); const col = (k: number): M3 => M.map((r, i) => r.map((x, j) => (j === k ? c[i]! : x))); return [det3(col(0)) / d, det3(col(1)) / d, det3(col(2)) / d] }
function axisAngle(R: M3): { ang: number; axis: V3 } { const ang = Math.acos(Math.max(-1, Math.min(1, (R[0]![0]! + R[1]![1]! + R[2]![2]! - 1) / 2))); let v: V3 = [R[2]![1]! - R[1]![2]!, R[0]![2]! - R[2]![0]!, R[1]![0]! - R[0]![1]!]; const n = Math.hypot(v[0], v[1], v[2]) || 1; return { ang, axis: [v[0] / n, v[1] / n, v[2] / n] } }
// 用 2 组轴对应 + 叉积补第三轴，构造 R_X（把 B 轴转到 A 轴）
function rotFromAxes(nA: [V3, V3], nB: [V3, V3]): M3 { const a3 = cross(nA[0], nA[1]), b3 = cross(nB[0], nB[1]); const A = T([nA[0], nA[1], a3]), B = T([nB[0], nB[1], b3]); return mm(A, T(B)) }
const eqM = (A: M3, B: M3) => A.every((r, i) => r.every((x, j) => Math.abs(x - B[i]![j]!) < 1e-6))
const eqV = (a: V3, b: V3) => a.every((x, i) => Math.abs(x - b[i]!) < 1e-6)

export const handeyeKernel: Kernel<HandEyeState> = {
  kind: 'handeye',
  compile(doc: SimDocument): CompiledModel<HandEyeState> {
    const scen: Sc = String(doc.params?.xrot ?? 'z90').includes('45') ? 'z45' : 'z90'
    const xAng = scen === 'z90' ? Math.PI / 2 : Math.PI / 4
    const scenLabel = scen === 'z90' ? '真值 X=绕z 90°' : '真值 X=绕z 45°'

    const RXtrue = Rz(xAng), tXtrue: V3 = [0.1, 0, 0.05]
    const inv = (R: M3) => T(R)
    // 两组夹爪运动 A（绕 x、绕 y 各 90°），生成对应相机运动 B = X^-1 A X
    const As: { RA: M3; tA: V3 }[] = [{ RA: Rx(Math.PI / 2), tA: [1, 0, 0] }, { RA: Ry(Math.PI / 2), tA: [0, 1, 0] }]
    const pairs = As.map(({ RA, tA }) => { const RB = mm(mm(inv(RXtrue), RA), RXtrue); const tB = mv(inv(RXtrue), mv(RA, tXtrue).map((x, i) => x + tA[i]! - tXtrue[i]!) as V3); return { RA, tA, RB, tB } })

    const motions = pairs.map(({ RA, tA, RB, tB }) => { const aa = axisAngle(RA), bb = axisAngle(RB); return { angA: Math.round(aa.ang * 180 / Math.PI), angB: Math.round(bb.ang * 180 / Math.PI), axA: rV(aa.axis), axB: rV(bb.axis), tA: rV(tA), tB: rV(tB) } })
    const angleMatch = motions.every(m => m.angA === m.angB)

    // 还原 R_X
    const RXrec = rotFromAxes([axisAngle(pairs[0]!.RA).axis, axisAngle(pairs[1]!.RA).axis], [axisAngle(pairs[0]!.RB).axis, axisAngle(pairs[1]!.RB).axis])
    // 还原 t_X：堆叠 (RA-I) t = RXrec tB - tA，法方程求解
    const N: M3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bvec: V3 = [0, 0, 0]
    for (const { RA, tA, tB } of pairs) { const Mrow = sub(RA, I3); const c = mv(RXrec, tB).map((x, i) => x - tA[i]!) as V3; for (let i = 0; i < 3; i++) { for (let a = 0; a < 3; a++) { bvec[a] += Mrow[i]![a]! * c[i]!; for (let b = 0; b < 3; b++) N[a]![b]! += Mrow[i]![a]! * Mrow[i]![b]! } } }
    const tXrec = solve3(N, bvec)
    const rotOK = eqM(RXrec, RXtrue), transOK = eqV(tXrec, tXtrue)

    const RXt = rM(RXtrue), RXr = rM(RXrec), tXr = rV(tXrec)

    const frames: Frame[] = []
    const b0 = { scen, scenLabel, RXtrue: RXt, tXtrue, motions, RXrec: RXr, tXrec: tXr, angleMatch, rotOK, transOK, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showMotions: boolean; showAngle: boolean; showRot: boolean; showTrans: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showMotions: false, showAngle: false, showRot: false, showTrans: false,
      focus: `手眼标定:相机装夹爪上,求相机↔夹爪固定变换 X;满足 A·X=X·B。${scenLabel}`,
      log: `**手眼标定:求"相机相对夹爪"的固定变换 X**\n视觉引导抓取里,相机常**装在机械臂手腕/夹爪上**(eye-in-hand)。要用相机看到的东西去指挥手,必须先知道**相机坐标系相对夹爪坐标系的固定变换 X**(位姿+朝向)——这就是手眼标定要解的。\n做法:让机器人**动几下**,每次记两样:\n· **A = 夹爪的相对运动**(由关节角 + 正运动学 [[fk]] 算出来);\n· **B = 相机的相对运动**(由相机**观测一块固定的标定板**、算相机自己动了多少)。\n因为相机**固连**在夹爪上、两者一起动,必然满足经典手眼方程:\n**A · X = X · B**。\n本例先构造一个**真值 X**(${scenLabel}、平移 [0.1,0,0.05])、生成 A/B,再假装不知道 X、**把它解出来**验证。` })

    push({
      stage: 'motions', showMotions: true, showAngle: false, showRot: false, showTrans: false,
      focus: `两组运动对:A₁绕x90°/A₂绕y90°(手动),对应 B_i=X⁻¹A_iX(眼动);要 ≥2 组不共线`,
      log: `**① 采两组运动对 (A_i, B_i)**\n机器人动两次,得到两组"手动 A、眼动 B":\n· **A₁**:夹爪绕 **x 轴转 90°**、平移 [1,0,0];对应 **B₁** 绕轴 [${motions[0]!.axB}] 转 ${motions[0]!.angB}°、平移 [${motions[0]!.tB}]。\n· **A₂**:夹爪绕 **y 轴转 90°**、平移 [0,1,0];对应 **B₂** 绕轴 [${motions[1]!.axB}] 转 ${motions[1]!.angB}°、平移 [${motions[1]!.tB}]。\n(B 是"相机视角下的运动",和 A 通常不一样——正因为相机装在偏了一个 X 的地方。)**至少要 2 组转轴不共线的运动**才能定出 X;实际会采十几组做最小二乘去噪。` })

    push({
      stage: 'angle', showMotions: true, showAngle: true, showRot: false, showTrans: false,
      focus: `自检:每组 A、B 旋转角必相等 θ_A=θ_B(${motions.map(m => `${m.angA}=${m.angB}`).join('、')})→ ${angleMatch ? '通过' : '不符'}`,
      log: `**② 旋转角自检:θ_A 必等于 θ_B**\n从 R_A R_X = R_X R_B 可推出:**R_A 和 R_B 是相似矩阵、旋转角必然相等**。\n· 运动1:θ_A=${motions[0]!.angA}°、θ_B=${motions[0]!.angB}° → ${motions[0]!.angA === motions[0]!.angB ? '相等 ✓' : '不等 ✗'};\n· 运动2:θ_A=${motions[1]!.angA}°、θ_B=${motions[1]!.angB}° → ${motions[1]!.angA === motions[1]!.angB ? '相等 ✓' : '不等 ✗'}。\n**这是手眼数据的硬约束、也是很好的自检**:如果某组 θ_A≠θ_B,说明这组 A、B 配错了(时间戳没对齐/标定板没看准),该剔掉。角度都对上 → 数据可用,进下一步解 R_X。` })

    push({
      stage: 'rotation', showMotions: true, showAngle: true, showRot: true, showTrans: false,
      focus: `解旋转:R_X 把 B 的转轴转到 A 的转轴(n_A=R_X n_B),两组定出 R_X;还原=真值 → ${rotOK ? '✓' : '✗'}`,
      log: `**③ 先解旋转 R_X(轴的对应)**\n同样从 R_A R_X = R_X R_B 可推:**R_X 把 B 的旋转轴转到 A 的旋转轴**,即 **n_A = R_X · n_B**。\n· 运动1:n_A₁=[${motions[0]!.axA}]、n_B₁=[${motions[0]!.axB}];\n· 运动2:n_A₂=[${motions[1]!.axA}]、n_B₂=[${motions[1]!.axB}]。\n两组不共线的轴对应(再用叉积补第三轴)就**唯一定出 R_X**(Tsai-Lenz 用的就是这个思路,多组时做最小二乘/SVD)。\n**还原的 R_X = [[${RXr[0]}],[${RXr[1]}],[${RXr[2]}]]**,和真值 [[${RXt[0]}],[${RXt[1]}],[${RXt[2]}]] **${rotOK ? '完全一致 ✓' : '不一致 ✗'}**(就是绕 z 转 ${scen === 'z90' ? 90 : 45}°)。` })

    push({
      stage: 'translation', showMotions: true, showAngle: true, showRot: true, showTrans: true,
      focus: `解平移:(R_A−I)t_X=R_X t_B−t_A 线性方程,两组凑满秩;t_X 还原=[${tXr}] → ${transOK ? '=真值✓' : '✗'}`,
      log: `**④ 再解平移 t_X(线性方程)**\n旋转定了以后,手眼方程的平移部分给出:\n**(R_A − I) · t_X = R_X · t_B − t_A**——这是关于未知 **t_X** 的**线性方程**。\n每组运动给 3 个方程,但 (R_A−I) 沿转轴方向是零(秩 2),所以**要 ≥2 组不共线运动**凑成满秩,最小二乘解出 t_X。\n**还原的 t_X = [${tXr}]**,和真值 [${tXtrue}] **${transOK ? '一致 ✓' : '不一致 ✗'}**。\n至此 X 的**旋转 + 平移都标定出来了**——之后相机看到的目标位姿,乘上 X 就能换算到夹爪坐标、指挥手去抓。` })

    push({
      stage: 'done', showMotions: true, showAngle: true, showRot: true, showTrans: true, phase: 'done',
      focus: `手眼标定 AX=XB:先解旋转(轴对应)再解平移(线性);还原 X ${rotOK && transOK ? '=真值✓' : '✗'};连 FK/相机标定`,
      log: `**小结:手眼标定 AX=XB**\n· **是什么**:求相机相对夹爪(eye-in-hand)或相机相对基座(eye-to-hand)的**固定变换 X**;\n· **数据**:机器人动几下,A=夹爪相对运动(FK 算)、B=相机相对运动(看标定板算);\n· **方程 A·X=X·B**,分两步解:\n　① **旋转**:R_A、R_B 角相等(自检)、R_X 把 n_B 转到 n_A、≥2 组不共线定出 R_X;\n　② **平移**:(R_A−I)t_X=R_X t_B−t_A 线性方程、≥2 组凑满秩解出 t_X;\n· **本例还原 X = Rz(${scen === 'z90' ? 90 : 45}°)+[0.1,0,0.05] = 真值 ${rotOK && transOK ? '✓' : '✗'}**(生成→还原闭环验证)。\n**为什么重要**:视觉引导抓取/装配全靠它——没有 X,相机看到"目标在这"却不知道手该往哪伸。**连**:「正运动学 FK」算 A、「相机标定/针孔」是 B 的前提、结果喂给位姿/抓取。**面试延伸**:eye-in-hand vs eye-to-hand、AX=XB vs AX=ZB(手眼+机器人-世界同时标)、Tsai-Lenz/Park-Martin/对偶四元数解法、θ_A=θ_B 自检、为什么要 ≥2 组不共线运动、多组最小二乘去噪。参考:Tsai & Lenz 1989、Park & Martin 1994。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showMotions: false, showAngle: false, showRot: false, showTrans: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '标定步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
