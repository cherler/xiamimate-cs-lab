/** 反应图的类型。真源是 docs/design/network-graph-v2.json;graph-data.ts 由它生成。 */
export type Atom = { name: string; layer: string; def: string; why: string; form: string }
export type Reaction = {
  inputs: string[]; output: string
  rule: string; emergent: string; form: string; layer: string
}
export type Graph = { atoms: Atom[]; reactions: Reaction[] }

export const LAYERS = ['物理层', '数据链路层', '网络层', '传输层', '应用层'] as const
export type Layer = (typeof LAYERS)[number]
