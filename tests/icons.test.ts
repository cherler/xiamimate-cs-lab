/**
 * 图标一致性 —— 同一个名字在全站只能有一个图标,同一个图标也只能指一件事。
 *
 * 起因(用户 2026-09-06 报的漏洞):「大模型」在**菜单**里是 🧩、在**学科地图的锚点芯片**
 * 里是 🤖 —— 两处都写着「大模型」三个字,图标却不一样;而 🧩 同时还是锚点「软件」的图标。
 * 这类错不报错、不影响功能,只是让人以为那是两样东西,所以必须有判据钉着。
 *
 * 两条规则:
 *   ① 同名必同图标(学科 title / 学科终点 to / 锚点 label 放在一起看)。
 *   ② 同图标必同名 —— 一个 emoji 指两件事,读的人会以为它们是一回事。
 *
 * **为什么是解析源文件而不是 import**:`web/src/registry.ts` 会一路拖进 React 舞台组件
 * (它们要 `import.meta.env`),在 node 里根本 import 不起来。而这本来就是一条**源数据**
 * 的一致性判据,读文本是对的。
 *
 * 跑法:npx tsx tests/icons.test.ts(也在 npm test 里)
 */
import { readFileSync } from 'node:fs'

let failures = 0
const ok = (m: string) => console.log('  ✅ ' + m)
const bad = (m: string) => { failures++; console.log('  ❌ ' + m) }

const src = readFileSync(new URL('../web/src/registry.ts', import.meta.url), 'utf8')
const between = (a: string, b: string) => {
  const i = src.indexOf(a); if (i < 0) throw new Error(`registry.ts 里找不到 ${a} —— 结构变了,这条判据要跟着改`)
  const j = src.indexOf(b, i); return src.slice(i, j < 0 ? undefined : j)
}
const DISC_SRC = between('export const DISCIPLINES', 'export type Anchor')
const ANCH_SRC = between('export const ANCHORS', 'export const ANCHOR_BY_KEY')

type Item = { name: string; icon: string; where: string }
const items: Item[] = []
for (const m of DISC_SRC.matchAll(/key: '([\w-]+)', title: '([^']+)', icon: '([^']+)'/g))
  items.push({ name: m[2]!, icon: m[3]!, where: `学科·${m[1]}` })
//  终点要跟着它所属的学科 key 走 —— 「学科 X」和「X 的终点」共用一个图标是**有意的呼应**,
//  不该被规则②判红。所以按 key 分块解析,而不是全文一把抓。
for (const chunk of DISC_SRC.split(/\n  \{\n/).slice(1)) {
  const k = chunk.match(/key: '([\w-]+)'/)?.[1]
  const g = chunk.match(/guide: \{ from: '[^']+', to: '([^']+)', toIcon: '([^']+)' \}/)
  if (k && g) items.push({ name: g[1]!, icon: g[2]!, where: `学科终点·${k}` })
}
for (const m of ANCH_SRC.matchAll(/key: '([\w-]+)', label: '([^']+)', icon: '([^']+)'/g))
  items.push({ name: m[2]!, icon: m[3]!, where: `锚点·${m[1]}` })

console.log('\n— 图标一致性 —')

//  先确认真的解析到了东西 —— 正则一改就可能一条都匹配不到,那时上面两条判据会「空跑也算过」
items.length >= 15
  ? ok(`从 registry.ts 里读到 ${items.length} 条「名字+图标」(学科 / 学科终点 / 锚点)`)
  : bad(`只读到 ${items.length} 条 —— 正则跟 registry.ts 的写法对不上了,下面两条判据等于空跑`)

/* ① 同名必同图标 */
{
  const byName = new Map<string, Item[]>()
  for (const it of items) byName.set(it.name, [...(byName.get(it.name) ?? []), it])
  const clash = [...byName.entries()].filter(([, v]) => new Set(v.map(x => x.icon)).size > 1)
  clash.length === 0
    ? ok(`同名必同图标(${byName.size} 个名字)`)
    : bad('同名却用了不同图标:' + clash.map(([n, v]) => `「${n}」= ${v.map(x => `${x.icon}(${x.where})`).join(' vs ')}`).join('; '))
}

/* ② 同图标必同名 —— 两类例外要**明说**出来,而不是把规则放松到什么都抓不到:
      · 同一个 key 的三种身份(学科 / 它的终点 / 同名锚点)本来就是一件事的三个面;
      · SAME_THING 里手写的同义对。现在只有一条:学科「具身智能」和造物「机器人」。 */
const SAME_THING: [string, string][] = [['embodied', 'robot']]
const keyOf = (w: string) => w.split('·')[1] ?? w
const sameThing = (a: Item, z: Item) => {
  const [ka, kz] = [keyOf(a.where), keyOf(z.where)]
  return ka === kz || SAME_THING.some(([x, y]) => (ka === x && kz === y) || (ka === y && kz === x))
}
{
  const byIcon = new Map<string, Item[]>()
  for (const it of items) byIcon.set(it.icon, [...(byIcon.get(it.icon) ?? []), it])
  const clash = [...byIcon.entries()].filter(([, v]) =>
    v.some(a => v.some(z => a.name !== z.name && !sameThing(a, z))))
  clash.length === 0
    ? ok(`同图标必同名(${byIcon.size} 个图标)`)
    : bad('同一个图标指了好几件事:' + clash.map(([i, v]) => `${i} = ${[...new Set(v.map(x => `${x.name}(${x.where})`))].join(' vs ')}`).join('; '))
}

/* ③ 自检:同一套规则喂一组人为冲突的数据,必须判红 */
{
  const fake: Item[] = [{ name: 'X', icon: 'A', where: 'a' }, { name: 'X', icon: 'B', where: 'b' }]
  const byName = new Map<string, Item[]>()
  for (const it of fake) byName.set(it.name, [...(byName.get(it.name) ?? []), it])
  const wouldFail = [...byName.values()].some(v => new Set(v.map(x => x.icon)).size > 1)
  wouldFail ? ok('自检:同名不同图标的数据确实会被判红 —— 上面那条判据有鉴别力')
    : bad('自检失败:规则连人为冲突都抓不到')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
