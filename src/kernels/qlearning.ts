/**
 * 内核：Q-learning · 免模型强化学习 —— 不知道转移/奖励模型，从经验 (s,a,r,s') 里学 Q(s,a)；TD 更新、off-policy（具身智能 · 机器人强化学习 / 面试八股）
 * 轴：step —— 引子(免模型) → Q 表(初始0、argmax给策略) → TD 更新(C→G 一次) → 一回合传播(奖励每回合往回一步) → 多回合收敛(=值迭代同解) → 收尾。
 *
 * 和「MDP 值迭代」(要知道转移 P 和奖励 R、有模型)不同,Q-learning **免模型**:只从**经验元组 (s,a,r,s')** 学**动作值 Q(s,a)**。
 *   **TD 更新**:Q(s,a) ← Q(s,a) + α·[ r + γ·max_a' Q(s',a') − Q(s,a) ]。方括号=**TD 误差 δ**(自举 bootstrapping:用当前 Q 估计未来)。**off-policy**:用 max(贪心)学最优 Q、同时行为可带探索(ε-greedy)。
 *   同一条链 A→B→C→G(C→G 得 +1、γ=0.9)。首次更新 C→G:δ=1+γ·0−0=1、Q(C,→)←α·1。**奖励每回合往回传一步**;多回合后 Q 收敛到 **[0.81,0.9,1]**(和值迭代的 V\\* 一模一样、但免模型+从经验渐进学)。param 学习率 α(快/慢稳)。全现算。连「MDP(有模型)/PPO/DQN(神经网络近似Q)/miniduck」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Al = 'fast' | 'slow'
export type QState = {
  i: number
  step: number
  stage: 'intro' | 'qtable' | 'tdupdate' | 'episode' | 'converge' | 'done'
  al: Al
  alLabel: string
  alpha: number; gamma: number
  td: { r: number; maxNext: number; oldQ: number; delta: number; newQ: number }
  q1ep: Record<string, number>       // 一回合后 Q(·,→)
  qConv: Record<string, number>      // 收敛 Q(·,→)=V*
  showQ: boolean; showTd: boolean; showEp: boolean; showConv: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<QState, 'i'>

const GAMMA = 0.9
const r2 = (x: number) => Math.round(x * 100) / 100

export const qlearningKernel: Kernel<QState> = {
  kind: 'qlearning',
  compile(doc: SimDocument): CompiledModel<QState> {
    const al: Al = String(doc.params?.alpha ?? '快').includes('慢') ? 'slow' : 'fast'
    const alLabel = al === 'fast' ? 'α=0.5(快)' : 'α=0.2(慢稳)'
    const alpha = al === 'fast' ? 0.5 : 0.2

    // 首次更新 C→G：δ = r + γ·max Q(G,·) − Q(C,→) = 1 + 0 − 0
    const r = 1, maxNext = 0, oldQ = 0
    const delta = r + GAMMA * maxNext - oldQ
    const newQ = r2(oldQ + alpha * delta)
    const td = { r, maxNext, oldQ, delta: r2(delta), newQ }
    // 一回合后（在线正序更新：只有紧挨奖励的 C 学到）
    const q1ep = { A: 0, B: 0, C: newQ }
    // 收敛（= 值迭代 V*：γ^到G步数·1）
    const qConv = { A: r2(GAMMA * GAMMA), B: r2(GAMMA), C: 1 }

    const frames: Frame[] = []
    const b0 = { al, alLabel, alpha, gamma: GAMMA, td, q1ep, qConv, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showQ: boolean; showTd: boolean; showEp: boolean; showConv: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showQ: false, showTd: false, showEp: false, showConv: false,
      focus: `Q-learning 免模型:不知道转移/奖励模型,从经验 (s,a,r,s') 学 Q(s,a)。对比值迭代(要模型)。学习率：${alLabel}`,
      log: `**Q-learning:不用模型、从试错里学**\n上一课「MDP 值迭代」要**知道转移 P 和奖励 R**(有模型)才能算。可真实机器人 P、R 往往**未知**——**Q-learning 免模型**:什么都不知道,只靠**和环境交互得到的经验元组 (s, a, r, s')**,直接学**动作值 Q(s,a)**(在状态 s 做动作 a、之后最优能拿多少回报)。\n为什么学 Q 不学 V?——**argmax_a Q(s,a) 直接给出策略**、不需要转移模型;而用 V 选动作还得知道 P。\n同一条链 A→B→C→G(C→G 得 +1、γ=${GAMMA})。当前学习率 **${alLabel}**。看它怎么从经验里把 Q 学出来。` })

    push({
      stage: 'qtable', showQ: true, showTd: false, showEp: false, showConv: false,
      focus: `Q 表:每个(状态,动作)一个值,初始全 0;学好后 argmax_a Q(s,a) 就是策略`,
      log: `**① Q 表(初始全 0)**\nQ-learning 维护一张 **Q(s,a) 表**(这里每状态两个动作 →/←)。初始**全 0**(什么都没学到)。\n目标:通过和环境交互,把 Q 更新到最优 **Q\\***;之后每个状态取 **argmax_a Q(s,a)** 就是最优策略。\n现在 Q 全 0、策略还是瞎猜。让智能体走一遍、用经验更新它。` })

    push({
      stage: 'tdupdate', showQ: true, showTd: true, showEp: false, showConv: false,
      focus: `TD 更新(经验 C→G):δ=r+γ·max Q(s',·)−Q=${td.delta}、Q(C,→)←Q+α·δ=${td.newQ}`,
      log: `**② TD 更新(时序差分)**\n智能体在 C 选 →、到 G、拿到 r=1。用这条经验更新 Q(C,→):\n**Q(s,a) ← Q(s,a) + α·[ r + γ·max_a' Q(s',a') − Q(s,a) ]**\n方括号里是 **TD 误差 δ** = r + γ·max Q(G,·) − Q(C,→) = ${r} + ${GAMMA}·${maxNext} − ${oldQ} = **${td.delta}**。\nQ(C,→) ← ${oldQ} + α·${td.delta} = 0 + ${alpha}·${td.delta} = **${td.newQ}**。\n**自举(bootstrapping)**:用"当前对未来的估计 max Q(s')"来更新——不用等回合结束、走一步更一次。α 是学习率(每次朝目标挪多少)。` })

    push({
      stage: 'episode', showQ: true, showTd: true, showEp: true, showConv: false,
      focus: `一回合后:只有紧挨奖励的 C 学到 ${td.newQ}(A、B 还是 0)——奖励每回合往回传一步`,
      log: `**③ 一回合的效果:奖励只往回传一步**\n智能体走 A→B→C→G,**在线正序**更新:\n· (A,→)：δ=0+γ·max Q(B)−0=0(Q(B) 还是 0)→ 不变;· (B,→)：δ=0+γ·max Q(C)−0=0 → 不变;· (C,→)：δ=1 → **Q(C,→)=${td.newQ}**。\n一回合后 Q(·,→) = [A:${q1ep.A}, B:${q1ep.B}, C:${q1ep.C}]——**只有紧挨奖励的 C 学到了**。因为更新是自举的,B 要等 C 有值了、下回合才学得到。**奖励每回合往回传播一步**(这也是为什么 Q-learning 慢、催生了经验回放/资格迹)。` })

    push({
      stage: 'converge', showQ: true, showTd: true, showEp: true, showConv: true,
      focus: `多回合后 Q 收敛到 [${qConv.A}, ${qConv.B}, ${qConv.C}]——和值迭代的 V* 一模一样,但免模型+从经验学`,
      log: `**④ 多回合收敛:学出和值迭代一样的答案**\n反复跑很多回合(每回合奖励再往回传一步、α 逐步把 Q 挪到位),Q(·,→) 收敛到:\n**[A:${qConv.A}, B:${qConv.B}, C:${qConv.C}]** —— 正好是「MDP 值迭代」算出的 **V\\* = γ^(到G步数)·1**!\n**关键**:Q-learning **不用模型**(不知道 P/R)、只靠经验,却学到了**和有模型值迭代完全一样的最优值**。α 大(0.5)学得快但抖、α 小(0.2)慢但稳,都收敛到同一答案。\n**探索(ε-greedy)**:要学到最优,智能体必须**走遍**各状态动作——所以行为上以 ε 概率随机探索、1−ε 概率贪心。**off-policy**:更新用 max(贪心/目标策略),行为却带探索(行为策略)——学的和做的可以不一样。` })

    push({
      stage: 'done', showQ: true, showTd: true, showEp: true, showConv: true, phase: 'done',
      focus: `收尾:Q-learning 免模型+TD+off-policy;探索利用;收敛=值迭代;连 MDP/DQN(神经网络近似Q)/PPO/miniduck`,
      log: `**小结:Q-learning = 免模型 + TD + off-policy**\n· **免模型(model-free)**:不知道 P/R,只从经验 (s,a,r,s') 学 Q;· **TD 更新**:Q←Q+α[r+γmax Q(s')−Q],自举、走一步更一次;· **off-policy**:更新用 max(目标策略贪心)、行为带探索(ε-greedy);· 收敛到和值迭代一样的最优 Q\\*。\n**关键权衡**:**探索 vs 利用**(explore/exploit)——不探索学不到最优、只探索不用学不快,ε-greedy 是最简单的平衡。\n**局限与升级**:Q 表只能处理**离散、小规模**状态动作。状态一大/连续 → **DQN**(用神经网络近似 Q(s,a)、经验回放+目标网络)、连续动作 → **策略梯度/PPO/SAC**(直接学策略)。\n**连到别的课**:「MDP 值迭代」是有模型版(Q-learning 是它的免模型 TD 版);「PPO/SAC」直接学策略;「miniduck」用 PPO 学走路。面试延伸:Q-learning vs SARSA(off vs on-policy)、TD vs 蒙特卡洛、探索利用、DQN 的技巧、为何收敛慢、和贝尔曼的关系。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showQ: false, showTd: false, showEp: false, showConv: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'Q-learning 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
