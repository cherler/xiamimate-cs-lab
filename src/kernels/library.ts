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
  // ── 大模型轨 · 软件库与框架 ──
  pytorch: {
    name: 'PyTorch', tagline: '深度学习的地基——张量 + 自动求导 + 动态图,几乎所有大模型都在它上面写', license: 'BSD-3-Clause', lang: 'Python / C++ / CUDA', latest: 'PyTorch 2.x(torch.compile)', maintainer: 'PyTorch Foundation(Linux Foundation)/ 原 Meta',
    whatIs: 'PyTorch 是当今深度学习的**事实标准框架**:核心是**张量(带 GPU 加速)+ 自动求导(autograd)+ 动态计算图**,加上 nn 模块、优化器、分布式。你在实验里手推的**前向传播、注意力、矩阵运算**,写成代码几乎都是几行 PyTorch。大模型的训练/推理栈(Transformers/vLLM/DeepSpeed…)全部建在它之上;2.x 的 torch.compile 把图编译加速。',
    features: [
      { t: '张量 + GPU', d: '多维数组 + CUDA 加速,像 NumPy 但能跑 GPU、能求导' },
      { t: '自动求导 autograd', d: '动态记录计算图、反向传播自动算梯度' },
      { t: 'nn 模块 + 优化器', d: 'Linear/Attention/LayerNorm… + SGD/Adam,搭网络' },
      { t: '动态图(define-by-run)', d: '边跑边建图、调试直观(对比静态图)' },
      { t: 'torch.compile / 分布式', d: '2.x 图编译加速;DDP/FSDP 多卡训练' },
    ],
    pros: ['生态最大、几乎所有大模型代码用它', '动态图调试直观、上手快', 'GPU/自动求导开箱即用', 'torch.compile 逼近静态图性能', '产学两界事实标准'],
    cons: ['是通用框架、不是"开箱推理服务"(那要 vLLM 等)', '大模型训练要配 DeepSpeed/Megatron 做并行', 'Python 开销、极致部署常转 C++/TensorRT', '版本/CUDA 兼容偶尔踩坑'],
    coverage: [
      { mod: '前向传播 / 张量运算', d: '矩阵乘、激活、层', links: [{ label: '前向传播', exp: 'forward' }, { label: '维度/规模', exp: 'llmsize' }] },
      { mod: '注意力实现', d: 'QK^T/softmax/加权和', links: [{ label: '手写注意力', exp: 'attention' }, { label: '多头注意力', exp: 'mha' }] },
    ],
    projects: ['几乎所有大模型的训练/推理代码底座', 'Transformers/vLLM/DeepSpeed/LeRobot 都建在其上', 'CV/NLP/RL/科学计算通用', '研究论文复现的默认框架'],
    seeAlso: '模型实现看「HF Transformers」、大规模训练看「DeepSpeed/Megatron-LM」、部署推理看「vLLM/TensorRT-LLM」',
  },
  transformers: {
    name: 'Hugging Face Transformers', tagline: '模型界的"应用商店"——几行代码加载/微调几十万个预训练模型', license: 'Apache-2.0', lang: 'Python(PyTorch / JAX / TF)', latest: '活跃迭代', maintainer: 'Hugging Face + 社区',
    whatIs: 'Transformers 是 Hugging Face 的模型库:把**几十万个预训练模型**(GPT/LLaMA/BERT/Qwen…)统一成一套 API,`from_pretrained` 几行就能加载、推理、微调。配套 **Tokenizers**(BPE/WordPiece 分词)、**Datasets**、**PEFT**(LoRA 微调)、**TRL**(RLHF/DPO)。你实验里的注意力、多头、BPE 分词、RoPE、RMSNorm、采样,在它里面都是现成模块。是"用大模型"的门户。',
    features: [
      { t: '统一模型 API', d: 'from_pretrained/generate,几十万模型同一套接口' },
      { t: 'Tokenizers 分词', d: 'BPE/WordPiece/Unigram,快速分词器(Rust)' },
      { t: '架构实现', d: '注意力/多头/RoPE/RMSNorm/各种 Transformer 变体' },
      { t: '生成/采样', d: 'greedy/beam/top-k/top-p/温度采样' },
      { t: '生态', d: '配 PEFT(LoRA)、TRL(对齐)、Datasets、Hub 共享' },
    ],
    pros: ['模型最全、加载/微调极简', 'Hub 生态(模型/数据集一键取)', '跨后端(PyTorch/JAX/TF)', '文档社区强、更新快', '和 PEFT/TRL/Accelerate 打通'],
    cons: ['推理吞吐不如专用引擎(生产要 vLLM/TGI)', '大而全、依赖重', '默认实现未必最优(要 FlashAttention 等加速)', '版本 API 变动较频繁'],
    coverage: [
      { mod: '注意力 / 架构', d: '多头注意力、RoPE、RMSNorm', links: [{ label: '多头注意力', exp: 'mha' }, { label: 'RoPE 旋转位置编码', exp: 'rope' }, { label: 'RMSNorm', exp: 'rmsnorm' }] },
      { mod: '分词 Tokenizers', d: 'BPE 子词切分', links: [{ label: 'BPE 分词', exp: 'bpe' }] },
      { mod: '生成采样', d: 'top-k/top-p/温度、束搜索', links: [{ label: '采样策略', exp: 'sampling' }, { label: '束搜索', exp: 'beam' }] },
    ],
    projects: ['加载/微调开源大模型做应用', 'LoRA/QLoRA 领域微调(配 PEFT)', 'RLHF/DPO 对齐(配 TRL)', '几乎所有"用现成模型"的项目起点'],
    seeAlso: '底座看「PyTorch」、高吞吐部署看「vLLM/TensorRT-LLM」、微调看「PEFT」、注意力加速看「FlashAttention」',
  },
  vllm: {
    name: 'vLLM', tagline: '高吞吐 LLM 推理引擎——PagedAttention 把 KV 缓存当"虚拟内存分页"', license: 'Apache-2.0', lang: 'Python / CUDA', latest: '活跃迭代', maintainer: 'vLLM 项目(源自 UC Berkeley Sky Computing)',
    whatIs: 'vLLM 是主流的**高吞吐 LLM 推理/服务引擎**。它的招牌创新是 **PagedAttention**:把 KV 缓存像操作系统的**虚拟内存分页**一样管理——分块、按需分配、跨请求共享(如共同前缀),几乎消除显存碎片、显著提高吞吐。配 **continuous batching(连续批处理)**、**chunked prefill**、**speculative decoding**。你「大模型推理」里的 KV Cache、PagedAttention、连续批处理、分块预填充、投机解码,原理就来自它。',
    features: [
      { t: 'PagedAttention', d: 'KV 缓存分块管理(仿 OS 分页)、跨请求共享、消碎片' },
      { t: '连续批处理', d: '请求动态进出同一批、GPU 打满、吞吐高' },
      { t: 'chunked prefill', d: '长 prompt 预填充切块、和解码交织、降尾延迟' },
      { t: '投机解码', d: '小模型草稿 + 大模型验证、提速' },
      { t: 'OpenAI 兼容服务', d: '一行起服务、张量并行多卡' },
    ],
    pros: ['吞吐领先、显存利用率高(PagedAttention)', '开箱即用的 OpenAI 兼容服务', '连续批处理/投机解码/前缀缓存全有', '社区大、模型支持快'],
    cons: ['主要面向 GPU 服务(端侧看 llama.cpp)', '极致单卡延迟不一定胜 TensorRT-LLM', '功能多、调优项不少', '大 batch 显存/调度要理解'],
    coverage: [
      { mod: 'PagedAttention / KV 缓存', d: 'KV 分块、跨请求共享', links: [{ label: 'PagedAttention', exp: 'paged' }, { label: 'KV Cache', exp: 'kvcache' }] },
      { mod: '连续批处理', d: '请求动态进出同批', links: [{ label: '连续批处理', exp: 'batching' }, { label: '分块预填充', exp: 'chunkprefill' }] },
      { mod: '投机解码', d: '草稿模型加速', links: [{ label: '投机解码', exp: 'specdec' }] },
    ],
    projects: ['大模型 API 服务/聊天后端的高吞吐部署', 'RAG/Agent 后端的推理层', '批量离线推理(数据标注/合成)', '开源模型的自托管服务'],
    seeAlso: '结构化/前缀复用更强看「SGLang」、NVIDIA 极致看「TensorRT-LLM」、端侧看「llama.cpp」、注意力核看「FlashAttention」',
  },
  sglang: {
    name: 'SGLang', tagline: '结构化 LLM 服务引擎——RadixAttention 用基数树自动复用 KV 缓存', license: 'Apache-2.0', lang: 'Python / CUDA', latest: 'v0.5.x(2026)', maintainer: 'SGLang 社区(2026 商业化为 RadixArk)',
    whatIs: 'SGLang 是高性能 **LLM 服务引擎 + 结构化生成前端**。核心创新 **RadixAttention**:用**基数树(radix tree)**按 token 前缀组织 KV 缓存块,**自动、细粒度复用**共享前缀的缓存(多轮对话/RAG/few-shot 前缀重复时特别快)。前端 DSL 方便写多步/受约束(JSON/正则)生成。也支持连续批处理、张量并行。你实验里的 RadixAttention、KV Cache 复用就对应它。',
    features: [
      { t: 'RadixAttention', d: '基数树组织 KV、按前缀自动复用缓存' },
      { t: '结构化生成', d: 'DSL + 受约束解码(JSON/正则/选择)' },
      { t: '连续批处理 + 张量并行', d: '高吞吐服务、多卡' },
      { t: '前缀缓存友好', d: '多轮/RAG/few-shot 共享前缀命中率高' },
      { t: 'OpenAI 兼容', d: '易替换现有服务' },
    ],
    pros: ['前缀复用强(RAG/多轮场景吞吐大幅领先)', '结构化/受约束生成一等公民', '吞吐常胜过 vLLM(基准显示 H100 上更高)', '社区活跃、迭代快'],
    cons: ['相对新、生态/文档不如 vLLM 厚', '收益依赖前缀重复场景', '端侧非目标(看 llama.cpp)', '快速迭代、API 变动'],
    coverage: [
      { mod: 'RadixAttention', d: '基数树复用 KV 缓存', links: [{ label: 'RadixAttention 前缀复用', exp: 'radix' }, { label: 'KV Cache', exp: 'kvcache' }] },
      { mod: '连续批处理', d: '高吞吐调度', links: [{ label: '连续批处理', exp: 'batching' }] },
    ],
    projects: ['RAG/多轮对话/Agent 的高吞吐后端', '需要 JSON/结构化输出的服务', 'few-shot 前缀重复的批量推理', '和 vLLM 竞争的自托管服务'],
    seeAlso: '通用高吞吐看「vLLM」、NVIDIA 极致看「TensorRT-LLM」、原理看实验「RadixAttention/KV Cache」',
  },
  tensorrtllm: {
    name: 'TensorRT-LLM', tagline: 'NVIDIA GPU 上的极致推理——把 LLM 编译成高度优化的运行时', license: 'Apache-2.0', lang: 'Python API / C++ 运行时 / CUDA', latest: '活跃迭代(支持 Blackwell NVFP4 等)', maintainer: 'NVIDIA',
    whatIs: 'TensorRT-LLM 是 NVIDIA 的 LLM 推理库:用 Python API 定义模型、**编译成 TensorRT 引擎**,在 NVIDIA GPU 上做**极致优化推理**(算子融合、量化 INT8/FP8/NVFP4、in-flight batching、张量/流水并行)。在 NVIDIA GPU 上通常吞吐/延迟最优(比 vLLM 高约 10-20%),代价是要编译、绑 NVIDIA 硬件。你实验里的量化、张量并行、推理引擎对应它。',
    features: [
      { t: '编译式引擎', d: '模型→TensorRT 引擎、算子融合、内核自动调优' },
      { t: '量化', d: 'INT8/FP8/NVFP4(Blackwell),吞吐/显存双降' },
      { t: 'in-flight batching', d: '连续批处理的 NVIDIA 实现' },
      { t: '张量/流水并行', d: '多卡多机大模型推理' },
      { t: 'Triton 集成', d: '配 Triton Inference Server 上生产' },
    ],
    pros: ['NVIDIA GPU 上吞吐/延迟通常最优', '量化(FP8/NVFP4)成熟、显存友好', '和 Triton/NeMo 生产栈打通', '编译优化榨干硬件'],
    cons: ['要编译引擎、上手复杂(不如 vLLM 直接)', '强绑 NVIDIA 硬件、换硬件要重编', '灵活性低于 PyTorch 原生', 'vLLM 以 85% 性能换来低得多的运维复杂度'],
    coverage: [
      { mod: '量化', d: 'INT8/FP8/NVFP4', links: [{ label: '量化', exp: 'quant' }] },
      { mod: '张量/流水并行', d: '多卡切模型', links: [{ label: '张量并行', exp: 'tensorpar' }, { label: '流水并行', exp: 'pp' }] },
      { mod: '推理引擎 + 注意力核', d: '编译运行时、FlashAttention 类核', links: [{ label: '推理引擎', exp: 'engine' }, { label: 'FlashAttention', exp: 'flash' }] },
    ],
    projects: ['NVIDIA GPU 上的生产级 LLM 服务', '低延迟/高吞吐的商用推理', '配 Triton 的企业部署', 'Jetson/DRIVE 边缘(TensorRT Edge-LLM)'],
    seeAlso: '易用高吞吐看「vLLM」、结构化看「SGLang」、端侧 CPU 看「llama.cpp」、原理看实验「量化/张量并行」',
  },
  llamacpp: {
    name: 'llama.cpp', tagline: '在你的笔记本/手机上跑大模型——C++ + GGUF 量化,不用 GPU', license: 'MIT', lang: 'C / C++(ggml)', latest: '活跃迭代', maintainer: 'Georgi Gerganov + 社区',
    whatIs: 'llama.cpp 是把大模型跑到**普通设备(CPU/Apple Silicon/手机)**上的开源框架,基于自研张量库 **ggml**、模型用 **GGUF** 格式 + **量化**(如 Q4_K_M)大幅压显存/内存。不需要 GPU 就能跑 Llama/Qwen/Mistral/Gemma。是**端侧/本地 LLM** 的事实标准(Ollama 等就封装它)。你实验里的量化、KV Cache 就是它落地的核心。',
    features: [
      { t: 'GGUF + 量化', d: 'Q2~Q8 多档量化、Q4_K_M 跨设备通用、显存骤降' },
      { t: 'ggml 张量库', d: '自研 C/C++ 张量库、无重依赖、可移植' },
      { t: 'CPU / Apple Silicon / GPU', d: '不用 GPU 也能跑、也支持 Metal/CUDA 卸载' },
      { t: 'KV 缓存 + 采样', d: '本地推理的缓存与各种采样' },
      { t: '极致可移植', d: '树莓派/手机/浏览器(wasm)都能跑' },
    ],
    pros: ['本地/端侧 LLM 事实标准、无需 GPU', 'GGUF 量化跨设备通用、部署极简', '依赖轻、可移植性极强', '社区活跃、模型支持快(Ollama 封装它)'],
    cons: ['吞吐不如 GPU 服务引擎(vLLM/TRT-LLM)', '大模型/高并发非强项', '量化有精度损失(低档更明显)', '训练不归它(纯推理)'],
    coverage: [
      { mod: '量化(GGUF)', d: 'Q4/Q5/Q8 权重量化', links: [{ label: '量化', exp: 'quant' }] },
      { mod: 'KV 缓存 + 采样', d: '本地推理缓存与采样', links: [{ label: 'KV Cache', exp: 'kvcache' }, { label: '采样策略', exp: 'sampling' }] },
    ],
    projects: ['笔记本/手机/树莓派本地跑大模型', 'Ollama、LM Studio 等桌面工具的底层', '离线/隐私敏感场景的本地推理', '边缘设备的轻量部署'],
    seeAlso: 'GPU 高吞吐看「vLLM/TensorRT-LLM」、封装它的桌面工具是 Ollama、原理看实验「量化/KV Cache」',
  },
  flashattn: {
    name: 'FlashAttention', tagline: 'IO 感知的精确注意力内核——省显存又更快,还不近似', license: 'BSD-3-Clause', lang: 'CUDA / C++ / Python', latest: 'FA-2 / FA-3(Hopper)/ FA-4(Hopper+Blackwell)', maintainer: 'Tri Dao 等',
    whatIs: 'FlashAttention 是一个**注意力的高性能 GPU 内核**:通过 **IO 感知**(把注意力计算**分块、在片上 SRAM 里做**、避免把巨大的 N×N 注意力矩阵写回显存)+ 在线 softmax,做到**又快又省显存、且是精确注意力(不近似)**。它几乎是现代大模型训练/推理的默认注意力实现。FA-2 再翻倍、FA-3 优化 Hopper、FA-4 面向 Blackwell。你实验里的 FlashAttention、Flash-Decoding 就是它。',
    features: [
      { t: 'IO 感知分块', d: '注意力分块进 SRAM 算、不落地 N×N 矩阵' },
      { t: '在线 softmax', d: '流式累加、无需完整行、省显存' },
      { t: '精确(不近似)', d: '和标准注意力数学等价、只是更省更快' },
      { t: 'Flash-Decoding', d: '解码期按 KV 长度并行、长上下文更快' },
      { t: '多代优化', d: 'FA-2 翻倍、FA-3 Hopper、FA-4 Blackwell' },
    ],
    pros: ['显存 O(N) 而非 O(N²)、能训更长上下文', '精确、可直接替换标准注意力', '训练/推理都提速(现代默认)', 'PyTorch/Transformers/推理引擎都集成'],
    cons: ['是内核库、要匹配 GPU 架构/CUDA 版本', '主要吃 NVIDIA GPU(其他后端另说)', '接入需模型支持对应接口', '前沿版本(FA-3/4)对新卡才最优'],
    coverage: [
      { mod: 'FlashAttention 内核', d: '分块 + 在线 softmax、省显存', links: [{ label: 'FlashAttention', exp: 'flash' }, { label: '手写注意力', exp: 'attention' }] },
      { mod: 'Flash-Decoding', d: '解码期按 KV 并行', links: [{ label: 'Flash-Decoding', exp: 'flashdecode' }] },
      { mod: '掩码注意力', d: '缩放点积 + 掩码', links: [{ label: '缩放点积/掩码', exp: 'scaledmask' }] },
    ],
    projects: ['几乎所有现代大模型的训练/推理注意力', '长上下文模型的关键使能', 'Transformers/vLLM/TensorRT-LLM 集成', 'Hopper/Blackwell 上的极致注意力'],
    seeAlso: '被「HF Transformers/vLLM/TensorRT-LLM」集成、原理看实验「FlashAttention/Flash-Decoding/缩放点积」',
  },
  megatron: {
    name: 'Megatron-LM', tagline: 'NVIDIA 的大模型并行训练引擎——张量/流水/专家并行的参考实现', license: 'Apache-2.0', lang: 'Python(PyTorch)/ CUDA', latest: 'Megatron-Core(NeMo 底层)', maintainer: 'NVIDIA',
    whatIs: 'Megatron-LM 是 NVIDIA 的**超大模型并行训练**框架,当模型大到单卡放不下、甚至 ZeRO 也不够时,靠**切开计算本身**来训。**Megatron-Core** 提供五种并行:**张量并行 TP、流水并行 PP、数据并行 DP、专家并行 EP、上下文并行 CP**。它是 NVIDIA NeMo 及众多社区项目的底层。你实验里的张量并行、流水并行、专家并行、集合通信,原理就来自它这类框架。',
    features: [
      { t: '张量并行 TP', d: '把一层的矩阵切到多卡、算完 all-reduce 合' },
      { t: '流水并行 PP', d: '按层切到多卡、微批流水填满' },
      { t: '专家并行 EP', d: 'MoE 的专家分到不同卡' },
      { t: '上下文并行 CP', d: '长序列按上下文切分' },
      { t: 'Megatron-Core 库', d: 'GPU 优化的可组合训练积木、NeMo 底层' },
    ],
    pros: ['超大模型(>70B/多节点)训练的参考实现', '五种并行组合、把集群榨满', 'MoE 大规模训练成熟(Megatron-Core)', 'NeMo/社区广泛采用'],
    cons: ['门槛高、配置复杂(并行策略要懂)', '强绑 NVIDIA GPU/集群', '偏训练、非推理服务', '和 DeepSpeed 常需取舍/结合'],
    coverage: [
      { mod: '张量 / 流水并行', d: '切计算到多卡', links: [{ label: '张量并行', exp: 'tensorpar' }, { label: '流水并行', exp: 'pp' }] },
      { mod: '专家并行(MoE)', d: '专家分卡', links: [{ label: '专家并行', exp: 'ep' }, { label: 'MoE 混合专家', exp: 'moe' }] },
      { mod: '集合通信', d: 'all-reduce/all-gather', links: [{ label: '集合通信', exp: 'collective' }] },
    ],
    projects: ['GPT/LLaMA 级大模型的预训练', 'MoE 万亿参数训练(Megatron-Core)', 'NVIDIA NeMo 的训练底座', '各大厂/实验室的大模型训练'],
    seeAlso: 'ZeRO/显存优化看「DeepSpeed」、底座「PyTorch」、原理看实验「张量并行/流水并行/专家并行/集合通信」',
  },
  deepspeed: {
    name: 'DeepSpeed', tagline: '微软的大模型训练优化库——ZeRO 把优化器状态切开,单卡也能训大模型', license: 'Apache-2.0', lang: 'Python(PyTorch)/ CUDA', latest: '活跃迭代', maintainer: 'Microsoft',
    whatIs: 'DeepSpeed 是微软的大模型训练/推理**优化库**,招牌是 **ZeRO(零冗余优化器)**:把**优化器状态、梯度、参数**分片到多卡(ZeRO-1/2/3),消除数据并行里的冗余显存,让**单卡放不下的大模型也能训**;还有 **ZeRO-Offload/Infinity**(卸载到 CPU/NVMe)、**MoE** 训练、**DeepSpeed-Inference**。常和 Megatron-LM 结合(Megatron-DeepSpeed)。你实验里的 MoE、KV 卸载、张量并行、集合通信对应它。',
    features: [
      { t: 'ZeRO 分片', d: '优化器状态/梯度/参数切到多卡(ZeRO-1/2/3)' },
      { t: 'Offload / Infinity', d: '把状态卸载到 CPU/NVMe、单卡训超大模型' },
      { t: 'MoE 训练', d: '大规模混合专家训练支持' },
      { t: 'DeepSpeed-Inference', d: '推理的张量并行 + 内核优化 + KV 卸载' },
      { t: '混合精度 / 流水', d: 'fp16/bf16、流水并行、和 Megatron 结合' },
    ],
    pros: ['ZeRO 大幅省显存、平民也能训大模型', 'Offload 到 CPU/NVMe 训超大模型', 'MoE/推理/训练一整套', '和 PyTorch/Transformers/Megatron 打通'],
    cons: ['配置项多、调优有门槛', 'Offload 换来的是速度下降(带宽瓶颈)', '偏训练侧(推理服务看 vLLM/TRT-LLM)', '和 Megatron/FSDP 需选型'],
    coverage: [
      { mod: 'MoE 训练', d: '专家分卡训练', links: [{ label: 'MoE 混合专家', exp: 'moe' }] },
      { mod: 'KV / 状态卸载', d: '卸载到 CPU/NVMe', links: [{ label: 'KV 卸载', exp: 'kvoffload' }] },
      { mod: '张量并行 + 集合通信', d: '多卡切分 + all-reduce', links: [{ label: '张量并行', exp: 'tensorpar' }, { label: '集合通信', exp: 'collective' }] },
    ],
    projects: ['单/多卡训练大模型(ZeRO)', 'Megatron-DeepSpeed 训超大模型', 'RLHF/微调的显存优化', '企业/研究的大模型训练降本'],
    seeAlso: '张量/流水并行参考看「Megatron-LM」、底座「PyTorch」、原理看实验「MoE/KV 卸载/张量并行」',
  },
  peft: {
    name: 'PEFT(LoRA)', tagline: '参数高效微调——只训极少参数(LoRA),消费级显卡也能微调大模型', license: 'Apache-2.0', lang: 'Python(PyTorch)', latest: '活跃迭代', maintainer: 'Hugging Face + 社区',
    whatIs: 'PEFT(Parameter-Efficient Fine-Tuning)是 Hugging Face 的**参数高效微调**库:**冻结大模型主体、只训极少量新增参数**。最有名的是 **LoRA**(在权重旁加低秩矩阵 A·B、只训 A/B);配 **QLoRA**(4-bit 量化基座 + LoRA)后,**消费级单卡就能微调几十亿参数模型**。还有 Prefix/Prompt Tuning、IA³ 等。和 Transformers/TRL 无缝。它把"微调大模型"从大厂特权变成人人可做。',
    features: [
      { t: 'LoRA', d: '权重旁挂低秩 A·B、只训这两个小矩阵' },
      { t: 'QLoRA', d: '4-bit 量化基座 + LoRA、显存骤降' },
      { t: '多种 PEFT 方法', d: 'Prefix/Prompt Tuning、IA³、AdaLoRA…' },
      { t: '适配器可插拔', d: '一个基座挂多个 LoRA、按任务切换' },
      { t: '和 HF 生态无缝', d: '配 Transformers/TRL/Accelerate' },
    ],
    pros: ['显存/成本骤降(消费级卡能微调)', 'LoRA 权重小、易存易分发易切换', '效果接近全量微调', '和 Transformers/TRL 打通、上手快'],
    cons: ['冻结主体、极端任务不如全量微调', '秩/目标层等超参要调', '推理时合并/挂载有工程细节', '仍依赖一个好的预训练基座'],
    coverage: [
      { mod: 'QLoRA(量化 + 低秩)', d: '4-bit 基座 + LoRA', links: [{ label: '量化', exp: 'quant' }] },
      { mod: '低秩适配', d: '参数量与规模权衡', links: [{ label: '维度/规模', exp: 'llmsize' }] },
    ],
    projects: ['消费级卡上给开源大模型做领域微调', '一个基座挂多套 LoRA 服务多任务', 'QLoRA 低成本指令微调', '和 TRL 做 RLHF/DPO 对齐'],
    seeAlso: '模型/微调入口「HF Transformers」、底座「PyTorch」、量化原理看实验「量化」',
  },
  langgraph: {
    name: 'LangGraph', tagline: '把 Agent 写成"状态图"——可控、可循环、可人审的智能体编排', license: 'MIT', lang: 'Python / JS', latest: '活跃迭代', maintainer: 'LangChain Inc.',
    whatIs: 'LangGraph 是 LangChain 出的**Agent 编排框架**:把智能体的流程写成一张**有状态的图**(节点=步骤/工具/模型,边=转移),支持**循环、分支、人审(human-in-the-loop)、持久化**。比起线性链,它能精确控制"想→调工具→观察→再想"的 Agent 主循环、防死循环、加子 Agent。你「大模型项目实战」里的 Agent 主循环、工具调用、子 Agent 委派、规划、上下文压缩,正是它要编排的东西(OpenMAIC 就用它)。',
    features: [
      { t: '状态图', d: '节点+边+共享状态,精确控制流程(含循环/分支)' },
      { t: 'Agent 主循环', d: '想→行动(工具)→观察→再想,可控可停' },
      { t: '人审 / 持久化', d: 'human-in-the-loop、断点续跑、检查点' },
      { t: '工具 / 子 Agent', d: '调用工具、委派子 Agent、多智能体' },
      { t: '和 LangChain 生态', d: '复用 LangChain 的模型/工具/检索' },
    ],
    pros: ['把 Agent 从"黑箱链"变成可控状态图', '天然支持循环/分支/人审(复杂 Agent 必需)', '持久化/断点续跑、可观测', '生态大(LangChain/LangSmith)'],
    cons: ['概念多、学习曲线(图/状态/检查点)', '抽象层厚、调试要习惯', '轻量任务用它偏重', '生态更新快、API 变动'],
    coverage: [
      { mod: 'Agent 主循环', d: '想→工具→观察→再想、防死循环', links: [{ label: 'Agent 主循环', exp: 'reactagent' }, { label: '工具调用', exp: 'toolcall' }] },
      { mod: '多 Agent / 规划', d: '子 Agent 委派、计划模式', links: [{ label: '子 Agent 委派', exp: 'subagent' }, { label: '规划/Todo', exp: 'planning' }] },
      { mod: '上下文管理', d: '压缩/状态维护', links: [{ label: '上下文压缩', exp: 'ctxcompact' }] },
    ],
    projects: ['多步/多工具的复杂 Agent(客服/研究/编码)', '多智能体协作系统', '需要人审的生产级 Agent 流程', 'OpenMAIC 等多角色系统的编排'],
    seeAlso: 'RAG/检索看「LlamaIndex」、模型入口「HF Transformers」、原理看实验「Agent 主循环/工具调用/子 Agent/规划」',
  },
  llamaindex: {
    name: 'LlamaIndex', tagline: '给大模型接上你的数据——RAG(检索增强生成)的编排框架', license: 'MIT', lang: 'Python / TS', latest: '活跃迭代', maintainer: 'LlamaIndex Inc. + 社区',
    whatIs: 'LlamaIndex 是专注 **RAG(检索增强生成)**的框架:把你的私有文档**切块 → 向量化 → 存进向量库 → 检索 top-k → 拼进提示词**喂给大模型,让它基于你的数据回答(而不是瞎编)。提供数据连接器、索引、检索器、查询引擎一整套,配各种向量库(FAISS/Milvus/Chroma…)。你「大模型算法」里的 RAG、以及记忆检索打分,正是它的核心流程。',
    features: [
      { t: '数据连接 + 切块', d: '各种数据源导入、文档切 chunk' },
      { t: '索引 + 向量化', d: 'embedding 存进向量库(FAISS/Milvus…)' },
      { t: '检索器', d: 'top-k 相似检索、重排、混合检索' },
      { t: '查询引擎', d: '检索→拼 prompt→生成、带引用' },
      { t: 'Agent / 工具', d: '也能做检索型 Agent、多文档路由' },
    ],
    pros: ['RAG 全流程开箱(切块→索引→检索→生成)', '连各种数据源和向量库', '让模型"基于你的数据"答、减少幻觉', '社区大、组件丰富'],
    cons: ['抽象多、简单场景可能过重', '效果强依赖切块/检索/重排调优', '和 LangChain 功能有重叠、需选型', '生态更新快'],
    coverage: [
      { mod: 'RAG 检索增强', d: '切块→检索 top-k→拼 prompt→生成', links: [{ label: 'RAG 检索增强生成', exp: 'rag' }] },
      { mod: '检索打分 / 排序', d: '相似度打分选 top-k', links: [{ label: '记忆检索打分', exp: 'memretrieve' }] },
    ],
    projects: ['企业文档问答/知识库助手', '基于私有数据的 RAG 应用', '多文档研究/摘要 Agent', '和向量库(FAISS/Milvus/Qdrant)搭 RAG'],
    seeAlso: 'Agent 编排看「LangGraph」、模型入口「HF Transformers」、原理看实验「RAG/记忆检索打分」',
  },
  // ── 算法轨 · 软件库与框架 ──
  numpy: {
    name: 'NumPy', tagline: '科学计算的地基——N 维数组 + 向量化运算,几乎所有数据科学库都建在它上', license: 'BSD-3-Clause', lang: 'Python / C', latest: 'NumPy 2.x', maintainer: 'NumPy 社区(NumFOCUS)',
    whatIs: 'NumPy 是 Python 科学计算的**地基**:核心是 **ndarray(N 维数组)**——连续内存、类型统一,配上**向量化运算**(把 for 循环下沉到 C/SIMD),比纯 Python 快几十上百倍。广播、线性代数、随机数、傅里叶变换一应俱全。pandas/SciPy/scikit-learn/PyTorch 全部建在它(或它的接口)之上。你实验里的矩阵乘、内存布局、softmax、低秩、条件数,底层就是 NumPy 的数组运算。',
    features: [
      { t: 'ndarray N 维数组', d: '连续内存 + dtype,向量化的载体' },
      { t: '向量化 / 广播', d: '整块数组运算下沉 C/SIMD、不同形状自动对齐' },
      { t: '线性代数 linalg', d: '矩阵乘、分解、求逆、特征值(底层 BLAS/LAPACK)' },
      { t: '随机数 / FFT', d: '分布采样、快速傅里叶变换' },
      { t: '内存视图 / 步幅', d: 'view/stride,零拷贝切片、布局决定性能' },
    ],
    pros: ['数据科学事实地基、生态全建其上', '向量化比纯 Python 快几十上百倍', '接口成为"数组协议"标准(CuPy/JAX 兼容)', 'BSD 宽松、成熟稳定'],
    cons: ['单机内存内(大数据看 Dask/内存映射)', 'CPU 为主(GPU 看 CuPy/JAX)', '动态类型误用易慢(要真向量化)', '不含高层 ML(那是 scikit-learn)'],
    coverage: [
      { mod: '矩阵运算 / 布局', d: '矩阵乘、内存布局与步幅', links: [{ label: '矩阵乘 matmul', exp: 'matmul' }, { label: '内存布局', exp: 'layout' }] },
      { mod: '数值稳定 / 线代', d: 'softmax 稳定、条件数、低秩', links: [{ label: 'softmax', exp: 'softmax' }, { label: '条件数', exp: 'condnum' }, { label: '低秩近似', exp: 'lowrank' }] },
    ],
    projects: ['所有数据科学/ML 代码的数组底座', 'pandas/SciPy/scikit-learn/PyTorch 的依赖', '数值算法、信号/图像处理', '科研计算的通用工具'],
    seeAlso: '数据表看「pandas」、科学算法看「SciPy」、GPU 可微版看「JAX」、可视化看「Matplotlib」',
  },
  pandas: {
    name: 'pandas', tagline: '数据分析的瑞士军刀——DataFrame 清洗/合并/重塑结构化数据', license: 'BSD-3-Clause', lang: 'Python(基于 NumPy / Arrow)', latest: 'pandas 2.x(Arrow 后端)', maintainer: 'pandas 社区(NumFOCUS)',
    whatIs: 'pandas 是**结构化数据处理**的行业标准:核心是 **DataFrame**(带行列标签的二维表),提供读写(CSV/Parquet/SQL)、清洗、缺失值、分组聚合(groupby)、合并连接(merge/join)、时间序列、透视表。做 ML 之前的"数据整理"(80% 的活)基本都在 pandas 里。2.x 起可用 Arrow 后端提速。是从"原始数据"到"能喂模型的特征"之间的桥。',
    features: [
      { t: 'DataFrame / Series', d: '带标签的表/列,直观的索引与选择' },
      { t: '清洗 / 缺失值', d: 'dropna/fillna、类型转换、去重' },
      { t: 'groupby 聚合', d: '分组—聚合—转换(split-apply-combine)' },
      { t: 'merge / join / pivot', d: '表连接、透视、重塑(宽↔长)' },
      { t: 'IO / 时间序列', d: 'CSV/Parquet/SQL 读写、日期重采样' },
    ],
    pros: ['结构化数据处理事实标准', 'DataFrame API 直观、生态全', '和 NumPy/scikit-learn/Matplotlib 无缝', 'Arrow 后端提速、IO 格式多'],
    cons: ['单机内存内(大数据看 Polars/Dask/Spark)', '大表/链式操作易慢或吃内存', 'API 庞大、易写出低效代码', '不做建模(那是 scikit-learn)'],
    coverage: [
      { mod: '数据整理管线', d: '清洗/合并/聚合→特征表(喂给 ML)', links: [] },
    ],
    projects: ['ML/分析前的数据清洗与特征工程', 'EDA(探索性数据分析)', '报表、时间序列处理', '几乎所有数据项目的数据层'],
    seeAlso: '数组底座「NumPy」、建模「scikit-learn」、可视化「Matplotlib」、更快的看 Polars/Dask',
  },
  scipy: {
    name: 'SciPy', tagline: '科学计算算法库——优化/线代/统计/信号,建在 NumPy 上', license: 'BSD-3-Clause', lang: 'Python / C / Fortran', latest: 'SciPy 1.x', maintainer: 'SciPy 社区(NumFOCUS)',
    whatIs: 'SciPy 建在 NumPy 之上,提供成熟的**科学计算算法**:**优化(minimize/最小二乘)、线性代数(分解/特征)、统计(分布/检验)、信号处理、插值、稀疏矩阵、积分/ODE**。很多机器学习/统计方法的底层数值工具都来自它(如逻辑回归的优化、SVD、各种分布)。你实验里的条件数、低秩(SVD)、中心极限定理/大数定律(分布)、梯度下降(优化),用的就是它这类算法。',
    features: [
      { t: '优化 optimize', d: 'minimize、最小二乘、根查找(ML 训练底层)' },
      { t: '线性代数 linalg', d: 'SVD/QR/特征分解、稀疏矩阵' },
      { t: '统计 stats', d: '几十种分布、假设检验、相关' },
      { t: '信号/插值/积分', d: 'FFT、滤波、插值、数值积分/ODE' },
      { t: '稀疏矩阵', d: '大稀疏数据的存储与运算' },
    ],
    pros: ['科学算法一整套、成熟稳定', '底层 BLAS/LAPACK/Fortran、快', 'ML/统计方法的数值底座', 'BSD、和 NumPy 无缝'],
    cons: ['偏底层算法、非开箱 ML(那是 scikit-learn)', 'CPU 为主', '接口专业、需数学背景', '大规模优化要专用求解器'],
    coverage: [
      { mod: '线代:SVD / 条件数', d: '分解、数值稳定性', links: [{ label: '条件数', exp: 'condnum' }, { label: '低秩近似', exp: 'lowrank' }] },
      { mod: '优化', d: '最小化目标(ML 训练底层)', links: [{ label: '梯度下降', exp: 'graddesc' }] },
      { mod: '统计分布', d: '大数定律/中心极限的分布', links: [{ label: '中心极限定理', exp: 'clt' }, { label: '大数定律', exp: 'lln' }] },
    ],
    projects: ['统计检验/建模的数值底层', '科学与工程计算', 'scikit-learn 等的优化/线代依赖', '信号处理、稀疏问题'],
    seeAlso: '数组底座「NumPy」、开箱 ML「scikit-learn」、统计建模看「statsmodels」',
  },
  matplotlib: {
    name: 'Matplotlib', tagline: 'Python 可视化的老牌主力——什么图都能画、可控到每个像素', license: 'BSD 兼容(Matplotlib License)', lang: 'Python', latest: 'Matplotlib 3.x', maintainer: 'Matplotlib 社区(NumFOCUS)',
    whatIs: 'Matplotlib 是 Python **数据可视化**的老牌主力:折线/散点/柱状/热图/等高线/3D 都能画,`pyplot` 接口上手快、又能控到每个元素(轴/刻度/图例/颜色)。**seaborn** 建在它上做统计图更省事、**Plotly** 补交互。做 ML/数据分析时,画损失曲线、决策边界、特征分布、混淆矩阵,基本都靠它。是把"数字"变成"看得懂"的工具。',
    features: [
      { t: 'pyplot 接口', d: '几行画折线/散点/柱状/直方图' },
      { t: '精细控制', d: '轴/刻度/图例/注释/子图,控到像素' },
      { t: '多种图', d: '热图/等高线/3D/图像显示' },
      { t: '后端 / 导出', d: '交互后端 + 导出 PNG/SVG/PDF' },
      { t: '生态', d: 'seaborn(统计图)、pandas .plot 都基于它' },
    ],
    pros: ['最通用、什么图都能画', '可控到极致(出版级图表)', '生态庞大(seaborn/pandas 集成)', 'BSD 兼容、成熟稳定'],
    cons: ['默认样式一般、精修代码啰嗦', '交互弱(要交互看 Plotly/Bokeh)', 'API 有两套(pyplot vs OO)易混', '大数据点渲染慢'],
    coverage: [
      { mod: '可视化工具', d: '损失曲线/决策边界/分布/混淆矩阵(看懂实验)', links: [] },
    ],
    projects: ['ML 训练曲线/评估图', '数据分析报表与探索', '论文/出版级图表', '几乎所有数据可视化'],
    seeAlso: '统计图更省事看 seaborn、交互看 Plotly;数据源「pandas」、数组「NumPy」',
  },
  sklearn: {
    name: 'scikit-learn', tagline: '经典机器学习的百宝箱——统一 API 把几十种算法一键可用', license: 'BSD-3-Clause', lang: 'Python(基于 NumPy/SciPy)', latest: 'scikit-learn 1.x', maintainer: 'scikit-learn 社区(NumFOCUS)',
    whatIs: 'scikit-learn 是**经典(非深度)机器学习**的事实标准库:把几十种算法——**KNN、K-Means、PCA、SVM、决策树、逻辑/线性回归、随机森林、GBDT**——统一成一套 **fit/predict/transform** API,配特征处理、交叉验证、网格搜索、**Pipeline**。结构化数据建模、快速基线、教学首选。你「机器学习算法」组那批实验(KNN/K-Means/PCA/SVM/决策树/逻辑回归/线性回归)正是它的核心算法。',
    features: [
      { t: '统一 API', d: 'fit/predict/transform,所有算法同一套' },
      { t: '算法全', d: '分类/回归/聚类/降维/集成一整套' },
      { t: 'Pipeline', d: '预处理+模型串成流水线、防数据泄露' },
      { t: '模型选择', d: '交叉验证、网格/随机搜索调参' },
      { t: '特征处理 / 度量', d: '标准化/编码/选择 + 各种评估指标' },
    ],
    pros: ['经典 ML 事实标准、API 统一优雅', '算法/工具全、文档一流', 'Pipeline/CV/调参开箱', 'BSD、和 NumPy/pandas 无缝'],
    cons: ['不做深度学习(那是 PyTorch)', '单机内存内(超大数据要别的)', 'GBDT 性能不如 XGBoost/LightGBM', '默认非 GPU'],
    coverage: [
      { mod: '分类 / 回归', d: 'KNN、SVM、逻辑/线性回归、决策树', links: [{ label: 'KNN', exp: 'knn' }, { label: 'SVM', exp: 'svm' }, { label: '逻辑回归', exp: 'logreg' }, { label: '线性回归', exp: 'linreg' }, { label: '决策树', exp: 'dtree' }] },
      { mod: '聚类 / 降维', d: 'K-Means、PCA', links: [{ label: 'K-Means', exp: 'kmeans' }, { label: 'PCA', exp: 'pca' }] },
      { mod: '集成', d: '随机森林 / GBDT(专用库更快)', links: [{ label: 'GBDT', exp: 'gbdt' }] },
    ],
    projects: ['结构化数据的分类/回归/聚类', '快速基线与特征工程', '教学与竞赛的入门', 'ML 流水线(Pipeline)搭建'],
    seeAlso: '梯度提升更强看「XGBoost」、深度学习看「PyTorch」、统计推断看「statsmodels」、底座「NumPy/SciPy」',
  },
  xgboost: {
    name: 'XGBoost', tagline: '结构化数据之王——梯度提升树,Kaggle 常胜将军', license: 'Apache-2.0', lang: 'C++ / Python / R / JVM', latest: 'XGBoost 3.x', maintainer: 'DMLC + 社区',
    whatIs: 'XGBoost(eXtreme Gradient Boosting)是**梯度提升决策树(GBDT)**的高性能实现:一棵棵树串行拟合前面的残差、逐步变强;工程上做了二阶泰勒近似、正则化、缺失值处理、直方图分裂、并行/GPU。**在表格/结构化数据上常年最强**(Kaggle 常胜)。你「机器学习算法」里的 GBDT、决策树,正是它的核心;它是 scikit-learn 之外做结构化预测的首选。',
    features: [
      { t: '梯度提升树', d: '串行加树拟合残差(二阶泰勒 + 正则)' },
      { t: '直方图分裂', d: '特征分桶、快;支持 GPU' },
      { t: '缺失值 / 稀疏', d: '自动学缺失走向、稀疏感知' },
      { t: '正则化 / 早停', d: 'L1/L2、列采样、early stopping 防过拟合' },
      { t: '多语言 / 分布式', d: 'Python/R/JVM、单机到集群' },
    ],
    pros: ['表格数据准确率常年最强(Kaggle 王者)', '快(直方图 + GPU)、可扩展', '正则/缺失/特征重要性齐全', 'Apache-2.0、多语言'],
    cons: ['树模型不适合图像/文本(那是 DL)', '调参项多(需经验)', '大类别特征要编码', '模型比线性模型难解释(有 SHAP 缓解)'],
    coverage: [
      { mod: '梯度提升树', d: '串行加树、拟合残差', links: [{ label: 'GBDT', exp: 'gbdt' }] },
      { mod: '决策树基学习器', d: '单棵树的分裂', links: [{ label: '决策树', exp: 'dtree' }] },
    ],
    projects: ['金融风控/推荐/CTR 等表格预测', 'Kaggle 竞赛常用', '和 LightGBM/CatBoost 并列的结构化建模主力', '特征重要性分析'],
    seeAlso: '更快的梯度提升看 LightGBM、通用 ML「scikit-learn」、原理看实验「GBDT/决策树」',
  },
  jax: {
    name: 'JAX', tagline: '可微的 NumPy——自动求导 + XLA 编译 + GPU/TPU,函数式高性能计算', license: 'Apache-2.0', lang: 'Python', latest: '活跃迭代', maintainer: 'Google',
    whatIs: 'JAX 是 Google 的**高性能数值计算**框架:把 **NumPy 接口 + 自动求导(grad)+ XLA 编译(jit)+ 向量化(vmap)+ GPU/TPU** 组合起来。风格函数式(纯函数 + 变换),`grad` 求导、`jit` 编译加速、`vmap` 自动批处理、`pmap` 多设备。学界/前沿(DeepMind、大量 RL/科学计算、MuJoCo MJX、Brax)大量用它。你实验里的梯度下降、反向传播、矩阵运算,用 JAX 写就是"可微的 NumPy"。',
    features: [
      { t: 'grad 自动求导', d: '对任意函数求导(还能高阶导)' },
      { t: 'jit(XLA 编译)', d: '把函数编译成融合内核、GPU/TPU 提速' },
      { t: 'vmap / pmap', d: '自动向量化批处理、多设备并行' },
      { t: 'NumPy 接口', d: 'jax.numpy 几乎等价 NumPy、可求导可编译' },
      { t: '函数式', d: '纯函数 + 可组合变换(利于并行/复现)' },
    ],
    pros: ['"可微 NumPy":从数值到 DL 一条心智模型', 'XLA 编译 + TPU,大规模训练/仿真快', 'vmap/grad 组合优雅、利于研究', 'Apache-2.0、Google/DeepMind 加持'],
    cons: ['函数式 + 纯函数,思维需转变', '生态/高层 API 不如 PyTorch 厚(常配 Flax)', '调试(jit 内)有门槛', '随机数/副作用要显式管理'],
    coverage: [
      { mod: '自动求导 / 梯度下降', d: 'grad + 参数更新', links: [{ label: '梯度下降', exp: 'graddesc' }, { label: '反向传播', exp: 'backprop' }] },
      { mod: '可微矩阵运算', d: 'jax.numpy 的向量化', links: [{ label: '矩阵乘 matmul', exp: 'matmul' }] },
    ],
    projects: ['前沿 DL/研究(Flax/Haiku 建其上)', '大规模 RL 仿真(Brax、MuJoCo MJX)', '科学计算 + 可微编程', 'TPU 上的大规模训练'],
    seeAlso: '主流 DL 生态看「PyTorch」、数组底座对应「NumPy」、仿真里用它的是「MuJoCo(MJX)/Isaac Lab」',
  },
  opencv: {
    name: 'OpenCV', tagline: '计算机视觉的老牌全家桶——图像处理/特征/几何/相机标定一整套', license: 'Apache-2.0(4.5.0+;旧版 BSD-3)', lang: 'C++ / Python', latest: 'OpenCV 4.x', maintainer: 'OpenCV.org + 社区',
    whatIs: 'OpenCV 是**计算机视觉**的老牌全家桶:图像读写、滤波/卷积、边缘/角点、特征(ORB/SIFT)、几何变换、**相机标定**、光流、立体视觉、传统目标检测,还能跑 DNN 推理。既是 CV 的经典算法库,也是机器人/图像项目的地基(和「机器人感知」轨的针孔/双目/点云相通)。你实验里的卷积、池化(图像处理),在它里面都是现成算子。',
    features: [
      { t: '图像处理', d: '滤波/卷积、形态学、颜色空间、几何变换' },
      { t: '特征 + 匹配', d: 'ORB/SIFT 特征点、描述子匹配' },
      { t: '相机标定 / 几何', d: '棋盘格标定、单应、立体、位姿(solvePnP)' },
      { t: '视频 / 光流', d: '视频读写、光流、背景建模、跟踪' },
      { t: 'DNN 模块', d: '跑 ONNX/Caffe/TF 模型做检测/分割' },
    ],
    pros: ['CV 算法最全、经典地基', 'C++ 核心快、Python 好用', '和机器人/相机几何相通', 'Apache-2.0(4.5+)、跨平台'],
    cons: ['深度学习训练不归它(那是 PyTorch)', 'API 庞杂、C++/Python 风格差异', '文档偏 API、体系性弱', '旧版 BSD、新版才 Apache-2.0'],
    coverage: [
      { mod: '卷积 / 滤波', d: '图像卷积、核操作', links: [{ label: '卷积', exp: 'conv' }] },
      { mod: '下采样 / 池化', d: '图像金字塔、降采样', links: [{ label: '池化', exp: 'pooling' }] },
    ],
    projects: ['图像/视频处理与分析', '相机标定、立体视觉、AR(和机器人感知相通)', '传统 + DNN 目标检测/跟踪', '机器人/工业视觉前端'],
    seeAlso: '深度学习看「PyTorch」、机器人感知里相通的是针孔/双目/点云实验、原理看实验「卷积/池化」',
  },
  statsmodels: {
    name: 'statsmodels', tagline: '统计建模与推断——回归/时间序列/假设检验,给你 p 值和置信区间', license: 'BSD-3-Clause', lang: 'Python(基于 NumPy/SciPy/pandas)', latest: 'statsmodels 0.14+', maintainer: 'statsmodels 社区',
    whatIs: 'statsmodels 专注**统计建模与推断**(不同于 scikit-learn 的"预测"取向):线性/广义线性回归(OLS/GLM/logit)、**时间序列(ARIMA/VAR)**、假设检验、方差分析,而且给出**完整的统计报告**——系数、标准误、p 值、置信区间、R²、诊断检验。当你不只要"预测准",还要"解释变量显著吗、关系可信吗"时用它。你实验里的线性/逻辑回归、中心极限、大数定律,正是它的统计根基。',
    features: [
      { t: '回归模型', d: 'OLS/WLS/GLM/logit/probit,带完整统计报告' },
      { t: '时间序列', d: 'ARIMA/SARIMA/VAR、平稳性检验' },
      { t: '假设检验 / ANOVA', d: 't 检验、卡方、方差分析' },
      { t: '统计报告', d: '系数/标准误/p 值/置信区间/R²/诊断' },
      { t: '公式接口', d: "R 风格公式(y ~ x1 + x2)" },
    ],
    pros: ['统计推断为一等公民(p 值/置信区间)', '时间序列/计量经济强', 'R 风格公式、报告详尽', 'BSD、和 pandas 无缝'],
    cons: ['偏推断/解释、不是大规模预测(那是 sklearn/XGBoost)', '大数据/高维非强项', '深度学习不归它', 'API/文档偏学术'],
    coverage: [
      { mod: '回归推断', d: '线性/逻辑回归 + 显著性', links: [{ label: '线性回归', exp: 'linreg' }, { label: '逻辑回归', exp: 'logreg' }] },
      { mod: '统计基础', d: '大数定律 / 中心极限', links: [{ label: '中心极限定理', exp: 'clt' }, { label: '大数定律', exp: 'lln' }] },
    ],
    projects: ['计量经济/社科的统计分析', '时间序列预测(ARIMA)', 'A/B 实验的显著性检验', '要"解释"而非只"预测"的建模'],
    seeAlso: '预测取向看「scikit-learn」、贝叶斯看 PyMC、底座「NumPy/SciPy/pandas」、原理看实验「线性/逻辑回归/CLT」',
  },
  networkx: {
    name: 'NetworkX', tagline: '图/网络分析工具箱——最短路/PageRank/社区/连通,经典图算法一站式', license: 'BSD-3-Clause', lang: 'Python', latest: 'NetworkX 3.x', maintainer: 'NetworkX 社区(NumFOCUS)',
    whatIs: 'NetworkX 是 Python 的**图/网络**分析库:建图(有向/无向/带权)、跑**经典图算法**——最短路(Dijkstra/A*/Bellman-Ford)、**PageRank**、连通分量/并查集、最小生成树、最大流、中心性、社区发现。纯 Python、上手极快,适合建模、分析、教学与中小规模网络。你「经典算法」里的 PageRank、A* 寻路、并查集(连通),正是它的现成算法。',
    features: [
      { t: '图数据结构', d: '有向/无向/多重/带权图,节点边带属性' },
      { t: '最短路 / 遍历', d: 'Dijkstra、A*、BFS/DFS、Bellman-Ford' },
      { t: 'PageRank / 中心性', d: 'PageRank、介数/接近中心性' },
      { t: '连通 / 生成树 / 流', d: '连通分量、并查集、MST、最大流' },
      { t: '社区 / 可视化', d: '社区发现、配 Matplotlib 画图' },
    ],
    pros: ['经典图算法一站式、上手极快', '纯 Python、灵活、适合建模/教学', '算法全、和 Matplotlib 集成', 'BSD、生态成熟'],
    cons: ['纯 Python、大规模图慢(百万边看 igraph/graph-tool/GPU)', '内存内、非图数据库', '不做图神经网络(那是 PyG/DGL)', '大图可视化弱'],
    coverage: [
      { mod: 'PageRank / 中心性', d: '网页排名、节点重要度', links: [{ label: 'PageRank', exp: 'pagerank' }] },
      { mod: '最短路 A*', d: '带启发式的最短路', links: [{ label: 'A* 寻路', exp: 'astar' }] },
      { mod: '连通 / 并查集', d: '连通分量、集合合并', links: [{ label: '并查集', exp: 'unionfind' }] },
    ],
    projects: ['社交网络/引用网络分析', '知识图谱、依赖图', '路网/最短路建模', '图算法教学与原型'],
    seeAlso: '超大规模图看 igraph/graph-tool、图神经网络看 PyG/DGL、原理看实验「PageRank/A*/并查集」',
  },
  gensim: {
    name: 'gensim', tagline: '主题模型与词向量——Word2Vec/LDA,无监督挖文本语义', license: 'LGPL-2.1(⚠️弱传染)', lang: 'Python', latest: 'gensim 4.x', maintainer: 'Radim Řehůřek + 社区',
    whatIs: 'gensim 是**主题建模与词向量**的经典库:**Word2Vec/FastText/Doc2Vec** 词/文档向量、**LDA/LSI 主题模型**、TF-IDF、相似度检索,主打**无监督**从大规模文本里挖语义,且能流式处理内存放不下的语料。**Word2Vec 的著名实现就出自这里**(word2vec 里"国王−男人+女人≈王后")。你「深度学习算法」里的词向量实验,原产地就是它。**⚠️ 许可是 LGPL-2.1**(弱传染,商用动态链接一般 OK、静态/改源要留意)。',
    features: [
      { t: 'Word2Vec / FastText', d: '词向量(CBOW/Skip-gram)、子词向量' },
      { t: 'Doc2Vec', d: '段落/文档向量' },
      { t: '主题模型 LDA/LSI', d: '无监督发现文档主题' },
      { t: 'TF-IDF / 相似度', d: '加权 + 语义相似检索' },
      { t: '流式处理', d: '语料不入内存也能训(适合大文本)' },
    ],
    pros: ['词向量/主题模型经典实现', 'Word2Vec 原产地、教学首选', '无监督、能流式处理大语料', '轻量、专注文本语义'],
    cons: ['⚠️ LGPL-2.1(比 BSD/MIT 严,商用要评估)', '经典方法为主(上下文向量看 Transformers)', '偏词/主题、非端到端 NLP(看 spaCy)', '深度模型不归它'],
    coverage: [
      { mod: 'Word2Vec 词向量', d: 'CBOW/Skip-gram 学词向量', links: [{ label: '词向量 Word2Vec', exp: 'wordvec' }] },
    ],
    projects: ['文本主题分析/文档聚类', '词/文档相似度检索', '推荐/搜索的语义特征', 'NLP 教学(词向量直觉)'],
    seeAlso: '上下文词向量/大模型看「HF Transformers」、工业 NLP 管线看 spaCy、原理看实验「词向量」',
  },
  // ── 408 地基 · 系统与工具 ──
  linux: {
    name: 'Linux 内核', tagline: '开源操作系统内核——调度/虚拟内存/文件系统/网络栈的活教材', license: 'GPL-2.0(only)', lang: 'C(+汇编)', latest: '6.x 主线', maintainer: 'Linus Torvalds + 全球社区',
    whatIs: 'Linux 内核是世界上最重要的开源操作系统内核:进程**调度器**(CFS/EEVDF)、**虚拟内存**(分页、缺页、页替换)、**文件系统**(inode、位图、ext4/Btrfs)、**并发**(信号量/自旋锁/死锁避免)、**网络栈**(TCP/IP)全在里面。你「操作系统」组那批实验(调度、缺页、磁盘寻道、银行家、inode、位图、分区、信号量)讲的原理,在 Linux 内核里都有真实、工业级的实现。是学 OS 从"原理"到"真代码"的桥。',
    features: [
      { t: '进程调度', d: 'CFS/EEVDF 公平调度、优先级、多核负载均衡' },
      { t: '虚拟内存', d: '分页、缺页处理、页替换(LRU 近似)、mmap' },
      { t: '文件系统 / VFS', d: 'inode、目录、位图、日志(ext4/Btrfs/XFS)' },
      { t: '并发原语', d: '自旋锁/互斥/信号量/RCU,死锁检测' },
      { t: '网络栈 / 系统调用', d: 'TCP/IP 协议栈、socket、syscall 界面' },
    ],
    pros: ['OS 原理的工业级活教材(真代码)', '模块化、可裁剪、可插内核模块', '生态无敌(服务器/手机/嵌入式全用)', 'GPL、可读可改可学'],
    cons: ['代码庞大(数千万行)、门槛极高', 'GPL-2.0 传染(改内核要开源)', '调试/开发环境重(配 QEMU/GDB)', '子系统交织、牵一发动全身'],
    coverage: [
      { mod: '调度器', d: 'CFS/优先级/多核', links: [{ label: '进程调度', exp: 'scheduler' }] },
      { mod: '虚拟内存', d: '分页/缺页/页替换', links: [{ label: '缺页/页替换', exp: 'page' }, { label: '虚拟内存', exp: 'vm' }] },
      { mod: '文件系统', d: 'inode/位图/分区/磁盘', links: [{ label: 'inode', exp: 'inode' }, { label: '位图', exp: 'bitmap' }, { label: '分区/分配', exp: 'partition' }, { label: '磁盘寻道', exp: 'disk' }] },
      { mod: '并发', d: '信号量/死锁避免', links: [{ label: '信号量', exp: 'semaphore' }, { label: '银行家(死锁避免)', exp: 'banker' }] },
    ],
    projects: ['服务器/云/超算的操作系统', 'Android 底层内核', '嵌入式/路由器/IoT', '学 OS 的真实内核源码'],
    seeAlso: '调试内核配「QEMU + GDB」、教学精简版看「xv6」、容器基于它的 namespaces/cgroups「Docker」',
  },
  gcc: {
    name: 'GCC(GNU 编译器套件)', tagline: '把 C/C++ 源码翻成机器码——预处理→编译→汇编→链接四步', license: 'GPLv3(+运行时库例外)', lang: 'C / C++', latest: 'GCC 14+', maintainer: 'GNU 项目 / FSF + 社区',
    whatIs: 'GCC 是经典的开源**编译器套件**:把 C/C++/Fortran 等源码,经**预处理→编译(语法分析+优化+生成汇编)→汇编→链接**,变成能在 CPU 上跑的机器码。它把你「计算机组成原理」里的**加减/乘法/浮点/表达式**这些机器级运算真正生成出来(可 `gcc -S` 看汇编)。是理解"高级语言如何变成机器指令"的窗口,也是几乎所有 C/C++ 项目的地基。',
    features: [
      { t: '编译四步', d: '预处理→编译→汇编→链接(cpp/cc1/as/ld)' },
      { t: '优化', d: '-O1/O2/O3、内联、循环优化、SIMD 向量化' },
      { t: '多架构后端', d: 'x86/ARM/RISC-V… 生成对应机器码' },
      { t: '看汇编', d: 'gcc -S 看源码编译成的机器指令' },
      { t: '标准/扩展', d: '各版 C/C++ 标准 + GNU 扩展' },
    ],
    pros: ['开源编译器标杆、多语言多架构', '优化成熟、生态无处不在', '是"源码→机器码"的活教材', 'GPLv3+运行时例外(编出的程序不传染)'],
    cons: ['报错信息历史上不如 Clang 友好(在改善)', '构建大项目编译慢(要 ccache/并行)', '内部庞大、深挖门槛高', '和 Clang/LLVM 竞争、选型'],
    coverage: [
      { mod: '生成算术指令', d: '加减/乘法/浮点的机器级实现', links: [{ label: '加法/减法', exp: 'addsub' }, { label: '乘法', exp: 'multiply' }, { label: '浮点表示', exp: 'float' }] },
      { mod: '编译前端:表达式', d: '词法/语法分析求值', links: [{ label: '表达式求值', exp: 'expr' }] },
    ],
    projects: ['Linux 内核 + 无数 C/C++ 项目的编译', '嵌入式交叉编译', '性能优化(看/调优汇编)', '编译原理教学'],
    seeAlso: '调试编出的程序看「GDB」、竞品是 Clang/LLVM、原理看实验「加减/乘法/浮点/表达式」',
  },
  gdb: {
    name: 'GDB(GNU 调试器)', tagline: '运行时透视程序——断点/单步/看寄存器/看内存/看栈帧', license: 'GPLv3(or later)', lang: 'C / C++', latest: 'GDB 14+', maintainer: 'GNU 项目 / FSF + 社区',
    whatIs: 'GDB 是经典的开源**调试器**:让程序停在断点、**单步执行**、查看**寄存器/内存/栈帧/变量**、改值、看调用栈、甚至反汇编。它是把「计算机组成原理」讲的"寄存器、内存、栈、机器指令"变成**看得见、能拨动**的东西的工具——你能真的看到函数调用怎么压栈、变量在内存哪里。配 GCC(编译带调试信息 -g)、QEMU(调内核)一起用,是系统编程的必备。',
    features: [
      { t: '断点 / 单步', d: 'break/step/next/continue、条件断点、watchpoint' },
      { t: '看状态', d: '寄存器、内存、变量、调用栈(backtrace)' },
      { t: '反汇编 / 机器级', d: 'disassemble、看真实机器指令与寄存器' },
      { t: '远程调试', d: '配 QEMU/gdbserver 调内核/嵌入式' },
      { t: 'core dump', d: '事后分析崩溃的内存快照' },
    ],
    pros: ['把运行时机器状态变可见可调', '功能全(断点/watch/反汇编/远程)', '和 GCC/QEMU 无缝、系统编程必备', 'GPL、跨架构'],
    cons: ['命令行门槛(有 TUI/IDE 前端缓解)', '优化过的代码调试信息会"跳"', '大程序/多线程调试复杂', '需编译带 -g 调试信息'],
    coverage: [
      { mod: '运行时透视', d: '看寄存器/内存/栈帧/机器指令——把组成原理讲的"看得见"(工具基石)', links: [] },
    ],
    projects: ['C/C++ 程序的崩溃/逻辑调试', '配 QEMU 调 Linux 内核', '嵌入式远程调试', '逆向/性能分析、理解机器执行'],
    seeAlso: '编译带调试信息用「GCC -g」、调内核配「QEMU」、看的正是「组成原理」实验里的寄存器/内存/栈',
  },
  qemu: {
    name: 'QEMU', tagline: '整机模拟器——在软件里跑一台"虚拟计算机"(CPU/内存/外设)', license: 'GPL-2.0', lang: 'C', latest: '活跃迭代', maintainer: 'QEMU 社区',
    whatIs: 'QEMU 是开源的**整机模拟/虚拟化**器:在软件里模拟出一整台计算机——CPU(指令翻译)、内存、磁盘、网卡、外设,能启动完整的操作系统(还能配 KVM 硬件加速)。它把「计算机组成原理」讲的**CPU 流水线、缓存、虚拟内存、机器指令**放到一个可观察、可调试(配 GDB)的环境里跑。是学操作系统/体系结构、开发内核(配 xv6/Linux)的标准平台。',
    features: [
      { t: '整机模拟', d: 'CPU/内存/磁盘/网卡/外设,启动完整 OS' },
      { t: '多架构', d: 'x86/ARM/RISC-V… 跨架构模拟(可跑异构二进制)' },
      { t: 'KVM 加速', d: '配 Linux KVM 做接近原生的虚拟化' },
      { t: 'GDB 调试桩', d: '暴露 gdbstub、单步调内核/固件' },
      { t: '快照 / 迁移', d: '保存恢复整机状态、热迁移' },
    ],
    pros: ['整机可观察可调试(学 OS/体系结构神器)', '多架构、跑异构二进制', '配 GDB 调内核、配 KVM 高性能', 'GPL、生态大(云虚拟化底座)'],
    cons: ['纯模拟慢(要 KVM 才快)', '配置项多、上手有门槛', 'GPL-2.0', '精确周期级模拟需专用工具(gem5)'],
    coverage: [
      { mod: 'CPU / 流水线 / 缓存', d: '指令执行、缓存、流水线', links: [{ label: '缓存', exp: 'cache' }, { label: '流水线', exp: 'pipeline' }] },
      { mod: '虚拟内存', d: 'MMU/分页模拟', links: [{ label: '虚拟内存', exp: 'vm' }] },
    ],
    projects: ['开发/调试操作系统内核(xv6/Linux)', '云计算虚拟化底座(配 KVM/libvirt)', '跨架构软件测试/移植', '体系结构/OS 教学'],
    seeAlso: '调内核配「GDB」、教学 OS 跑在它上「xv6」、真内核「Linux」、原理看实验「缓存/流水线/虚拟内存」',
  },
  wireshark: {
    name: 'Wireshark', tagline: '网络抓包分析——把每一个数据包逐字段拆给你看', license: 'GPL-2.0(or later)', lang: 'C / C++', latest: '4.x', maintainer: 'Wireshark 基金会 + 社区',
    whatIs: 'Wireshark 是世界上最流行的**网络抓包分析**工具:抓下网卡上的每一个数据包,**逐层逐字段解析**(以太网→IP→TCP→HTTP…),让你亲眼看到 **TCP 三次握手、序号/确认、重传、窗口、CRC 校验、子网寻址**是怎么在线路上发生的。你「计算机网络」组的实验(TCP、握手、子网、CRC、ARQ)讲的原理,在 Wireshark 里都能抓到真实的包对照着看。是学网络协议从"课本"到"真流量"的桥。',
    features: [
      { t: '逐层解析', d: '几千种协议:以太网/IP/TCP/UDP/HTTP/TLS…' },
      { t: '过滤 / 追踪流', d: '显示过滤器、Follow TCP Stream 看整条会话' },
      { t: 'TCP 分析', d: '握手、序号/确认、重传、窗口、乱序标注' },
      { t: '统计 / 图表', d: 'IO 图、往返时延、专家信息(异常提示)' },
      { t: '抓包 / 离线', d: '实时抓 + pcap 文件离线分析(配 tcpdump)' },
    ],
    pros: ['网络协议分析的事实标准', '逐字段可视化、TCP 分析强', '协议支持极全、跨平台', '学网络/排障神器、GPL'],
    cons: ['抓包看真实流量需权限/合规注意', '大流量抓包量大、要过滤', '加密流量(TLS)要密钥才能看内容', '深用需要协议背景'],
    coverage: [
      { mod: 'TCP / 握手', d: '三次握手、序号确认、重传窗口', links: [{ label: 'TCP 拥塞/可靠', exp: 'tcp' }, { label: '三次握手', exp: 'handshake' }] },
      { mod: '寻址 / 校验', d: '子网、CRC 校验', links: [{ label: '子网划分', exp: 'subnet' }, { label: 'CRC 校验', exp: 'crc' }] },
    ],
    projects: ['网络故障排查', '协议开发/调试', '安全分析(抓可疑流量)', '网络协议教学(对照真实包)'],
    seeAlso: '命令行抓包配 tcpdump、Web 服务器看「nginx」、HTTP 客户端看「curl」、原理看实验「TCP/握手/子网/CRC」',
  },
  nginx: {
    name: 'nginx', tagline: '高性能 Web 服务器/反向代理——事件驱动 + epoll 扛住海量并发连接', license: 'BSD-2-Clause', lang: 'C', latest: '1.2x/1.27+', maintainer: 'F5 / nginx 社区',
    whatIs: 'nginx 是高性能的开源 **Web 服务器 / 反向代理 / 负载均衡**:用**事件驱动 + 异步非阻塞(epoll/kqueue)**的架构,单机就能扛住**海量并发连接**(经典 C10K 问题的答案)。它是「计算机网络」+「操作系统」交汇处的活样本——处理 TCP 连接、HTTP,靠的正是 OS 的 **IO 多路复用(epoll)**(和进程调度、事件循环相通)。是互联网基础设施最常见的一块。',
    features: [
      { t: '事件驱动 + epoll', d: '异步非阻塞、单进程多连接(IO 多路复用)' },
      { t: 'Web 服务 / 静态', d: '高效发静态文件、HTTP/HTTPS/HTTP3' },
      { t: '反向代理 / 负载均衡', d: '转发后端、多种均衡策略、健康检查' },
      { t: '缓存 / 限流', d: '内容缓存、连接/请求限流' },
      { t: '配置 / 模块', d: '声明式配置、模块化扩展' },
    ],
    pros: ['高并发、低内存(事件驱动 epoll)', 'Web/代理/负载均衡一把梭', '配置清晰、稳定可靠', 'BSD、互联网基建标配'],
    cons: ['复杂动态逻辑不如应用服务器', '配置强大但有学习曲线', '模块多为编译期(动态模块较新)', 'epoll 等依赖 OS 支持'],
    coverage: [
      { mod: 'TCP 连接 / HTTP', d: '建连(握手)、收发', links: [{ label: '三次握手', exp: 'handshake' }, { label: 'TCP', exp: 'tcp' }] },
      { mod: 'IO 多路复用 / 事件', d: 'epoll 单线程管海量连接(和调度/事件循环相通)', links: [{ label: '进程调度', exp: 'scheduler' }] },
    ],
    projects: ['网站/API 的 Web 服务器', '反向代理 + 负载均衡', 'CDN/网关边缘节点', '高并发服务的接入层'],
    seeAlso: '抓它的流量看「Wireshark」、客户端看「curl」、底层 IO 多路复用是「Linux」的 epoll、原理看实验「握手/TCP」',
  },
  redis: {
    name: 'Redis', tagline: '内存数据结构服务器——把哈希/跳表/集合当服务用,顺带一堆数据结构真身', license: '⚠️ AGPLv3 / SSPLv1 / RSALv2 三重(2024 从 BSD 改走 source-available)', lang: 'C', latest: 'Redis 8.x(2025 加回 AGPLv3)', maintainer: 'Redis Ltd. + 社区',
    whatIs: 'Redis 是高性能的**内存数据结构服务器**:把**字符串/哈希/列表/集合/有序集合(跳表)/位图/HyperLogLog** 当网络服务用,常做缓存、排行榜、会话、队列。它内部就是一座**数据结构博物馆**——哈希表(渐进式 rehash)、**跳表**(zset)、**LRU/LFU 淘汰**(和页替换同思路)。你「数据结构」里的哈希、以及「OS」的页替换(LRU),在 Redis 里是真实工程实现。**⚠️许可**:2024 从 BSD 改成 source-available(SSPLv1/RSALv2),Redis 8(2025)加回 AGPLv3——商用要看清。',
    features: [
      { t: '丰富数据结构', d: 'string/hash/list/set/zset(跳表)/bitmap/HLL' },
      { t: '内存 + 持久化', d: '内存速度 + RDB 快照 / AOF 日志' },
      { t: '淘汰策略', d: 'LRU/LFU/TTL(和页替换同思路)' },
      { t: '哈希表 rehash', d: '渐进式 rehash 避免卡顿' },
      { t: '扩展', d: '发布订阅、Lua 脚本、集群、Stream' },
    ],
    pros: ['极快(内存 + 单线程事件循环)', '数据结构丰富、用途广(缓存/排行/队列)', '内部是数据结构工程范本', '生态成熟'],
    cons: ['⚠️许可变更(source-available/AGPL,商用评估;分叉 Valkey 是 BSD)', '内存贵、大数据成本高', '单线程核心(CPU 密集受限)', '强一致/复杂事务非强项'],
    coverage: [
      { mod: '哈希表', d: '渐进式 rehash 的哈希', links: [{ label: '哈希表', exp: 'hash' }] },
      { mod: '淘汰:LRU/LFU', d: '内存满淘汰(和页替换同思路)', links: [{ label: '页替换(LRU)', exp: 'page' }] },
    ],
    projects: ['缓存 / 会话 / 排行榜 / 计数器', '消息队列 / 发布订阅(Stream)', '限流 / 分布式锁', '实时排行、地理位置'],
    seeAlso: 'B 树存储看「SQLite」、页替换原理看实验「缺页/页替换」、BSD 分叉是 Valkey、许可注意见档案',
  },
  sqlite: {
    name: 'SQLite', tagline: '世界上部署最广的数据库——一个文件、一段 B 树,嵌到一切里', license: 'Public Domain(公有领域)', lang: 'C', latest: 'SQLite 3.x', maintainer: 'D. Richard Hipp + 团队',
    whatIs: 'SQLite 是**世界上部署最广**的数据库引擎(手机、浏览器、操作系统、飞机里都有):一个**嵌入式、零配置、单文件**的关系数据库,整个库就是磁盘上一个 `.db` 文件。它的存储引擎核心是 **B 树/B+ 树**(索引与表都是 B 树)——正是你「数据结构」里的 btree/bplus。麻雀虽小五脏俱全:SQL、事务(ACID)、WAL。是理解"数据库怎么把 B 树落到磁盘文件"的最佳活样本。**许可:公有领域**(想怎么用怎么用)。',
    features: [
      { t: '单文件 / 嵌入式', d: '整个 DB 一个文件、零配置、随程序进程跑' },
      { t: 'B 树存储', d: '表和索引都是 B 树/B+ 树,页式存储' },
      { t: 'SQL + 事务', d: '完整 SQL、ACID 事务、WAL 日志' },
      { t: '极致可靠 / 测试', d: '海量测试用例、崩溃安全' },
      { t: '公有领域', d: '无任何许可限制' },
    ],
    pros: ['部署最广、零配置、极稳', 'B 树存储的活教材', '单文件、可移植、无服务进程', '公有领域(想怎么用怎么用)'],
    cons: ['嵌入式:高并发写不如客户端-服务器 DB', '单写者(读可并发)', '不适合海量分布式', '大数据/多机看 Postgres/MySQL'],
    coverage: [
      { mod: 'B 树 / B+ 树存储', d: '表和索引的 B 树', links: [{ label: 'B 树', exp: 'btree' }, { label: 'B+ 树索引', exp: 'bplus' }] },
      { mod: '哈希 / 查找', d: '内部查找结构', links: [{ label: '哈希表', exp: 'hash' }] },
    ],
    projects: ['手机 App 本地存储(iOS/Android)', '浏览器/操作系统内置数据', '桌面软件、边缘设备', '中小型网站/原型的数据库'],
    seeAlso: '内存数据结构看「Redis」、大型 DB 看 Postgres/MySQL、原理看实验「B 树/B+ 树/哈希」',
  },
  git: {
    name: 'Git', tagline: '分布式版本控制——内容寻址 + 有向无环图 + 哈希,数据结构的杰作', license: 'GPL-2.0(only)', lang: 'C(+脚本)', latest: '2.4x', maintainer: 'Linus Torvalds 创、Junio Hamano 维护',
    whatIs: 'Git 是世界主流的**分布式版本控制系统**,也是一个**数据结构的杰作**:内部是**内容寻址对象库**——每个文件/目录/提交按内容的 **SHA 哈希**寻址(改一点哈希就变),提交连成一张**有向无环图(DAG)**(父指针),分支只是指针。你「数据结构」里的哈希、拓扑排序(DAG)、以及内容去重/压缩,在 Git 里是活生生的设计。理解 Git 内部对象模型,等于把哈希 + DAG + 内容寻址串起来看了一遍。',
    features: [
      { t: '内容寻址对象', d: 'blob/tree/commit 按 SHA 哈希存(改内容→新哈希)' },
      { t: '提交 DAG', d: '提交靠父指针连成有向无环图、分支是指针' },
      { t: '分布式', d: '每个克隆是完整仓库、离线可提交' },
      { t: '分支 / 合并', d: '轻量分支、三方合并、rebase' },
      { t: '压缩 / 打包', d: 'zlib 压缩 + packfile 去重(delta)' },
    ],
    pros: ['分布式版本控制事实标准', '内部对象模型优雅(哈希+DAG)', '分支轻量、合并强', 'GPL、生态无敌(GitHub/GitLab)'],
    cons: ['命令多、心智模型有门槛', '大二进制文件不友好(要 LFS)', '子模块/复杂历史易乱', 'GPL-2.0'],
    coverage: [
      { mod: '内容寻址(哈希)', d: '对象按 SHA 哈希寻址', links: [{ label: '哈希表', exp: 'hash' }] },
      { mod: '提交 DAG(拓扑)', d: '有向无环图、父指针', links: [{ label: '拓扑排序', exp: 'topo' }] },
    ],
    projects: ['几乎所有软件项目的版本控制', 'GitHub/GitLab 的底层', '开源协作、代码评审', '理解哈希/DAG 的活案例'],
    seeAlso: '原理看实验「哈希/拓扑排序」、内容去重和「布隆过滤器/压缩」思路相通、托管在 GitHub/GitLab',
  },
  docker: {
    name: 'Docker', tagline: '容器——用 OS 的命名空间 + cgroups + 联合文件系统"打包一个隔离环境"', license: 'Apache-2.0(moby 引擎;Docker Desktop 另有商业条款)', lang: 'Go', latest: '活跃迭代', maintainer: 'Docker Inc. / Moby 项目 + 社区',
    whatIs: 'Docker 是主流的**容器**平台:把应用 + 依赖打包成镜像,在隔离环境里跑。它不是虚拟机,而是直接用 **Linux 内核的原语**——**namespaces**(隔离进程/网络/文件视图)+ **cgroups**(限 CPU/内存)+ **联合文件系统 overlayfs**(镜像分层)。所以 Docker 是「操作系统」概念的活样本:进程隔离、资源限制(和调度相关)、分层文件系统(和 inode/文件系统相关)。理解容器,等于理解 OS 的隔离与资源管理。',
    features: [
      { t: 'namespaces 隔离', d: '进程/网络/挂载/用户视图各自隔离' },
      { t: 'cgroups 资源限制', d: '限 CPU/内存/IO(和调度/配额相关)' },
      { t: '联合文件系统', d: 'overlayfs 镜像分层、写时复制' },
      { t: '镜像 / 仓库', d: 'Dockerfile 构建、分层镜像、Registry 分发' },
      { t: '编排接口', d: 'compose 单机、对接 Kubernetes' },
    ],
    pros: ['环境一致("在我机器能跑"终结者)', '轻量(共享内核、比 VM 省)', '生态巨大、部署标准', 'moby 引擎 Apache-2.0'],
    cons: ['共享内核→隔离性弱于虚拟机', '强依赖 Linux 内核原语', 'Docker Desktop 有商业授权(引擎开源)', '有状态/安全需额外设计'],
    coverage: [
      { mod: 'cgroups 资源限制', d: '限 CPU/内存(和调度/配额相关)', links: [{ label: '进程调度', exp: 'scheduler' }] },
      { mod: '联合文件系统', d: 'overlayfs 分层(和文件系统/inode 相关)', links: [{ label: 'inode/文件系统', exp: 'inode' }] },
    ],
    projects: ['应用打包与一致部署', '微服务 / CI/CD 流水线', '开发环境标准化', 'Kubernetes 集群的容器运行时'],
    seeAlso: '它用的原语在「Linux」内核(namespaces/cgroups)、隔离 vs 虚拟机看「QEMU/KVM」、原理看 OS 实验「调度/文件系统」',
  },
  xv6: {
    name: 'xv6', tagline: '麻省理工的教学操作系统——几千行代码读懂一个真 OS', license: 'MIT', lang: 'C(+汇编)', latest: 'xv6-riscv', maintainer: 'MIT PDOS',
    whatIs: 'xv6 是 MIT 为 OS 课(6.828/6.S081)写的**教学操作系统**:一个**几千行、能真跑**的类 Unix 内核(现版在 RISC-V 上、配 QEMU),麻雀虽小却五脏俱全——**进程/调度、系统调用、虚拟内存(分页)、陷阱中断、文件系统(inode/日志)、锁**。Linux 太大读不动,xv6 正好:你「操作系统」实验里的调度、缺页、inode,在 xv6 里能读到**完整、可编译运行**的最小实现。是学 OS 的最佳"真代码"教材。',
    features: [
      { t: '进程 / 调度', d: '进程结构、上下文切换、调度器' },
      { t: '虚拟内存', d: '分页、页表、缺页' },
      { t: '系统调用 / 陷阱', d: 'syscall、中断、异常处理' },
      { t: '文件系统', d: 'inode、目录、日志(崩溃一致性)' },
      { t: '几千行可读', d: '配套教材,配 QEMU 编译运行' },
    ],
    pros: ['小到能完整读懂一个真 OS', '涵盖 OS 核心(进程/内存/FS/锁)', '可编译运行、配 QEMU 调试', 'MIT、教学一流'],
    cons: ['教学用,不是生产内核', '功能精简(无网络栈等)', '要 RISC-V/QEMU 环境', '深入真实 OS 还得看 Linux'],
    coverage: [
      { mod: '进程调度', d: '上下文切换、调度', links: [{ label: '进程调度', exp: 'scheduler' }] },
      { mod: '虚拟内存', d: '分页、缺页', links: [{ label: '缺页/页替换', exp: 'page' }] },
      { mod: '文件系统', d: 'inode + 日志', links: [{ label: 'inode', exp: 'inode' }] },
    ],
    projects: ['MIT 6.S081 操作系统课', '读懂一个完整 OS 的最短路径', '内核开发入门练习', 'OS 原理教学'],
    seeAlso: '生产内核看「Linux」、跑在「QEMU」上、配「GDB」调试、原理看 OS 实验「调度/缺页/inode」',
  },
  curl: {
    name: 'curl', tagline: '无处不在的网络客户端——命令行/库把 HTTP 等协议请求发出去', license: 'curl License(MIT/X 派生)', lang: 'C', latest: '8.x', maintainer: 'Daniel Stenberg + 社区',
    whatIs: 'curl 是**部署量最大的软件之一**(在几乎每台设备、汽车、手机里):命令行工具 + 库 **libcurl**,把 **HTTP(S)/FTP/等几十种协议**的请求发出去、把响应拿回来。它是「计算机网络」的"客户端侧"活样本——一次 `curl https://...` 背后就是 **DNS→TCP 三次握手→TLS 握手→HTTP 请求/响应**。用 `-v` 能看到握手和头的全过程。是理解"客户端怎么发起一次网络请求"的最直接工具。',
    features: [
      { t: '多协议客户端', d: 'HTTP(S)/FTP/SMTP… 几十种协议' },
      { t: 'libcurl 库', d: '无数软件靠它发网络请求' },
      { t: '看握手/头', d: 'curl -v 看 DNS/TCP/TLS 握手 + 请求响应头' },
      { t: 'TLS / 认证', d: 'HTTPS、各种认证、证书' },
      { t: '脚本友好', d: '命令行一行发请求、调 API 首选' },
    ],
    pros: ['部署量最大、无处不在', '协议全、命令行/库两用', '-v 看请求全过程(学网络神器)', '宽松许可(MIT 派生)'],
    cons: ['是客户端、不做服务端(那是 nginx)', '选项极多(功能强的代价)', '复杂交互不如专用 HTTP 库', '底层细节仍需网络知识'],
    coverage: [
      { mod: '连接:握手', d: '一次请求 = DNS→TCP 握手→TLS→HTTP', links: [{ label: '三次握手', exp: 'handshake' }, { label: 'TCP', exp: 'tcp' }] },
    ],
    projects: ['调 API / 下载 / 自动化脚本', '几乎所有软件的网络请求库(libcurl)', '网络调试(看握手/头)', '网络协议教学(客户端侧)'],
    seeAlso: '服务端看「nginx」、抓包看「Wireshark」、原理看实验「三次握手/TCP」',
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

    //  ⚠️ 库层是"参考页"不是仿真:一次算完、一屏铺开,不拆成假的"计算步骤"走带。
    //     所以只发一帧(trace.length===1,前端据此隐藏走带);四段内容都由 LibraryStage 一次全渲染。
    const covCount = p.coverage.flatMap(c => c.links).length
    push('intro', `${p.name} · 库层参考:特点 / 优缺点 / 覆盖(可点回 ${covCount} 个理论实验) / 落地,一屏读完`,
      `**${p.name} · 库层参考页**\n${p.whatIs}\n\n**基本信息**:许可 **${p.license}**、语言 ${p.lang}、维护 ${p.maintainer}、${p.latest}。\n\n**这是"软件库/框架"层**——不是能焊死仿真的算法,而是把很多算法工程化拼成的系统,所以不走"步"、一屏铺开:①特点 ②优缺点 ③内容覆盖(库里用到的算法=你在实验室焊死过的理论,**链接可点、一键跳回**)④落地项目。库是"用法"、实验是"原理",两层对着看。`)

    const base0: Frame = { ...b0, section: 'intro', step: -1, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '介绍段' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
