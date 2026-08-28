/**
 * 内核：雪花算法 Snowflake —— 分布式下不靠中心协调，各机器自己发全局唯一 ID（后端 · 分布式系统）
 * 轴：step —— 展示 64 位布局，逐个生成 ID：同毫秒序号自增、新毫秒序号归零
 *
 * 分布式系统里每台机器都要发 ID，还要**全局唯一 + 大致按时间递增**，又不想每次都去问一个中心发号器(会成瓶颈)。
 * Snowflake 把一个 64 位整数切成三段自己拼:
 *   [1 符号位=0] [41 位毫秒时间戳] [10 位机器码] [12 位毫秒内序号]
 *   · 时间戳在高位 → ID 天然**趋势递增**(越晚生成越大)
 *   · 机器码不同 → 不同机器**绝不相撞**(无需协调)
 *   · 同一毫秒内 → 序号自增(12 位=4096 个/毫秒/机器);跨毫秒 → 序号归零
 * ID = (时间戳<<22) | (机器码<<12) | 序号。为了 JS 精确，用较小的相对时间戳，位布局是真的。
 * 值:每个 ID 由三段拼出、可逐段手核(同毫秒 ID 连续+1、新毫秒跳一大截)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type SnowflakeState = {
  i: number
  step: number
  op: 'intro' | 'gen' | 'same' | 'next'
  t: number             // 相对毫秒时间戳（41 位字段）
  dc: number            // 数据中心号（5 位）
  worker: number        // 机器号（5 位）
  machine: number       // dc<<5 | worker（10 位）
  seq: number           // 毫秒内序号（12 位）
  id: number            // 生成的 64 位 ID
  ids: { t: number; seq: number; id: number }[]
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<SnowflakeState, 'i'>

const P22 = 4194304   // 2^22（时间戳左移位数 = 机器10+序号12）
const P12 = 4096      // 2^12（机器码左移位数 = 序号12）
const DC = 1, WORKER = 2
const MACHINE = (DC << 5) | WORKER   // = 34
const bin = (n: number, w: number) => n.toString(2).padStart(w, '0')
const genId = (t: number, seq: number) => t * P22 + MACHINE * P12 + seq

export const snowflakeKernel: Kernel<SnowflakeState> = {
  kind: 'snowflake',
  compile(_doc: SimDocument): CompiledModel<SnowflakeState> {
    const frames: Frame[] = []
    const ids: { t: number; seq: number; id: number }[] = []
    const push = (f: Omit<Frame, 'step' | 'dc' | 'worker' | 'machine' | 'ids'>) =>
      frames.push({ step: frames.length, dc: DC, worker: WORKER, machine: MACHINE, ids: ids.map(x => ({ ...x })), ...f })

    push({ op: 'intro', t: 0, seq: 0, id: 0, phase: 'run', focus: '64 位切三段：时间戳 + 机器码 + 序号',
      log: `**Snowflake：自己拼一个全局唯一 ID**\n每台机器都要发 ID、还要唯一 + 按时间递增，又不想每次问中心发号器(会成瓶颈)。\n把 64 位整数切三段：\n[1 符号位=0] [**41 位** 毫秒时间戳] [**10 位** 机器码] [**12 位** 毫秒内序号]\nID = (时间戳<<22) | (机器码<<12) | 序号。本机机器码 = 数据中心 ${DC} << 5 | 机器 ${WORKER} = **${MACHINE}**（${bin(MACHINE, 10)}）。` })

    const emit = (t: number, seq: number, op: 'gen' | 'same' | 'next', focus: string, extra: string) => {
      const id = genId(t, seq); ids.push({ t, seq, id })
      push({ op, t, seq, id, phase: 'run', focus,
        log: `**t=${t}ms，序号=${seq}**\nID = 时间戳<<22 | 机器<<12 | 序号\n= ${t}×2²² + ${MACHINE}×2¹² + ${seq} = **${id}**\n拆开：时间 ${t} | 机器 ${bin(MACHINE, 10)} | 序号 ${bin(seq, 12)}\n${extra}` })
    }

    emit(1000, 0, 'gen', 't=1000ms 的第 1 个 ID', '毫秒内第一个，序号从 0 开始。')
    emit(1000, 1, 'same', '同一毫秒的第 2 个 → 序号自增', '还是 t=1000ms → 序号 +1，ID 只比上一个大 1，同毫秒也不会撞。')
    emit(1000, 2, 'same', '同一毫秒的第 3 个 → 序号再增', '12 位序号能撑 4096 个/毫秒/机器；用完了就等下一毫秒。')
    emit(1001, 0, 'next', '进入新毫秒 → 序号归零', '时间戳 +1、序号回 0。因为时间戳在高位，ID 跳了一大截、依然递增。')

    push({ op: 'next', t: 1001, seq: 0, id: genId(1001, 0), phase: 'done', focus: '全局唯一 + 趋势递增 + 零协调',
      log: `**Snowflake 的三个好处**\n· **全局唯一**：机器码这段不同 → 不同机器发的 ID 绝不相撞，不用互相协调。\n· **趋势递增**：时间戳在高位 → 越晚生成的 ID 越大（对数据库 B+树索引友好，插入几乎顺序追加）。\n· **高吞吐**：本地生成，一毫秒每台机 4096 个，不问中心、无瓶颈。\n\n**要小心时钟回拨**：ID 靠"时间戳只增"这个前提。要是机器时钟往回跳，可能生成和过去重复的 ID——所以实现里要检测回拨、拒发或等待追平。这就是各家发号器（微博 Snowflake、美团 Leaf、百度 UidGenerator）的核心。` })

    const base0: Frame = { op: 'intro', step: -1, t: 0, dc: DC, worker: WORKER, machine: MACHINE, seq: 0, id: 0, ids: [], phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '生成步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
