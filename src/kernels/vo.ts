/**
 * 内核：视觉里程计 · 对极几何/本质矩阵 —— 单目相机连续两帧,怎么从匹配点恢复相机自己动了多少(具身智能 · 机器人感知 / VSLAM 前端 / 面试八股)
 * 轴：step —— 引子(VO=从两帧恢复运动) → 本质矩阵 E=[t]×R → 对极约束 x2ᵀE x1=0(8 点法解 E 的基础) → 对极线 l2=E x1 + 极点(匹配只在一条线上找) → 从 E 分解出 (R,t)(4 解 + 手性 + 尺度不确定) → 收尾。
 *
 * 视觉里程计(VO)/单目 SLAM 前端要回答:相机从上一帧到这一帧,**自己转了多少、往哪走了**。做法靠**对极几何**:
 *   ①**本质矩阵 E=[t]×R**(归一化坐标下):把相机的相对**旋转 R**、**平移方向 t** 打包进一个 3×3 矩阵([t]× 是 t 的反对称叉乘矩阵)。
 *   ②**对极约束**:同一个 3D 点在两帧的归一化像点 x1、x2 必满足 **x2ᵀ E x1 = 0**(这是**8 点法**从 ≥8 组匹配线性解 E 的方程)。
 *   ③**对极线 + 极点**:l2 = E x1 是 x1 在第二帧里的**对极线**,x2 一定落在这条线上(l2·x2=0);所有对极线交于**极点 e2**(=相机1中心在第二帧的像=平移方向)。找匹配只需**沿一条对极线搜**、不用搜全图。
 *   ④**恢复位姿**:对 E 做 SVD → **4 组 (R,t) 候选**,用**手性(点必须在两相机前方)**选唯一;**单目下 t 只能定方向、定不了绝对尺度**(E 与 2E 同约束)——单目 SLAM 的尺度不确定。
 * 本例 R=I:**横向平移** t=[1,0,0](极点在无穷远、对极线水平 y1=y2、正是「双目」校正情形)vs **前进平移** t=[0,0,1](极点=图像中心的**扩张焦点 FOE**、对极线放射状,正是"往前开"看到的样子)。3 组匹配点验证约束≈0、画对极线与极点。全用矩阵现算。连「针孔/双目/ICP/SLAM/PnP」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type M3 = number[][]
type V3 = [number, number, number]
type V2 = [number, number]
type Sc = 'lateral' | 'forward'
export type VoState = {
  i: number
  step: number
  stage: 'intro' | 'essential' | 'constraint' | 'epiline' | 'recover' | 'done'
  scen: Sc
  scenLabel: string
  t: V3; E: M3
  epipole: V2 | null           // 极点(所有对极线的交点);null=无穷远(水平)
  corrs: { X: V3; x1: V2; x2: V2; c: number }[]
  epiIdx: number; epiLine: V3; onLine: number
  scaleC: number
  showE: boolean; showConstraint: boolean; showEpi: boolean; showRecover: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<VoState, 'i'>

const skew = (t: V3): M3 => [[0, -t[2], t[1]], [t[2], 0, -t[0]], [-t[1], t[0], 0]]
const mv = (A: M3, v: V3): V3 => A.map(r => r.reduce((s, x, k) => s + x * v[k]!, 0)) as V3
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const z0 = (x: number) => (Object.is(x, -0) ? 0 : x)
const r3 = (x: number) => z0(Math.round(x * 1000) / 1000)
const rM = (A: M3): M3 => A.map(r => r.map(r3))
const rV = (v: V3): V3 => v.map(r3) as V3
const near0 = (x: number) => Math.abs(x) < 1e-9

const PTS: V3[] = [[0, 0, 5], [2, 1, 6], [-1, 1, 5]]
const EPI = 1  // 用第 2 个点画对极线（两种场景下都非退化）

export const voKernel: Kernel<VoState> = {
  kind: 'vo',
  compile(doc: SimDocument): CompiledModel<VoState> {
    const scen: Sc = String(doc.params?.motion ?? '前进平移').includes('横') ? 'lateral' : 'forward'
    const t: V3 = scen === 'lateral' ? [1, 0, 0] : [0, 0, 1]
    const scenLabel = scen === 'lateral' ? '横向平移(极点在无穷远·对极线水平·像双目)' : '前进平移(极点=图心 FOE·对极线放射)'
    const E = skew(t)  // R=I，故 E=[t]×
    const epipole: V2 | null = scen === 'lateral' ? null : [0, 0]  // 前进:t=[0,0,1]→像 (0,0);横向:无穷远

    const corrs = PTS.map(X => {
      const x1n: V3 = [X[0] / X[2], X[1] / X[2], 1]
      const X2 = add(X, t); const x2n: V3 = [X2[0] / X2[2], X2[1] / X2[2], 1]  // R=I
      return { X, x1: [r3(x1n[0]), r3(x1n[1])] as V2, x2: [r3(x2n[0]), r3(x2n[1])] as V2, c: dot(x2n, mv(E, x1n)) }
    })
    const x1e: V3 = [PTS[EPI]![0] / PTS[EPI]![2], PTS[EPI]![1] / PTS[EPI]![2], 1]
    const epiLine = mv(E, x1e)
    const X2e = add(PTS[EPI]!, t); const x2e: V3 = [X2e[0] / X2e[2], X2e[1] / X2e[2], 1]
    const onLine = dot(epiLine, x2e)
    const E2 = skew([t[0] * 2, t[1] * 2, t[2] * 2])
    const scaleC = dot(x2e, mv(E2, x1e))

    const Er = rM(E)
    const frames: Frame[] = []
    const b0 = { scen, scenLabel, t, E: Er, epipole, corrs, epiIdx: EPI, epiLine: rV(epiLine), onLine: r3(onLine), scaleC: r3(scaleC), phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showE: boolean; showConstraint: boolean; showEpi: boolean; showRecover: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    const cstr = corrs.map(c => (near0(c.c) ? '≈0' : r3(c.c).toString())).join('、')
    const epiWord = scen === 'lateral' ? '水平线(y1=y2)' : '放射线(过图心极点)'

    push({
      stage: 'intro', showE: false, showConstraint: false, showEpi: false, showRecover: false,
      focus: `视觉里程计:单目连续两帧,从匹配点恢复相机自己转了多少、往哪走。核心=对极几何。${scenLabel}`,
      log: `**视觉里程计(VO):从两帧图像恢复"相机自己动了多少"**\n单目相机往前走,想知道**自己的运动**(转了多少 R、往哪走 t)——这是视觉里程计/单目 SLAM 的**前端**。\n线索:同一批 3D 点(墙角、特征点)在**上一帧 x1** 和**这一帧 x2** 的像位置不同,这个"错位"里就藏着相机运动。数学工具是**对极几何**:\n· **本质矩阵 E=[t]×R** 打包相对旋转 + 平移方向;\n· 匹配点满足 **对极约束 x2ᵀ E x1 = 0**;\n· 由约束解 E、再分解出 (R, t)。\n本例设相机不转(R=I)、平移 = **${scenLabel}**,取 3 个 3D 点看它们怎么约束。切「运动」对比横向(像双目)/前进(往前开)。` })

    push({
      stage: 'essential', showE: true, showConstraint: false, showEpi: false, showRecover: false,
      focus: `本质矩阵 E=[t]×R=[[${Er[0]}],[${Er[1]}],[${Er[2]}]](本例 R=I、故 E=[t]×;打包相对旋转+平移方向)`,
      log: `**① 本质矩阵 E = [t]× R**\n在**归一化坐标**(去掉内参 K)下,相机相对运动被打包成 3×3 的**本质矩阵**:\n**E = [t]× · R**([t]× 是平移 t 的反对称叉乘矩阵、R 是相对旋转)。\n本例 R=I(不转)、t=[${t}],故 **E = [t]× = [[${Er[0]}], [${Er[1]}], [${Er[2]}]]**。\n(带内参的像素坐标对应**基础矩阵 F=K⁻ᵀ E K⁻¹**;标定过就用 E。)E 秩为 2、只有 5 个自由度(3 旋转 + 2 平移方向、**尺度未定**)。` })

    push({
      stage: 'constraint', showE: true, showConstraint: true, showEpi: false, showRecover: false,
      focus: `对极约束:每对匹配点 x2ᵀE x1=0(本例三对都 ${cstr});8 点法就用它从 ≥8 对匹配线性解 E`,
      log: `**② 对极约束 x2ᵀ E x1 = 0**\n同一个 3D 点在两帧的归一化像点 x1、x2 **必满足** x2ᵀ E x1 = 0(几何:两条视线和基线共面)。验证三对匹配:\n· 点1 x1=[${corrs[0]!.x1}]、x2=[${corrs[0]!.x2}] → ${near0(corrs[0]!.c) ? '≈0 ✓' : r3(corrs[0]!.c)}\n· 点2 x1=[${corrs[1]!.x1}]、x2=[${corrs[1]!.x2}] → ${near0(corrs[1]!.c) ? '≈0 ✓' : r3(corrs[1]!.c)}\n· 点3 x1=[${corrs[2]!.x1}]、x2=[${corrs[2]!.x2}] → ${near0(corrs[2]!.c) ? '≈0 ✓' : r3(corrs[2]!.c)}\n**关键**:x2ᵀ E x1=0 对 E 的 9 个元素是**线性**的 → 给 **≥8 对匹配**就能列线性方程解出 E(**8 点法**,Longuet-Higgins)。实际用 **RANSAC** 从含误匹配里稳健估计。` })

    push({
      stage: 'epiline', showE: true, showConstraint: true, showEpi: true, showRecover: false,
      focus: `对极线 l2=E x1=[${rV(epiLine)}]:x1 在第二帧的对极线,x2 落在线上(l2·x2=${near0(onLine) ? '≈0' : r3(onLine)});${scen === 'lateral' ? '极点在无穷远、线水平' : '所有线过极点(图心 FOE)'}`,
      log: `**③ 对极线 + 极点:匹配只需沿一条线搜**\nl2 = **E x1** 是第二帧里的一条直线——x1 的**对极线**。约束 x2ᵀ(E x1)=0 就是说 **x2 必落在 l2 上**。\n本例点2:l2 = E x1 = **[${rV(epiLine)}]**,x2=[${corrs[EPI]!.x2}] 代入 = ${near0(onLine) ? '≈0 ✓(在线上)' : r3(onLine)}。\n**所有对极线都交于一点——极点 e2**(=相机1光心在第二帧的像=平移方向的像)。**${scen === 'lateral'
        ? '横向平移:t 平行像平面 → 极点在无穷远 → 对极线是一组水平平行线、且 y1=y2(这正是「双目」把两图校正成同一行、沿行找匹配的原理)'
        : '前进平移:t 沿光轴 → 极点=图像中心的扩张焦点(FOE, focus of expansion)、对极线从中心放射(就是你开车往前看、路两旁的东西向外扩张的样子)'}**。\n**意义**:找 x1 在第二帧的匹配,**只沿它的对极线 ${epiWord} 搜、不用搜整幅图**——匹配的巨大加速。` })

    push({
      stage: 'recover', showE: true, showConstraint: true, showEpi: true, showRecover: true,
      focus: `从 E 分解出 (R,t):SVD→4 组候选,手性(点在两相机前方)选唯一;t 只能定方向、定不了尺度(E 与 2E 约束都 ${near0(scaleC) ? '≈0' : r3(scaleC)})`,
      log: `**④ 从 E 恢复相机运动 (R, t)**\n对 E 做 **SVD** 分解,拆出 **4 组 (R, t) 候选**(旋转 2 种 × 平移 ±方向):\n· **手性检验(cheirality)**:真正那组必须让**三角化出的 3D 点在两个相机前方(深度为正)**,以此选唯一解。\n· **尺度不确定**:E 对 t 的尺度齐次——**E 和 2E(t 和 2t)给完全相同的约束**(本例 x2ᵀ(2E)x1 = ${near0(scaleC) ? '≈0' : r3(scaleC)}、和 E 一样)。所以**单目只能定平移方向、定不了绝对尺度** = **单目 SLAM 的尺度不确定**(靠双目基线/IMU/已知物体大小/回环补尺度)。\n拿到 (R,t) 后,把匹配点**三角化**成 3D 地图点,一帧帧接起来就是**里程计轨迹**。` })

    push({
      stage: 'done', showE: true, showConstraint: true, showEpi: true, showRecover: true, phase: 'done',
      focus: `对极几何:E=[t]×R、x2ᵀE x1=0(8 点法)、对极线/极点加速匹配、SVD 分解 (R,t) 手性选解、单目无尺度;连针孔/双目/SLAM/PnP`,
      log: `**小结:对极几何 = 单目 VO 的数学核心**\n· **本质矩阵 E=[t]×R**:打包相对旋转 + 平移方向(归一化坐标;带内参则基础矩阵 F);\n· **对极约束 x2ᵀ E x1=0**:对 E 线性 → **8 点法**从 ≥8 对匹配解 E(RANSAC 去误匹配);\n· **对极线 l2=E x1 + 极点 e2**:匹配只沿一条线搜(横向→水平线=双目校正;前进→从 FOE 放射);\n· **分解 (R,t)**:SVD → 4 候选、**手性**选唯一;**单目 t 无绝对尺度**(E 与 2E 同约束)。\n**为什么重要**:这是**单目/双目 VO、VSLAM(ORB-SLAM 等)前端**从图像求相机运动的核心;拿到 (R,t) 三角化建图、接成轨迹。**连**:「针孔相机」(归一化/内参)、「双目」(对极线水平=校正、且能定尺度)、「ICP/SLAM」(后端优化轨迹)、「PnP」(有 3D 点后用 2D-3D 求位姿)。**面试延伸**:E vs F、对极线/极点/FOE、8 点法(归一化 8 点法)、RANSAC、E 的 SVD 分解与 4 解、手性检验、单目尺度不确定、纯旋转退化、三角化、Nistér 五点法。参考:Longuet-Higgins 1981、Hartley-Zisserman《Multiple View Geometry》。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showE: false, showConstraint: false, showEpi: false, showRecover: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '对极步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
