/**
 * 内核：事务隔离级别 · 三大读现象（数据库系统 · 求职面试核心）
 * 轴：step —— 一条固定的两事务调度，切隔离级别看「脏读 / 不可重复读」出现或消失
 *
 * 同一段并发调度，隔离级别不同，T1 三次读到的值就不同——这就是隔离级别的意义:
 *   读未提交(RU): 100 → 200(脏读!) → 200(不可重复读)   —— 什么都不挡
 *   读已提交(RC): 100 → 100      → 200(不可重复读)      —— 挡住脏读,挡不住不可重复读
 *   可重复读(RR): 100 → 100      → 100                  —— 全挡住(MySQL 默认)
 *   串行化(SER):  100 → 100      → 100                  —— 最严,还能挡幻读(本例无区间查询,同 RR)
 *
 * 读规则:RU 读最新值(含未提交);RC 读最新已提交值;RR/SER 读事务开始时的快照。
 * 现象判定:某次读的值 ≠ 第一次读 → 若读的是未提交值=脏读,否则=不可重复读。
 *
 * 值全部可核:committed/uncommitted、每次读的值与现象、快照都在状态里。切 level 参数即刻重跑。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type IsoState = {
  i: number
  step: number
  level: string
  committedX: number
  uncommittedX: number      // -1 = 无未提交版本
  hasUncommitted: boolean
  curTx: number
  op: string                // begin | read | write | commit | done
  readValue: number         // 本步读到的值（-1 = 非读）
  anomaly: string           // '' | '首次读' | '正常' | '脏读' | '不可重复读'
  reads: { v: number; a: string }[]   // T1 到目前为止的读（值 + 现象），供舞台展示
  phase: 'run' | 'done'
  log: string
}

export const ISO_VISIBLE = [
  'step', 'level', 'committedX', 'uncommittedX', 'hasUncommitted', 'curTx', 'op', 'readValue', 'anomaly', 'reads', 'phase', 'log',
] as const

type Frame = Omit<IsoState, 'i'>

type Op = { tx: number; kind: 'begin' | 'read' | 'write' | 'commit'; val?: number }
const SCHEDULE: Op[] = [
  { tx: 1, kind: 'begin' },
  { tx: 2, kind: 'begin' },
  { tx: 1, kind: 'read' },
  { tx: 2, kind: 'write', val: 200 },
  { tx: 1, kind: 'read' },
  { tx: 2, kind: 'commit' },
  { tx: 1, kind: 'read' },
  { tx: 1, kind: 'commit' },
]
const INIT = 100
const LEVELS = ['读未提交', '读已提交', '可重复读', '串行化']

export const isoKernel: Kernel<IsoState> = {
  kind: 'iso',

  compile(doc: SimDocument): CompiledModel<IsoState> {
    const raw = String(doc.params?.level ?? '读已提交')
    const level = LEVELS.includes(raw) ? raw : '读已提交'
    const frames: Frame[] = []

    let committedX = INIT, uncommittedX = -1, hasUncommitted = false
    let snapshot = -1
    const reads: { v: number; a: string }[] = []

    const readVal = (): number => {
      if (level === '读未提交') return hasUncommitted ? uncommittedX : committedX
      if (level === '读已提交') return committedX
      return snapshot   // 可重复读 / 串行化：读事务开始时的快照
    }

    for (const op of SCHEDULE) {
      let readValue = -1, anomaly = '', log = ''
      if (op.kind === 'begin') {
        if (op.tx === 1) snapshot = committedX
        log = `T${op.tx} 开始${op.tx === 1 ? `（隔离级别：**${level}**；此刻快照 x=${committedX}）` : ''}。`
      } else if (op.kind === 'read') {
        const v = readVal()
        readValue = v
        const base = reads[0]?.v ?? v
        if (reads.length === 0) { anomaly = '首次读'; log = `T1 第一次读 x = **${v}**（基准值）。` }
        else if (hasUncommitted && v === uncommittedX && v !== base) {
          anomaly = '脏读'
          log = `T1 再读 x = **${v}**——这是 T2 **还没提交**的值!读到了可能被回滚的脏数据 → **脏读**。只有「读未提交」才会这样。`
        } else if (v !== base) {
          anomaly = '不可重复读'
          log = `T1 再读 x = **${v}**,和第一次读的 ${base} 不一样——同一事务里两次读同一行结果不同 → **不可重复读**。`
        } else {
          anomaly = '正常'
          log = `T1 再读 x = **${v}**,和第一次一致——${level === '读已提交' ? '「读已提交」只读已提交值,挡住了脏读' : '快照隔离让它可重复'}。`
        }
        reads.push({ v, a: anomaly })
      } else if (op.kind === 'write') {
        uncommittedX = op.val!; hasUncommitted = true
        log = `T2 把 x 改成 ${op.val}（**未提交**）。`
      } else if (op.kind === 'commit') {
        if (op.tx === 2 && hasUncommitted) { committedX = uncommittedX; uncommittedX = -1; hasUncommitted = false }
        log = `T${op.tx} 提交（x 的已提交值现在是 ${committedX}）。`
      }
      frames.push({
        step: frames.length, level, committedX, uncommittedX, hasUncommitted,
        curTx: op.tx, op: op.kind, readValue, anomaly, reads: [...reads], phase: 'run', log,
      })
    }

    const seen = new Set(frames.filter(f => f.op === 'read').map(f => f.anomaly))
    const got = [...seen].filter(a => a === '脏读' || a === '不可重复读')
    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, curTx: 0, op: 'done', readValue: -1, anomaly: '', phase: 'done',
      log: `**${level}** 下，T1 三次读到 [${reads.map(r => r.v).join(', ')}]。` +
        (got.length ? `出现了 **${got.join('、')}**——把隔离级别调高就能挡掉。` : `没有任何读现象——三次读完全一致。`) +
        `隔离级别越高越安全、但并发越低,这就是那张「级别 × 现象」表背后的机制。`,
    })

    const base0: Frame = {
      step: -1, level, committedX: INIT, uncommittedX: -1, hasUncommitted: false,
      curTx: 0, op: '', readValue: -1, anomaly: '', reads: [], phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '调度步' },
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
