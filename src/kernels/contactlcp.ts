/**
 * 内核：接触动力学 · 摩擦锥 + LCP（0 ≤ f_n ⊥ φ ≥ 0、|f_t| ≤ μ·f_n）—— 物理引擎每步怎么解接触力：法向互补 + 库仑摩擦锥的粘/滑开关（具身智能 · 刚体动力学 / 面试八股）
 * 轴：step —— 引子(接触是非光滑集值) → 法向互补(不能拉不能穿) → 摩擦锥(|f_t|≤μf_n) → 粘/滑判定(F vs μf_n) → 加速度+LCP视角 → 收尾。
 *
 * 最小例子:质量 m 的滑块压在水平面上,施加水平推力 F。
 *   **法向互补**:0 ≤ f_n ⊥ φ(间隙) ≥ 0——要么分离(φ>0→f_n=0)、要么接触(φ=0→f_n≥0),不能拉不能穿。静止支撑 f_n=m·g。
 *   **库仑摩擦锥**:|f_t| ≤ μ·f_n。粘(stick,v_t=0)时 f_t 在锥内取反作用力;滑(slip)时 f_t=μf_n 在锥边界、反向阻滑。
 *   **粘/滑=摩擦锥的 KKT 开关**:F ≤ μf_n → 粘(a=0);F > μf_n → 滑(a=(F−μf_n)/m)。物理引擎(MuJoCo/Bullet)每步把所有接触组成一个 **LCP/QP** 求解(锥常被线性化成金字塔)。
 * param 推力大小(轻推粘/临界将滑/重推滑)。研究对拍:μ=0.5、f_n=9.81、μf_n=4.905;F=3→粘 a=0;F=6→滑 a=1.095。全现算。连「阻抗力控/正向动力学(仿真)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Push = 'light' | 'crit' | 'heavy'
export type LcpState = {
  i: number
  step: number
  stage: 'intro' | 'normal' | 'cone' | 'stickslip' | 'accel' | 'done'
  push: Push
  pushLabel: string
  m: number; g: number; mu: number; F: number
  fn: number; maxStatic: number
  stick: boolean; ft: number; accel: number
  showNormal: boolean; showCone: boolean; showStick: boolean; showAccel: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<LcpState, 'i'>

const M = 1, GA = 9.81, MU = 0.5
const r3 = (x: number) => Math.round(x * 1000) / 1000

export const contactlcpKernel: Kernel<LcpState> = {
  kind: 'contactlcp',
  compile(doc: SimDocument): CompiledModel<LcpState> {
    const raw = String(doc.params?.push ?? '重推')
    const push: Push = raw.includes('轻') ? 'light' : raw.includes('临界') || raw.includes('crit') ? 'crit' : 'heavy'
    const F = push === 'light' ? 3 : push === 'crit' ? 4.9 : 6
    const pushLabel = push === 'light' ? '轻推 F=3N' : push === 'crit' ? '临界 F=4.9N' : '重推 F=6N'

    const fn = M * GA
    const maxStatic = MU * fn
    const stick = F <= maxStatic
    const ft = stick ? F : maxStatic
    const accel = stick ? 0 : (F - maxStatic) / M

    const frames: Frame[] = []
    const b0 = { push, pushLabel, m: M, g: GA, mu: MU, F, fn: r3(fn), maxStatic: r3(maxStatic), stick, ft: r3(ft), accel: r3(accel), phase: 'run' as const }
    const pushf = (over: Partial<Frame> & { stage: Frame['stage']; showNormal: boolean; showCone: boolean; showStick: boolean; showAccel: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    pushf({
      stage: 'intro', showNormal: false, showCone: false, showStick: false, showAccel: false,
      focus: `接触是非光滑、集值的:法向不能拉不能穿、切向有摩擦锥。物理引擎每步解一个 LCP。推力：${pushLabel}`,
      log: `**接触动力学:物理引擎每步在解的"互补问题"**\n接触和自由运动不一样——它是**非光滑、集值**的:法向**不能拉、不能穿**;切向有**摩擦**、还分粘住和滑动。没法写成一个光滑的 f(x),所以物理引擎(MuJoCo/Bullet/Drake)每步把它组成一个**互补/优化问题(LCP/QP)**来解。\n最小例子:质量 m=${M}kg 的滑块压在水平面(μ=${MU}),施加水平推力 F=**${F}N**。看它是**粘住**还是**滑动**、以及加速度。两条支柱:①法向互补 ②摩擦锥。` })

    pushf({
      stage: 'normal', showNormal: true, showCone: false, showStick: false, showAccel: false,
      focus: `法向互补 0 ≤ f_n ⊥ φ ≥ 0：要么分离(φ>0→f_n=0)、要么接触(φ=0→f_n≥0)。本例 f_n=m·g=${b0.fn}N`,
      log: `**① 法向接触 = 互补条件**\n**0 ≤ f_n ⊥ φ ≥ 0**(φ=间隙、f_n=法向支持力):\n· 分离(φ>0)→ **f_n=0**(不接触、没支持力);· 接触(φ=0)→ **f_n≥0**(有支持力、但**只能推不能拉**——面不能把滑块吸住)。\n二者**必居其一且乘积为0**(互补)——这就是"非光滑"的来源。本例滑块静止压在面上:竖直平衡 → **f_n = m·g = ${M}×${GA} = ${b0.fn}N**。` })

    pushf({
      stage: 'cone', showNormal: true, showCone: true, showStick: false, showAccel: false,
      focus: `库仑摩擦锥 |f_t| ≤ μ·f_n = ${MU}×${b0.fn} = ${b0.maxStatic}N（最大静摩擦）`,
      log: `**② 库仑摩擦锥**\n切向摩擦力受限于法向力:**|f_t| ≤ μ·f_n**。这是个**锥**(3D 里是圆锥、这里 1D 是区间):\n**最大静摩擦 = μ·f_n = ${MU}×${b0.fn} = ${b0.maxStatic}N**。\n· **粘(stick)**、切向速度 v_t=0:f_t 可在锥**内**任意取(取恰好平衡外力的反作用力);\n· **滑(slip)**:f_t 落在锥**边界**(=μf_n)、方向**反着滑动方向**阻滑。\n(LCP 求解器常把圆锥**线性化成金字塔**:几个切向方向 + β≥0、Σβ≤μf_n——用线性互补近似非线性锥,面越多越准、越慢。)` })

    pushf({
      stage: 'stickslip', showNormal: true, showCone: true, showStick: true, showAccel: false,
      focus: `粘/滑判定:比 F=${F}N 与 μf_n=${b0.maxStatic}N → ${stick ? '粘住(F≤μf_n)' : '滑动(F>μf_n)'}；f_t=${b0.ft}N`,
      log: `**③ 粘还是滑?——摩擦锥的 KKT 开关**\n比较外力 F 和最大静摩擦 μf_n:\n**F=${F}N ${stick ? '≤' : '>'} μf_n=${b0.maxStatic}N** → **${stick ? '粘住(stick)' : '滑动(slip)'}**。\n${stick
        ? `摩擦力 f_t = ${b0.ft}N(=外力、方向相反、落在锥**内**),滑块**不动**、切向速度保持 0。`
        : `外力顶破了摩擦锥:摩擦力**饱和**在边界 f_t=μf_n=${b0.maxStatic}N(**滑动摩擦、反向阻滑**),多出来的力让滑块加速。`}\n这就是"stick vs slip = 摩擦锥的 KKT 开关":在锥**内部**→粘(v_t=0)、在锥**边界**→滑(f_t=μf_n 反向)。` })

    pushf({
      stage: 'accel', showNormal: true, showCone: true, showStick: true, showAccel: true,
      focus: `加速度 a = (F − f_t)/m = ${b0.accel} m/s²${stick ? '（粘住→0）' : ''}；这就是 LCP 每步解出的接触响应`,
      log: `**④ 加速度 + LCP 视角**\n牛顿第二定律(切向):**a = (F − f_t)/m** = (${F} − ${b0.ft})/${M} = **${b0.accel} m/s²**。\n${stick ? '粘住:f_t=F、净力为 0 → **a=0**、滑块静止。' : `滑动:f_t 饱和在 μf_n → 净力 ${F}−${b0.maxStatic}=${r3(F - maxStatic)}N → **a=${b0.accel} m/s²**加速。`}\n**LCP 视角**:引擎每步组一个线性互补问题,变量是接触冲量(f_n、切向 β、滑动松弛 λ)。${stick ? '粘住 → 松弛 λ=0、锥约束不激活(有余量)。' : '滑动 → λ>0、锥约束激活(Σβ=μf_n 顶到边界)。'}多个接触就是一个更大的 LCP/QP,用 PGS/Lemke/内点法解。` })

    pushf({
      stage: 'done', showNormal: true, showCone: true, showStick: true, showAccel: true, phase: 'done',
      focus: `收尾:接触=法向互补+摩擦锥,粘/滑是锥的KKT开关;引擎每步组LCP/QP;连阻抗力控、正向动力学仿真`,
      log: `**小结:接触动力学 = 两条互补/锥约束**\n① **法向互补 0≤f_n⊥φ≥0**:不能拉、不能穿(非光滑的来源)。\n② **库仑摩擦锥 |f_t|≤μf_n**:粘(锥内、v_t=0)/滑(锥边界、f_t=μf_n 反向)。\n③ **粘/滑 = 摩擦锥的 KKT 开关**:F≤μf_n 粘(a=0)、F>μf_n 滑(a=(F−μf_n)/m)。本例 ${pushLabel} → ${stick ? '粘、a=0' : `滑、a=${b0.accel}`}。\n④ **物理引擎每步组 LCP/QP** 解所有接触冲量(锥常线性化成金字塔;PGS/Lemke/内点);冲量法(速度级)才能处理碰撞(Painlevé 佯谬警告纯力级会矛盾);Baumgarte/软约束修正穿透漂移。\n**连到别的课**:「正向动力学/仿真」每步在动力学之外还要解这个接触 LCP;「阻抗/力控」处理的正是接触时的柔顺;抓取的力闭合、腿足的落脚都建在摩擦锥上。参考:Stewart-Trinkle/Anitescu-Potra 时间步进、Tedrake《Underactuated》接触章、MuJoCo 软凸锥。面试延伸:为何是互补不是 ODE;金字塔 vs 真圆锥;粘滑开关;为何要冲量级。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showNormal: false, showCone: false, showStick: false, showAccel: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '接触求解步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
