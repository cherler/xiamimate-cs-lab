/**
 * 内核：针孔相机模型 · 投影与畸变 —— 3D 点怎么变成 2D 像素：透视除以深度 + 内参 + 径向畸变（具身智能 · 机器人感知 / 面试八股）
 * 轴：step —— 引子(相机=3D→2D) → 透视归一化(除以深度 Z) → 内参(焦距+主点→像素) → 径向畸变(直线变弯、边缘更明显) → 有/无畸变对比 + 标定 → 收尾。
 *
 * 针孔模型:相机系 3D 点 X=(X,Y,Z) 投到像素。**透视投影**:归一化 x_n=X/Z、y_n=Y/Z(**除以深度**——远处的东西显小,这就是"近大远小")。
 *   **内参 K**:像素 u=fx·x_n+cx、v=fy·y_n+cy(fx,fy 焦距[像素]、cx,cy 主点)。**径向畸变**(镜头非理想):r²=x_n²+y_n²,x_d=x_n(1+k1 r²+k2 r⁴)——把直线拍弯(桶形/枕形)、**离中心越远越明显**。
 *   本例 X=(3,2,5)、fx=fy=500、(cx,cy)=(320,240)、k1=0.2/k2=0.05:无畸变像素 (620,440);有畸变 (655,464)。**标定**=用棋盘格从已知 3D↔2D 反求 K 和畸变系数。param 畸变开/关。全现算。连「ICP/SLAM/手眼标定(都要相机模型)」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Dist = 'on' | 'off'
export type PinState = {
  i: number
  step: number
  stage: 'intro' | 'perspective' | 'intrinsic' | 'distortion' | 'result' | 'done'
  dist: Dist
  distLabel: string
  P: [number, number, number]                 // 相机系 3D 点
  fx: number; fy: number; cx: number; cy: number; k1: number; k2: number
  xn: number; yn: number; r2v: number
  uIdeal: number; vIdeal: number
  xd: number; yd: number; uDist: number; vDist: number
  shift: number
  showPersp: boolean; showIntr: boolean; showDist: boolean; showResult: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PinState, 'i'>

const P: [number, number, number] = [3, 2, 5]
const FX = 500, FY = 500, CX = 320, CY = 240, K1 = 0.2, K2 = 0.05
const r2 = (x: number) => Math.round(x * 100) / 100

export const pinholeKernel: Kernel<PinState> = {
  kind: 'pinhole',
  compile(doc: SimDocument): CompiledModel<PinState> {
    const dist: Dist = String(doc.params?.distort ?? '有畸变').includes('无') ? 'off' : 'on'
    const distLabel = dist === 'on' ? '有径向畸变(桶形)' : '无畸变(理想针孔)'

    const xn = P[0] / P[2], yn = P[1] / P[2]
    const r2v = xn * xn + yn * yn
    const uIdeal = FX * xn + CX, vIdeal = FY * yn + CY
    const scale = 1 + K1 * r2v + K2 * r2v * r2v
    const xd = xn * scale, yd = yn * scale
    const uDist = FX * xd + CX, vDist = FY * yd + CY
    const shift = Math.sqrt((uDist - uIdeal) ** 2 + (vDist - vIdeal) ** 2)

    const frames: Frame[] = []
    const b0 = {
      dist, distLabel, P, fx: FX, fy: FY, cx: CX, cy: CY, k1: K1, k2: K2,
      xn: r2(xn), yn: r2(yn), r2v: r2(r2v), uIdeal: r2(uIdeal), vIdeal: r2(vIdeal),
      xd: r2(xd), yd: r2(yd), uDist: r2(uDist), vDist: r2(vDist), shift: r2(shift), phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showPersp: boolean; showIntr: boolean; showDist: boolean; showResult: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showPersp: false, showIntr: false, showDist: false, showResult: false,
      focus: `针孔相机:3D 点投到 2D 像素。u=K[R|t]X,核心是透视除以深度 Z。畸变：${distLabel}`,
      log: `**针孔相机模型:3D 世界怎么变成一张图**\n相机把 3D 点映到 2D 像素,整条链是 **u = K·[R|t]·X**:\n· **[R|t]**:外参,世界系 → 相机系(位姿);· **透视**:除以深度 Z(近大远小);· **K**:内参,归一化坐标 → 像素;· 再加**畸变**(镜头非理想)。\n本例(点已在相机系)X=(${P})、内参 fx=fy=${FX}、主点 (cx,cy)=(${CX},${CY})、畸变 k1=${K1}/k2=${K2}。当前 **${distLabel}**。看它一步步落到哪个像素。` })

    push({
      stage: 'perspective', showPersp: true, showIntr: false, showDist: false, showResult: false,
      focus: `透视:归一化 x_n=X/Z=${b0.xn}、y_n=Y/Z=${b0.yn}(除以深度 Z=${P[2]}——近大远小)`,
      log: `**① 透视投影(除以深度)**\n先把 3D 点投到归一化像平面(Z=1):\n**x_n = X/Z = ${P[0]}/${P[2]} = ${b0.xn}**、**y_n = Y/Z = ${P[1]}/${P[2]} = ${b0.yn}**。\n**关键就是这个"除以 Z"**——同样大的物体,Z 越大(越远)、投影越小,这就是"**近大远小**"。透视投影是非线性的(除法),也是为什么单张图**丢了深度**(不同 Z、同 X/Z 的点投到同一像素)。` })

    push({
      stage: 'intrinsic', showPersp: true, showIntr: true, showDist: false, showResult: false,
      focus: `内参 K:u=fx·x_n+cx=${b0.uIdeal}、v=fy·y_n+cy=${b0.vIdeal}(焦距缩放+主点平移)`,
      log: `**② 内参 K:归一化坐标 → 像素**\n内参矩阵 K=[[fx,0,cx],[0,fy,cy],[0,0,1]]。像素坐标:\n**u = fx·x_n + cx = ${FX}·${b0.xn} + ${CX} = ${b0.uIdeal}**、**v = fy·y_n + cy = ${FY}·${b0.yn} + ${CY} = ${b0.vIdeal}**。\n· **fx,fy**:焦距(像素单位)——把归一化坐标放大到像素;· **cx,cy**:主点(光轴和像平面的交点、通常≈图像中心)。这就是**理想针孔**下的像素 **(${b0.uIdeal}, ${b0.vIdeal})**。` })

    push({
      stage: 'distortion', showPersp: true, showIntr: true, showDist: true, showResult: false,
      focus: `径向畸变:r²=${b0.r2v},x_d=x_n(1+k1 r²+k2 r⁴)=${b0.xd}(离中心越远越弯)`,
      log: `**③ 径向畸变(镜头非理想)**\n真镜头不是理想针孔——光线离光轴越远、弯得越厉害(**桶形/枕形畸变**)。径向畸变模型:\nr² = x_n²+y_n² = ${b0.r2v};**x_d = x_n·(1 + k1·r² + k2·r⁴)** = ${b0.xn}·(1+${K1}·${b0.r2v}+${K2}·${r2(r2v * r2v)}) = **${b0.xd}**,y_d 同理=${b0.yd}。\n**离中心(主点)越远、r 越大、畸变越猛**——所以图像**边缘**的直线会被拍弯,中心几乎不变。畸变后像素:**(${b0.uDist}, ${b0.vDist})**,比理想位置偏了 **${b0.shift} 像素**。` })

    push({
      stage: 'result', showPersp: true, showIntr: true, showDist: true, showResult: true,
      focus: dist === 'on' ? `有畸变像素 (${b0.uDist}, ${b0.vDist}),比理想 (${b0.uIdeal}, ${b0.vIdeal}) 偏 ${b0.shift}px` : `无畸变像素 (${b0.uIdeal}, ${b0.vIdeal})(理想针孔)`,
      log: `**④ 结果 + 标定**\n${dist === 'on'
        ? `**有畸变**:最终像素 = **(${b0.uDist}, ${b0.vDist})**,比理想针孔 (${b0.uIdeal}, ${b0.vIdeal}) 偏了 **${b0.shift} 像素**(这个点在边缘、偏得明显;中心的点几乎不偏)。用之前必须**去畸变(undistort)**、把像素纠回理想位置,否则测距/建图全歪。`
        : `**无畸变(理想针孔)**:像素 = **(${b0.uIdeal}, ${b0.vIdeal})**。`}\n**相机标定(calibration)**:上面的 fx,fy,cx,cy,k1,k2 从哪来?——拍多张**棋盘格**(已知 3D 角点↔检测到的 2D 像素),用**已知 3D↔2D 对应**反求这些参数(张正友标定法)。标定是所有视觉测量的前提。` })

    push({
      stage: 'done', showPersp: true, showIntr: true, showDist: true, showResult: true, phase: 'done',
      focus: `收尾:针孔 u=K[R|t]X、透视除以Z、内参K、径向畸变;标定求参数;连 ICP/SLAM/手眼标定/6D位姿`,
      log: `**小结:针孔相机 = 透视 + 内参 + 畸变**\n· **外参 [R|t]** 世界→相机;· **透视** x_n=X/Z、y_n=Y/Z(除以深度、近大远小、丢深度);· **内参 K** u=fx x_n+cx、v=fy y_n+cy;· **径向畸变** x_d=x_n(1+k1 r²+k2 r⁴)(边缘更弯)。\n**标定**:拍棋盘格、从已知 3D↔2D 反求 K 和畸变系数(张正友法);用图前先**去畸变**。\n**为什么重要**:这是**所有视觉几何的地基**——「ICP/SLAM」要把像素反投影成 3D 射线、「三角化/立体视觉」靠两个相机的投影求深度、「6D 位姿估计/手眼标定」都要精确的 K。**面试延伸**:内参外参、透视为何丢深度、径向 vs 切向畸变、张正友标定、去畸变、针孔 vs 鱼眼、像素/归一化/相机/世界四套坐标。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showPersp: false, showIntr: false, showDist: false, showResult: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '投影步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
