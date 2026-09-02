/**
 * 内核：双目立体视觉 · 视差求深度 —— 两个相机怎么把"针孔丢掉的深度"找回来(具身智能 · 机器人感知 / 面试八股)
 * 轴：step —— 引子(针孔丢深度、双目找回) → 左右相机各自投影(x_L,x_R) → 视差 d=x_L−x_R → 深度 Z=f·b/d → 深度精度 ΔZ∝Z²(远处不准) → 收尾。
 *
 * 单个针孔相机把 3D 压成 2D、**丢了深度**(不同 Z、同 X/Z 投到同一像素)。**双目(立体)**用**两个平行相机**(基线 b)找回深度:
 *   同一个 3D 点在左右图上横坐标不同,差值 **视差 d = x_L − x_R = f·b/Z**(近大远小:越近视差越大)。
 *   反过来 **深度 Z = f·b / d** —— 测出视差就得深度。这就是所有深度相机(RealSense/ZED)、立体 SLAM 的底层。
 *   **深度精度**:视差有 1px 误差时,**ΔZ ≈ Z²/(f·b)·Δd ∝ Z²** —— **远处物体深度极不准**(误差随距离平方增长),想测更远要加大基线 b 或焦距 f。
 * 本例 f=500px、基线 b=0.1m:近处点(Z=2m)视差 25px、远处点(Z=5m)视差 10px;Z=f·b/d 现算还原深度;1px 视差误差 → 近处 ΔZ=0.08m、远处 ΔZ=0.5m。全现算。连「针孔相机(逆问题)/ICP/SLAM/三角测量」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Sc = 'near' | 'far'
export type StereoState = {
  i: number
  step: number
  stage: 'intro' | 'project' | 'disparity' | 'depth' | 'precision' | 'done'
  scen: Sc
  scenLabel: string
  f: number; b: number; cx: number
  X: number; Ztrue: number     // 3D 点：横坐标 X(m)、真实深度 Z(m)
  xL: number; xR: number       // 左右图像横坐标(px)
  disp: number                 // 视差(px)
  Zrec: number                 // 由视差还原的深度(m)
  dZ: number                   // 1px 视差误差对应的深度误差(m)
  dZnear: number; dZfar: number
  showProj: boolean; showDisp: boolean; showDepth: boolean; showPrec: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<StereoState, 'i'>

const F = 500, B = 0.1, CX = 320
const NEAR = { X: 0.3, Z: 2 }
const FAR = { X: 0.6, Z: 5 }
const r2 = (x: number) => Math.round(x * 100) / 100
const r0 = (x: number) => Math.round(x)

const dZof = (Z: number) => r2((Z * Z) / (F * B))   // 1px 视差误差对应深度误差

export const stereoKernel: Kernel<StereoState> = {
  kind: 'stereo',
  compile(doc: SimDocument): CompiledModel<StereoState> {
    const scen: Sc = String(doc.params?.depth ?? '近处').includes('远') ? 'far' : 'near'
    const scenLabel = scen === 'near' ? '近处物体(Z=2m)' : '远处物体(Z=5m)'
    const { X, Z: Ztrue } = scen === 'near' ? NEAR : FAR

    const xL = r0(F * X / Ztrue + CX)
    const xR = r0(F * (X - B) / Ztrue + CX)
    const disp = xL - xR
    const Zrec = r2(F * B / disp)
    const dZ = dZof(Ztrue)
    const dZnear = dZof(NEAR.Z), dZfar = dZof(FAR.Z)

    const frames: Frame[] = []
    const b0 = {
      scen, scenLabel, f: F, b: B, cx: CX, X, Ztrue,
      xL, xR, disp, Zrec, dZ, dZnear, dZfar, phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showProj: boolean; showDisp: boolean; showDepth: boolean; showPrec: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showProj: false, showDisp: false, showDepth: false, showPrec: false,
      focus: `单个针孔丢了深度;双目用两个平行相机(基线 b=${B}m)把深度找回来。场景：${scenLabel}`,
      log: `**双目立体视觉:把针孔丢掉的深度找回来**\n上一课「针孔相机」把 3D 压成 2D、**丢了深度**(不同 Z、同 X/Z 投到同一像素、单目测不了绝对距离)。\n**双目(立体)** 用**两个平行放置的相机**(左右相隔一个**基线 b=${B}m**),同一个 3D 点在左右图上会落在**不同的横坐标**——这个差就是**视差**,视差里就藏着深度。\n本例焦距 **f=${F}px**、基线 **b=${B}m**;当前看 **${scenLabel}**(横坐标 X=${X}m、真实深度 Z=${Ztrue}m)。下面一步步:投影 → 视差 → 深度 → 精度。` })

    push({
      stage: 'project', showProj: true, showDisp: false, showDepth: false, showPrec: false,
      focus: `左右相机各自投影:x_L=f·X/Z+cx=${xL}px、x_R=f·(X−b)/Z+cx=${xR}px`,
      log: `**① 左右相机各自投影**\n两个相机都是针孔,只是右相机整体右移了基线 b。同一个 3D 点 (X=${X}, Z=${Ztrue}) 投到:\n· 左图:**x_L = f·X/Z + cx = ${F}·${X}/${Ztrue} + ${CX} = ${xL}px**;\n· 右图:**x_R = f·(X−b)/Z + cx = ${F}·(${X}−${B})/${Ztrue} + ${CX} = ${xR}px**。\n因为右相机偏了 b,同一个点在右图上**偏左一点**(x_R<x_L)。这个左右横坐标的差,下一步就是视差。` })

    push({
      stage: 'disparity', showProj: true, showDisp: true, showDepth: false, showPrec: false,
      focus: `视差 d = x_L − x_R = ${xL} − ${xR} = ${disp}px(近大远小:越近视差越大)`,
      log: `**② 视差 disparity**\n**视差 d = x_L − x_R = ${xL} − ${xR} = ${disp}px**。\n代入投影式相减:d = f·X/Z − f·(X−b)/Z = **f·b/Z**——视差只和 **f·b** 和**深度 Z** 有关、和横坐标 X 无关。\n**关键直觉:视差 ∝ 1/Z,近大远小**。本例近处点(Z=2)视差 ${scen === 'near' ? disp : 25}px、远处点(Z=5)视差 ${scen === 'far' ? disp : 10}px——**越近的东西左右图差得越多**(把手指凑近眼前、左右眼看到的位置差很大;看远山几乎没差)。切「场景」对比近/远。` })

    push({
      stage: 'depth', showProj: true, showDisp: true, showDepth: true, showPrec: false,
      focus: `深度 Z = f·b / d = ${F}·${B} / ${disp} = ${Zrec}m(还原出真实深度 ${Ztrue}m)`,
      log: `**③ 反求深度 Z = f·b / d**\n把 d=f·b/Z 反过来:**Z = f·b / d = ${F}·${B} / ${disp} = ${Zrec}m** —— 和真实深度 **${Ztrue}m** 一致。\n**这就是双目测距的核心公式**:标定好 f、b(固定),**测出视差 d 就得到深度 Z**。整幅图每个像素都这么算,就得到**深度图/点云**(RealSense、ZED、双目 SLAM 都靠它)。\n难点在**找对应**(左图这个像素对应右图哪个像素)——平行相机下对应点在**同一行**(极线水平、见「针孔/对极几何」),沿行做块匹配即可。` })

    push({
      stage: 'precision', showProj: true, showDisp: true, showDepth: true, showPrec: true,
      focus: `深度精度 ΔZ ≈ Z²/(f·b)·Δd ∝ Z²:1px 视差误差 → 近处 ΔZ=${dZnear}m、远处 ${dZfar}m(远处极不准)`,
      log: `**④ 深度精度:远处极不准(ΔZ ∝ Z²)**\n视差是离散像素、总有误差。对 Z=f·b/d 求导:**ΔZ ≈ Z²/(f·b)·Δd** —— **深度误差随距离的平方增长**。\n取 1px 视差误差(Δd=1):\n· 近处(Z=2m):ΔZ = 2²/(${F}·${B}) = 4/${F * B} = **${dZnear}m**;\n· 远处(Z=5m):ΔZ = 5²/${F * B} = **${dZfar}m**——同样 1px 误差,远处的深度不确定性大 ${r2(dZfar / dZnear)} 倍!\n**所以双目擅长测近处、远处越来越糊**。想测更远/更准:**加大基线 b、加大焦距 f、或做亚像素视差**(把 Δd 降到 <1px)。本例是 **${scenLabel}**、ΔZ=**${dZ}m**。` })

    push({
      stage: 'done', showProj: true, showDisp: true, showDepth: true, showPrec: true, phase: 'done',
      focus: `双目:视差 d=f·b/Z、深度 Z=f·b/d;精度 ΔZ∝Z²(远处不准);连针孔(逆问题)/ICP/SLAM`,
      log: `**小结:双目立体视觉 = 视差 → 深度**\n· **投影**:左右两个针孔相机(相隔基线 b),同一 3D 点横坐标不同;\n· **视差 d = x_L − x_R = f·b/Z**(近大远小、∝1/Z);\n· **深度 Z = f·b / d**(测出视差就得深度、逐像素得深度图);\n· **精度 ΔZ ≈ Z²/(f·b)·Δd ∝ Z²**(远处极不准、误差随距离平方涨)。\n**为什么重要**:这是所有**被动深度相机**(双目 RealSense/ZED)、**立体视觉 SLAM** 的地基,把「针孔相机」丢掉的深度找回来(单目→双目是从"测不了绝对尺度"到"能测绝对深度")。**连**:「针孔相机」的逆问题;深度图 → 点云 →「ICP/SLAM」;找对应用极线(「对极几何」)。**面试延伸**:视差∝1/Z、Z=fb/d、ΔZ∝Z²、基线/焦距对量程与精度的权衡、立体匹配(块匹配/SGM)、亚像素视差、主动(结构光/ToF) vs 被动(双目)、单目深度(靠先验/学习、无绝对尺度)。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showProj: false, showDisp: false, showDepth: false, showPrec: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '求深度步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
