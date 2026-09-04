import { readFileSync, writeFileSync } from 'node:fs'
const g = JSON.parse(readFileSync('docs/design/network-graph-v2.json', 'utf8'))
// 只保留引擎需要的字段、稳定排序,便于 diff
const clean = {
  atoms: g.atoms.map(a => ({ name: a.name, layer: a.layer, def: a.def, why: a.why, form: a.form })),
  reactions: g.reactions.map(r => ({
    inputs: r.inputs, output: r.output, rule: r.rule, emergent: r.emergent, form: r.form, layer: r.layer,
  })),
}
const out = `// 自动生成 —— 勿手改。真源:docs/design/network-graph-v2.json
// 重新生成:node scripts/gen-graph-data.mjs
import type { Graph } from './types.ts'

export const GRAPH: Graph = ${JSON.stringify(clean, null, 2)}
`
writeFileSync('game/craft/graph-data.ts', out, 'utf8')
console.log('生成 game/craft/graph-data.ts:', clean.atoms.length, '原子 /', clean.reactions.length, '反应')
