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
 *   npx tsx scripts/quiz-leaky.ts                              先生成待修清单 quiz-leaky.json
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
/**
 * 待修清单由 `npx tsx scripts/quiz-leaky.ts` 生成（默认写 ./quiz-leaky.json）。
 * 用 QUIZ_LEAKY 环境变量可以换个位置。清单不在就直接说清楚该跑哪一条命令 ——
 * 这里原来写死过一个会话专用的绝对路径，换台机器就是一句看不懂的 ENOENT。
 */
const LEAKY = process.env.QUIZ_LEAKY ?? 'quiz-leaky.json'
let leaky
try { leaky = JSON.parse(readFileSync(LEAKY, 'utf8')) }
catch { console.error(`读不到待修清单 ${LEAKY} —— 先跑：npx tsx scripts/quiz-leaky.ts`); process.exit(2) }
const orig = new Map(leaky.map((r) => [`${r.exp}/${r.fid}`, r]))

/** 源码：server/catalog.ts 本体 + server/catalog/ 下的每个文件 */
const SRC = ['server/catalog.ts', ...readdirSync('server/catalog').filter(f => f.endsWith('.ts')).map(f => join('server/catalog', f))]
const text = new Map(SRC.map(p => [p, readFileSync(p, 'utf8')]))

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
/**
 * 两条通道的容差不一样，是**量出来的**，不是拍的。
 *
 * 给一个只看外形的作弊者设「差多少才下注」的门槛，实测(581 条点得到的题)：
 *            差≥1    差≥2    差≥3    差≥4
 *   技术符号  41.7   37.7   35.2   32.9   ← 差 4 个符号还能考 33 分，真漏
 *   标点      39.6   27.6   25.9   25.3   ← 差 2 个就掉到基线，36.8 全是"差一个逗号"的噪声
 *   字数      25.0   25.0   25.0   25.0   ← 这条已经死透
 *
 * 所以技术符号卡 ≥2 就打回，标点放到 ≥3。
 * **这不是放松闸口，是别让它逼着我去数逗号** —— 为配平而删答案里一个顿号，
 * 既不改善题目、也蒙不到分，纯属给自己的指标灌水。
 */
const TOL = { 标点: 3, 技术符号: 2 }
function shapeLeak(answer, wrong) {
  const out = []
  for (const [name, re] of [['标点', PUNC_RE], ['技术符号', NOTE_RE]]) {
    const na = (answer.match(re) ?? []).length
    const nw = wrong.map(w => (w.match(re) ?? []).length)
    const gap = na - Math.max(...nw)
    if (gap >= TOL[name]) out.push(`${name}数 ${na} 比三个干扰项(${nw.join('/')})多 ${gap} 个`)
  }
  return out
}

/**
 * 圈出一条 fact 在源码里的那一段。
 *
 * ⚠️ **两种写法都要认。** 主表是 `{ id: 'xx', … }` 的对象字面量，
 * 而 concepts.ts / concepts-fill.ts 是 `cf('xx', label, ask, answer, wrong[], …)`
 * 这种紧凑调用 —— 里面**没有 `id:` 这个字样**。
 * 只认前一种的话，后者会被判成"找不到自己那一段"，于是当成运行时生成的一律拒改 ——
 * 而那三百多条恰恰是最需要改的。少认一种写法就是少覆盖一批，
 * 跟今晚 mkLib 那次是同一种病。
 */
function factBlock(fid, srcMap) {
  let out = ''
  for (const [p, t] of srcMap) {
    let at = t.indexOf(`id: '${fid}'`)
    if (at < 0) at = t.indexOf(`cf('${fid}'`)
    if (at < 0) continue
    const rest = t.slice(at + 1)
    const nxt = rest.search(/id: '[a-z0-9_-]+'|cf\('[a-z0-9_-]+'/)
    out += t.slice(at, nxt < 0 ? t.length : at + 1 + nxt) + '\n'
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
  const shape = shapeLeak(r.answer, wrong)
  if (shape.length) { bad(`${shape.join('；')} —— 干扰项别写成白话，要说同一话题下的另一种机制`); continue }
  /**
   * **干扰项是运行时生成的，就别碰。**（这条是拿一次真事故换来的。）
   *
   * 库层「这个库是干什么的」那一问，干扰项不写在源码里 —— catalog.ts 末尾有个生成器，
   * 运行时从**别的库的答案**里挑三条当干扰项。于是让这个脚本去替换那些"原文"，
   * 它按全局唯一命中一找，找到的是**别的实验自己的答案**，一替换就把
   * langgraph / matplotlib / sklearn 的答案改成了 pandas 的干扰项。
   * 三条实验的答案当场变成风马牛不相及的东西，而闸口全绿、写回也"成功"了。
   *
   * 所以先验一道：每条原干扰项必须出现在**这条 fact 自己那一段**里。
   * 找不到就说明它是别处生成的 —— 拒绝，别猜。
   */
  if (r.wrong && o.wrong.some((w, i) => w !== wrong[i])) {
    const blocks = factBlock(r.fid, SRC.map(p => [p, text.get(p)]))
    const stray = o.wrong.filter((w, i) => w !== wrong[i] && !blocks.includes(w))
    if (stray.length) {
      bad(`干扰项不写在这条 fact 自己那一段里（多半是运行时生成的），改源码会误伤别的实验：`
        + `「${stray[0].slice(0, 20)}…」`)
      continue
    }
  }
  //  写回前先确认每条原文在源码里唯一命中
  const edits = []
  let ok = true
  for (const [from, to] of [[o.answer, r.answer], ...o.wrong.map((w, i) => [w, wrong[i]])]) {
    if (from === to) continue
    /**
     * 按**带引号的整串**找，而不是裸子串。
     *
     * 一句答案常常会在同一个文件里出现两次：一次是选项本身，一次被 `note`
     * （讲解出处）原样引用进一段更长的话里。裸子串匹配会判成"出现 2 次、不敢改"，
     * 把本来能改的挡下来；而真去替换又会连讲解里那句一起改掉。
     * 带引号的整串只匹配**字面量本身** —— 引用它的那段长话不会带上闭合引号。
     */
    const forms = [`'${from}'`, `"${from}"`, from]
    let hitForm = '', hitFile = '', scope = null
    for (const form of forms) {
      const files = SRC.filter(p => text.get(p).split(form).length - 1 === 1)
      const anywhere = SRC.filter(p => text.get(p).includes(form))
      if (files.length === 1 && anywhere.length === 1) { hitForm = form; hitFile = files[0]; break }
    }
    /**
     * 全局唯一命不中时的兜底：**把范围缩到这条 fact 自己的那一段**。
     *
     * 打回里最常见的一条是「原文在 catalog.ts 里不是唯一命中，不敢改」，
     * 而卡住的几乎总是 `'两者完全一样'`、`'随机选一条'` 这种**被十几条 fact 共用的短桩**。
     * 全局看它当然不唯一；但在 `id: 'lfu_vs_lru'` 到下一条 fact 之间，它只出现一次。
     *
     * 「不敢改」这个默认是对的 —— 宁可少改一条也不能改错一处。所以兜底不是放松它，
     * 是**换一个更小、更有据的锚点**：先按 fact id 圈出区间，再在区间内要求唯一。
     * 圈不出区间、或区间内仍不唯一，照旧打回。
     */
    if (!hitForm) {
      for (const p of SRC) {
        const t = text.get(p)
        const at = t.indexOf(`id: '${r.fid}'`) >= 0 ? t.indexOf(`id: '${r.fid}'`) : t.indexOf(`'${r.fid}',`)
        if (at < 0) continue
        //  区间 = 这条 fact 的 id 往后，到下一条 fact 的 id 为止
        const rest = t.slice(at + 1)
        const nxt = rest.search(/id: '[a-z0-9_]+'|\n\s*cf\('/)
        const end = nxt < 0 ? t.length : at + 1 + nxt
        const seg = t.slice(at, end)
        const form = forms.find(f => seg.split(f).length - 1 === 1)
        if (form) { hitForm = form; hitFile = p; scope = [at, end]; break }
      }
    }
    if (!hitForm) {
      const anywhere = SRC.filter(p => text.get(p).includes(from))
      bad(anywhere.length === 0
        ? `源码里找不到原文：「${from.slice(0, 24)}…」`
        : `原文在 ${anywhere.join('、')} 里不是唯一命中、缩到这条 fact 自己那段也不唯一，不敢改：「${from.slice(0, 24)}…」`)
      ok = false; break
    }
    edits.push([hitFile, hitForm, hitForm.startsWith("'") || hitForm.startsWith('"')
      ? hitForm[0] + to + hitForm[0] : to, scope])
  }
  if (!ok) continue
  pass++
  ready.push({ key, edits })
}

console.log(`\n改写稿 ${rewrites.length} 条：过闸 ${pass}，打回 ${fail.length}`)
for (const f of fail) console.log(`  ❌ ${f}`)

if (!APPLY) { console.log(`\n（只体检，没写。加 --apply 才写回源码。）`); process.exit(fail.length ? 1 : 0) }

let n = 0
for (const { edits } of ready) for (const [p, from, to, scope] of edits) {
  const t = text.get(p)
  //  有 scope 的只在那一段里换（全局第一处可能是别条 fact 的同名短桩）
  text.set(p, scope
    ? t.slice(0, scope[0]) + t.slice(scope[0], scope[1]).replace(from, to) + t.slice(scope[1])
    : t.replace(from, to))
  n++
}
for (const [p, s] of text) writeFileSync(p, s)
console.log(`\n已写回 ${ready.length} 条 fact、${n} 处字符串。`)
process.exit(fail.length ? 1 : 0)
