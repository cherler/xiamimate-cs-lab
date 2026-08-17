/**
 * 内核：指令流水线时空图（计算机组成原理）
 * 轴：time（时钟周期）
 *
 * 五段流水：IF ID EX MEM WB。
 * 建模三类冒险：
 *   结构冒险 —— 本实验假设指令/数据存储分离，不建模（写进边界栏）
 *   数据冒险 —— RAW，可开关"前递"，看气泡怎么少掉
 *   控制冒险 —— 分支在 EX 段判定，之后的指令作废
 *
 * entities：{ type:'inst', id:'I1', attrs:{ op, rd, rs, rt, taken } }
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const
export type Stage = typeof STAGES[number]

export type PipeState = {
  i: number
  /** 当前周期（从 1 开始） */
  cycle: number
  /** 每条指令这一周期在哪一段；'-' 表示还没进入或已完成，'气泡' 表示停顿 */
  at: Record<string, string>
  /** 本周期因冒险而停顿的指令 */
  stalled: string[]
  /** 本周期被冲刷掉的指令（控制冒险） */
  flushed: string[]
  /** 本周期发生的前递：目标指令 → 说明 */
  forwards: Record<string, string>
  /** 已完成的指令数 */
  done: number
  log: string
}

export const PIPE_VISIBLE = [
  'i', 'cycle', 'at', 'stalled', 'flushed', 'forwards', 'done', 'log',
] as const

type Inst = {
  id: string; op: string
  /** 写入的寄存器（无则空串） */
  rd: string
  /** 读取的寄存器 */
  srcs: string[]
  /** 分支是否跳转 */
  taken: boolean
}

type Frame = Omit<PipeState, 'i'>

const isBranch = (op: string) => op === 'beq' || op === 'bne' || op === 'j'
const isLoad = (op: string) => op === 'lw'

export const pipelineKernel: Kernel<PipeState> = {
  kind: 'pipeline',

  compile(doc: SimDocument): CompiledModel<PipeState> {
    const forwarding = num(doc.params, 'forwarding') === 1
    void str

    const insts: Inst[] = doc.entities
      .filter(e => e.type === 'inst')
      .map(e => {
        const op = String(e.attrs.op ?? 'add')
        const rd = String(e.attrs.rd ?? '')
        const srcs = [String(e.attrs.rs ?? ''), String(e.attrs.rt ?? '')].filter(Boolean)
        return { id: e.id, op, rd: isBranch(op) ? '' : rd, srcs, taken: Number(e.attrs.taken ?? 0) === 1 }
      })

    /**
     * 逐周期推进，直接摊成帧。
     *
     * 关键：`pipe` 按指令下标升序 —— **下标小的走得更靠前**（段序号更大）。
     * 所以一条指令停顿时，要跟着停的是它**后面**的（下标更大、还在前段的）那些；
     * 前面的必须照常走，否则生产者永远到不了 WB，整条流水线死锁。
     * 第一版把方向写反了，无前递的用例直接跑到 200 周期上限。
     */
    const frames: Frame[] = []
    const n = insts.length
    let next = 0
    let pipe: { k: number; st: number }[] = []
    const MAX = 500

    for (let cycle = 1; cycle <= MAX && (next < n || pipe.length > 0); cycle++) {
      const stallNote: string[] = []
      const fwd: Record<string, string> = {}
      const flushed: string[] = []

      // ── 1. 谁该停 ────────────────────────────────────
      let blockFrom = -1
      for (let idx = 0; idx < pipe.length; idx++) {
        const cur = pipe[idx]
        if (cur.st !== 1) continue                    // 只有 ID 段读寄存器
        const inst = insts[cur.k]
        let stall = false
        for (const other of pipe) {
          if (other.k >= cur.k) continue              // 只看前面的指令
          const w = insts[other.k].rd
          if (!w || !inst.srcs.includes(w)) continue

          if (forwarding) {
            //  load-use：数据要等 MEM 段末尾，生产者此刻还在 EX 就得等一拍
            if (isLoad(insts[other.k].op) && other.st === 2) {
              stall = true
              stallNote.push(`${inst.id} 停顿（load-use：${insts[other.k].id} 的 ${w} 要等 MEM 段，前递也省不掉这一拍）`)
            } else {
              fwd[inst.id] = `前递 ${insts[other.k].id}.${w} → ${inst.id}`
            }
          } else {
            //  无前递：假定"前半周期写、后半周期读"，生产者进到 WB 那一拍就能被读到
            if (other.st < 4) {
              stall = true
              stallNote.push(`${inst.id} 停顿（RAW：等 ${insts[other.k].id} 把 ${w} 写回）`)
            }
          }
        }
        if (stall) { blockFrom = idx; break }
      }

      // ── 2. 推进：blockFrom 及其之后原地不动，之前的照常走 ──
      let out = pipe
        .map((c, idx) => (blockFrom >= 0 && idx >= blockFrom ? { ...c } : { k: c.k, st: c.st + 1 }))
        .filter(c => c.st < STAGES.length)

      // ── 3. 取指：IF 空着就能进新指令 ──────────────────
      if (!out.some(c => c.st === 0) && next < n) {
        out.push({ k: next, st: 0 })
        next++
      }
      out.sort((a, b) => a.k - b.k)

      // ── 4. 控制冒险：分支在 EX 段判定，之后取来的全作废 ──
      const br = out.find(c => c.st === 2 && isBranch(insts[c.k].op) && insts[c.k].taken)
      if (br) {
        for (const v of out.filter(c => c.k > br.k)) flushed.push(insts[v.k].id)
        out = out.filter(c => c.k <= br.k)
        //  跳转成功：被冲掉的那几条不再执行
        next = Math.max(next, br.k + 1 + flushed.length)
      }

      pipe = out
      if (pipe.length === 0 && next >= n) break       // 别多记一个空周期

      const at: Record<string, string> = {}
      for (const inst of insts) at[inst.id] = '-'
      for (const c of pipe) at[insts[c.k].id] = STAGES[c.st]

      const busy = Object.entries(at).filter(([, v]) => v !== '-')
      const parts = [busy.length ? busy.map(([id, v]) => `${id}:${v}`).join(' ') : '流水线空']
      if (stallNote.length) parts.push(...stallNote)
      if (flushed.length) parts.push(`冲刷 ${flushed.join('、')}（分支跳转）`)
      parts.push(...Object.values(fwd))

      frames.push({
        cycle, at,
        stalled: stallNote.map(x => x.split(' ')[0]),
        flushed, forwards: fwd,
        done: frames.filter(f => Object.values(f.at).includes('WB')).length
          + (Object.values(at).includes('WB') ? 1 : 0),
        log: `第 ${cycle} 周期：${parts.join('；')}`,
      })
    }

    return {
      axis: { kind: 'time', label: '时钟周期', unit: 'cycle' },
      initial: () => ({
        i: -1, cycle: 0, at: {}, stalled: [], flushed: [], forwards: {}, done: 0, log: '',
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
