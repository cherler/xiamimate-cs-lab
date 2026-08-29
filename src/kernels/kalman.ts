/**
 * 内核：卡尔曼滤波 · 1D 机器人定位真仿真 —— predict(里程计前进、不确定度涨) + update(GPS观测融合、不确定度缩)，增益按方差权衡（具身智能 · 机器人感知）
 * 轴：step —— 每步两拍：predict 用运动模型前推(方差 +Q)，update 用带噪观测校正(卡尔曼增益 K=P/(P+R) 融合、方差 (1−K)P)
 *
 * 机器人的每个传感器都有噪声:里程计会累计漂移、GPS 每次读数都在跳。卡尔曼滤波把"我根据运动预测的位置"和"传感器测的位置"
 * **按各自的不确定度(方差)最优融合**成一个更准的估计。这是状态估计/SLAM 的地基。1D 定位版就两拍循环:
 *   · **Predict(预测)**:用运动模型前推 x' = x + u(里程计走了 u),不确定度 **P' = P + Q**(推得越久越不确定,方差涨)。
 *   · **Update(校正)**:来一个带噪 GPS 观测 z(方差 R),算**卡尔曼增益 K = P'/(P'+R)**——它就是"信预测还是信观测"的权重:
 *     观测准(R 小)→K 大→多信观测;预测准(P' 小)→K 小→多信预测。新估计 x = x' + K·(z − x'),不确定度 **P = (1−K)·P'**(观测后更确定,方差缩)。
 * 融合后的估计**比单独的预测或单独的观测都准**,且方差每步 predict 涨、update 缩,收敛到稳态。
 * 本例 u=1、Q=0.5、R=1,喂 4 个 GPS 读数,看估计怎么贴着真值走、K 与方差怎么变。每步算术全真算、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r3 = (n: number) => Math.round(n * 1000) / 1000

type Hist = { step: number; truePos: number; x: number; sd: number; z: number }
export type KalmanState = {
  i: number
  step: number
  phase: 'intro' | 'predict' | 'update' | 'done'
  op: 'intro' | 'predict' | 'update' | 'summary'
  u: number
  Q: number
  R: number
  stepNo: number                    // 第几个观测步（0 = 开场）
  x: number                         // 当前估计（predict 后=预测值；update 后=融合值）
  P: number                         // 当前方差
  truePos: number
  z: number | null                  // 本步观测（update 帧）
  K: number | null                  // 卡尔曼增益（update 帧）
  innov: number | null              // 新息 z − x_pred
  xPred: number                     // 本步 predict 后的预测值（供 update 帧显示）
  history: Hist[]                   // 已完成 update 的点（画图用）
  focus: string
  log: string
}
type Frame = Omit<KalmanState, 'i'>

const U = 1, Q = 0.5, R = 1
const Z = [1.2, 1.8, 3.3, 3.9]      // 模拟 GPS 读数（外部传感器数据，噪声在真值 1,2,3,4 附近）

export const kalmanKernel: Kernel<KalmanState> = {
  kind: 'kalman',
  compile(_doc: SimDocument): CompiledModel<KalmanState> {
    const frames: Frame[] = []
    const snap = (h: Hist[]) => h.map(p => ({ ...p }))
    const push = (f: Omit<Frame, 'step' | 'u' | 'Q' | 'R'>) => frames.push({ step: frames.length, u: U, Q, R, ...f })

    let x = 0, P = 1, truePos = 0
    const history: Hist[] = []

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', stepNo: 0, x, P, truePos, z: null, K: null, innov: null, xPred: x, history: [],
      focus: '卡尔曼：把"运动预测"和"传感器观测"按各自不确定度最优融合',
      log: `**卡尔曼滤波：融合预测与观测**\n每个传感器都有噪声：里程计累计漂移、GPS 每次跳。卡尔曼把"运动预测的位置"和"观测到的位置"**按各自的不确定度(方差)最优融合**。两拍循环：\n· **Predict**：x'=x+u（里程计走 u），方差 **P'=P+Q**（越推越不确定、涨）。\n· **Update**：增益 **K=P'/(P'+R)** 权衡信预测还是信观测；x=x'+K(z−x')，方差 **P=(1−K)P'**（观测后更确定、缩）。\n初始 x=${x}、P=${P}；u=${U}、Q=${Q}、R=${R}。喂 4 个 GPS 读数看它怎么走。`,
    })

    Z.forEach((z, k) => {
      const stepNo = k + 1
      truePos += U
      // —— predict ——
      const xPred = r3(x + U)
      const Ppred = r3(P + Q)
      x = xPred; P = Ppred
      push({
        phase: 'predict', op: 'predict', stepNo, x, P, truePos, z: null, K: null, innov: null, xPred, history: snap(history),
        focus: `步 ${stepNo} · Predict：里程计前进 → x'=${xPred}，方差涨 P'=${Ppred}`,
        log: `**步 ${stepNo} · Predict（预测）**\n里程计说又走了 u=${U}：x' = ${r3(xPred - U)} + ${U} = **${xPred}**。\n但里程计有噪声、推得越久越不准 → 方差**涨**：P' = ${r3(Ppred - Q)} + Q(${Q}) = **${Ppred}**。\n（真值此刻在 ${truePos}。只靠预测会慢慢漂，所以需要观测来拉回。）`,
      })
      // —— update ——（此刻 xPred/Ppred 就是 predict 的结果）
      const K = r3(Ppred / (Ppred + R))
      const innov = r3(z - xPred)
      const xNew = r3(xPred + K * innov)
      const Pnew = r3((1 - K) * Ppred)
      x = xNew; P = Pnew
      history.push({ step: stepNo, truePos, x: xNew, sd: r3(Math.sqrt(Pnew)), z })
      const last = k === Z.length - 1
      push({
        phase: last ? 'done' : 'update', op: last ? 'summary' : 'update', stepNo, x, P, truePos, z, K, innov, xPred,
        history: snap(history),
        focus: `步 ${stepNo} · Update：K=${K} 融合观测 z=${z} → x=${xNew}，方差缩 P=${Pnew}`,
        log: last
          ? `**步 ${stepNo} · Update（校正）**\nGPS 观测 z=${z}（方差 R=${R}）。卡尔曼增益 **K = P'/(P'+R) = ${Ppred}/(${Ppred}+${R}) = ${K}**。新息 z−x' = ${z}−${xPred} = ${innov}。\n新估计 x = ${xPred} + ${K}·(${innov}) = **${xNew}**；方差 P = (1−${K})·${Ppred} = **${Pnew}**。\n\n**要点**：卡尔曼滤波把**预测**（运动模型，方差随 Q 涨）和**观测**（传感器，方差 R）用**增益 K=P/(P+R)** 最优融合——K 就是"信谁多一点"的权重：观测准(R 小)就多信观测、预测准(P 小)就多信预测。融合后的估计**比单独预测或单独观测都准**；方差每步 predict 涨、update 缩，收敛到稳态（本例 K→~0.5、P→~0.5）。估计一路贴着真值 ${truePos} 走（误差 ${r3(Math.abs(xNew - truePos))}）。这是机器人**状态估计**的地基：里程计+GPS/IMU 融合定位、EKF(非线性)、SLAM 都建在它上面。传感器越多、各自方差越准，融合越稳。`
          : `**步 ${stepNo} · Update（校正）**\nGPS 观测 z=**${z}**（方差 R=${R}）。算**卡尔曼增益** K = P'/(P'+R) = ${Ppred}/(${Ppred}+${R}) = **${K}**（K 越大越信观测）。\n新息（观测−预测）= ${z} − ${xPred} = **${innov}**。\n新估计 x = x' + K·新息 = ${xPred} + ${K}·(${innov}) = **${xNew}**。\n方差**缩**：P = (1−K)·P' = (1−${K})·${Ppred} = **${Pnew}**（观测后更确定了）。真值 ${truePos}，估计 ${xNew}，很贴。`,
      })
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, u: U, Q, R, stepNo: 0, x: 0, P: 1, truePos: 0, z: null, K: null, innov: null, xPred: 0, history: [], focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '滤波步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
