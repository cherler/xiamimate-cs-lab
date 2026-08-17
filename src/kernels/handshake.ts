/**
 * 内核：TCP 连接管理（计算机网络 · 传输层）
 * 轴：step —— 每步是一个报文段的发出或到达
 *
 * 建连三次握手、断连四次挥手，两端的状态各自迁移。
 * 考点几乎都落在"**这一刻两端分别处于什么状态**"，
 * 所以状态机的两条泳道就是这个实验的主视图。
 *
 * 可选注入：报文丢失、以及 TIME_WAIT 的 2MSL 等待。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type Seg = {
  /** 方向 */
  dir: 'c2s' | 's2c'
  /** 标志位 */
  flags: string
  seq: number
  ack: number
  lost: boolean
}

export type HsState = {
  i: number
  client: string
  server: string
  /** 本步的报文段（等待类步骤为 null） */
  seg: Seg | null
  /** 本步是发出还是到达 */
  act: 'send' | 'arrive' | 'lost' | 'timeout' | 'wait' | 'done'
  /** 已经走过的报文段，供时序图画线 */
  history: Seg[]
  log: string
}

export const HS_VISIBLE = ['i', 'client', 'server', 'seg', 'act', 'history', 'log'] as const

type Frame = Omit<HsState, 'i'>

export const handshakeKernel: Kernel<HsState> = {
  kind: 'handshake',

  compile(doc: SimDocument): CompiledModel<HsState> {
    const scenario = str(doc.params, 'scenario')        // 'connect' | 'close' | 'both'
    const clientSeq = num(doc.params, 'clientSeq')
    const serverSeq = num(doc.params, 'serverSeq')
    /** 丢包：{ type:'loss', attrs:{ nth } } —— 第 nth 个报文段丢失 */
    const lostNth = new Set(
      doc.entities.filter(e => e.type === 'loss').map(e => Number(e.attrs.nth ?? 0)))

    const frames: Frame[] = []
    let client = 'CLOSED'
    let server = 'LISTEN'
    const history: Seg[] = []
    let nth = 0

    const put = (act: Frame['act'], log: string, seg: Seg | null = null) =>
      frames.push({ client, server, seg, act, history: history.map(s => ({ ...s })), log })

    /** 发一个报文段；返回它是否成功到达 */
    const send = (dir: Seg['dir'], flags: string, seq: number, ack: number, desc: string) => {
      nth++
      const lost = lostNth.has(nth)
      const seg: Seg = { dir, flags, seq, ack, lost }
      history.push(seg)
      put('send', `第 ${nth} 个报文段：${dir === 'c2s' ? '客户端 → 服务器' : '服务器 → 客户端'}`
        + ` ${flags}，seq=${seq}${ack >= 0 ? `，ack=${ack}` : ''} —— ${desc}`, seg)
      if (lost) {
        put('lost', `这个报文段在网络中丢失了 —— 对端什么都收不到，只能等超时重传`, seg)
        return false
      }
      return true
    }

    if (scenario === 'connect' || scenario === 'both') {
      put('wait', '初始：客户端 CLOSED，服务器执行被动打开，进入 LISTEN 等待连接')

      let ok = false
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        client = 'SYN_SENT'
        ok = send('c2s', 'SYN', clientSeq, -1,
          attempt === 1 ? '第一次握手：请求建立连接，SYN 要消耗一个序号'
            : `第 ${attempt} 次尝试（前一次超时重传）`)
        if (!ok) { put('timeout', '客户端等待超时，重发 SYN'); continue }
        server = 'SYN_RCVD'
        put('arrive', `服务器收到 SYN，进入 SYN_RCVD`)

        const ok2 = send('s2c', 'SYN+ACK', serverSeq, clientSeq + 1,
          '第二次握手：既确认对方的 SYN，也发出自己的 SYN')
        if (!ok2) { put('timeout', '客户端收不到应答，超时后重发 SYN'); server = 'LISTEN'; ok = false; continue }
        client = 'ESTABLISHED'
        put('arrive', `客户端收到 SYN+ACK，进入 ESTABLISHED —— 此时它已经可以发数据了`)

        const ok3 = send('c2s', 'ACK', clientSeq + 1, serverSeq + 1,
          '第三次握手：确认服务器的 SYN。纯 ACK 不消耗序号')
        if (!ok3) { put('timeout', '服务器收不到 ACK，超时后重发 SYN+ACK'); ok = false; continue }
        server = 'ESTABLISHED'
        put('arrive', `服务器收到 ACK，进入 ESTABLISHED —— 连接建立完成`)
      }
      put('wait', '为什么是三次而不是两次：第三次握手让服务器确认「客户端确实收到了我的应答」，'
        + '否则一个迟到的旧 SYN 会让服务器白白建立一条无人使用的连接')
    }

    if (scenario === 'close' || scenario === 'both') {
      if (scenario === 'close') { client = 'ESTABLISHED'; server = 'ESTABLISHED'; nth = 0; history.length = 0 }
      put('wait', '数据传输结束，客户端主动关闭')

      client = 'FIN_WAIT_1'
      send('c2s', 'FIN', clientSeq + 100, serverSeq + 1, '第一次挥手：我没有数据要发了')
      server = 'CLOSE_WAIT'
      put('arrive', '服务器收到 FIN，进入 CLOSE_WAIT —— 但它可能还有数据没发完')

      send('s2c', 'ACK', serverSeq + 1, clientSeq + 101, '第二次挥手：先确认，但还不关')
      client = 'FIN_WAIT_2'
      put('arrive', '客户端收到 ACK，进入 FIN_WAIT_2 —— 这时是半关闭：客户端不发了，服务器还能发')

      put('wait', '服务器把剩下的数据发完 —— 这段时间正是「为什么挥手要四次」的答案：'
        + '服务器的 FIN 不能和 ACK 合并，因为它还没准备好关')

      server = 'LAST_ACK'
      send('s2c', 'FIN', serverSeq + 50, clientSeq + 101, '第三次挥手：我也发完了')
      client = 'TIME_WAIT'
      put('arrive', '客户端收到 FIN，进入 TIME_WAIT')

      send('c2s', 'ACK', clientSeq + 101, serverSeq + 51, '第四次挥手：确认服务器的 FIN')
      server = 'CLOSED'
      put('arrive', '服务器收到 ACK，直接进入 CLOSED')

      put('wait', '客户端还要在 TIME_WAIT 等 2MSL：'
        + '一是保证最后那个 ACK 若丢失，对方重发 FIN 时自己还在、还能再确认；'
        + '二是让本连接的迟到报文在网络中消散，不污染下一条同四元组的连接')
      client = 'CLOSED'
      put('done', '2MSL 到期，客户端进入 CLOSED —— 连接彻底释放')
    }

    if (frames.length === 0) put('done', '没有场景')

    return {
      axis: { kind: 'step', label: '事件序号' },
      initial: () => ({
        i: -1, client: 'CLOSED', server: 'LISTEN', seg: null,
        act: 'wait', history: [], log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}

/** 状态迁移图上要画的节点，供视图共用 */
export const CLIENT_STATES = [
  'CLOSED', 'SYN_SENT', 'ESTABLISHED', 'FIN_WAIT_1', 'FIN_WAIT_2', 'TIME_WAIT',
] as const
export const SERVER_STATES = [
  'LISTEN', 'SYN_RCVD', 'ESTABLISHED', 'CLOSE_WAIT', 'LAST_ACK', 'CLOSED',
] as const
