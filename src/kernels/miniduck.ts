/**
 * 内核：Open Duck Mini（miniduck）· 相位参考步态 + 模仿奖励 —— 迪士尼 BD-X 的开源迷你复刻怎么"学会走路"（具身智能 · 项目实战 / 面试八股 · LeRobot 线收官）
 * 轴：step —— 身份(腿式RL≠模仿学习) → 相位+参考步态 → 策略残差+PD → 奖励分解 → 消融(带模仿/只velocity/无策略) → 收官。
 *
 * miniduck = **Open Duck Mini**(Antoine Pirrone / Pollen / HF，现商品化为 Microduck)。它**不是** LeRobot 那套模仿学习(ACT/Diffusion)，
 * 而是**腿式强化学习**：MuJoCo Playground 里 **Brax PPO**(沿用 Berkeley Humanoid 配置)训练、50Hz 策略跑在 Pi Zero 2W 上。
 * 核心陷阱(整条线最值钱的一句)：**"模仿奖励" ≠ "模仿学习"**——
 *   · **模仿学习(ACT/BC)**：监督地克隆人类示教动作，会累积误差(covariate shift)、不会自恢复；
 *   · **模仿奖励(DeepMimic 家族，本机器人用的)**：RL 里一个**奖励项**，奖励"跟踪一条相位对齐的参考步态"，会探索、会从扰动里恢复。同一个"模仿"，机制相反。
 * 确定性单步(固定种子、关噪声、喂定策略)：①相位 t=(i mod N)/N→φ=(cos,sin) ②参考 q̂=参考步态(Placo 生成、相位索引) ③策略残差 u=q_def+0.25a→PD τ=kp(u−q)−kd·q̇(=PID 内环)
 * ④奖励 r=2.5·R_vel+1.0·R_imit(+20 alive…)，R_imit 主导项 −15·‖q_leg−q̂_leg‖² ⑤摔倒判据 projected_gravity_z<0。
 * param 消融:带模仿(直立自然)/只velocity(前进但步态退化)/reference+PD无策略(欠驱动浮基摔倒)。相位/参考/奖励全现算。连「PID(内环)/FK(画末端)/BC(模仿学习那一半)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Mode = 'imit' | 'velonly' | 'nopolicy'
export type Leg = { name: string; qhat: number; q: number; u: number; a: number; tau: number }
export type DuckState = {
  i: number
  step: number
  stage: 'intro' | 'phase' | 'policy' | 'reward' | 'ablate' | 'done'
  mode: Mode
  modeLabel: string
  gaitI: number
  N: number
  phaseT: number
  cosp: number
  sinp: number
  cmdV: number
  v: number
  legs: Leg[]
  imitJoint: number     // ‖q−q̂‖²
  rVel: number
  rImit: number
  alive: number
  reward: number
  fallen: boolean
  imitOn: boolean       // 奖励里有没有模仿项
  hasPolicy: boolean
  outcome: string
  showPhase: boolean
  showPolicy: boolean
  showReward: boolean
  showOutcome: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<DuckState, 'i'>

const N = 20                 // 每个步态周期的控制步数
const GAIT_I = 7             // 当前处在周期第 7 步
const CMD_V = 0.30           // 指令前进速度 m/s
const KP = 20, KD = 0.5
const DOF = ['髋 hip_pitch', '膝 knee', '踝 ankle_pitch', '摆 hip_roll']
const Q_DEF = [0.10, -0.50, 0.05, -0.10]
// 相位索引的参考步态(Placo 生成后拟合成多项式)——这里用 off+amp·sin(2πt+ph) 复现"相位→参考角"
const REF = [{ amp: 0.35, ph: 0.0, off: 0.10 }, { amp: 0.55, ph: 0.5, off: -0.50 }, { amp: 0.30, ph: 1.0, off: 0.05 }, { amp: 0.20, ph: 1.5, off: -0.10 }]
const DEV = { imit: [0.01, -0.01, 0.01, -0.01], velonly: [0.25, 0.35, -0.30, 0.30], nopolicy: [0, 0, 0, 0] }
const r3 = (x: number) => Math.round(x * 1000) / 1000
const r2 = (x: number) => Math.round(x * 100) / 100

export const miniduckKernel: Kernel<DuckState> = {
  kind: 'miniduck',
  compile(doc: SimDocument): CompiledModel<DuckState> {
    const raw = String(doc.params?.mode ?? '带模仿奖励')
    const mode: Mode = raw.includes('无策略') ? 'nopolicy' : raw.includes('只') ? 'velonly' : 'imit'
    const modeLabel = mode === 'imit' ? '带模仿奖励(参考步态)' : mode === 'velonly' ? '只 velocity(去掉模仿项)' : 'reference+PD 无策略'

    const t = (GAIT_I % N) / N
    const cosp = r3(Math.cos(2 * Math.PI * t)), sinp = r3(Math.sin(2 * Math.PI * t))
    const dev = DEV[mode]
    const legs: Leg[] = DOF.map((name, k) => {
      const qhat = r3(REF[k]!.off + REF[k]!.amp * Math.sin(2 * Math.PI * t + REF[k]!.ph))
      const q = r3(qhat + dev[k]!)
      const u = r3(q)                                   // 目标≈实际(PD 已收敛)
      const a = r3((u - Q_DEF[k]!) / 0.25)              // 残差动作:u=q_def+0.25a
      const tau = r2(KP * (u - Q_DEF[k]!) - KD * 0)     // PD 力矩(以 q_def 为当前角示意)
      return { name, qhat, q, u, a, tau }
    })
    const imitJoint = r3(legs.reduce((s, l) => s + (l.q - l.qhat) ** 2, 0))

    const hasPolicy = mode !== 'nopolicy'
    const imitOn = mode !== 'velonly'                   // 只velocity = 消融掉模仿项
    const v = mode === 'imit' ? 0.29 : mode === 'velonly' ? 0.31 : 0.0
    const fallen = mode === 'nopolicy'                  // 无策略:欠驱动浮基没被镇定→摔
    const verr = (v - CMD_V) ** 2
    const rVel = r3(Math.exp(-verr / 0.01))
    const rImitVelMatch = Math.exp(-8 * verr)
    const rImit = imitOn ? r3(rImitVelMatch - 15 * imitJoint) : 0
    const alive = fallen ? 0 : 20
    const reward = r2(2.5 * rVel + (imitOn ? 1.0 * rImit : 0) + alive)
    const outcome = mode === 'imit' ? '直立·自然步态(像 BD-X 那样摇摆)'
      : mode === 'velonly' ? `前进但步态退化(能量最省的"丑走"，‖q−q̂‖²=${imitJoint}、却不扣分)`
        : '摔倒(欠驱动浮基未被镇定，回报崩)'

    const frames: Frame[] = []
    const b0 = {
      mode, modeLabel, gaitI: GAIT_I, N, phaseT: r3(t), cosp, sinp, cmdV: CMD_V, v, legs,
      imitJoint, rVel, rImit, alive, reward, fallen, imitOn, hasPolicy, outcome, phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showPhase: boolean; showPolicy: boolean; showReward: boolean; showOutcome: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showPhase: false, showPolicy: false, showReward: false, showOutcome: false,
      focus: `miniduck=Open Duck Mini(BD-X 迷你复刻)。它靠腿式 RL(Brax PPO@MuJoCo)学走路，不是 LeRobot 那套模仿学习。当前模式:${modeLabel}`,
      log: `**miniduck = Open Duck Mini：BD-X 的开源迷你复刻**\n它是迪士尼 BD-X 小机器人的开源迷你版(Antoine Pirrone / Pollen / HF，现已商品化为 Microduck)。**走路是"学"出来的**：在 MuJoCo Playground 里用 **Brax PPO**(沿用 Berkeley Humanoid 配置)训练，50Hz 策略跑在树莓派 Zero 2W 上。\n**整条 LeRobot 线最值钱的一句——"模仿奖励" ≠ "模仿学习"**：\n· 前面 ACT/BC 是**模仿学习**：监督克隆人类示教、会累积误差、不会自恢复；\n· 这里的鸭子用**模仿奖励**(DeepMimic 家族)：RL 里的一个**奖励项**，奖励"跟踪一条相位对齐的参考步态"，会探索、能从推搡里恢复。**同一个"模仿"、机制相反**。\n下面把它的确定性单步(env.step)拆开:相位→参考→策略+PD→奖励→摔判。` })

    push({
      stage: 'phase', showPhase: true, showPolicy: false, showReward: false, showOutcome: false,
      focus: `相位 t=(i mod N)/N=${r3(t)}→φ=(cos,sin)；参考步态 q̂(t) 相位索引地给出这一刻该摆成什么姿势`,
      log: `**① 相位 + 相位索引的参考步态**\n步态是周期的:相位 **t = (i mod N)/N = ${GAIT_I} mod ${N} / ${N} = ${r3(t)}**，编码成 **φ=(cos2πt, sin2πt)=(${cosp}, ${sinp})** 喂进观测——一个平滑的"节拍器"让策略锁相。\n**参考步态** q̂(t)：由 **Placo**(QP 任务空间 IK，Jacobian 求解)离线生成一整套 (dx,dy,dθ) 的走路轨迹、拟合成多项式;运行时按相位 t 取出这一刻**该摆成的腿关节角**:\n${legs.map(l => `${l.name.split(' ')[0]} q̂=${l.qhat}`).join('、')}。\n(FK/IK 在这里:参考步态就是一个应用 IK 的问题。)` })

    push({
      stage: 'policy', showPhase: true, showPolicy: true, showReward: false, showOutcome: false,
      focus: `策略输出残差 a→目标 u=q_def+0.25a(绕默认姿势)→PD 力矩 τ=kp(u−q)−kd·q̇(这就是 PID 内环)`,
      log: `**② 策略残差 + PD 伺服**\n${hasPolicy ? '策略 π(obs)' : '(无策略、直接回放参考)'}输出的是**绕默认姿势的残差** a：目标 **u = q_def + 0.25·a**(action_scale=0.25，残差+默认姿势 = 样本效率大增)。\n然后每个关节 **PD 位置伺服**：**τ = kp·(u − q) − kd·q̇**(kp=${KP}, kd=${KD})——${hasPolicy ? '这正是「PID 控制」那课的内环，只是嵌在 RL 循环里当底层执行器' : '开环回放:PD 能跟上参考角，但没有反馈策略去镇定整机'}。\n${legs.map(l => `${l.name.split(' ')[0]}: u=${l.u}、τ=${l.tau}`).join('；')}。\n观测(actor 只用机器人测得到的量):gyro/accel、指令、q−q_def、q̇×0.05、动作历史×3、脚接触、相位 φ。base 线速度**故意不给**(真机测不到)——这就是"非对称 actor-critic":critic 训练时才看真值。` })

    push({
      stage: 'reward', showPhase: true, showPolicy: true, showReward: true, showOutcome: false,
      focus: `奖励 r=2.5·R_vel+${imitOn ? '1.0·R_imit+' : '(模仿项已消融)+'}${alive} alive；R_imit 主导项 −15·‖q−q̂‖²`,
      log: `**③ 奖励分解**\nr = 2.5·**R_vel** ${imitOn ? '+ 1.0·**R_imit** ' : '+ (模仿项被去掉) '}+ **alive**(+20 站着不倒) − 小惩罚。\n· **R_vel** = exp(−‖v−v*‖²/0.01)：指令 v*=${CMD_V}、实际 v=${v} → **${rVel}**。\n· **R_imit**(DeepMimic 式相位跟踪，主导项 **−15·‖q_leg−q̂_leg‖²**)：${imitOn ? `‖q−q̂‖²=${imitJoint} → R_imit=exp(−8·‖v误差‖²)−15·${imitJoint}=**${rImit}**` : `**本模式消融**(权重 0)——策略偏离参考多远都不扣分`}。\n· **alive** = ${fallen ? '0(摔了)' : '20(直立)'}。\n**本步总奖励 r = ${reward}**。(注意主导项是 −15·‖q−q̂‖²:关节跟不上参考，扣分最狠——这是"自然步态"的来源。)` })

    push({
      stage: 'ablate', showPhase: true, showPolicy: true, showReward: true, showOutcome: true,
      focus: `消融结果(${modeLabel})：${outcome}`,
      log: `**④ 消融——为什么每一块都不能少**\n当前「${modeLabel}」→ **${outcome}**。\n三种对照：\n· **带模仿奖励**：−15·‖q−q̂‖² 把训练拉向那条自然的参考步态 → **直立、像 BD-X 那样摇摆**(总奖励最高)。\n· **只 velocity(去掉模仿项)**：只奖励速度 → PPO 找到**能量最省但很丑**的退化步态(q 远离参考、每步奖励却没差多少)——**这就是"模仿奖励买来自然步态"的证明**:去掉它、reward 看着差不多，步态却塌了。\n· **reference+PD 无策略**：开环把 q 精确对齐参考(‖q−q̂‖²=0！)，**照样摔**——因为**欠驱动的浮基**(6 自由度、零电机、只能靠间歇脚接触间接控制)没有反馈策略去镇定。这说明:光会复现参考不够、必须学一个闭环策略(所以是 RL、不是回放)。` })

    push({
      stage: 'done', showPhase: true, showPolicy: true, showReward: true, showOutcome: true, phase: 'done',
      focus: `收官：模仿奖励(RL,相位跟踪,能恢复)≠模仿学习(BC,监督示教,累积误差)；非对称 actor-critic；sim2real 靠 DR+作动器辨识+随机推搡`,
      log: `**收官：把整条 LeRobot 线收进一只鸭子**\n**① "模仿"的两副面孔(面试必答)**：**模仿学习**(ACT/BC，监督克隆示教、covariate shift 累积误差、无恢复) vs **模仿奖励**(本机器人，RL 里一个相位对齐的参考跟踪奖励项、会探索会恢复)。同词、反机制。\n**② 为什么 locomotion 用 RL 不用 BC**：新形态没有示教者;接触富、混杂的动力学;需要**扰动恢复**、而 BC 没有恢复。\n**③ 关键设计**：相位(cos/sin)让策略锁相;残差动作(绕默认姿势)提样本效率;**非对称 actor-critic**(critic 训练看真值 base 速度/参考帧，actor 只用 IMU+本体感觉+相位、部署免特权量);奖励主导项 −15·‖q−q̂‖² 买自然步态。\n**④ sim2real**：作动器系统辨识(BAM)、域随机化(摩擦/质量/kp)、观测噪声+动作延迟、**随机推搡**(这才教会"推不倒");策略导出 ONNX、50Hz 跑在 Pi Zero 2W，靠 BNO055 IMU 的重力向量当唯一朝向感。\n**⑤ 连到别的课**：PD 是 τ=kp(u−q)−kd·q̇ 的内环;Placo 的参考步态是应用 IK/Jacobian;Kalman/IMU 给"哪边是上";与 ACT/Diffusion 的"操作-模仿"范式并列成"腿式-RL-运动"范式。这就是 miniduck。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showPhase: false, showPolicy: false, showReward: false, showOutcome: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '单步拆解' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
