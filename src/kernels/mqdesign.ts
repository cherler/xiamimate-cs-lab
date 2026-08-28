/**
 * 内核：消息队列 · 分区日志 + 消费位移真仿真 —— 生产者追加带 offset 的日志，消费者靠自己的 offset 读（对标 Kafka）（后端 · 系统设计）
 * 轴：step —— 按 key 哈希分区、append 到分区日志（各得单调 offset），消费组各自维护 offset 前进；读不删除 → 多组独立消费/可回放
 *
 * 消息队列的核心机制不是"画生产者→Broker→消费者",是一个具体数据结构:**append-only 分区日志 + 消费位移(offset)**。
 *   · 生产:按 key 哈希选分区,消息**追加**到该分区日志尾部、得到一个**单调递增的 offset**。同 key 同分区 → 该 key 的消息在分区内**严格有序**(顺序保证是"分区内"、不是全局)。
 *   · 消费:消息读走后**不删除**,一直留在日志里。消费者自己记一个 **offset**(读到哪了),poll 一条就把 offset+1。
 *     所以:①不同消费组各有独立 offset → 同一条消息被每个组都消费一遍(发布订阅);②把 offset 往回拨就能**重放**历史。
 * 本仿真真跑:5 条带 key 的消息哈希分区追加(看 offset 怎么长、同 key 怎么落同分区保持有序),
 * 消费组 G1 逐条 poll(看 offset 前进),再让消费组 G2 从 0 开始读同一批(消息还在 → 独立消费)。offset/分区全真算。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Msg = { offset: number; key: string; val: string }
export type MqState = {
  i: number
  step: number
  phase: 'intro' | 'produce' | 'consume' | 'group2' | 'done'
  op: 'intro' | 'append' | 'poll' | 'summary'
  P: number                                          // 分区数
  parts: { id: number; log: Msg[] }[]               // 各分区 append-only 日志（累积）
  produce: { key: string; hash: number; part: number; offset: number; val: string } | null  // 本步追加
  groups: { name: string; offsets: number[] }[]     // 各消费组、各分区的 offset（下一个要读的位置）
  active: string                                    // 当前活动的消费组
  poll: { group: string; part: number; offset: number; key: string; val: string } | null    // 本步读到的
  focus: string
  log: string
}
type Frame = Omit<MqState, 'i'>

const P = 2
const hashKey = (k: string): number => [...k].reduce((a, c) => a + c.codePointAt(0)!, 0)
const MSGS: { key: string; val: string }[] = [
  { key: 'A', val: '下单#1' },
  { key: 'B', val: '下单#2' },
  { key: 'A', val: '付款#1' },
  { key: 'C', val: '下单#3' },
  { key: 'B', val: '退款#2' },
]
// G1 消费顺序：先读满 p1，再读 p0（展示每个分区 offset 各自前进）
const G1_POLL: number[] = [1, 1, 1, 0, 0]

export const mqdesignKernel: Kernel<MqState> = {
  kind: 'mqdesign',
  compile(_doc: SimDocument): CompiledModel<MqState> {
    const frames: Frame[] = []
    const snapParts = (ps: { id: number; log: Msg[] }[]) => ps.map(p => ({ id: p.id, log: p.log.map(m => ({ ...m })) }))
    const snapGroups = (gs: { name: string; offsets: number[] }[]) => gs.map(g => ({ name: g.name, offsets: [...g.offsets] }))
    const push = (f: Omit<Frame, 'step' | 'P'>) => frames.push({ step: frames.length, P, ...f })

    const parts: { id: number; log: Msg[] }[] = [{ id: 0, log: [] }, { id: 1, log: [] }]
    const groups = [{ name: 'G1', offsets: [0, 0] }, { name: 'G2', offsets: [0, 0] }]

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', parts: snapParts(parts), produce: null, groups: snapGroups(groups), active: '', poll: null,
      focus: '核心机制=append-only 分区日志 + 消费位移(offset)',
      log: `**消息队列：核心机制**\n不是"画生产者→Broker→消费者"，是一个数据结构：**append-only 分区日志 + 消费位移**。\n· 生产：按 key 哈希选分区，消息**追加**到日志尾、得单调 **offset**；同 key 同分区 → 分区内严格有序。\n· 消费：读走**不删除**，消费者自己记 **offset**（读到哪）；不同组独立 offset → 各消费一遍（发布订阅）、往回拨 offset → 重放。\n先把 ${MSGS.length} 条消息哈希分区追加，再让两个消费组各自读。`,
    })

    // —— 第一幕：生产追加 ——
    MSGS.forEach(m => {
      const h = hashKey(m.key)
      const pid = h % P
      const offset = parts[pid]!.log.length          // 该分区下一个 offset = 当前长度
      parts[pid]!.log.push({ offset, key: m.key, val: m.val })
      const sameKeyBefore = parts[pid]!.log.filter(x => x.key === m.key).length > 1
      push({
        phase: 'produce', op: 'append', parts: snapParts(parts), produce: { key: m.key, hash: h, part: pid, offset, val: m.val }, groups: snapGroups(groups), active: '', poll: null,
        focus: `追加「${m.val}」(key=${m.key}) → 分区 ${pid}、offset ${offset}`,
        log: `**生产：追加「${m.val}」**\nkey=${m.key}，\`hash=${h} % ${P} = ${pid}\` → 追加到**分区 ${pid}** 日志尾，拿到 **offset ${offset}**。${sameKeyBefore ? `\n注意：key=${m.key} 之前的消息也在分区 ${pid}（同 key 同分区），所以 key=${m.key} 的消息在分区内**严格按追加顺序**排列 —— 这就是 MQ 的顺序保证：**分区内有序**，不是全局有序。` : `\noffset 在**分区内**单调递增（分区 ${pid} 现在有 ${parts[pid]!.log.length} 条）。`}`,
      })
    })

    // —— 第二幕：消费组 G1 逐条 poll ——
    G1_POLL.forEach(pid => {
      const g = groups[0]!
      const off = g.offsets[pid]!
      const msg = parts[pid]!.log[off]!
      g.offsets[pid] = off + 1                        // poll 一条，offset 前进
      push({
        phase: 'consume', op: 'poll', parts: snapParts(parts), produce: null, groups: snapGroups(groups), active: 'G1',
        poll: { group: 'G1', part: pid, offset: off, key: msg.key, val: msg.val },
        focus: `G1 从分区 ${pid}@offset ${off} 读「${msg.val}」→ offset 前进到 ${off + 1}`,
        log: `**G1 消费：分区 ${pid} @ offset ${off}**\nG1 在分区 ${pid} 的 offset 是 **${off}** → 读到「${msg.val}」(key=${msg.key})，处理完把 offset **提交为 ${off + 1}**（下次从这读）。\n消息**没被删除**，还在日志里 —— offset 只是 G1 自己的一个游标。`,
      })
    })

    // —— 第三幕：消费组 G2 从头读，证明消息还在、组间独立 ——
    {
      const g = groups[1]!
      const pid = 1, off = 0
      const msg = parts[pid]!.log[off]!
      g.offsets[pid] = off + 1
      push({
        phase: 'group2', op: 'poll', parts: snapParts(parts), produce: null, groups: snapGroups(groups), active: 'G2',
        poll: { group: 'G2', part: pid, offset: off, key: msg.key, val: msg.val },
        focus: `G2 从分区 ${pid}@offset 0 也能读到「${msg.val}」（消息还在、组间独立）`,
        log: `**G2 消费：从 offset 0 开始**\n换一个消费组 G2，它的 offset 从 **0** 起。G1 早就读过分区 ${pid} 的 offset 0 了，但消息**没删**，所以 G2 照样读到「${msg.val}」。\n**两个组各有独立 offset** → 同一条消息被每个组都消费一遍（发布订阅）。把某个组的 offset 往回拨，就能**重放**历史消息（Kafka 的杀手锏）。`,
      })
    }

    // —— 收尾 ——
    push({
      phase: 'done', op: 'summary', parts: snapParts(parts), produce: null, groups: snapGroups(groups), active: '', poll: null,
      focus: 'append-only 日志保顺序高吞吐；offset 归消费者 → 独立消费/重放；分区=扩展+分区内有序',
      log: `**小结：MQ 靠日志 + offset**\n① **append-only 分区日志**：只追加、顺序写盘 → 高吞吐；每条有单调 offset。② **offset 归消费者**：读不删除、消费者自己记读到哪 → 不同组独立消费（发布订阅）、offset 回拨即重放、消费失败重读。③ **分区**：一个 topic 切多分区并行扩展；按 key 哈希路由 → 同 key 同分区、**分区内有序**（全局有序做不到，除非只用一个分区、牺牲并行）。\n面试延伸：怎么保证不丢（生产 acks + 多副本 ISR、消费提交 offset 的时机——先处理后提交=至少一次、先提交后处理=至多一次）、重复消费怎么办（消费幂等）、为什么顺序只能到分区级、Kafka vs RabbitMQ（日志留存/重放 vs 传统队列即时投递）。`,
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, P, parts: [{ id: 0, log: [] }, { id: 1, log: [] }], produce: null, groups: [{ name: 'G1', offsets: [0, 0] }, { name: 'G2', offsets: [0, 0] }], active: '', poll: null, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'MQ 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
