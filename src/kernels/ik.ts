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
const TARGET: Pt = { x: 2, y: 2 }

export const ikKernel: Kernel<IKState> = {
  kind: 'ik',
  compile(_doc: SimDocument): CompiledModel<IKState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'L1' | 'L2' | 'target' | 'reachLo' | 'reachHi'>) =>
      frames.push({ step: frames.length, L1, L2, target: TARGET, reachLo: Math.abs(L1 - L2), reachHi: L1 + L2, ...f })

    const r = r2(Math.hypot(TARGET.x, TARGET.y))
    const reachHi = L1 + L2, reachLo = Math.abs(L1 - L2)
    const reachable = r <= reachHi + 1e-9 && r >= reachLo - 1e-9
    const c2 = r2((TARGET.x * TARGET.x + TARGET.y * TARGET.y - L1 * L1 - L2 * L2) / (2 * L1 * L2))

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', r, reachable, cosTheta2: c2, solutions: [], curBranch: -1, armPts: null,
      focus: 'IK 是 FK 的反问题：给末端目标反求关节角，可能多解/无解',
      log: `**逆运动学 IK：末端目标 → 关节角**\n和 FK（关节角→末端，唯一解）相反：**给末端要去的点，反求各关节转几度**。这是机器人干活的核心，但更难——**可能多解、无解(够不到)、或奇异**。\n二连杆平面臂有几何闭式解（余弦定理）。本例 L1=L2=${L1}、目标 **(${TARGET.x}, ${TARGET.y})**，一步步反解。`,
    })

    // —— 可达性 ——
    push({
      phase: 'reach', op: 'reach', r, reachable, cosTheta2: c2, solutions: [], curBranch: -1, armPts: null,
      focus: `可达性：r=${r} 落在 [${reachLo}, ${reachHi}] 内 → ${reachable ? '够得到' : '够不到'}`,
      log: `**第一步：够得到吗？**\n目标到基座距离 r = √(${TARGET.x}²+${TARGET.y}²) = **${r}**。二连杆能到的范围是 **[|L1−L2|, L1+L2] = [${reachLo}, ${reachHi}]**（伸直到 ${reachHi}、最多缩到 ${reachLo}）。\nr=${r} 在范围内 → **够得到** ✓。（若目标是 (4.5, 0)，r=4.5 > ${reachHi} → 无解，手臂伸直也够不到——这就是 IK 的"无解"。）`,
    })

    // —— 余弦定理求肘角 ——
    push({
      phase: 'cosine', op: 'cosine', r, reachable, cosTheta2: c2, solutions: [], curBranch: -1, armPts: null,
      focus: `余弦定理：cosθ2 = ${c2} → θ2 = ±acos(${c2}) = ±90°（两支）`,
      log: `**第二步：余弦定理求肘关节 θ2**\ncosθ2 = (x²+y²−L1²−L2²)/(2·L1·L2) = (${TARGET.x * TARGET.x + TARGET.y * TARGET.y}−${L1 * L1}−${L2 * L2})/(2·${L1}·${L2}) = **${c2}**。\nθ2 = **±acos(${c2}) = ±90°** —— 注意这个 **±**：正负两支就是**两种姿势**（肘朝下 / 肘朝上），这是 IK 多解的来源。分别解出各自的肩角 θ1。`,
    })

    // —— 两支解 ——
    const solutions: Sol[] = []
    const branches: { sign: number; name: string }[] = [{ sign: 1, name: '肘朝下 (elbow-down)' }, { sign: -1, name: '肘朝上 (elbow-up)' }]
    branches.forEach((br, idx) => {
      const th2 = br.sign * Math.acos(Math.max(-1, Math.min(1, c2)))
      const th1 = Math.atan2(TARGET.y, TARGET.x) - Math.atan2(L2 * Math.sin(th2), L1 + L2 * Math.cos(th2))
      const checkX = r2(L1 * Math.cos(th1) + L2 * Math.cos(th1 + th2))
      const checkY = r2(L1 * Math.sin(th1) + L2 * Math.sin(th1 + th2))
      const valid = Math.abs(checkX - TARGET.x) < 1e-6 && Math.abs(checkY - TARGET.y) < 1e-6
      const t1 = deg(th1), t2 = deg(th2)
      const elbow: Pt = { x: r2(L1 * Math.cos(th1)), y: r2(L1 * Math.sin(th1)) }
      solutions.push({ branch: br.name, th1: t1, th2: t2, checkX, checkY, valid })
      const last = idx === branches.length - 1
      push({
        phase: last ? 'done' : 'solve', op: last ? 'summary' : 'branch', r, reachable, cosTheta2: c2,
        solutions: solutions.map(s => ({ ...s })), curBranch: idx, armPts: [{ x: 0, y: 0 }, elbow, { x: checkX, y: checkY }],
        focus: `解 ${idx + 1}（${br.name}）：θ1=${t1}°、θ2=${t2}° → 回代 FK = (${checkX}, ${checkY}) ${valid ? '✓' : '✗'}`,
        log: last
          ? `**解 2：${br.name}**\nθ2 = ${t2}°（取负支），θ1 = atan2(${TARGET.y},${TARGET.x}) − atan2(...) = **${t1}°**。肘落在 (${elbow.x}, ${elbow.y})。\n**回代 FK 验证**：末端 = (${checkX}, ${checkY}) = 目标 ✓。\n\n**两组解都对**：(θ1=${solutions[0]!.th1}°,θ2=${solutions[0]!.th2}°) 肘朝下 和 (θ1=${t1}°,θ2=${t2}°) 肘朝上，**两种姿势够到同一点 (${TARGET.x},${TARGET.y})**——这就是 IK 的"多解"。\n\n**要点**：IK vs FK——FK 唯一解、纯累加；IK 可能**多解**(肘上/肘下)、**无解**(够不到)、**奇异**(伸直时雅可比退化、瞬间失去一个自由度)。选哪组解看约束(避障、关节限位、连续性)。二连杆有闭式解；关节多了(6/7 轴)一般用**数值 IK**(雅可比迭代、阻尼最小二乘)。这套是机械臂抓取、机器狗迈步落足、遥操作的核心。回代 FK 验证是 IK 必做的一步——反解出来必须能正着走回去。`
          : `**解 1：${br.name}**\nθ2 = ${t2}°（取正支），θ1 = atan2(${TARGET.y},${TARGET.x}) − atan2(L2·sinθ2, L1+L2·cosθ2) = **${t1}°**。肘落在 (${elbow.x}, ${elbow.y})。\n**回代 FK 验证**：把这组角正着走一遍 FK，末端 = (${checkX}, ${checkY}) = 目标 ✓。再看另一支（肘朝上）。`,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, L1, L2, target: TARGET, r, reachLo, reachHi, reachable, cosTheta2: c2, solutions: [], curBranch: -1, armPts: null, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'IK 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
