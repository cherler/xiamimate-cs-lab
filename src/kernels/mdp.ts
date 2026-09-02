/**
 * 内核：MDP + 贝尔曼方程 · 值迭代 —— 强化学习的地基：状态/动作/转移/奖励/折扣，值 V(s)=max_a[R+γV(s')]，值从目标往回传（具身智能 · 机器人强化学习 / 面试八股）
 * 轴：step —— 引子(MDP五要素+目标) → 本例状态链 → 贝尔曼备份(一个状态) → 值迭代扫描(值从G往回传) → 收敛+最优策略(γ 影响远视) → 收尾。
 *
 * 马尔可夫决策过程 MDP=⟨S, A, P, R, γ⟩,目标=最大化**累积折扣回报** Σγ^t r_t。**贝尔曼(最优)方程**:V*(s)=max_a Σ_s' P(s'|s,a)[R+γV*(s')]——一个状态的值=选最好的动作、拿到即时奖励+折扣后的下个状态值。
 *   **值迭代**:反复做贝尔曼备份 V_{k+1}(s)=max_a[R+γV_k(s')] 直到收敛。本例确定性 4 状态链 A→B→C→G(到 G 得 +1、γ),值**从目标 G 一步步往回传**(iter1 C=1、iter2 B=0.9·1、iter3 A=0.9²·1)。
 *   收敛后每状态取 argmax 得**最优策略**(全朝 G)。param 折扣 γ(0.9 远视 / 0.5 短视)看 γ 怎么决定"多看重未来"。值/策略全现算。连「Q-learning(免模型)/PPO/miniduck(RL 走路)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Gam = 'far' | 'near'
type Snap = Record<string, number>
export type MdpState = {
  i: number
  step: number
  stage: 'intro' | 'components' | 'bellman' | 'iterate' | 'converge' | 'done'
  gam: Gam
  gamLabel: string
  gamma: number
  states: string[]
  iters: Snap[]              // 每次扫描后的 V（含初值 iter0）
  vFinal: Snap
  policy: Record<string, string>
  nIters: number
  bkC: { right: number; left: number; pick: number }   // 状态 C 的贝尔曼备份细节
  showComp: boolean; showBellman: boolean; showIter: boolean; showConv: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<MdpState, 'i'>

// 确定性链：A→B→C→G，动作 R(向 G) / L(远离)；只有 C→G 给 +1
const STATES = ['A', 'B', 'C', 'G']
const TRANS: Record<string, { R: string; L: string }> = { A: { R: 'B', L: 'A' }, B: { R: 'C', L: 'A' }, C: { R: 'G', L: 'B' } }
const REW: Record<string, { R: number; L: number }> = { A: { R: 0, L: 0 }, B: { R: 0, L: 0 }, C: { R: 1, L: 0 } }
const r2 = (x: number) => Math.round(x * 100) / 100

export const mdpKernel: Kernel<MdpState> = {
  kind: 'mdp',
  compile(doc: SimDocument): CompiledModel<MdpState> {
    const gam: Gam = String(doc.params?.gamma ?? '远视').includes('短') ? 'near' : 'far'
    const gamLabel = gam === 'far' ? '远视 γ=0.9' : '短视 γ=0.5'
    const gamma = gam === 'far' ? 0.9 : 0.5

    // 值迭代（同步扫描），记录每次快照
    const iters: Snap[] = []
    let V: Snap = { A: 0, B: 0, C: 0, G: 0 }
    iters.push({ ...V })
    for (let k = 0; k < 6; k++) {
      const Vn: Snap = { ...V, G: 0 }
      for (const s of ['A', 'B', 'C']) {
        const t = TRANS[s]!, r = REW[s]!
        Vn[s] = r2(Math.max(r.R + gamma * V[t.R]!, r.L + gamma * V[t.L]!))
      }
      iters.push(Vn)
      const conv = ['A', 'B', 'C'].every(s => Math.abs(Vn[s]! - V[s]!) < 1e-6)
      V = Vn
      if (conv) break
    }
    const vFinal = iters[iters.length - 1]!
    const nIters = iters.length - 1
    const policy: Record<string, string> = {}
    for (const s of ['A', 'B', 'C']) {
      const t = TRANS[s]!, r = REW[s]!
      policy[s] = (r.R + gamma * vFinal[t.R]!) >= (r.L + gamma * vFinal[t.L]!) ? '→' : '←'
    }
    const bkC = { right: r2(REW.C!.R + gamma * 0), left: r2(REW.C!.L + gamma * (iters[0]!.B!)), pick: r2(Math.max(REW.C!.R, REW.C!.L + gamma * 0)) }

    const frames: Frame[] = []
    const b0 = { gam, gamLabel, gamma, states: STATES, iters, vFinal, policy, nIters, bkC, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showComp: boolean; showBellman: boolean; showIter: boolean; showConv: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showComp: false, showBellman: false, showIter: false, showConv: false,
      focus: `MDP=⟨状态,动作,转移,奖励,折扣γ⟩,目标最大化累积折扣回报。贝尔曼:V(s)=max_a[R+γV(s')]。折扣：${gamLabel}`,
      log: `**MDP + 贝尔曼方程:强化学习的地基**\n强化学习把问题建成**马尔可夫决策过程 MDP = ⟨S 状态, A 动作, P 转移, R 奖励, γ 折扣⟩**。智能体在状态里选动作、拿奖励、转到下一状态,目标是**最大化累积折扣回报 Σ γ^t r_t**(γ<1 让近期奖励更值钱、也保证无穷和收敛)。\n怎么衡量一个状态好不好?——**值函数 V(s)** = 从该状态出发能拿到的期望折扣回报。它满足**贝尔曼方程**:\n**V\\*(s) = max_a [ R(s,a) + γ·V\\*(s') ]**——一个状态的值 = 选最好的动作、拿即时奖励 + 折扣后下一个状态的值。当前 **${gamLabel}**。` })

    push({
      stage: 'components', showComp: true, showBellman: false, showIter: false, showConv: false,
      focus: `本例:4 状态链 A→B→C→G,动作 →(向G)/←(远离),到 G 得 +1,γ=${gamma}`,
      log: `**① 本例 MDP**\n**状态** S={A,B,C,G}(G 是终点/终止态);**动作** A={→(朝 G), ←(远离)};**转移** 确定性:A→B、B→C、C→G(选 →);**奖励** R:只有 **C→G 给 +1**,其余 0;**折扣** γ=**${gamma}**。\n目标:每个状态该往哪走,才能拿到最多折扣回报?越接近 G、值越高;γ 决定"远处的 +1 现在值多少"。` })

    push({
      stage: 'bellman', showComp: true, showBellman: true, showIter: false, showConv: false,
      focus: `贝尔曼备份(状态 C):V(C)=max(→: 1+γ·V(G), ←: 0+γ·V(B)) = max(1, ${r2(gamma * iters[0]!.B!)}) = 1`,
      log: `**② 贝尔曼备份(以状态 C 为例)**\n对每个状态,枚举动作、取最大:\n**V(C) = max( R(C,→)+γV(G), R(C,←)+γV(B) )** = max( **1**+${gamma}·0, 0+${gamma}·V(B) )。\n初始 V 全 0 → = max(1, 0) = **1**(选 →、直接进 G 拿 +1)。\n这就是一次"贝尔曼备份":用邻居的当前值,更新自己的值。对所有状态做一遍 = 一次值迭代扫描。` })

    push({
      stage: 'iterate', showComp: true, showBellman: true, showIter: true, showConv: false,
      focus: `值迭代:反复扫描,值从目标 G 一步步往回传(iter1 C=1、iter2 B=${iters[2]?.B}、iter3 A=${iters[3]?.A})`,
      log: `**③ 值迭代:值从目标往回传播**\n反复做贝尔曼备份直到不再变。看 V 每次扫描后的样子(A,B,C):\n${iters.map((v, k) => `iter${k}: [${v.A}, ${v.B}, ${v.C}]`).join('\n')}\n**值像水波一样从目标 G 往回扩散**:第 1 次只有紧挨 G 的 C 变成 1;第 2 次 B 拿到 γ·1=${r2(gamma)};第 3 次 A 拿到 γ²·1=${r2(gamma * gamma)}……每扫一次、信息往回传一格。${nIters} 次后收敛。` })

    push({
      stage: 'converge', showComp: true, showBellman: true, showIter: true, showConv: true,
      focus: `收敛 V=[${vFinal.A}, ${vFinal.B}, ${vFinal.C}],最优策略全 →;γ 越大越远视(γ=0.5 时 A 只值 ${gam === 'far' ? '0.81' : vFinal.A})`,
      log: `**④ 收敛 + 最优策略**\n${nIters} 次扫描后收敛:**V\\* = [A:${vFinal.A}, B:${vFinal.B}, C:${vFinal.C}]**(G=0 终止)。\n每个状态取 **argmax** 得**最优策略 π\\***:${['A', 'B', 'C'].map(s => `${s}:${policy[s]}`).join('、')}(全部朝 G——离目标越近值越高、往高值走)。\n**折扣 γ 的意义**:V 恰好是 **γ^(到G的步数)·(+1)**。γ=${gamma}:${['A', 'B', 'C'].map((s, k) => `${s}=γ^${3 - k}=${vFinal[s]}`).join('、')}。**γ 越大越"远视"**(远处的奖励也看重),γ 小则"短视"(只顾眼前)——切「折扣」对比 0.9 vs 0.5。` })

    push({
      stage: 'done', showComp: true, showBellman: true, showIter: true, showConv: true, phase: 'done',
      focus: `收尾:MDP+贝尔曼是 RL 地基;值迭代=反复备份收敛;V/Q;有模型 vs 免模型(Q-learning);连 PPO/miniduck`,
      log: `**小结:MDP + 贝尔曼 = 强化学习的地基**\n· **MDP** ⟨S,A,P,R,γ⟩、目标最大化累积折扣回报;· **贝尔曼方程** V\\*(s)=max_a[R+γV\\*(s')](值=即时奖励+折扣未来值);· **值迭代** 反复备份、值从目标往回传、收敛到 V\\*,argmax 得最优策略。\n· **γ**:折扣,平衡近期/远期(γ^步数 衰减)、保证收敛。\n**V vs Q**:V(s) 状态值;**Q(s,a)** 状态-动作值(更常用,因为 argmax Q 直接给策略、不用转移模型)。\n**有模型 vs 免模型**:值迭代要知道转移 P 和奖励 R(**有模型**);真实机器人 P/R 未知 → **免模型**(下一课「Q-learning」从经验里学 Q、不用模型)。\n**连到别的课**:「Q-learning」免模型学 Q;「PPO/SAC」直接学策略(策略梯度);「miniduck」用 PPO 学走路,奖励就是这里的 R。面试延伸:贝尔曼期望 vs 最优方程、值迭代 vs 策略迭代、V vs Q、γ 的作用、有模型 vs 免模型、探索利用。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showComp: false, showBellman: false, showIter: false, showConv: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'MDP 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
