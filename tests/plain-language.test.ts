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
 *   ① 三段齐全（钩子 / 正文 / 盯着看什么），空字符串不算
 *   ② 钩子是**一句**话，别写成摘要
 *   ③ 正文有下限也有上限：太短建不起画面，太长没人读完（卡片高度封在版面里）
 *   ④ 钩子不许照抄 question —— 那句已经印在同一屏上了，抄一遍等于没写
 *   ⑤ 正文里不许出现 Markdown 的标题/列表符号：这一段是**读**的，不是查的
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
 * 写了大白话的实验数**下限**。补一批就把它调高，只许涨不许跌。
 * 6 是第一批（用户点名的计算机组成原理那几个）。
 */
const PLAIN_MIN = 6

const all = Object.entries(GUIDES)
const withPlain = all.filter(([, g]) => g.plain)

//  空跑自检：目录读不出来的话，下面每一条都会「0 例外」地绿过去
all.length >= 200
  ? ok(`扫过 ${all.length} 个实验的导览`)
  : bad(`只扫到 ${all.length} 个导览 —— GUIDES 读不出来的话，下面的判据等于空跑`)

/* ① 覆盖率台账 */
{
  withPlain.length >= PLAIN_MIN
    ? ok(`写了大白话的实验 ${withPlain.length} 个（下限 ${PLAIN_MIN}）—— 还差 ${all.length - withPlain.length} 个`)
    : bad(`大白话掉到 ${withPlain.length} 个 < 下限 ${PLAIN_MIN} —— 是不是被删了?`)
}

/* ② 三段齐全 */
{
  const empty = withPlain.filter(([, g]) =>
    !g.plain!.hook.trim() || !g.plain!.body.trim() || !g.plain!.watch.trim()).map(([id]) => id)
  empty.length === 0
    ? ok('每条大白话的三段都不为空（钩子 / 正文 / 盯着看什么）')
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

/* ④ 正文的上下限 */
{
  const LO = 90, HI = 460
  const off = withPlain.map(([id, g]) => ({ id, n: [...g.plain!.body].length }))
    .filter(x => x.n < LO || x.n > HI)
    .map(x => `${x.id}(${x.n}字)`)
  off.length === 0
    ? ok(`正文都在 ${LO}–${HI} 字之间（短了建不起画面，长了没人读完 —— 卡片高度封在版面里）`)
    : bad(`有 ${off.length} 条正文长度出界：${off.join('、')}`)
}

/* ⑤ 钩子不许照抄 question */
{
  const norm = (x: string) => x.replace(/[^一-龥A-Za-z0-9]/g, '')
  const copied = withPlain.filter(([, g]) => norm(g.plain!.hook) === norm(g.question)).map(([id]) => id)
  copied.length === 0
    ? ok('钩子都不是 question 的原样复制（那句就印在同一屏上，抄一遍等于没写）')
    : bad(`有 ${copied.length} 条钩子照抄了 question：${copied.join(' ')}`)
}

/* ⑥ 正文不许用标题/列表符号 —— 这一段是读的，不是查的 */
{
  const marked = withPlain.filter(([, g]) => /(^|\n)\s*(#|[-*·]\s|\d+[.、)])/.test(g.plain!.body))
    .map(([id]) => id)
  marked.length === 0
    ? ok('正文里没有标题/列表符号（分点会让人跳着扫，而这一段要的是从头读到尾）')
    : bad(`有 ${marked.length} 条正文用了分点：${marked.join(' ')}`)
}

/* ⑦ 能判红的自检 —— 每条规则拿人为造的坏数据试一次 */
{
  const fake = { hook: '', body: '短', watch: '' }
  !fake.hook.trim() && [...fake.body].length < 90
    ? ok('自检：空钩子和过短正文确实会被②④判红')
    : bad('自检失败：②④对人为造的坏数据没反应，等于空跑')
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
