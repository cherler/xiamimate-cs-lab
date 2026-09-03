/**
 * 内核：逆运动学 IK · 二连杆几何解真仿真 —— 给末端目标，反求关节角；可能多解/无解（具身智能 · 机器人学基础）
 * 轴：step —— 先判目标够不够得到，再用余弦定理求肘关节角(两支:肘上/肘下)，回代 FK 验证两组解都落到目标
 *
 * 逆运动学(IK)是 FK 的反问题、也是机器人干活的核心:**给末端要去的目标点,反求各关节该转几度。**
 * 和 FK(关节角→末端,唯一解)不同,IK **可能多解、无解(够不到)、或奇异**——这正是它难的地方。
 * 二连杆平面臂有漂亮的**几何闭式解**(余弦定理):
 *   · 可达性:目标距离 r=√(x²+y²) 必须落在 [|L1−L2|, L1+L2] 内,否则够不到。
 *   · 肘角:cosθ2 = (x²+y²−L1²−L2²)/(2·L1·L2),θ2 = ±acos(...) —— **正负两支 = 肘朝下/肘朝上两种姿势**。
 *   · 肩角:θ1 = atan2(y,x) − atan2(L2·sinθ2, L1+L2·cosθ2)。
 * 本例 L1=L2=2、目标 (2,2):算出两组解 (θ1=0°,θ2=90°)肘下 与 (θ1=90°,θ2=−90°)肘上,
 * 把每组解回代 FK 都精确落到 (2,2)——两种姿势够到同一点,这就是"多解"。角度/坐标全真算、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => Math.round((r * 180) / Math.PI * 100) / 100
const r2 = (n: number) => Math.round(n * 1000) / 1000

type Pt = { x: number; y: number }
type Sol = { branch: string; th1: number; th2: number; checkX: number; checkY: number; valid: boolean }
export type IKState = {
  i: number
  step: number
  phase: 'intro' | 'reach' | 'cosine' | 'solve' | 'done'
  op: 'intro' | 'reach' | 'cosine' | 'branch' | 'summary'
  L1: number
  L2: number
  target: Pt
  r: number                         // 目标到基座距离
  reachLo: number                   // |L1-L2|
  reachHi: number                   // L1+L2
  reachable: boolean
  cosTheta2: number
  solutions: Sol[]                  // 已求出的解（累积）
  curBranch: number                 // 本步展示的解下标（-1）
  armPts: Pt[] | null               // 当前解的臂：[基座, 肘, 末端]
  focus: string
  log: string
}
type Frame = Omit<IKState, 'i'>

const L1 = 2, L2 = 2

export const ikKernel: Kernel<IKState> = {
  kind: 'ik',
  compile(_doc: SimDocument): CompiledModel<IKState> {
    const reachHi = L1 + L2, reachLo = Math.abs(L1 - L2)

    //  IK 不是"一步步算"的仿真——它是个函数：末端目标 → 关节角。真正在**变**的是目标位置。
    //  轴换成"目标沿 45° 射线由近到远扫描":看两组解(肘上/肘下)怎么随距离靠拢、到最大伸展 r=L1+L2
    //  合并成一个(奇异)、再远就够不到(无解)。这才是"一个状态在发生变化"。
    const R_SWEEP = [1.0, 2.0, 2.83, 3.5, 3.9, 4.0, 4.5]

    const at = (rTarget: number): Frame => {
      const txf = rTarget / Math.SQRT2, tyf = rTarget / Math.SQRT2   // 全精度算,只在展示时四舍五入
      const tx = r2(txf), ty = r2(tyf)
      const r = r2(rTarget)
      const reachable = rTarget <= reachHi + 1e-9 && rTarget >= reachLo - 1e-9
      const c2raw = (rTarget * rTarget - L1 * L1 - L2 * L2) / (2 * L1 * L2)
      const c2 = r2(Math.max(-1, Math.min(1, c2raw)))
      const solutions: Sol[] = []
      if (reachable) {
        const mag = Math.acos(Math.max(-1, Math.min(1, c2raw)))
        const signs = mag < 0.03 ? [1] : [1, -1]        // 伸直到底:两支解合并成一个(奇异)
        for (const sign of signs) {
          const th2 = sign * mag
          const th1 = Math.atan2(tyf, txf) - Math.atan2(L2 * Math.sin(th2), L1 + L2 * Math.cos(th2))
          const checkX = r2(L1 * Math.cos(th1) + L2 * Math.cos(th1 + th2))
          const checkY = r2(L1 * Math.sin(th1) + L2 * Math.sin(th1 + th2))
          const valid = Math.abs(checkX - tx) < 0.01 && Math.abs(checkY - ty) < 0.01
          solutions.push({ branch: sign > 0 ? '肘朝下 (elbow-down)' : '肘朝上 (elbow-up)', th1: deg(th1), th2: deg(th2), checkX, checkY, valid })
        }
      }
      const n = solutions.length
      const th2mag = reachable ? deg(Math.acos(Math.max(-1, Math.min(1, c2raw)))) : 0
      return {
        step: 0, phase: 'done', op: 'summary', L1, L2, target: { x: tx, y: ty }, r, reachLo, reachHi, reachable,
        cosTheta2: c2, solutions, curBranch: -1, armPts: null,
        focus: reachable ? `目标 (${tx},${ty})、r=${r}：${n === 1 ? '奇异,两支合并' : `θ2=±${th2mag}°,两组解`}` : `目标 (${tx},${ty})、r=${r}>${reachHi}:无解`,
        log: reachable
          ? (n === 1
            ? `目标 (${tx}, ${ty})、r=**${r}=最大伸展 ${reachHi}**：cosθ2=${c2} → θ2=0，**两支解合并成一个(奇异)** —— 手臂完全伸直，瞬间丢一个自由度，J⁻¹ 会爆炸。`
            : `目标 (${tx}, ${ty})、r=${r} ∈ [${reachLo}, ${reachHi}]：cosθ2=${c2} → θ2=±${th2mag}°，**两组解**(肘朝下/肘朝上)都精确够到同一点——这就是 IK 多解。回代 FK 都落到目标 ✓。`)
          : `目标 (${tx}, ${ty})、r=**${r} > ${reachHi}**：超出可达范围 [${reachLo}, ${reachHi}]，**无解** —— 手臂伸直也够不到。这就是 IK 的"无解"。`,
      }
    }

    const frames: Frame[] = R_SWEEP.map(at)

    return {
      axis: { kind: 'step', label: '目标距离 r' },
      initial: () => ({ ...at(1.0), i: -1, log: '按 ▶ 把目标从近拉到远：看 IK 的两组解(肘上/肘下)怎么随距离靠拢，到最大伸展 r=L1+L2 合并成一个(奇异)，再远就够不到(无解)。IK 是 FK 的反问题——可能多解/无解/奇异。' }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
