/**
 * 内核：互补滤波 · IMU 姿态估计 —— 陀螺仪(短期准、长期漂)+加速度计(绝对、但抖)各取所长，融出倾角（具身智能 · 机器人感知 / 面试八股）
 * 轴：step —— 引子(两个传感器的毛病) → 陀螺积分(短期准、bias 漂移) → 加速度算绝对倾角(不漂、但抖) → 互补融合 θ=α·陀螺+(1−α)·加速度 → 行为(α 的取舍) → 收尾。
 *
 * 一维倾角:上一时刻 θ=30°,dt=0.01s。**陀螺仪**测角速度 ω=20°/s → 积分 θ_gyro=θ_prev+ω·dt=30.2°(短期很准,但陀螺 bias 会**逐秒累积漂移**、越走越偏)。
 * **加速度计**由重力方向算**绝对倾角** θ_acc=atan2(...)=32°(不漂、有绝对参考,但**噪声大、抖**)。**互补滤波**:θ = **α·(θ_prev+ω·dt) + (1−α)·θ_acc**——
 * 相当于**高通陀螺(信它短期)+ 低通加速度(信它长期)**。α 大(≈0.98)平滑但慢慢纠漂;α 小跟加速度紧、能压漂但抖。是"定增益的简化卡尔曼"。param 选 α(偏陀螺/偏加速度/均衡)。全现算。连「卡尔曼滤波/EKF(它的完整版)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Blend = 'gyro' | 'accel' | 'even'
export type CompState = {
  i: number
  step: number
  stage: 'intro' | 'gyro' | 'accel' | 'fuse' | 'behavior' | 'done'
  blend: Blend
  blendLabel: string
  thetaPrev: number; omega: number; dt: number; thetaAcc: number
  alpha: number
  gyroPred: number
  fused: number
  driftPerSec: number      // 只用陀螺时的漂移(bias 累积)
  showGyro: boolean; showAccel: boolean; showFuse: boolean; showBehav: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<CompState, 'i'>

const THETA_PREV = 30, OMEGA = 20, DT = 0.01, THETA_ACC = 32
const BIAS = 0.5     // 陀螺 bias °/s，用于说明漂移
const r2 = (x: number) => Math.round(x * 100) / 100
const r3 = (x: number) => Math.round(x * 1000) / 1000

export const complementaryKernel: Kernel<CompState> = {
  kind: 'complementary',
  compile(doc: SimDocument): CompiledModel<CompState> {
    const raw = String(doc.params?.alpha ?? '偏信陀螺')
    const blend: Blend = raw.includes('加速度') ? 'accel' : raw.includes('均衡') ? 'even' : 'gyro'
    const blendLabel = blend === 'gyro' ? '偏信陀螺(α=0.98)' : blend === 'accel' ? '偏信加速度(α=0.90)' : '均衡(α=0.50)'
    const alpha = blend === 'gyro' ? 0.98 : blend === 'accel' ? 0.90 : 0.50

    const gyroPred = THETA_PREV + OMEGA * DT
    const fused = alpha * gyroPred + (1 - alpha) * THETA_ACC

    const frames: Frame[] = []
    const b0 = { blend, blendLabel, thetaPrev: THETA_PREV, omega: OMEGA, dt: DT, thetaAcc: THETA_ACC, alpha, gyroPred: r2(gyroPred), fused: r3(fused), driftPerSec: BIAS, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showGyro: boolean; showAccel: boolean; showFuse: boolean; showBehav: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showGyro: false, showAccel: false, showFuse: false, showBehav: false,
      focus: `IMU 融合:陀螺仪短期准但长期漂、加速度计绝对但抖。互补滤波各取所长。混合：${blendLabel}`,
      log: `**互补滤波:把陀螺和加速度计的长短板互补掉**\n机器人测姿态(倾角)有两个传感器,各有致命毛病:\n· **陀螺仪**:测角速度、积分得角度——**短期非常准、平滑**,但有 bias、**积分会累积漂移**(越走越偏、无绝对参考)。\n· **加速度计**:静止时测到重力方向、能算出**绝对倾角**——**不漂**,但**噪声大、一抖就跳**、运动时还混进线加速度。\n**互补滤波**用一个简单加权把两者互补:**θ = α·(陀螺积分) + (1−α)·(加速度绝对角)**——信陀螺的短期、信加速度的长期。\n本例 1D 倾角:上一时刻 θ=${THETA_PREV}°、dt=${DT}s。混合模式 **${blendLabel}**。` })

    push({
      stage: 'gyro', showGyro: true, showAccel: false, showFuse: false, showBehav: false,
      focus: `陀螺积分:θ_gyro=θ_prev+ω·dt=${THETA_PREV}+${OMEGA}×${DT}=${b0.gyroPred}°（短期准，但 bias 逐秒漂 ${BIAS}°）`,
      log: `**① 陀螺仪:积分角速度(短期准、长期漂)**\n陀螺测到角速度 ω=${OMEGA}°/s,积分一步:\n**θ_gyro = θ_prev + ω·dt** = ${THETA_PREV} + ${OMEGA}×${DT} = **${b0.gyroPred}°**。\n这一步**很准、很平滑**。问题在**长期**:陀螺有 bias(比如 ${BIAS}°/s),每秒会把角度**多加 ${BIAS}°**、不断累积——只用陀螺,**几十秒就漂出好几度、且回不来**(没有绝对参考)。这是它的死穴。` })

    push({
      stage: 'accel', showGyro: true, showAccel: true, showFuse: false, showBehav: false,
      focus: `加速度算绝对倾角:θ_acc=atan2(重力分量)=${THETA_ACC}°（不漂，但噪声大、抖）`,
      log: `**② 加速度计:由重力算绝对倾角(不漂、但抖)**\n静止时加速度计测到的就是**重力方向**,由它算出**绝对倾角**:θ_acc = atan2(a_y, a_z)(重力在机体系的分量) = **${THETA_ACC}°**。\n好处:它是**绝对**的、**不会漂**(重力永远指向地心、是天然参考)。坏处:**噪声大、抖动厉害**,而且机器人一动、线加速度会混进来污染读数。只用加速度计,角度**跳个不停**。\n现在两个都有:陀螺 ${b0.gyroPred}°(平滑漂)、加速度 ${THETA_ACC}°(抖不漂)。怎么合?` })

    push({
      stage: 'fuse', showGyro: true, showAccel: true, showFuse: true, showBehav: false,
      focus: `互补融合:θ=α·陀螺+(1−α)·加速度=${alpha}×${b0.gyroPred}+${r2(1 - alpha)}×${THETA_ACC}=${b0.fused}°`,
      log: `**③ 互补融合**\n**θ = α·(θ_prev+ω·dt) + (1−α)·θ_acc** = ${alpha}×${b0.gyroPred} + ${r2(1 - alpha)}×${THETA_ACC} = **${b0.fused}°**。\n直觉:\n· **α·陀螺项 = 高通**:短期主要跟陀螺(平滑、不抖);\n· **(1−α)·加速度项 = 低通**:长期用加速度把陀螺的漂移**慢慢拉回**(绝对参考锚定)。\n本例 α=${alpha}:${blend === 'gyro' ? '几乎全信陀螺、只留 2% 给加速度慢慢纠漂 → 平滑、抗抖' : blend === 'accel' ? '给加速度 10%、纠漂更快但更容易被抖动带偏' : '五五开、跟得紧但明显发抖'}。融出 **${b0.fused}°**。` })

    push({
      stage: 'behavior', showGyro: true, showAccel: true, showFuse: true, showBehav: true,
      focus: `α 的取舍:大(≈0.98)平滑抗抖但纠漂慢;小跟加速度紧、压漂快但抖。对比:只陀螺→漂;只加速度→抖`,
      log: `**④ α 怎么选——两个极端都不行**\n· **只用陀螺**(α=1):平滑,但 bias 让它**无限漂**(${BIAS}°/s、几十秒偏出去)。\n· **只用加速度**(α=0):不漂,但**抖得没法用**、运动时更乱。\n· **互补滤波(0<α<1)**:两全——**α 大(≈0.98)** 偏信陀螺、**平滑抗抖**,靠那 2% 加速度**慢慢**纠漂;**α 小** 偏信加速度、纠漂快但**跟着抖**。\n工程上常取 **α≈0.98**(采样越快、α 越接近 1)。本例 ${blendLabel} → 融角 ${b0.fused}°:${blend === 'gyro' ? '平滑、纠漂稳' : blend === 'accel' ? '纠漂快、略抖' : '发抖明显'}。` })

    push({
      stage: 'done', showGyro: true, showAccel: true, showFuse: true, showBehav: true, phase: 'done',
      focus: `收尾:互补滤波=高通陀螺+低通加速度,定增益 α;是简化卡尔曼;Madgwick/Mahony 是进阶;连卡尔曼/EKF`,
      log: `**小结:互补滤波 = 高通陀螺 + 低通加速度**\n**θ = α·(θ_prev+ω·dt) + (1−α)·θ_acc**:\n· 陀螺**短期准、长期漂** → 高通(信短期);· 加速度**绝对不漂、但抖** → 低通(信长期、纠漂)。\n· **α**(定增益)权衡:大→平滑抗抖、纠漂慢;小→纠漂快、抖。α≈0.98 常用。\n**vs 卡尔曼/EKF**:互补滤波就是一个**定增益的简化卡尔曼**(卡尔曼的增益 K 随不确定度自适应变、互补滤波把它固定成 1−α)。姿态估计的进阶:**Mahony/Madgwick**(在 3D 四元数上做同样的互补/梯度融合,还在线估陀螺 bias)、或直接上 EKF(把 bias 也放进状态)。\n**连到别的课**:是「卡尔曼滤波」的定增益简化版、机器人/无人机姿态估计的入门主力;3D 姿态要用「位姿与四元数」。面试延伸:为何陀螺漂、加速度抖;α 怎么定(和截止频率的关系);互补 vs 卡尔曼;Mahony/Madgwick;运动时加速度不可信怎么办。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showGyro: false, showAccel: false, showFuse: false, showBehav: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '互补滤波步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
