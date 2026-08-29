/**
 * 内核：ICP 点云配准 · 迭代最近点真仿真 —— 两片点云靠"找最近点对应 → 算最佳刚体变换 → 迭代"对齐（具身智能 · 机器人感知）
 * 轴：step —— 每轮：给源点云每个点找目标里最近的点当对应，用这些点对算出最佳旋转+平移(2D Kabsch)，把源点云搬过去，误差逐轮缩小
 *
 * 激光雷达/深度相机每帧拿到一片点云,要知道机器人动了多少 → 把这帧点云和上一帧**对齐**,对齐用的刚体变换就是位姿变化。
 * **ICP(迭代最近点)** 是点云配准最经典的算法,也是激光 SLAM 的前端。它不知道点的真实对应,就**猜+迭代**:
 *   ① **找对应**:源点云每个点,在目标点云里找**欧氏最近**的点当它的对应(一开始会猜错几个);
 *   ② **求变换**:用这批点对算**最佳刚体变换**(旋转+平移)——2D 用 Kabsch:去质心、由交叉协方差算旋转角、平移对齐质心;
 *   ③ **搬过去**:把变换作用到源点云;④ 回到 ①,重来。对应越来越准、误差(点对平均距离)越来越小,直到收敛。
 * 本例源是 5 个点的不对称形状,目标=把它绕质心转 25°、平移 (0.6,0.3)。ICP 从猜错的对应开始,4 轮把误差从 0.72 收到 ~0、
 * 还原出 25° 的旋转。对应/旋转角/误差每轮全真算、可手核。ICP 概率上很好用但**依赖初值**(初始差太多会陷局部最优),所以常配一个粗对齐。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => Math.round((r * 180) / Math.PI * 100) / 100
type Pt = [number, number]

export type ICPState = {
  i: number
  step: number
  phase: 'intro' | 'iterate' | 'done'
  op: 'intro' | 'iter' | 'summary'
  target: Pt[]
  cur: Pt[]                 // 当前源点云位置
  corr: number[]            // cur[i] 对应 target[corr[i]]
  iterNo: number
  iterRot: number           // 本轮旋转（度）
  cumRot: number            // 累计旋转
  error: number             // 点对平均距离
  trueRot: number
  focus: string
  log: string
}
type Frame = Omit<ICPState, 'i'>

const SRC: Pt[] = [[0, 0], [2, 0], [3, 0], [3, 1.5], [1, 2.5]]
const TRUE_ROT = 25, TX = 0.6, TY = 0.3
const CEN: Pt = [SRC.reduce((a, p) => a + p[0], 0) / SRC.length, SRC.reduce((a, p) => a + p[1], 0) / SRC.length]
const rotC = (p: Pt, d: number): Pt => { const dx = p[0] - CEN[0], dy = p[1] - CEN[1], c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [r2(CEN[0] + c * dx - s * dy), r2(CEN[1] + s * dx + c * dy)] }
const TARGET: Pt[] = SRC.map(p => { const r = rotC(p, TRUE_ROT); return [r2(r[0] + TX), r2(r[1] + TY)] as Pt })

const nearest = (p: Pt): number => { let bi = 0, bd = 1e9; TARGET.forEach((t, i) => { const d = Math.hypot(p[0] - t[0], p[1] - t[1]); if (d < bd) { bd = d; bi = i } }); return bi }
const meanErr = (pts: Pt[], corr: number[]): number => r2(pts.reduce((a, p, i) => a + Math.hypot(p[0] - TARGET[corr[i]!]![0], p[1] - TARGET[corr[i]!]![1]), 0) / pts.length)

export const icpKernel: Kernel<ICPState> = {
  kind: 'icp',
  compile(_doc: SimDocument): CompiledModel<ICPState> {
    const frames: Frame[] = []
    const snap = (p: Pt[]) => p.map(x => [...x] as Pt)
    const push = (f: Omit<Frame, 'step' | 'target' | 'trueRot'>) => frames.push({ step: frames.length, target: TARGET, trueRot: TRUE_ROT, ...f })

    let cur: Pt[] = snap(SRC)
    let cumRot = 0
    const corr0 = cur.map(nearest)

    push({
      phase: 'intro', op: 'intro', cur: snap(cur), corr: corr0, iterNo: 0, iterRot: 0, cumRot: 0, error: meanErr(cur, corr0),
      focus: 'ICP：找最近点对应 → 算最佳刚体变换 → 迭代对齐两片点云',
      log: `**ICP 点云配准：把两帧对齐**\n激光雷达每帧一片点云，把这帧和上一帧**对齐**、对齐用的刚体变换就是机器人的位姿变化（激光 SLAM 前端）。\nICP 不知道点的真实对应，就**猜+迭代**：\n① 每个源点找目标里**最近的点**当对应；② 用点对算**最佳旋转+平移**(Kabsch)；③ 搬过去；④ 重来。\n源是 5 点的形状，目标=转 **${TRUE_ROT}°**+平移。初始误差 ${meanErr(cur, corr0)}。看它几轮收敛。`,
    })

    for (let it = 1; it <= 4; it++) {
      const corr = cur.map(nearest)                       // ① 找对应
      const pairs = cur.map((p, i) => [p, TARGET[corr[i]!]!] as [Pt, Pt])
      const cs: Pt = [cur.reduce((a, p) => a + p[0], 0) / cur.length, cur.reduce((a, p) => a + p[1], 0) / cur.length]
      const ct: Pt = [pairs.reduce((a, pr) => a + pr[1][0], 0) / pairs.length, pairs.reduce((a, pr) => a + pr[1][1], 0) / pairs.length]
      let Sxx = 0, Sxy = 0
      pairs.forEach(([p, t]) => { const sx = p[0] - cs[0], sy = p[1] - cs[1], tx = t[0] - ct[0], ty = t[1] - ct[1]; Sxx += sx * tx + sy * ty; Sxy += sx * ty - sy * tx })
      const dth = Math.atan2(Sxy, Sxx)                    // ② 最佳旋转
      const c = Math.cos(dth), s = Math.sin(dth)
      cur = cur.map(p => { const dx = p[0] - cs[0], dy = p[1] - cs[1]; return [r2(ct[0] + c * dx - s * dy), r2(ct[1] + s * dx + c * dy)] as Pt })  // ③ 搬过去
      cumRot = r2(cumRot + deg(dth))
      const newCorr = cur.map(nearest)
      const err = meanErr(cur, newCorr)
      const nWrong = corr.filter((cc, i) => cc !== i).length
      const last = it === 4
      push({
        phase: last ? 'done' : 'iterate', op: last ? 'summary' : 'iter', cur: snap(cur), corr: newCorr, iterNo: it,
        iterRot: deg(dth), cumRot, error: err,
        focus: `第 ${it} 轮：找对应(${nWrong} 个先猜错)→算旋转 ${deg(dth)}°→搬过去，误差 ${err}`,
        log: last
          ? `**第 ${it} 轮 → 收敛**\n对应已全部正确，本轮再微调旋转 ${deg(dth)}°，累计旋转 **${cumRot}°**（真值 ${TRUE_ROT}°）、误差降到 **${err}**（≈0，两片点云基本重合）。\n\n**要点**：ICP 把"不知道点怎么对应"这个难题拆成两步反复迭代——**猜最近点当对应** + **用点对求最佳刚体变换(Kabsch/SVD)**，对应和变换互相改进、误差单调下降。它是激光 SLAM 前端、深度相机重建、抓取里物体位姿估计的核心。局限：**依赖初值**（初始差太大→最近点对应全错→陷局部最优，本例前几轮就有点对应错、但没错到收不回来），所以实际常先用粗配准(特征匹配/IMU 里程计给初值)再上 ICP 精配；还有点面 ICP、Generalized-ICP、对离群点加鲁棒核。配前面的四元数/位姿表示这个变换、配卡尔曼把多帧融合，就是机器人定位建图的一条链。`
          : `**第 ${it} 轮**\n① 找对应：每个源点找最近目标点${nWrong > 0 ? `（有 ${nWrong} 个先猜错了——初始没对齐）` : '（都对上了）'}。\n② 求变换：去质心、由交叉协方差算最佳旋转 = **${deg(dth)}°**（累计 ${cumRot}°）。\n③ 搬过去：源点云整体转过去、误差从上一轮降到 **${err}**。对应会随之更准，下一轮接着修。`,
      })
    }

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, target: TARGET, trueRot: TRUE_ROT, cur: snap(SRC), corr: corr0, iterNo: 0, iterRot: 0, cumRot: 0, error: meanErr(SRC, corr0), focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'ICP 轮' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
