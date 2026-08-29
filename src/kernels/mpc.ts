/**
 * 内核：模型预测控制 MPC · 预测+滚动优化真仿真 —— 用模型预测未来、优化控制、只执行第一步、下步重规划；能提前刹车、不越界（具身智能 · 机器人控制）
 * 轴：step —— 质量块要停在目标(=墙)。MPC 每步预测"照现在的速度还要多远才能刹停",够远就加速、快到了就提前刹车 → 精准停在目标；反应式无预测 → 冲过头
 *
 * PID/阻抗都是"看着当前误差反应"。**MPC(模型预测控制)** 更进一步:每一步都用**系统模型预测未来一段(预测时域)**,
 * **优化**出一整条控制序列(既要到目标、又要满足约束、还要省劲),但**只执行第一步**,下一步拿新状态**重新预测优化**(滚动时域 receding horizon)。
 * 好处:它**会往前看**——能提前刹车、提前避让、显式满足**约束**(不越界、不超速、不超力矩),这是反应式控制器做不到的。
 * 本例:质量块从 0 出发要**精准停在目标 x=10**(那也是一堵墙、不能越过)。MPC 每步算**刹车距离**(照现在的速度刹停要多远)=对未来的预测:
 *   还够远就加速(u=+1),预测"再不刹就要冲过去了"就提前刹车(u=−1) → 稳稳停在 10。而**反应式**(纯比例、只看误差)没有预测、到跟前还在冲 → **越过目标冲到 ~16**。
 * 位置/速度/控制/刹车距离由双积分动力学真跑,可手核。这是自动驾驶、四足步态、化工过程控制的主力方法。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100

type XT = { t: number; x: number }
export type MPCState = {
  i: number
  step: number
  phase: 'intro' | 'reactive' | 'mpc' | 'done'
  op: 'intro' | 'reactive' | 'sample' | 'summary'
  target: number
  U: number
  t: number
  x: number
  v: number
  u: number
  brakeDist: number          // 照当前速度刹停要多远（预测）
  predStop: number           // 预测停点 = x + brakeDist
  braking: boolean
  mpcShown: XT[]             // 已画出的 MPC 轨迹点
  mpcFull: XT[]              // MPC 完整轨迹
  reacFull: XT[]             // 反应式完整轨迹（越界）
  reacMax: number
  focus: string
  log: string
}
type Frame = Omit<MPCState, 'i'>

const TARGET = 10, U = 1, DT = 0.25

// MPC：预测刹车距离，够远加速、快到了提前刹车，末端收尾
const runMPC = () => {
  let x = 0, v = 0
  const traj: { t: number; x: number; v: number; u: number; brakeDist: number }[] = [{ t: 0, x: 0, v: 0, u: 0, brakeDist: 0 }]
  for (let k = 1; k <= 60; k++) {
    const rem = TARGET - x
    const brakeDist = v * v / (2 * U) + v * DT / 2
    let u: number
    if (rem <= 0.15) u = Math.max(-U, Math.min(U, 4 * rem - 2 * v))
    else u = rem > brakeDist ? U : -U
    v = r2(v + u * DT); x = r2(x + v * DT)
    traj.push({ t: r2(k * DT), x, v, u: r2(u), brakeDist: r2(brakeDist) })
    if (Math.abs(x - TARGET) < 0.08 && Math.abs(v) < 0.12) break
  }
  return traj
}
const runReactive = () => {
  let x = 0, v = 0
  const traj: XT[] = [{ t: 0, x: 0 }]
  for (let k = 1; k <= 24; k++) { const u = Math.max(-U, Math.min(U, 0.4 * (TARGET - x))); v = r2(v + u * DT); x = r2(x + v * DT); traj.push({ t: r2(k * DT), x }) }
  return traj
}

export const mpcKernel: Kernel<MPCState> = {
  kind: 'mpc',
  compile(_doc: SimDocument): CompiledModel<MPCState> {
    const frames: Frame[] = []
    const MPC = runMPC()
    const REAC = runReactive()
    const reacMax = r2(Math.max(...REAC.map(p => p.x)))
    const mpcFull: XT[] = MPC.map(p => ({ t: p.t, x: p.x }))
    const reacFull: XT[] = REAC.map(p => ({ ...p }))
    // 采样若干关键步（加速→切换刹车→刹车→停）
    const brakeIdx = MPC.findIndex(p => p.u < 0)
    const idxs = Array.from(new Set([0, Math.round(brakeIdx / 2), brakeIdx - 1, brakeIdx, brakeIdx + Math.round((MPC.length - brakeIdx) / 2), MPC.length - 1].filter(k => k >= 0 && k < MPC.length))).sort((a, b) => a - b)

    const push = (f: Omit<Frame, 'step' | 'target' | 'U' | 'mpcFull' | 'reacFull' | 'reacMax'>) =>
      frames.push({ step: frames.length, target: TARGET, U, mpcFull, reacFull, reacMax, ...f })

    push({
      phase: 'intro', op: 'intro', t: 0, x: 0, v: 0, u: 0, brakeDist: 0, predStop: 0, braking: false, mpcShown: [],
      focus: 'MPC：每步预测未来、优化控制、只执行第一步、下步重规划——会提前刹车',
      log: `**MPC 模型预测控制：会往前看的控制**\nPID/阻抗都是"看当前误差反应"。**MPC** 更进一步：每步用**模型预测未来一段**、**优化**整条控制序列(到目标+满足约束+省劲)，但**只执行第一步**，下步拿新状态**重规划**(滚动时域)。\n好处：**会提前刹车/避让、显式满足约束**(不越界/超速)。\n本例质量块从 0 要**精准停在 x=${TARGET}**(也是墙、不能越)。先看反应式怎么冲过头。`,
    })

    push({
      phase: 'reactive', op: 'reactive', t: 0, x: reacMax, v: 0, u: 0, brakeDist: 0, predStop: reacMax, braking: false, mpcShown: [],
      focus: `反应式(纯比例、无预测)：到跟前还在冲 → 冲过目标到 ${reacMax}（越界！）`,
      log: `**反应式控制：没有预测 → 冲过头**\n纯比例控制器只看当前误差(目标−位置)使劲，**没有对未来的预测**。它一路加速冲向目标，到跟前时**速度还很大、刹不住** → 直接**冲过目标 ${TARGET}、飙到 ${reacMax}**（撞穿墙）。\n和 PID 那个纯 P 震荡同源：没预见性。MPC 怎么避免？`,
    })

    idxs.forEach((k, si) => {
      const p = MPC[k]!
      const predStop = r2(p.x + p.brakeDist)
      const braking = p.u < 0
      const shown = mpcFull.slice(0, k + 1)
      const last = si === idxs.length - 1
      push({
        phase: last ? 'done' : 'mpc', op: last ? 'summary' : 'sample', t: p.t, x: p.x, v: p.v, u: p.u, brakeDist: p.brakeDist, predStop, braking, mpcShown: shown,
        focus: `MPC t=${p.t}s：x=${p.x}、v=${p.v}，${braking ? '预测会冲过→刹车' : '预测还够远→加速'}（预测停点 ${predStop}）`,
        log: last
          ? `**MPC t=${p.t}s：精准停住**\n末端 x=**${p.x}**、v=**${p.v}**——稳稳停在目标 ${TARGET}、**没越界**。\n\n**对比**：同一个任务，**反应式冲到 ${reacMax}（撞穿墙）、MPC 停在 ${p.x}**。差别就在 MPC **会往前看**。\n\n**要点**：MPC 三件套——**用模型预测**未来一段(预测时域)、**优化**一整条控制序列(代价=跟踪误差+控制量+约束罚)、**只执行第一步**再滚动重规划(receding horizon)。本例的"预测"就是**刹车距离**：MPC 每步算"照现在的速度刹停要多远(=预测停点)"，一旦预测停点要够到目标就提前刹车——所以不冲过头。真正的 MPC 每步解一个**带约束的优化(QP/NLP)**、显式处理不越界/不超速/不超力矩/多变量耦合，这是 PID 做不到的。代价：要**准的模型** + 每步**在线求解**(算力大)，所以常配 warm-start、显式 MPC、或короткий horizon。用在自动驾驶(预测轨迹+避障)、四足/人形步态(预测落脚+平衡)、无人机、化工过程、电池管理。和前面：轨迹规划给参考、IK 转关节角、MPC/PID 跟踪并处理约束。`
          : `**MPC t=${p.t}s**\nx=${p.x}、v=${p.v}。MPC 预测：照现在 v=${p.v} 刹停还要 **${p.brakeDist}**(刹车距离)，即**预测停点 = ${predStop}**。\n目标在 ${TARGET}：${braking ? `预测停点 ${predStop} 已经够到/超过目标 → **提前刹车**(u=${p.u})，别冲过去。` : `预测停点 ${predStop} 还没到目标、有余量 → **继续加速**(u=${p.u})。`}\n这就是"往前看"：不是等撞上才反应，而是**预测**着提前动作。`,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, target: TARGET, U, t: 0, x: 0, v: 0, u: 0, brakeDist: 0, predStop: 0, braking: false, mpcShown: [], mpcFull, reacFull, reacMax, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'MPC 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
