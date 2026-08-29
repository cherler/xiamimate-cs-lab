/**
 * 内核：LeRobot × SO-101 开源实战 —— 手把手走一遍"低成本机械臂从组装到自主抓取"的真实流水，末端接一个真算的 SO-101 手臂仿真（具身智能 · 具身项目实战）
 * 轴：step —— 硬件(SO-101 5自由度+夹爪) → 装配标定 → 遥操作采集示范 → 训练策略(ACT) → 部署自主执行；部署段是一个真正用正运动学算出来的手臂抓取动作
 *
 * 把前面所有课(运动学/感知/控制/模仿学习)落到一套**能真买真搭**的开源硬件上:**SO-101**(HuggingFace × TheRobotStudio 的低成本 3D 打印机械臂,
 * 5 自由度 + 夹爪、6 颗 STS3215 舵机、leader/follower 主从两条臂),配 **LeRobot**(HuggingFace 的机器人学习库)。流水就是模仿学习那套:
 *   ① 装配标定 → ② 用 **leader 臂遥操作 follower** 录一批示范(相机+关节)成 LeRobot 数据集 → ③ 用 **lerobot-train** 训一个策略(默认 **ACT** 动作分块 Transformer,也可 Diffusion Policy / π0 等 VLA) → ④ **lerobot-rollout** 部署,让 follower 臂**自主**完成任务(如"抓起方块")。
 * 本实验一步步给出**真实 CLI 命令**(照着能跑),并在部署段接一个**真正的手臂仿真**:用四连杆**正运动学**逐帧算出 SO-101 手臂从 home→伸手→合爪→抬起 的动作,方块被夹爪抓住后跟着手走。
 * 这就是"真实模拟引擎"的意思——手臂每一帧的位姿都是 FK 现算的,不是画的动画。命令照抄自 LeRobot 官方文档;用户可据此真搭一套。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const rad = (d: number) => (d * Math.PI) / 180
const r2 = (n: number) => Math.round(n * 100) / 100
type Pt = [number, number]

const L = [2, 1.7, 1.1, 0.6]
const fk = (A: number[]): Pt[] => { let x = 0, y = 0, c = 0; const pts: Pt[] = [[0, 0]]; for (let i = 0; i < 4; i++) { c += A[i]!; x += L[i]! * Math.cos(rad(c)); y += L[i]! * Math.sin(rad(c)); pts.push([r2(x), r2(y)]) } return pts }

export type LeRobotState = {
  i: number
  step: number
  phase: 'intro' | 'hardware' | 'setup' | 'record' | 'train' | 'deploy' | 'done'
  op: 'intro' | 'hardware' | 'setup' | 'record' | 'train' | 'pose' | 'summary'
  stageLabel: string
  cmd: string                    // 本步的真实 CLI 命令
  armPts: Pt[]                   // 当前手臂 FK 点（base..夹爪）
  gripper: 'open' | 'closed'
  objPos: Pt                     // 方块位置
  holding: boolean
  poseName: string
  focus: string
  log: string
}
type Frame = Omit<LeRobotState, 'i'>

// 抓取动作关键帧（关节角，度）
const POSES: { name: string; A: number[]; grip: 'open' | 'closed' }[] = [
  { name: 'home（策略启动）', A: [90, -45, -35, -20], grip: 'open' },
  { name: '伸手下探到方块', A: [18, -55, -45, -25], grip: 'open' },
  { name: '合爪抓住', A: [18, -55, -45, -25], grip: 'closed' },
  { name: '抬起', A: [50, -42, -32, -18], grip: 'closed' },
]
const OBJ0: Pt = fk(POSES[1]!.A)[4]!    // 方块初始在下探点（桌面）

export const lerobotKernel: Kernel<LeRobotState> = {
  kind: 'lerobot',
  compile(_doc: SimDocument): CompiledModel<LeRobotState> {
    const frames: Frame[] = []
    const home = fk(POSES[0]!.A)
    const push = (f: Omit<Frame, 'step'>) => frames.push({ step: frames.length, ...f })

    push({
      phase: 'intro', op: 'intro', stageLabel: '开源实战', cmd: '', armPts: home, gripper: 'open', objPos: OBJ0, holding: false, poseName: '',
      focus: 'SO-101 + LeRobot：低成本机械臂从组装到自主抓取，跑通模仿学习全链路',
      log: `**LeRobot × SO-101 开源实战**\n把前面所有课落到一套**能真买真搭**的开源硬件：**SO-101**(HuggingFace × TheRobotStudio 的低成本 3D 打印臂，**5 自由度+夹爪、6 颗 STS3215 舵机、leader/follower 主从两条臂**) + **LeRobot**(HuggingFace 机器人学习库)。\n全链路 = 模仿学习那套：**装配标定 → leader 遥操 follower 采集示范 → 训练策略(ACT) → 部署自主抓取**。\n一步步给真实命令，末端接一个**真算 FK 的手臂仿真**。`,
    })

    push({
      phase: 'hardware', op: 'hardware', stageLabel: '① 硬件 SO-101', cmd: '# 装 LeRobot + Feetech SDK\npip install -e ".[feetech]"', armPts: home, gripper: 'open', objPos: OBJ0, holding: false, poseName: '',
      focus: 'SO-101：5 自由度+夹爪，6 颗 STS3215 舵机；follower 干活、leader 当遥操手柄',
      log: `**① 硬件：SO-101 是什么**\n一套低成本(3D 打印+便宜舵机)的桌面机械臂：\n· **6 颗 STS3215 舵机**，6 个关节：Base/Shoulder-Pan、Shoulder-Lift、Elbow-Flex、Wrist-Flex、Wrist-Roll、Gripper —— 即 **5 自由度 + 夹爪**。\n· **主从两条臂**：**follower**(从臂，真干活，用 1/345 减速) + **leader**(主臂，当你手里的遥操作手柄，用不同减速比好让你轻松推动)。\n零件与 3D 打印清单在 TheRobotStudio 的 SO-ARM100 仓库；先装好 LeRobot 和 Feetech 舵机 SDK。`,
    })

    push({
      phase: 'setup', op: 'setup', stageLabel: '② 装配 + 标定', cmd: 'lerobot-find-port                    # 找串口\nlerobot-setup-motors --robot.type=so101_follower --robot.port=/dev/ttyACM0   # 设舵机id/波特率\nlerobot-calibrate    --robot.type=so101_follower --robot.port=/dev/ttyACM0 --robot.id=my_follower', armPts: home, gripper: 'open', objPos: OBJ0, holding: false, poseName: '',
      focus: '② 找串口 → 设舵机 id/波特率 → 标定(leader/follower 同一物理位姿读数一致)',
      log: `**② 装配 + 配置 + 标定**\n组装好后接上电和 USB：\n· \`lerobot-find-port\`：找到每条臂的串口(拔插识别)。\n· \`lerobot-setup-motors\`：逐个舵机设唯一 id 和波特率(写进舵机 EEPROM，一次即可)。\n· \`lerobot-calibrate\`：标定——先把每个关节摆到量程中间、再走满行程。**标定很关键**：让 leader 和 follower 在同一物理位姿下读数一致，训练好的网络才能跨臂/跨设备通用。\n对 leader 臂重复同样三步(把 --robot.type 换成 --teleop.type=so101_leader)。`,
    })

    push({
      phase: 'record', op: 'record', stageLabel: '③ 遥操作采集示范', cmd: 'lerobot-record \\\n  --robot.type=so101_follower --robot.port=/dev/ttyACM0 --robot.id=my_follower \\\n  --teleop.type=so101_leader  --teleop.port=/dev/ttyACM1 --teleop.id=my_leader \\\n  --robot.cameras="{front:{type:opencv,index_or_path:0,width:640,height:480,fps:30}}" \\\n  --dataset.repo_id=$HF_USER/so101_pick --dataset.num_episodes=50 \\\n  --dataset.single_task="Grab the black cube"', armPts: fk(POSES[1]!.A), gripper: 'open', objPos: OBJ0, holding: false, poseName: '遥操作中',
      focus: '③ 用 leader 遥操 follower、录 ≥50 段示范(相机+关节+动作)成 LeRobot 数据集',
      log: `**③ 遥操作采集示范**\n你**手推 leader 臂**、follower 臂**实时跟随**(\`lerobot-teleoperate\` 先试手感)，然后 \`lerobot-record\` 把每一帧的**相机图像 + 关节状态 + 动作**录下来，存成 **LeRobot 数据集**(自动上传 HuggingFace Hub)。\n经验：一个任务录 **≥50 段**、每个物体位置约 10 段；相机固定、抓取动作一致；确保物体在相机里看得见(法则：光看相机图你自己能完成任务，网络才学得会)。这就是模仿学习的"示范"来源——BC 那课说的专家数据。`,
    })

    push({
      phase: 'train', op: 'train', stageLabel: '④ 训练策略 (ACT)', cmd: 'lerobot-train \\\n  --dataset.repo_id=$HF_USER/so101_pick \\\n  --policy.type=act \\\n  --output_dir=outputs/train/act_so101 \\\n  --policy.device=cuda \\\n  --policy.repo_id=$HF_USER/act_so101', armPts: home, gripper: 'open', objPos: OBJ0, holding: false, poseName: '',
      focus: '④ lerobot-train 训一个 ACT(动作分块 Transformer)策略，几小时；也可 Diffusion Policy / π0',
      log: `**④ 训练策略**\n\`lerobot-train\` 在你的数据集上训一个模仿学习策略。默认 \`--policy.type=act\`——**ACT(Action Chunking Transformer)**：一次预测**一整段**动作(动作分块，缓解 BC 的复合误差)、用 Transformer 编码相机+关节。也可换 **Diffusion Policy**(Diffusion Policy 那课，建多峰动作分布)或 **π0/SmolVLA** 这类 VLA(VLA 那课)。\n策略会**自动适配**你数据里的关节数、动作维度、相机数。训练几小时(GPU)，checkpoint 存在 outputs/…；没有好显卡就上 Colab 或 HF Jobs。`,
    })

    POSES.forEach((p, idx) => {
      const armPts = fk(p.A)
      const end = armPts[4]!
      const holding = p.grip === 'closed'
      const objPos: Pt = holding ? end : OBJ0
      const last = idx === POSES.length - 1
      push({
        phase: last ? 'done' : 'deploy', op: last ? 'summary' : 'pose', stageLabel: '⑤ 部署 · 自主抓取', cmd: idx === 0 ? 'lerobot-rollout \\\n  --strategy.type=base \\\n  --policy.path=$HF_USER/act_so101 \\\n  --robot.type=so101_follower --robot.port=/dev/ttyACM0 \\\n  --task="Grab the black cube" --duration=60' : '', armPts, gripper: p.grip, objPos, holding, poseName: p.name,
        focus: `⑤ 部署执行 · ${p.name}：夹爪 ${p.grip === 'closed' ? '合' : '开'}，末端 (${end[0]}, ${end[1]})`,
        log: last
          ? `**⑤ 部署 · ${p.name}**\n\`lerobot-rollout --strategy.type=base --policy.path=$HF_USER/act_so101 --task="Grab the black cube"\`——训练好的策略**自主**驱动 follower 臂。手臂已把方块**抓起**(末端在 (${end[0]}, ${end[1]})、方块跟着夹爪走)。任务完成。\n\n**这段手臂动作是真算的**：SO-101 简化成四连杆，每一帧的位姿都用**正运动学** 从关节角现算(home→伸手→合爪→抬起)、方块抓住后=夹爪位置——这就是"真实模拟引擎"，不是预渲染动画。真机上 LeRobot 用 MuJoCo/真实硬件跑，机制一样。\n\n**要点**：SO-101+LeRobot 把整条具身链路走通、且**门槛低到你能自己搭**——装配标定(四元数/标定)、遥操采集(模仿学习示范)、训练(ACT/Diffusion Policy/VLA)、部署(RRT规划+PID/阻抗控制+正运动学/IK运动学在底层)。策略选择:ACT(动作分块、快)、Diffusion Policy(多峰)、π0/SmolVLA(带语言泛化的 VLA)。评估策略有 base/sentry/dagger(人在环补数据,治BC的分布漂移)等。这是当下**自己动手学具身智能**性价比最高的一条路。（本实验命令照抄自 LeRobot 官方文档，可据此真搭。）`
          : `**⑤ 部署 · ${p.name}**\n${idx === 0 ? '`lerobot-rollout` 让训练好的策略自主执行。手臂从 home 位姿起步、夹爪张开、方块在桌上。' : idx === 1 ? '策略输出动作、手臂**伸手下探**到方块上方(末端到 (' + end[0] + ', ' + end[1] + '))。' : '夹爪**合拢抓住**方块——方块从此跟着夹爪走。'}\n（手臂位姿由四连杆正运动学从关节角现算。）`,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, stageLabel: '', cmd: '', armPts: home, gripper: 'open', objPos: OBJ0, holding: false, poseName: '', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '实战步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
