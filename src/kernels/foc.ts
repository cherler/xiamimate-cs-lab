/**
 * 内核：FOC 磁场定向控制（稚晖君 Dummy-Robot · Ctrl-Step / Ctrl-FOC-Lite 的电流环）—— 把三相交流电流转进"跟着转子转"的 dq 坐标系，就能像直流电机一样独立控力矩(权限八股)（具身智能 · 项目实战 / 面试八股）
 * 轴：step —— Clarke(3相→2相αβ) → Park(αβ→旋转 dq、交流变直流) → 两个 PI(i_d→0、i_q→i_q*) → 逆 Park+逆 Clarke+SVPWM → 转矩，一个控制周期。
 *
 * 稚晖君 Dummy-Robot 的关节驱动 Ctrl-Step(2相步进,FOC 把变换收成 90°矢量放置)、配套 Ctrl-FOC-Lite(3相 BLDC,基于 SimpleFOC 的标准 Clarke/Park/SVPWM)。这里讲**标准三相 FOC 电流环**——嵌入式电机控制的头号八股。
 * 一个控制周期(20kHz、dt 固定)确定性单步：
 *   ① **Clarke** abc→αβ：i_α=i_a，i_β=(1/√3)i_a+(2/√3)i_b（三相去掉冗余一相）。
 *   ② **Park** αβ→dq（按转子电角 θ_e 旋转）：i_d=i_α cosθ+i_β sinθ，i_q=i_β cosθ−i_α sinθ。**交流的相电流在转子系里变成直流**——于是一个简单 PI 就能做到零稳态误差。
 *   ③ **两个 PI**：e_d=**0**−i_d、e_q=i_q*−i_q → U_d、U_q。**i_d*=0** 是最大转矩每安培(MTPA)：表贴永磁/步进只有 i_q 产生转矩、i_d 只发热。
 *   ④ **逆 Park + 逆 Clarke + SVPWM**：U_d,U_q→U_α,U_β→U_a,U_b,U_c，再做中点钳位(注入共模)——**SVPWM 比正弦 PWM 多约 15% 母线电压利用率**。
 *   ⑤ **转矩** τ=1.5·p·λ_m·i_q。param 选力矩指令(正转/反转/零)。为何比开环微步好：闭环量转子角、恒 90°矢量→不丢步、每安培都产生转矩。全链现算。连「PID(FOC 是级联最内环)/FK·IK(它驱动的关节)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Cmd = 'fwd' | 'rev' | 'zero'
export type FocState = {
  i: number
  step: number
  stage: 'intro' | 'clarke' | 'park' | 'pi' | 'invsvpwm' | 'done'
  cmd: Cmd
  cmdLabel: string
  thetaDeg: number
  iqTarget: number
  idTarget: number
  ia: number; ib: number; ic: number       // 测得三相电流
  iAlpha: number; iBeta: number             // Clarke
  iD: number; iQ: number                    // Park（测得，转子系直流）
  eD: number; eQ: number; uD: number; uQ: number   // 两个 PI
  uAlpha: number; uBeta: number             // 逆 Park
  uA: number; uB: number; uC: number        // 逆 Clarke（SVPWM 前）
  uAc: number; uBc: number; uCc: number      // SVPWM 中点钳位后
  svOffset: number
  torque: number
  poles: number; lambdaM: number; kp: number
  showClarke: boolean; showPark: boolean; showPI: boolean; showInv: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<FocState, 'i'>

const THETA_DEG = 30
const KP = 10
const POLES = 7, LAMBDA_M = 0.01
const ID_MEAS = 0.1                 // 测得 i_d（还没被压到 0）
const S3 = Math.sqrt(3)
const r3 = (x: number) => Math.round(x * 1000) / 1000

export const focKernel: Kernel<FocState> = {
  kind: 'foc',
  compile(doc: SimDocument): CompiledModel<FocState> {
    const raw = String(doc.params?.cmd ?? '正转 iq*=+1.0A')
    const cmd: Cmd = raw.includes('反转') ? 'rev' : raw.includes('零') ? 'zero' : 'fwd'
    const cmdLabel = cmd === 'fwd' ? '正转 iq*=+1.0A' : cmd === 'rev' ? '反转 iq*=−1.0A' : '零力矩 iq*=0'
    const iqTarget = cmd === 'fwd' ? 1.0 : cmd === 'rev' ? -1.0 : 0.0
    const idTarget = 0

    const th = (THETA_DEG * Math.PI) / 180
    const ct = Math.cos(th), st = Math.sin(th)
    // 构造"测得"的转子系电流：i_d=ID_MEAS(偏离0)、i_q=90%·目标（比例滞后）
    const iqMeas = 0.9 * iqTarget, idMeas = ID_MEAS
    // 逆变换出三相测得电流（传感器看到的交流量）
    const iAlpha = r3(idMeas * ct - iqMeas * st)
    const iBeta = r3(idMeas * st + iqMeas * ct)
    const ia = r3(iAlpha)
    const ib = r3((S3 / 2) * iBeta - 0.5 * iAlpha)
    const ic = r3(-ia - ib)

    // ① Clarke（前向，复现 αβ）
    const cAlpha = r3(ia)
    const cBeta = r3((1 / S3) * ia + (2 / S3) * ib)
    // ② Park（前向：交流→直流）
    const iD = r3(cAlpha * ct + cBeta * st)
    const iQ = r3(cBeta * ct - cAlpha * st)
    // ③ 两个 PI（单拍用 Kp 展示；积分驱稳态到 0，正文说明）
    const eD = r3(idTarget - iD)
    const eQ = r3(iqTarget - iQ)
    const uD = r3(KP * eD)
    const uQ = r3(KP * eQ)
    // ④ 逆 Park
    const uAlpha = r3(uD * ct - uQ * st)
    const uBeta = r3(uD * st + uQ * ct)
    // 逆 Clarke
    const uA = r3(uAlpha)
    const uB = r3(-0.5 * uAlpha + (S3 / 2) * uBeta)
    const uC = r3(-0.5 * uAlpha - (S3 / 2) * uBeta)
    // SVPWM 中点钳位（注入共模零序）
    const svOffset = r3(-(Math.max(uA, uB, uC) + Math.min(uA, uB, uC)) / 2)
    const uAc = r3(uA + svOffset), uBc = r3(uB + svOffset), uCc = r3(uC + svOffset)
    // ⑤ 转矩
    const torque = r3(1.5 * POLES * LAMBDA_M * iQ)

    const frames: Frame[] = []
    const b0 = {
      cmd, cmdLabel, thetaDeg: THETA_DEG, iqTarget, idTarget, ia: cAlpha, ib, ic, iAlpha: cAlpha, iBeta: cBeta,
      iD, iQ, eD, eQ, uD, uQ, uAlpha, uBeta, uA, uB, uC, uAc, uBc, uCc, svOffset, torque,
      poles: POLES, lambdaM: LAMBDA_M, kp: KP, phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showClarke: boolean; showPark: boolean; showPI: boolean; showInv: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showClarke: false, showPark: false, showPI: false, showInv: false,
      focus: `FOC：把三相交流电流转进"跟着转子转"的 dq 系，就能像直流电机一样用两个 PI 独立控力矩(i_q)和磁场(i_d)。指令：${cmdLabel}`,
      log: `**FOC 磁场定向控制：让交流电机像直流电机一样好控**\n稚晖君 Dummy-Robot 的关节靠 **Ctrl-Step**(闭环步进、FOC 把变换收成"电流矢量恒超前转子 90°")驱动、配套 **Ctrl-FOC-Lite**(3 相无刷、基于 SimpleFOC 的标准 Clarke/Park/SVPWM)。这里拆**标准三相 FOC 电流环**——嵌入式电机控制的头号面试题。\n**核心思想**：三相电流是随转子转的**交流量**，直接用 PI 控不了(PI 跟不上正弦)。FOC 把它**旋转到跟着转子转的 dq 坐标系**——交流就变成**直流**，于是两个简单 PI 就能各管一路：**i_q 管力矩、i_d 管磁场**。\n一个控制周期(20kHz)：Clarke→Park→两个 PI→逆变换+SVPWM→转矩。当前指令 **${cmdLabel}**、转子电角 θ_e=**${THETA_DEG}°**。` })

    push({
      stage: 'clarke', showClarke: true, showPark: false, showPI: false, showInv: false,
      focus: `① Clarke：三相 abc → 两相 αβ（去掉冗余一相，因 i_a+i_b+i_c=0）`,
      log: `**① Clarke 变换：3 相 → 2 相(静止 αβ)**\n三相电流满足 i_a+i_b+i_c=0，有冗余；Clarke 压成两个正交分量：\n**i_α = i_a = ${cAlpha}**；**i_β = (1/√3)·i_a + (2/√3)·i_b = ${cBeta}**。\n测得三相电流(传感器看到的交流量)：i_a=${cAlpha}、i_b=${ib}、i_c=${ic}(随转子转、都是正弦)。\n(注：若是 2 相步进，两相本就正交，Clarke 退化成恒等——这就是 Ctrl-Step 不需要 Clarke 的原因。)` })

    push({
      stage: 'park', showClarke: true, showPark: true, showPI: false, showInv: false,
      focus: `② Park：αβ → 旋转 dq（按转子电角 θ_e=${THETA_DEG}° 旋转）——交流电流变直流！`,
      log: `**② Park 变换：αβ → 旋转 dq(关键一步)**\n按转子电角 θ_e 把 αβ 旋进"跟着转子转"的 dq 系：\n**i_d = i_α cosθ + i_β sinθ = ${iD}**；**i_q = i_β cosθ − i_α sinθ = ${iQ}**。\n**这一步的魔力**：本来随转子转的正弦相电流，在 dq 系里变成**直流(不随时间变)**——于是一个简单 **PI 就能做到零稳态误差**(PI 追不了正弦、却能把直流误差压到 0)。\ni_d=转子磁场方向的分量、i_q=垂直方向(产生转矩)的分量。现在拿到 i_d=${iD}、i_q=${iQ}。` })

    push({
      stage: 'pi', showClarke: true, showPark: true, showPI: true, showInv: false,
      focus: `③ 两个 PI：e_d=0−i_d、e_q=i_q*−i_q → U_d、U_q。i_d*=0 是 MTPA`,
      log: `**③ 两个 PI 电流控制器**\n在 dq 直流量上各放一个 PI：\n· **d 轴**：目标 **i_d*=0**，e_d=0−${iD}=${eD} → U_d=${uD}。\n· **q 轴**：目标 **i_q*=${iqTarget}**(力矩指令)，e_q=${iqTarget}−${iQ}=${eQ} → U_q=${uQ}。\n**为什么 i_d*=0**？——表贴永磁/混合步进电机**只有 i_q 产生转矩**、i_d 只白白发热(I²R)不出力。i_d*=0 = **最大转矩每安培(MTPA)**。(唯一例外：高速时故意让 i_d<0 做**弱磁**。)\n(单拍这里只画 Kp 项；实际是 PI，积分项把直流稳态误差彻底压到 0——这正是转到直流系的意义。d、q 两路还可加交叉解耦前馈。)` })

    push({
      stage: 'invsvpwm', showClarke: true, showPark: true, showPI: true, showInv: true,
      focus: `④ 逆 Park→逆 Clarke→SVPWM 中点钳位（比正弦 PWM 多约 15% 母线利用率）；转矩 τ=1.5·p·λ_m·i_q=${torque}`,
      log: `**④ 逆变换 + SVPWM，⑤ 转矩**\n把 U_d、U_q 变回三相占空比：\n**逆 Park**：U_α=U_d cosθ−U_q sinθ=${uAlpha}、U_β=U_d sinθ+U_q cosθ=${uBeta}。\n**逆 Clarke**：U_a=${uA}、U_b=−½U_α+(√3/2)U_β=${uB}、U_c=−½U_α−(√3/2)U_β=${uC}。\n**SVPWM 中点钳位**：三相同时加共模偏置 ${svOffset}(=−(max+min)/2) → U_a=${uAc}、U_b=${uBc}、U_c=${uCc}。这个共模(零序)注入正是 **SVPWM 比正弦 PWM 多约 15% 母线电压利用率**的来历。\n**转矩** τ=1.5·p·λ_m·i_q=1.5×${POLES}×${LAMBDA_M}×${iQ}=**${torque} N·m**(${torque > 0 ? '正转' : torque < 0 ? '反转' : '零'})——只跟 i_q 走，验证了 i_q 就是力矩旋钮。` })

    push({
      stage: 'done', showClarke: true, showPark: true, showPI: true, showInv: true, phase: 'done',
      focus: `收尾：Clarke/Park 把交流变直流→PI 零稳态误差；i_d*=0 MTPA；SVPWM +15%；FOC 是级联 PID 最内环；比开环微步好在闭环量转子角`,
      log: `**小结：FOC 为什么是电机控制的标准答案**\n① **Clarke(3→2) + Park(转进转子系)** 把随转子转的交流相电流变成**直流** → 简单 PI 就能**零稳态误差**(PI 追不了正弦)。\n② **i_d*=0** = 最大转矩每安培(表贴永磁/步进只有 i_q 出力、i_d 只发热)；高速弱磁才让 i_d<0。\n③ **d、q 解耦**：两个独立 PI(+交叉前馈)分别管磁场与力矩。\n④ **SVPWM** 注入共模零序 → 比正弦 PWM 多约 15% 母线电压利用率。\n⑤ **转矩** τ=1.5·p·λ_m·i_q——i_q 是力矩旋钮。\n**连到别的课**：这是**级联 PID 的最内环**(位置环→速度环→**电流环**，内环带宽最高、20kHz)；Ctrl-Step 把这套用"电流矢量恒超前转子 90°"实现、结构上强制 i_d=0；它驱动的正是 **FK/IK** 求解的关节。**为何比开环微步好**：微步按"期望角"给电流、不看转子，负载一大转子滞后→矢量不再超前 90°→转矩塌、丢步;FOC 每拍量转子角、恒 90°矢量→**不丢步、每安培都出力、效率高**。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showClarke: false, showPark: false, showPI: false, showInv: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '控制周期' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
