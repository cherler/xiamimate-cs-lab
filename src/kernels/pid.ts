/**
 * 内核：PID 控制 · 质量块到位真仿真 —— 误差经 P/I/D 三项合成控制量驱动系统；P-only 震荡 vs 加 D 阻尼收敛（具身智能 · 机器人控制）
 * 轴：step —— 先用纯 P 控一个质量块到目标(会冲过头、来回震荡)，再加上 D 项(阻尼)让它平稳停在目标
 *
 * 让机器人关节/底盘**停到目标**,靠的是反馈控制。最常用的是 **PID**:每一拍算当前误差 e=目标−实际,
 * 用三项合成控制量 u:
 *   · **P(比例)** = Kp·e —— 误差越大、越使劲推。但只有 P,推到目标时还有速度、会**冲过头**,再反向、又冲过头 → **来回震荡**。
 *   · **D(微分)** = Kd·(误差变化率) —— 误差在快速缩小时给一个**反向的刹车**,提前减速、**阻尼**掉震荡。P+D 就能平稳停住。
 *   · **I(积分)** = Ki·(误差累计) —— 消除**稳态误差**:当有恒定扰动(如重力)、P/D 压不平留下的固定偏差,I 会慢慢累积把它顶掉。
 * 被控对象是个**质量块**(控制量=力→加速度,双积分):这正是纯 P 会震荡、必须靠 D 阻尼的经典情形。
 * 本例目标=10、Kp=0.4:先跑纯 P(冲到 11.77 还在涨、震荡),再加 Kd=0.9(平稳收敛到 10)。误差/三项/位置每步真算、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000

type TP = { k: number; p: number }
export type PIDState = {
  i: number
  step: number
  phase: 'intro' | 'ponly' | 'pd' | 'done'
  op: 'intro' | 'step' | 'switch' | 'summary'
  target: number
  Kp: number
  Kd: number
  mode: 'P' | 'PD' | ''
  k: number                 // 相内步号（1..），0=开场/切换
  e: number
  uP: number
  uD: number
  u: number
  v: number
  p: number
  ponly: TP[]               // 纯 P 的位置轨迹
  pd: TP[]                  // PD 的位置轨迹
  focus: string
  log: string
}
type Frame = Omit<PIDState, 'i'>

const TARGET = 10, KP = 0.4, KD = 0.9, DT = 0.5
const N_P = 5, N_PD = 8

export const pidKernel: Kernel<PIDState> = {
  kind: 'pid',
  compile(_doc: SimDocument): CompiledModel<PIDState> {
    const frames: Frame[] = []
    const snap = (t: TP[]) => t.map(x => ({ ...x }))
    const push = (f: Omit<Frame, 'step' | 'target' | 'Kp' | 'Kd'>) => frames.push({ step: frames.length, target: TARGET, Kp: KP, Kd: KD, ...f })

    const ponly: TP[] = [], pd: TP[] = []

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', mode: '', k: 0, e: TARGET, uP: 0, uD: 0, u: 0, v: 0, p: 0, ponly: [], pd: [],
      focus: 'PID：误差 e → P/I/D 三项合成控制量，驱动系统到目标',
      log: `**PID 控制：把系统稳到目标**\n每拍算误差 e=目标−实际，三项合成控制量 u：\n· **P** = Kp·e（误差越大越使劲推）\n· **D** = Kd·误差变化率（快到时反向刹车、阻尼震荡）\n· **I** = Ki·误差累计（顶掉恒定扰动的稳态误差）\n被控对象是**质量块**（控制量=力，双积分）。目标=${TARGET}。先看**纯 P**（Kp=${KP}）会怎样。`,
    })

    // —— 第一幕：纯 P（Kd=0）——
    {
      let p = 0, v = 0, ePrev = TARGET
      for (let k = 1; k <= N_P; k++) {
        const e = r3(TARGET - p)
        const uP = r3(KP * e)
        const u = uP                    // 纯 P
        v = r3(v + u * DT)
        p = r3(p + v * DT)
        ponly.push({ k, p: r2(p) })
        const overshoot = p > TARGET
        push({
          phase: 'ponly', op: 'step', mode: 'P', k, e: r2(e), uP, uD: 0, u, v, p: r2(p), ponly: snap(ponly), pd: [],
          focus: `纯P 步${k}：e=${r2(e)} → u=Kp·e=${uP} → 位置 ${r2(p)}${overshoot ? '（已冲过目标 10！）' : ''}`,
          log: `**纯 P · 步 ${k}**\n误差 e = ${TARGET} − ${r2(r3(TARGET - r3(p - v * DT)))} = ${r2(e)}。控制量 u = Kp·e = ${KP}·${r2(e)} = **${uP}**（只有 P 项）。\n质量块被推，速度 v=${v}、位置到 **${r2(p)}**。${overshoot ? `\n⚠️ **冲过目标了**（${r2(p)} > 10）——到目标时还有速度、刹不住，接下来会继续冲、再反向 → **来回震荡**。这就是纯 P 控质量块的毛病：没有阻尼。` : ''}`,
        })
        ePrev = e
      }
    }

    // —— 切换 ——
    push({
      phase: 'pd', op: 'switch', mode: 'PD', k: 0, e: TARGET, uP: 0, uD: 0, u: 0, v: 0, p: 0, ponly: snap(ponly), pd: [],
      focus: `纯 P 震荡收不住 → 加上 D 项（Kd=${KD}）提供阻尼`,
      log: `**加 D 项：阻尼**\n纯 P 冲到 ${ponly[ponly.length - 1]!.p} 还在涨、震荡。问题是没有"刹车"。\n加 **D = Kd·(误差变化率)**：误差在快速缩小时，D 给一个**反向的力**提前减速。重跑一遍（Kp=${KP} 不变、Kd=${KD}），看它怎么平稳停在目标。`,
    })

    // —— 第二幕：PD ——
    {
      let p = 0, v = 0, ePrev = TARGET
      for (let k = 1; k <= N_PD; k++) {
        const e = r3(TARGET - p)
        const de = r3((e - ePrev) / DT)
        const uP = r3(KP * e)
        const uD = r3(KD * de)
        const u = r3(uP + uD)
        v = r3(v + u * DT)
        p = r3(p + v * DT)
        pd.push({ k, p: r2(p) })
        const last = k === N_PD
        push({
          phase: last ? 'done' : 'pd', op: last ? 'summary' : 'step', mode: 'PD', k, e: r2(e), uP, uD, u, v, p: r2(p),
          ponly: snap(ponly), pd: snap(pd),
          focus: `PD 步${k}：e=${r2(e)}，P=${uP}、D=${uD} → u=${u} → 位置 ${r2(p)}`,
          log: last
            ? `**PD · 步 ${k}**\ne=${r2(e)}，P=Kp·e=${uP}，D=Kd·误差变化率=**${uD}**（负=刹车）。u=P+D=${u}，位置到 **${r2(p)}**——平稳逼近目标 10、**不震荡**了。\n\n**要点**：PID 用三项把误差变成控制量——**P** 按当前误差使劲（越远越使劲）、**D** 按误差变化率**阻尼**（快到时反向刹车、防冲过头）、**I** 累积误差**消除稳态偏差**（顶掉重力等恒定扰动）。本例质量块(双积分)纯 P 必震荡，加 D 才稳；有恒定扰动时还要加 I。调参(Kp 快但易震、Kd 稳但迟钝、Ki 消稳态误差但易积分饱和/超调)是控制工程的日常。用在机器人关节位置/力控、电机调速、无人机姿态、温控。进阶有前馈、增益调度、MPC。`
            : `**PD · 步 ${k}**\n误差 e=${r2(e)}，误差变化率=${de}。\n· P = Kp·e = ${uP}（往目标推）\n· D = Kd·变化率 = **${uD}**（${uD < 0 ? '负 → 反向刹车、阻尼' : '阻尼项'}）\nu = P + D = **${u}**，位置到 **${r2(p)}**。D 让它每步刹一点，不再冲过头。`,
        })
        ePrev = e
      }
    }

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, target: TARGET, Kp: KP, Kd: KD, mode: '', k: 0, e: TARGET, uP: 0, uD: 0, u: 0, v: 0, p: 0, ponly: [], pd: [], focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '控制步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
