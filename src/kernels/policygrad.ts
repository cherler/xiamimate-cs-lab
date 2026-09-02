/**
 * 内核：策略梯度 REINFORCE —— 直接参数化策略 π_θ(a|s)，按"增大高回报动作的概率"更新；基线/优势降方差（具身智能 · 机器人强化学习 / 面试八股）
 * 轴：step —— 引子(直接学策略) → softmax 策略 → 采样动作+回报 → 策略梯度 ∇logπ·权重 → 更新 θ、π 变化(带基线 vs 不带) → 收尾。
 *
 * 值方法(Q-learning)先学值再 argmax;**策略梯度直接参数化策略 π_θ**、按目标 J(θ)=E[回报] 做梯度上升。**策略梯度定理**:∇_θ J = E[∇_θ log π_θ(a|s)·G]——
 *   "把导致高回报的动作、概率往上推"。**REINFORCE**:采样轨迹、用 G 估计梯度、上升。优点:天然处理**连续动作**(miniduck 的关节力矩);缺点:**高方差**。
 *   **基线/优势**:用 A=G−b(减去基线 b、常用 V(s))代替 G——**降方差**,且能正确**压制低于平均的动作**(A<0),而不是只要回报>0 就强化。本例单状态 2 动作(L 回报1、R 回报3、b=2):采到较差的 L,带基线 A=−1→π(L)↓(对);不带基线 权重=1→π(L)↑(错、被误强化)。param 基线开/关。全现算。连「Q-learning/PPO(下一课,稳住策略更新)/actor-critic/miniduck」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Base = 'on' | 'off'
export type PgState = {
  i: number
  step: number
  stage: 'intro' | 'policy' | 'sample' | 'gradient' | 'update' | 'done'
  base: Base
  baseLabel: string
  acts: string[]; rewards: number[]
  theta: number[]; pi: number[]
  sampled: number; rS: number
  b: number; adv: number; weight: number
  gradLog: number[]
  dTheta: number[]; thetaNew: number[]; piNew: number[]
  showPolicy: boolean; showSample: boolean; showGrad: boolean; showUpdate: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PgState, 'i'>

const ACTS = ['L', 'R'], REW = [1, 3], ALPHA = 1
const r2 = (x: number) => Math.round(x * 100) / 100
const r3 = (x: number) => Math.round(x * 1000) / 1000
function softmax(z: number[]): number[] { const m = Math.max(...z); const e = z.map(v => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s) }

export const policygradKernel: Kernel<PgState> = {
  kind: 'policygrad',
  compile(doc: SimDocument): CompiledModel<PgState> {
    const base: Base = String(doc.params?.baseline ?? '带基线').includes('不') ? 'off' : 'on'
    const baseLabel = base === 'on' ? '带基线(优势 A=G−b)' : '不带基线(纯回报 G)'

    const theta = [0, 0]
    const pi = softmax(theta)
    const sampled = 0                       // 采到较差的动作 L（演示基线的作用）
    const rS = REW[sampled]!                // 回报 1
    const b = pi.reduce((a, p, k) => a + p * REW[k]!, 0)   // 基线=当前策略下的期望回报
    const adv = rS - b
    const weight = base === 'on' ? adv : rS
    // 策略梯度 ∇log π(a) = onehot(a) − π
    const gradLog = pi.map((p, k) => (k === sampled ? 1 : 0) - p)
    const dTheta = gradLog.map(g => ALPHA * weight * g)
    const thetaNew = theta.map((t, k) => t + dTheta[k]!)
    const piNew = softmax(thetaNew)

    const frames: Frame[] = []
    const b0 = {
      base, baseLabel, acts: ACTS, rewards: REW, theta, pi: pi.map(r3), sampled, rS,
      b: r2(b), adv: r2(adv), weight: r2(weight), gradLog: gradLog.map(r2), dTheta: dTheta.map(r2), thetaNew: thetaNew.map(r2), piNew: piNew.map(r3), phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showPolicy: boolean; showSample: boolean; showGrad: boolean; showUpdate: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showPolicy: false, showSample: false, showGrad: false, showUpdate: false,
      focus: `策略梯度:直接参数化策略 π_θ、按"增大高回报动作的概率"更新;能处理连续动作。基线：${baseLabel}`,
      log: `**策略梯度 REINFORCE:直接学策略**\n「Q-learning」先学值 Q、再 argmax 选动作(值方法)。**策略梯度**换条路:**直接参数化策略 π_θ(a|s)**,以目标 **J(θ)=E[累积回报]** 做**梯度上升**。\n**策略梯度定理**:∇_θ J = E[ ∇_θ log π_θ(a|s) · G ]——直觉就是"**把导致高回报 G 的动作、概率往上推**"。**REINFORCE**:采样一条轨迹、用回报 G 估计这个梯度、更新 θ。\n**为什么要它**:值方法在**连续动作**(比如 miniduck 的关节力矩)上难 argmax;策略梯度天然输出连续动作分布。本例单状态、2 个离散动作(L 回报 ${REW[0]}、R 回报 ${REW[1]}),看它怎么调概率。当前 **${baseLabel}**。` })

    push({
      stage: 'policy', showPolicy: true, showSample: false, showGrad: false, showUpdate: false,
      focus: `softmax 策略 π=softmax(θ),初始 θ=[0,0] → π=[${b0.pi}](均匀)`,
      log: `**① 参数化策略(softmax)**\n用参数 θ 定义策略:**π(a) = softmax(θ)_a = e^{θ_a} / Σ e^{θ_j}**。初始 θ=[0,0] → **π=[L:${b0.pi[0]}, R:${b0.pi[1]}]**(五五开、还没偏好)。\n(连续动作时改用**高斯策略** π=N(μ_θ(s), σ),μ 由网络给出——miniduck 就是这么输出关节残差的。这里用离散 softmax 看清楚。)目标:调 θ 让高回报动作概率变大。` })

    push({
      stage: 'sample', showPolicy: true, showSample: true, showGrad: false, showUpdate: false,
      focus: `采样动作:按 π 采到 ${ACTS[sampled]}(较差、回报 ${rS});基线 b=当前策略期望回报=${b0.b}`,
      log: `**② 采样一个动作、拿回报**\n按当前 π 随机采样,本例采到 **${ACTS[sampled]}**(回报 **G=${rS}**——注意 ${ACTS[sampled]} 是**较差**的动作,R 能拿 ${REW[1]})。\n**基线 b** = 当前策略下的**期望回报** = Σ π(a)·R(a) = ${b0.pi[0]}·${REW[0]} + ${b0.pi[1]}·${REW[1]} = **${b0.b}**。\n**优势 A = G − b** = ${rS} − ${b0.b} = **${b0.adv}**(A<0 说明这个动作**低于平均**、其实是个差动作)。带不带基线,决定用 G 还是 A 当权重。` })

    push({
      stage: 'gradient', showPolicy: true, showSample: true, showGrad: true, showUpdate: false,
      focus: `策略梯度:∇log π(${ACTS[sampled]})=onehot−π=[${b0.gradLog}],权重=${base === 'on' ? `优势 A=${b0.adv}` : `回报 G=${rS}`}`,
      log: `**③ 策略梯度**\n对采到的动作 ${ACTS[sampled]},梯度方向 **∇log π(${ACTS[sampled]}) = onehot(${ACTS[sampled]}) − π** = [1,0] − [${b0.pi}] = **[${b0.gradLog}]**(推高 ${ACTS[sampled]}、压低其它)。\n乘上**权重**:\n${base === 'on'
        ? `**带基线**:权重 = **优势 A = ${b0.adv}**(负!)。梯度 · A = [${b0.gradLog}]·(${b0.adv})——因为 A<0、方向**反过来**:反而**压低** ${ACTS[sampled]} 的概率(它低于平均、就该少选)。`
        : `**不带基线**:权重 = **回报 G = ${rS}**(正)。梯度 · G = [${b0.gradLog}]·${rS}——回报>0 就**推高** ${ACTS[sampled]} 的概率,**哪怕它其实是个差动作**。这就是不带基线的毛病。`}` })

    push({
      stage: 'update', showPolicy: true, showSample: true, showGrad: true, showUpdate: true,
      focus: `更新 θ←θ+α·权重·∇logπ → π(${ACTS[sampled]}) 从 ${b0.pi[sampled]} 变到 ${b0.piNew[sampled]}(${piNew[sampled]! < pi[sampled]! ? '压低✓' : '推高✗'})`,
      log: `**④ 更新 θ、看 π 变化**\nθ ← θ + α·(权重)·∇log π = [0,0] + ${b0.weight}·[${b0.gradLog}] = **[${b0.thetaNew}]** → π=**[${b0.piNew}]**。\n**${ACTS[sampled]}(较差动作)的概率:${b0.pi[sampled]} → ${b0.piNew[sampled]}**。\n${base === 'on'
        ? `**带基线**:A=${b0.adv}<0 → π(${ACTS[sampled]}) **被压低**(${b0.pi[sampled]}→${b0.piNew[sampled]})、好动作 R 相应变大。**正确**:低于平均的动作被抑制。这就是基线/优势的价值——不只是"回报正就强化",而是"比平均好才强化"。`
        : `**不带基线**:G=${rS}>0 → π(${ACTS[sampled]}) 反而 **被推高**(${b0.pi[sampled]}→${b0.piNew[sampled]})!差动作被误强化。纯回报 G 全是正的、方差大、方向常错——所以实践里几乎总要减基线。`}` })

    push({
      stage: 'done', showPolicy: true, showSample: true, showGrad: true, showUpdate: true, phase: 'done',
      focus: `收尾:策略梯度直接学 π、∇logπ·优势;基线降方差;on-policy;高方差→PPO 稳住更新;连 Q-learning/PPO/miniduck`,
      log: `**小结:策略梯度 = 直接把好动作的概率推上去**\n· **策略梯度定理** ∇J=E[∇log π·G]:导致高回报的动作、概率往上推;· **REINFORCE**:采样轨迹估计梯度、上升;· 天然处理**连续动作**(值方法难 argmax 连续动作)。\n· **基线/优势** A=G−b(b 常用 V(s)):**降方差**、正确压制低于平均的动作——这一步把 REINFORCE 引向 **actor-critic**(actor=策略 π、critic=值 V 当基线)。\n**on-policy**:必须用当前策略采的数据更新(用完就扔、样本效率低)。\n**痛点→PPO**:REINFORCE 步子难调——太大一步可能把策略更新崩、太小又慢。**PPO(下一课)**用**裁剪的替代目标**把每次更新**限制在信任域内**,稳、样本利用更好,是当今主力(**miniduck 用的就是 PPO**)。\n**连到别的课**:「Q-learning」是值方法(策略梯度是策略方法);「PPO/SAC」在它上面加稳定化;「miniduck」用 PPO 学走路、动作是连续关节残差。面试延伸:策略梯度定理、REINFORCE 高方差、基线为何降方差且不引入偏差、优势函数、actor-critic、on vs off-policy、连续动作高斯策略。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showPolicy: false, showSample: false, showGrad: false, showUpdate: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '策略梯度步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
