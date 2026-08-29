/**
 * 内核：阻抗/力控 · 柔顺接触真仿真 —— 把机械臂做成虚拟弹簧-阻尼，接触时柔顺让步、接触力可调（具身智能 · 机器人控制）
 * 轴：step —— 末端被命令去墙后面的目标：刚性位置控制会硬顶出巨大接触力；阻抗控制渲染一个软弹簧，动态逼近、轻柔接触、力settle到可控值
 *
 * 装配、打磨、拧螺丝、和人协作——这些**接触任务**里,机器人不能只盯着"到达某个位置"。
 * 纯**位置控制**很"刚":你命令末端去 x,它就死命把位置误差压到 0。一旦撞上墙/工件,为了消掉那点位置误差会输出**巨大的接触力** → 砸坏工件、伤人、打滑。
 * **阻抗控制(力控)** 换个思路:让末端表现得像一个**虚拟的弹簧+阻尼**——F = K(x_目标 − x) − D·ẋ。它"想"去目标,但遇到阻挡就**柔顺让步**:
 *   接触力 ≈ K × 侵入深度,而 K(刚度)是你**自己设的**。设小 K → 软 → 轻轻贴着走、接触力小可控;设大 K → 硬 → 接近位置控制。
 * 本例末端被命令去 **x=8**,但墙在 **x=5**:刚性控制(K=200)稳态硬顶出 **480N**(砸);阻抗控制(K=25)动态逼近、轻柔接触、力 settle 到 **~73N**——同一个目标,力差 6.6 倍。
 * 位置/接触力每步由弹簧-阻尼-墙反力的动力学真跑,可手核。这是让机器人"会用力"的地基。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100

type Samp = { t: number; x: number; force: number }
export type ImpState = {
  i: number
  step: number
  phase: 'intro' | 'stiff' | 'compliant' | 'done'
  op: 'intro' | 'stiff' | 'sample' | 'summary'
  xCmd: number
  xWall: number
  K: number
  D: number
  stiffForce: number         // 刚性位置控制的稳态接触力（对照）
  t: number
  x: number
  contactForce: number
  penetration: number
  samples: Samp[]            // 阻抗控制动态过程（累积）
  focus: string
  log: string
}
type Frame = Omit<ImpState, 'i'>

const XCMD = 8, XWALL = 5, KW = 800
const K = 25, D = 10, M = 1, DT = 0.05
const K_STIFF = 200
const stiffSteady = (kk: number) => { const x = (kk * XCMD + KW * XWALL) / (kk + KW); return r2(kk * (XCMD - x)) }
const STIFF_F = stiffSteady(K_STIFF)

// 阻抗动态：虚拟弹簧K+阻尼D，墙反力Kw
const simTo = (tEnd: number): { x: number; force: number } => {
  let x = 0, v = 0
  const steps = Math.round(tEnd / DT)
  for (let s = 0; s < steps; s++) {
    const Fc = K * (XCMD - x) - D * v
    const Fw = x > XWALL ? -KW * (x - XWALL) : 0
    const a = (Fc + Fw) / M
    v = v + a * DT; x = x + v * DT
  }
  return { x: r2(x), force: r2(x > XWALL ? KW * (x - XWALL) : 0) }
}
const TSAMP = [0, 0.3, 0.6, 0.9, 1.2, 1.8]

export const impedanceKernel: Kernel<ImpState> = {
  kind: 'impedance',
  compile(_doc: SimDocument): CompiledModel<ImpState> {
    const frames: Frame[] = []
    const snap = (s: Samp[]) => s.map(x => ({ ...x }))
    const push = (f: Omit<Frame, 'step' | 'xCmd' | 'xWall' | 'K' | 'D' | 'stiffForce'>) =>
      frames.push({ step: frames.length, xCmd: XCMD, xWall: XWALL, K, D, stiffForce: STIFF_F, ...f })

    push({
      phase: 'intro', op: 'intro', t: 0, x: 0, contactForce: 0, penetration: 0, samples: [],
      focus: '接触任务：位置控制会硬顶出巨大力，阻抗控制渲染软弹簧、柔顺接触',
      log: `**阻抗/力控：让机器人"会用力"**\n装配、打磨、和人协作这些**接触任务**，机器人不能只盯"到达某位置"。\n纯**位置控制**很刚：命令去 x 就死命把位置误差压到 0，撞上工件会输出巨大接触力、砸坏东西。\n**阻抗控制**让末端像**虚拟弹簧+阻尼** F=K(x目标−x)−D·ẋ：想去目标、遇阻就柔顺让步，接触力≈K×侵入，K 你自己设。\n本例命令末端去 **x=${XCMD}**、墙在 **x=${XWALL}**。先看刚性、再看柔顺。`,
    })

    push({
      phase: 'stiff', op: 'stiff', t: 0, x: r2((K_STIFF * XCMD + KW * XWALL) / (K_STIFF + KW)), contactForce: STIFF_F, penetration: r2((K_STIFF * XCMD + KW * XWALL) / (K_STIFF + KW) - XWALL), samples: [],
      focus: `刚性位置控制(K=${K_STIFF})：为消 ${XCMD - XWALL} 的位置误差硬顶 → 接触力 ${STIFF_F}N（砸）`,
      log: `**刚性位置控制：硬顶**\n位置控制刚度很高(K=${K_STIFF})。它命令末端去 x=${XCMD}，被墙挡在 x=${XWALL}，还剩 **${XCMD - XWALL}** 的位置误差没消掉——于是死命加力去顶：稳态接触力 = **${STIFF_F}N**（侵入墙 ${r2((K_STIFF * XCMD + KW * XWALL) / (K_STIFF + KW) - XWALL)}）。\n这么大的力会**砸坏工件、伤人、打滑**。位置控制不知道"该松手"。`,
    })

    const samples: Samp[] = []
    TSAMP.forEach((t, idx) => {
      const { x, force } = simTo(t)
      samples.push({ t, x, force })
      const last = idx === TSAMP.length - 1
      const contacted = x > XWALL
      push({
        phase: last ? 'done' : 'compliant', op: last ? 'summary' : 'sample', t, x, contactForce: force, penetration: r2(Math.max(0, x - XWALL)), samples: snap(samples),
        focus: `阻抗控制 t=${t}s：位置 ${x}${contacted ? `，接触力 ${force}N` : '（还没碰到墙）'}`,
        log: last
          ? `**阻抗控制 t=${t}s：稳定接触**\n末端 settle 在 x=**${x}**（只侵入墙 ${r2(x - XWALL)}），接触力 **${force}N**——轻柔、可控。\n\n**对比**：同一个命令(去 x=${XCMD})、同一堵墙，**刚性 ${STIFF_F}N（砸）vs 柔顺 ${force}N（贴）**，差 ${r2(STIFF_F / force)} 倍。\n\n**要点**：阻抗/力控让机器人**表现得像弹簧-阻尼**(F=K·Δx−D·ẋ)，遇阻柔顺让步而非硬顶。**接触力≈K×侵入深度，K(刚度)是你设的旋钮**：软(小 K)→轻贴、吸收冲击、对人安全；硬(大 K)→接近位置控制。变体：**导纳控制**(测力→改位置，反过来)、**混合力/位控**(某些方向控位置、某些方向控力，如打磨：沿面控位置、压向面控力)、直接**力控**(设定目标接触力)。靠关节力矩传感器/末端力/力矩传感器测力、或电流估力。这是装配(轴孔)、打磨抛光、拧螺丝、协作机器人(人一推就让)、双臂操作的核心——机器人从"会到位"进化到"会用力"。`
          : `**阻抗控制 t=${t}s**\n末端像被一根软弹簧(K=${K})拉向目标 x=${XCMD}：位置到 **${x}**。${contacted ? `已贴上墙、侵入 ${r2(x - XWALL)}，接触力 K×侵入... 实为墙反力 **${force}N**（在往稳态 ~73N 走）。软弹簧让它轻轻贴、不硬顶。` : '还在空中逼近，没接触、接触力 0。阻尼 D 让它不冲过头。'}`,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, xCmd: XCMD, xWall: XWALL, K, D, stiffForce: STIFF_F, t: 0, x: 0, contactForce: 0, penetration: 0, samples: [], focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '力控步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
