/**
 * 内核：轨迹规划 · 三次多项式真仿真 —— 给关节生成平滑的时间轨迹(位置/速度/加速度)，对比线性插值的速度突跳（具身智能 · 机器人学基础）
 * 轴：step —— 由 4 个边界条件解出三次多项式系数，再逐时刻算出位置(S曲线)、速度(钟形,两端归零)、加速度(有限)
 *
 * 光有起点终点(FK/IK 给位置)还不够,机器人真运动还要一条**平滑的时间轨迹**:每个时刻关节在哪、速度多少、加速度多少。
 * 直接**线性插值**(两点连直线匀速走)不行——速度在起点从 0 突跳到匀速值、终点又突跳回 0,意味着**瞬间无穷大加速度**,电机顿挫、抖动、伤机械。
 * 经典做法 **三次多项式**:θ(t)=a0+a1t+a2t²+a3t³,用 4 个**边界条件**定 4 个系数:θ(0)=θ0、θ(T)=θf、**θ̇(0)=0、θ̇(T)=0**(两端静止)。
 * 解得 a0=θ0, a1=0, a2=3(θf−θ0)/T², a3=−2(θf−θ0)/T³。于是位置是平滑 **S 曲线**、速度是**钟形**(两端为 0、中间最大)、加速度**有限**(线性)——顺滑起步、顺滑停住。
 * 本例关节 0°→90°、T=2s:解出系数、逐时刻算出 θ/θ̇/θ̈,和线性插值(速度恒 45 但两端突跳)对比。系数与每时刻值全真算、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100

type Samp = { t: number; theta: number; vel: number }
export type TrajState = {
  i: number
  step: number
  phase: 'intro' | 'linear' | 'solve' | 'trace' | 'done'
  op: 'intro' | 'linear' | 'solve' | 'sample' | 'summary'
  theta0: number
  thetaF: number
  T: number
  a: [number, number, number, number]
  t: number
  theta: number
  vel: number
  accel: number
  linVel: number            // 线性插值的匀速值
  samples: Samp[]           // 已算出的三次曲线点（累积）
  focus: string
  log: string
}
type Frame = Omit<TrajState, 'i'>

const TH0 = 0, THF = 90, T = 2
const TS = [0, 0.4, 0.8, 1.2, 1.6, 2.0]

export const trajectoryKernel: Kernel<TrajState> = {
  kind: 'trajectory',
  compile(_doc: SimDocument): CompiledModel<TrajState> {
    const frames: Frame[] = []
    const a0 = TH0, a1 = 0, a2 = r2(3 * (THF - TH0) / (T * T)), a3 = r2(-2 * (THF - TH0) / (T * T * T))
    const A: [number, number, number, number] = [a0, a1, a2, a3]
    const linVel = r2((THF - TH0) / T)
    const pos = (t: number) => r2(a0 + a1 * t + a2 * t * t + a3 * t * t * t)
    const vel = (t: number) => r2(a1 + 2 * a2 * t + 3 * a3 * t * t)
    const acc = (t: number) => r2(2 * a2 + 6 * a3 * t)
    const snap = (s: Samp[]) => s.map(x => ({ ...x }))
    const push = (f: Omit<Frame, 'step' | 'theta0' | 'thetaF' | 'T' | 'a' | 'linVel'>) =>
      frames.push({ step: frames.length, theta0: TH0, thetaF: THF, T, a: A, linVel, ...f })

    push({
      phase: 'intro', op: 'intro', t: 0, theta: TH0, vel: 0, accel: 0, samples: [],
      focus: '轨迹规划：给关节生成平滑的时间轨迹（位置/速度/加速度），不只是连两点',
      log: `**轨迹规划：平滑地从 A 到 B**\nFK/IK 给了起点终点，但机器人真运动还要一条**平滑的时间轨迹**：每个时刻在哪、速度多少、加速度多少。\n关节 **${TH0}° → ${THF}°、用 T=${T}s**。先看直接连直线(线性插值)有什么毛病，再用三次多项式修。`,
    })

    push({
      phase: 'linear', op: 'linear', t: 0, theta: TH0, vel: linVel, accel: 0, samples: [],
      focus: `线性插值：速度恒 ${linVel}°/s，但两端从 0 突跳 → 瞬间无穷大加速度、顿挫`,
      log: `**线性插值的毛病**\n两点连直线、匀速走：θ(t)=${linVel}·t，速度恒 = **${linVel}°/s**。\n问题：速度在**起点从 0 突跳到 ${linVel}**、**终点又从 ${linVel} 突跳回 0** → 那一瞬间**加速度无穷大**（θ̈=速度变化率）。电机顿挫、机械抖动、还可能过冲。真机器人不能这么走。`,
    })

    push({
      phase: 'solve', op: 'solve', t: 0, theta: TH0, vel: 0, accel: acc(0), samples: [],
      focus: `三次多项式：4 个边界条件 → a=[${A.join(', ')}]`,
      log: `**三次多项式：解系数**\nθ(t)=a0+a1t+a2t²+a3t³，用 **4 个边界条件**定 4 个系数（要两端**静止**才平滑）：\n· θ(0)=${TH0} → a0=**${a0}**；θ̇(0)=0 → a1=**${a1}**\n· θ(T)=${THF} 且 θ̇(T)=0 → 解出 a2=3(θf−θ0)/T²=**${a2}**、a3=−2(θf−θ0)/T³=**${a3}**\n于是 θ(t)=${a2}t²${a3}t³。逐时刻算它的位置、速度、加速度。`,
    })

    const samples: Samp[] = []
    TS.forEach((t, idx) => {
      const th = pos(t), v = vel(t), ac = acc(t)
      samples.push({ t, theta: th, vel: v })
      const last = idx === TS.length - 1
      push({
        phase: last ? 'done' : 'trace', op: last ? 'summary' : 'sample', t, theta: th, vel: v, accel: ac, samples: snap(samples),
        focus: `t=${t}s：θ=${th}°、θ̇=${v}°/s、θ̈=${ac}°/s²`,
        log: last
          ? `**t=${t}s（终点）**\nθ=${th}°（到位）、**θ̇=${v}°/s（速度归零，顺滑停住）**、θ̈=${ac}°/s²。\n对比线性插值：三次的速度是**钟形**（0 → 中点最大 ${vel(1)} → 0），起停都平滑；线性的速度恒 ${linVel} 但两端突跳。\n\n**要点**：轨迹规划给的是**时间参数化**的平滑运动，不只是几何路径（那是 RRT 的活）。三次多项式满足**位置和速度**两端连续（起停静止），代价是加速度两端不为 0（有跳变但有限）；要连**加速度**也平滑就用**五次多项式**(6 个边界条件)。多段路点之间用**样条**(spline)拼、保证接缝处速度/加速度连续。工业上还常用**梯形速度曲线**(加速-匀速-减速)、S 曲线(限加加速度 jerk)。这条轨迹再交给 **PID** 去跟踪、每个路点用 **IK** 转成关节角。这就是"从路径到能执行的运动"的一环。`
          : `**t=${t}s**\nθ(${t}) = ${a2}·${t}² ${a3 < 0 ? '−' : '+'} ${Math.abs(a3)}·${t}³ = **${th}°**；速度 θ̇=**${v}°/s**；加速度 θ̈=**${ac}°/s²**。\n位置沿 S 曲线走，速度${idx === 0 ? '从 0 开始爬升（不像线性那样突跳）' : v > (samples[idx - 1]?.vel ?? 0) ? '还在升' : '开始降（准备停）'}。`,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, theta0: TH0, thetaF: THF, T, a: A, t: 0, theta: TH0, vel: 0, accel: 0, linVel, samples: [], focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '轨迹步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
