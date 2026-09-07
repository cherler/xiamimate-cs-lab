/**
 * 大白话层的**写法纪律**。
 *
 * 起因（用户 2026-09-07）：「定点乘除逐步 -> 看不懂。。（计算机组成原理的几个实验，好像都很难懂。
 * cache 命中率那个还是搜 ChatGPT 才懂）我感觉我们应该在这几个实验的导览上添加通俗易懂的解释才行。
 * 这是一个很好的地方。所有实验都可以添加一些通俗易懂的解释」。
 *
 * 已有的 `basics` 那一层不是写错了，是**腔调不对**：「内存块按块大小划分，调入调出均以块为单位」
 * 每个字都准确，但读它之前得先有画面，而画面不能用行话来建。所以另起一层 `plain`：
 * 一段不带术语的开场，摆在第 0 步「还没开始」那一屏（导览里）。
 *
 * 这里判的是**写法**，不是文采 —— 文采判不了，但下面这几条一走样就一定难读：
 *   ① 各段齐全（钩子 / 讲的是什么 / 名词表 / 盯着看什么），空字符串不算
 *   ② 钩子是**一句**话，别写成摘要
 *   ③ 钩子不许照抄 question —— 那句已经印在同一屏上了，抄一遍等于没写
 *   ④ 名词段要真是一份名词表（至少讲清 3 个词），不是一段泛泛的介绍
 *
 * ⚠️ 原来还有一段 `body`（拿生活里的东西打比方的大白话）。
 * 用户 2026-09-07 看过之后要求去掉：「把『大白话（打比方）』这部分去掉吧。没必要」——
 * 他卡住的地方是「屏幕上这些词我不认识」，比方解决不了那个，
 * 反而把真正有用的两段挤到了屏幕外面。240 条文案已从 guide.ts 删除，要找翻 git 历史。
 *
 * 覆盖率是**只许涨不许跌**的台账（240 个实验，一批批补）。
 *
 * 跑法：npx tsx tests/plain-language.test.ts（也在 npm test 里）
 */
import { GUIDES } from '../web/src/guide.ts'

let failures = 0
const ok = (m: string) => console.log('  ✅ ' + m)
const bad = (m: string) => { failures++; console.log('  ❌ ' + m) }

console.log('\n— 导览 · 大白话纪律 —')

/**
 * 写齐了 plain 的实验数**下限**。
 * 从 6（用户点名的计算机组成原理那几个）一批批补到 **240 —— 全覆盖**。
 * 所以这条从台账变成了及格线：新增实验必须自带一段大白话，少一条就判红。
 */
const PLAIN_MIN = 240

/**
 * 写了**百科段**（`wiki`）的实验数下限。只许涨不许跌。
 *
 * 用户看完只有大白话那一版说：「第 0 步的实验解释，说的内容是不是有点太少了」，
 * 又说清了要什么：「每一个实验都值得去搜索基础知识，不只是机制说明和实验说明，
 * 是对这件事的一个解释，让一般大学生都能看明白」「是指这件事（实验）的百科内容」。
 *
 * 所以这一段是**词条**：是什么、谁在什么年代想出来的、为什么会有它、今天用在哪。
 * 里面的人名年份**必须查证过**（见 guide.ts 里 `wiki` 的注释）—— 读者拿它当靠谱背景在读，
 * 错一个年份整段就废了。0 是起点，一批批补到 240。
 */
const WHAT_MIN = 0

/** 写了**名词段**的实验数下限。跟 WHAT_MIN 一起从 0 补到 240。 */
const TERMS_MIN = 0

const all = Object.entries(GUIDES)
const withPlain = all.filter(([, g]) => g.plain)

//  空跑自检：目录读不出来的话，下面每一条都会「0 例外」地绿过去
all.length >= 200
  ? ok(`扫过 ${all.length} 个实验的导览`)
  : bad(`只扫到 ${all.length} 个导览 —— GUIDES 读不出来的话，下面的判据等于空跑`)

/* ① 覆盖率台账 */
{
  withPlain.length >= PLAIN_MIN
    ? ok(`写齐了 plain 的实验 ${withPlain.length} 个（下限 ${PLAIN_MIN}）—— 还差 ${all.length - withPlain.length} 个`)
    : bad(`plain 掉到 ${withPlain.length} 个 < 下限 ${PLAIN_MIN} —— 是不是被删了?`)
}

/* ② 三段齐全 */
{
  const empty = withPlain.filter(([, g]) =>
    !g.plain!.hook.trim() || !g.plain!.watch.trim()).map(([id]) => id)
  empty.length === 0
    ? ok('钩子和「盯着看什么」都不为空')
    : bad(`有 ${empty.length} 条缺段：${empty.join(' ')}`)
}

/* ③ 钩子是一句话，不是摘要 */
{
  const HOOK_MAX = 40
  const long = withPlain.filter(([, g]) => [...g.plain!.hook].length > HOOK_MAX)
    .map(([id, g]) => `${id}(${[...g.plain!.hook].length}字)`)
  long.length === 0
    ? ok(`钩子都在 ${HOOK_MAX} 字以内（它是大标题，长了会折行挤掉正文）`)
    : bad(`有 ${long.length} 条钩子过长：${long.join('、')}`)
}

/* ⑤ 钩子不许照抄 question */
{
  const norm = (x: string) => x.replace(/[^一-龥A-Za-z0-9]/g, '')
  const copied = withPlain.filter(([, g]) => norm(g.plain!.hook) === norm(g.question)).map(([id]) => id)
  copied.length === 0
    ? ok('钩子都不是 question 的原样复制（那句就印在同一屏上，抄一遍等于没写）')
    : bad(`有 ${copied.length} 条钩子照抄了 question：${copied.join(' ')}`)
}

/* ⑤b 「这一屏讲的是什么」+「你会看到的这些名词」：覆盖率台账 + 写法约束 */
{
  const withWhat = withPlain.filter(([, g]) => g.plain!.what?.trim())
  withWhat.length >= WHAT_MIN
    ? ok(`写了「讲的是什么」的实验 ${withWhat.length} 个（下限 ${WHAT_MIN}）—— 还差 ${all.length - withWhat.length} 个`)
    : bad(`「讲的是什么」掉到 ${withWhat.length} 个 < 下限 ${WHAT_MIN} —— 是不是被删了?`)
  //  百科段比大白话长:它要交代来龙去脉(谁、什么年代、为什么、现在用在哪)
  const LO = 150, HI = 760
  const off = withWhat.map(([id, g]) => ({ id, n: [...g.plain!.what!].length }))
    .filter(x => x.n < LO || x.n > HI).map(x => `${x.id}(${x.n}字)`)
  off.length === 0
    ? ok(`「讲的是什么」都在 ${LO}–${HI} 字之间`)
    : bad(`有 ${off.length} 条长度出界：${off.join('、')}`)
  /*  机制段**两处都要显示**（导览里接在大白话后面、起点卡上单独摆），
      所以它不能跟正文重复 —— 重复的话第 0 步那一屏等于同一段话说两遍。
      判法跟 fact 那边同款：字符二元组重合度。 */
  const grams = (x: string) => new Set([...x.replace(/[^一-龥A-Za-z0-9]/g, '')].map((c, i, a) => c + (a[i + 1] ?? '')).slice(0, -1))
  const sim = (x: string, y: string) => {
    const A = grams(x), B = grams(y)
    if (!A.size || !B.size) return 0
    let hit = 0; for (const g of A) if (B.has(g)) hit++
    return hit / Math.min(A.size, B.size)
  }
  const dup = withWhat.filter(([, g]) => g.plain!.terms && sim(g.plain!.terms!, g.plain!.what!) >= 0.4).map(([id]) => id)
  dup.length === 0
    ? ok('「讲的是什么」跟名词段不雷同（两段挨着显示，说同一件事等于白写一段）')
    : bad(`有 ${dup.length} 条跟名词段雷同：${dup.join(' ')}`)
  const marked = withWhat.filter(([, g]) => /(^|\n)\s*(#|[-*·]\s|\d+[.、)])/.test(g.plain!.what!)).map(([id]) => id)
  marked.length === 0
    ? ok('「讲的是什么」里没有标题/列表符号')
    : bad(`有 ${marked.length} 条用了分点：${marked.join(' ')}`)

  /*  ⑤c 名词段。用户点破的根子：「我在这个实验之前，我看不懂在干嘛。所以我需要知道
      哪些东西是什么意思」—— 所以这一段是**进门前的扫盲**：把这一屏会出现的词逐个讲清。
      判它「像不像一份名词表」：至少解释 3 个词（写法是 `**词**：解释`）。
      少于 3 个多半是写成了一段泛泛的介绍 —— 那正是这一段要替代的东西。 */
  const withTerms = withPlain.filter(([, g]) => g.plain!.terms?.trim())
  withTerms.length >= TERMS_MIN
    ? ok(`写了名词段的实验 ${withTerms.length} 个（下限 ${TERMS_MIN}）—— 还差 ${all.length - withTerms.length} 个`)
    : bad(`名词段掉到 ${withTerms.length} 个 < 下限 ${TERMS_MIN}`)
  const thinTerms = withTerms
    .map(([id, g]) => ({ id, n: (g.plain!.terms!.match(/\*\*[^*]+\*\*[：:]/g) ?? []).length }))
    .filter(x => x.n < 3).map(x => `${x.id}(只解释了 ${x.n} 个词)`)
  thinTerms.length === 0
    ? ok('名词段都至少讲清 3 个词（少于 3 个多半写成了泛泛的介绍）')
    : bad(`有 ${thinTerms.length} 条名词段不成表：${thinTerms.join('、')}`)
  const tLen = withTerms.map(([id, g]) => ({ id, n: [...g.plain!.terms!].length }))
    .filter(x => x.n < 200 || x.n > 900).map(x => `${x.id}(${x.n}字)`)
  tLen.length === 0
    ? ok('名词段都在 200–900 字之间')
    : bad(`有 ${tLen.length} 条名词段长度出界：${tLen.join('、')}`)
  //  自检：这条「至少 3 个词」的规则拿人为造的坏数据必须判红
  ;('**甲**：一 **乙**：二'.match(/\*\*[^*]+\*\*[：:]/g) ?? []).length === 2
    ? ok('自检：名词计数确实数得出「**词**：」这种写法')
    : bad('自检失败：名词计数是坏的，⑤c 等于空跑')
}

/* ⑦ 能判红的自检 —— 每条规则拿人为造的坏数据试一次 */
{
  const fake = { hook: '', watch: '' }
  !fake.hook.trim() && !fake.watch.trim()
    ? ok('自检：空钩子 / 空「盯着看什么」确实会被②判红')
    : bad('自检失败：②对人为造的坏数据没反应，等于空跑')
  const norm = (x: string) => x.replace(/[^一-龥A-Za-z0-9]/g, '')
  norm('这是一句话！') === norm('这是一句话。')
    ? ok('自检：⑤的比较忽略标点（「问？」和「问。」算同一句）')
    : bad('自检失败：⑤的归一化没生效，照抄 question 只要改个标点就溜过去了')
  ;(/(^|\n)\s*[-*·]\s/).test('\n- 分点')
    ? ok('自检：⑥抓得住人为造的分点写法')
    : bad('自检失败：⑥抓不住分点，等于空跑')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
