/**
 * 内核：PPO 近端策略优化 —— 策略梯度 + "别一步迈太大":裁剪的替代目标把每次更新限在信任域内（具身智能 · 机器人强化学习 / 面试八股 · miniduck 用的就是它）
 * 轴：step —— 引子(为何要限步) → 重要性比 r=π_new/π_old → 替代目标 L=r·A → 裁剪 min(r·A, clip(r,1−ε,1+ε)·A) → 效果(大步触发裁剪/小步正常) → 收尾。
 *
 * 「策略梯度」的痛点:更新步子难调、太大一步会把策略更新崩坏。**PPO** 用一个**裁剪的替代目标**把新旧策略的差距锁在小范围:
 *   **重要性比** r = π_θ(a|s) / π_θ_old(a|s)(r=1 说明没变);**替代目标** L=r·A(A=优势);直接最大化 L 会把 r 推到无穷、策略崩。
 *   **裁剪目标** L^clip = **min( r·A, clip(r, 1−ε, 1+ε)·A )**(ε=0.2 → r 限在 [0.8,1.2])。A>0(好动作)时 r 涨到 1+ε 就封顶、再涨目标不增(梯度0、不过度增概率);A<0(差动作)同理 r 跌到 1−ε 封底。**新旧策略差太多就没有梯度**——天然的信任域。
 * 本例 A=+1、ε=0.2:小步 r=1.1(在 [0.8,1.2] 内、不裁剪、正常更新);大步 r=1.5(超 1+ε、裁剪到 1.2、目标封顶、梯度0、拦住)。param 步幅。全现算。PPO 是当今主力、on-policy 但可多 epoch 复用 batch。连「策略梯度/miniduck(Brax PPO 学走路)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Move = 'small' | 'large'
export type PpoState = {
  i: number
  step: number
  stage: 'intro' | 'ratio' | 'surrogate' | 'clip' | 'effect' | 'done'
  move: Move
  moveLabel: string
  eps: number; A: number
  r: number; rA: number; clipR: number; clipA: number; Lclip: number; clipped: boolean
  curve: { r: number; L: number }[]     // L^clip(r) 曲线（A>0）
  showRatio: boolean; showSurr: boolean; showClip: boolean; showEff: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PpoState, 'i'>

const EPS = 0.2, ADV = 1
const r2 = (x: number) => Math.round(x * 100) / 100
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export const ppoKernel: Kernel<PpoState> = {
  kind: 'ppo',
  compile(doc: SimDocument): CompiledModel<PpoState> {
    const move: Move = String(doc.params?.move ?? '大步').includes('小') ? 'small' : 'large'
    const moveLabel = move === 'small' ? '小步 r=1.1（信任域内）' : '大步 r=1.5（触发裁剪）'
    const r = move === 'small' ? 1.1 : 1.5

    const rA = r * ADV
    const clipR = clamp(r, 1 - EPS, 1 + EPS)
    const clipA = clipR * ADV
    const Lclip = Math.min(rA, clipA)
    const clipped = Math.abs(Lclip - rA) > 1e-9

    const curve: { r: number; L: number }[] = []
    for (let rr = 0.5; rr <= 1.71; rr += 0.05) {
      const c = clamp(rr, 1 - EPS, 1 + EPS)
      curve.push({ r: r2(rr), L: r2(Math.min(rr * ADV, c * ADV)) })
    }

    const frames: Frame[] = []
    const b0 = { move, moveLabel, eps: EPS, A: ADV, r, rA: r2(rA), clipR: r2(clipR), clipA: r2(clipA), Lclip: r2(Lclip), clipped, curve, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showRatio: boolean; showSurr: boolean; showClip: boolean; showEff: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showRatio: false, showSurr: false, showClip: false, showEff: false,
      focus: `PPO=策略梯度+"别一步迈太大":裁剪的替代目标把更新限在信任域。miniduck 用的就是它。步幅：${moveLabel}`,
      log: `**PPO:给策略更新装个"限位器"**\n「策略梯度」直接朝高回报方向推策略,但**步子难调**:一步迈太大,采样分布突变、策略可能**直接崩坏、再也恢复不了**。TRPO 用复杂的信任域约束解决;**PPO** 用一个更简单的招——**裁剪的替代目标**,把每次更新**限制在"新旧策略别差太多"的范围内**,稳、还能多轮复用数据,成了当今**最主力**的 RL 算法(**miniduck 就是用 Brax PPO 学走路的**)。\n本例:某个动作的优势 A=**${ADV}**(>0、好动作,该增大它的概率)、裁剪范围 ε=**${EPS}**。当前尝试的步幅 **${moveLabel}**。看裁剪怎么拦住过大的更新。` })

    push({
      stage: 'ratio', showRatio: true, showSurr: false, showClip: false, showEff: false,
      focus: `重要性比 r = π_new(a|s)/π_old(a|s) = ${r}（r=1 没变;这里新策略把该动作概率提了）`,
      log: `**① 重要性比 r(衡量新旧策略差多远)**\nr = **π_θ(a|s) / π_θ_old(a|s)** —— 新策略给这个动作的概率、除以旧策略的。**r=1 表示没变**;r>1 说明新策略更偏爱这个动作、r<1 更嫌弃。\n本例 r=**${r}**(${move === 'small' ? '只提了一点点' : '提得很多——新策略比旧策略激进'})。PPO 就是要盯住这个 r、别让它离 1 太远。` })

    push({
      stage: 'surrogate', showRatio: true, showSurr: true, showClip: false, showEff: false,
      focus: `替代目标 L=r·A=${r}·${ADV}=${b0.rA};直接最大化它会把 r 推到无穷、策略崩`,
      log: `**② 替代目标 L=r·A**\n策略梯度可以写成最大化**替代目标** L = **r·A**(A=优势)。A>0 时,增大 r(更偏爱好动作)就增大 L——方向对。\n本例 L = r·A = ${r}·${ADV} = **${b0.rA}**。\n**但危险在这**:如果**无脑最大化 r·A**,优化器会把 r 一路推到很大(把该动作概率推到极端)、一步迈太大 → 策略崩。得给它设个上限。` })

    push({
      stage: 'clip', showRatio: true, showSurr: true, showClip: true, showEff: false,
      focus: `裁剪目标 L^clip=min(r·A, clip(r,${1 - EPS},${1 + EPS})·A);把 r 有效限在 [${1 - EPS},${1 + EPS}]`,
      log: `**③ 裁剪的替代目标(PPO 的核心)**\nL^clip = **min( r·A, clip(r, 1−ε, 1+ε)·A )**。clip 把 r 夹在 **[${1 - EPS}, ${1 + EPS}]**。\n· clip(r) = clip(${r}, ${1 - EPS}, ${1 + EPS}) = **${b0.clipR}**;· clip(r)·A = **${b0.clipA}**;\n· L^clip = min(r·A=${b0.rA}, clip(r)·A=${b0.clipA}) = **${b0.Lclip}**。\n**直觉**:A>0(好动作)时,r 涨到 1+ε=${1 + EPS} 目标就**封顶**,再涨 L 不增 → 梯度变 0、不再往前推;A<0(差动作)时对称,r 跌到 1−ε 封底。**新旧策略一旦差出 ε,就没有梯度**——这就是 PPO 的"信任域"。` })

    push({
      stage: 'effect', showRatio: true, showSurr: true, showClip: true, showEff: true,
      focus: clipped ? `大步 r=${r}>1+ε → 裁剪触发!目标封在 ${b0.Lclip}、梯度0、拦住过大更新` : `小步 r=${r} 在 [${1 - EPS},${1 + EPS}] 内 → 不裁剪、L=${b0.Lclip}、正常更新`,
      log: `**④ 效果:${clipped ? '大步被拦住' : '小步正常走'}**\n${clipped
        ? `本例大步 r=${r} **超出 1+ε=${1 + EPS}** → 裁剪触发:L^clip 被封在 **${b0.Lclip}**(=clip(r)·A),而不是 r·A=${b0.rA}。**封顶后梯度为 0**——优化器**得不到"继续把 r 推大"的动力**,这一步的策略更新被拦在信任域边界。这就是 PPO 防止策略崩坏的机制:想迈大步?没有梯度奖励你。`
        : `本例小步 r=${r} **落在 [${1 - EPS},${1 + EPS}] 内** → 不裁剪,L^clip=r·A=**${b0.Lclip}**,梯度正常、策略照常朝好方向更新一点。**在信任域内,PPO 和普通策略梯度没区别**——只有想迈太大时裁剪才出手。`}\n(看 L^clip vs r 曲线:A>0 时它在 r=1+ε 处**变平**,平的地方就没梯度。)` })

    push({
      stage: 'done', showRatio: true, showSurr: true, showClip: true, showEff: true, phase: 'done',
      focus: `收尾:PPO=裁剪替代目标限信任域、稳、可多epoch复用batch;on-policy;actor-critic+GAE;miniduck 主力`,
      log: `**小结:PPO = 策略梯度 + 裁剪的信任域**\n· **重要性比** r=π_new/π_old 衡量新旧策略差多远;· **裁剪目标** L^clip=min(r·A, clip(r,1−ε,1+ε)·A):新旧策略差出 ε 就没梯度、**天然把更新限在信任域**,防策略崩;· 相比 TRPO(复杂的二阶信任域)**简单得多、效果相当**。\n**为什么是主力**:稳、超参不敏感、实现简单、**同一批数据可跑多个 epoch**(比纯 REINFORCE 用完即扔省样本);配 **actor-critic**(critic 学 V 当基线)+ **GAE**(广义优势估计、平衡偏差方差)算优势 A。仍是 **on-policy**。\n**连到别的课**:是「策略梯度」的稳定化升级(裁剪限步);「miniduck」用 **Brax PPO** 在 MuJoCo 里学走路,动作是连续关节残差、优势里就有那套 velocity+imitation 奖励。面试延伸:PPO 的裁剪目标、为何比 TRPO 简单、重要性比、GAE、on-policy 却能多 epoch(靠裁剪限制 off 的程度)、和 SAC(off-policy 最大熵)的取舍。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showRatio: false, showSurr: false, showClip: false, showEff: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'PPO 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
