/**
 * 列出「用户点得到、且答案是唯一最长」的题 —— 也就是 tests/fact-genre.test.ts 判据⑩
 * 一旦变红，要改的就是这张单子。
 *
 * 判据只告诉你有几条、是哪几条；这里连题面、答案、三个干扰项、出处一起导出来，
 * 直接喂给 scripts/quiz-rebalance.mjs / quiz-distractors.mjs 改写。
 *
 * 跑法：
 *   npx tsx scripts/quiz-leaky.ts              → 写 ./quiz-leaky.json（两把改写工具的默认输入）
 *   npx tsx scripts/quiz-leaky.ts <out.json>   → 写到指定位置（改写工具认 QUIZ_LEAKY 环境变量）
 *
 * ⚠️ 「点得到」的口径别在这里另写一份，一律走 tests/reachable.ts。
 * 那份口径漏过一次 mkLib 工厂，整批库层实验被判成点不到、从来没进过这张单子，
 * 而单子看着一切正常 —— 两份口径就是两次分叉的机会。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { CATALOG, traceOf, genreOf } from '../server/catalog.ts'
import { servableFacts } from '../server/quiz.ts'
import { reachableIds } from '../tests/reachable.ts'

const out = process.argv[2] ?? 'quiz-leaky.json'
const reach = reachableIds()
const L = (s: string) => [...s].length

const dir = 'server/catalog'
const src: Record<string, string> = { 'server/catalog.ts': readFileSync('server/catalog.ts', 'utf8') }
for (const f of readdirSync(dir)) if (f.endsWith('.ts')) src[`${dir}/${f}`] = readFileSync(`${dir}/${f}`, 'utf8')

const byFile: Record<string, number> = {}
const rows: unknown[] = []
for (const e of CATALOG) {
  if (!reach.has(e.id)) continue
  let trace: Record<string, unknown>[] = []
  try { trace = traceOf(e) as Record<string, unknown>[] } catch { continue }
  for (const f of servableFacts(e, trace)) {
    if (genreOf(f, trace) !== 'concept') continue
    let ans = '', ev = '', ds: string[] = []
    try {
      const c = f.compute(trace as never); ans = c.answer; ev = c.evidence
      ds = f.distractors(ans, trace as never).filter(d => d !== ans)
    } catch { continue }
    if (!ans || ds.length < 3) continue
    if (L(ans) <= Math.max(...ds.map(L))) continue
    const file = Object.keys(src).find(k => src[k].includes(`id: '${f.id}'`)) ?? '(未定位)'
    byFile[file] = (byFile[file] ?? 0) + 1
    rows.push({ file, exp: e.id, expTitle: e.title, fid: f.id, ask: f.ask, answer: ans, wrong: ds, evidence: ev })
  }
}
writeFileSync(out, JSON.stringify(rows, null, 1))
console.log(`会漏且点得到的 ${rows.length} 条 → ${out}`)
for (const [k, v] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${v}`)
if (rows.length === 0) console.log('（判据⑩是绿的：点得到的题里一条都不漏）')
