/**
 * 内核：ACT 动作分块 · 时序集成 —— LeRobot 旗舰策略怎么让机械臂不抖、不漂（具身智能 · 项目实战 / 面试八股）
 * 轴：step —— 分块预测 → 多块在同一动作上重叠 → 加权集成(w_i=exp(-m·i)、旧的权重大) → 平滑轨迹。
 *
 * 单步模仿学习(BC)每步只预测一个动作，一步错、下一步状态就偏，误差滚雪球(复合误差)。ACT(Action Chunking Transformer)两招治它：
 *   · **动作分块(action chunking)**：一次观测**预测未来 K 个动作**(LeRobot chunk_size=100)。有效时域 T→T/K，滚雪球的机会砍到 1/K。
 *   · **时序集成(temporal ensembling)**：每步都重新预测一整块 → 同一个动作会被**好几块**预测到(它们互相不完全一致=抖)。把这些重叠预测**加权平均**：
 *       **权重 w_i = exp(-m·i)**，i=0 是**最旧**的那条预测(LeRobot 代码：exp(-m·arange))。执行动作 a_t = Σ w_i·P_i / Σ w_i。
 *       m 默认 0.01 → 权重近似均匀、还略偏旧(别过度信最新那条抖的)；m 大 → 更信旧的；m<0 → 更信新的(但会削弱分块的好处)。
 * ⚠️ 八股陷阱：LeRobot **默认不开**时序集成(走队列/receding-horizon)——"读配置别只读论文"。切「权重 m」看集成怎么变。集成/轨迹全现算。连 [BC 复合误差]。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type MKey = '均等' | '默认' | '重旧'
export type Vote = { chunk: number; val: number; w: number }
export type ActState = {
  i: number
  step: number
  stage: 'intro' | 'chunk' | 'overlap' | 'ensemble' | 'traj' | 'done'
  mKey: MKey
  m: number
  K: number
  T: number
  detailT: number
  votes: Vote[]              // detailT 这个动作的重叠预测（含权重）
  ensembled: number          // detailT 的集成结果
  newest: number             // detailT 只用最新那条
  trajTrue: number[]
  trajNewest: number[]
  trajEns: number[]
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<ActState, 'i'>

const M: Record<MKey, number> = { 均等: 0, 默认: 0.01, 重旧: 0.7 }
const K = 4, T = 6, DETAIL = 3
const TRUE = [30, 35, 42, 40, 34, 28]
//  PRED[c] = 在第 c 步预测的一块 K 个动作（对应动作 c, c+1, c+2, c+3），故意让各块略有出入（抖动）。
const PRED: number[][] = [
  [31, 36, 40, 45],
  [34, 44, 38, 30],
  [43, 39, 36, 26],
  [41, 33, 29, 25],
  [35, 27, 24, 22],
  [29, 25, 22, 20],
]
const r1 = (x: number) => Math.round(x * 10) / 10

//  动作 t 的重叠预测（各块 oldest→newest）+ 加权集成
function ensembleAt(t: number, m: number): { votes: Vote[]; ens: number; newest: number } {
  const firstC = Math.max(0, t - K + 1)
  const votes: Vote[] = []
  for (let c = firstC; c <= Math.min(t, T - 1); c++) {
    const i = c - firstC                         // 0 = 最旧
    votes.push({ chunk: c, val: PRED[c]![t - c]!, w: Math.round(Math.exp(-m * i) * 1000) / 1000 })
  }
  const sw = votes.reduce((a, v) => a + v.w, 0)
  const ens = r1(votes.reduce((a, v) => a + v.w * v.val, 0) / sw)
  const newest = PRED[t]![0]!                     // 只用最新那条（在第 t 步预测的 offset 0）
  return { votes, ens, newest }
}

export const actteKernel: Kernel<ActState> = {
  kind: 'actte',
  compile(doc: SimDocument): CompiledModel<ActState> {
    const mKey = (['均等', '默认', '重旧'] as MKey[]).includes(doc.params?.m as MKey) ? doc.params!.m as MKey : '默认'
    const m = M[mKey]
    const trajEns = TRUE.map((_, t) => ensembleAt(t, m).ens)
    const trajNewest = TRUE.map((_, t) => PRED[t]![0]!)
    const d = ensembleAt(DETAIL, m)

    const frames: Frame[] = []
    const b0 = { mKey, m, K, T, detailT: DETAIL, trajTrue: TRUE, trajNewest, trajEns, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; votes: Vote[]; ensembled: number; newest: number; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({ stage: 'intro', votes: [], ensembled: 0, newest: 0, focus: `ACT 用动作分块+时序集成，治 BC 的复合误差（权重 ${mKey}）`,
      log: `**ACT 动作分块 · 时序集成**\n单步模仿(BC)每步只出一个动作——一步错、状态就偏、误差滚雪球(复合误差)。ACT 两招：\n**① 动作分块**：一次观测预测未来 **K=${K}** 个动作(LeRobot 真值 100)。有效时域 T→T/K，滚雪球机会砍到 1/K。\n**② 时序集成**：每步都重新预测一块 → 同一动作被好几块预测到(互相不一致=抖) → **加权平均**抹平。\n本次权重 **${mKey}**(m=${m})。看它怎么分块、怎么集成。` })

    push({ stage: 'chunk', votes: [], ensembled: 0, newest: 0, focus: `一次预测 K=${K} 个动作 → 有效时域 T→T/${K}`,
      log: `**① 动作分块**\n在第 0 步，策略一口气预测 **${K}** 个未来动作：[${PRED[0]!.join(', ')}]。执行几个、再重新预测。\n对比单步 BC：每步只预测 1 个，${T} 步就有 ${T} 次滚雪球机会；分块后**决策次数变成 ${Math.ceil(T / K)} 段左右、有效时域砍到 1/${K}**——这正是治复合误差的关键(接「模仿学习·行为克隆」那课)。` })

    push({ stage: 'overlap', votes: d.votes, ensembled: 0, newest: d.newest, focus: `动作 a${DETAIL} 被 ${d.votes.length} 块预测到，各说各话`,
      log: `**② 多块重叠：同一动作、好几条预测**\n因为每步都重新预测一整块，动作 **a${DETAIL}** 被第 ${d.votes.map(v => v.chunk).join('、')} 步的块都预测过：\n${d.votes.map(v => `第 ${v.chunk} 步的块 → ${v.val}`).join('；')}。\n它们**互相不一致**(从 ${Math.min(...d.votes.map(v => v.val))} 到 ${Math.max(...d.votes.map(v => v.val))})——单看最新那条(${d.newest})会抖。真值约 ${TRUE[DETAIL]}。` })

    push({ stage: 'ensemble', votes: d.votes, ensembled: d.ens, newest: d.newest, focus: `加权集成 a${DETAIL}：Σw·P/Σw = ${d.ens}（vs 只用最新 ${d.newest}）`,
      log: `**③ 时序集成：加权平均抹平抖动**\n权重 **w_i = exp(-m·i)**，i=0 是**最旧**那条(m=${m})：\n${d.votes.map((v, i) => `旧→新第 ${i} 条(第${v.chunk}步块)：值 ${v.val} × 权重 ${v.w}`).join('\n')}\n执行动作 a${DETAIL} = Σ(w·值) / Σw = **${d.ens}**(真值≈${TRUE[DETAIL]})。对比"只用最新那条 ${d.newest}"——集成把好几条重叠预测抹平了。\n(m=${m}：${m === 0 ? '均等平均' : m < 0.1 ? '近似均匀、略偏旧' : '明显偏旧、最旧那条权重最大'}。)` })

    push({ stage: 'traj', votes: d.votes, ensembled: d.ens, newest: d.newest, focus: `整条轨迹：集成(平滑) vs 只用最新(抖)`,
      log: `**④ 全程对比**\n真值：[${TRUE.join(', ')}]\n只用最新：[${trajNewest.join(', ')}]（抖）\n时序集成：[${trajEns.join(', ')}]（平滑、更贴真值）\n每步都拿"好几块对这一步的预测"加权平均，所以输出比任何单条预测都稳——机械臂动起来不抽搐。` })

    push({ stage: 'done', votes: d.votes, ensembled: d.ens, newest: d.newest, phase: 'done', focus: `完：分块砍时域、集成抹抖动；⚠️ LeRobot 默认不开集成`,
      log: `**小结：ACT 为什么能落地**\n· **动作分块 ≠ 时序集成**：分块=一次预测 K 个(砍有效时域、治复合误差)；集成=把重叠的多条预测加权平均(抹抖动)。两招独立。\n· **权重 w_i=exp(-m·i)**，最旧 w_0。m 默认 0.01≈均匀、略偏旧；LeRobot 代码注释：过度上调"最新"会削弱分块的好处。\n· ⚠️ **八股陷阱**：LeRobot **默认关**时序集成(n_action_steps=100、走队列 receding-horizon)；开集成要 n_action_steps=1、每步都重预测。**读配置别只读论文**。\n· **CVAE**：ACT 还用 VAE 潜变量吸收人类示范的多样性(别把冲突示范平均成糊)，测试时 z=0。\n面试延伸：分块 vs 集成、exp 权重公式、为何集成要每步重预测、ACT vs Diffusion Policy(前者前馈一次+可选集成、后者迭代去噪 receding-horizon)。连「模仿学习·行为克隆」的复合误差。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, votes: [], ensembled: 0, newest: 0, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'ACT 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
