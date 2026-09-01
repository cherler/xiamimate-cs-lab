/**
 * 内核：粒子滤波 · 蒙特卡洛定位（MCL）—— 用一堆带权粒子表示信念，能表多峰/非高斯分布（EKF 线性化失效时的答案）（具身智能 · 机器人感知 / 面试八股）
 * 轴：step —— 引子(粒子表信念) → 预测(每粒子按运动+噪声动) → 加权(w∝似然 p(z|x)) → 归一+有效样本数 N_eff → 重采样(高权复制/低权淘汰) → 收尾(加权均值=估计)。
 *
 * 1D 定位:6 个粒子在 x 轴,机器人测得位置 z=5.5(σ=1.5)。①预测:粒子按运动模型+噪声散开 ②**加权**:每粒子权重 ∝ 观测似然 w_i=exp(−(z−x_i)²/(2σ²))
 * ③归一化 + **有效样本数 N_eff=1/Σw²**(权重集中到少数粒子→N_eff 掉→该重采样) ④**重采样**:系统(低方差)重采样,高权重粒子被复制、低权重被淘汰、权重重置均匀。
 * ⑤估计=加权均值。param 重采样开/关:开→粒子聚拢、可持续;关→权重退化(N_eff 越来越小、粒子浪费在低概率区)。全现算。连「卡尔曼滤波/EKF(它失效时用粒子)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Mode = 'on' | 'off'
export type Particle = { pos: number; w: number; wn: number }
export type PfState = {
  i: number
  step: number
  stage: 'intro' | 'predict' | 'weight' | 'neff' | 'resample' | 'done'
  mode: Mode
  modeLabel: string
  z: number; sigma: number
  particles: Particle[]
  sumW: number; neff: number; N: number
  resampled: number[]
  estimate: number; estimateResampled: number
  showWeight: boolean; showNeff: boolean; showResample: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PfState, 'i'>

const POS = [2, 4, 5, 6, 8, 9]
const Z = 5.5, SIGMA = 1.5
const r2 = (x: number) => Math.round(x * 100) / 100
const r3 = (x: number) => Math.round(x * 1000) / 1000

export const particlefilterKernel: Kernel<PfState> = {
  kind: 'particlefilter',
  compile(doc: SimDocument): CompiledModel<PfState> {
    const mode: Mode = String(doc.params?.resample ?? '重采样').includes('不') ? 'off' : 'on'
    const modeLabel = mode === 'on' ? '重采样(标准)' : '不重采样(看退化)'
    const N = POS.length

    const w = POS.map(p => Math.exp(-((Z - p) ** 2) / (2 * SIGMA * SIGMA)))
    const sumW = w.reduce((a, b) => a + b, 0)
    const wn = w.map(x => x / sumW)
    const neff = 1 / wn.reduce((a, b) => a + b * b, 0)
    const estimate = POS.reduce((a, p, k) => a + wn[k]! * p, 0)

    // 系统(低方差)重采样
    const cum: number[] = []
    wn.reduce((a, x, k) => (cum[k] = a + x, cum[k]!), 0)
    const resampled: number[] = []
    const u0 = 0.5 / N
    for (let m = 0; m < N; m++) {
      const u = u0 + m / N
      let k = 0
      while (k < N - 1 && u > cum[k]!) k++
      resampled.push(POS[k]!)
    }
    const estimateResampled = resampled.reduce((a, b) => a + b, 0) / N

    const particles: Particle[] = POS.map((p, k) => ({ pos: p, w: r3(w[k]!), wn: r3(wn[k]!) }))

    const frames: Frame[] = []
    const b0 = { mode, modeLabel, z: Z, sigma: SIGMA, particles, sumW: r2(sumW), neff: r2(neff), N, resampled, estimate: r2(estimate), estimateResampled: r2(estimateResampled), phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showWeight: boolean; showNeff: boolean; showResample: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showWeight: false, showNeff: false, showResample: false,
      focus: `粒子滤波:用一堆带权粒子表示信念,能表多峰/非高斯(EKF 线性化失效时的答案)。重采样：${modeLabel}`,
      log: `**粒子滤波(蒙特卡洛定位):用一堆样本表示信念**\nEKF 用一个高斯(均值+协方差)表示信念,强非线性/多峰时会崩。**粒子滤波**换个表示:用 **N 个带权重的粒子** {(x_i, w_i)} 近似任意分布——**多峰、非高斯都能表**(比如全局定位"我可能在走廊 A 也可能在走廊 B")。\n每步四件事:①预测(每粒子按运动+噪声动)②加权(w∝观测似然)③归一+看有效样本数 ④重采样。\n本例 1D 定位:**${N} 个粒子**在 x=[${POS}],机器人测得位置 **z=${Z}**(σ=${SIGMA})。重采样 **${modeLabel}**。` })

    push({
      stage: 'predict', showWeight: false, showNeff: false, showResample: false,
      focus: `预测:每个粒子按运动模型移动、并加过程噪声——粒子云散开(不确定度增长)`,
      log: `**① 预测(运动更新)**\n对**每一个**粒子,按运动模型移动、再加一点**过程噪声**:x_i ← f(x_i, u) + 噪声。\n效果:粒子云**散开**(不确定度增长)——和卡尔曼里 P←P+Q 一个意思,只是这里是"一群样本各自动、各自抖"。\n本例预测后粒子落在 x=[${POS}](已含噪声散布)。接下来用测量 z=${Z} 给它们打分。` })

    push({
      stage: 'weight', showWeight: true, showNeff: false, showResample: false,
      focus: `加权:每粒子权重 ∝ 观测似然 w_i=exp(−(z−x_i)²/(2σ²))——离测量越近权重越高`,
      log: `**② 加权(测量更新)**\n给每个粒子打分:权重 ∝ **观测似然 p(z | x_i)**。这里测量是位置、似然是高斯:\n**w_i = exp(−(z − x_i)² / (2σ²))**,σ=${SIGMA} → 2σ²=${2 * SIGMA * SIGMA}。\n${particles.map(p => `x=${p.pos}: w=${p.w}`).join('、')}。\n**离测量 z=${Z} 越近的粒子权重越高**(x=5、6 最高≈0.95;x=2、9 最低≈0.07)。这就是"用测量筛粒子"。` })

    push({
      stage: 'neff', showWeight: true, showNeff: true, showResample: false,
      focus: `归一化 + 有效样本数 N_eff=1/Σw²=${b0.neff}（${neff < N / 2 ? '< N/2、该重采样' : '尚可'}）`,
      log: `**③ 归一化 + 有效样本数 N_eff**\n把权重归一化(除以 Σw=${b0.sumW}):${particles.map(p => `${p.wn}`).join('、')}(和为 1)。\n**有效样本数 N_eff = 1 / Σw_i²= ${b0.neff}**(满值 N=${N})。它衡量"实际有多少粒子在起作用":权重越集中到少数粒子、N_eff 越小。\n**判据**:N_eff < N/2(=${N / 2})就该**重采样**——本例 N_eff=${b0.neff}${neff < N / 2 ? '、低于阈值 → 重采样' : '(接近阈值,标准做法仍重采样)'}。加权均值 = **${b0.estimate}**(当前估计)。` })

    push({
      stage: 'resample', showWeight: true, showNeff: true, showResample: true,
      focus: mode === 'on' ? `系统重采样:高权重粒子被复制、低权重淘汰 → 新粒子云=[${resampled}]、权重重置均匀` : `不重采样:权重继续退化(N_eff 越来越小、粒子浪费在低概率区)`,
      log: `**④ 重采样(适者生存)**\n${mode === 'on'
        ? `**系统(低方差)重采样**:按归一化权重的累积分布、用 N 个等间距指针抽 N 个新粒子——**高权重的被复制多份、低权重的被淘汰**。\n结果:x=2、9(低权)死掉,x=5、6(高权)各被复制,新粒子云 = **[${resampled}]**、权重全部**重置为 1/N**。\n这样粒子就**聚拢到高概率区**、下一步继续用;重采样后估计(等权均值)=${b0.estimateResampled}。`
        : `**本次不重采样**:保留带权粒子。问题是——迭代几步后,**权重会全集中到极少数粒子**(其余权重趋近 0、N_eff→1),等于用几百个粒子只干了 1 个粒子的活,**粒子退化(degeneracy)**、低概率区白白浪费采样。这就是为什么标准粒子滤波**必须重采样**。当前 N_eff 已经从 ${N} 掉到 ${b0.neff}。`}` })

    push({
      stage: 'done', showWeight: true, showNeff: true, showResample: true, phase: 'done',
      focus: `收尾:粒子滤波=预测+加权+重采样;估计=加权均值 ${b0.estimate};表多峰/非高斯,EKF 失效时的答案`,
      log: `**小结:粒子滤波 = 一群样本近似任意分布**\n① **预测**:每粒子按运动+噪声动;② **加权**:w∝观测似然 p(z|x_i);③ **归一 + N_eff=1/Σw²**:低于 N/2 就重采样;④ **重采样**:高权复制、低权淘汰、权重重置均匀(治退化)。\n**估计** = 加权均值 = **${b0.estimate}**(或重采样后等权均值 ${b0.estimateResampled})。\n**vs 卡尔曼/EKF**:KF/EKF 用**一个高斯**、快但只能单峰;粒子滤波用**一堆样本**、能表**多峰/非高斯**(全局定位、绑架问题)、但**粒子数多才准、慢**,且**退化/贫化**要靠重采样和噪声缓解。\n**连到别的课**:是「卡尔曼滤波」的采样式替代、「EKF」强非线性失效时的答案;蒙特卡洛定位(MCL)就是它。面试延伸:为何要重采样(治退化);N_eff 判据;粒子贫化(sample impoverishment)与对策;KF/EKF/UKF/PF 怎么选。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showWeight: false, showNeff: false, showResample: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '粒子滤波步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
