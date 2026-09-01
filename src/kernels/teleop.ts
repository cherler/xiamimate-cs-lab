/**
 * 内核：LeRobot · 主从遥操作（leader-follower teleop, SO-101）—— 人拧 leader 臂、follower 臂实时跟随；这是采集示教数据的入口（具身智能 · 项目实战 / 面试八股）
 * 轴：step —— 读 leader 原始舵机码(0~4095) → 标定成关节角 → max_relative_target 安全钳 → 写 follower 目标(伺服 PID 内环执行) → 收尾。
 *
 * SO-101 是一对**同构**机械臂(连杆尺寸一样)：leader 可反驱、人直接拧；follower 复制它的**关节角**。
 * 关键点：
 *   · **同构 → 关节空间直接复制，不用 IK**：两臂结构相同，抄关节角就复现同一末端位姿；结构不同才要重定向/IK。
 *   · **原始码→角**：舵机回报 0~4095(12位)，每个电机装配零位随机，要用 **homing_offset + 分辨率(360/4096 °/tick)** 标定成角度；范围/符号也在标定里。
 *   · **max_relative_target 安全钳**：follower 每步只允许动一小段——goal = present + clamp(Δ, −MAX, +MAX)。通信抖动/leader 跳变时防止急跳撞坏。
 *   · **环路 ~30~60Hz**：读 leader→写 follower goal，舵机内部 PID 闭环执行。
 * param「安全钳」开/关：开则抖动关节被钳、follower 平稳；关则直通、跟着急跳(危险)。全部标定/钳/跳变现算。连「FK(看末端)/PID(伺服内环)/ACT·BC(遥操作正是它们的示教数据来源)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Safety = 'on' | 'off'
export type Joint = { name: string; homing: number; leaderTick: number; present: number; leaderDeg: number; delta: number; goal: number; clamped: boolean }
export type TeleState = {
  i: number
  step: number
  stage: 'intro' | 'readraw' | 'calib' | 'safety' | 'done'
  safety: Safety
  maxRel: number
  joints: Joint[]
  showTick: boolean
  showAngle: boolean
  showGoal: boolean
  clampedN: number
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<TeleState, 'i'>

const DEG_PER_TICK = 360 / 4096          // 12 位分辨率 ≈ 0.0879°/tick
const MAX_REL = 15                       // max_relative_target，单位 度
const r2 = (x: number) => Math.round(x * 100) / 100
// 6 关节：舵机原始码 + follower 当前角；腕转(第5)是一次通信抖动、指令大跳变
const RAW: { name: string; homing: number; leaderTick: number; present: number }[] = [
  { name: '肩转 pan', homing: 2048, leaderTick: 2148, present: 8.0 },
  { name: '肩俯 lift', homing: 2048, leaderTick: 1820, present: -19.0 },
  { name: '肘 elbow', homing: 2048, leaderTick: 2560, present: 44.0 },
  { name: '腕俯 wrist_flex', homing: 2048, leaderTick: 2048, present: 0.5 },
  { name: '腕转 wrist_roll', homing: 2048, leaderTick: 3048, present: -2.0 }, // 抖动：leader 跳到 ~88°，一步要跳 ~90°
  { name: '夹爪 gripper', homing: 2048, leaderTick: 2148, present: 8.5 },
]

function buildJoints(safety: Safety): Joint[] {
  return RAW.map(j => {
    const leaderDeg = r2((j.leaderTick - j.homing) * DEG_PER_TICK)   // 标定：(码−homing)·分辨率
    const delta = r2(leaderDeg - j.present)
    const clampedDelta = safety === 'on' ? Math.max(-MAX_REL, Math.min(MAX_REL, delta)) : delta
    const goal = r2(j.present + clampedDelta)
    const clamped = safety === 'on' && Math.abs(delta) > MAX_REL
    return { name: j.name, homing: j.homing, leaderTick: j.leaderTick, present: j.present, leaderDeg, delta, goal, clamped }
  })
}

export const teleopKernel: Kernel<TeleState> = {
  kind: 'teleop',
  compile(doc: SimDocument): CompiledModel<TeleState> {
    const safety: Safety = String(doc.params?.safety ?? '开 max_relative_target').includes('关') ? 'off' : 'on'
    const joints = buildJoints(safety)
    const clampedN = joints.filter(j => j.clamped).length
    const glitch = joints[4]!

    const frames: Frame[] = []
    const b0 = { safety, maxRel: MAX_REL, joints, clampedN, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showTick: boolean; showAngle: boolean; showGoal: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showTick: false, showAngle: false, showGoal: false,
      focus: `SO-101 一对同构臂：人拧 leader、follower 跟随；因同构可直接抄关节角、不用 IK。安全钳：${safety === 'on' ? '开' : '关'}`,
      log: `**主从遥操作：采集示教数据的入口**\nSO-101 是**一对同构机械臂**(连杆尺寸完全一样)：**leader** 可反驱、人直接用手拧；**follower** 实时复制它的姿态。\n**关键洞察**：两臂结构相同 → **直接复制关节角就复现同一末端位姿，根本不用 IK**(结构不同才要重定向/IK)。\n一步做四件事：读 leader 原始舵机码 → 标定成角 → **max_relative_target 安全钳** → 写 follower 目标(舵机内部 PID 执行)。环路 ~30~60Hz。当前安全钳 = **${safety === 'on' ? '开' : '关（直通）'}**。` })

    push({
      stage: 'readraw', showTick: true, showAngle: false, showGoal: false,
      focus: `读 leader 6 个舵机的原始码(0~4095，12位)`,
      log: `**① 读 leader 原始舵机码**\n每个舵机回报一个 **0~4095** 的整数(12 位编码器)。这是**原始码**、不是角度——舵机装配时零位是随机的(舵盘花键任意插)。\n本例六码：${joints.map(j => `${j.name.split(' ')[0]}=${j.leaderTick}`).join('、')}。\n直接把码当角度用 = 错，得先标定。` })

    push({
      stage: 'calib', showTick: true, showAngle: true, showGoal: false,
      focus: `标定：角 = (码 − homing_offset) × 360/4096`,
      log: `**② 标定：原始码 → 关节角**\n角度 = **(码 − homing_offset) × (360/4096)**。homing_offset 是"这个电机的 0°对应哪个码"(标定时记下)，${DEG_PER_TICK.toFixed(4)}°/tick 是 12 位分辨率。\n${joints.map(j => `${j.name.split(' ')[0]}: (${j.leaderTick}−${j.homing})×${DEG_PER_TICK.toFixed(3)} = ${j.leaderDeg}°`).join('；')}。\n(标定里还有 range_min/max、符号方向——把不同装配的电机统一到同一角度约定。)` })

    push({
      stage: 'safety', showTick: true, showAngle: true, showGoal: true,
      focus: `max_relative_target 安全钳：goal = present + clamp(Δ, ±${MAX_REL}°)${safety === 'on' ? `；抖动关节被钳(${clampedN} 个)` : '；关→直通、跟着急跳'}`,
      log: `**③ max_relative_target 安全钳 → 写 follower 目标**\nfollower 每步只允许动一小段：**goal = present + clamp(目标角 − present, −${MAX_REL}°, +${MAX_REL}°)**。\n看**腕转 wrist_roll**：一次通信抖动让 leader 跳到 ${glitch.leaderDeg}°，而 follower 当前才 ${glitch.present}°，一步要跳 **Δ=${glitch.delta}°**。\n${safety === 'on'
        ? `安全钳**开**：Δ 被钳到 ±${MAX_REL}° → 目标只挪到 ${glitch.goal}°，follower 平稳；共 **${clampedN}** 个关节被钳。`
        : `安全钳**关（直通）**：目标直接 = ${glitch.leaderDeg}°，follower 跟着 **急跳 ${glitch.delta}°**——真机上就是一次危险甩臂、可能撞坏。`}\n写下 goal 后，舵机**内部 PID** 把当前角驱动到 goal(这就是 PID 那课的内环)。` })

    push({
      stage: 'done', showTick: true, showAngle: true, showGoal: true, phase: 'done',
      focus: `完：读码→标定→安全钳→写目标；遥操作录下的 (obs, action) 就是 ACT/BC 的示教数据集`,
      log: `**小结：遥操作 = 采集示教数据的入口**\n① **同构臂直接抄关节角、不用 IK**(结构不同才要重定向)。\n② **原始码 0~4095 要标定**：角=(码−homing_offset)×360/4096；homing/range/符号统一装配差异。\n③ **max_relative_target 安全钳**：每步限幅 ±${MAX_REL}°，防通信抖动/跳变时急跳撞坏(本例腕转 Δ=${glitch.delta}°被钳)。\n④ 写 goal 后**舵机 PID 内环**执行。\n**闭环到别的课**：遥操作时同步录下 follower 的 (observation.state, action) —— **这正是 ACT / Diffusion / BC 训练用的示教数据集**；用 FK 可把关节角画成末端轨迹。面试延伸：为何要 homing_offset(装配零位随机)；同构为何免 IK；max_relative_target 的安全意义；单向遥操作 vs 双向(带力反馈)。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showTick: false, showAngle: false, showGoal: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '遥操作步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
