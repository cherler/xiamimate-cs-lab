/**
 * 内核：SLAM · 回环校正真仿真 —— 机器人走一圈，里程计累计漂移导致轨迹不闭合；回环把漂移分摊回整条轨迹、拉闭合（具身智能 · 机器人感知）
 * 轴：step —— 机器人沿闭合回路走，里程计逐步累计系统漂移(轨迹越走越偏、回不到起点)；识别回环后测出漂移、按位置分摊校正，轨迹闭合、误差骤降
 *
 * SLAM(同时定位与建图):机器人一边估计自己的轨迹、一边建环境地图。核心难题是**里程计漂移**——轮子打滑等系统误差**逐步累积**,
 * 走得越久、估计的位置偏得越多。走一圈回到起点时,里程计以为自己在别处(轨迹**不闭合**),这个缺口就是累计漂移。
 * **回环检测(loop closure)**:机器人认出"我回到走过的地方了"(看到相同地标),于是加一条约束:终点应当=起点。
 * **位姿图优化**:把这个回环误差**分摊回整条轨迹**(每个位姿按比例拉回),于是环闭合、之前的漂移被大幅抹平——这是 SLAM 精度的关键一跃。
 * 本例机器人沿八边形走一圈:里程计每步有系统漂移,终点偏到 (2.45,0.82) 不闭合(漂移 2.58);回环校正把漂移分摊回去,
 * 终点回到起点、轨迹平均误差从 1.26 骤降到 0.25。漂移/校正/误差全真算、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const r2 = (n: number) => Math.round(n * 100) / 100
const rad = (d: number) => (d * Math.PI) / 180
type Pt = [number, number]

export type SLAMState = {
  i: number
  step: number
  phase: 'intro' | 'walk' | 'loopclose' | 'correct' | 'done'
  op: 'intro' | 'step' | 'loopclose' | 'correct' | 'summary'
  truePath: Pt[]
  odom: Pt[]                 // 已走出的里程计轨迹（累积）
  corrected: Pt[] | null     // 校正后轨迹
  poseNo: number             // 当前走到第几个位姿
  drift: Pt | null           // 回环漂移
  driftMag: number
  errOdom: number            // 里程计轨迹平均误差
  errCorr: number            // 校正后平均误差
  focus: string
  log: string
}
type Frame = Omit<SLAMState, 'i'>

const N = 8, STEP = 3
const D: Pt = [0.28, 0.12]                            // 里程计系统漂移（每步侧移）
const wob = (i: number): Pt => [r2(0.25 * Math.sin(1.7 * i)), r2(0.25 * Math.cos(1.3 * i))]

// 真实闭合八边形
const TRUE: Pt[] = (() => { const p: Pt[] = [[0, 0]]; let h = 0; for (let k = 0; k < N; k++) { p.push([r2(p[k]![0] + STEP * Math.cos(rad(h))), r2(p[k]![1] + STEP * Math.sin(rad(h)))]); h += 45 } return p })()
const ODOM: Pt[] = TRUE.map((p, i) => [r2(p[0] + i * D[0] + wob(i)[0]), r2(p[1] + i * D[1] + wob(i)[1])])
const DRIFT: Pt = [r2(ODOM[N]![0] - TRUE[0]![0]), r2(ODOM[N]![1] - TRUE[0]![1])]
const CORR: Pt[] = ODOM.map((p, i) => [r2(p[0] - (i / N) * DRIFT[0]), r2(p[1] - (i / N) * DRIFT[1])])
const meanErr = (path: Pt[]) => r2(path.reduce((a, p, i) => a + Math.hypot(p[0] - TRUE[i]![0], p[1] - TRUE[i]![1]), 0) / path.length)
const ERR_O = meanErr(ODOM), ERR_C = meanErr(CORR)

export const slamKernel: Kernel<SLAMState> = {
  kind: 'slam',
  compile(_doc: SimDocument): CompiledModel<SLAMState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'truePath'>) => frames.push({ step: frames.length, truePath: TRUE, ...f })

    push({
      phase: 'intro', op: 'intro', odom: [ODOM[0]!], corrected: null, poseNo: 0, drift: null, driftMag: 0, errOdom: 0, errCorr: 0,
      focus: 'SLAM：里程计漂移让轨迹不闭合，回环把误差分摊回去、拉闭合',
      log: `**SLAM：回环校正**\nSLAM = 一边估计轨迹、一边建地图。难题是**里程计漂移**：轮子打滑等系统误差**逐步累积**，走越久偏越多。\n机器人沿**八边形**走一圈回到起点。看里程计怎么一步步偏、回环怎么把它拉回来。`,
    })

    // —— 走一圈，里程计逐步累积漂移 ——
    for (let k = 1; k <= N; k++) {
      const odomSoFar = ODOM.slice(0, k + 1)
      const gap = r2(Math.hypot(ODOM[k]![0] - TRUE[k]![0], ODOM[k]![1] - TRUE[k]![1]))
      push({
        phase: 'walk', op: 'step', odom: odomSoFar.map(p => [...p] as Pt), corrected: null, poseNo: k, drift: null, driftMag: 0, errOdom: 0, errCorr: 0,
        focus: `走到位姿 ${k}：里程计 (${ODOM[k]![0]}, ${ODOM[k]![1]})，已偏离真实 ${gap}`,
        log: `**走第 ${k} 步**\n里程计估计位置 (${ODOM[k]![0]}, ${ODOM[k]![1]})，真实位置 (${TRUE[k]![0]}, ${TRUE[k]![1]})——**已偏离 ${gap}**。\n系统漂移每步累积，${k === N ? '走完一圈：终点本该回到起点 (0,0)，里程计却停在 ' + `(${ODOM[N]![0]}, ${ODOM[N]![1]})` + '——回环没闭合。' : '越走越偏、还在攒。'}`,
      })
    }

    // —— 回环检测 ——
    push({
      phase: 'loopclose', op: 'loopclose', odom: ODOM.map(p => [...p] as Pt), corrected: null, poseNo: N, drift: DRIFT, driftMag: r2(Math.hypot(DRIFT[0], DRIFT[1])), errOdom: ERR_O, errCorr: 0,
      focus: `回环检测：认出回到起点 → 漂移 = (${DRIFT[0]}, ${DRIFT[1]})，大小 ${r2(Math.hypot(DRIFT[0], DRIFT[1]))}`,
      log: `**回环检测（loop closure）**\n机器人看到**起点附近相同的地标**，认出"我回到走过的地方了" → 加一条约束：**终点应当 = 起点 (0,0)**。\n但里程计说终点在 (${ODOM[N]![0]}, ${ODOM[N]![1]}) → 这个缺口 = **累计漂移 (${DRIFT[0]}, ${DRIFT[1]})、大小 ${r2(Math.hypot(DRIFT[0], DRIFT[1]))}**。里程计轨迹的平均误差 ${ERR_O}。`,
    })

    // —— 位姿图优化：分摊校正 ——
    push({
      phase: 'done', op: 'summary', odom: ODOM.map(p => [...p] as Pt), corrected: CORR.map(p => [...p] as Pt), poseNo: N, drift: DRIFT, driftMag: r2(Math.hypot(DRIFT[0], DRIFT[1])), errOdom: ERR_O, errCorr: ERR_C,
      focus: `位姿图优化：漂移按 i/N 分摊回每个位姿 → 环闭合，误差 ${ERR_O} → ${ERR_C}`,
      log: `**位姿图优化：把漂移分摊回整条轨迹**\n回环约束说"终点=起点"，优化就把这 ${r2(Math.hypot(DRIFT[0], DRIFT[1]))} 的漂移**按位置比例(第 i 个位姿摊 i/N)分摊回整条轨迹**——起点不动、越靠后拉得越多。于是：\n· 终点回到 (0,0)，**回环闭合**；\n· 之前的累计漂移被大幅抹平：轨迹平均误差从 **${ERR_O} 骤降到 ${ERR_C}**。\n\n**要点**：这就是 SLAM 精度的关键一跃——单靠里程计必然漂移、越走越偏；**回环检测**认出旧地、加一条"这里=那里"的约束，**位姿图优化**把误差分摊回整条轨迹、一次性拉正。本例用最简的按比例分摊(线性松弛)演示直觉；真实 SLAM 是 SE(2)/SE(3) 上的**非线性最小二乘**(g2o/GTSAM/Ceres)，同时优化位姿和地标、含朝向、按边的信息矩阵加权。前端(找回环/配准)靠 ICP 那样的扫描匹配或视觉词袋；卡尔曼是它的滤波式近似(EKF-SLAM)。这是扫地机、自动驾驶、无人机建图的地基。没有回环，地图会一直漂；一旦闭环，全局一致。`,
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, truePath: TRUE, odom: [ODOM[0]!], corrected: null, poseNo: 0, drift: null, driftMag: 0, errOdom: 0, errCorr: 0, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'SLAM 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
