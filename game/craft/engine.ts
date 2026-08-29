/**
 * 反应引擎 —— 这个游戏的"仿真核心",不是壳。
 *
 * 规则藏在知识里:玩家把握着的原子/组件放上反应台,**只有正好凑成某条反应的那组东西才会反应**
 * (像化学,不像乐高——看不出形状,得懂道理)。反应成功 → 产物进库存(点亮知识树一个节点),
 * 从此能当更大反应的原料。真源是那张机器验过、无环可造的反应图(graph-data.ts <- network-graph-v2.json)。
 *
 * 全图无重复输入,所以"多重集相等"用排序数组比较即可;单输入反应(时间→时钟)走同一套精确匹配。
 */
import type { Graph, Reaction } from './types.ts'
import { GRAPH } from './graph-data.ts'

export type ReactResult =
  | { ok: true; reaction: Reaction; already: boolean }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'not-owned'; missing: string[] }
  | { ok: false; reason: 'incomplete'; toward: number } // 是 toward 条反应的真子集:差一味
  | { ok: false; reason: 'no-reaction' }

const key = (items: string[]) => [...items].sort().join('|')

export class CraftEngine {
  private graph: Graph
  private inv: Set<string>
  private made = new Set<string>()
  private order: string[] = []
  private byKey = new Map<string, Reaction>()

  constructor(graph: Graph = GRAPH, startInventory?: string[]) {
    this.graph = graph
    this.inv = new Set(startInventory ?? graph.atoms.map(a => a.name))
    for (const r of graph.reactions) this.byKey.set(key(r.inputs), r)
  }

  owns(name: string) { return this.inv.has(name) }
  inventory() { return [...this.inv] }
  discovered() { return [...this.order] }
  isAtom(name: string) { return this.graph.atoms.some(a => a.name === name) }
  reactionOf(output: string) { return this.graph.reactions.find(r => r.output === output) }
  atomOf(name: string) { return this.graph.atoms.find(a => a.name === name) }

  /** 把台上这组东西试着反应。副作用:成功且首次时,产物入库。 */
  react(items: string[]): ReactResult {
    if (items.length === 0) return { ok: false, reason: 'empty' }
    const missing = items.filter(i => !this.inv.has(i))
    if (missing.length) return { ok: false, reason: 'not-owned', missing }

    const exact = this.byKey.get(key(items))
    if (exact) {
      const already = this.made.has(exact.output)
      if (!already) { this.made.add(exact.output); this.order.push(exact.output); this.inv.add(exact.output) }
      return { ok: true, reaction: exact, already }
    }
    // 不是完整配方:是不是某条反应的真子集?(差一味)
    const toward = this.graph.reactions.filter(
      r => r.inputs.length > items.length && items.every(i => r.inputs.includes(i)),
    ).length
    if (toward > 0) return { ok: false, reason: 'incomplete', toward }
    return { ok: false, reason: 'no-reaction' }
  }

  progress() {
    const total = new Set(this.graph.reactions.map(r => r.output)).size
    return { made: this.made.size, total }
  }

  /**
   * 一个目标的"合成子树":要造出它,一共需要哪些原子、哪些中间产物,各在第几层(合成深度)。
   * 原子 depth=0;产物 depth=1+其输入最大深度。给关卡的"待点亮谱系图"排版用。
   */
  subtreeFor(target: string): { atoms: string[]; products: string[]; depth: Map<string, number> } {
    const atomsSet = new Set<string>()
    const prodSet = new Set<string>()
    const visit = (n: string) => {
      if (this.isAtom(n)) { atomsSet.add(n); return }
      if (prodSet.has(n)) return
      const r = this.reactionOf(n)
      if (!r) { atomsSet.add(n); return } // 兜底:不明来源当叶子
      prodSet.add(n)
      for (const i of r.inputs) visit(i)
    }
    visit(target)

    // 深度:反复松弛直到稳定(图无环,必收敛)
    const depth = new Map<string, number>()
    for (const a of atomsSet) depth.set(a, 0)
    let changed = true
    while (changed) {
      changed = false
      for (const p of prodSet) {
        const r = this.reactionOf(p)!
        if (r.inputs.some(i => !depth.has(i))) continue
        const d = 1 + Math.max(...r.inputs.map(i => depth.get(i)!))
        if (depth.get(p) !== d) { depth.set(p, d); changed = true }
      }
    }
    const products = [...prodSet].sort((a, b) => (depth.get(a) ?? 0) - (depth.get(b) ?? 0))
    return { atoms: [...atomsSet], products, depth }
  }

  /** 能被"当前库存"直接合成、但还没造出来的产物(给引导/高亮用) */
  craftableNow(): string[] {
    const out: string[] = []
    for (const r of this.graph.reactions) {
      if (this.made.has(r.output)) continue
      if (r.inputs.every(i => this.inv.has(i))) out.push(r.output)
    }
    return [...new Set(out)]
  }
}

/** 咕噜的解说/提示:成功念原理,卡住给方向——但不直接报答案。纯函数,可测。 */
export function guruLine(res: ReactResult): string {
  if (res.ok) {
    return res.already
      ? `这个你已经会造了。${res.reaction.rule}`
      : `成了!${res.reaction.rule}`
  }
  switch (res.reason) {
    case 'empty': return '把东西拖上台,想想哪些凑得成一个物件。'
    case 'not-owned': return `${res.missing.join('、')}你还没造出来呢——先去把它合出来。`
    case 'incomplete': return '有点意思,方向对,但还差一味。再想想缺了什么。'
    case 'no-reaction': return '这些是凑不到一起的。别硬拼形状——想想道理,什么和什么才有反应。'
  }
}
