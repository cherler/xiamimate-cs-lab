/**
 * 内核：点云预处理 · 体素下采样 + 法线估计(PCA) —— 配准/建图前必做的两步：降密度 + 求每点表面法线（具身智能 · 机器人感知 / 面试八股）
 * 轴：step —— 引子(两步预处理) → 体素下采样(网格分箱取质心) → 找 k 近邻 → 邻域协方差矩阵 → PCA 求法线(最小特征值的特征向量) → 收尾。
 *
 * 深度相机/激光出的原始点云**又密又不均、还带噪**,配准(ICP)/建图前要预处理:
 *   ①**体素下采样(voxel grid)**:把空间切成边长 L 的网格,每个占用体素**只保留落在里面的点的质心**——点数降下来、密度变均匀(param L 粗/细)。
 *   ②**法线估计(PCA)**:对每个点找 **k 近邻**,算邻域**协方差矩阵 C**,做 PCA(特征分解)——**最小特征值对应的特征向量 = 表面法线**(方差最小的方向⊥局部平面);最大特征向量=表面切向。λ 的比还能判"平面/边/角"。
 * 本例 2D、8 点在一条斜面上:L=1 下采样到 5 个体素;对点 (1.6,1.3) 取 4 近邻、协方差 PCA → 法线 ≈ (0.77,−0.64)(⊥斜面)。全现算。连「ICP(配准前下采样、点到面误差要法线)/SLAM」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Res = 'fine' | 'coarse'
type Pt = [number, number]
export type CloudState = {
  i: number
  step: number
  stage: 'intro' | 'voxel' | 'neighbors' | 'covariance' | 'pca' | 'done'
  res: Res
  resLabel: string
  L: number
  raw: Pt[]
  voxels: Pt[]                 // 下采样后的质心
  query: Pt; nbrs: Pt[]
  cov: [[number, number], [number, number]]
  lamBig: number; lamSmall: number
  normal: Pt; tangent: Pt
  showVoxel: boolean; showNbr: boolean; showCov: boolean; showPca: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<CloudState, 'i'>

const RAW: Pt[] = [[0.3, 0.2], [0.7, 0.6], [1.4, 1.5], [1.6, 1.3], [2.2, 2.4], [2.6, 2.1], [3.1, 3.2], [3.4, 2.9]]
const QUERY: Pt = [1.6, 1.3]
const K = 4
const r2 = (x: number) => Math.round(x * 100) / 100
const r3 = (x: number) => Math.round(x * 1000) / 1000
const d2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

function voxelDown(pts: Pt[], L: number): Pt[] {
  const bins = new Map<string, Pt[]>()
  for (const p of pts) { const k = `${Math.floor(p[0] / L)},${Math.floor(p[1] / L)}`; (bins.get(k) ?? bins.set(k, []).get(k)!).push(p) }
  return [...bins.values()].map(g => [r2(g.reduce((s, p) => s + p[0], 0) / g.length), r2(g.reduce((s, p) => s + p[1], 0) / g.length)] as Pt)
}

export const pointcloudKernel: Kernel<CloudState> = {
  kind: 'pointcloud',
  compile(doc: SimDocument): CompiledModel<CloudState> {
    const res: Res = String(doc.params?.voxel ?? '细').includes('粗') ? 'coarse' : 'fine'
    const resLabel = res === 'fine' ? '细(L=1)' : '粗(L=2)'
    const L = res === 'fine' ? 1 : 2

    const voxels = voxelDown(RAW, L)
    // 法线：对 QUERY 找 k 近邻（在原始点云上，法线要细节）
    const nbrs = [...RAW].sort((a, b) => d2(a, QUERY) - d2(b, QUERY)).slice(0, K)
    const mx = nbrs.reduce((s, p) => s + p[0], 0) / K, my = nbrs.reduce((s, p) => s + p[1], 0) / K
    let cxx = 0, cyy = 0, cxy = 0
    for (const p of nbrs) { const dx = p[0] - mx, dy = p[1] - my; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy }
    cxx /= K; cyy /= K; cxy /= K
    // 2x2 对称特征分解
    const tr = cxx + cyy, det = cxx * cyy - cxy * cxy
    const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det))
    const lamBig = tr / 2 + disc, lamSmall = tr / 2 - disc
    // 特征向量：小特征值 → 法线
    const evec = (lam: number): Pt => { const v: Pt = Math.abs(cxy) > 1e-9 ? [lam - cyy, cxy] : [1, 0]; const n = Math.hypot(v[0], v[1]) || 1; return [v[0] / n, v[1] / n] }
    const normal = evec(lamSmall), tangent = evec(lamBig)

    const frames: Frame[] = []
    const b0 = {
      res, resLabel, L, raw: RAW, voxels, query: QUERY, nbrs,
      cov: [[r3(cxx), r3(cxy)], [r3(cxy), r3(cyy)]] as [[number, number], [number, number]],
      lamBig: r3(lamBig), lamSmall: r3(lamSmall), normal: [r2(normal[0]), r2(normal[1])] as Pt, tangent: [r2(tangent[0]), r2(tangent[1])] as Pt, phase: 'run' as const,
    }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showVoxel: boolean; showNbr: boolean; showCov: boolean; showPca: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({
      stage: 'intro', showVoxel: false, showNbr: false, showCov: false, showPca: false,
      focus: `点云预处理两步:体素下采样(降密度)+法线估计(PCA)。配准/建图前必做。分辨率：${resLabel}`,
      log: `**点云预处理:配准/建图之前先"梳理"点云**\n深度相机/激光出的原始点云**又密又不均、还带噪**,直接拿去配准(ICP)/建图又慢又不稳。两步标准预处理:\n· **① 体素下采样**:把点数降下来、密度变均匀;\n· **② 法线估计**:给每个点算出**表面法线**(它朝哪个方向"面外")——ICP 的点到面误差、法向一致性剔除都要它。\n本例 2D、${RAW.length} 个点大致落在一条斜面上。当前下采样分辨率 **${resLabel}**。` })

    push({
      stage: 'voxel', showVoxel: true, showNbr: false, showCov: false, showPca: false,
      focus: `体素下采样:网格边长 L=${L},每个占用体素保留点的质心 → ${RAW.length} 点降到 ${voxels.length} 个`,
      log: `**① 体素下采样(voxel grid)**\n把空间切成边长 **L=${L}** 的网格,一个点落进哪个体素看 ⌊坐标/L⌋。**每个占用的体素,只保留落在里面所有点的质心**(平均位置):\n${RAW.length} 个原始点 → **${voxels.length} 个下采样点**:${voxels.map(v => `(${v})`).join('、')}。\n效果:**点数降下来、密度变均匀**(密的地方被合并、稀的地方保留)。L 越大越粗(点更少、细节丢更多)、越小越细。切「分辨率」对比 L=1(${voxelDown(RAW, 1).length} 点)/L=2(${voxelDown(RAW, 2).length} 点)。` })

    push({
      stage: 'neighbors', showVoxel: true, showNbr: true, showCov: false, showPca: false,
      focus: `法线估计第一步:对点 (${QUERY}) 找 ${K} 近邻(法线是局部性质、要邻域)`,
      log: `**② 法线估计 · 找 k 近邻**\n法线是**局部**性质——要看一个点周围一小片邻域长什么样。对目标点 **(${QUERY})** 找 **k=${K} 个最近邻**:${nbrs.map(p => `(${p})`).join('、')}。\n这些邻居大致排在一条**斜线**上(局部就是那小片"表面")。接下来用它们的分布方向反推法线。(k 太小→受噪声影响、k 太大→跨过边角、糊掉。)` })

    push({
      stage: 'covariance', showVoxel: true, showNbr: true, showCov: true, showPca: false,
      focus: `邻域协方差矩阵 C=[[${b0.cov[0]}],[${b0.cov[1]}]](描述邻域点云往哪个方向散)`,
      log: `**③ 邻域协方差矩阵**\n把 k 个邻居去均值、算 **2×2 协方差矩阵 C**(描述这片点云"往哪些方向散、散多大"):\nC = [[Cxx, Cxy],[Cxy, Cyy]] = [[${b0.cov[0][0]}, ${b0.cov[0][1]}],[${b0.cov[1][0]}, ${b0.cov[1][1]}]]。\n对角是各方向的方差、非对角是相关。**方差最大的方向 = 点云铺开的方向(表面切向)、方差最小的方向 = 表面法线**——下一步用 PCA(特征分解)把这两个方向拆出来。` })

    push({
      stage: 'pca', showVoxel: true, showNbr: true, showCov: true, showPca: true,
      focus: `PCA:特征值 λ=${b0.lamBig}(大,切向)/${b0.lamSmall}(小,法向);最小特征值的特征向量=法线 [${b0.normal}]`,
      log: `**④ PCA → 法线(最小特征值的特征向量)**\n对协方差 C 做特征分解:\n· 大特征值 λ₁=**${b0.lamBig}** → 特征向量 = **表面切向** ≈ [${b0.tangent}](点云铺开的方向);\n· 小特征值 λ₂=**${b0.lamSmall}** → 特征向量 = **表面法线** ≈ **[${b0.normal}]**(方差最小的方向、垂直于局部面)。\n**核心:法线 = 协方差最小特征值对应的特征向量**(点云在法向上几乎没铺开、所以那个方向方差最小)。\n**λ 的比还能判形状**:λ₂/λ₁≈0(本例 ${r3(lamSmall / lamBig)})→局部很平、法线可靠;两个 λ 都不小→是**边/角**、法线不确定。(法线还有±方向歧义,一般统一朝相机。)` })

    push({
      stage: 'done', showVoxel: true, showNbr: true, showCov: true, showPca: true, phase: 'done',
      focus: `收尾:体素下采样(网格取质心)+法线估计(PCA、最小特征值的特征向量);连 ICP/SLAM/配准`,
      log: `**小结:点云预处理 = 体素下采样 + 法线估计**\n· **体素下采样**:边长 L 网格、每格取质心 → 降密度、均匀化(L 权衡点数与细节);\n· **法线估计(PCA)**:找 k 近邻 → 协方差矩阵 → 特征分解,**最小特征值的特征向量 = 法线**(方差最小方向⊥面)、最大的 = 切向;λ 的比判平面/边/角。\n**为什么重要**:「ICP」配准前先下采样(快、稳),而**点到面(point-to-plane)ICP 的误差就要用法线**(比点到点收敛快);法向一致性还用来**剔除外点/错匹配**;曲面重建、抓取姿态都要法线。**连到别的课**:「ICP/SLAM」的前置;PCA 和「PCA 降维」同一套特征分解。面试延伸:voxel vs 随机/均匀下采样、k 的选择、法线 PCA 原理、法线方向歧义、点到点 vs 点到面 ICP、λ 判平面/边/角(曲率)。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showVoxel: false, showNbr: false, showCov: false, showPca: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '预处理步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
