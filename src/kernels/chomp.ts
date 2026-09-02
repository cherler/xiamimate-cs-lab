/**
 * 内核：CHOMP 轨迹优化 —— 把一整条轨迹当变量，梯度下降降"平滑 + 避障"代价；优化式规划（具身智能 · 运动规划 / 面试八股）
 * 轴：step —— 引子(优化整条轨迹) → 初始直线+代价 → 避障梯度(推离障碍) → 平滑梯度(拉向邻居中点) → 下降一步(路径绕过、代价降) → 收尾。
 *
 * 和 RRT/A*(采样/搜索)不同,CHOMP 是**优化式规划**:把整条轨迹 ξ=[q_1..q_n] 当变量,定义**代价 U(ξ)=平滑项 + 避障项**,做**梯度下降** ξ←ξ−α∇U:
 *   **避障梯度**:靠近障碍(在影响半径 d0 内)的路点被往外推(∇ ∝ (d0−dist)·远离方向);**平滑梯度**:每个点被拉向邻居中点(Laplacian、∝2q_i−q_{i−1}−q_{i+1};直线上=0、弯了才有)。
 *   本例 5 路点直线 S(0,0)→G(4,0)穿过障碍(2,0.6)旁:中点 q2=(2,0)离障碍 0.6<d0=1,被避障梯度往下推。**避障优先**(权重大)推到 (2,−0.8);**平滑优先**只推到 (2,−0.2)(更直但擦障碍)。迭代→整条平滑绕过。**局部极小**(同势场)是死穴。param 权重。全现算。连「轨迹规划/RRT/势场法」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type W = 'avoid' | 'smooth'
type Pt = [number, number]
export type ChompState = {
  i: number
  step: number
  stage: 'intro' | 'traj' | 'obstacle' | 'smooth' | 'step' | 'done'
  w: W
  wLabel: string
  kObs: number; d0: number; alpha: number
  obs: Pt
  traj: Pt[]                    // 初始轨迹
  distToObs: number
  gObs: Pt; gSmooth: Pt        // q2 的两个梯度分量(下降方向)
  q2New: Pt
  trajNew: Pt[]
  showTraj: boolean; showObs: boolean; showSmooth: boolean; showStep: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<ChompState, 'i'>

const OBS: Pt = [2, 0.6], D0 = 1, ALPHA = 1
const TRAJ: Pt[] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]
const r2 = (x: number) => Math.round(x * 100) / 100
const dist = (a: Pt, b: Pt) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

export const chompKernel: Kernel<ChompState> = {
  kind: 'chomp',
  compile(doc: SimDocument): CompiledModel<ChompState> {
    const w: W = String(doc.params?.weight ?? '避障优先').includes('平滑') ? 'smooth' : 'avoid'
    const wLabel = w === 'avoid' ? '避障优先(k_obs=2)' : '平滑优先(k_obs=0.5)'
    const kObs = w === 'avoid' ? 2 : 0.5

    const q1 = TRAJ[1]!, q2 = TRAJ[2]!, q3 = TRAJ[3]!
    const d = dist(q2, OBS)
    // 避障梯度(下降=远离障碍):方向 (q2−O)/dist、大小 k_obs·(d0−dist)（仅 dist<d0）
    const away: Pt = [(q2[0] - OBS[0]) / d, (q2[1] - OBS[1]) / d]
    const mag = d < D0 ? kObs * (D0 - d) : 0
    const gObs: Pt = [mag * away[0], mag * away[1]]
    // 平滑梯度(下降方向 = 拉向邻居中点)：−(2q2−q1−q3) = 邻居中点−q2
    const gSmooth: Pt = [(q1[0] + q3[0]) / 2 - q2[0], (q1[1] + q3[1]) / 2 - q2[1]]
    // 下降一步：q2 ← q2 + α(gObs + gSmooth)
    const q2New: Pt = [r2(q2[0] + ALPHA * (gObs[0] + gSmooth[0])), r2(q2[1] + ALPHA * (gObs[1] + gSmooth[1]))]
    const trajNew: Pt[] = TRAJ.map((p, k) => (k === 2 ? q2New : p))

    const frames: Frame[] = []
    const b0 = {
      w, wLabel, kObs, d0: D0, alpha: ALPHA, obs: OBS, traj: TRAJ, distToObs: r2(d),
      gObs: [r2(gObs[0]), r2(gObs[1])] as Pt, gSmooth: [r2(gSmooth[0]), r2(gSmooth[1])] as Pt, q2New, trajNew, phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showTraj: boolean; showObs: boolean; showSmooth: boolean; showStep: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showTraj: false, showObs: false, showSmooth: false, showStep: false,
      focus: `CHOMP:把整条轨迹当变量、梯度下降降"平滑+避障"代价。和采样/搜索不同的优化式规划。权重：${wLabel}`,
      log: `**CHOMP:把一整条轨迹"优化"到又平滑又避障**\n「RRT/A\*」是采样/搜索;CHOMP 是**优化式规划**——把**整条轨迹** ξ=[q_1,…,q_n] 当成变量,定义一个**代价** U(ξ)= **平滑项 + 避障项**,然后**梯度下降** ξ ← ξ − α·∇U,让整条轨迹一起往"更平滑、更避障"挪。\n本例:2D、5 个路点、初始是从 S(0,0) 到 G(4,0) 的**直线**、中间挨着障碍 O=(${OBS})。当前 **${wLabel}**。看两个梯度怎么把直线掰成绕开障碍的平滑曲线。` })

    push({
      stage: 'traj', showTraj: true, showObs: true, showSmooth: false, showStep: false,
      focus: `初始直线轨迹 5 路点;中点 q2=(2,0) 离障碍 (2,0.6) 只有 ${b0.distToObs}<d0=${D0}(危险)`,
      log: `**① 初始轨迹 + 代价**\n初始轨迹是直线 5 路点:${TRAJ.map(p => `(${p})`).join('、')}(端点 S、G 固定,只优化中间 3 个)。\n代价 U(ξ) = **平滑项**(Σ‖q_{i+1}−q_i‖²、惩罚不平滑/急转) + **避障项**(路点离障碍近就罚、影响半径 d0=${D0})。\n**中点 q2=(2,0) 离障碍 O=(${OBS}) 只有 ${b0.distToObs}** < d0=${D0} → 避障项在这最大、这条直线代价高。梯度会重点动它。` })

    push({
      stage: 'obstacle', showTraj: true, showObs: true, showSmooth: false, showStep: false,
      focus: `避障梯度:把 q2 往远离障碍方向推,∇ ∝ (d0−dist)·远离方向 = [${b0.gObs}](向下、离开上方的障碍)`,
      log: `**② 避障梯度(把点推离障碍)**\n对每个落在影响半径 d0 内的路点,避障梯度沿**远离障碍**方向、大小 ∝ (d0−dist):\nq2 离障碍 ${b0.distToObs}、远离方向 = (q2−O)/dist = [${r2(away[0])}, ${r2(away[1])}](向下,因为障碍在上方);大小 = k_obs·(d0−dist) = ${kObs}·(${D0}−${b0.distToObs}) = ${r2(mag)}。\n→ **避障梯度 = [${b0.gObs}]**(把 q2 往下推、离开障碍)。**离障碍越近推得越猛**。(q1、q3 离障碍 ${r2(dist(q1, OBS))}>d0,这一步不受避障力。)` })

    push({
      stage: 'smooth', showTraj: true, showObs: true, showSmooth: true, showStep: false,
      focus: `平滑梯度:把每点拉向邻居中点(Laplacian),直线上 q2 的邻居中点就是它自己 → [${b0.gSmooth}]=0`,
      log: `**③ 平滑梯度(把点拉向邻居中点)**\n平滑项让轨迹别有急转,梯度把每个点**拉向左右邻居的中点**(有限差分/Laplacian):∇_smooth(q2) ∝ 邻居中点 − q2 = ((q1+q3)/2) − q2 = ((${q1[0]}+${q3[0]})/2, 0) − (2,0) = **[${b0.gSmooth}]**。\n**直线上、q2 正好在 q1、q3 中点 → 平滑梯度=0**(已经很平滑、没得可平)。但等避障把 q2 推下去、它偏离中点后,平滑梯度就会出现、把邻居 q1/q3 也带下来跟随——这就是**整条轨迹协同变形**、绕过障碍还保持平滑。` })

    push({
      stage: 'step', showTraj: true, showObs: true, showSmooth: true, showStep: true,
      focus: `下降一步:q2 ← q2+α(避障+平滑)=(2,0)+[${b0.gObs}] → q2=(${b0.q2New});路径绕到障碍下方、避障代价下降`,
      log: `**④ 梯度下降一步**\nq2 ← q2 + α·(避障梯度 + 平滑梯度) = (2,0) + ${ALPHA}·([${b0.gObs}] + [${b0.gSmooth}]) = **(${b0.q2New})**。\n**${w === 'avoid' ? '避障优先(k_obs 大)' : '平滑优先(k_obs 小)'}**:q2 从 (2,0) 挪到 **(${b0.q2New})**——${w === 'avoid' ? '推得狠、离障碍远(y=−0.8)、路径明显绕下去。' : '推得轻、只到 y=−0.2、更接近直线但离障碍还近(擦着走)。'}\n避障项代价下降。**再迭代几步**:平滑梯度把 q1、q3 也带下来、整条轨迹变成一条绕开障碍的平滑曲线。这就是 CHOMP:一整条轨迹一起下降。` })

    push({
      stage: 'done', showTraj: true, showObs: true, showSmooth: true, showStep: true, phase: 'done',
      focus: `收尾:CHOMP=轨迹当变量、梯度下降(平滑+避障);协变(用度量);局部极小死穴;连轨迹规划/RRT/势场`,
      log: `**小结:CHOMP = 对一整条轨迹做梯度下降**\n· **代价** U=平滑项(邻点差、惩罚急转)+避障项(近障碍罚);· **避障梯度**推离障碍(∝ d0−dist);· **平滑梯度**拉向邻居中点(Laplacian);· **下降** ξ←ξ−α∇U,整条轨迹协同变形、绕障碍且平滑。\n· **协变(covariant)**:CHOMP 用一个度量矩阵 A(平滑度)做更新、而非朴素欧氏梯度——更新更稳、和轨迹参数化无关。\n**死穴=局部极小**:和「势场法」一样,梯度下降会卡在局部极小(障碍布局刁钻时优化不出可行轨迹)——所以常**从多条初始轨迹**优化取最好,或先用 RRT 出个可行初值再 CHOMP 平滑。\n**vs 其它规划**:采样(RRT/PRM)、搜索(A\*)、反应式(势场)、**优化(CHOMP/TrajOpt/STOMP)**——CHOMP 直接产出**平滑可执行**的轨迹(采样/搜索出的折线还要再平滑)。**连到别的课**:「轨迹规划/梯形速度曲线」是给几何路径配时间;「RRT」可当 CHOMP 的初值;「势场法」和它同为梯度/势能思路。面试延伸:CHOMP 的平滑+避障代价、协变梯度、局部极小、和 STOMP(采样式)/TrajOpt(序列凸)的区别、当初值 vs 当主规划器。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showTraj: false, showObs: false, showSmooth: false, showStep: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '优化步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
