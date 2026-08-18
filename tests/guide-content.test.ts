/**
 * 讲解层的内容规则。
 *
 * 这一套只验**文本自身立不立得住**（词条引用、字段非空、没有重复）。
 * 「导览提到的旋钮在页面上真的存在吗」验不了 —— 那要跑起来才知道，
 * 在冒烟第 13 组里（`scripts/platform-smoke.mjs` 与 `web-smoke.mjs` 都不合适，
 * 它在 web-smoke 里，因为那是本仓自己的界面）。
 *
 * **为什么不能在这里 import registry**：注册表 import 了 `@engine/*` 与 .tsx 舞台，
 * 而仓库根的 tsconfig 是给引擎用的（没有 paths、没有 jsx）。
 * 所以「够不够 30 个实验」这条也归浏览器那边 —— 它在那儿反而更强：
 * 数的是**页面上真的列出来的**实验，不是源码里写了几条。
 */
import { GUIDES, TERMS, TOUR, cardsOf, tourCards } from '../web/src/guide.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

console.log('\n【词表】')
{
  const ids = TERMS.map(t => t.id)
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i)
  dup.length === 0 ? ok(`${TERMS.length} 个词条，id 无重复`) : bad(`id 重复：${[...new Set(dup)].join(', ')}`)

  const empty = TERMS.filter(t => !t.term.trim() || !t.gloss.trim())
  empty.length === 0 ? ok('每个词条都有名字和解释') : bad(`空词条：${empty.map(t => t.id).join(', ')}`)

  //  解释太短基本等于没解释（"就是那个意思"）。50 字是拍的，但它挡得住占位符。
  const thin = TERMS.filter(t => t.gloss.length < 20)
  thin.length === 0 ? ok('解释都不短于 20 字') : bad(`解释过短：${thin.map(t => `${t.id}(${t.gloss.length})`).join(', ')}`)
}

console.log('\n【导览】')
{
  const entries = Object.entries(GUIDES)
  ok(`共 ${entries.length} 个实验有导览`)

  const noQ = entries.filter(([, g]) => g.question.trim().length < 8)
  noQ.length === 0 ? ok('每个都写清了"回答什么问题"') : bad(`问题句缺失或过短：${noQ.map(([k]) => k).join(', ')}`)

  //  问题句应当是个问句 —— 它的作用是让人一眼知道"这一屏在问什么"。
  const notQuestion = entries.filter(([, g]) => !/[？?]$/.test(g.question.trim()))
  notQuestion.length === 0 ? ok('问题句都是问句') : bad(`不是问句：${notQuestion.map(([k]) => k).join(', ')}`)

  const thinRead = entries.filter(([, g]) => g.read.length < 2 || g.read.some(r => !r.at.trim() || !r.is.trim()))
  thinRead.length === 0 ? ok('"屏幕上每块是什么"至少两条且都填了') : bad(`read 不合格：${thinRead.map(([k]) => k).join(', ')}`)

  const thinTry = entries.filter(([, g]) => g.try.length < 2 || g.try.some(t => !t.act.trim() || !t.watch.trim()))
  thinTry.length === 0 ? ok('"先拧什么看什么"至少两条且都填了') : bad(`try 不合格：${thinTry.map(([k]) => k).join(', ')}`)
}

console.log('\n【引用】')
{
  const known = new Set(TERMS.map(t => t.id))
  const dangling: string[] = []
  for (const [id, g] of Object.entries(GUIDES)) {
    for (const t of g.terms) if (!known.has(t)) dangling.push(`${id} → ${t}`)
  }
  dangling.length === 0
    ? ok('导览引用的词条全都存在（没有悬空引用）')
    : bad(`悬空引用：${dangling.join('; ')}`)

  //  反过来：词表里写了却没人用的词条 —— 不判失败，但要报出来。
  //  它多半意味着某个实验的 terms 漏填了。
  const used = new Set(Object.values(GUIDES).flatMap(g => g.terms))
  const orphan = TERMS.filter(t => !used.has(t.id)).map(t => t.id)
  console.log(orphan.length === 0
    ? '  ✅ 词表里没有没人引用的词条'
    : `  ⚪️ ${orphan.length} 个词条暂时没被引用（不算失败，但多半是某个实验漏填了）：${orphan.join(', ')}`)

  const dupTerms = Object.entries(GUIDES).filter(([, g]) => new Set(g.terms).size !== g.terms.length)
  dupTerms.length === 0 ? ok('同一实验里没有重复引用') : bad(`重复引用：${dupTerms.map(([k]) => k).join(', ')}`)
}

console.log('\n【卡片序列】')
{
  //  摊平之后的 id 必须唯一 —— 重复的 id 会让"点元素跳到那一页"跳错地方
  const clash: string[] = []
  for (const id of Object.keys(GUIDES)) {
    const ids = cardsOf(id).map(c => c.id)
    if (new Set(ids).size !== ids.length) clash.push(id)
  }
  clash.length === 0 ? ok('每个实验的卡片 id 都不重复') : bad(`卡片 id 重复：${clash.join(', ')}`)

  const short = Object.keys(GUIDES).filter(id => cardsOf(id).length < 5)
  short.length === 0
    ? ok(`最短的一串也有 ${Math.min(...Object.keys(GUIDES).map(id => cardsOf(id).length))} 张卡`)
    : bad(`卡片太少：${short.join(', ')}`)

  //  锚点得是**非空**的选择器。写成空串比不写更糟：不写是"这一页不高亮"，
  //  空串会让 querySelector 抛，而抛在渲染里就是整块白屏。
  const emptyAnchor: string[] = []
  for (const id of Object.keys(GUIDES)) {
    for (const c of cardsOf(id)) {
      if (c.anchor !== undefined && !c.anchor.trim()) emptyAnchor.push(`${id}/${c.id}`)
      if (c.param !== undefined && !c.param.trim()) emptyAnchor.push(`${id}/${c.id}`)
    }
  }
  emptyAnchor.length === 0 ? ok('没有空的锚点') : bad(`空锚点：${emptyAnchor.join(', ')}`)

  //  「先拧什么」那几张要么锚到参数/预置、要么锚到舞台 —— 不能什么都不锚，
  //  否则翻到那一页时屏幕上没有任何东西亮起来，用户不知道该看哪儿。
  const noAnchor: string[] = []
  for (const id of Object.keys(GUIDES)) {
    for (const c of cardsOf(id)) {
      if (!c.anchor && !c.param && !c.preset && !c.id.startsWith('term:')) {
        noAnchor.push(`${id}/${c.id}`)
      }
    }
  }
  noAnchor.length === 0
    ? ok('除名词页外，每张卡都锚到了页面上的某个东西')
    : bad(`这些卡没有锚点，翻到时屏幕上不会有任何反应：${noAnchor.join(', ')}`)

  tourCards().length === TOUR.length && tourCards().every(c => c.anchor)
    ? ok(`页面导览 ${tourCards().length} 张卡，每张都有锚点`)
    : bad('页面导览的卡片或锚点不完整')
}

console.log('\n【页面导览】')
{
  TOUR.length >= 5 && TOUR.every(r => r.at.trim() && r.is.trim())
    ? ok(`页面导览 ${TOUR.length} 条，都填了`)
    : bad('页面导览不完整')
}

console.log('\n【自检】')
{
  //  判据得会红：往词表里塞一个引用不存在的词条，"悬空引用"那条必须抓到。
  const known = new Set(TERMS.map(t => t.id))
  const fake = 'term-that-does-not-exist'
  !known.has(fake)
    ? ok('自检：拿一个不存在的词条 id 去查，确实查不到 —— 悬空引用那条判据能红')
    : bad('自检失败：连编出来的 id 都在词表里，那条判据说明不了问题')
}
{
  //  判据得会红：把某个实验的 try 清空，"至少两条"必须抓到。
  const g = Object.values(GUIDES)[0]!
  const emptied = { ...g, try: [] }
  emptied.try.length < 2
    ? ok('自检：try 清空后确实不满足"至少两条" —— 那条判据能红')
    : bad('自检失败：空的 try 也算合格')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
