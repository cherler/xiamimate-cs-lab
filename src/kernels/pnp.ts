/**
 * 内核：6D 位姿估计 · PnP(Perspective-n-Point) —— 已知物体 3D 点 + 它们的 2D 像素 + 内参 K,求相机/物体的 6 自由度位姿(具身智能 · 机器人感知 / 面试八股)
 * 轴：step —— 引子(2D-3D+K→6D位姿) → 用真位姿投影得到"观测像素" → 换一个错位姿重投影(残差>0) → 重投影误差随位姿变化(landscape、真值处最小) → 解出位姿(误差归零) → 收尾。
 *
 * PnP:已知 **n 个 3D 点**(物体 CAD 模型的角点、或 SLAM 地图点)在物体系的坐标,又在图像里检测到它们的 **2D 像素**,加上**已标定的内参 K**,求相机相对物体的 **6 自由度位姿 (R,t)**。
 *   本质是**最小化重投影误差**:找 (R,t) 让每个 3D 点按 u=K[R|t]X 投影后,尽量落在观测到的像素上(Σ‖投影−观测‖² 最小)。真位姿处误差=0,位姿越偏残差越大。
 *   解法:**P3P**(3 点最小情形、给 4 组候选、第 4 点消歧)、**DLT/线性 PnP**(≥6 点线性解)、**EPnP**(O(n)、把点表成 4 个控制点)、再用**高斯-牛顿迭代**最小化重投影误差精修。
 * 本例 4 个 3D 点(方底 + 一个顶点)、K:fx=fy=500 cx=cy=320,真位姿 R=I、t=[0,0,5] 投出观测像素 [(270,270),(370,270),(370,370),(320,320)];
 * 换一个偏了的位姿(param:平移 tz+0.6 或 偏航+8°),重投影就偏离观测、每点有像素残差;沿该自由度扫一遍,重投影误差在**真值处最小(=0)**——这正是 PnP 要解的。全用投影现算。连「针孔(投影)/VO(地图点来源)/双目/ICP」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type V3 = [number, number, number]
type V2 = [number, number]
type Sc = 'trans' | 'rot'
export type PnpState = {
  i: number
  step: number
  stage: 'intro' | 'observe' | 'reproject' | 'landscape' | 'solve' | 'done'
  scen: Sc
  scenLabel: string
  fx: number; cx: number
  pts3d: V3[]
  obs: V2[]                       // 真位姿投出的观测像素
  curLabel: string               // 当前(偏)位姿描述
  reproj: V2[]                    // 当前偏位姿的重投影
  resid: number[]                // 每点像素残差
  rmsCur: number                 // 当前偏位姿 RMS 重投影误差
  curve: { x: number; rms: number }[]  // 沿该自由度扫描的误差曲线
  trueVal: number; curVal: number      // 真值 / 当前偏值(param 单位:m 或 °)
  unit: string
  showObs: boolean; showReproj: boolean; showCurve: boolean; showSolved: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PnpState, 'i'>

const FX = 500, CX = 320
const PTS: V3[] = [[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [0, 0, 0.6]]
const R0 = 5  // 真值 tz
const Ry = (deg: number): number[][] => { const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return [[c, 0, s], [0, 1, 0], [-s, 0, c]] }
const mv = (A: number[][], v: V3): V3 => A.map(r => r[0]! * v[0] + r[1]! * v[1] + r[2]! * v[2]) as V3
const r2 = (x: number) => Math.round(x * 100) / 100
const r0 = (x: number) => Math.round(x)

// 投影：X_cam = R·X + t，u=fx·Xx/Xz+cx
function project(X: V3, R: number[][], t: V3): V2 { const Xc = mv(R, X); const cx = Xc[0] + t[0], cy = Xc[1] + t[1], cz = Xc[2] + t[2]; return [FX * cx / cz + CX, FX * cy / cz + CX] }
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

export const pnpKernel: Kernel<PnpState> = {
  kind: 'pnp',
  compile(doc: SimDocument): CompiledModel<PnpState> {
    const scen: Sc = String(doc.params?.dof ?? '平移').includes('旋') || String(doc.params?.dof ?? '').includes('偏航') ? 'rot' : 'trans'
    const scenLabel = scen === 'trans' ? '平移偏移(tz)' : '旋转偏移(偏航)'
    const unit = scen === 'trans' ? 'm' : '°'

    // 真位姿：R=I, t=[0,0,5] → 观测像素
    const tTrue: V3 = [0, 0, R0]
    const obs = PTS.map(X => { const p = project(X, I3, tTrue); return [r0(p[0]), r0(p[1])] as V2 })

    // 位姿(val)：trans→R=I,t=[0,0,val]；rot→R=Ry(val),t=[0,0,5]
    const poseAt = (val: number): { R: number[][]; t: V3 } => scen === 'trans' ? { R: I3, t: [0, 0, val] } : { R: Ry(val), t: [0, 0, R0] }
    const rmsAt = (val: number): number => { const { R, t } = poseAt(val); let s = 0; for (let k = 0; k < PTS.length; k++) { const p = project(PTS[k]!, R, t); s += (p[0] - obs[k]![0]) ** 2 + (p[1] - obs[k]![1]) ** 2 } return Math.sqrt(s / PTS.length) }

    const trueVal = scen === 'trans' ? R0 : 0
    const curVal = scen === 'trans' ? R0 + 0.6 : 8
    const { R: Rc, t: tc } = poseAt(curVal)
    const reproj = PTS.map(X => { const p = project(X, Rc, tc); return [r0(p[0]), r0(p[1])] as V2 })
    const resid = PTS.map((X, k) => { const p = project(X, Rc, tc); return r2(Math.hypot(p[0] - obs[k]![0], p[1] - obs[k]![1])) })
    const rmsCur = r2(rmsAt(curVal))

    // 误差曲线
    const lo = scen === 'trans' ? 4 : -14, hi = scen === 'trans' ? 6.4 : 14, steps = scen === 'trans' ? 13 : 15
    const curve = Array.from({ length: steps }, (_, k) => { const x = lo + (hi - lo) * k / (steps - 1); return { x: r2(x), rms: r2(rmsAt(x)) } })

    const frames: Frame[] = []
    const b0 = { scen, scenLabel, fx: FX, cx: CX, pts3d: PTS, obs, curLabel: scen === 'trans' ? `tz=${curVal}(真值 ${R0})` : `偏航=${curVal}°(真值 0°)`, reproj, resid, rmsCur, curve, trueVal, curVal, unit, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showObs: boolean; showReproj: boolean; showCurve: boolean; showSolved: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showObs: false, showReproj: false, showCurve: false, showSolved: false,
      focus: `PnP:已知 3D 点 + 它们的 2D 像素 + 内参 K,求相机相对物体的 6 自由度位姿。偏移自由度：${scenLabel}`,
      log: `**PnP:从"3D 点 + 它们的 2D 像素"求相机 6 自由度位姿**\nPnP(Perspective-n-Point)要解的是:已知 **n 个 3D 点**在物体系的坐标(物体 CAD 模型的角点、或 SLAM 地图点)、又在图像里检测到它们对应的 **2D 像素**、加上**标定好的内参 K**,求相机相对物体的 **6 自由度位姿 (R, t)**(3 旋转 + 3 平移)。\n**用途**:机械臂抓取(相机看到物体、求它的 6D 位姿才能规划抓)、相机在已知地图里**重定位**(接「VO/SLAM」)、AR 标记跟踪。\n本例 4 个 3D 点(方底 + 一个凸起的顶点)、K:fx=fy=${FX}、cx=cy=${CX}。下面:先用真位姿投出"观测像素",再看 PnP 怎么把位姿找回来。` })

    push({
      stage: 'observe', showObs: true, showReproj: false, showCurve: false, showSolved: false,
      focus: `真位姿 R=I、t=[0,0,${R0}] 把 4 个 3D 点投到观测像素:${obs.map(o => `(${o})`).join('、')}`,
      log: `**① 观测:3D 点 → 2D 像素(真位姿投影)**\n真实位姿是 R=I、t=[0,0,${R0}](物体在相机正前方 ${R0}m)。按针孔投影 **u=K[R|t]X** 把 4 个 3D 点投到图像,得到**观测像素**:\n· A=(${PTS[0]}) → (${obs[0]})\n· B=(${PTS[1]}) → (${obs[1]})\n· C=(${PTS[2]}) → (${obs[2]})\n· D=(${PTS[3]}) → (${obs[3]})(顶点凸向相机、投到图心)\n**PnP 的输入就是这些 3D↔2D 对应 + K**;它不知道真位姿,要从这些对应把 (R,t) 反解出来。` })

    push({
      stage: 'reproject', showObs: true, showReproj: true, showCurve: false, showSolved: false,
      focus: `换一个偏位姿(${b0.curLabel})重投影 → 每点偏离观测、残差 [${resid.join(', ')}]px、RMS=${rmsCur}px`,
      log: `**② 重投影误差:位姿不对,投影就对不上**\nPnP 的核心思想:**找让"3D 点投影"尽量落在"观测像素"上的位姿**。先随便试一个**偏了的位姿**(${b0.curLabel}),把 3D 点按它重投影:\n· 每点的**重投影残差**(投影与观测的像素距离):[${resid.join(', ')}] px;\n· 总的 **RMS 重投影误差 = ${rmsCur} px**(>0,说明这个位姿不对)。\n**PnP = 找 (R,t) 让 Σ‖投影(X;R,t) − 观测‖² 最小**(重投影误差最小化)。真位姿处这个误差=0。` })

    const minPt = curve.reduce((m, p) => (p.rms < m.rms ? p : m), curve[0]!)
    push({
      stage: 'landscape', showObs: true, showReproj: true, showCurve: true, showSolved: false,
      focus: `沿${scenLabel}扫一遍,重投影误差在真值 ${trueVal}${unit} 处最小(≈0);这就是 PnP 优化的目标`,
      log: `**③ 重投影误差的地形(landscape)**\n把这个自由度(${scenLabel})从 ${lo}${unit} 扫到 ${hi}${unit},每个值算一次 RMS 重投影误差:\n误差曲线是个**碗形**,**最低点恰好在真值 ${trueVal}${unit} 处、误差≈0**(本例扫描最小点 ${minPt.x}${unit}→${minPt.rms}px)、偏离真值越远误差越大。\n**这就是 PnP 要解的优化问题**:在 6 维位姿空间里找这个碗的最低点。真实是 6 自由度、这里只画其中一维直观展示。` })

    push({
      stage: 'solve', showObs: true, showReproj: false, showCurve: true, showSolved: true,
      focus: `解到真值 ${trueVal}${unit}:重投影残差全归零、投影严丝合缝盖住观测;方法 P3P/DLT/EPnP+高斯牛顿`,
      log: `**④ 解出位姿:重投影误差归零**\n把位姿解到真值(${scen === 'trans' ? `tz=${R0}` : '偏航=0°'}),4 个点的重投影**严丝合缝盖住观测像素、残差全为 0** —— 位姿找到了。\n**怎么解**(不是暴力扫):\n· **P3P**:3 个点是最小情形,几何上给出 **4 组候选位姿**,用**第 4 个点**投影一致来消歧;\n· **DLT / 线性 PnP**:≥6 点,把 u=K[R|t]X 排成线性方程组、SVD 求解(简单但对噪声敏感);\n· **EPnP**:把每个点表成 4 个控制点的组合、O(n) 高效,是 OpenCV solvePnP 常用;\n· 最后用**高斯-牛顿 / LM 迭代**最小化重投影误差**精修**(RANSAC 去外点)。` })

    push({
      stage: 'done', showObs: true, showReproj: false, showCurve: true, showSolved: true, phase: 'done',
      focus: `PnP:2D-3D+K→6D位姿,最小化重投影误差;P3P/DLT/EPnP+GN;连针孔/VO/SLAM/抓取`,
      log: `**小结:PnP = 2D-3D 对应 + K → 6D 位姿**\n· **输入**:n 个 3D 点(模型/地图)、它们的 2D 像素、内参 K;**输出**:相机相对物体的 6 自由度位姿 (R,t);\n· **准则**:**最小化重投影误差** Σ‖K[R|t]X − 观测‖²(真位姿处=0、位姿越偏残差越大);\n· **解法**:P3P(3 点 4 解、第 4 点消歧)、DLT(≥6 线性)、EPnP(O(n))、高斯-牛顿/LM 精修 + RANSAC 去外点。\n**为什么重要**:「VO/SLAM」建好 3D 地图后,新一帧靠 **PnP** 用 2D-3D 对应快速**重定位**(比重新对极几何稳);机械臂抓取先求物体 **6D 位姿**(2D-3D 或 CAD 模型)才能规划抓取;AR 跟踪同理。**连**:「针孔相机」(投影 + K)、「视觉里程计/SLAM」(3D 地图点来源)、「双目」(给深度/3D)。**面试延伸**:P3P 为何 4 解、DLT vs EPnP vs 迭代、重投影误差、共面点退化(用单应)、RANSAC-PnP、PnP vs ICP(2D-3D vs 3D-3D)、已知 vs 未知内参(标定)。参考:EPnP(Lepetit 2009)、P3P(Gao 2003)、OpenCV solvePnP。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showObs: false, showReproj: false, showCurve: false, showSolved: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'PnP 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
