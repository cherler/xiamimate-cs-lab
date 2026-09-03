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
    const T1 = 30

    //  雅可比不是"一步步算"的仿真——它是个函数：构型 → J/det。真正在**变**的是关节角 θ2。
    //  轴换成"θ2 从 90° 扫到 0°(手臂由弯到伸直)":按播放看 det(J)=L1·L2·sinθ2 一路缩到 0——
    //  到伸直(θ2=0)时 det=0、J 奇异、两列平行、末端丢一个自由度、J⁻¹ 爆炸。这才是"一个状态在变化"。
    const T2_SWEEP = [90, 60, 45, 30, 15, 5, 0]

    const at = (T2: number): Frame => {
      const J = jacOf(T1, T2)
      const det = r2(J[0][0]! * J[1][1]! - J[0][1]! * J[1][0]!)
      const singular = Math.abs(det) < 0.05
      const arm = armOf(T1, T2)
      const dth: [number, number] = [0, 1]           // 只转关节2,看末端速度(J 第 2 列)
      const ev = apply(J, dth)
      return {
        step: 0, phase: 'done', op: 'summary', L1, L2, theta1: T1, theta2: T2, J, det, singular,
        dtheta: dth, endVel: ev, armPts: arm, which: '只转关节2 θ̇=[0,1]',
        focus: singular ? `θ2=${T2}° 手臂伸直 → det(J)=0 奇异,末端丢一个自由度` : `θ2=${T2}°：det(J)=L1L2sinθ2=${det}${det < 1 ? ',已接近奇异' : ',可逆'}`,
        log: singular
          ? `**θ2=${T2}°：手臂完全伸直**\ndet(J) = L1·L2·sin${T2}° = **0** → J **奇异、不可逆**：两列平行、末端只能沿一个方向动、**丢了一个自由度**（伸直了没法再往外伸），反解时 J⁻¹ 爆炸。工程上绕开奇异或用阻尼最小二乘(DLS)。`
          : `**θ2=${T2}°**\nJ=[[${J[0][0]}, ${J[0][1]}], [${J[1][0]}, ${J[1][1]}]]，det(J)=${J[0][0]}·${J[1][1]}−${J[0][1]}·${J[1][0]}=**${det}**（=L1·L2·sin${T2}°）。det≠0 → **可逆**，能反着用 J⁻¹ 做速度层 IK。θ2 越靠近 0/180°、det 越小、越接近奇异。`,
      }
    }

    const frames: Frame[] = T2_SWEEP.map(at)

    return {
      axis: { kind: 'step', label: '关节角 θ2' },
      initial: () => ({ ...at(90), i: -1, log: '按 ▶ 把 θ2 从 90° 扫到 0°(手臂由弯到伸直)：看 det(J)=L1·L2·sinθ2 一路缩到 0——伸直即奇异,末端丢一个自由度、J⁻¹ 爆炸。雅可比是 FK/IK(位置)之上的速度层。' }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
