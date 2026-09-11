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
 * 跑法：**npx tsx** scripts/quiz-distractors.mjs <file.json> [--apply]
 *   （必须走 tsx：写完要从运行时读回来复查一遍，那一步要 import server/catalog.ts。
 *     用 node 跑会在复查那步直接崩 —— 崩了比"悄悄跳过复查"好。）
 * 形状：[{ exp, fid, wrong: [三条], answer?: '收短的选项' }, …]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const L = (s) => [...s].length
const file = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!file) { console.error('用法：node scripts/quiz-distractors.mjs <file.json> [--apply]'); process.exit(2) }

/**
 * 待修清单由 `npx tsx scripts/quiz-leaky.ts` 生成（默认写 ./quiz-leaky.json）。
 * 用 QUIZ_LEAKY 环境变量可以换个位置。这里原来写死过一个会话专用的绝对路径。
 */
const LEAKY = process.env.QUIZ_LEAKY ?? 'quiz-leaky.json'
const rewrites = JSON.parse(readFileSync(file, 'utf8'))
let leakyRows
try { leakyRows = JSON.parse(readFileSync(LEAKY, 'utf8')) }
catch { console.error(`读不到待修清单 ${LEAKY} —— 先跑：npx tsx scripts/quiz-leaky.ts`); process.exit(2) }
const orig = new Map(leakyRows.map(r => [`${r.exp}/${r.fid}`, r]))

const SRC = ['server/catalog.ts', ...readdirSync('server/catalog').filter(f => f.endsWith('.ts')).map(f => join('server/catalog', f))]
const lines = new Map(SRC.map(p => [p, readFileSync(p, 'utf8').split('\n')]))

/** 这条 fact 在源码里显式写了 genre 吗 —— 写了就不受"≤12 字算计数题"的兜底摆布。 */
function hasGenre(fid) {
  for (const p of SRC) {
    const t = text.get(p) ?? lines.get(p)?.join('\n') ?? ''
    const at = t.indexOf(`id: '${fid}'`)
    if (at < 0) continue
    const rest = t.slice(at + 1)
    const nxt = rest.search(/id: '[a-z0-9_-]+'/)
    return /genre: '/.test(t.slice(at, nxt < 0 ? t.length : at + 1 + nxt))
  }
  return false
}

/**
 * 选项的**外形**也要配平，不只是字数。
 *
 * 把长度那条通道堵死之后，判据⑫（不读题的人能考多少分）当场顶上来两条新的：
 *   挑标点最多的 36.8 分、挑技术符号最多的 35.0 分（随机基线 25）。
 * 根因是我自己写出来的：正确答案具体，带着 `softmax`、`O(N)`、`→`、顿号；
 * 三个干扰项图省事写成了泛泛的白话中文。`DNS→TCP 握手→TLS→HTTP` 配上
 * 「直接读取本地的文件、完全不走任何的网络」，不读题也知道挑哪个。
 *
 * 所以闸口跟着升级：答案的标点数、技术符号数都不许是**唯一最多**。
 * 这是在逼着写「同一话题下的另一种机制」而不是白话 ——
 * 顺序错的 `TCP 握手→DNS→TLS→HTTP`、协议错的 `DNS→UDP 直发→HTTP`，
 * 既配得上外形，排除它又真需要知识。题目质量本身就上去了。
 *
 * ⚠️ 只禁「唯一最多」，不要求相等：答案本来就该有符号的题不必为了配平去掺水。
 */
const NOTE_RE = /[A-Za-z0-9=+\-×·↔→√≈²³∝]/g
const PUNC_RE = /[，、；：（）(),;:]/g
function shapeLeak(answer, wrong) {
  const out = []
  for (const [name, re] of [['标点', PUNC_RE], ['技术符号', NOTE_RE]]) {
    const na = (answer.match(re) ?? []).length
    const nw = wrong.map(w => (w.match(re) ?? []).length)
    if (na > Math.max(...nw)) out.push(`${name}数 ${na} 比三个干扰项(${nw.join('/')})都多`)
  }
  return out
}

let pass = 0
const fail = []
const ready = []

for (const r of rewrites) {
  const key = `${r.exp}/${r.fid}`
  const o = orig.get(key)
  const bad = (why) => fail.push(`${key}：${why}`)
  if (!o) { bad(`不在待修清单里（${LEAKY} 没有它）`); continue }
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
  /**
   * 答案收到 12 字及以下会**静默把这条原理题变成计数题**。
   *
   * catalog.ts 的 genreOf 没写 `genre` 时按长度兜底：`answer.length <= 12 ? 'count' : 'concept'`。
   * 我把 pp/fill_bubble 收成「切成多个微批首尾衔接流入」正好 12 字，
   * 它当场从原理题里掉出去 —— 判据的分母从 961 变成 960，**而那条判据是绿的**
   * （分子也少了一条，看着还像"又降了一条债"）。没有任何东西会喊。
   *
   * 收长度是这轮的主要动作，所以这道闸必须在这里：13 字是下限，
   * 真要更短就得在源码里显式写 `genre: 'concept'`，写了就不再靠长度猜。
   */
  if (la <= 12 && !hasGenre(r.fid)) {
    bad(`答案收到 ${la} 字（≤12），会被 genreOf 按长度判成计数题、悄悄掉出原理题 —— 要么写长点，要么在源码里显式标 genre: 'concept'`)
    continue
  }

  //  外形配平：答案的标点 / 技术符号都不许是唯一最多
  const shape = shapeLeak(ans, w)
  if (shape.length) { bad(`${shape.join('；')} —— 干扰项别写成白话，要说同一话题下的另一种机制`); continue }
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
  ready.push([p, i, out, key])
}

console.log(`\n改写稿 ${rewrites.length} 条：过闸 ${pass}，打回 ${fail.length}`)
for (const f of fail) console.log(`  ❌ ${f}`)
if (!APPLY) { console.log('\n（只体检，没写。加 --apply 才写回源码。）'); process.exit(fail.length ? 1 : 0) }
for (const [p, i, ln] of ready) lines.get(p)[i] = ln
for (const p of new Set(ready.map(x => x[0]))) writeFileSync(p, lines.get(p).join('\n'))
console.log(`\n已写回 ${ready.length} 条 fact 的干扰项。`)

/**
 * 写回 ≠ 生效。**这一条是拿真事故换来的。**
 *
 * catalog.ts 末尾有个生成器，专管库层「这个库是干什么的」那一问：它在运行时
 * 把干扰项整个换成**别的库的角色描述**。于是我照着源码改了 qm_what / gs_what /
 * pd_what 一批，闸口全绿、文件也确实变了，**而用户看到的选项一个字没变** ——
 * 下一轮体检里它们原样又出现一次，我才发现前一轮白改。
 *
 * 静默的是「改了但没生效」，跟「抓到了但没写回」是同一种病：没有任何东西会喊。
 * 所以写完再从运行时读一遍，对不上就当场说出来。
 */
const { CATALOG, traceOf } = await import('../server/catalog.ts')
const byId = new Map(CATALOG.map(e => [e.id, e]))
const ghosts = []
//  只查**真写回去了**的那些。第一版查的是整份改写稿，于是被闸口打回、
//  压根没写的那条也被报成"写了没生效" —— 判据自己指错了地方。
const written = new Set(ready.map(x => x[3]))
for (const r of rewrites) {
  if (!written.has(`${r.exp}/${r.fid}`)) continue
  const e = byId.get(r.exp); if (!e) continue
  const f = e.facts.find(x => x.id === r.fid); if (!f) continue
  let live
  try { const t = traceOf(e); live = f.distractors(f.compute(t).answer, t) } catch { continue }
  const want = new Set(r.wrong)
  if (live.some(x => !want.has(x))) ghosts.push(`${r.exp}/${r.fid} → 运行时仍是：${live.join(' ｜ ')}`)
}
if (ghosts.length) {
  console.log(`\n⚠️ 这 ${ghosts.length} 条写进了源码但**运行时没生效**（有别的东西在覆盖它们，改源码没用）：`)
  for (const g of ghosts) console.log(`   ${g}`)
}
process.exit(fail.length ? 1 : 0)
