/**
 * 内核：位姿与四元数 · 旋转表示真仿真 —— 轴-角→四元数→旋转矩阵→转向量，四元数相乘做组合，欧拉角万向锁（具身智能 · 机器人学基础）
 * 轴：step —— 把"绕某轴转多少度"写成单位四元数、转成旋转矩阵去转一个向量，再看四元数相乘=组合旋转，最后看欧拉角在 pitch=90° 的万向锁
 *
 * 机器人要表达"朝向"(位姿的旋转部分),有几种等价写法:**欧拉角**(roll/pitch/yaw,直观但有万向锁)、**旋转矩阵**(3×3,好算但 9 个数带约束)、
 * **四元数**(4 个数,紧凑、无奇异、好插值——机器人/图形/IMU 的首选)。核心机制:
 *   · 轴-角 → 四元数:绕单位轴 (ax,ay,az) 转 θ,则 q=(w,x,y,z)=(cos(θ/2), sin(θ/2)·轴),且始终 **|q|=1**(单位四元数)。
 *   · 四元数 → 旋转矩阵:一套固定公式把 (w,x,y,z) 展成 3×3 的 R,用 R 乘向量就把它转过去。
 *   · 组合旋转 = **四元数相乘** q1⊗q2(不可交换),比连乘矩阵更省更稳。
 *   · **万向锁**:欧拉角在 pitch=±90° 时,yaw 和 roll 绕同一根轴 → 只剩它们的差起作用、**丢一个自由度**;四元数没有这个毛病。
 * 本例绕 z 轴转 90°:q=(0.707,0,0,0.707)、R 把 (1,0,0) 转到 (0,1,0);再自乘=转 180°、把 (1,0,0) 转到 (-1,0,0);
 * 最后演示 pitch=90° 时三组不同欧拉角给出**同一个** R(万向锁)。四元数/矩阵/向量全真算、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r3 = (n: number) => Math.round(n * 1000) / 1000
const rad = (d: number) => (d * Math.PI) / 180
type Q = [number, number, number, number]
type Vec = [number, number, number]
type Mat = number[][]

const quatOf = (axis: Vec, deg: number): Q => { const h = rad(deg) / 2, s = Math.sin(h); return [r3(Math.cos(h)), r3(axis[0] * s), r3(axis[1] * s), r3(axis[2] * s)] }
const q2R = ([w, x, y, z]: Q): Mat => [
  [r3(1 - 2 * (y * y + z * z)), r3(2 * (x * y - w * z)), r3(2 * (x * z + w * y))],
  [r3(2 * (x * y + w * z)), r3(1 - 2 * (x * x + z * z)), r3(2 * (y * z - w * x))],
  [r3(2 * (x * z - w * y)), r3(2 * (y * z + w * x)), r3(1 - 2 * (x * x + y * y))],
]
const qmul = ([w1, x1, y1, z1]: Q, [w2, x2, y2, z2]: Q): Q => [
  r3(w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2),
  r3(w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2),
  r3(w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2),
  r3(w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2),
]
const apply = (R: Mat, v: Vec): Vec => [r3(R[0]![0]! * v[0] + R[0]![1]! * v[1] + R[0]![2]! * v[2]), r3(R[1]![0]! * v[0] + R[1]![1]! * v[1] + R[1]![2]! * v[2]), r3(R[2]![0]! * v[0] + R[2]![1]! * v[1] + R[2]![2]! * v[2])]
// 欧拉 ZYX → 矩阵（万向锁演示）
const Rz = (d: number): Mat => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [[c, -s, 0], [s, c, 0], [0, 0, 1]] }
const Ry = (d: number): Mat => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [[c, 0, s], [0, 1, 0], [-s, 0, c]] }
const Rx = (d: number): Mat => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [[1, 0, 0], [0, c, -s], [0, s, c]] }
const mm = (A: Mat, B: Mat): Mat => A.map((row, i) => B[0]!.map((_, j) => r3(row.reduce((a, _v, k) => a + A[i]![k]! * B[k]![j]!, 0))))
const euler = (yaw: number, pitch: number, roll: number): Mat => mm(mm(Rz(yaw), Ry(pitch)), Rx(roll))

export type QuatState = {
  i: number
  step: number
  phase: 'intro' | 'quat' | 'matrix' | 'rotate' | 'compose' | 'gimbal' | 'done'
  op: 'intro' | 'quat' | 'matrix' | 'rotate' | 'compose' | 'gimbal' | 'summary'
  axis: Vec
  angle: number
  q: Q
  qnorm: number
  R: Mat
  vecStart: Vec
  vecNow: Vec               // 当前（旋转后）向量，用于 2D 平面可视化
  angleShown: number        // 当前显示的总旋转角（度）
  eulerSets: { yaw: number; pitch: number; roll: number }[]  // gimbal 帧
  gimbalR: Mat | null
  focus: string
  log: string
}
type Frame = Omit<QuatState, 'i'>

export const quatKernel: Kernel<QuatState> = {
  kind: 'quat',
  compile(_doc: SimDocument): CompiledModel<QuatState> {
    const frames: Frame[] = []
    const AXIS: Vec = [0, 0, 1], ANG = 90, V: Vec = [1, 0, 0]
    const q = quatOf(AXIS, ANG)
    const qnorm = r3(q.reduce((a, c) => a + c * c, 0))
    const R = q2R(q)
    const rotated = apply(R, V)
    const q2 = qmul(q, q)
    const R2 = q2R(q2)
    const rotated2 = apply(R2, V)
    const GSETS = [{ yaw: 30, pitch: 90, roll: 0 }, { yaw: 60, pitch: 90, roll: 30 }, { yaw: 50, pitch: 90, roll: 20 }]
    const gR = euler(30, 90, 0)

    const push = (f: Omit<Frame, 'step' | 'axis' | 'angle'>) => frames.push({ step: frames.length, axis: AXIS, angle: ANG, ...f })

    push({
      phase: 'intro', op: 'intro', q, qnorm, R, vecStart: V, vecNow: V, angleShown: 0, eulerSets: [], gimbalR: null,
      focus: '朝向有几种等价写法：欧拉角 / 旋转矩阵 / 四元数（首选）',
      log: `**位姿与四元数：怎么表达朝向**\n机器人表达"朝向"有几种等价写法：**欧拉角**(roll/pitch/yaw，直观但有万向锁)、**旋转矩阵**(3×3，好算但冗余)、**四元数**(4 个数，紧凑、无奇异、好插值——机器人/图形/IMU 首选)。\n本例：绕 **z 轴转 ${ANG}°**，看四元数怎么表示、怎么转向量、怎么组合，最后看欧拉角的万向锁。向量 (1,0,0) 在 xy 平面上（指向右）。`,
    })

    push({
      phase: 'quat', op: 'quat', q, qnorm, R, vecStart: V, vecNow: V, angleShown: 0, eulerSets: [], gimbalR: null,
      focus: `轴-角 → 四元数：q=(cos45°, 0,0, sin45°)=(${q.join(', ')})，|q|=1`,
      log: `**轴-角 → 四元数**\n绕单位轴 (0,0,1) 转 θ=${ANG}°：\nq = (w,x,y,z) = (cos(θ/2), sin(θ/2)·轴) = (cos45°, sin45°·0, sin45°·0, sin45°·1) = **(${q.join(', ')})**。\n关键：**|q|² = ${q.map(c => `${c}²`).join('+')} = ${qnorm} = 1** —— 单位四元数。只用 4 个数就编码了一个旋转（旋转矩阵要 9 个、还带 6 个约束）。`,
    })

    push({
      phase: 'matrix', op: 'matrix', q, qnorm, R, vecStart: V, vecNow: V, angleShown: 0, eulerSets: [], gimbalR: null,
      focus: `四元数 → 旋转矩阵 R = [[${R[0]!.join(',')}],[${R[1]!.join(',')}],[${R[2]!.join(',')}]]`,
      log: `**四元数 → 旋转矩阵**\n一套固定公式把 q=(${q.join(',')}) 展成 3×3 的 R：\nR = [[${R[0]!.join(', ')}], [${R[1]!.join(', ')}], [${R[2]!.join(', ')}]]。\n这正是绕 z 转 90° 的矩阵 [[cos,-sin,0],[sin,cos,0],[0,0,1]]（cos90°=0, sin90°=1）。有了 R 就能乘向量把它转过去。`,
    })

    push({
      phase: 'rotate', op: 'rotate', q, qnorm, R, vecStart: V, vecNow: rotated, angleShown: ANG, eulerSets: [], gimbalR: null,
      focus: `R·(1,0,0) = (${rotated.join(', ')})：x 轴被转到 y 轴`,
      log: `**用 R 转向量**\nR·(1,0,0) = (${R[0]![0]}·1, ${R[1]![0]}·1, ${R[2]![0]}·1) = **(${rotated.join(', ')})**。\n指向右的 (1,0,0) 被转了 90° → 指向上的 (0,1,0)。图上箭头转过去了。用四元数直接转向量也有公式 v' = q v q⁻¹，等价于乘 R。`,
    })

    push({
      phase: 'compose', op: 'compose', q: q2, qnorm: r3(q2.reduce((a, c) => a + c * c, 0)), R: R2, vecStart: V, vecNow: rotated2, angleShown: 180, eulerSets: [], gimbalR: null,
      focus: `组合=四元数相乘：q⊗q=(${q2.join(',')})=转180°，把(1,0,0)转到(${rotated2.join(',')})`,
      log: `**组合旋转 = 四元数相乘**\n再转一次 90°（共 180°）不用连乘矩阵，直接 **q ⊗ q**（四元数乘法，注意**不可交换**）：\nq⊗q = (${q2.join(', ')}) —— 正是绕 z 转 180° 的四元数。\n转成 R₂ 再乘向量：R₂·(1,0,0) = **(${rotated2.join(', ')})**，(1,0,0) 被转到 (-1,0,0)（指向左）。四元数相乘比连乘 3×3 矩阵省算、还不会累积数值漂移（每步归一化即可）。`,
    })

    push({
      phase: 'gimbal', op: 'gimbal', q, qnorm, R, vecStart: V, vecNow: rotated2, angleShown: 180, eulerSets: GSETS, gimbalR: gR,
      focus: `万向锁：pitch=90° 时三组不同欧拉角给出同一个 R → 丢一个自由度`,
      log: `**万向锁（为什么不用欧拉角）**\n欧拉角 ZYX 在 **pitch=90°** 时出事：Rz(yaw)·Ry(90°)·Rx(roll) 里，yaw 和 roll 变成绕**同一根轴**转 → 只有它们的**差**起作用。\n下面三组**不同**的 (yaw,pitch,roll)（yaw−roll 都=30）给出**完全相同**的旋转矩阵：\n· (30,90,0)、(60,90,30)、(50,90,20) → R 都 = [[${gR[0]!.join(',')}],[${gR[1]!.join(',')}],[${gR[2]!.join(',')}]]。\n**丢了一个自由度**——本该三个独立角，现在 yaw 和 roll 锁死成一个。这就是万向锁（阿波罗飞船真栽过）。四元数/旋转矩阵**没有**这个奇异。`,
    })

    push({
      phase: 'done', op: 'summary', q, qnorm, R, vecStart: V, vecNow: rotated2, angleShown: 180, eulerSets: GSETS, gimbalR: gR,
      focus: '四元数 4 个数、无万向锁、好插值 → 机器人/IMU/图形首选',
      log: `**小结：旋转的表示**\n· **欧拉角**：3 个角，直观，但 **pitch=90° 万向锁**丢自由度、还有顺序歧义。\n· **旋转矩阵**：3×3，直接乘向量/组合，但 9 个数带 6 个正交约束、存储和数值维护贵。\n· **四元数**：4 个数、**|q|=1**、**无奇异(不锁)**、组合=相乘(省)、插值平滑(**Slerp**，做姿态过渡/动画)。代价是不直观、乘法不可交换、q 与 −q 表示同一旋转。\n机器人姿态估计(IMU 融合)、SLAM、图形引擎、无人机/机械臂控制**默认用四元数**，只在给人看时转成欧拉角。本实验的 q、R、转出来的向量、万向锁三组同 R 全部现算、可手核。配前面 FK/IK（位置）就凑齐了完整位姿（位置+朝向）。`,
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, axis: AXIS, angle: ANG, q, qnorm, R, vecStart: V, vecNow: V, angleShown: 0, eulerSets: [], gimbalR: null, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '旋转步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
