#!/usr/bin/env node
// 反应图确定性校验器 —— 游戏铁律「自底向上能不能造出来」的代码化。
// 判据:每个反应的所有输入,必须要么是原子、要么是更早能造出的产物;整张图无环。
// 用法: node scripts/check-graph.mjs docs/design/network-graph-v2.json
import { readFileSync } from 'node:fs'

const path = process.argv[2] || 'docs/design/network-graph-v2.json'
const g = JSON.parse(readFileSync(path, 'utf8'))
const atoms = g.atoms ?? []
const reactions = g.reactions ?? []

const atomNames = new Set(atoms.map(a => a.name))
const problems = []

// 0) 原子名重复 / 产物名撞原子名
const seenAtom = new Set()
for (const a of atoms) { if (seenAtom.has(a.name)) problems.push(['dup-atom', a.name]); seenAtom.add(a.name) }
const outCount = {}
for (const r of reactions) outCount[r.output] = (outCount[r.output] ?? 0) + 1
for (const [o, n] of Object.entries(outCount)) {
  if (atomNames.has(o)) problems.push(['output-collides-atom', o])
  if (n > 1) problems.push(['dup-recipe', `${o} ×${n}`]) // 多配方仅告警(允许多路径,但要人工确认是不是矛盾重复)
}

// 0b) 同配方多产物:合成游戏必须确定——同一组料只能指向一个产物,否则玩家无从"懂着合"
const byInputs = {}
for (const r of reactions) {
  const k = [...r.inputs].sort().join(' + ')
  ;(byInputs[k] ??= []).push(r.output)
}
for (const [k, outs] of Object.entries(byInputs)) {
  const uniq = [...new Set(outs)]
  if (uniq.length > 1) problems.push(['ambiguous-recipe', `${k} → ${uniq.join(' / ')}`])
}

// 1) 自底向上"能不能造出来":反复合成,直到没有新产物能造
const inventory = new Set(atomNames)
let progress = true
const crafted = new Set()
while (progress) {
  progress = false
  for (const r of reactions) {
    if (crafted.has(r.output) && inventory.has(r.output)) continue
    if (r.inputs.every(i => inventory.has(i))) {
      if (!inventory.has(r.output)) { inventory.add(r.output); progress = true }
      crafted.add(r.output)
    }
  }
}

// 2) 造不出来的反应 = 有环或输入悬空
const uncraftable = []
for (const r of reactions) {
  if (crafted.has(r.output) && r.inputs.every(i => inventory.has(i))) continue
  const missing = r.inputs.filter(i => !inventory.has(i))
  const unsourced = missing.filter(i => !atomNames.has(i) && !(i in outCount)) // 名字根本不存在
  const stuck = missing.filter(i => (i in outCount) && !inventory.has(i))       // 存在但也造不出(环/链)
  uncraftable.push({ output: r.output, missing, unsourced, stuck })
}

const ok = problems.filter(p => p[0] !== 'dup-recipe').length === 0 && uncraftable.length === 0

console.log('=== 反应图校验 ===')
console.log(`原子: ${atoms.length}  反应: ${reactions.length}  可造产物: ${inventory.size - atomNames.size}/${new Set(reactions.map(r=>r.output)).size}`)
console.log(`结构问题: ${problems.length}  造不出的反应: ${uncraftable.length}`)
if (problems.length) { console.log('\n-- 结构问题 --'); for (const p of problems) console.log('  ', p[0], ':', p[1]) }
if (uncraftable.length) {
  console.log('\n-- 造不出来(输入悬空=名字不存在, 卡住=环/依赖也造不出) --')
  for (const u of uncraftable) console.log(`  【${u.output}】缺: ${u.missing.join(', ') || '(无?检查重复)'}` +
    (u.unsourced.length ? `  ✗悬空: ${u.unsourced.join(', ')}` : '') +
    (u.stuck.length ? `  ↻卡住: ${u.stuck.join(', ')}` : ''))
}
console.log(`\n结论: ${ok ? '✅ 无环 + 每个反应物可溯源,可当引擎地基' : '❌ 还不能当引擎,见上'}`)
process.exit(ok ? 0 : 1)
