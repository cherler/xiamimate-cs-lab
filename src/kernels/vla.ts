/**
 * 内核：VLA 视觉-语言-动作大模型 真仿真 —— 一个预训练大模型吃图像+语言指令、直接吐出机器人动作；动作被 token 化、像预测单词一样生成（具身智能 · 具身学习）
 * 轴：step —— 走一遍 VLA 流水：图像+指令 → 预训练 VLM 骨干理解 → 把连续动作 token 化 → 大模型自回归吐动作 token → 反 token 化成位姿增量 → 机器人执行；再看它靠网络知识泛化到没训过的物体
 *
 * BC/Diffusion Policy 从示范学"某个具体状态→动作",换个物体、换句话就抓瞎。**VLA(Vision-Language-Action)** 换个打法:
 *   拿一个在**海量网络图文**上预训练好的**视觉-语言大模型(VLM)** 当骨干,它已经懂"红色""碗""叠放"这些概念;
 *   在它后面接**动作输出**,用**机器人示范数据微调**——于是它能吃**一张图 + 一句自然语言指令**,直接产出**机器人动作**。
 * 怎么"产出动作"?最经典的 **RT-2** 做法叫**动作 token 化**:把每个连续动作维度(Δx/Δy/Δz/夹爪…)按范围离散成 256 个格子→一个 token id,
 *   于是大模型**像预测下一个单词一样**自回归地吐出这串**动作 token**,再反 token 化回连续位姿增量给机器人执行——完全复用大模型的生成机器。(π0 等则换成扩散/流匹配的连续动作头,接上一课的 Diffusion Policy。)
 * 杀手锏:骨干带着**网络尺度的知识和语言理解**,所以能**泛化**到机器人数据里从没出现过的物体和指令("拿起那个紫色的杯子")——这是从零训练的策略做不到的。
 * 本例指令「把红积木放进碗」,目标动作 Δpose=(0.12,−0.05,−0.08)+夹爪合,token 化成 [204,96,77,255],反解误差≈0。token 化每步真算、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100
const B = 256

type Dim = { name: string; val: number; lo: number; hi: number; bin: number; back: number }
export type VLAState = {
  i: number
  step: number
  phase: 'intro' | 'input' | 'backbone' | 'tokenize' | 'execute' | 'generalize' | 'done'
  op: 'intro' | 'input' | 'backbone' | 'tokenize' | 'execute' | 'generalize' | 'summary'
  instruction: string
  dims: Dim[]
  tokens: number[]            // 动作 token 序列
  gripTok: number
  stage: number               // 流水线高亮到第几段（0..4）
  novelObj: string            // 泛化演示：没训过的物体
  focus: string
  log: string
}
type Frame = Omit<VLAState, 'i'>

const INSTR = '把红积木放进碗'
const RAW: [string, number, number, number][] = [['Δx', 0.12, -0.2, 0.2], ['Δy', -0.05, -0.2, 0.2], ['Δz', -0.08, -0.2, 0.2]]
const DIMS: Dim[] = RAW.map(([name, val, lo, hi]) => { const bin = Math.round((val - lo) / (hi - lo) * (B - 1)); return { name, val, lo, hi, bin, back: r2(lo + bin / (B - 1) * (hi - lo)) } })
const GRIP_TOK = 255
const TOKENS = [...DIMS.map(d => d.bin), GRIP_TOK]
const NOVEL = '紫色的杯子'

export const vlaKernel: Kernel<VLAState> = {
  kind: 'vla',
  compile(_doc: SimDocument): CompiledModel<VLAState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'instruction' | 'dims' | 'tokens' | 'gripTok' | 'novelObj'>) =>
      frames.push({ step: frames.length, instruction: INSTR, dims: DIMS, tokens: TOKENS, gripTok: GRIP_TOK, novelObj: NOVEL, ...f })

    push({
      phase: 'intro', op: 'intro', stage: 0,
      focus: 'VLA：预训练视觉-语言大模型当骨干，吃图像+指令、直接吐机器人动作',
      log: `**VLA 视觉-语言-动作大模型**\nBC/Diffusion Policy 从示范学"某个状态→动作"，换物体换句话就抓瞎。**VLA** 换打法：\n拿一个在**海量网络图文**上预训练好的**视觉-语言大模型(VLM)**(已懂"红色""碗""叠放")当骨干，接上动作输出、用机器人示范微调 → 吃**一张图 + 一句自然语言**、直接产**机器人动作**。\n指令：「${INSTR}」。走一遍它怎么从图像+指令变出动作，再看它怎么泛化到没训过的物体。`,
    })

    push({
      phase: 'input', op: 'input', stage: 0,
      focus: `输入：一张场景图 + 自然语言指令「${INSTR}」`,
      log: `**① 输入：图像 + 语言**\n给 VLA 两样东西：\n· **图像**：当前场景(桌上有红积木、蓝积木、一个碗)——图像被切成 patch、编码成一串**视觉 token**。\n· **指令**：自然语言「${INSTR}」——被分词成**文本 token**。\n两串 token 拼在一起喂进骨干。注意这跟你在大模型看的多模态输入是一回事。`,
    })

    push({
      phase: 'backbone', op: 'backbone', stage: 1,
      focus: '② 预训练 VLM 骨干：已懂"红/碗/放进"，把图文融合成理解',
      log: `**② 预训练 VLM 骨干**\n视觉 token + 文本 token 一起过一个**预训练的视觉-语言大模型**(如 PaLI/LLaVA/Qwen-VL 那类)。\n关键：它是在**网络尺度图文**上预训练的，**早就懂**"红色""碗""放进去""叠放"这些概念和它们的关系——不是从机器人数据里现学的。它把"哪个是红积木、碗在哪、要把前者放进后者"理解出来。这份**世界知识**正是 VLA 泛化的本钱。`,
    })

    push({
      phase: 'tokenize', op: 'tokenize', stage: 2,
      focus: `③ 动作 token 化：连续 Δpose 按 256 格离散 → [${TOKENS.join(', ')}]`,
      log: `**③ 动作怎么"说出来"：token 化(RT-2)**\n机器人动作是连续的位姿增量 Δpose=(Δx,Δy,Δz,夹爪)。RT-2 的绝招：把**每个维度按范围离散成 ${B} 个格子**，每格 = 一个 **token id**——动作就变成了一串"词"：\n${DIMS.map(d => `· ${d.name}=${d.val}（范围 [${d.lo},${d.hi}]）→ 第 round((${d.val}−${d.lo})/${r2(d.hi - d.lo)}×${B - 1}) = **${d.bin}** 号格 → token ${d.bin}`).join('\n')}\n· 夹爪：合 → token **${GRIP_TOK}**\n于是目标动作 = token 序列 **[${TOKENS.join(', ')}]**。这样一来，动作和语言用的是**同一套 token 词表**。`,
    })

    push({
      phase: 'execute', op: 'execute', stage: 3,
      focus: `④ 像吐单词一样自回归吐动作 token，再反解成 Δpose 执行`,
      log: `**④ 生成 + 反 token 化 + 执行**\n骨干理解完场景和指令后，就**像预测下一个单词一样**，自回归地吐出这串**动作 token** [${TOKENS.join(', ')}]——完全复用大模型的生成机器，不用另造一套。\n机器人端把 token **反 token 化**回连续动作：\n${DIMS.map(d => `· token ${d.bin} → ${d.lo}+${d.bin}/${B - 1}×${r2(d.hi - d.lo)} = **${d.back}**（原值 ${d.val}，量化误差 ${r2(Math.abs(d.back - d.val))}）`).join('\n')}\n→ Δpose≈(${DIMS.map(d => d.back).join(', ')})、夹爪合 → 机械臂据此动一步(常一次出一整段动作序列)。（π0 等改用扩散/流匹配的**连续动作头**，接上一课 Diffusion Policy。）`,
    })

    push({
      phase: 'generalize', op: 'generalize', stage: 4,
      focus: `⑤ 泛化：靠骨干的网络知识，能听懂没训过的「${NOVEL}」`,
      log: `**⑤ 杀手锏：泛化到没训过的物体/指令**\n换一句：「拿起那个**${NOVEL}**」——机器人示范数据里**从没出现过**紫色杯子。从零训练的策略(BC 那种)会懵。\n但 VLA 的骨干在网络图文里**见过无数紫色的、无数杯子**，知道"紫色的杯子"长什么样、在哪 → 直接把这个新概念**接到动作**上、伸手去拿。这就是"预训练大模型 + 少量机器人数据"的威力：**把互联网知识迁移到机器人身上**。`,
    })

    push({
      phase: 'done', op: 'summary', stage: 4,
      focus: 'VLA = 预训练VLM骨干 + 动作输出；把网络知识迁移到机器人，泛化强',
      log: `**小结：VLA 的范式**\nVLA = 拿**网络预训练的视觉-语言大模型**当骨干 + 接**动作输出** + 用机器人示范微调。吃图像+语言、直接产动作。\n**两种动作头**：① **离散 token 化**(RT-2)——动作当"词"、复用大模型自回归生成，和语言共用词表；② **连续动作头**(π0 等)——用扩散/流匹配产连续动作块(就是上一课的 Diffusion Policy)。\n**为什么强**：骨干带**网络尺度的世界知识和语言理解**，能泛化到没训过的物体、听懂自由指令、甚至一点常识推理——这是 BC/从零策略给不了的。**代价与挑战**：要海量多样的机器人数据(仍是瓶颈)、推理要跑大模型(算力/延迟)、动作精度和高频控制、安全。\n代表：**RT-1/RT-2**(Google)、**OpenVLA**(开源)、**π0**(Physical Intelligence)、**RDT/Octo** 等。这是当前机器人学习最热的方向，把前面所有课(运动学做本体、感知定位、控制执行、模仿学习/扩散给动作分布)统到一个"通才机器人策略"里。（这些具身大模型也会进 AI 能力地图 ai-atlas。）`,
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, instruction: INSTR, dims: DIMS, tokens: TOKENS, gripTok: GRIP_TOK, novelObj: NOVEL, stage: 0, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'VLA 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
