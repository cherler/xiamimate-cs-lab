/**
 * 内核：正向运动学 FK · 连杆链真仿真 —— 关节角 → 末端位姿，沿变换链逐关节累乘（具身智能 · 机器人学基础）
 * 轴：step —— 从基座出发，一个关节一个关节地把「转过的角 + 连杆长」累加，算出每节末端的坐标，最后到末端执行器
 *
 * 正向运动学(FK)是机器人学第一课:**已知每个关节转了多少度、每根连杆多长,求末端(手爪/脚尖)在哪、朝哪。**
 * 这里的"连杆链"是通用的——机械臂是一条链,机器狗的一条腿也是一条链,平面移动底盘的转向同理。
 * 机制:从基座坐标系出发,每经过一个关节就把它的旋转叠加进"累计朝向",再沿这个朝向走一根连杆的长度:
 *   cumθ_i = θ_1+…+θ_i(累计朝向); (x_i,y_i) = (x_{i-1},y_{i-1}) + L_i·(cos cumθ_i, sin cumθ_i)。
 * 一节一节累到最后,就是末端位姿 (x,y,朝向)。这就是把一串齐次变换连乘的直觉版(平面情形)。
 * 本例三连杆 L=[2,2,1]、θ=[30°,60°,-30°],逐关节算出末端 (2.232, 3.866)、朝向 60°,每步坐标可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const rad = (d: number) => (d * Math.PI) / 180
const r2 = (n: number) => Math.round(n * 1000) / 1000

type Pt = { x: number; y: number }
export type FKState = {
  i: number
  step: number
  phase: 'intro' | 'chain' | 'done'
  op: 'intro' | 'apply' | 'summary'
  links: { theta: number; L: number }[]     // 配置：每关节角(度) + 连杆长
  revealed: number                          // 已应用的关节数
  cur: number                               // 本步的关节下标（-1）
  points: Pt[]                              // [基座, 第1节末端, …] 已算出的
  cumAngle: number                          // 当前累计朝向（度）
  endX: number
  endY: number
  endAngle: number                          // 末端朝向（done 时）
  focus: string
  log: string
}
type Frame = Omit<FKState, 'i'>

const LINKS = [
  { theta: 30, L: 2 },
  { theta: 60, L: 2 },
  { theta: -30, L: 1 },
]

export const fkKernel: Kernel<FKState> = {
  kind: 'fk',
  compile(_doc: SimDocument): CompiledModel<FKState> {
    const frames: Frame[] = []
    const snap = (a: Pt[]) => a.map(p => ({ ...p }))
    const push = (f: Omit<Frame, 'step' | 'links'>) => frames.push({ step: frames.length, links: LINKS, ...f })

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', revealed: 0, cur: -1, points: [{ x: 0, y: 0 }], cumAngle: 0, endX: 0, endY: 0, endAngle: 0,
      focus: '正向运动学：已知关节角，求末端在哪、朝哪——沿连杆链逐关节累加',
      log: `**正向运动学 FK：关节角 → 末端位姿**\n机器人学第一课：已知每个关节转了多少度、每根连杆多长，求**末端在哪、朝哪**。连杆链是通用的——机械臂一条链、机器狗一条腿也是一条链。\n机制：从基座出发，每过一个关节把它的角叠进**累计朝向 cumθ**，再沿这个朝向走一根连杆长：\n\`(xᵢ,yᵢ) = (xᵢ₋₁,yᵢ₋₁) + Lᵢ·(cos cumθᵢ, sin cumθᵢ)\`。\n本例三连杆 L=[2,2,1]、θ=[30°,60°,-30°]，一节一节算到末端。`,
    })

    // —— 逐关节应用变换 ——
    let x = 0, y = 0, cum = 0
    const points: Pt[] = [{ x: 0, y: 0 }]
    LINKS.forEach((lk, idx) => {
      cum += lk.theta
      const px = x, py = y
      x = r2(x + lk.L * Math.cos(rad(cum)))
      y = r2(y + lk.L * Math.sin(rad(cum)))
      points.push({ x, y })
      const last = idx === LINKS.length - 1
      push({
        phase: last ? 'done' : 'chain', op: last ? 'summary' : 'apply', revealed: idx + 1, cur: idx, points: snap(points),
        cumAngle: cum, endX: x, endY: y, endAngle: cum,
        focus: `关节 ${idx + 1}：θ=${lk.theta}° → 累计朝向 ${cum}°，沿它走 L=${lk.L} → 末端 (${x}, ${y})`,
        log: last
          ? `**关节 3：θ=${lk.theta}° → 末端执行器**\n累计朝向 cumθ = 30+60${lk.theta >= 0 ? '+' : ''}${lk.theta} = **${cum}°**。从上一节 (${px}, ${py}) 沿 ${cum}° 走 L=${lk.L}：\n· x = ${px} + ${lk.L}·cos ${cum}° = **${x}**\n· y = ${py} + ${lk.L}·sin ${cum}° = **${y}**\n**末端位姿 = (${x}, ${y})，朝向 ${cum}°。**\n\n**要点**：FK 就是把每个关节的"转 + 走"沿链累加——累计朝向决定这一节朝哪、连杆长决定走多远。这是齐次变换连乘 T₁T₂T₃ 在平面上的直觉版。FK 是**唯一解**（关节角定了，末端就定了）；反过来"给末端求关节角"是**逆运动学 IK**，可能多解或无解，难得多。3D 里把角换成旋转矩阵/DH 参数，思路一样。这套用在机械臂末端定位、机器狗足端落点、末端速度雅可比的地基。`
          : `**关节 ${idx + 1}：θ=${lk.theta}°**\n把这个关节的角叠进累计朝向：cumθ = ${idx === 0 ? `${lk.theta}` : `…+${lk.theta}`} = **${cum}°**。从上一节末端 (${px}, ${py}) 沿 **${cum}°** 方向走一根连杆 L=${lk.L}：\n· x = ${px} + ${lk.L}·cos ${cum}° = **${x}**\n· y = ${py} + ${lk.L}·sin ${cum}° = **${y}**\n这就是第 ${idx + 1} 节的末端。继续下一个关节。`,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, links: LINKS, revealed: 0, cur: -1, points: [{ x: 0, y: 0 }], cumAngle: 0, endX: 0, endY: 0, endAngle: 0, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '关节步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
