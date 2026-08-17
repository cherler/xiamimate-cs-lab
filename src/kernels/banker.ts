/**
 * 内核：银行家算法（操作系统）
 * 轴：step —— 安全性检查本身就是一个逐步搜索过程
 *
 * entities：
 *   { type:'resource', id:'A', attrs:{ total: 10 } }
 *   { type:'process', id:'P0', attrs:{ max_A: 7, alloc_A: 0, ... } }
 * 参数里 resources 决定看哪几类资源。
 */
import { str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type BankerState = {
  i: number
  act: 'init' | 'try' | 'accept' | 'reject' | 'safe' | 'unsafe'
  /** 本步在试探哪个进程 */
  pid: string
  work: Record<string, number>
  finish: Record<string, boolean>
  sequence: string[]
  /** 本步比较用：need 与 work */
  need: Record<string, Record<string, number>>
  log: string
}

export const BANKER_VISIBLE = [
  'i', 'act', 'pid', 'work', 'finish', 'sequence', 'need', 'log',
] as const

type Frame = Omit<BankerState, 'i'>

export const bankerKernel: Kernel<BankerState> = {
  kind: 'banker',

  compile(doc: SimDocument): CompiledModel<BankerState> {
    const resources = str(doc.params, 'resources').split(',').map(s => s.trim()).filter(Boolean)
    const procs = doc.entities.filter(e => e.type === 'process').map(e => e.id)

    const need: Record<string, Record<string, number>> = {}
    const alloc: Record<string, Record<string, number>> = {}
    for (const e of doc.entities.filter(x => x.type === 'process')) {
      need[e.id] = {}; alloc[e.id] = {}
      for (const r of resources) {
        const mx = Number(e.attrs[`max_${r}`] ?? 0)
        const al = Number(e.attrs[`alloc_${r}`] ?? 0)
        alloc[e.id][r] = al
        need[e.id][r] = mx - al
      }
    }

    const available: Record<string, number> = {}
    for (const e of doc.entities.filter(x => x.type === 'resource')) {
      const total = Number(e.attrs.total ?? 0)
      const used = procs.reduce((s, p) => s + (alloc[p]?.[e.id] ?? 0), 0)
      available[e.id] = total - used
    }

    // 逐步搜索安全序列
    const frames: Frame[] = []
    const work = { ...available }
    const finish: Record<string, boolean> = Object.fromEntries(procs.map(p => [p, false]))
    const sequence: string[] = []

    const snap = (f: Partial<Frame> & { act: Frame['act']; log: string }): Frame => ({
      pid: '', work: { ...work }, finish: { ...finish }, sequence: [...sequence],
      need: JSON.parse(JSON.stringify(need)), ...f,
    })

    const vec = (m: Record<string, number>) => resources.map(r => m[r]).join(' ')

    frames.push(snap({
      act: 'init',
      log: `初始 Work = Available = (${vec(work)})，所有进程 Finish = false`,
    }))

    let progressed = true
    while (progressed && sequence.length < procs.length) {
      progressed = false
      for (const p of procs) {
        if (finish[p]) continue
        const fits = resources.every(r => need[p][r] <= work[r])
        if (fits) {
          frames.push(snap({
            act: 'accept', pid: p,
            log: `试 ${p}：Need(${vec(need[p])}) ≤ Work(${vec(work)}) ✓ 可满足，假设它完成并归还资源`,
          }))
          for (const r of resources) work[r] += alloc[p][r]
          finish[p] = true
          sequence.push(p)
          frames.push(snap({
            act: 'try', pid: p,
            log: `${p} 归还 Allocation(${vec(alloc[p])})，Work 变为 (${vec(work)})`,
          }))
          progressed = true
        } else {
          const short = resources.filter(r => need[p][r] > work[r])
          frames.push(snap({
            act: 'reject', pid: p,
            log: `试 ${p}：Need(${vec(need[p])}) ≰ Work(${vec(work)})，资源 ${short.join('/')} 不够，跳过`,
          }))
        }
      }
    }

    const safe = sequence.length === procs.length
    frames.push(snap({
      act: safe ? 'safe' : 'unsafe',
      log: safe
        ? `存在安全序列：${sequence.join(' → ')}，系统处于安全状态`
        : `找不到能推进的进程，剩余 ${procs.filter(p => !finish[p]).join('/')} 无法满足，系统处于不安全状态`,
    }))

    return {
      axis: { kind: 'step', label: '检查步骤' },
      initial: () => ({
        i: -1, act: 'init', pid: '',
        work: { ...available },
        finish: Object.fromEntries(procs.map(p => [p, false])),
        sequence: [], need: JSON.parse(JSON.stringify(need)), log: '',
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
