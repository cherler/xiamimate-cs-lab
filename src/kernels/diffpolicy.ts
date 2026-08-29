/**
 * 内核：Diffusion Policy · 去噪生成动作真仿真 —— 用扩散模型建"多峰"动作分布，从噪声去噪采出一个模态；治 BC 把多解平均成错解的病（具身智能 · 具身学习）
 * 轴：step —— 绕障碍这类任务有多个正确解(向左/向右)。BC 回归会把它们平均成"直行"→撞。Diffusion Policy 从随机噪声出发、沿学到的能量逐步去噪，收敛到某一个模态(左或右)
 *
 * BC(行为克隆)除了分布漂移,还有第二个病:**多峰(multimodal)动作被平均**。绕前方障碍,专家有时向左、有时向右——两个都对。
 * BC 是回归、只输出**一个**动作,于是把"左(−1)"和"右(+1)"**平均成 0(直行)**——正好撞上障碍。这不是数据问题,是"回归求均值"的结构问题。
 * **Diffusion Policy** 换成**生成模型**:不预测单个动作,而是建整个**动作分布**(可多峰),用**扩散/去噪**采样——
 *   从一个**随机噪声**动作出发,沿学到的**能量/分数**一步步**去噪**(把噪声往高概率区拉),最终落到**某一个模态**(向左 或 向右),而不是它们的平均。
 * 不同的初始噪声 → 收敛到不同模态 → 天然表达"多解",还保持每条动作序列内部**连贯**(时间上不抖)。这正是现代 **VLA** 动作头广泛采用扩散的原因。
 * 本例把动作分布画成双阱能量 U=(x²−1)²(两个模态在 ±1),BC 均值落在 0(撞),扩散从两个噪声种子去噪、分别收敛到 +1(右绕)和 −1(左绕)。去噪每步真算、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100

export type DiffPolicyState = {
  i: number
  step: number
  phase: 'intro' | 'bc' | 'denoise' | 'done'
  op: 'intro' | 'bc' | 'step' | 'summary'
  bcAction: number             // BC 回归输出（=两模态平均）
  seedA: number[]              // 去噪轨迹 A（→ 右模态 +1）
  seedB: number[]              // 去噪轨迹 B（→ 左模态 −1）
  shown: number                // 已去噪到第几步
  aVal: number
  bVal: number
  focus: string
  log: string
}
type Frame = Omit<DiffPolicyState, 'i'>

const ETA = 0.06, K = 16
const grad = (x: number) => 4 * x * (x * x - 1)   // 双阱能量 U=(x²−1)² 的梯度（模态在 ±1）
const denoise = (x0: number) => { let x = x0; const t = [r2(x)]; for (let k = 0; k < K; k++) { x = r2(x - ETA * grad(x)); t.push(x) } return t }
const SEED_A = denoise(0.35), SEED_B = denoise(-0.5)
const REVEAL = [0, 3, 6, 9, 12, K]

export const diffpolicyKernel: Kernel<DiffPolicyState> = {
  kind: 'diffpolicy',
  compile(_doc: SimDocument): CompiledModel<DiffPolicyState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'bcAction' | 'seedA' | 'seedB'>) => frames.push({ step: frames.length, bcAction: 0, seedA: SEED_A, seedB: SEED_B, ...f })

    push({
      phase: 'intro', op: 'intro', shown: 0, aVal: SEED_A[0]!, bVal: SEED_B[0]!,
      focus: 'BC 把多解平均成错解；Diffusion Policy 建多峰分布、去噪采一个模态',
      log: `**Diffusion Policy：会"选一条"而不是"取平均"**\nBC 除了分布漂移，还有第二个病：**多峰动作被平均**。绕前方障碍，专家有时向左(−1)、有时向右(+1)，两个都对。\nBC 是回归、只输出**一个**动作 → 把左和右**平均成 0(直行)** → 正好撞上障碍！这是"回归求均值"的结构问题。\nDiffusion Policy 换成**生成模型**：建整个**动作分布**(可多峰)，从**噪声去噪**采样出**某一个模态**。看它怎么修。`,
    })

    push({
      phase: 'bc', op: 'bc', shown: 0, aVal: SEED_A[0]!, bVal: SEED_B[0]!,
      focus: 'BC 回归：把 左(−1) 与 右(+1) 平均 → 动作 0(直行) → 撞障碍',
      log: `**BC 的病：平均两个模态**\n专家演示里，绕障碍的动作是**双峰**：一半向左(动作 −1)、一半向右(+1)。\nBC 用回归拟合、最小化均方误差 → 最优的单点预测就是**均值 = (−1 + +1)/2 = 0** = **直行**。\n可"直行"恰恰**撞上障碍**——两个正确解平均出一个错误解。加大网络也没用，这是回归的结构缺陷。`,
    })

    REVEAL.forEach((k, si) => {
      const aVal = SEED_A[k]!, bVal = SEED_B[k]!
      const last = si === REVEAL.length - 1
      push({
        phase: last ? 'done' : 'denoise', op: last ? 'summary' : 'step', shown: k, aVal, bVal,
        focus: `去噪第 ${k} 步：种子A → ${aVal}，种子B → ${bVal}${last ? '（分别收敛到 右/左 两个模态）' : ''}`,
        log: last
          ? `**去噪第 ${k} 步：各自落到一个模态**\n种子A 从噪声 ${SEED_A[0]} 去噪 → **${aVal}(≈+1，向右绕)**；种子B 从 ${SEED_B[0]} → **${bVal}(≈−1，向左绕)**。\n**不同噪声 → 不同模态**，都是有效解，绕过了障碍——而 BC 只会给出撞障碍的 0。\n\n**要点**：Diffusion Policy 不预测单个动作、而是**建整个动作分布(可多峰)并从噪声去噪采样**。去噪 = 从随机噪声出发、沿学到的**分数/能量**一步步把样本往高概率区拉，最终落到**某一个模态**而非平均。好处：①**多峰**——绕障"左或右"都能出，不被平均成撞；②**动作序列内部连贯**(一次去噪出一整段、时间上不抖)；③表达力强、对复杂/接触任务鲁棒。代价：采样要迭代多步(比一次回归慢，工程上用 DDIM/一致性模型/流匹配加速)。这正是现代 **VLA(视觉-语言-动作大模型)** 动作头广泛用扩散的原因(RT、π0 等)。和 BC 的关系：都从示范学，但扩散建的是分布、不是均值，天然治多峰；配 DAgger/RL 还能进一步补纠错。下一课：VLA——把视觉+语言塞进来、大模型直接产动作。`
          : `**去噪第 ${k} 步**\n${k === 0 ? `两个样本从**随机噪声**出发：种子A=${aVal}、种子B=${bVal}。它们不在任何模态上。` : `沿学到的能量去噪：种子A → **${aVal}**(往 +1 靠)、种子B → **${bVal}**(往 −1 靠)。每步把样本往最近的高概率模态拉一点——不是拉向平均(0)，而是拉向某一个峰。`}`,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, bcAction: 0, seedA: SEED_A, seedB: SEED_B, shown: 0, aVal: SEED_A[0]!, bVal: SEED_B[0]!, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '去噪步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
