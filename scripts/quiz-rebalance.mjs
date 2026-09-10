/**
 * 选项配平：把改写稿过一遍机械闸口，通过了才写回源码。
 *
 * ## 为什么需要这么一道
 *
 * 「靠长度就能蒙对」这笔债是实测出来的：**一个不读题、永远挑最长选项的人能考 82.3 分**
 * （随机基线 25）。961 条原理题里 772 条的正确答案是唯一最长的；
 * 其中用户点得到的实验占 358 条 —— 这个脚本改的就是那 358 条。
 *
 * 查过三条机械路，**都走不通**（实测，不是推测）：
 *   · 挑「长度配得上的干扰项」—— 每个 fact 的干扰项**恰好 3 条**，没有池子可挑。
 *   · 规则⑥的处方「四个选项都在分隔符处截断」—— 只覆盖 18/772 = 2.3%。
 *   · 只裁答案自己、尾巴挪进讲解 —— 覆盖 53/358 = 15%，且会误伤
 *     （`mergesort/stable_one_char` 裁成「合并时那一次比较」，把答案的核心裁没了）。
 * 所以是逐条改写的作者活。这个脚本不产内容，只**挡住改坏的**。
 *
 * ## 闸口挡什么
 *
 * ① 答案不许是唯一最长 —— 这是本来要修的那个漏。
 * ② 答案不许是唯一最短 —— **镜像的漏**。odd-one-out 那段注释记着这个坑：
 *    第一版按"挑一条干扰项当假命题"，结果三句真命题 50 字、假的 12 字，
 *    「挑最短的就中」，跟「挑最长的就中」是同一种病。
 * ③ 四个选项互不相同、都非空。
 * ④ 答案长度落在干扰项的区间内（±2 字容差）—— 不是"够短就行"，是**配得上**。
 * ⑤ 写回时要求原文在源码里**唯一命中**：命不中或命中多处一律不写，
 *    宁可少改一条，也不能改错一处。
 *
 * 跑法：
 *   node scripts/quiz-rebalance.mjs <rewrites.json>            只过闸口，报告
 *   node scripts/quiz-rebalance.mjs <rewrites.json> --apply    过了的写回源码
 *
 * rewrites.json 的形状：[{ exp, fid, answer, wrong?: [3 条] }, …]
 *
 * `wrong` **可以省**：绝大多数条目只需要收一收答案自己，干扰项原样留着。
 * 省了就沿用原来的三条 —— 少抄一遍就少一次抄错的机会。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const L = (s) => [...s].length
const file = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!file) { console.error('用法：node scripts/quiz-rebalance.mjs <rewrites.json> [--apply]'); process.exit(2) }

const rewrites = JSON.parse(readFileSync(file, 'utf8'))
const leaky = JSON.parse(readFileSync(
  '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/f1aa26be-4917-46d5-a491-49450ed248e5/scratchpad/leaky.json', 'utf8'))
const orig = new Map(leaky.map((r) => [`${r.exp}/${r.fid}`, r]))

/** 源码：server/catalog.ts 本体 + server/catalog/ 下的每个文件 */
const SRC = ['server/catalog.ts', ...readdirSync('server/catalog').filter(f => f.endsWith('.ts')).map(f => join('server/catalog', f))]
const text = new Map(SRC.map(p => [p, readFileSync(p, 'utf8')]))

let pass = 0
const fail = []
const ready = []

for (const r of rewrites) {
  const key = `${r.exp}/${r.fid}`
  const o = orig.get(key)
  const bad = (why) => fail.push(`${key}：${why}`)
  if (!o) { bad('不在待修清单里（leaky.json 没有它）'); continue }
  //  省略 wrong = 沿用原来的三条（多数条目只需要动答案）
  const wrong = r.wrong ?? o.wrong
  if (!Array.isArray(wrong) || wrong.length !== 3) { bad(`干扰项要 3 条，给了 ${wrong?.length}`); continue }

  const all = [r.answer, ...wrong]
  if (all.some(x => typeof x !== 'string' || !x.trim())) { bad('有空选项'); continue }
  if (new Set(all).size !== 4) { bad('四个选项里有重复'); continue }

  const la = L(r.answer)
  const lw = wrong.map(L)
  const mx = Math.max(...lw), mn = Math.min(...lw)
  if (la > mx) { bad(`答案仍是唯一最长（${la} 字，目标 ${mn}–${mx}）—— 没修到`); continue }
  if (la < mn) { bad(`答案成了唯一最短（${la} 字，目标 ${mn}–${mx}）—— 镜像的漏，挑最短的就中`); continue }
  if (la < mn - 2 || la > mx + 2) { bad(`答案长度 ${la} 落在干扰项区间 ${mn}–${mx} 之外`); continue }

  //  写回前先确认每条原文在源码里唯一命中
  const edits = []
  let ok = true
  for (const [from, to] of [[o.answer, r.answer], ...o.wrong.map((w, i) => [w, wrong[i]])]) {
    if (from === to) continue
    const hits = SRC.filter(p => text.get(p).includes(from))
    if (hits.length === 0) { bad(`源码里找不到原文：「${from.slice(0, 24)}…」`); ok = false; break }
    if (hits.length > 1) { bad(`原文在 ${hits.length} 个文件里都出现，不敢改：「${from.slice(0, 24)}…」`); ok = false; break }
    const p = hits[0]
    const n = text.get(p).split(from).length - 1
    if (n > 1) { bad(`原文在 ${p} 里出现 ${n} 次，不敢改：「${from.slice(0, 24)}…」`); ok = false; break }
    edits.push([p, from, to])
  }
  if (!ok) continue
  pass++
  ready.push({ key, edits })
}

console.log(`\n改写稿 ${rewrites.length} 条：过闸 ${pass}，打回 ${fail.length}`)
for (const f of fail) console.log(`  ❌ ${f}`)

if (!APPLY) { console.log(`\n（只体检，没写。加 --apply 才写回源码。）`); process.exit(fail.length ? 1 : 0) }

let n = 0
for (const { edits } of ready) for (const [p, from, to] of edits) { text.set(p, text.get(p).replace(from, to)); n++ }
for (const [p, s] of text) writeFileSync(p, s)
console.log(`\n已写回 ${ready.length} 条 fact、${n} 处字符串。`)
process.exit(fail.length ? 1 : 0)
