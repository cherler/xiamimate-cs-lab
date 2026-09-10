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

  //  自检:把 DISCIPLINE_OF_GROUP 改回从全量建,②那条必须红
  const badOfGroup = 'for (const d of DISCIPLINES) for (const g of d.groups) m[g] = d'
  !RE_OFGROUP.test(badOfGroup)
    ? ok('自检：从全量清单建 DISCIPLINE_OF_GROUP 会被 ②抓住')
    : bad('自检失败：②认不出"从全量建"这种写法')
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failures === 0 ? '本套全部通过' : `隐藏学科：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
