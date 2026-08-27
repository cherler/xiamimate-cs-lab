/**
 * 内核：扩散模型 Diffusion（深度学习算法 · 原理：前向一步步加噪把图变噪声,反向学去噪、从噪声生成图)
 * 轴：step —— 两个方向:**前向**把一张图逐步加高斯噪声,直到变成纯噪声(过程固定、简单);
 *      **反向**让训练好的网络一步步**去噪**,从纯噪声里"磨"出一张图——这就是生成。Stable Diffusion/DALL·E/Sora 的底层。
 *
 * 怎么让 AI"画"出一张全新的图?扩散模型的思路绝妙:**先学会破坏,再学会修复**。
 * **前向过程**:拿真实图片,一步步掺入高斯噪声(x_t = √ᾱ·x₀ + √(1−ᾱ)·ε),几十步后图片变成一团纯噪声——这步是**固定的、不用学**。
 * **反向过程**:训练一个神经网络,专门**预测每一步掺了多少噪声、并把它去掉**;于是从一团**随机噪声**出发,让网络一步步去噪,
 * 就能"生成"出一张以前不存在的、逼真的图。加噪简单可算,去噪是网络学的——反着走这条路,噪声就变成了创作。
 *
 * 本实验:一张 8×8 的小图(❤)。前向:看它一步步被噪声淹没(√ᾱ 从 1 降到 0.14,信号越来越弱)。反向:从噪声出发,
 * 网络一步步去噪,图像慢慢浮现。前向每步的 √ᾱ、√(1−ᾱ) 可手算核对;反向是网络学的(这里演示恢复过程)。扩散是当今图像/视频生成的主流,AI 求职大热门。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const N = 8
// 8×8 ❤ 图案（1=亮）
const HEART = [
  [0, 1, 1, 0, 0, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0], [0, 0, 1, 1, 1, 1, 0, 0], [0, 0, 0, 1, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0],
].flat()
const ABAR = [1, 0.5, 0.15, 0.02]   // 前向噪声调度（ᾱ 递减）
const r3 = (x: number) => Math.round(x * 1000) / 1000
// 确定性高斯噪声（每像素固定）
const NOISE = (() => { let s = 424242; const g: number[] = []; for (let i = 0; i < N * N; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const u1 = (s % 10000) / 10000 || 0.0001; s = (s * 1103515245 + 12345) & 0x7fffffff; const u2 = (s % 10000) / 10000; g.push(Math.max(0, Math.min(1, 0.5 + 0.35 * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)))) } return g })()
const imgAt = (t: number) => { const a = ABAR[t]; const sa = Math.sqrt(a), sn = Math.sqrt(1 - a); return HEART.map((x0, i) => r3(sa * x0 + sn * NOISE[i])) }

export type DiffusionState = {
  i: number
  step: number
  n: number
  img: number[]
  t: number                    // 噪声级别索引
  dir: string                  // 'forward' | 'reverse' | 'done'
  sqrtA: number; sqrtN: number
  phase: 'run' | 'done'
  log: string
}

export const DIFFUSION_VISIBLE = ['step', 'n', 'img', 't', 'dir', 'sqrtA', 'sqrtN', 'phase', 'log'] as const
type Frame = Omit<DiffusionState, 'i'>

export const diffusionKernel: Kernel<DiffusionState> = {
  kind: 'diffusion',
  compile(_doc: SimDocument): CompiledModel<DiffusionState> {
    const T = ABAR.length - 1
    const frames: Frame[] = []
    const mk = (t: number, dir: string, log: string): Frame => ({
      step: 0, n: N, img: imgAt(t), t, dir, sqrtA: r3(Math.sqrt(ABAR[t])), sqrtN: r3(Math.sqrt(1 - ABAR[t])), phase: 'run', log,
    })
    // 前向：t 0→T
    frames.push(mk(0, 'forward', `**前向 · 第 0 步**:原图 ❤(√ᾱ=1、无噪声)。扩散先学"破坏":一步步给它掺高斯噪声。`))
    for (let t = 1; t <= T; t++) {
      frames.push(mk(t, 'forward', `**前向 · 第 ${t} 步**:x = √ᾱ·x₀ + √(1−ᾱ)·ε = ${r3(Math.sqrt(ABAR[t]))}·原图 + ${r3(Math.sqrt(1 - ABAR[t]))}·噪声。信号越来越弱,${t === T ? '几乎成了**纯噪声**。' : '图像变模糊。'}`))
    }
    // 反向：t T→0（网络去噪）
    for (let t = T - 1; t >= 0; t--) {
      frames.push(mk(t, 'reverse', `**反向 · 去噪**:训练好的网络预测这一步掺了多少噪声、把它减掉 → 回到噪声级 ${t}(√ᾱ=${r3(Math.sqrt(ABAR[t]))})。图像慢慢**浮现**。`))
    }
    const f0 = frames[frames.length - 1]
    frames.push({
      ...f0, step: 0, dir: 'done', phase: 'done',
      log: `**生成完成**:从一团纯噪声出发,网络一步步去噪,"磨"出了一张图 ❤。扩散模型=**前向加噪(固定、简单)+ 反向去噪(网络学的)**;把加噪反着走,噪声就变成了创作。` +
        `真实模型在几十~上千步、百万张图上训练,还能按文字条件生成(输入"一只猫"就画猫)。Stable Diffusion、DALL·E、Sora 的底层,当今图像/视频生成主流——AI 求职大热门。`,
    })
    frames.forEach((f, k) => (f.step = k))
    const base0: Frame = { step: -1, n: N, img: imgAt(0), t: 0, dir: '', sqrtA: 1, sqrtN: 0, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '加噪/去噪' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
