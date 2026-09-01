/**
 * 内核：LeRobotDataset · delta_timestamps 时序窗口 —— 策略要的"一段历史观测 / 一整块未来动作"，怎么从扁平表里取（具身智能 · 项目实战 / 面试八股）
 * 轴：step —— 秒→帧偏移(round(d·fps)) → 定位+episode边界钳 → pad 掩码 → 取出时序窗口。
 *
 * LeRobotDataset 把机器人数据标准化存：低维信号(state/action/时间戳)进 **parquet**、相机帧进 **mp4**、元数据(fps/统计量)进 meta/。
 * 但策略要的不是单帧，是**一段时序窗口**：ACT 要一整块未来动作、Diffusion 要几帧历史观测。**delta_timestamps** 就是这座桥：
 *   · 用户按"秒"给偏移(如 obs 要 [-0.06,-0.04,-0.02,0] 秒、action 块要未来 0~0.08 秒)；
 *   · **秒→帧**：delta_idx = **round(偏移 · fps)**(fps=50 → -0.06s = -3 帧)；合法性 |偏移·fps - round|/fps ≤ tol；
 *   · **定位+边界钳**：query = **clamp(当前帧 + delta, ep_start, ep_end-1)**——越出本 episode 就钳到边界帧；
 *   · **pad 掩码**：is_pad = (当前帧+delta 落在 [ep_start,ep_end) 外)——被钳的那些标 True，**训练时按掩码排除、不污染 loss**。
 * ACT 的动作块正是 action_delta_indices = range(chunk_size) = [0..K-1]。切「位置」看开头/结尾的越界钳。偏移/钳/掩码全现算。连「ACT 动作分块」。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Pos = '靠开头' | '靠结尾'
export type Cell = { deltaS: number; deltaIdx: number; raw: number; query: number; pad: boolean }
export type DTState = {
  i: number
  step: number
  stage: 'intro' | 'sec2idx' | 'clamp' | 'pad' | 'done'
  pos: Pos
  fps: number
  epStart: number
  epEnd: number
  absIdx: number
  obs: Cell[]               // 历史观测窗口
  act: Cell[]               // 未来动作块
  showIdx: boolean          // 是否已算出帧偏移
  showClamp: boolean        // 是否已定位+钳
  showPad: boolean          // 是否已算掩码
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<DTState, 'i'>

const FPS = 50, EP_START = 100, EP_END = 160
const OBS_S = [-0.06, -0.04, -0.02, 0.0]        // 历史观测偏移（秒）
const ACT_S = [0.0, 0.02, 0.04, 0.06, 0.08]     // 未来动作块偏移（秒）K=5

function cells(deltasS: number[], fps: number, absIdx: number, epStart: number, epEnd: number): Cell[] {
  return deltasS.map(d => {
    const deltaIdx = Math.round(d * fps)
    const raw = absIdx + deltaIdx
    const query = Math.max(epStart, Math.min(epEnd - 1, raw))
    const pad = raw < epStart || raw >= epEnd
    return { deltaS: d, deltaIdx, raw, query, pad }
  })
}

export const deltatsKernel: Kernel<DTState> = {
  kind: 'deltats',
  compile(doc: SimDocument): CompiledModel<DTState> {
    const pos = (String(doc.params?.pos ?? '靠结尾') === '靠开头' ? '靠开头' : '靠结尾') as Pos
    const absIdx = pos === '靠开头' ? 102 : 158
    const obs = cells(OBS_S, FPS, absIdx, EP_START, EP_END)
    const act = cells(ACT_S, FPS, absIdx, EP_START, EP_END)

    const frames: Frame[] = []
    const b0 = { pos, fps: FPS, epStart: EP_START, epEnd: EP_END, absIdx, obs, act, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; showIdx: boolean; showClamp: boolean; showPad: boolean; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({ stage: 'intro', showIdx: false, showClamp: false, showPad: false, focus: `策略要"历史观测+未来动作块"，从扁平 parquet 表里取一段时序窗口（当前帧 ${absIdx}，${pos}）`,
      log: `**delta_timestamps：从扁平表取时序窗口**\nLeRobotDataset 把数据标准化存：低维(state/action)进 **parquet**、图像进 **mp4**、fps/统计量进 meta/。但策略要的不是单帧，是**一段窗口**：\n· 历史观测：${OBS_S.join(', ')} 秒；· 未来动作块(ACT chunk)：${ACT_S.join(', ')} 秒。\n当前采样帧 = **${absIdx}**，本 episode = 帧 [${EP_START}, ${EP_END})，fps=**${FPS}**。看它怎么把"秒"翻成帧、越界怎么办。` })

    push({ stage: 'sec2idx', showIdx: true, showClamp: false, showPad: false, focus: `秒→帧：delta_idx = round(偏移 × fps=${FPS})`,
      log: `**① 秒 → 帧偏移**\ndelta_idx = **round(偏移 × fps)**。fps=${FPS}：\n观测：${obs.map(c => `${c.deltaS}s→${c.deltaIdx}`).join('、')}；动作块：${act.map(c => `${c.deltaS}s→${c.deltaIdx}`).join('、')}。\n(合法性:|偏移·fps − round|/fps ≤ 容差 1e-4，保证偏移正好落在某一帧上。用 fps 换算 = 不同采集频率的数据集通用。)` })

    push({ stage: 'clamp', showIdx: true, showClamp: true, showPad: false, focus: `定位+边界钳：query = clamp(当前帧 ${absIdx} + delta, ${EP_START}, ${EP_END - 1})`,
      log: `**② 定位 + episode 边界钳**\n目标帧 = 当前帧 ${absIdx} + delta_idx；再 **clamp 到本 episode [${EP_START}, ${EP_END - 1}]**——越出这一条轨迹就钳到边界帧(不能借用别的 episode 的帧)。\n${pos === '靠开头'
        ? `本例靠开头：观测里 ${absIdx}${obs[0]!.deltaIdx}=${obs[0]!.raw} < ${EP_START} → 钳到 ${EP_START}；动作块都在界内。`
        : `本例靠结尾：动作块里 ${absIdx}+${act[act.length - 1]!.deltaIdx}=${act[act.length - 1]!.raw} ≥ ${EP_END} → 钳到 ${EP_END - 1}；观测都在界内。`}` })

    const obsPad = obs.filter(c => c.pad).length, actPad = act.filter(c => c.pad).length
    push({ stage: 'pad', showIdx: true, showClamp: true, showPad: true, focus: `pad 掩码：越界那些标 True（观测 ${obsPad} 个、动作块 ${actPad} 个）`,
      log: `**③ pad 掩码**\nis_pad = (目标帧落在 [${EP_START}, ${EP_END}) 外)。被钳的那些标 **True**：观测 ${obsPad} 个、动作块 ${actPad} 个。\n关键:这个布尔掩码 (key_is_pad) 会**喂给 loss**——训练时把 padding 的帧**排除**，不让"边界处借来的重复帧"污染梯度。ACT/Diffusion 都用它。` })

    push({ stage: 'done', showIdx: true, showClamp: true, showPad: true, phase: 'done', focus: `完：秒→帧→钳→掩码，取出时序窗口；ACT 动作块 = range(K)`,
      log: `**小结:delta_timestamps 是"要窗口"到"取哪些帧"的桥**\n① **秒→帧**:round(偏移·fps)——fps 换算让不同频率数据集通用。\n② **边界钳**:clamp 进本 episode[${EP_START},${EP_END}),越界钳到边界帧、不跨轨迹。\n③ **pad 掩码**:越界标 True、喂 loss 排除、不污染训练。\n**和 ACT 的联系**:ACT 的动作块就是 \`action_delta_indices = list(range(chunk_size))\` = [0..K-1](未来 K 帧)；这一课就是"那一整块动作在数据侧怎么被取出来的"。面试延伸:为何 parquet 存低维、mp4 存图像(图像占绝大多数体积、要压缩)；episode 边界为何要钳+掩码;fps 为何要记进 meta。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, showIdx: false, showClamp: false, showPad: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '取帧步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
