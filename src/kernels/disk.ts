/**
 * 内核：磁盘调度（操作系统）
 * 轴：step（每服务一个请求一步）
 *
 * 视觉形态跟前面几个都不同 —— 一维磁头位置随时间移动的折线。
 * 又一次验证"渲染层可替换"：同一套壳要能撑住这种完全不同的可视化。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type DiskState = {
  // ── 可见部分
  i: number
  from: number
  head: number
  served: number
  /** 本步移动距离 */
  moved: number
  /** 累计寻道距离 */
  total: number
  pending: number[]
  /** 当前扫描方向：+1 向大磁道，-1 向小磁道；FCFS/SSTF 恒为 0 */
  dir: number
  /** 本步是否是"走到边界再折返"的空跑（SCAN 系才有） */
  sweep: boolean
  /**
   * 本步途经的折返点（SCAN 碰到的边界 / C-SCAN 的边界与回绕点），按先后顺序。
   * 不吐出来的话，轨迹图只能从 from 直接画到 head ——
   * 数字算对了，但"先走到边界再掉头"这件事在图上根本看不见。
   */
  via: number[]
  log: string
}

export const DISK_VISIBLE = [
  'i', 'from', 'head', 'served', 'moved', 'total', 'pending', 'dir', 'sweep', 'via', 'log',
] as const

export const diskKernel: Kernel<DiskState> = {
  kind: 'disk',

  compile(doc: SimDocument): CompiledModel<DiskState> {
    const algo = str(doc.params, 'algorithm')
    const start = num(doc.params, 'headStart')
    const maxTrack = num(doc.params, 'maxTrack')
    const goingUp = num(doc.params, 'direction') >= 0
    const reqs = (doc.streams.find(s => s.name === 'requests')?.values ?? []) as number[]

    return {
      axis: { kind: 'step', label: '服务次序' },

      initial: () => ({
        i: -1, from: start, head: start, served: -1, moved: 0, total: 0,
        pending: [...reqs], dir: goingUp ? 1 : -1, sweep: false, via: [], log: '',
      }),

      describe: s => s.log,

      step(prev) {
        const base = prev ?? this.initial()
        if (base.pending.length === 0) return null
        const i = base.i + 1
        const from = base.head
        const pending = [...base.pending]
        let dir = base.dir
        let sweep = false
        let pick: number
        let why: string

        if (algo === 'FCFS') {
          pick = pending[0]
          why = '按到达顺序'
        } else if (algo === 'SSTF') {
          let bi = 0
          for (let k = 1; k < pending.length; k++)
            if (Math.abs(pending[k] - from) < Math.abs(pending[bi] - from)) bi = k
          pick = pending[bi]
          why = `最短寻道（距离 ${Math.abs(pick - from)}）`
        } else {
          // SCAN / C-SCAN / LOOK：沿当前方向找最近的
          const ahead = pending.filter(t => (dir > 0 ? t >= from : t <= from))
          if (ahead.length > 0) {
            pick = dir > 0 ? Math.min(...ahead) : Math.max(...ahead)
            why = `沿${dir > 0 ? '增' : '减'}方向就近服务`
          } else if (algo === 'LOOK') {
            dir = -dir
            const back = pending.filter(t => (dir > 0 ? t >= from : t <= from))
            pick = dir > 0 ? Math.min(...back) : Math.max(...back)
            why = `本方向已无请求，LOOK 直接掉头`
          } else if (algo === 'SCAN') {
            dir = -dir
            sweep = true
            const back = pending.filter(t => (dir > 0 ? t >= from : t <= from))
            pick = dir > 0 ? Math.min(...back) : Math.max(...back)
            why = `先走到边界再掉头（SCAN 要碰边）`
          } else {
            // C-SCAN：走到边界后跳回另一端，方向不变
            sweep = true
            pick = dir > 0 ? Math.min(...pending) : Math.max(...pending)
            why = `到边界后回扫到另一端（C-SCAN 单向服务）`
          }
        }

        // SCAN 碰边、C-SCAN 回扫，都要把额外行程算进寻道距离
        let moved: number
        const via: number[] = []
        if (sweep && algo === 'SCAN') {
          const edge = dir > 0 ? 0 : maxTrack           // 掉头前先走到的那个边界
          via.push(edge)
          moved = Math.abs(edge - from) + Math.abs(pick - edge)
        } else if (sweep && algo === 'C-SCAN') {
          const far = dir > 0 ? maxTrack : 0
          const wrap = dir > 0 ? 0 : maxTrack
          via.push(far, wrap)
          moved = Math.abs(far - from) + Math.abs(wrap - far) + Math.abs(pick - wrap)
        } else {
          moved = Math.abs(pick - from)
        }

        const at = pending.indexOf(pick)
        pending.splice(at, 1)
        const total = base.total + moved

        const log = `磁道 ${from} → ${pick}，移动 ${moved}（${why}），累计 ${total}`

        return {
          state: { i, from, head: pick, served: pick, moved, total, pending, dir, sweep, via, log },
          done: pending.length === 0,
        }
      },
    }
  },
}
