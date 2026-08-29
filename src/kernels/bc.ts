/**
 * 内核：模仿学习 · 行为克隆 BC 真仿真 —— 从专家示范监督学策略；及其致命伤"分布漂移/复合误差"（具身智能 · 具身学习）
 * 轴：step —— 车道保持任务：专家只在中间示范，BC 学到的策略在示范区内和专家一样，一旦被扰动推出示范区就欠修正、误差复合、冲出车道
 *
 * 让机器人学会一个技能,最直接的办法是**模仿学习**:收集人类/专家的**示范**(状态→动作 的数据对),用**监督学习**训练一个策略去模仿。
 * 最简单的一种叫**行为克隆(Behavior Cloning)**:就是把"状态→动作"当分类/回归问题拟合。它是所有 VLA(视觉-语言-动作大模型)的训练基石。
 * 但 BC 有个著名的致命伤:**分布漂移(distribution shift)/复合误差(compounding error)**。BC 是**一步监督**,只在专家**示范过的状态**上学得好;
 * 可机器人一旦因小误差漂到专家**没示范过**的状态,就没学过怎么办 → 动作错 → 漂得更远 → 又进更陌生的状态 → 错上加错、雪球滚大。
 * 本例:车道保持,专家总在中线附近(只示范 |偏移|≤0.5)。一阵扰动把车推出示范区后:**专家**修正能力不封顶、稳稳拉回(留在道内 0.66);
 * **BC** 在示范区外只会"照最边上见过的样子"欠修正、压不住扰动 → 一路漂出车道(冲到 1.76+)。轨迹每步真算、可手核。
 * 解法(引出下一课):DAgger(让专家在 BC 走出的新状态上补标注)、更全的示范覆盖、加纠错数据——这也是 VLA 要海量多样数据的原因。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100

export type BCState = {
  i: number
  step: number
  phase: 'intro' | 'rollout' | 'done'
  op: 'intro' | 'step' | 'summary'
  demoBound: number             // 专家示范覆盖的状态范围 |y|≤demoBound
  roadBound: number             // 车道边界（超出=冲出车道）
  expert: number[]              // 专家轨迹（完整）
  bc: number[]                  // BC 轨迹（完整）
  shown: number                 // 已揭示到第几步
  bcY: number                   // BC 当前偏移
  expertY: number               // 专家当前偏移
  bcOff: boolean                // BC 已漂出示范区
  bcCrashed: boolean            // BC 已冲出车道
  focus: string
  log: string
}
type Frame = Omit<BCState, 'i'>

const D = 0.4, DEMO = 0.5, GAIN = 0.6, ROAD = 1.5, N = 14
const expertTraj = (() => { let y = 0; const t = [0]; for (let k = 0; k < N; k++) { y = r2(y + (-GAIN * y) + D); t.push(y) } return t })()
const bcTraj = (() => { let y = 0; const t = [0]; for (let k = 0; k < N; k++) { const a = Math.abs(y) <= DEMO ? -GAIN * y : -GAIN * DEMO * Math.sign(y); y = r2(y + a + D); t.push(y) } return t })()
const REVEAL = [2, 3, 5, 7, 10, N]

export const bcKernel: Kernel<BCState> = {
  kind: 'bc',
  compile(_doc: SimDocument): CompiledModel<BCState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'demoBound' | 'roadBound' | 'expert' | 'bc'>) =>
      frames.push({ step: frames.length, demoBound: DEMO, roadBound: ROAD, expert: expertTraj, bc: bcTraj, ...f })

    push({
      phase: 'intro', op: 'intro', shown: 0, bcY: 0, expertY: 0, bcOff: false, bcCrashed: false,
      focus: 'BC：从专家示范监督学"状态→动作"；漂出示范区就崩',
      log: `**模仿学习 · 行为克隆 BC**\n让机器人学技能最直接的办法：收集专家**示范**(状态→动作)、用**监督学习**训练策略去模仿。最简单的 **BC** 就是把"状态→动作"当回归拟合——这是 VLA 的训练基石。\n但 BC 有致命伤：**分布漂移/复合误差**。它只在专家**示范过的状态**上学得好。\n本例：车道保持，专家只在中线附近示范(|偏移|≤${DEMO})。看被扰动推出示范区后专家和 BC 谁能拉回来。`,
    })

    REVEAL.forEach((k, si) => {
      const bcY = bcTraj[k]!, expertY = expertTraj[k]!
      const bcOff = Math.abs(bcY) > DEMO
      const bcCrashed = Math.abs(bcY) > ROAD
      const last = si === REVEAL.length - 1
      push({
        phase: last ? 'done' : 'rollout', op: last ? 'summary' : 'step', shown: k, bcY, expertY, bcOff, bcCrashed,
        focus: `第 ${k} 步：专家偏移 ${expertY}（道内）、BC 偏移 ${bcY}${bcCrashed ? '（冲出车道！）' : bcOff ? '（已漂出示范区）' : ''}`,
        log: last
          ? `**第 ${k} 步：BC 冲出车道**\n专家偏移稳在 **${expertY}**(留在道内)；BC 偏移 **${bcY}** ——早就漂出示范区(|y|>${DEMO})、修正压不住扰动、一路滚到冲出车道(>${ROAD})。\n\n**要点**：BC 是**一步监督**——把专家的"状态→动作"当回归拟合，简单、可扩展(VLA 就这么训)。但它有**分布漂移/复合误差**：只在专家示范过的状态学得好，一旦自己的小误差把它带到**没示范过**的状态，就欠修正、漂得更远、错上加错、雪球滚大(理论上代价随时域 O(εT²)、比会纠错的策略 O(εT) 差)。这不是拟合不够好，是**训练分布 ≠ 测试时自己走出的分布**。\n解法：**DAgger**(让专家在 BC 走出的新状态上补标注、迭代)、覆盖更全的示范(含**纠错/恢复**数据)、数据增强。这正是 VLA(视觉-语言-动作大模型)要**海量多样**数据(含各种偏离和恢复)的原因，也引出下一课 **Diffusion Policy**(用扩散模型建更强的多峰动作分布)和 **VLA**。BC 之上加强化学习微调(RLHF/RL)也能补上纠错。模仿学习是机器人技能获取、自动驾驶、机械臂抓取的主线之一。`
          : `**第 ${k} 步**\n专家偏移 **${expertY}**、BC 偏移 **${bcY}**。${bcOff ? `BC 已漂出专家示范区(|y|>${DEMO})——它在这些状态**没见过示范**，只会照最边上见过的样子欠修正、压不住扰动，于是每步再漂一点(复合误差)。而专家修正不封顶、把偏移稳稳拉住。` : `还在示范区内，BC 和专家几乎一样(都学过)。注意扰动在把偏移往外推。`}`,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, demoBound: DEMO, roadBound: ROAD, expert: expertTraj, bc: bcTraj, shown: 0, bcY: 0, expertY: 0, bcOff: false, bcCrashed: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '滚动步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
