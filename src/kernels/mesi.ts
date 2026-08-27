/**
 * 内核：MESI 缓存一致性协议（并发编程 / 组成原理 · 后端面试核心）
 * 轴：step —— 两个核对同一个变量 x 读写，看每个核缓存行的 M/E/S/I 状态怎么转
 *
 * 多核各有自己的缓存,同一个 x 可能在好几个核里都有副本。谁改了别人怎么知道?——MESI 协议:
 *   M(Modified)  已改、脏(和内存不一致),独占;   E(Exclusive) 干净、独占,只有我有;
 *   S(Shared)    干净,可能多核共享(只读);        I(Invalid)   无效,得重新加载。
 * 关键规则:
 *   读未命中 → 若别人有 M 先回写内存、大家降到 S;别人有则一起 S;没人有则我独占 E。
 *   写 → 先让**其它核的副本全失效(Invalidate)**,自己升到 M。
 *
 * 招牌时刻:C1 写 x,C2 手里的副本立刻被**置为 I(失效)**——C2 下次读必须重新加载。
 * 这就是「一个核的写为什么另一个核不会立刻看见」的硬件真相,也是 volatile / 内存屏障存在的理由。
 *
 * 值全部可核:每个核的状态与值、内存里的 x、总线消息、失效次数都在状态里,照规则一步步推得出。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Core = { id: number; state: 'M' | 'E' | 'S' | 'I'; value: number }

export type MesiState = {
  i: number
  step: number
  memX: number
  cores: Core[]
  cur: number               // 本步动作的核（0 = 无）
  op: string                // 'read' | 'write' | 'done'
  bus: string               // 本步总线消息
  invalidated: number       // 累计失效次数
  phase: 'run' | 'done'
  log: string
}

export const MESI_VISIBLE = [
  'step', 'memX', 'cores', 'cur', 'op', 'bus', 'invalidated', 'phase', 'log',
] as const

type Frame = Omit<MesiState, 'i'>

type Op = { c: number; k: 'read' | 'write'; v?: number }
const SCHEDULE: Op[] = [
  { c: 1, k: 'read' },              // C1 独占 E
  { c: 2, k: 'read' },              // C2 来读 → 都降 S
  { c: 1, k: 'write', v: 1 },       // C1 写 → C2 失效, C1 升 M
  { c: 2, k: 'read' },              // C2 来读 → C1 的 M 回写, 都 S
  { c: 2, k: 'write', v: 2 },       // C2 写 → C1 失效, C2 升 M
]

const clone = (cs: Core[]) => cs.map(c => ({ ...c }))

export const mesiKernel: Kernel<MesiState> = {
  kind: 'mesi',

  compile(_doc: SimDocument): CompiledModel<MesiState> {
    const frames: Frame[] = []
    let memX = 0, invalidated = 0
    const cores: Core[] = [
      { id: 1, state: 'I', value: -1 },
      { id: 2, state: 'I', value: -1 },
    ]
    const C = (id: number) => cores.find(c => c.id === id)!

    for (const op of SCHEDULE) {
      const ci = C(op.c)
      let bus = '', log = ''
      if (op.k === 'read') {
        if (ci.state !== 'I') {
          bus = '命中'
          log = `C${op.c} 读 x：本地缓存命中(状态 ${ci.state}，值 ${ci.value})，不上总线。`
        } else {
          bus = 'BusRd'
          const other = cores.find(c => c.id !== op.c && c.state !== 'I')
          if (other) {
            if (other.state === 'M') { memX = other.value; bus = 'BusRd（触发对方回写内存）' }
            other.state = 'S'
            ci.value = memX; ci.state = 'S'
            log = `C${op.c} 读未命中 → 上总线 BusRd。C${other.id} 手里有${other.value === memX ? '' : '脏'}副本${bus.includes('回写') ? '，先回写内存' : ''} → 两个核都降为 **S(共享)**，值 ${ci.value}。`
          } else {
            ci.value = memX; ci.state = 'E'
            log = `C${op.c} 读未命中 → 上总线 BusRd，没有别的核持有 → C${op.c} **独占 E**，从内存load值 ${ci.value}。`
          }
        }
      } else {
        bus = 'BusRdX / Invalidate'
        const killed: number[] = []
        for (const c of cores) if (c.id !== op.c && c.state !== 'I') { c.state = 'I'; c.value = -1; invalidated++; killed.push(c.id) }
        ci.value = op.v!; ci.state = 'M'
        log = `C${op.c} 写 x=${op.v} → 上总线 Invalidate,${killed.length ? `把 C${killed.join('、C')} 的副本**置为 I(失效)**;` : ''} C${op.c} 升为 **M(已改·脏)**,值 ${op.v}。` +
          (killed.length ? `——被失效的核下次读只能重新加载。` : '')
      }
      frames.push({
        step: frames.length, memX, cores: clone(cores),
        cur: op.c, op: op.k, bus, invalidated, phase: 'run', log,
      })
    }

    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, cores: clone(cores), cur: 0, op: 'done', bus: '', phase: 'done',
      log: `**招牌时刻**：只要有核写 x,其它核手里的副本立刻被置为 **I(失效)**——本例共失效 **${invalidated}** 次。所以「一个核的写,另一个核不会自动立刻看见」,得等它重新加载。这就是缓存一致性协议在硬件层做的事,也是 volatile / 内存屏障要存在的原因。终态:内存 x=${memX}，两核状态见上(脏值还在某个核的 M 里没落内存)。`,
    })

    const base0: Frame = {
      step: -1, memX: 0,
      cores: [{ id: 1, state: 'I', value: -1 }, { id: 2, state: 'I', value: -1 }],
      cur: 0, op: '', bus: '', invalidated: 0, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '访问步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 }
      },
    }
  },
}
