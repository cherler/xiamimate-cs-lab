/**
 * 隐藏一整轨学科，是**真的不露面**吗。
 *
 * 2026-09-10 用户说「具身智能好像不属于 CS？把它隐藏掉」。第一反应是把
 * `status` 翻成 `'planned'` —— **那是错的**：planned 照样渲染一颗页签，只是灰的、
 * 旁边挂个「即将」。所以加了第三档 `'hidden'`，并让所有「列出学科」的地方
 * 统一读 `VISIBLE_DISCIPLINES`。
 *
 * 这条判据要钉住的，正是**那个统一**会悄悄退化的那一面：
 * 以后谁再写一处「遍历 DISCIPLINES 画出来」的界面，隐藏轨就又冒出来了，
 * 而页面看上去只是"多了一个页签"，不报错、不崩、没人发现。
 *
 * ⚠️ 只能读源码，不能 import registry.ts —— 它走 `@engine/*` 这个 vite 别名，
 *    node 侧解析不了（guide-coverage.test.ts 同样是读源码，这里沿用）。
 *
 * 每条都配一次自检：判据得能红。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

const SRC = new URL('../web/src/', import.meta.url).pathname
const reg = readFileSync(join(SRC, 'registry.ts'), 'utf8')

console.log('\n【隐藏的学科一个都不露面】')

// ── ① 隐藏轨还在全量清单里，只是标了 hidden ────────────────────
const discBlock = reg.slice(reg.indexOf('export const DISCIPLINES'), reg.indexOf('export type Anchor'))
const entries = [...discBlock.matchAll(/key:\s*'([a-z]+)',\s*title:\s*'([^']+)'[^}]*?status:\s*'(active|planned|hidden)'/g)]
  .map(m => ({ key: m[1], title: m[2], status: m[3] }))
{
  entries.length >= 3
    ? ok(`解析到 ${entries.length} 轨：${entries.map(e => `${e.title}(${e.status})`).join('、')}`)
    : bad(`DISCIPLINES 解析不出来（只认出 ${entries.length} 轨）—— 结构变了，这条判据要跟着改`)

  const hidden = entries.filter(e => e.status === 'hidden')
  //  藏起来 ≠ 删掉：实验、guide、内核一个都没删,改回 'active' 就整轨回来
  hidden.length > 0
    ? ok(`${hidden.length} 轨标了 hidden（${hidden.map(e => e.title).join('、')}），仍留在全量清单里`)
    : bad('一轨 hidden 都没有 —— 具身智能被删了？还是 status 又被改回去了？')
}

//  两条正则 ②③ 都要用，提到最前面（const 不提升，写在下面会 ReferenceError）
const RE = /\bDISCIPLINES\s*(?:\.\s*(?:map|filter|find|forEach|slice)|\[)|for\s*\([^)]*\bof\s+DISCIPLINES\b/
const RE_OFGROUP = /for\s*\(\s*const\s+d\s+of\s+VISIBLE_DISCIPLINES\s*\)/

// ── ② 「谁露面」只有一个读法 ──────────────────────────────────
{
  //  VISIBLE_DISCIPLINES 必须真的把 hidden 滤掉
  const RE_VIS = /\bVISIBLE_DISCIPLINES[^=]*=\s*DISCIPLINES\.filter\(\s*d\s*=>\s*d\.status\s*!==\s*'hidden'\s*\)/
  RE_VIS.test(reg)
    ? ok("VISIBLE_DISCIPLINES = DISCIPLINES.filter(d => d.status !== 'hidden')")
    : bad('VISIBLE_DISCIPLINES 不是按 hidden 过滤出来的 —— 隐藏这件事没有真源')

  /**
   * DISCIPLINE_OF_GROUP 必须**从 VISIBLE_DISCIPLINES 建**，不能从 DISCIPLINES 建。
   * 搜索和跨轨跳转都拿它当「这个实验能不能被导航到」的判据：
   * 从全量建的话，页签没了、搜索还搜得到 —— **等于没藏**。
   */
  const ofGroup = reg.slice(reg.indexOf('export const DISCIPLINE_OF_GROUP')).slice(0, 400)
  RE_OFGROUP.test(ofGroup)
    ? ok('DISCIPLINE_OF_GROUP 从 VISIBLE_DISCIPLINES 建 —— 隐藏轨底下的实验一并搜不到')
    : bad(`DISCIPLINE_OF_GROUP 不是从 VISIBLE_DISCIPLINES 建的：${ofGroup.slice(0, 160)}`)
}

// ── ③ 界面里没有一处直接遍历全量清单 ──────────────────────────
//  隐藏轨会不会冒出来,全看这一条 —— 多一处 .map 就多一个漏点。
{
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(dir, e.name))
      : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [])
  const files = walk(SRC).filter(f => !f.endsWith('registry.ts'))   // 真源自己当然要用它
  const offenders = files
    //  VISIBLE_DISCIPLINES 里也含 "DISCIPLINES",先摘掉再扫,免得每一处合规写法都被当成违规
    .filter(f => RE.test(readFileSync(f, 'utf8').replace(/VISIBLE_DISCIPLINES/g, '·VD·')))
    .map(f => f.slice(SRC.length))
  offenders.length === 0
    ? ok(`扫了 ${files.length} 个界面源文件，没有一处直接遍历 DISCIPLINES（都走 VISIBLE_DISCIPLINES）`)
    : bad(`这些地方直接遍历了全量清单，隐藏轨会从这里冒出来：${offenders.join('、')}`)
}

// ── ④ 软链不许在同一个学科里借自己 ────────────────────────────
/**
 * 2026-09-10 实测：大模型页签目录排到 68，计数条却写 63 —— 5 个实验在同一条轨里
 * 出现两次（真身一次 + 同轨软链 ↗ 一次），点 ↗ 那份会同时高亮两行。
 *
 * 根因：`'大模型算法'` 这个组在 **llm** 轨里，而被软链进去的五个实验真身也在 llm。
 * 注释写的是「软链进算法轨」，作者以为那是算法轨的组 —— **注释说的和代码做的不一样**，
 * 而这种错在界面上只表现为「数字对不上」，不报错。
 *
 * 软链的意义是**跨学科借看**：A 轨的人也能看到 B 轨的某个实验。
 * 目标组和被借实验落在同一个学科，就不是"借"，是复制。
 */
{
  const soft = reg.slice(reg.indexOf('export const SOFT_LINKS'))
  /**
   * ⚠️ **先把注释剥掉再解析。**
   * 第一次写这条判据时它红了 —— 而软链已经删掉了：红的原因是**我在删除处写的注释里
   * 原样引用了那行代码**，判据把注释当成了代码。
   * 一条能被注释骗到的判据，抓不到真问题也会误报真没问题的时候。
   */
  const block = soft.slice(0, soft.indexOf('\n}'))
    .replace(/\/\*[\s\S]*?\*\//g, '')      // 块注释
    .replace(/^[ \t]*\/\/.*$/gm, '')        // 行注释
  const links = [...block.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)]
    .map(m => ({ group: m[1], ids: [...m[2].matchAll(/'([a-z0-9]+)'/g)].map(x => x[1]) }))
  links.length >= 3
    ? ok(`解析到 ${links.length} 条软链`)
    : bad(`只解析到 ${links.length} 条软链 —— 结构变了，这条判据要跟着改`)

  //  组 → 学科（含隐藏轨，这里要的是"归属"不是"露不露面"）
  const discOf: Record<string, string> = {}
  for (const m of discBlock.matchAll(/key:\s*'([a-z]+)'[\s\S]*?groups:\s*\[([^\]]*)\]/g))
    for (const g of m[2].matchAll(/'([^']+)'/g)) discOf[g[1]] = m[1]
  //  实验 id → 它真身所在的组
  const groupOfExp: Record<string, string> = {}
  for (const m of reg.matchAll(/id:\s*'([a-z0-9]+)',[\s\S]{0,400}?\n  group:\s*'([^']+)'/g))
    if (!(m[1] in groupOfExp)) groupOfExp[m[1]] = m[2]

  const selfBorrow: string[] = []
  for (const l of links) {
    const target = discOf[l.group]
    if (!target) continue                     // 目标组不属于任何轨 —— 由下一条管
    for (const id of l.ids) {
      const home = discOf[groupOfExp[id] ?? '']
      if (home && home === target) selfBorrow.push(`${l.group}←${id}(真身也在 ${home})`)
    }
  }
  selfBorrow.length === 0
    ? ok('没有一条软链在同一个学科里借自己 —— 不会出现"同页签列两次、计数对不上"')
    : bad(`这些软链在同轨内借自己，会重复列出：${selfBorrow.join('；')}`)

  /*  死配置：目标组不属于任何学科，谁也看不到。不是 bug，但留着会让人以为它在起作用。
      当前实测有 3 条（数据库系统 / 并发编程 / 运动规划）—— 前两个的后端轨、
      第三个的具身轨都不显示。记账封顶，只许降不许涨。 */
  const DEAD_CAP = 3
  const dead = links.filter(l => !discOf[l.group]).map(l => l.group)
  dead.length <= DEAD_CAP
    ? ok(`目标组不属于任何轨的死软链还有 ${dead.length} 条（上限 ${DEAD_CAP}，只许降）：${dead.join('、') || '无'}`)
    : bad(`死软链变多了：${dead.length} > ${DEAD_CAP}：${dead.join('、')}`)
}

// ── 自检：上面三条都得能红 ────────────────────────────────────
{
  const FAKE = 'const tabs = DISCIPLINES.map(d => d.title)'
  const FAKE2 = 'for (const d of DISCIPLINES) render(d)'
  const SAFE = 'const tabs = VISIBLE_DISCIPLINES.map(d => d.title)'.replace(/VISIBLE_DISCIPLINES/g, '·VD·')
  RE.test(FAKE) && RE.test(FAKE2) && !RE.test(SAFE)
    ? ok('自检：`DISCIPLINES.map` 与 `for…of DISCIPLINES` 都被抓住，`VISIBLE_DISCIPLINES.map` 不误伤')
    : bad(`自检失败：抓 .map=${RE.test(FAKE)} 抓 for-of=${RE.test(FAKE2)} 误伤 VISIBLE=${RE.test(SAFE)}`)

  //  自检:把 hidden 改回 active,①那条必须红
  const flipped = discBlock.replace("status: 'hidden'", "status: 'active'")
  const stillHidden = [...flipped.matchAll(/status:\s*'hidden'/g)].length
  stillHidden === 0
    ? ok('自检：把 hidden 改回 active，①那条会红 —— 它真的在看 status，不是永远为真')
    : bad('自检失败：改掉 status 之后 ①还是过')

  //  自检:④ 同轨自借要能认出来
  const FAKE_SOFT = { group: '大模型算法', id: 'sampling' }
  const fakeDisc: Record<string, string> = { '大模型算法': 'llm', 'Transformer 原理': 'llm' }
  fakeDisc[FAKE_SOFT.group] === fakeDisc['Transformer 原理']
    ? ok('自检：把 sampling 软链回大模型轨自己的组，④那条会红（那正是删掉前的实况）')
    : bad('自检失败：④认不出同轨自借')

  //  自检:把 DISCIPLINE_OF_GROUP 改回从全量建,②那条必须红
  const badOfGroup = 'for (const d of DISCIPLINES) for (const g of d.groups) m[g] = d'
  !RE_OFGROUP.test(badOfGroup)
    ? ok('自检：从全量清单建 DISCIPLINE_OF_GROUP 会被 ②抓住')
    : bad('自检失败：②认不出"从全量建"这种写法')
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failures === 0 ? '本套全部通过' : `隐藏学科：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
