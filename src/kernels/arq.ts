/**
 * 内核：滑动窗口 ARQ —— 后退 N 帧(GBN) / 选择重传(SR) / 停止等待(SW)
 * 轴：time（时隙）
 *
 * 这个内核跟 sort/dijkstra/banker 不同：它是真正的逐时隙推进，
 * step() 只读 prev，不预算。信道里的在途帧就存在状态里。
 *
 * 停止等待 = 窗口为 1 的 GBN，所以不单独写分支，只在参数上限死 windowSize=1。
 *
 * entities：{ type:'loss', id:'f3', attrs:{ target:'frame'|'ack', seq:3, nth:1 } }
 *   —— 第 nth 次传输该序号时丢失（默认 1，即首传丢）。重传就能过去。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

/** 信道中的一份在途报文 */
export type InFlight = {
  kind: 'frame' | 'ack'
  seq: number
  /** 还有几个时隙到达 */
  eta: number
  /** 注定丢失 —— 到达前就标好，视图可以画成半路消失 */
  doomed: boolean
}

export type ArqState = {
  i: number
  /** 发送窗口左边界（最早未确认帧） */
  base: number
  /** 下一个要发的序号 */
  next: number
  /** 接收方期待的序号（GBN）/ 接收窗口左边界（SR） */
  expected: number
  /** SR 的接收缓存：已收到但未按序交付的序号 */
  buffered: number[]
  /** 已交付上层的帧数 */
  delivered: number
  inFlight: InFlight[]
  /** seq → 还剩几个时隙超时；只对已发未确认的帧有效 */
  timers: Record<string, number>
  /** 每个序号已经被发过几次 */
  sent: Record<string, number>
  /** 本时隙发生的事件类型，视图据此上色 */
  event: 'send' | 'resend' | 'recv' | 'ack' | 'drop' | 'timeout' | 'idle' | 'done'
  transmissions: number
  log: string
}

export const ARQ_VISIBLE = [
  'i', 'base', 'next', 'expected', 'buffered', 'delivered',
  'inFlight', 'timers', 'sent', 'event', 'transmissions', 'log',
] as const

export const arqKernel: Kernel<ArqState> = {
  kind: 'arq',

  compile(doc: SimDocument): CompiledModel<ArqState> {
    const protocol = str(doc.params, 'protocol')          // 'GBN' | 'SR' | 'SW'
    const total = num(doc.params, 'totalFrames')
    const delay = num(doc.params, 'delay')                // 单程传播时隙
    const timeout = num(doc.params, 'timeout')            // 超时时隙
    const wRaw = num(doc.params, 'windowSize')
    const W = protocol === 'SW' ? 1 : wRaw
    const rw = protocol === 'SR' ? W : 1                  // 接收窗口

    /** 丢失表：`${target}:${seq}:${nth}` */
    const losses = new Set(
      doc.entities.filter(e => e.type === 'loss').map(e => {
        const target = str(e.attrs, 'target')
        const seq = Number(e.attrs.seq)
        const nth = Number(e.attrs.nth ?? 1)
        return `${target}:${seq}:${nth}`
      }),
    )
    const willDrop = (kind: string, seq: number, nth: number) =>
      losses.has(`${kind}:${seq}:${nth}`)

    const initial = (): ArqState => ({
      i: -1, base: 0, next: 0, expected: 0, buffered: [], delivered: 0,
      inFlight: [], timers: {}, sent: {}, event: 'idle', transmissions: 0, log: '',
    })

    return {
      axis: { kind: 'time', label: '时隙', unit: '个' },
      initial,
      describe: s => s.log,

      step(prev) {
        const p = prev ?? initial()
        if (p.event === 'done') return null

        // 全部深拷贝 —— 状态自足是铁律（标准 2）
        const s: ArqState = {
          i: p.i + 1,
          base: p.base, next: p.next, expected: p.expected,
          buffered: [...p.buffered], delivered: p.delivered,
          inFlight: p.inFlight.map(f => ({ ...f })),
          timers: { ...p.timers }, sent: { ...p.sent },
          event: 'idle', transmissions: p.transmissions, log: '',
        }
        const notes: string[] = []

        // ── 1. 信道推进一格，处理到达 ──────────────────────
        const arrived: InFlight[] = []
        const still: InFlight[] = []
        for (const f of s.inFlight) {
          const eta = f.eta - 1
          if (eta > 0) { still.push({ ...f, eta }); continue }
          if (f.doomed) {
            s.event = 'drop'
            notes.push(`${f.kind === 'frame' ? '帧' : 'ACK'} ${f.seq} 在信道中丢失`)
            continue
          }
          arrived.push({ ...f, eta: 0 })
        }
        s.inFlight = still

        for (const f of arrived) {
          if (f.kind === 'frame') {
            // ── 接收方 ──
            const inRecvWindow = f.seq >= s.expected && f.seq < s.expected + rw
            if (f.seq === s.expected) {
              s.expected++
              s.delivered++
              // SR：把缓存里连上的一并交付
              while (s.buffered.includes(s.expected)) {
                s.buffered = s.buffered.filter(x => x !== s.expected)
                s.expected++
                s.delivered++
              }
              s.event = 'recv'
              notes.push(`收到帧 ${f.seq}，按序，交付上层；期待变为 ${s.expected}`)
            } else if (protocol === 'SR' && inRecvWindow) {
              if (!s.buffered.includes(f.seq)) s.buffered.push(f.seq)
              s.buffered.sort((a, b) => a - b)
              s.event = 'recv'
              notes.push(`收到帧 ${f.seq}，失序但在接收窗口内，缓存下来（SR 不丢）`)
            } else {
              s.event = 'recv'
              notes.push(
                protocol === 'SR'
                  ? `收到帧 ${f.seq}，落在接收窗口外，丢弃`
                  : `收到帧 ${f.seq}，但期待的是 ${s.expected}，GBN 直接丢弃并重复确认`,
              )
            }
            /**
             * 回 ACK —— 两个协议在这里分家，而且这就是它们全部差别的根源：
             *   SR  逐帧确认，收到哪个确认哪个（含重复帧也要再确认一次，否则发送方死等）
             *   GBN 累积确认 expected-1，一个 ACK 顶掉它之前的所有帧
             */
            const ackSeq = protocol === 'SR' ? f.seq : s.expected - 1
            if (ackSeq >= 0) {
              const nth = (s.sent[`ack${ackSeq}`] ?? 0) + 1
              s.sent[`ack${ackSeq}`] = nth
              s.inFlight.push({
                kind: 'ack', seq: ackSeq, eta: delay,
                doomed: willDrop('ack', ackSeq, nth),
              })
              notes.push(`发回 ACK ${ackSeq}`)
            }
          } else {
            // ── 发送方收 ACK ──
            if (protocol === 'SR') {
              delete s.timers[String(f.seq)]
              notes.push(`收到 ACK ${f.seq}，该帧确认`)
              // base 向右推到第一个仍有计时器的序号
              while (s.base < s.next && s.timers[String(s.base)] === undefined) s.base++
            } else {
              if (f.seq >= s.base) {
                for (let k = s.base; k <= f.seq; k++) delete s.timers[String(k)]
                notes.push(`收到累积 ACK ${f.seq}，${s.base}..${f.seq} 全部确认，窗口右移`)
                s.base = f.seq + 1
              } else {
                notes.push(`收到重复 ACK ${f.seq}，窗口不动`)
              }
            }
            s.event = 'ack'
          }
        }

        // ── 2. 超时检查 ────────────────────────────────────
        let timedOut: number | null = null
        for (const k of Object.keys(s.timers)) {
          s.timers[k] -= 1
          if (s.timers[k] <= 0 && timedOut === null) timedOut = Number(k)
        }
        if (timedOut !== null) {
          s.event = 'timeout'
          if (protocol === 'SR') {
            const nth = (s.sent[`f${timedOut}`] ?? 0) + 1
            s.sent[`f${timedOut}`] = nth
            s.transmissions++
            s.timers[String(timedOut)] = timeout
            s.inFlight.push({
              kind: 'frame', seq: timedOut, eta: delay,
              doomed: willDrop('frame', timedOut, nth),
            })
            notes.push(`帧 ${timedOut} 超时 —— SR 只重传它这一帧`)
          } else {
            const from = s.base, to = s.next - 1
            // 回退 N 帧：base..next-1 全部重发，且信道里的旧副本作废
            s.inFlight = s.inFlight.filter(f => f.kind !== 'frame')
            for (let k = from; k <= to; k++) {
              const nth = (s.sent[`f${k}`] ?? 0) + 1
              s.sent[`f${k}`] = nth
              s.transmissions++
              s.timers[String(k)] = timeout
              s.inFlight.push({
                kind: 'frame', seq: k, eta: delay,
                doomed: willDrop('frame', k, nth),
              })
            }
            notes.push(`帧 ${from} 超时 —— GBN 回退 N 帧，${from}..${to} 共 ${to - from + 1} 帧全部重发`)
          }
        }

        // ── 3. 发新帧（每时隙至多一个）────────────────────
        if (timedOut === null && s.next < total && s.next < s.base + W) {
          const seq = s.next
          const nth = (s.sent[`f${seq}`] ?? 0) + 1
          s.sent[`f${seq}`] = nth
          s.transmissions++
          s.timers[String(seq)] = timeout
          s.inFlight.push({
            kind: 'frame', seq, eta: delay,
            doomed: willDrop('frame', seq, nth),
          })
          s.next++
          if (s.event === 'idle') s.event = 'send'
          notes.push(`发送帧 ${seq}（窗口 [${s.base}, ${s.base + W - 1}]）`)
        }

        // ── 4. 收敛判定 ────────────────────────────────────
        const finished = s.delivered >= total && s.inFlight.length === 0
        if (finished) {
          s.event = 'done'
          notes.push(`全部 ${total} 帧已交付，共传输 ${s.transmissions} 次（含重传 ${s.transmissions - total} 次）`)
        }
        if (notes.length === 0) notes.push('窗口已满且无事件，等待 ACK')

        s.log = notes.join('；')
        return { state: s, done: finished }
      },
    }
  },
}
