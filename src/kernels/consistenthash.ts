/**
 * 内核：一致性哈希（后端 · 分布式缓存/分片）
 * 轴：step —— 节点和键都映到一个环上，键归给顺时针最近的节点；加节点只搬少量键
 *
 * 分布式缓存/分片要把键分到 N 台机器。最朴素的 hash(key) % N 有致命伤:**加/减一台机器,N 变了,
 * 几乎所有键的归属都变**,缓存全体失效、数据大搬家。一致性哈希:把 0..M-1 想成一个**环**,
 * 节点和键都哈希到环上某点,每个键归给**顺时针方向第一个节点**。加一个节点,只有它和前一个节点
 * 之间的那一小段键需要搬,其它全不动——扩容/宕机的抖动被降到最小。真实系统还加「虚拟节点」让分布更均。
 *
 * 本例环 0..99,节点 A@10/B@40/C@70,4 个键;加入 D@60 后只有键 k2(@55)从 C 搬到 D。值可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Node = { id: string; pos: number }
type Key = { id: string; pos: number; node: string }

export type ConsistentHashState = {
  i: number
  step: number
  ring: number
  nodes: Node[]
  keys: Key[]
  cur: string            // 本步涉及的键/节点
  act: string            // 'nodes'|'assign'|'addnode'|'remap'|'done'
  remapped: string       // 本步被搬动的键（''=无）
  phase: 'run' | 'done'
  log: string
}

export const CONSISTENTHASH_VISIBLE = ['step', 'ring', 'nodes', 'keys', 'cur', 'act', 'remapped', 'phase', 'log'] as const

type Frame = Omit<ConsistentHashState, 'i'>
const RING = 100
const NODES0: Node[] = [{ id: 'A', pos: 10 }, { id: 'B', pos: 40 }, { id: 'C', pos: 70 }]
const KEYS0 = [{ id: 'k4', pos: 5 }, { id: 'k1', pos: 25 }, { id: 'k2', pos: 55 }, { id: 'k3', pos: 85 }]

// 键归给顺时针方向第一个节点（环绕）
function owner(pos: number, nodes: Node[]): string {
  const sorted = [...nodes].sort((a, b) => a.pos - b.pos)
  for (const n of sorted) if (n.pos >= pos) return n.id
  return sorted[0]!.id
}

export const consistentHashKernel: Kernel<ConsistentHashState> = {
  kind: 'consistenthash',
  compile(_doc: SimDocument): CompiledModel<ConsistentHashState> {
    const frames: Frame[] = []
    const nodes: Node[] = NODES0.map(n => ({ ...n }))
    const keys: Key[] = []
    const snap = (act: string, cur: string, remapped: string, log: string) => frames.push({
      step: frames.length, ring: RING, nodes: nodes.map(n => ({ ...n })), keys: keys.map(k => ({ ...k })), cur, act, remapped, phase: 'run', log,
    })
    snap('nodes', '', '', `环 0..${RING - 1}。三个节点哈希到环上：A@10、B@40、C@70。每个键将归给**顺时针方向第一个节点**。`)
    for (const k of KEYS0) {
      const node = owner(k.pos, nodes)
      keys.push({ ...k, node })
      snap('assign', k.id, '', `键 ${k.id}@${k.pos} → 顺时针第一个节点是 **${node}**${k.pos > 70 ? '(超过 C，绕回环首的 A)' : ''}。`)
    }
    nodes.push({ id: 'D', pos: 60 })
    snap('addnode', 'D', '', `**新增节点 D@60**（扩容一台）。只有落在「D 和它前一个节点 B(@40) 之间」的键需要重新归属，其它全不动。`)
    let remap = ''
    for (const k of keys) {
      const newOwner = owner(k.pos, nodes)
      if (newOwner !== k.node) { k.node = newOwner; remap = k.id }
    }
    snap('remap', remap, remap, `重新归属：只有键 **${remap}**@55 从 C 搬到了 D(它落在 40~60 之间)。k1、k3、k4 归属不变——加一台机器，只搬了 1 个键。`)
    frames.push({
      step: frames.length, ring: RING, nodes: nodes.map(n => ({ ...n })), keys: keys.map(k => ({ ...k })), cur: '', act: 'done', remapped: '', phase: 'done',
      log: `**完成**：加入节点 D 后，4 个键里只有 1 个(${remap})需要搬。对比 hash%N——N 从 3 变 4，几乎所有键归属都会变、缓存全体失效。一致性哈希把扩容/宕机的数据搬动降到最小，是 Redis Cluster、Cassandra、CDN 分片的地基。`,
    })
    const base0: Frame = { step: -1, ring: RING, nodes: NODES0.map(n => ({ ...n })), keys: [], cur: '', act: '', remapped: '', phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
