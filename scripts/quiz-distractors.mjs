/**
 * 只换干扰项，按 fact id 定位。
 *
 * ## 为什么不用 quiz-rebalance 那条路
 *
 * 那个脚本靠「原文在源码里唯一命中」来保证不改错地方。对库层这 83 条行不通：
 * 它们的干扰项是共用的短桩 —— `'RRT 和 A*'`、`'ICP 和 SLAM'`、`'一个向量数据库'`
 * 在 catalog.ts 里各出现三五次。唯一命中一条都过不了，整批被挡在门外。
 *
 * 库层这批的形状又是**统一的**：每条 fact 写在一行里，`id: 'xx_yy'` 和
 * `distractors: () => ['…', '…', '…']` 同属那一行。所以换个锚点：**按 fact id 找那一行**，
 * 整段 distractors 数组替换掉。id 全局唯一(判据盯着)，比字符串可靠。
 *
 * ## 闸口(和 quiz-rebalance 同一套，别在这里放松)
 *
 * ① 三条互不相同、都非空，且都不等于答案
 * ② 答案不许是唯一最长 —— 本来要修的那个漏
 * ③ 答案不许是唯一最短 —— 镜像的漏
 * ④ 答案落在干扰项区间 ±2 内
 * ⑤ 那一行必须**恰好**含一处 `distractors: () => [`，否则不动
 *
 * ⚠️ 答案取自 leaky.json，那是**对调之后**的值(库层把 evidence 提上来当选项，
 * 见 catalog.ts 的「库层那批题:把选项和出处对调」)。别拿源码里 `answer:` 那段长说明去比。
 *
 * ## 也能顺手收答案
 *
 * 有几条的选项本身就 33 字(`GPU 高吞吐易用;端侧 llama.cpp、极致 TRT-LLM`)，
 * 硬把三条干扰项撑到 33 字就是灌水 —— 那不叫配平，那叫把四个选项一起写烂。
 * 所以可选带一个 `answer`：在**同一行**里把那句选项换掉。
 * 库层的选项写在源码的 `evidence:` 字段里(对调之后它才是选项，`answer:` 那段长说明成了讲解)，
 * 但这里不认字段名、只认**带引号的整串**，锚点仍是那一行，改不到别处去。
 *
 * 跑法：node scripts/quiz-distractors.mjs <file.json> [--apply]
 * 形状：[{ exp, fid, wrong: [三条], answer?: '收短的选项' }, …]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const L = (s) => [...s].length
const file = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!file) { console.error('用法：node scripts/quiz-distractors.mjs <file.json> [--apply]'); process.exit(2) }

const SP = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/f1aa26be-4917-46d5-a491-49450ed248e5/scratchpad'
const rewrites = JSON.parse(readFileSync(file, 'utf8'))
const orig = new Map(JSON.parse(readFileSync(`${SP}/leaky.json`, 'utf8')).map(r => [`${r.exp}/${r.fid}`, r]))

const SRC = ['server/catalog.ts', ...readdirSync('server/catalog').filter(f => f.endsWith('.ts')).map(f => join('server/catalog', f))]
const lines = new Map(SRC.map(p => [p, readFileSync(p, 'utf8').split('\n')]))

let pass = 0
const fail = []
const ready = []

for (const r of rewrites) {
  const key = `${r.exp}/${r.fid}`
  const o = orig.get(key)
  const bad = (why) => fail.push(`${key}：${why}`)
  if (!o) { bad('不在待修清单里（leaky.json 没有它）'); continue }
  const w = r.wrong
  if (!Array.isArray(w) || w.length !== 3) { bad(`干扰项要 3 条，给了 ${w?.length}`); continue }
  if (w.some(x => typeof x !== 'string' || !x.trim())) { bad('有空干扰项'); continue }
  if (new Set([r.answer ?? o.answer, ...w]).size !== 4) { bad('干扰项之间、或与答案重复'); continue }

  const ans = r.answer ?? o.answer
  const la = L(ans), lw = w.map(L)
  const mx = Math.max(...lw), mn = Math.min(...lw)
  if (la > mx) { bad(`答案仍是唯一最长（${la} 字，干扰项 ${lw.join('/')}）`); continue }
  if (la < mn) { bad(`答案成了唯一最短（${la} 字，干扰项 ${lw.join('/')}）`); continue }
  if (la < mn - 2 || la > mx + 2) { bad(`答案 ${la} 落在干扰项区间 ${mn}–${mx} 之外`); continue }

  //  定位：id 那一行，且这一行只有一处 distractors
  const hits = []
  for (const p of SRC) lines.get(p).forEach((ln, i) => {
    if (ln.includes(`id: '${r.fid}'`) && ln.includes('distractors: () => [')) hits.push([p, i, ln])
  })
  if (hits.length !== 1) { bad(hits.length === 0 ? '找不到「id 与 distractors 同在一行」的定义' : `匹配到 ${hits.length} 处，不敢改`); continue }
  const [p, i, ln] = hits[0]
  const m = ln.match(/distractors: \(\) => \[[^\]]*\]/g)
  if (!m || m.length !== 1) { bad(`那一行里的 distractors 不是恰好一处（${m?.length ?? 0}）`); continue }
  const to = `distractors: () => [${w.map(x => `'${x}'`).join(', ')}]`
  if ([...w, ans].some(x => x.includes("'"))) { bad('选项里有单引号，会破坏字面量'); continue }
  let out = ln.replace(m[0], to)
  if (r.answer && r.answer !== o.answer) {
    const q = `'${o.answer}'`
    if (out.split(q).length - 1 !== 1) { bad(`那一行里的原选项不是恰好一处：「${o.answer.slice(0, 20)}…」`); continue }
    out = out.replace(q, `'${r.answer}'`)
  }
  pass++
  ready.push([p, i, out])
}

console.log(`\n改写稿 ${rewrites.length} 条：过闸 ${pass}，打回 ${fail.length}`)
for (const f of fail) console.log(`  ❌ ${f}`)
if (!APPLY) { console.log('\n（只体检，没写。加 --apply 才写回源码。）'); process.exit(fail.length ? 1 : 0) }
for (const [p, i, ln] of ready) lines.get(p)[i] = ln
for (const p of new Set(ready.map(x => x[0]))) writeFileSync(p, lines.get(p).join('\n'))
console.log(`\n已写回 ${ready.length} 条 fact 的干扰项。`)
process.exit(fail.length ? 1 : 0)
