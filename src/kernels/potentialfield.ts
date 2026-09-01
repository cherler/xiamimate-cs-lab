/**
 * 内核：人工势场法 · 反应式规划 —— 目标产生引力、障碍产生斥力，机器人顺合力"下山"；快，但有局部极小死穴（具身智能 · 运动规划 / 面试八股）
 * 轴：step —— 引子(势场直觉) → 引力(指向目标、正比距离) → 斥力(仅影响半径内、推离障碍) → 合力(顺它走一步) → 结局(偏侧绕过/正中卡局部极小) → 收尾。
 *
 * 2D:目标 (10,2)、影响半径 ρ0=3、k_att=1、k_rep=30。**引力** F_att=k_att·(q_goal−q)(指向目标、正比距离)。**斥力** F_rep(仅 ρ≤ρ0)=k_rep·(1/ρ−1/ρ0)·(1/ρ²)·n̂(n̂ 从障碍指向机器人、越近越大)。**合力** F=F_att+F_rep,机器人沿 F 走(在势能面上梯度下降)。
 *   **死穴——局部极小**:障碍**正中**挡在机器人和目标之间时,引力(朝目标)和斥力(离障碍)**共线相反**,某处**抵消→合力≈0→卡住、到不了目标**。障碍**偏侧**时斥力有横向分量→合力把机器人**推向侧面绕过**→到达。
 * param 选障碍位置(偏侧能绕过 / 正中卡局部极小)。引力/斥力/合力全现算。连「RRT(全局、无局部极小)/阻抗力控(斥力≈虚拟弹簧)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Scen = 'side' | 'center'
type V = [number, number]
export type PotState = {
  i: number
  step: number
  stage: 'intro' | 'attractive' | 'repulsive' | 'total' | 'outcome' | 'done'
  scen: Scen
  scenLabel: string
  robot: V; goal: V; obs: V; rho0: number; kAtt: number; kRep: number
  rhoGoal: number; rhoObs: number
  fAtt: V; fRep: V; fTotal: V; fMag: number
  distToGoal: number; stuck: boolean
  showAtt: boolean; showRep: boolean; showTotal: boolean; showOut: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PotState, 'i'>

const GOAL: V = [10, 2], RHO0 = 3, K_ATT = 1, K_REP = 30
const r2 = (x: number) => Math.round(x * 100) / 100
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]]
const norm = (a: V) => Math.sqrt(a[0] * a[0] + a[1] * a[1])

export const potentialfieldKernel: Kernel<PotState> = {
  kind: 'potentialfield',
  compile(doc: SimDocument): CompiledModel<PotState> {
    const scen: Scen = String(doc.params?.scenario ?? '障碍正中').includes('偏侧') ? 'side' : 'center'
    const scenLabel = scen === 'side' ? '障碍偏侧(能绕过)' : '障碍正中(卡局部极小)'
    const robot: V = scen === 'side' ? [4, 2] : [4.57, 2]
    const obs: V = scen === 'side' ? [6, 3.5] : [6, 2]

    const toGoal = sub(GOAL, robot)
    const rhoGoal = norm(toGoal)
    const fAtt: V = [K_ATT * toGoal[0], K_ATT * toGoal[1]]

    const awayVec = sub(robot, obs)
    const rhoObs = norm(awayVec)
    const nHat: V = [awayVec[0] / rhoObs, awayVec[1] / rhoObs]
    let fRep: V = [0, 0]
    if (rhoObs <= RHO0) {
      const mag = K_REP * (1 / rhoObs - 1 / RHO0) * (1 / (rhoObs * rhoObs))
      fRep = [mag * nHat[0], mag * nHat[1]]
    }
    const fTotal: V = [fAtt[0] + fRep[0], fAtt[1] + fRep[1]]
    const fMag = norm(fTotal)
    const distToGoal = rhoGoal
    const stuck = fMag < 0.5 && distToGoal > 1   // 合力≈0 却离目标还远 = 局部极小

    const R = (v: V): V => [r2(v[0]), r2(v[1])]
    const frames: Frame[] = []
    const b0 = {
      scen, scenLabel, robot, goal: GOAL, obs, rho0: RHO0, kAtt: K_ATT, kRep: K_REP,
      rhoGoal: r2(rhoGoal), rhoObs: r2(rhoObs), fAtt: R(fAtt), fRep: R(fRep), fTotal: R(fTotal), fMag: r2(fMag),
      distToGoal: r2(distToGoal), stuck, phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showAtt: boolean; showRep: boolean; showTotal: boolean; showOut: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showAtt: false, showRep: false, showTotal: false, showOut: false,
      focus: `势场法:目标产生引力、障碍产生斥力,机器人顺合力"下山"。反应式、快,但有局部极小死穴。场景：${scenLabel}`,
      log: `**人工势场法:把规划变成"顺着合力下山"**\n不采样、不搜图——**势场法**给空间造一个势能面:\n· **目标** = 一个"低谷"(引力,把机器人往目标拉);· **障碍** = 一座座"高山"(斥力,把机器人往外推)。\n机器人只要**顺着合力方向走**(在势能面上梯度下降)就往目标去。优点:**极简、反应式、快**(适合实时避障)。\n本例 2D:机器人=(${robot})、目标=(${GOAL})、障碍=(${obs})、影响半径 ρ0=${RHO0}。当前场景 **${scenLabel}**。看它到底能不能到。` })

    push({
      stage: 'attractive', showAtt: true, showRep: false, showTotal: false, showOut: false,
      focus: `引力 F_att=k_att·(q_goal−q)=${JSON.stringify(b0.fAtt)}（指向目标、正比距离 ${b0.rhoGoal}）`,
      log: `**① 引力(把机器人拉向目标)**\nF_att = **k_att·(q_goal − q)** = ${K_ATT}·((${GOAL})−(${robot})) = **[${b0.fAtt}]**。\n**指向目标、大小正比于离目标的距离**(离得越远拉得越猛;有的实现远处改成常力防止太大)。当前离目标 ρ_goal=**${b0.rhoGoal}**。只有引力时,机器人会径直冲向目标(也冲向挡路的障碍)。` })

    push({
      stage: 'repulsive', showAtt: true, showRep: true, showTotal: false, showOut: false,
      focus: rhoObs <= RHO0 ? `斥力 F_rep=k_rep·(1/ρ−1/ρ0)·(1/ρ²)·n̂=${JSON.stringify(b0.fRep)}（ρ=${b0.rhoObs}≤ρ0，推离障碍）` : `斥力 0（ρ=${b0.rhoObs}>ρ0，在影响半径外）`,
      log: `**② 斥力(把机器人推离障碍)**\nF_rep = **k_rep·(1/ρ − 1/ρ0)·(1/ρ²)·n̂**(仅当 ρ≤ρ0;n̂ 从障碍指向机器人)。\n机器人到障碍距离 ρ=**${b0.rhoObs}**、影响半径 ρ0=${RHO0}。\n${rhoObs <= RHO0
        ? `ρ≤ρ0 → 斥力生效:大小=${K_REP}·(1/${b0.rhoObs}−1/${RHO0})·(1/${b0.rhoObs}²)=**${r2(norm(fRep))}**,方向 n̂=[${r2(nHat[0])},${r2(nHat[1])}](离障碍)→ F_rep=**[${b0.fRep}]**。**越靠近障碍、斥力越猛**(1/ρ² 爆增),这保证撞不上。`
        : `ρ>ρ0 → 斥力=0(还在障碍影响范围外)。`}` })

    push({
      stage: 'total', showAtt: true, showRep: true, showTotal: true, showOut: false,
      focus: `合力 F=F_att+F_rep=[${b0.fAtt}]+[${b0.fRep}]=[${b0.fTotal}]（大小 ${b0.fMag}）,机器人沿它走一步`,
      log: `**③ 合力 = 引力 + 斥力**\nF = F_att + F_rep = [${b0.fAtt}] + [${b0.fRep}] = **[${b0.fTotal}]**(大小 **${b0.fMag}**)。\n机器人沿合力方向走一小步(q ← q + 步长·F/|F|),就是在势能面上**梯度下降**。\n${scen === 'side'
        ? `本场景障碍偏侧:斥力有**横向分量**(y 方向 ${b0.fRep[1]}),把合力**偏向侧面**——机器人会绕着障碍走。`
        : `本场景障碍正中:引力(+x ${b0.fAtt[0]})和斥力(−x ${b0.fRep[0]})**共线相反**,合力只剩 **${b0.fTotal[0]}**(几乎抵消!)。`}` })

    push({
      stage: 'outcome', showAtt: true, showRep: true, showTotal: true, showOut: true,
      focus: stuck ? `卡局部极小:合力≈0(${b0.fMag}) 却离目标还有 ${b0.distToGoal}→机器人停住、到不了目标` : `绕过:斥力横向分量把机器人推向侧面→顺合力绕开障碍→到达目标`,
      log: `**④ 结局:${scen === 'side' ? '绕过、到达' : '卡在局部极小'}**\n${scen === 'side'
        ? `**障碍偏侧**:合力 [${b0.fTotal}]——主分量朝目标(+x)、还有横向分量把机器人往障碍旁边带。机器人**顺势绕过障碍、继续下山到目标**。这是势场法正常工作的样子。`
        : `**障碍正中**:引力和斥力共线相反、在这里几乎**完全抵消**,合力大小只有 **${b0.fMag}**≈0——但机器人**离目标还有 ${b0.distToGoal}**!这就是**局部极小(local minimum)**:势能面上除了目标那个谷,障碍前面还挖出一个"假谷",机器人滑进去就**停住、再也到不了目标**。这是势场法最有名的死穴。`}` })

    push({
      stage: 'done', showAtt: true, showRep: true, showTotal: true, showOut: true, phase: 'done',
      focus: `收尾:势场法=引力+斥力顺合力下山,极简反应式;死穴=局部极小;解法随机扰动/导航函数/配全局规划;连 RRT/力控`,
      log: `**小结:势场法极简好用,但栽在局部极小**\n· **引力** F_att=k_att·(q_goal−q) 拉向目标;· **斥力** F_rep(仅 ρ≤ρ0、∝1/ρ²)推离障碍;· 顺**合力** F=F_att+F_rep 梯度下降。\n**优点**:极简、反应式、快、天然适合实时避障、还能直接当力控指令。\n**死穴——局部极小**:障碍正中时引力斥力抵消、合力≈0,机器人**卡在离目标还很远的假谷里出不来**(本例卡在离目标 ${scen === 'center' ? b0.distToGoal : '~5'})。窄通道还会来回震荡。\n**解法**:①加**随机扰动**跳出;②用**导航函数(navigation function)**——构造保证只有目标一个极小的势场(理论优雅但难构造);③**和全局规划结合**:用 RRT/A\* 出一条无碰全局路、势场只做局部平滑避障。\n**连到别的课**:「RRT/RRT\*」是全局采样规划(没有局部极小问题、但不反应式);「阻抗/力控」的虚拟弹簧和斥力场同源(都把环境建成力)。面试延伸:势场法为何有局部极小、怎么解、和梯度下降的关系、斥力为何用 1/ρ²、窄通道震荡。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showAtt: false, showRep: false, showTotal: false, showOut: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '势场步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
