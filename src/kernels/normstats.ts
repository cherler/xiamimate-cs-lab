/**
 * 内核：LeRobot · 数据集归一化（normalize / unnormalize）—— 用「整套数据集」的统计量把每个特征拉到同一量级，策略才学得动（具身智能 · 项目实战 / 面试八股）
 * 轴：step —— 量纲差异 → 全数据集统计量(μ/σ/min/max) → MEAN_STD → MIN_MAX(离群敏感) → 反归一化(策略输出必须还原) → 收尾。
 *
 * LeRobot 把 state/action 的统计量**在整套数据集上算一遍**存进 meta/stats（不是 BatchNorm 那样每批现算），
 * 于是归一化就是一个**固定、可逆的仿射变换**。两种模式：
 *   · **MEAN_STD**：x' = (x − μ) / (σ + eps)，ACT 默认；对无界的关节角/力矩自然、对离群较稳。
 *   · **MIN_MAX** ：x' = 2·(x − min)/(max − min) − 1，映射到 **[-1,1]**，Diffusion Policy 用（加噪 schedule 假设数据在 [-1,1]）；对离群敏感。
 * std 用 **√(E[x²] − μ²)**（一遍聚合、无需二次扫描）。关键坑：策略**输出**的是归一化动作，必须用**同一套统计量反归一化**再发给机器人，否则动作全错。
 * param 选「给 ACT / 给 Diffusion」决定高亮哪条路 + 反归一化用哪个模式。统计量/归一化/反归一化全现算。连「PID / 遥操作」下游的动作。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Policy = 'ACT' | 'Diffusion'
type Mode = 'MEAN_STD' | 'MIN_MAX'
export type Col = { name: string; unit: string; vals: number[]; mean: number; std: number; min: number; max: number; ms: number[]; mm: number[] }
export type NSState = {
  i: number
  step: number
  stage: 'intro' | 'stats' | 'meanstd' | 'minmax' | 'unnorm' | 'done'
  policy: Policy
  mode: Mode
  cols: Col[]
  showStats: boolean
  showMS: boolean
  showMM: boolean
  showUnnorm: boolean
  unnormFeat: string     // 反归一化演示用哪个特征
  policyOut: number      // 策略输出的「归一化」动作
  unnormVal: number      // 正确反归一化后的真实值
  forgotVal: number      // 忘了反归一化、直接把归一化数当真实值发
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<NSState, 'i'>

const EPS = 1e-8
const r2 = (x: number) => Math.round(x * 100) / 100
// 三个特征，6 个样本；关节角均值恰为 0（便于看 MEAN_STD 保号），力矩带一个离群值 3.0
const RAW: { name: string; unit: string; vals: number[] }[] = [
  { name: '关节角θ', unit: 'rad', vals: [-2.8, -1.2, 0.0, 0.4, 1.6, 2.0] },
  { name: '夹爪g', unit: '0~1', vals: [0.0, 0.2, 0.5, 0.8, 1.0, 0.5] },
  { name: '力矩τ', unit: 'N·m', vals: [0.10, 0.20, 0.15, 0.30, 0.25, 3.00] },
]

function buildCols(): Col[] {
  return RAW.map(c => {
    const n = c.vals.length
    const mean = c.vals.reduce((a, b) => a + b, 0) / n
    const ex2 = c.vals.reduce((a, b) => a + b * b, 0) / n
    const std = Math.sqrt(Math.max(0, ex2 - mean * mean))
    const min = Math.min(...c.vals), max = Math.max(...c.vals)
    const ms = c.vals.map(x => r2((x - mean) / (std + EPS)))
    const mm = c.vals.map(x => r2(max > min ? (x - min) / (max - min) * 2 - 1 : 0))
    return { name: c.name, unit: c.unit, vals: c.vals, mean: r2(mean), std: r2(std), min: r2(min), max: r2(max), ms, mm }
  })
}

export const normstatsKernel: Kernel<NSState> = {
  kind: 'normstats',
  compile(doc: SimDocument): CompiledModel<NSState> {
    const policy = (String(doc.params?.policy ?? '给 ACT').includes('Diffusion') ? 'Diffusion' : 'ACT') as Policy
    const mode: Mode = policy === 'ACT' ? 'MEAN_STD' : 'MIN_MAX'
    const cols = buildCols()
    const theta = cols[0]!, grip = cols[1]!, tau = cols[2]!

    // 反归一化演示：ACT 用关节角(MEAN_STD)，Diffusion 用夹爪(MIN_MAX)
    const feat = policy === 'ACT' ? theta : grip
    const policyOut = policy === 'ACT' ? 1.0 : 0.6   // 策略吐出的归一化动作
    const unnormVal = policy === 'ACT'
      ? r2(policyOut * (feat.std + EPS) + feat.mean)          // x = x'·σ + μ
      : r2((policyOut + 1) / 2 * (feat.max - feat.min) + feat.min)  // x = (x'+1)/2·(max−min)+min
    const forgotVal = policyOut                                // 忘了反归一化，直接当真实值

    // 离群展示数字：τ 正常样本经 MIN_MAX 后挤在哪
    const tauNormalBand = `${tau.mm[0]}~${tau.mm[3]}`  // 0.10→? 0.30→?

    const frames: Frame[] = []
    const b0 = {
      policy, mode, cols, unnormFeat: feat.name, policyOut, unnormVal, forgotVal, phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showStats: boolean; showMS: boolean; showMM: boolean; showUnnorm: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showStats: false, showMS: false, showMM: false, showUnnorm: false,
      focus: `三个特征量纲天差地别（θ 到 ±3 rad、夹爪 0~1、力矩里还有个离群 3.0），不归一化大尺度特征会淹没梯度`,
      log: `**为什么要归一化**\n一条机器人样本里，特征量纲天差地别：关节角 θ ∈ 约 [-2.8, 2.0] rad、夹爪 g ∈ [0,1]、力矩 τ 里还混了个离群值 3.0。\n直接喂网络：**大尺度特征主导 loss/梯度**，小尺度特征(夹爪)几乎学不到；不同单位也没法一视同仁。\n所以 LeRobot 先把每个特征拉到同一量级。当前策略：**${policy}** → 用 **${mode}**。` })

    push({
      stage: 'stats', showStats: true, showMS: false, showMM: false, showUnnorm: false,
      focus: `全数据集统计量：μ/σ/min/max 各算一遍存进 meta/stats（不是每批现算）`,
      log: `**① 统计量在「整套数据集」上算一遍**\n和 BatchNorm(每个 batch 现算)不同：LeRobot 遍历所有 episode，把每个特征的 **μ、σ、min、max** 各算一次、存进 **meta/stats**。于是归一化 = 一个**固定、可逆的仿射变换**。\nσ 用一遍聚合式 **σ = √(E[x²] − μ²)**，不用二次扫描。\nθ：μ=${theta.mean}、σ=${theta.std}、min=${theta.min}、max=${theta.max}；夹爪：μ=${grip.mean}、σ=${grip.std}；力矩：μ=${tau.mean}、σ=${tau.std}、min=${tau.min}、max=${tau.max}(离群 3.0 把 max 抬高了)。` })

    push({
      stage: 'meanstd', showStats: true, showMS: true, showMM: false, showUnnorm: false,
      focus: `MEAN_STD：x' = (x − μ)/(σ + eps) —— ACT 默认，把每列拉成 ~0 均值、单位尺度`,
      log: `**② MEAN_STD 归一化**（ACT 默认）\nx' = **(x − μ) / (σ + eps)**。每列被拉成 **均值 ~0、尺度 ~1**。\nθ 均值恰为 0 → 归一化就是除以 σ，**符号不变**：${theta.vals.map((v, k) => `${v}→${theta.ms[k]}`).join('、')}。\n对无界的关节角/力矩自然，对离群也相对稳(离群只是把 σ 拉大一点，不会把其它值挤扁)。` })

    push({
      stage: 'minmax', showStats: true, showMS: true, showMM: true, showUnnorm: false,
      focus: `MIN_MAX：x' = 2(x − min)/(max − min) − 1 → 固定落 [-1,1]；Diffusion 用；离群把正常样本挤扁`,
      log: `**③ MIN_MAX 归一化**（Diffusion 用）\nx' = **2·(x − min)/(max − min) − 1**，固定映射到 **[-1, 1]**。Diffusion Policy 需要它——加噪 schedule 假设数据在 [-1,1]。\n**离群敏感**：力矩 τ 有个离群 3.0(→+1)，正常样本 0.10~0.30 全被挤进 **${tauNormalBand}**(紧贴 -1、彼此难分)。\n对比 MEAN_STD 下同样这几个值还拉得开：${tau.ms.slice(0, 4).join('、')}。这就是为什么**模式要按数据/策略选**，不是随便挑。` })

    push({
      stage: 'unnorm', showStats: true, showMS: true, showMM: true, showUnnorm: true,
      focus: `反归一化：策略输出的是「归一化动作」，必须用同一套统计量还原，否则发给机器人的动作全错`,
      log: `**④ 反归一化(unnormalize)——最容易漏的一步**\n策略预测出来的是**归一化空间**里的动作，要**用同一套存好的统计量反着变**，才能发给机器人：\n${policy === 'ACT'
        ? `MEAN_STD 反变换：x = x'·σ + μ。策略输出 ${policyOut}(归一化) → 真实 ${feat.name} = ${policyOut}×${feat.std}+${feat.mean} = **${unnormVal} ${feat.unit}**。`
        : `MIN_MAX 反变换：x = (x'+1)/2·(max−min)+min。策略输出 ${policyOut}(归一化) → 真实 ${feat.name} = **${unnormVal}**。`}\n**若忘了反归一化**：直接把 ${policyOut} 当真实值发 → 机器人拿到 ${forgotVal}，和应有的 ${unnormVal} 差了一大截(动作幅度全错、看着像「没力气」)。这是部署时最常见的静默 bug。` })

    push({
      stage: 'done', showStats: true, showMS: true, showMM: true, showUnnorm: true, phase: 'done',
      focus: `完：全数据集统计量→两种模式(ACT 用 MEAN_STD、Diffusion 用 MIN_MAX)→输入归一化+输出反归一化，同一套统计量`,
      log: `**小结：归一化是策略两端各一次的固定仿射变换**\n① **统计量算一遍存起来**(meta/stats)，σ=√(E[x²]−μ²)；归一化因此**固定、可逆**，不像 BatchNorm 每批变。\n② **MEAN_STD**(ACT)：(x−μ)/(σ+eps)，对无界特征/离群稳；**MIN_MAX**(Diffusion)：映射 [-1,1] 配加噪 schedule，但**离群敏感**(会把正常样本挤扁)。\n③ **两端各一次**：输入端归一化观测、输出端**反归一化动作**——用**同一套统计量**；漏了输出反归一化 = 动作全错的静默 bug。\n**面试延伸**：为何不用 BatchNorm(部署要确定、可逆)；图像另走(/255 或 ImageNet 统计)；离群多时改用分位数/robust scaling；统计量随数据集走、换数据集要重算。连下游 PID/遥操作吃的就是这里反归一化出来的真实动作。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showStats: false, showMS: false, showMM: false, showUnnorm: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '归一化步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
