/**
 * 「用户点得到吗」—— 一个实验的 group 还挂不挂在**可见的**职业线上。
 *
 * 判据要分得清这个，是因为目录里近四成实验点不到（隐藏的具身智能轨 +
 * 已下线的后端/安全轨孤儿组）。拿全量算出来的数会把"用户实际能碰到的质量"
 * 稀释掉：改好一百条点得到的题，总数只掉一百，看不出已经清零了。
 *
 * ⚠️ 这段口径**炸过一次，而且是无声的**。
 * 第一版只按 `\n  id: 'x',` 那一行去找实验的 group，可库层 46 条走的是
 * `mkLib(id, …, group = '软件库与框架')` 这个工厂，**压根没有 `group:` 那一行**。
 * 于是它们整批被判成"注册表里没有这个实验"、当成点不到 —— 其中 35 条挂在
 * 算法轨/大模型轨/408 轨上，用户明明点得到。漏的是"该查的没进清单"，
 * 而清单看着一切正常。所以这里两种写法都要认，少认一种就是少查一批。
 */
import { readFileSync } from 'node:fs'

const LIB_GROUP: Record<string, string> = {
  LG: '大模型软件库与框架', AG: '算法软件库与框架', TG: '系统与工具',
}

/** 解析 web/src/registry.ts，返回「实验 id → 用户点得到吗」。 */
export function reachableIds(regPath = 'web/src/registry.ts'): Set<string> {
  const reg = readFileSync(regPath, 'utf8')
  const disc = reg.slice(reg.indexOf('export const DISCIPLINES'), reg.indexOf('export type Anchor'))
  const visible = new Set<string>()
  for (const m of disc.matchAll(/key:\s*'([a-z]+)'[\s\S]*?status:\s*'(active|planned|hidden)'[\s\S]*?groups:\s*\[([^\]]*)\]/g))
    if (m[2] !== 'hidden') for (const g of m[3].matchAll(/'([^']+)'/g)) visible.add(g[1])

  const groupOf: Record<string, string> = {}
  //  写法一：顶层字面量，`id:` 和 `group:` 各占一行
  const marks = [...reg.matchAll(/\n  id: '([a-z0-9]+)',/g)]
  for (let i = 0; i < marks.length; i++) {
    const to = i + 1 < marks.length ? marks[i + 1].index! : reg.length
    const g = reg.slice(marks[i].index!, to).match(/\bgroup: '([^']+)'/)
    if (g) groupOf[marks[i][1]] = g[1]
  }
  //  写法二：mkLib(...) 工厂，组是第 7 个实参（省略即默认组）
  for (const m of reg.matchAll(/const \w+ = mkLib\(\s*'([a-z0-9]+)'/g)) {
    let d = 0, q = '', j = reg.indexOf('(', m.index!)
    const tops: number[] = []
    for (; j < reg.length; j++) {
      const c = reg[j]
      if (q) { if (c === '\\') { j++; continue } if (c === q) q = ''; continue }
      if (c === "'" || c === '"' || c === '`') { q = c; continue }
      if (c === '(' || c === '[' || c === '{') { d++; continue }
      if (c === ')' || c === ']' || c === '}') { d--; if (c === ')' && d === 0) break; continue }
      if (c === ',' && d === 1) tops.push(j)
    }
    const seg = tops.length >= 6 ? reg.slice(tops[5] + 1, tops[6] ?? j).trim() : ''
    groupOf[m[1]] = !seg ? '软件库与框架' : LIB_GROUP[seg] ?? seg.replace(/^'|'$/g, '')
  }

  return new Set(Object.entries(groupOf).filter(([, g]) => visible.has(g)).map(([id]) => id))
}
