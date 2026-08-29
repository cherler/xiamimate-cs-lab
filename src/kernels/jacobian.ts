/**
 * 内核：雅可比矩阵 · 关节速度→末端速度真仿真 —— J 把关节怎么转映射成末端怎么动，det(J)=0 即奇异丢自由度（具身智能 · 机器人学基础）
 * 轴：step —— 在一个构型上求出 J（各元=末端坐标对关节角的偏导），用它把关节速度映成末端速度，再看伸直构型 det=0 的奇异
 *
 * 有了 FK/IK 求"位置",还要知道"速度":关节以什么角速度转,末端就以什么线速度动。这层关系是线性的,矩阵就是**雅可比 J**:
 *   [ẋ, ẏ]ᵀ = J · [θ̇1, θ̇2]ᵀ,  J = ∂(末端x,y)/∂(关节θ1,θ2)(把 FK 对每个关节角求偏导排成矩阵)。
 * J 有两个大用处:①正着用:给关节速度算末端速度(如上);②反着用:给期望的末端速度、用 J⁻¹ 反解关节速度——这是**速度层 IK**、
 * 机械臂沿直线走/力控/遥操作的核心。反着用要 J **可逆**,而 **det(J)=L1·L2·sin θ2**:当 θ2=0 或 180°(手臂**完全伸直/对折**)时
 * det=0 → J 奇异、两列平行 → 末端只能沿一个方向动、**瞬间丢一个自由度**(伸直了没法再往外伸),J⁻¹ 爆炸。这就是"奇异构型"。
 * 本例 L1=L2=2:构型 θ=[30°,90°] 求出 J、算末端速度、det=4 可逆;再切到 θ2=0 看 det=0 的奇异。矩阵/速度全真算。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const rad = (d: number) => (d * Math.PI) / 180
const r2 = (n: number) => Math.round(n * 1000) / 1000

type Pt = { x: number; y: number }
export type JacoState = {
  i: number
  step: number
  phase: 'intro' | 'build' | 'apply' | 'det' | 'singular' | 'done'
  op: 'intro' | 'build' | 'apply' | 'det' | 'singular' | 'summary'
  L1: number
  L2: number
  theta1: number
  theta2: number
  J: number[][]                     // 2×2 雅可比
  det: number
  singular: boolean
  dtheta: [number, number] | null   // 本步施加的关节角速度
  endVel: { vx: number; vy: number } | null
  armPts: Pt[]                      // [基座, 肘, 末端]
  which: string                     // 本步施加的关节速度的说明
  focus: string
  log: string
}
type Frame = Omit<JacoState, 'i'>

const L1 = 2, L2 = 2

// 二连杆平面臂的雅可比与臂点（解析）
const armOf = (t1: number, t2: number): Pt[] => {
  const elbow = { x: r2(L1 * Math.cos(rad(t1))), y: r2(L1 * Math.sin(rad(t1))) }
  const end = { x: r2(elbow.x + L2 * Math.cos(rad(t1 + t2))), y: r2(elbow.y + L2 * Math.sin(rad(t1 + t2))) }
  return [{ x: 0, y: 0 }, elbow, end]
}
const jacOf = (t1: number, t2: number): number[][] => {
  const s1 = Math.sin(rad(t1)), c1 = Math.cos(rad(t1)), s12 = Math.sin(rad(t1 + t2)), c12 = Math.cos(rad(t1 + t2))
  return [[r2(-L1 * s1 - L2 * s12), r2(-L2 * s12)], [r2(L1 * c1 + L2 * c12), r2(L2 * c12)]]
}
const apply = (J: number[][], d: [number, number]) => ({ vx: r2(J[0][0]! * d[0] + J[0][1]! * d[1]), vy: r2(J[1][0]! * d[0] + J[1][1]! * d[1]) })

export const jacobianKernel: Kernel<JacoState> = {
  kind: 'jacobian',
  compile(_doc: SimDocument): CompiledModel<JacoState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'L1' | 'L2'>) => frames.push({ step: frames.length, L1, L2, ...f })

    const T1 = 30, T2 = 90
    const J = jacOf(T1, T2)
    const det = r2(J[0][0]! * J[1][1]! - J[0][1]! * J[1][0]!)
    const arm = armOf(T1, T2)

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', theta1: T1, theta2: T2, J, det, singular: false, dtheta: null, endVel: null, armPts: arm,
      which: '', focus: '雅可比 J：关节速度 → 末端速度的线性映射；det(J)=0 即奇异',
      log: `**雅可比矩阵：速度怎么传**\nFK/IK 求"位置"，雅可比求"速度"：关节以什么角速度转，末端就以什么线速度动——这层关系是线性的，矩阵就是 **J**：\n\`[ẋ ẏ]ᵀ = J · [θ̇1 θ̇2]ᵀ\`，J = 末端(x,y) 对关节(θ1,θ2) 的偏导。\n本例 L1=L2=${L1}、构型 θ=[${T1}°,${T2}°]，先求 J，再用它算末端速度，最后看奇异。`,
    })

    // —— 求 J ——
    push({
      phase: 'build', op: 'build', theta1: T1, theta2: T2, J, det, singular: false, dtheta: null, endVel: null, armPts: arm,
      which: '', focus: `求 J：对每个关节角求偏导 → [[${J[0][0]}, ${J[0][1]}], [${J[1][0]}, ${J[1][1]}]]`,
      log: `**求雅可比 J（在 θ=[${T1}°,${T2}°] 处）**\n把 FK 的 x、y 分别对 θ1、θ2 求偏导，排成 2×2：\n· ∂x/∂θ1 = −L1 sinθ1 − L2 sin(θ1+θ2) = **${J[0][0]}**；∂x/∂θ2 = −L2 sin(θ1+θ2) = **${J[0][1]}**\n· ∂y/∂θ1 = L1 cosθ1 + L2 cos(θ1+θ2) = **${J[1][0]}**；∂y/∂θ2 = L2 cos(θ1+θ2) = **${J[1][1]}**\nJ = [[${J[0][0]}, ${J[0][1]}], [${J[1][0]}, ${J[1][1]}]]。每一列 = "只转这个关节时末端往哪动"。`,
    })

    // —— 正着用：关节速度 → 末端速度（两种输入）——
    const d1: [number, number] = [1, 0], v1 = apply(J, d1)
    push({
      phase: 'apply', op: 'apply', theta1: T1, theta2: T2, J, det, singular: false, dtheta: d1, endVel: v1, armPts: arm,
      which: '只转关节1（θ̇=[1, 0]）', focus: `θ̇=[1,0] → 末端速度 = (${v1.vx}, ${v1.vy})`,
      log: `**正着用：给关节速度算末端速度**\n只转关节1：θ̇ = [1, 0]（rad/s）。\nẋ = J·θ̇ = [${J[0][0]}·1 + ${J[0][1]}·0, ${J[1][0]}·1 + ${J[1][1]}·0] = **(${v1.vx}, ${v1.vy})**。\n就是 J 的第 1 列——末端此刻朝这个方向动（图上的箭头）。`,
    })
    const d2: [number, number] = [0, 1], v2 = apply(J, d2)
    push({
      phase: 'apply', op: 'apply', theta1: T1, theta2: T2, J, det, singular: false, dtheta: d2, endVel: v2, armPts: arm,
      which: '只转关节2（θ̇=[0, 1]）', focus: `θ̇=[0,1] → 末端速度 = (${v2.vx}, ${v2.vy})`,
      log: `**换一个输入**\n只转关节2：θ̇ = [0, 1]。末端速度 = J 的第 2 列 = **(${v2.vx}, ${v2.vy})**。\n任意关节速度的末端速度 = 两列的线性组合。`,
    })

    // —— det & 可逆 ——
    push({
      phase: 'det', op: 'det', theta1: T1, theta2: T2, J, det, singular: false, dtheta: null, endVel: null, armPts: arm,
      which: '', focus: `det(J) = L1·L2·sinθ2 = ${det} ≠ 0 → 可逆，能反解关节速度`,
      log: `**det(J) 判可逆**\ndet(J) = ${J[0][0]}·${J[1][1]} − ${J[0][1]}·${J[1][0]} = **${det}**，且恰好 = **L1·L2·sin θ2** = ${L1}·${L2}·sin${T2}° = ${det}。\ndet ≠ 0 → J **可逆** → 能**反着用**：给期望的末端速度、用 J⁻¹ 反解该让关节怎么转——这就是**速度层 IK**（机械臂沿直线走、力控、遥操作靠它）。`,
    })

    // —— 奇异构型：θ2=0 手臂伸直 ——
    const TS1 = 30, TS2 = 0
    const Js = jacOf(TS1, TS2)
    const dets = r2(Js[0][0]! * Js[1][1]! - Js[0][1]! * Js[1][0]!)
    const arms = armOf(TS1, TS2)
    const vs1 = apply(Js, [1, 0]), vs2 = apply(Js, [0, 1])
    push({
      phase: 'done', op: 'summary', theta1: TS1, theta2: TS2, J: Js, det: dets, singular: true, dtheta: [1, 0], endVel: vs1, armPts: arms,
      which: '手臂伸直 θ2=0', focus: `θ2=0 手臂伸直 → det(J)=0 奇异！末端丢一个自由度`,
      log: `**奇异构型：把 θ2 转到 0（手臂完全伸直）**\n此时 det(J) = L1·L2·sin0° = **0** → J **奇异、不可逆**。两列变得平行（都指向同一方向）：只转关节1 末端速度 (${vs1.vx}, ${vs1.vy})、只转关节2 (${vs2.vx}, ${vs2.vy})——**成比例、同一条线**。\n意味着：不管关节怎么转，末端此刻**只能沿一个方向动、丢了一个自由度**（伸直了没法再往外伸）。反着用时 J⁻¹ 爆炸（要末端沿"够不到"的方向动，需要无穷大关节速度）。\n\n**要点**：雅可比是位置(FK/IK)之上的**速度层**——正着用算末端速度、反着用(J⁻¹)做速度层 IK。**det(J)=L1L2 sinθ2**：手臂伸直(θ2=0)或对折(θ2=180°)时 det=0、奇异、丢自由度、J⁻¹ 爆炸。工程上要**绕开奇异**(路径规划避开)或用**阻尼最小二乘(DLS)**让 J⁻¹ 在奇异附近不炸。雅可比还连着静力学(力/力矩传递 τ=Jᵀf)、可操作度椭圆。这是机械臂笛卡尔控制、力控、遥操作的地基。`,
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, L1, L2, theta1: T1, theta2: T2, J, det, singular: false, dtheta: null, endVel: null, armPts: arm, which: '', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '雅可比步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
