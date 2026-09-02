/**
 * 内核：软件库/框架介绍 —— 知识理论之上的"库层"(具身/大模型/算法等各线都有自己的库)。不做仿真、改成结构化介绍。
 * 这是一个**新内容类型**(不是焊死的算法机制):按用户定的四要素逐段展开——①特点介绍 ②优缺点剖析 ③内容覆盖(并**反向连回**它用到的理论实验) ④落地项目示例。
 * 一个 `library` kind 复用于所有库,靠 param `lib` 选具体库的档案(见 LIBS)。内容全部**钉真实来源**(许可/维护方/组件/项目都核过),不玄乎、不按记忆编。
 * 首个:MoveIt 2 —— ROS 2 的机械臂运动规划框架,它的默认规划器就是我们建过的 RRT-Connect、碰撞用 FCL(=GJK 那类)、优化用 CHOMP、时间参数化=梯形速度曲线,几乎每个运动规划实验都能反向连回来。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Feature = { t: string; d: string }
type CovLink = { label: string; exp: string }
type Coverage = { mod: string; d: string; links: CovLink[] }
type LibProfile = {
  name: string; tagline: string; license: string; lang: string; latest: string; maintainer: string
  whatIs: string
  features: Feature[]
  pros: string[]; cons: string[]
  coverage: Coverage[]
  projects: string[]
  seeAlso: string
}
export type LibraryState = {
  i: number
  step: number
  section: 'intro' | 'proscons' | 'coverage' | 'projects' | 'done'
  lib: string
  name: string; tagline: string; license: string; lang: string; latest: string; maintainer: string; seeAlso: string
  whatIs: string
  features: Feature[]
  pros: string[]; cons: string[]
  coverage: Coverage[]
  projects: string[]
  focus: string
  log: string
}
type Frame = Omit<LibraryState, 'i'>

const LIBS: Record<string, LibProfile> = {
  moveit: {
    name: 'MoveIt 2', tagline: 'ROS 2 上机械臂运动规划的事实标准框架', license: 'BSD-3-Clause', lang: 'C++ / Python', latest: '面向 ROS 2(Humble/Jazzy 等)', maintainer: 'PickNik Robotics + 社区(ROS 2 port 由 ROSIN 支持)',
    whatIs: 'MoveIt 是 ROS/ROS 2 上**机械臂(操作臂)运动规划**的事实标准:给它机器人模型(URDF/SRDF)+ 一个目标位姿,它算出一条**无碰撞、可执行的关节轨迹**。中枢是 **move_group** 节点,把「规划场景 → 规划器 → 碰撞检测 → 运动学 → 轨迹时间参数化」串成一条流水线。它不发明新算法,而是**把一堆经典规划/碰撞/运动学算法工程化、拼成一个能用的系统**——所以它正好骑在我们「运动规划」那条理论实验线之上。',
    features: [
      { t: 'PlanningScene 规划场景', d: '机器人当前状态 + 世界(障碍/抓取物),是规划用的世界模型' },
      { t: '规划流水线', d: '规划器 + 请求适配器(预/后处理);默认接 OMPL 采样规划器' },
      { t: '碰撞检测(FCL)', d: '用 FCL(Flexible Collision Library)判机器人与环境/自身碰撞——底层就是 GJK 那类凸-凸检测' },
      { t: '运动学 FK/IK', d: 'KDL / IKFast / bio_ik 求解,末端位姿 ↔ 关节角互转' },
      { t: '轨迹时间参数化', d: '给几何路径配速度/加速度限(梯形/S 曲线),变成可真正执行的轨迹' },
      { t: 'Setup Assistant / Servo / RViz', d: '向导配机器人、实时伺服、可视化调试一条龙' },
    ],
    pros: ['ROS 生态里机械臂规划的事实标准、开箱即用', 'Setup Assistant 向导把 URDF 配成能规划的系统', '和感知/控制/可视化(RViz)深度集成', '规划算法可插拔:OMPL/CHOMP/STOMP/Pilz 任选', 'MoveIt Servo 做实时遥操作/伺服'],
    cons: ['学习曲线陡、配置繁琐(URDF/SRDF + 一堆 yaml)', '偏机械臂;移动底盘导航是 Nav2 的活、不归它', '和 ROS 强耦合、整体量级重', '默认采样规划不最优,要调参 + 后处理平滑'],
    coverage: [
      { mod: '采样式规划(OMPL)', d: 'RRT-Connect(默认)、RRT、RRT*、PRM 等都在 OMPL 里', links: [{ label: 'RRT-Connect', exp: 'rrtconnect' }, { label: 'RRT', exp: 'rrt' }, { label: 'RRT*', exp: 'rrtstar' }, { label: 'PRM', exp: 'prm' }] },
      { mod: '优化式规划(CHOMP)', d: '整条轨迹梯度下降、降"平滑+避障"代价', links: [{ label: 'CHOMP 轨迹优化', exp: 'chomp' }] },
      { mod: '碰撞检测(FCL)', d: '凸-凸碰撞、支撑函数 / Minkowski 差', links: [{ label: 'GJK 碰撞检测', exp: 'gjk' }] },
      { mod: '轨迹时间参数化', d: '给几何路径配速度曲线', links: [{ label: '梯形速度曲线', exp: 'trapezoid' }] },
      { mod: '运动学 IK', d: '末端目标位姿反解关节角', links: [{ label: '逆运动学 IK', exp: 'ik' }, { label: '雅可比', exp: 'jacobian' }] },
    ],
    projects: ['Franka Emika Panda(MoveIt 官方教程机械臂)', 'Universal Robots UR 系列(工业协作臂)', 'Fetch / PR2 等研究平台', '工业拾取/装配、桌面抓取 pipeline 的规划底座'],
    seeAlso: '建在「ROS 2」通信框架之上;移动底盘导航看「Nav2」;数据驱动的学习式操作看「LeRobot」',
  },
  ros2: {
    name: 'ROS 2', tagline: '机器人的"操作系统"——节点图 + 发布订阅通信中间件', license: 'Apache-2.0', lang: 'C++ / Python(rclcpp / rclpy)', latest: '最新 LTS: Jazzy Jalisco(2024-05 发布,支持到 2029-05)', maintainer: 'Open Robotics / OSRF + 社区',
    whatIs: 'ROS 2 不是真正的操作系统,而是**机器人软件的通信中间件 + 工具生态**:把系统拆成一堆**节点(node)**小进程,节点之间靠**话题(topic)发布-订阅**、**服务(service)请求-响应**、**动作(action)长任务**通信;底层走 **DDS**(数据分发服务,带实时/多机/安全)。相比 ROS 1 完全重写——解决实时、多机器人组网、生产级可靠、安全。几乎所有机器人软件(MoveIt / Nav2 / Autoware)都骑在它上面,是整个机器人栈的**通信底座**。',
    features: [
      { t: '节点图 + 发布订阅', d: '系统=一堆节点小进程,靠命名话题 pub/sub 解耦通信' },
      { t: '服务 / 动作', d: '服务=请求-响应(短);动作=可反馈可取消的长任务(如"走到那儿")' },
      { t: 'DDS 中间件', d: '底层传输,自带 QoS(可靠性/时效)、多机组网、安全(SROS2)' },
      { t: 'TF 坐标变换树', d: '维护各坐标系(基座/关节/相机)间的实时变换,查询任意两系关系' },
      { t: 'colcon + 包生态', d: '构建工具 + 海量现成包(驱动/算法/工具),即插即用' },
    ],
    pros: ['机器人软件的事实标准、生态巨大(驱动/算法/工具一堆现成)', '模块化:节点即插即用、语言/机器进程解耦', 'DDS 带实时、多机、安全,面向生产', '多语言(C++/Python),工具链全(RViz/rosbag/ros2 CLI)'],
    cons: ['概念多、学习曲线陡', 'DDS 网络/QoS 配置与调试麻烦', '非硬实时:kHz 电机环还得下到 MCU/RT 层(micro-ROS)', '版本/发行版碎片、整体量级重'],
    coverage: [
      { mod: 'TF 坐标变换', d: '各坐标系间的位姿变换、四元数表示', links: [{ label: '位姿与四元数', exp: 'quat' }] },
      { mod: '(承载算法库的底座)', d: '规划/导航/感知算法本身在 MoveIt / Nav2 等包里、都建在 ROS 2 上', links: [{ label: 'MoveIt 见「软件库」', exp: 'moveit' }] },
    ],
    projects: ['工业机械臂 / 移动机器人 / 无人机 / 服务机器人的通用软件底座', 'MoveIt 2(机械臂规划)、Nav2(移动导航)都建在其上', 'Autoware(开源自动驾驶栈)基于 ROS 2', '各大厂/实验室机器人的中间件首选'],
    seeAlso: '机械臂规划看「MoveIt 2」、移动导航看「Nav2」、仿真看「Gazebo」、MCU 端看「micro-ROS」',
  },
  pinocchio: {
    name: 'Pinocchio', tagline: '快到飞起的刚体动力学库(还给解析导数)——机器人动力学的心脏', license: 'BSD-2-Clause', lang: 'C++(Python 绑定 pin)', latest: 'Pinocchio 3.x', maintainer: 'Stack-of-Tasks / INRIA + 社区',
    whatIs: 'Pinocchio 是**刚体动力学算法**的高性能实现:正/逆运动学、正/逆动力学、雅可比、质量矩阵,以及这些量的**解析导数**(优化/MPC 必需)。它把我们「刚体动力学」实验里手推的那几套算法——**RNEA(递归牛顿-欧拉逆动力学)、ABA(正向动力学)、CRBA(质量矩阵)**——做成了工业级的库。是 Crocoddyl、Stack-of-Tasks、Humanoid Path Planner 等一堆上层控制/规划库的公共底座。',
    features: [
      { t: '正/逆运动学 FK/IK', d: '关节角 ↔ 各连杆位姿、几何/解析雅可比' },
      { t: '逆动力学 RNEA', d: '给定 q,q̇,q̈ 算所需力矩 τ,两次递归扫描 O(n)' },
      { t: '正向动力学 ABA', d: '给定力矩算加速度 q̈,Articulated-Body 算法' },
      { t: '质量矩阵 CRBA', d: 'Composite-Rigid-Body 算惯性矩阵 M(q)' },
      { t: '解析导数', d: '动力学量对 q/q̇/τ 的导数——MPC/轨迹优化的关键,别人少有' },
    ],
    pros: ['极快(C++ 模板 + 可代码生成)', '给解析导数——MPC/最优控制/轨迹优化的关键', '刚体动力学算法一整套齐全', '是上层控制库(Crocoddyl/SoT)的公共底座', 'BSD-2 宽松好用'],
    cons: ['偏底层:是"算子库"不是开箱系统、要自己搭', 'C++ 为主、上手需要功底', '只管动力学(碰撞/规划/感知不归它)', '学术味重、文档偏专业'],
    coverage: [
      { mod: '逆动力学 RNEA', d: '递归牛顿-欧拉、两次扫描 O(n)', links: [{ label: '递归牛顿-欧拉 RNEA', exp: 'rnea' }] },
      { mod: '运动方程 M/C/G', d: '质量矩阵 + 科氏/离心 + 重力', links: [{ label: '机械臂运动方程', exp: 'dyneom' }] },
      { mod: '正向动力学 ABA', d: '力矩→加速度、仿真一步', links: [{ label: '正向动力学', exp: 'fwddyn' }] },
      { mod: '雅可比 / 运动学', d: '关节速度↔末端速度、FK', links: [{ label: '雅可比', exp: 'jacobian' }, { label: '正运动学 FK', exp: 'fk' }] },
      { mod: '基于动力学的控制', d: '计算力矩/反馈线性化', links: [{ label: '计算力矩控制', exp: 'computedtorque' }] },
    ],
    projects: ['人形 / 四足机器人的全身控制与 MPC(配 Crocoddyl / OCS2)', 'Stack-of-Tasks 分层全身控制', '腿足运动生成与实时优化', '几乎所有需要快速动力学 + 导数的控制/规划研究'],
    seeAlso: '最优控制/DDP 看「Crocoddyl」、机械臂规划看「MoveIt 2」、仿真里的动力学看「MuJoCo」',
  },
  lerobot: {
    name: 'LeRobot', tagline: 'Hugging Face 的端到端机器人学习库——数据/策略/真机一条龙', license: 'Apache-2.0', lang: 'Python(PyTorch)', latest: '活跃迭代中', maintainer: 'Hugging Face + 社区',
    whatIs: 'LeRobot 把**机器人学习**(以模仿学习为主)做成像 🤗 transformers 那样开箱即用:标准**数据集格式**(LeRobotDataset)、一批**策略实现**(ACT、Diffusion Policy、TDMPC、VLA/π0 等)、**真机支持**(SO-100/SO-101 低成本臂、Koch、ALOHA)。目标是把"采数据 → 训策略 → 上真机"整条流水线降到人人能跑。我们「具身学习/项目实战」那批实验(ACT 动作分块、delta_timestamps、归一化、遥操作)拆的就是它内部的机制。',
    features: [
      { t: 'LeRobotDataset 数据格式', d: '标准化的机器人示范数据(低维存 parquet、图像存 mp4),HF Hub 共享' },
      { t: '策略库', d: 'ACT(动作分块)、Diffusion Policy、TDMPC、VLA/π0 等开箱实现' },
      { t: '真机接口', d: 'SO-100/SO-101 低成本臂、Koch、ALOHA,遥操作采数据' },
      { t: '训练 / 回放 pipeline', d: '采集→训练→评估→上真机一条龙,配 HF 生态' },
    ],
    pros: ['端到端开箱即用(数据到真机)', '低成本真机(SO-101 几百刀就能搭)', '策略实现现成(ACT/DP/VLA 不用自己写)', 'HF 生态:数据/模型 Hub 一键共享', 'Apache 宽松、社区活跃'],
    cons: ['以模仿学习为主:要采示范数据、数据质量定上限', '真机品类还在扩、偏研究/入门', '工业级部署还要自己补(鲁棒性/安全)', '依赖重(PyTorch 全家桶)'],
    coverage: [
      { mod: 'ACT 策略', d: '动作分块 + 时序集成治复合误差', links: [{ label: 'ACT 动作分块', exp: 'actte' }] },
      { mod: '数据管线', d: 'delta_timestamps 时序窗口 + 数据集归一化', links: [{ label: 'delta_timestamps', exp: 'deltats' }, { label: '数据集归一化', exp: 'normstats' }] },
      { mod: '遥操作采数据', d: 'SO-101 主从同构臂直接抄关节角', links: [{ label: '主从遥操作', exp: 'teleop' }] },
      { mod: '其它策略', d: '行为克隆 / Diffusion Policy / VLA', links: [{ label: '模仿学习 BC', exp: 'bc' }, { label: 'Diffusion Policy', exp: 'diffpolicy' }, { label: 'LeRobot×SO-101', exp: 'lerobot' }] },
    ],
    projects: ['SO-101 低成本机械臂抓取/操作', 'ALOHA 双臂精细操作复现', '社区共享的真机数据集 + 模仿学习策略', '把前沿 VLA(π0 等)接到低成本真机上跑'],
    seeAlso: '底层动力学看「Pinocchio」、VLA 基座模型看「OpenVLA」、仿真训练看「Isaac Lab / MuJoCo」',
  },
}

export const libraryKernel: Kernel<LibraryState> = {
  kind: 'library',
  compile(doc: SimDocument): CompiledModel<LibraryState> {
    const lib = String(doc.params?.lib ?? 'moveit')
    const p = LIBS[lib] ?? LIBS.moveit!

    const frames: Frame[] = []
    const b0 = { lib, name: p.name, tagline: p.tagline, license: p.license, lang: p.lang, latest: p.latest, maintainer: p.maintainer, seeAlso: p.seeAlso, whatIs: p.whatIs, features: p.features, pros: p.pros, cons: p.cons, coverage: p.coverage, projects: p.projects }
    const push = (section: Frame['section'], focus: string, log: string) => frames.push({ ...b0, step: frames.length, section, focus, log } as Frame)

    push('intro', `${p.name}:${p.tagline}(${p.license})`,
      `**${p.name} · 特点介绍**\n${p.whatIs}\n\n**基本信息**:许可 **${p.license}**、语言 ${p.lang}、维护 ${p.maintainer}、${p.latest}。\n\n**核心模块/抽象**:\n${p.features.map(f => `· **${f.t}**:${f.d}`).join('\n')}\n\n(这是"软件库/框架"层——它不是一个能焊死仿真的算法,而是把很多算法工程化拼成的系统;下面看它的取舍、覆盖了我们哪些理论实验、以及真实项目。)`)

    push('proscons', `${p.name} 优缺点:强在生态与开箱即用,弱在重与配置繁琐`,
      `**${p.name} · 优缺点剖析**\n**强在哪 ✅**\n${p.pros.map(x => `· ${x}`).join('\n')}\n\n**坑在哪 / 什么时候别用 ⚠️**\n${p.cons.map(x => `· ${x}`).join('\n')}`)

    push('coverage', `内容覆盖:它把我们这些理论实验工程化——${p.coverage.flatMap(c => c.links.map(l => l.label)).join('、')}`,
      `**${p.name} · 内容覆盖(反向连回理论实验)**\n它内部用到的算法,正是实验室里我们焊死过的那些理论——库是"用法",实验是"原理":\n${p.coverage.map(c => `· **${c.mod}**:${c.d}　→ 连回：${c.links.map(l => `「${l.label}」`).join('、')}`).join('\n')}\n\n**这就是"库层"的价值**:学库之前先在实验里把原理焊死(RRT-Connect 怎么两头长树、GJK 怎么判碰、CHOMP 怎么降代价),再回头看 MoveIt 就是"把这些拼成一条能跑的规划流水线"。`)

    push('projects', `落地项目:${p.projects.slice(0, 3).join('、')} 等`,
      `**${p.name} · 落地项目示例**\n真实用它做出来的:\n${p.projects.map(x => `· ${x}`).join('\n')}\n\n**相关**:${p.seeAlso}。`)

    push('done', `${p.name}:骑在运动规划理论实验之上的工程化框架;许可 ${p.license}`,
      `**小结:${p.name}**\n· **是什么**:${p.tagline};中枢 move_group 串起 场景/规划/碰撞/运动学/轨迹一条流水线;\n· **取舍**:生态标准、可插拔、开箱即用,但重、配置繁、偏机械臂;\n· **覆盖**:内部算法=我们的理论实验(OMPL↔RRT-Connect/RRT*/PRM、FCL↔GJK、CHOMP、时间参数化↔梯形曲线、IK/雅可比);\n· **落地**:Franka Panda、UR 等机械臂的规划底座。\n**"库层"读法**:理论实验教"原理为什么对"、库教"工程上怎么拼起来用";两层对着看,既懂机制又会用工具。${p.seeAlso}。`)

    const base0: Frame = { ...b0, section: 'intro', step: -1, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '介绍段' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
