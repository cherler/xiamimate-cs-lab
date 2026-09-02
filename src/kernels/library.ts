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
  mujoco: {
    name: 'MuJoCo', tagline: '接触丰富、又快又准的物理引擎——机器人 RL/控制研究的头号仿真器', license: 'Apache-2.0', lang: 'C / Python(+ MJX: JAX)', latest: '活跃迭代;MJX 走 GPU/TPU', maintainer: 'Google DeepMind(2022 开源)',
    whatIs: 'MuJoCo(**Mu**lti-**Jo**int dynamics with **Co**ntact)是通用物理引擎,主打**接触丰富**的刚体动力学,广泛用于机器人、生物力学、机器学习。它把**接触建成凸优化问题**(软/弹性接触),大步长也稳、还能给一阶解析导数;用 **MJCF**(XML)描述模型。**MJX** 是 JAX 版、在 GPU/TPU 上大规模并行跑,把 RL 训练加速几个数量级。是学界做机器人控制/强化学习的默认仿真器(我们「刚体动力学/RL」实验里的动力学、接触、PPO 训练,真实就在这类引擎里跑)。',
    features: [
      { t: '接触动力学(凸优化)', d: '接触当凸优化解、软/弹性,大步长稳定、可给解析导数' },
      { t: '广义坐标刚体动力学', d: '关节空间正/逆动力学,精度高,适合控制与 RL' },
      { t: 'MJCF 模型描述', d: 'XML 描述机器人/场景(关节/几何/执行器/接触)' },
      { t: 'MJX(JAX GPU/TPU)', d: '向量化并行仿真,RL 训练加速几个数量级' },
      { t: '传感器 / 执行器建模', d: '力矩/位置/速度执行器、各类传感器,贴近真机' },
    ],
    pros: ['接触动力学又快又准(学界事实标准)', '给解析导数——利于最优控制/可微仿真', 'MJX 上 GPU 大规模并行、RL 训练飞快', 'Apache-2.0 全开源(曾是收费软件)', '模型描述简洁(MJCF)、生态大(dm_control/Playground)'],
    cons: ['渲染/传感仿真不如 Isaac Sim 逼真(偏动力学不偏感知)', '偏研究/算法评测,不是工业数字孪生', '接触是软约束近似、参数要调', '大场景/多相机感知类任务不是强项'],
    coverage: [
      { mod: '接触动力学', d: '摩擦锥 / 接触约束', links: [{ label: '接触动力学·摩擦锥', exp: 'contactlcp' }] },
      { mod: '正向动力学(仿真一步)', d: '力矩→加速度→积分', links: [{ label: '正向动力学', exp: 'fwddyn' }, { label: '机械臂运动方程', exp: 'dyneom' }] },
      { mod: 'RL 训练环境', d: 'MJX/Brax 上大规模 PPO', links: [{ label: 'PPO', exp: 'ppo' }, { label: 'Open Duck Mini(Brax PPO)', exp: 'miniduck' }] },
    ],
    projects: ['学界几乎所有机器人 RL / 控制论文的仿真', 'dm_control、MuJoCo Playground、Brax(JAX)生态', 'Open Duck Mini 等腿式机器人的 sim 训练', '人形/四足运动策略的 sim-to-real 起点'],
    seeAlso: 'GPU 大规模 + 逼真感知看「Isaac Lab」、ROS 部署仿真看「Gazebo」、动力学算子看「Pinocchio」',
  },
  isaaclab: {
    name: 'Isaac Lab', tagline: 'NVIDIA 的 GPU 机器人学习框架——大规模并行训策略、主打 sim-to-real', license: 'BSD-3-Clause', lang: 'Python(基于 Isaac Sim / Omniverse)', latest: '活跃迭代', maintainer: 'NVIDIA',
    whatIs: 'Isaac Lab 是 NVIDIA 开源的**机器人学习框架**,建在 **Isaac Sim**(Omniverse 上的高保真、照片级仿真平台)之上,主打**GPU 大规模并行**训练机器人策略(RL/模仿学习/运动规划)。优势是 GPU 加速 + 逼真渲染 + 传感器仿真 + 工业生态,特别适合**机器人基座模型、RL 策略、sim-to-real 迁移**、复杂交互任务。和 MuJoCo 互补:MuJoCo 精于接触动力学与学术评测,Isaac 强在规模、逼真感知与产业落地。',
    features: [
      { t: 'GPU 大规模并行', d: '数千环境同屏并行、RL 训练吞吐量极高' },
      { t: '高保真物理 + 照片级渲染', d: '基于 Isaac Sim/Omniverse,感知类任务逼真' },
      { t: '传感器仿真', d: 'RGB-D / 激光 / IMU 等,合成数据管线' },
      { t: '学习工作流标准化', d: 'RL/IL/运动规划/任务开发一套接口' },
      { t: 'sim-to-real', d: '域随机化 + 逼真物理,利于迁移到真机' },
    ],
    pros: ['GPU 并行训练吞吐量极高(数千环境)', '照片级渲染 + 传感器仿真,感知/合成数据强', 'sim-to-real 生态成熟、产业支持', '和 RL 库(rl_games/RSL-RL)、VLA 训练打通', 'BSD-3 开源'],
    cons: ['强依赖 NVIDIA GPU / Omniverse 栈(绑硬件)', '体量大、上手门槛高、资源吃得多', 'Isaac Sim 底座偏闭源生态', '轻量算法验证不如 MuJoCo/PyBullet 便捷'],
    coverage: [
      { mod: '大规模 RL 训练', d: 'GPU 并行 PPO 训策略', links: [{ label: 'PPO', exp: 'ppo' }, { label: 'Open Duck Mini', exp: 'miniduck' }] },
      { mod: '策略 / VLA 训练平台', d: '模仿学习、基座模型训练', links: [{ label: 'VLA', exp: 'vla' }, { label: '模仿学习 BC', exp: 'bc' }] },
      { mod: '感知合成数据', d: 'RGB-D/点云合成(喂感知)', links: [{ label: '点云预处理', exp: 'pointcloud' }] },
    ],
    projects: ['人形/四足机器人的大规模 RL 策略训练', '机器人基座模型(如 GR00T)的仿真训练', 'sim-to-real 抓取/操作/移动策略', '工业数字孪生 + 合成数据生成'],
    seeAlso: '接触动力学/学术评测看「MuJoCo」、真机学习看「LeRobot」、VLA 看「OpenVLA」',
  },
  pcl: {
    name: 'PCL(Point Cloud Library)', tagline: '点云处理的老牌标准库——滤波/配准/分割/特征一整套', license: 'BSD-3-Clause', lang: 'C++', latest: '成熟稳定、持续维护', maintainer: '开源社区(原 Willow Garage)',
    whatIs: 'PCL 是 2D/3D 图像与**点云处理**的老牌开源标准库,几乎所有感知项目都用它:**滤波(体素下采样、离群点)、特征(法线估计)、配准(ICP)、分割、曲面重建、模型拟合**一整套。模块化(libpcl_filters / features / registration / segmentation …),文档和例子多。我们「机器人感知」里的点云预处理、法线估计、ICP 配准,原理就对应它的 filters/features/registration 模块。',
    features: [
      { t: '滤波 filters', d: '体素下采样、离群点剔除、直通/投影等' },
      { t: '特征 features', d: '法线估计(PCA)、FPFH 等描述子' },
      { t: '配准 registration', d: 'ICP 及变体(点到点/点到面/非线性)' },
      { t: '分割 segmentation', d: '聚类、RANSAC 模型拟合(平面/圆柱)' },
      { t: '曲面/重建', d: '三角化、泊松重建、KD-Tree/Octree 加速' },
    ],
    pros: ['点云算法一整套、事实标准', '模块化、文档/示例丰富', 'ROS 深度集成(sensor_msgs/PointCloud2)', '成熟稳定、工业界大量使用', 'BSD-3 宽松'],
    cons: ['C++ 为主、编译重、上手门槛高', '偏经典几何算法,深度学习点云(如 PointNet)要另找', 'API 老、部分模块维护慢', '大规模/实时场景要小心性能调优(可看 Open3D)'],
    coverage: [
      { mod: '滤波:体素下采样', d: '降密度、密度均匀化', links: [{ label: '点云预处理·体素下采样', exp: 'pointcloud' }] },
      { mod: '特征:法线估计', d: '邻域协方差 PCA 求法线', links: [{ label: '点云法线(PCA)', exp: 'pointcloud' }] },
      { mod: '配准:ICP', d: '两片点云对齐求位姿', links: [{ label: 'ICP 点云配准', exp: 'icp' }] },
    ],
    projects: ['深度相机/激光雷达的点云处理管线', '3D 重建、抓取位姿估计的前端', 'SLAM 建图里的点云配准(RTAB-Map 大量用 PCL)', '工业 3D 检测/测量'],
    seeAlso: '更现代/Python 的点云看「Open3D」、SLAM 看「ORB-SLAM3 / RTAB-Map」、配准原理看实验「ICP」',
  },
  orbslam3: {
    name: 'ORB-SLAM3', tagline: '精度标杆的视觉/视觉惯性 SLAM——特征点 + 光束平差 + 回环', license: 'GPL-3.0', lang: 'C++', latest: '第三代(视觉+惯性+多地图)', maintainer: 'University of Zaragoza(Raúl Mur-Artal 等)',
    whatIs: 'ORB-SLAM3 是精度标杆的开源 **SLAM**(同时定位与建图)库,支持**单目/双目/RGB-D + IMU** 的视觉/视觉惯性、以及**多地图(Atlas)**。核心:提 **ORB 特征点**→帧间匹配用**对极几何**求相对运动→**PnP** 重定位→**光束平差(Bundle Adjustment)**优化位姿+地图点→**回环检测**闭合累计漂移。我们「机器人感知」里的对极几何/VO、PnP、SLAM 回环,正是它前后端的核心步骤。',
    features: [
      { t: 'ORB 特征 + 匹配', d: '快速角点 + 描述子,帧间/重定位匹配' },
      { t: '前端:对极几何 / PnP', d: '两帧求相对位姿、有地图后用 PnP 重定位' },
      { t: '后端:光束平差 BA', d: '非线性优化位姿 + 3D 地图点(g2o)' },
      { t: '回环检测', d: '词袋(DBoW2)认出旧地、闭合累计漂移' },
      { t: '视觉惯性 + 多地图', d: '融合 IMU、断了能开新地图再合并' },
    ],
    pros: ['精度标杆(轨迹误差常优于同类)', '模式全:单目/双目/RGB-D + IMU', '多地图鲁棒(跟丢能恢复)', '经典完整、研究基线常用'],
    cons: ['**GPL-3.0**——商业闭源产品要小心(传染性)', '稀疏特征法(稠密建图要另配)', 'C++ 重、参数多、算力要求不低', '纯旋转/低纹理/动态场景仍会退化'],
    coverage: [
      { mod: '前端:对极几何 / VO', d: '两帧匹配求相对运动', links: [{ label: '视觉里程计·对极几何', exp: 'vo' }] },
      { mod: '重定位:PnP', d: '有地图点后 2D-3D 求位姿', links: [{ label: 'PnP·6D 位姿', exp: 'pnp' }] },
      { mod: '回环 + 位姿图优化', d: '认出旧地、分摊漂移', links: [{ label: 'SLAM 回环校正', exp: 'slam' }] },
    ],
    projects: ['AR/VR、无人机、移动机器人的定位建图', '自动驾驶/巡检的视觉惯性里程计', 'SLAM 研究的对比基线', '手持相机三维重建的位姿源'],
    seeAlso: '激光+视觉大场景 SLAM 看「RTAB-Map / Cartographer」、点云看「PCL/Open3D」、原理看实验「VO/PnP/SLAM」',
  },
  ros2control: {
    name: 'ros2_control', tagline: 'ROS 2 的实时控制框架——硬件抽象 + 控制器管理器', license: 'Apache-2.0', lang: 'C++ / Python', latest: '随 ROS 2 发行版更新', maintainer: 'ROS Control 工作组 + 社区',
    whatIs: 'ros2_control 是 ROS 2 的**实时控制框架**:把「硬件(真机/仿真)」抽象成统一接口,**控制器管理器(controller_manager)**在实时循环里加载/切换各种**控制器**(关节轨迹、PID、力控/导纳…),控制器读状态、写命令到硬件。它把上层规划(如 MoveIt 出的轨迹)和底层电机/驱动接起来——是"规划→执行"这一环的标准。我们「机器人控制」里的 PID、阻抗/力控,正是它里面的控制器。',
    features: [
      { t: '硬件抽象(HardwareInterface)', d: '真机/仿真统一成 state/command 接口' },
      { t: '控制器管理器', d: '实时循环加载/切换控制器、热插拔' },
      { t: '关节轨迹控制器', d: '收 MoveIt 的轨迹、插值下发到关节' },
      { t: 'PID / 力控 / 导纳控制器', d: '位置/速度/力矩多种控制律' },
      { t: '和 Gazebo/真机打通', d: '同一套控制器 sim 与真机通用' },
    ],
    pros: ['ROS 2 里"规划→执行"的标准中间层', '硬件抽象:换真机/仿真控制器不用改', '控制器可热插拔、实时循环', '和 MoveIt/Gazebo 无缝衔接'],
    cons: ['概念多(HW interface/controller/broadcaster)配置繁', '硬实时依赖底层 RT 内核/驱动', '和 ROS 强耦合', '写自定义硬件接口需要功底'],
    coverage: [
      { mod: 'PID 控制器', d: '位置/速度闭环反馈', links: [{ label: 'PID 控制', exp: 'pid' }] },
      { mod: '力控 / 导纳控制器', d: '柔顺接触、力位混合', links: [{ label: '阻抗/力控', exp: 'impedance' }] },
      { mod: '关节轨迹控制器', d: '轨迹插值下发(时间参数化)', links: [{ label: '轨迹规划', exp: 'trajectory' }, { label: '梯形速度曲线', exp: 'trapezoid' }] },
    ],
    projects: ['机械臂真机/仿真的关节控制(配 MoveIt)', '移动底盘、四足/人形的关节执行层', '工业机器人的 ROS 2 化改造', '各类真机驱动的统一控制接口'],
    seeAlso: '规划出轨迹给它执行的是「MoveIt 2」、电流环最内层是「SimpleFOC」、控制律原理看实验「PID/阻抗」',
  },
  nav2: {
    name: 'Nav2(Navigation 2)', tagline: 'ROS 2 移动机器人自主导航栈——行为树 + 代价图 + 规划/控制插件', license: 'Apache-2.0', lang: 'C++ / Python', latest: '随 ROS 2 发行版更新', maintainer: 'ros-navigation 社区(Open Navigation)',
    whatIs: 'Nav2 是 ROS 2 上**移动机器人自主导航**的标准栈:从 A 点安全避障走到 B 点。用**行为树**编排整个导航流程,**代价图(costmap)**融合传感器建障碍层(含膨胀层),**全局规划器**(NavFn=Dijkstra/A*、Smac=混合 A*+Reeds-Shepp/Dubins、Theta*)算路径,**局部控制器**(DWB、MPPI)跟踪并避动态障碍,加**恢复行为**。它是 MoveIt 的"移动版"——MoveIt 管机械臂、Nav2 管底盘。我们「运动规划」里的 Dubins、势场、MPC 都能在它里面找到对应。',
    features: [
      { t: '行为树编排', d: '整个导航流程(规划/跟踪/恢复)用 BT 组织' },
      { t: '代价图 costmap', d: '静态/障碍/膨胀/语义层融合传感器' },
      { t: '全局规划器', d: 'NavFn(Dijkstra/A*)、Smac(混合 A*+Dubins/Reeds-Shepp)、Theta*' },
      { t: '局部控制器', d: 'DWB(动态窗口)、MPPI(模型预测路径积分)' },
      { t: '恢复行为', d: '卡住时旋转/后退/清代价图重试' },
    ],
    pros: ['ROS 2 移动导航的事实标准、插件化', '规划/控制/恢复各层可换插件', 'Smac 支持车式(Ackermann)非完整约束', 'MPPI 控制平滑、能处理动态约束'],
    cons: ['配置庞大(一堆 yaml + BT)、调参门槛高', '偏 2D/2.5D 导航(3D/腿足要另做)', '和 ROS 强耦合、依赖定位(AMCL/SLAM)', '动态密集环境仍具挑战'],
    coverage: [
      { mod: 'Smac 混合 A* 规划器', d: '车式非完整约束、局部接 Reeds-Shepp/Dubins', links: [{ label: 'Dubins 曲线', exp: 'dubins' }] },
      { mod: '膨胀层代价图', d: '障碍向外膨胀成"斥力场"', links: [{ label: '人工势场法', exp: 'potentialfield' }] },
      { mod: 'MPPI 局部控制', d: '采样多条轨迹选最优(预测控制)', links: [{ label: 'MPC 模型预测控制', exp: 'mpc' }] },
      { mod: '全局重规划', d: '地图变化时重规划(增量思想)', links: [{ label: 'D* Lite 增量重规划', exp: 'dstarlite' }] },
    ],
    projects: ['扫地机/送餐机器人/仓储 AGV 的导航', '自动驾驶小车、巡检机器人', 'The Marathon(长时间自主导航)基准', '各类移动底盘的开箱导航'],
    seeAlso: '机械臂规划看「MoveIt 2」、定位建图看「ORB-SLAM3」、规划原理看实验「Dubins/势场/D*Lite」',
  },
  openvla: {
    name: 'OpenVLA', tagline: '开源视觉-语言-动作基座模型(7B)——看图听指令直接出动作', license: 'MIT', lang: 'Python(PyTorch)', latest: '7B;后续有 OFT/FAST 等加速', maintainer: 'Stanford / Google 等(开源社区)',
    whatIs: 'OpenVLA 是**开源视觉-语言-动作(VLA)基座模型**:输入相机图 + 语言指令,直接输出机器人**动作**。7B 参数,视觉编码器融合 **DINOv2 + SigLIP**、语言基座 **Llama 2**,在 **Open X-Embodiment 的 97 万条真机演示**上训练。动作被**离散化成 token**由语言模型自回归生成(和我们「具身学习」里 VLA 的动作 token 化、ACT 分块是同一思路)。是把"大模型能力搬进机器人操作"的代表开源工作。',
    features: [
      { t: '视觉-语言-动作端到端', d: '图 + 指令 → 动作,一个模型打通' },
      { t: '强视觉基座', d: 'DINOv2 + SigLIP 融合特征、泛化好' },
      { t: '语言基座 Llama 2', d: '7B,自回归生成离散动作 token' },
      { t: '大规模真机数据训练', d: 'Open X-Embodiment 97 万条演示' },
      { t: '高效微调 / 加速', d: 'LoRA 微调;OFT/FAST 大幅提速推理' },
    ],
    pros: ['开源 VLA 基座、可自己微调', '强视觉泛化(DINOv2+SigLIP)', '大规模跨机型数据训练、泛化到新任务', '生态活跃(加速/微调方法多)'],
    cons: ['7B 推理算力要求高、实时性要靠 OFT/FAST 优化', '动作离散化有精度/频率取舍', '仍依赖数据分布、长程/精细操作有限', '上真机要解决频率、安全、标定'],
    coverage: [
      { mod: '动作 token 化', d: '连续动作离散成 token 自回归生成', links: [{ label: 'VLA(视觉-语言-动作)', exp: 'vla' }] },
      { mod: '模仿学习范式', d: '从演示学策略', links: [{ label: '模仿学习 BC', exp: 'bc' }, { label: 'ACT 动作分块', exp: 'actte' }] },
      { mod: '生成式策略邻居', d: '扩散策略是另一条路', links: [{ label: 'Diffusion Policy', exp: 'diffpolicy' }] },
    ],
    projects: ['桌面抓取/操作的通用策略', '跨机型泛化(Open X-Embodiment)', 'π0 / RDT / GR00T 等 VLA 的同类对照', '把 VLA 接到低成本真机(配 LeRobot)'],
    seeAlso: '真机部署看「LeRobot」、仿真训练看「Isaac Lab」、原理看实验「VLA/BC/ACT/Diffusion Policy」',
  },
  simplefoc: {
    name: 'SimpleFOC', tagline: '几行 Arduino 代码搞定无刷电机磁场定向控制——最亲民的 FOC 库', license: 'MIT', lang: 'C++（Arduino / PlatformIO）', latest: '持续迭代', maintainer: 'SimpleFOC 社区',
    whatIs: 'SimpleFOC(Arduino-FOC)是最亲民的开源**磁场定向控制(FOC)**库,给**无刷(BLDC)/步进电机**做平滑的力矩/速度/位置控制。它把复杂的 Clarke/Park 变换、SVPWM、电流环封成几行 Arduino 代码,支持一堆电机+传感器+驱动+单片机组合。我们「具身项目实战」里的 FOC 电流环(稚晖君 Dummy-Robot 那条)拆的就是它这类库背后的标准算法。是机器人关节驱动最底层的一环。',
    features: [
      { t: 'FOC 电流环', d: 'Clarke/Park 变换 + 两个 PI + 逆变换 + SVPWM' },
      { t: '力矩/速度/位置控制', d: '级联环:位置→速度→电流(力矩)' },
      { t: '多电机/传感器/驱动', d: 'BLDC/步进 + 编码器/霍尔/磁编 + 各类驱动板' },
      { t: 'Arduino/PlatformIO', d: '几行代码上手,跨 MCU(STM32/ESP32 等)' },
      { t: '调参/监控工具', d: 'SimpleFOCStudio 实时调 PID/看波形' },
    ],
    pros: ['极其亲民:几行代码控无刷电机', '跨平台(一堆 MCU/驱动/传感器)', '把 FOC 数学封装好、教学与 DIY 首选', 'MIT 宽松、社区活跃'],
    cons: ['面向爱好者/中小功率,不是工业伺服级', 'Arduino 生态算力/实时有限(高转速吃紧)', '高性能需搭好硬件(电流采样/驱动)', '大规模多轴/总线需自己搭'],
    coverage: [
      { mod: 'FOC 电流环', d: 'Clarke→Park→PI→逆变换+SVPWM', links: [{ label: 'FOC 磁场定向控制', exp: 'foc' }] },
      { mod: '级联 PID', d: '位置→速度→电流三环', links: [{ label: 'PID 控制', exp: 'pid' }] },
    ],
    projects: ['稚晖君 Dummy-Robot 关节驱动(Ctrl-FOC-Lite 基于 SimpleFOC)', 'DIY 机械臂/云台/力反馈手柄的关节', '低成本无刷云台/平衡车', '机器人教育/创客的电机控制'],
    seeAlso: '上层关节控制看「ros2_control」、驱动的关节用在「MoveIt/LeRobot」、原理看实验「FOC/PID」',
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
