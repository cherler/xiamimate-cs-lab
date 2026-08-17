/**
 * 内核：CSMA/CD 与二进制指数退避（计算机网络 · 数据链路层）
 * 轴：time（争用期为单位）
 *
 * 考点集中在退避算法本身：
 *   第 n 次冲突后，从 {0, 1, …, 2^k − 1} 里随机取 r（k = min(n, 10)），
 *   退避 r 个争用期（2τ）再重试；连续 16 次仍失败就放弃。
 *
 * "随机"在这里由文档给定（每站的 randomPicks），否则实验没法复现、也没法出题。
 */
import { num, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type CsmaState = {
  i: number
  slot: number
  /** 本时隙尝试发送的站 */
  sending: string[]
  /** 是否发生冲突 */
  collision: boolean
  /** 各站的冲突次数 */
  attempts: Record<string, number>
  /** 各站还要退避几个时隙 */
  backoff: Record<string, number>
  /** 本次退避各站取的 r 与取值范围上界 */
  picked: Record<string, string>
  /** 已成功发送的站 */
  done: string[]
  /** 放弃的站 */
  aborted: string[]
  log: string
}

export const CSMA_VISIBLE = [
  'i', 'slot', 'sending', 'collision', 'attempts', 'backoff',
  'picked', 'done', 'aborted', 'log',
] as const

type Frame = Omit<CsmaState, 'i'>

export const csmaKernel: Kernel<CsmaState> = {
  kind: 'csma',

  compile(doc: SimDocument): CompiledModel<CsmaState> {
    const maxAttempts = num(doc.params, 'maxAttempts')
    /** 各站：{ type:'station', id:'A', attrs:{ readyAt } }，randomPicks 给退避取值 */
    const stations = doc.entities.filter(e => e.type === 'station').map(e => ({
      id: e.id,
      readyAt: Number(e.attrs.readyAt ?? 0),
      picks: String(e.attrs.picks ?? '').split(/[,\s]+/).filter(Boolean).map(Number),
    }))

    const frames: Frame[] = []
    const attempts: Record<string, number> = {}
    const backoff: Record<string, number> = {}
    const done: string[] = []
    const aborted: string[] = []
    for (const s of stations) { attempts[s.id] = 0; backoff[s.id] = 0 }

    const put = (f: Partial<Frame> & { log: string }) => frames.push({
      slot: 0, sending: [], collision: false,
      attempts: { ...attempts }, backoff: { ...backoff }, picked: {},
      done: [...done], aborted: [...aborted], ...f,
    })

    put({ log: `共 ${stations.length} 个站争用同一条总线；`
      + `冲突后按二进制指数退避：第 n 次冲突从 {0 … 2^min(n,10)−1} 里取 r，等 r 个争用期` })

    let slot = 0
    while (done.length + aborted.length < stations.length && slot < 60) {
      slot++
      //  这一时隙能发的：已就绪、没退避、还没发成功也没放弃
      const ready = stations.filter(s =>
        s.readyAt <= slot && backoff[s.id] === 0 &&
        !done.includes(s.id) && !aborted.includes(s.id))

      if (ready.length === 0) {
        for (const s of stations) if (backoff[s.id] > 0) backoff[s.id]--
        put({ slot, log: `第 ${slot} 个争用期：没有站可以发送（都在退避或还没就绪）` })
        continue
      }

      if (ready.length === 1) {
        const s = ready[0]
        done.push(s.id)
        put({ slot, sending: [s.id], log:
          `第 ${slot} 个争用期：只有 ${s.id} 在发 → 总线空闲，**发送成功**` })
        for (const x of stations) if (backoff[x.id] > 0) backoff[x.id]--
        continue
      }

      // ── 冲突 ────────────────────────────────────────
      const picked: Record<string, string> = {}
      for (const s of ready) {
        attempts[s.id]++
        if (attempts[s.id] >= maxAttempts) {
          aborted.push(s.id)
          picked[s.id] = `第 ${attempts[s.id]} 次冲突 → 放弃`
          continue
        }
        const k = Math.min(attempts[s.id], 10)
        const range = Math.pow(2, k)
        //  "随机"取值由文档给定，保证可复现
        const r = s.picks[attempts[s.id] - 1] ?? 0
        const use = ((r % range) + range) % range
        backoff[s.id] = use
        picked[s.id] = `k=${k}，从 {0…${range - 1}} 取 r=${use}`
      }
      put({
        slot, sending: ready.map(s => s.id), collision: true, picked,
        log: `第 ${slot} 个争用期：${ready.map(s => s.id).join('、')} 同时发送 → **冲突**；`
          + ready.map(s => `${s.id} ${picked[s.id]}`).join('；'),
      })
      for (const x of stations) if (backoff[x.id] > 0 && !ready.some(r => r.id === x.id)) backoff[x.id]--
    }

    put({
      log: done.length === stations.length
        ? `全部 ${done.length} 个站都发送成功，顺序为 ${done.join(' → ')}`
        : `结束：成功 ${done.join('、') || '无'}；放弃 ${aborted.join('、') || '无'}`,
    })

    return {
      axis: { kind: 'time', label: '争用期', unit: '2τ' },
      initial: () => ({
        i: -1, slot: 0, sending: [], collision: false, attempts: {}, backoff: {},
        picked: {}, done: [], aborted: [], log: '',
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
