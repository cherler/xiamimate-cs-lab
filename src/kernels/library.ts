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
