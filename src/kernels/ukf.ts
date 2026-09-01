/**
 * 内核：无迹卡尔曼滤波 UKF —— 不求雅可比，挑一组 sigma 点过真非线性函数、再拟合高斯（「近似分布比近似函数容易」）（具身智能 · 机器人感知 / 面试八股）
 * 轴：step —— 引子(不线性化) → 取 sigma 点(2n+1 个) → 过真非线性 h(每个 sigma 点) → 重组(预测测量均值/协方差/互协方差) → 更新(增益/融合、对比 EKF) → 收尾。
 *
 * 和「EKF」同一个问题(1D 位置、地标(10,5)、非线性距离 h(x)=√((10−x)²+25)、z=8、R=0.25),好直接对比。EKF 在估计点求雅可比线性化;**UKF 换思路**:
 *   ① 取 **2n+1 个 sigma 点**:X₀=μ、X₁,₂=μ±√((n+λ)P)(围绕均值、按协方差铺开);② **每个 sigma 点过真非线性 h**(不求导!);
 *   ③ 用权重 Wm/Wc **重组**出预测测量均值 ẑ=ΣWm·h(Xᵢ)、协方差 S、状态-测量互协方差 Pxz;④ 更新 K=Pxz/S、x←x̂+K(z−ẑ)、P←P−K S K。
 * param 先验不确定 P:P 小 → sigma 点靠得近、UKF≈EKF;P 大 → 铺得开、捕捉曲率、和 EKF 分道(UKF 对高斯到三阶精确)。sigma/变换/重组全现算,并对拍 EKF。连「EKF/卡尔曼/粒子滤波」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Unc = 'big' | 'small'
export type Sigma = { x: number; h: number; wm: number; wc: number }
export type UkfState = {
  i: number
  step: number
  stage: 'intro' | 'sigma' | 'transform' | 'recombine' | 'update' | 'done'
  unc: Unc
  uncLabel: string
  xPred: number; P: number; L: number; d: number; z: number; R: number
  lambda: number; sqrtTerm: number
  sigmas: Sigma[]
  zPred: number; S: number; Pxz: number
  K: number; xPost: number; PPost: number
  xEkf: number; PEkf: number     // EKF 对拍
  showSigma: boolean; showTrans: boolean; showRecomb: boolean; showUpd: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<UkfState, 'i'>

const XPRED = 5, L = 10, D = 5, Z = 8.0, R = 0.25
const ALPHA = 1, BETA = 0, KAPPA = 2, N = 1
const r2 = (x: number) => Math.round(x * 100) / 100
const r3 = (x: number) => Math.round(x * 1000) / 1000
const h = (x: number) => Math.sqrt((L - x) ** 2 + D * D)

export const ukfKernel: Kernel<UkfState> = {
  kind: 'ukf',
  compile(doc: SimDocument): CompiledModel<UkfState> {
    const unc: Unc = String(doc.params?.unc ?? '不确定大').includes('小') ? 'small' : 'big'
    const uncLabel = unc === 'big' ? '不确定大(P=5)' : '不确定小(P=1)'
    const P = unc === 'big' ? 5 : 1

    const lambda = ALPHA * ALPHA * (N + KAPPA) - N
    const nl = N + lambda
    const sqrtTerm = Math.sqrt(nl * P)
    const xs = [XPRED, XPRED + sqrtTerm, XPRED - sqrtTerm]
    const wm = [lambda / nl, 1 / (2 * nl), 1 / (2 * nl)]
    const wc = [lambda / nl + (1 - ALPHA * ALPHA + BETA), 1 / (2 * nl), 1 / (2 * nl)]
    const hs = xs.map(h)
    const zPred = xs.reduce((a, _, k) => a + wm[k]! * hs[k]!, 0)
    const S = xs.reduce((a, _, k) => a + wc[k]! * (hs[k]! - zPred) ** 2, 0) + R
    const Pxz = xs.reduce((a, x, k) => a + wc[k]! * (x - XPRED) * (hs[k]! - zPred), 0)
    const K = Pxz / S
    const xPost = XPRED + K * (Z - zPred)
    const PPost = P - K * S * K

    // EKF 对拍
    const H = -(L - XPRED) / h(XPRED)
    const Sekf = H * H * P + R
    const Kekf = P * H / Sekf
    const xEkf = XPRED + Kekf * (Z - h(XPRED))
    const PEkf = (1 - Kekf * H) * P

    const sigmas: Sigma[] = xs.map((x, k) => ({ x: r2(x), h: r3(hs[k]!), wm: r3(wm[k]!), wc: r3(wc[k]!) }))

    const frames: Frame[] = []
    const b0 = {
      unc, uncLabel, xPred: XPRED, P, L, d: D, z: Z, R, lambda, sqrtTerm: r3(sqrtTerm), sigmas,
      zPred: r3(zPred), S: r3(S), Pxz: r3(Pxz), K: r3(K), xPost: r2(xPost), PPost: r2(PPost), xEkf: r2(xEkf), PEkf: r2(PEkf), phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showSigma: boolean; showTrans: boolean; showRecomb: boolean; showUpd: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showSigma: false, showTrans: false, showRecomb: false, showUpd: false,
      focus: `UKF:不求雅可比,挑一组 sigma 点过真非线性函数再拟合高斯(近似分布比近似函数容易)。先验：${uncLabel}`,
      log: `**UKF:不线性化,用 sigma 点"探"非线性**\n「EKF」的做法是在估计点求**雅可比**、把非线性函数线性化——要算导数,强非线性/协方差大时误差大。\n**UKF 换思路(无迹变换)**:与其近似那个非线性函数,不如**近似分布**——挑一小组有代表性的点(**sigma 点**),让它们**原样穿过真的非线性函数**,再从穿过去的点**重新拟合出均值和协方差**。名言:*"近似一个概率分布,比近似一个任意非线性函数容易。"*\n和 EKF 同一个问题好对比:1D 位置、地标(${L},${D})、非线性距离 h(x)=√((${L}−x)²+${D}²)、预测 x̂=${XPRED}、测量 z=${Z}、先验 **${uncLabel}**。` })

    push({
      stage: 'sigma', showSigma: true, showTrans: false, showRecomb: false, showUpd: false,
      focus: `取 2n+1=3 个 sigma 点:X₀=μ=${XPRED}、X₁,₂=μ±√((n+λ)P)=${XPRED}±${b0.sqrtTerm}`,
      log: `**① 取 sigma 点(2n+1 个)**\nn=${N} 维状态 → **2n+1=3** 个 sigma 点,围绕均值、按协方差铺开:\n· X₀ = μ = **${XPRED}**;· X₁ = μ + √((n+λ)P) = ${XPRED}+${b0.sqrtTerm} = **${sigmas[1]!.x}**;· X₂ = μ − √((n+λ)P) = **${sigmas[2]!.x}**。\n(λ=α²(n+κ)−n=${lambda},控制铺开的范围。)权重:中心 Wm₀=λ/(n+λ)=${sigmas[0]!.wm}、两侧各 ${sigmas[1]!.wm}。**${unc === 'big' ? 'P 大 → sigma 点铺得开(±' + b0.sqrtTerm + ')、能探到 h 的曲率' : 'P 小 → sigma 点靠得近(±' + b0.sqrtTerm + ')、局部近似线性'}**。` })

    push({
      stage: 'transform', showSigma: true, showTrans: true, showRecomb: false, showUpd: false,
      focus: `每个 sigma 点过真非线性 h(不求导!):${sigmas.map(s => `h(${s.x})=${s.h}`).join('、')}`,
      log: `**② 每个 sigma 点穿过真非线性 h**\n直接把 3 个点代进真的 h(x)=√((L−x)²+d²)——**不求任何导数**:\n· h(X₀=${sigmas[0]!.x}) = **${sigmas[0]!.h}**;· h(X₁=${sigmas[1]!.x}) = **${sigmas[1]!.h}**;· h(X₂=${sigmas[2]!.x}) = **${sigmas[2]!.h}**。\n这是 UKF 和 EKF 最大的不同:EKF 用一条切线(雅可比)近似整个 h;UKF **让点真的走一遍 h**、把非线性的弯曲也带上。` })

    push({
      stage: 'recombine', showSigma: true, showTrans: true, showRecomb: true, showUpd: false,
      focus: `重组:预测测量 ẑ=ΣWm·h(Xᵢ)=${b0.zPred}、协方差 S=${b0.S}、互协方差 Pxz=${b0.Pxz}`,
      log: `**③ 从穿过去的点重组高斯**\n· **预测测量均值** ẑ = Σ Wmᵢ·h(Xᵢ) = **${b0.zPred}**(注意 ≠ EKF 的 h(x̂)=${r3(h(XPRED))}——UKF 的 ẑ 把曲率算进来了);\n· **测量协方差** S = Σ Wcᵢ·(h(Xᵢ)−ẑ)² + R = **${b0.S}**;\n· **状态-测量互协方差** Pxz = Σ Wcᵢ·(Xᵢ−x̂)·(h(Xᵢ)−ẑ) = **${b0.Pxz}**(它替代了 EKF 里的 P·H)。\n(β=${BETA} 简化;β=2 对高斯最优、会给中心点的 Wc₀ 加一项。)` })

    push({
      stage: 'update', showSigma: true, showTrans: true, showRecomb: true, showUpd: true,
      focus: `更新:K=Pxz/S=${b0.K}、x←x̂+K(z−ẑ)=${b0.xPost}、P←P−K S K=${b0.PPost}；对比 EKF x=${b0.xEkf}`,
      log: `**④ 更新(卡尔曼式、但用 sigma 点算的量)**\n· 增益 **K = Pxz / S** = ${b0.Pxz}/${b0.S} = **${b0.K}**;\n· 状态 **x ← x̂ + K·(z−ẑ)** = ${XPRED}+${b0.K}×(${Z}−${b0.zPred}) = **${b0.xPost}**;\n· 协方差 **P ← P − K·S·K** = ${P}−${b0.K}²×${b0.S} = **${b0.PPost}**。\n**对比 EKF(同一问题)**:EKF 得 x=**${b0.xEkf}**、P=**${b0.PEkf}**;UKF 得 x=**${b0.xPost}**、P=**${b0.PPost}**。\n${unc === 'big' ? '**先验 P 大 → 两者分道**:sigma 点铺得开、UKF 把 h 的曲率算进来,结果和 EKF 的一阶线性化明显不同。' : '**先验 P 小 → 两者几乎一样**:sigma 点靠得近、这段 h 近似线性,UKF≈EKF。这说明 UKF 的优势在"不确定大/非线性强"时才显现。'}` })

    push({
      stage: 'done', showSigma: true, showTrans: true, showRecomb: true, showUpd: true, phase: 'done',
      focus: `收尾:UKF 用 sigma 点过真非线性、不求雅可比;比 EKF 准(高斯到三阶)、无需求导;连 EKF/卡尔曼/粒子滤波`,
      log: `**小结:UKF = 无迹变换 + 卡尔曼**\n① **取 2n+1 个 sigma 点**(按均值/协方差确定性地铺);② **每点过真非线性 f/h**(不求导);③ **重组**均值/协方差/互协方差;④ **卡尔曼式更新**(K=Pxz/S)。\n**vs EKF**:EKF 用一条切线(雅可比一阶)近似;UKF 让点真的走一遍非线性、**捕捉到二阶曲率**(对高斯**到三阶精确**),而且**不用推导雅可比**(函数复杂/不可导时尤其省事)。代价是每步要过 2n+1 个点(略贵)。\n**vs 粒子滤波**:UKF 还是**单个高斯**(单峰);粒子滤波用一堆样本能表**多峰/非高斯**。滤波家族选型:线性→KF;弱非线性/要快→EKF;强非线性/难求导→UKF;多峰/非高斯→粒子滤波。\n**连到别的课**:是「EKF」的免雅可比升级、「卡尔曼滤波」的非线性版、和「粒子滤波」同属贝叶斯滤波家族。面试延伸:sigma 点怎么取(α/β/κ)、无迹变换为何三阶精确、UKF vs EKF vs PF 怎么选、为何叫"无迹(unscented)"。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showSigma: false, showTrans: false, showRecomb: false, showUpd: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'UKF 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
