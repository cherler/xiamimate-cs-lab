/**
 * 内核：扩展卡尔曼滤波 EKF —— 卡尔曼滤波的非线性扩展：运动/观测非线性时，在当前估计点用雅可比线性化再套卡尔曼公式（具身智能 · 机器人感知 / 面试八股）
 * 轴：step —— 引子(非线性怎么办) → 预测(动一步、方差涨) → 非线性观测模型 h(x̂) → 关键:雅可比 H=∂h/∂x 在估计点求值 → 更新(创新/增益/融合) → 收尾。
 *
 * 最小非线性例子:机器人在 x 轴上、状态是 1 维位置 x;地标在 **(L=10, d=5)**(偏离 x 轴),测到地标的**距离** z=h(x)=√((L−x)²+d²)——**对 x 非线性**。
 *   **预测**:运动 x̂←x̂+u、方差 P←P+Q。**观测模型**:预测测量 h(x̂)=√((L−x̂)²+d²)。**雅可比(EKF 精髓)**:H=∂h/∂x=**−(L−x̂)/h**(在估计点求值,把非线性 h 就地线性化)。
 *   **更新**(套线性卡尔曼、但用 H):创新 y=z−h(x̂)、S=H²P+R、增益 K=PH/S、x←x̂+Ky、P←(1−KH)P。H 的符号/大小编码"往哪个方向动会让距离怎么变"。
 * param 测量信任(R 小=信测量、K 大;R 大=信预测、K 小)。EKF 失效:强非线性/线性化点差→用 UKF/粒子滤波。全现算。连「卡尔曼滤波/雅可比矩阵」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Trust = 'tight' | 'loose'
export type EkfState = {
  i: number
  step: number
  stage: 'intro' | 'predict' | 'measmodel' | 'jacobian' | 'update' | 'done'
  trust: Trust
  trustLabel: string
  xPrior: number; PPrior: number; u: number; Q: number; R: number
  L: number; d: number
  xPred: number; PPred: number
  hPred: number; z: number; innov: number
  H: number; S: number; K: number
  xPost: number; PPost: number
  showPred: boolean; showMeas: boolean; showJac: boolean; showUpd: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<EkfState, 'i'>

const X0 = 3, P0 = 4, U = 2, Q = 1
const L = 10, D = 5
const Z = 8.0
const r2 = (x: number) => Math.round(x * 100) / 100
const r3 = (x: number) => Math.round(x * 1000) / 1000

export const ekfKernel: Kernel<EkfState> = {
  kind: 'ekf',
  compile(doc: SimDocument): CompiledModel<EkfState> {
    const trust: Trust = String(doc.params?.trust ?? '测量准').includes('糙') || String(doc.params?.trust ?? '').includes('大') ? 'loose' : 'tight'
    const trustLabel = trust === 'tight' ? '测量准(R=0.25)' : '测量糙(R=9)'
    const R = trust === 'tight' ? 0.25 : 9

    const xPred = X0 + U, PPred = P0 + Q
    const hPred = Math.sqrt((L - xPred) ** 2 + D * D)
    const H = -(L - xPred) / hPred
    const innov = Z - hPred
    const S = H * H * PPred + R
    const K = PPred * H / S
    const xPost = xPred + K * innov
    const PPost = (1 - K * H) * PPred

    const frames: Frame[] = []
    const b0 = {
      trust, trustLabel, xPrior: X0, PPrior: P0, u: U, Q, R, L, d: D,
      xPred, PPred, hPred: r3(hPred), z: Z, innov: r3(innov), H: r3(H), S: r2(S), K: r3(K), xPost: r2(xPost), PPost: r2(PPost), phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showPred: boolean; showMeas: boolean; showJac: boolean; showUpd: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showPred: false, showMeas: false, showJac: false, showUpd: false,
      focus: `EKF=卡尔曼滤波的非线性扩展:运动/观测非线性时,在当前估计点用雅可比线性化再套卡尔曼。信任：${trustLabel}`,
      log: `**EKF:非线性时怎么用卡尔曼**\n上一课「卡尔曼滤波」要求运动和观测都是**线性**的。但机器人常遇**非线性**:比如状态是位置 x、但传感器测的是到地标的**距离** z=√((L−x)²+d²)——对 x 非线性。\n**EKF 的招**:在**当前估计点**把非线性函数用**一阶泰勒(雅可比)线性化**,再套原来的卡尔曼公式。\n本例:机器人在 x 轴、状态 1 维位置 x;地标在 **(${L}, ${D})**(偏离轴、所以距离对 x 非线性)。先验 x̂=${X0}、P=${P0};走一步 u=${U};测得距离 z=${Z}。信任 **${trustLabel}**。` })

    push({
      stage: 'predict', showPred: true, showMeas: false, showJac: false, showUpd: false,
      focus: `预测:x̂←x̂+u=${xPred}、方差 P←P+Q=${PPred}(动一步、不确定度涨)`,
      log: `**① 预测(运动更新)**\n运动模型(这里线性、简单):x̂ ← x̂ + u = ${X0} + ${U} = **${xPred}**;方差 P ← P + Q = ${P0} + ${Q} = **${PPred}**(过程噪声让不确定度增长)。\n(一般 EKF 里运动也可非线性 x̂←f(x̂,u),那就还要对 f 求雅可比 F、用 P←F P Fᵀ+Q。本例运动线性、聚焦观测的非线性。)现在带着 x̂=${xPred}、P=${PPred} 去看测量。` })

    push({
      stage: 'measmodel', showPred: true, showMeas: true, showJac: false, showUpd: false,
      focus: `非线性观测:预测测量 h(x̂)=√((L−x̂)²+d²)=${b0.hPred};实测 z=${Z} → 创新 y=z−h=${b0.innov}`,
      log: `**② 非线性观测模型**\n传感器测到地标的**距离**:z = h(x) = **√((L−x)² + d²)**——这就是非线性的地方。\n用预测位置算**预测测量**:h(x̂) = √((${L}−${xPred})² + ${D}²) = √(${(L - xPred) ** 2} + ${D * D}) = **${b0.hPred}**。\n**创新(innovation)** y = z − h(x̂) = ${Z} − ${b0.hPred} = **${b0.innov}**(实测比预测${innov > 0 ? '远' : '近'}——机器人可能比以为的更${innov > 0 ? '靠左(离地标更远)' : '靠右'})。` })

    push({
      stage: 'jacobian', showPred: true, showMeas: true, showJac: true, showUpd: false,
      focus: `EKF 精髓:雅可比 H=∂h/∂x=−(L−x̂)/h=${b0.H}(在估计点把非线性 h 就地线性化)`,
      log: `**③ 雅可比线性化(EKF 的精髓)**\n卡尔曼公式需要"测量对状态的线性灵敏度"。EKF 就在估计点 x̂ 求**观测函数的雅可比**:\n**H = ∂h/∂x = −(L−x)/√((L−x)²+d²) = −(L−x̂)/h(x̂)** = −(${L}−${xPred})/${b0.hPred} = **${b0.H}**。\n**H 的物理意义**:x 增大 1 单位、距离变多少。这里 H=${b0.H}(负)——机器人往右(x↑)会**离地标更近**(距离↓),所以斜率为负。就是这个雅可比把"非线性距离测量"翻译成"局部线性关系",让卡尔曼公式能用。` })

    push({
      stage: 'update', showPred: true, showMeas: true, showJac: true, showUpd: true,
      focus: `更新:S=H²P+R=${b0.S}、增益 K=PH/S=${b0.K}、x←x̂+Ky=${b0.xPost}、P←(1−KH)P=${b0.PPost}`,
      log: `**④ 更新(套线性卡尔曼、但用 H)**\n· 创新协方差 S = H²·P + R = ${b0.H}²×${PPred} + ${R} = **${b0.S}**;\n· 卡尔曼增益 **K = P·H / S** = ${PPred}×${b0.H} / ${b0.S} = **${b0.K}**;\n· 状态 **x ← x̂ + K·y** = ${xPred} + ${b0.K}×${b0.innov} = **${b0.xPost}**;\n· 方差 **P ← (1 − K·H)·P** = (1 − ${b0.K}×${b0.H})×${PPred} = **${b0.PPost}**(测量把不确定度从 ${PPred} 收到 ${b0.PPost})。\n${trust === 'tight' ? `信任测量(R 小)→ K 大、状态被拉得多、P 收得狠。` : `不信测量(R 大)→ K 小、状态几乎不动、P 收得少。`}` })

    push({
      stage: 'done', showPred: true, showMeas: true, showJac: true, showUpd: true, phase: 'done',
      focus: `收尾:EKF=在估计点雅可比线性化+卡尔曼;强非线性/线性化点差会崩→UKF/粒子滤波;连卡尔曼/雅可比`,
      log: `**小结:EKF = 雅可比线性化 + 卡尔曼**\n和线性卡尔曼唯一的不同:**在当前估计点对非线性的 f/h 求雅可比(F/H),把非线性就地线性化**,其余预测-更新公式照旧。\n· 预测:x̂←f(x̂,u)、P←F P Fᵀ+Q;· 更新:H=∂h/∂x、y=z−h(x̂)、S=HPHᵀ+R、K=PHᵀS⁻¹、x←x̂+Ky、P←(I−KH)P。\n**失效与替代(必考)**:EKF 只做**一阶**线性化,若**非线性很强**或**估计点离真值远**,线性化误差会让协方差失真、甚至发散 → 用 **UKF**(无迹变换、传一组 sigma 点、不求雅可比)或**粒子滤波**(采样、能表多峰/非高斯)。\n**连到别的课**:是「卡尔曼滤波」的非线性版(机器人定位/EKF-SLAM 的主力);求 H 用到「雅可比矩阵」的思想(函数对状态的偏导)。面试延伸:EKF vs UKF vs 粒子滤波;为何一阶线性化会发散;运动也非线性时要对 f 求 F;可观测性。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showPred: false, showMeas: false, showJac: false, showUpd: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'EKF 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
