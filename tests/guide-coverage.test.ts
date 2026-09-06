/**
 * 「看懂这一屏」覆盖率 —— 每个实验都该有一张引导图,尤其别整条职业线漏掉。
 *
 * 起因(用户 2026-09-06 报的漏洞):**具身智能那 51 个实验,一张引导图都没有**。
 * 不是漏了几个 —— 是那条职业线是后加的,引导图从来没跟上。这种「整块缺失」
 * 不报错、不影响功能,只有一个个点进去才发现,所以必须有判据盯着。
 *
 * 判据的形状是「**欠账不许变多**」而不是「必须全有」:51 张手绘图是内容工程,
 * 不可能一次补完。所以这里钉一条**基线**:
 *   · 已经有图的实验,不许再变没有(退步立刻判红);
 *   · 每条职业线的欠账数不许超过基线(补了要记得把基线调小,新增实验没图会顶破)。
 *
 * 为什么解析源文件而不是 import:registry.ts / GuideDiagram.tsx 都会一路拖进
 * React 舞台组件(要 `import.meta.env`),node 里 import 不起来。
 *
 * 跑法:npx tsx tests/guide-coverage.test.ts(也在 npm test 里)
 */
import { readFileSync } from 'node:fs'

let failures = 0
const ok = (m: string) => console.log('  ✅ ' + m)
const bad = (m: string) => { failures++; console.log('  ❌ ' + m) }
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

/** 每条职业线**还欠多少张**引导图的上限。补完一批就把数字调小 —— 它是欠账台账,不是及格线。 */
const DEBT_CAP: Record<string, number> = {
  '408 基础': 0,     // 铺满了
  '算法': 0,         // 2026-09-06 补齐
  '大模型': 0,       // 2026-09-06 补齐(Agent 工程线 11 张)
  '具身智能': 0,     // 2026-09-06 补齐(51 张)
}
//  ⚠️ 用户只发现了具身智能那 51 个;**这条判据一跑,算法和大模型各自也有欠账**——
//  都是后加的那批实验(Agent 工程线、算法补充题)图没跟上。整块缺失就是这样悄悄攒起来的。

// —— 从 registry.ts 读「实验 id → 分组」和「学科 → 分组」——
const reg = read('../web/src/registry.ts')
const expGroup = new Map<string, string>()
for (const m of reg.matchAll(/\bid: '([a-zA-Z0-9_-]+)',[\s\S]{0,400}?\bgroup: '([^']+)'/g))
  if (!expGroup.has(m[1]!)) expGroup.set(m[1]!, m[2]!)

/* ⚠️ **静态解析看不见工厂函数生成的实验**。
   软件库层那 40 多个实验是 `mkLib('id', …)` 造出来的,源码里根本没有 `id: 'x'` 字面量 ——
   第一版判据因此把它们整个漏掉,还报了「51/51 全覆盖」的假绿灯,是浏览器抽查抓出来的。
   它们**本来也不需要**「看懂这一屏」:库层的舞台(LibraryStage)本身就是一屏铺开的参考页
   (特点/优缺点/覆盖/落地),再配一张图是重复。所以这里**显式把它们列出来并排除**,
   而不是假装看不见 —— 排除要说出口,漏掉才是错。 */
const libIds = new Set([...reg.matchAll(/mkLib\('([a-zA-Z0-9_-]+)'/g)].map(m => m[1]!))

const discOfGroup = new Map<string, string>()
{
  const i = reg.indexOf('export const DISCIPLINES'), j = reg.indexOf('export type Anchor', i)
  for (const chunk of reg.slice(i, j).split(/\n  \{\n/).slice(1)) {
    const title = chunk.match(/title: '([^']+)'/)?.[1]
    const groups = chunk.match(/groups: \[([^\]]+)\]/)?.[1]
    if (!title || !groups) continue
    for (const g of groups.matchAll(/'([^']+)'/g)) discOfGroup.set(g[1]!, title)
  }
}

// —— 从 GuideDiagram.tsx 读已登记的引导图 ——
const gd = read('../web/src/shell/GuideDiagram.tsx')
const registered = new Set<string>()
{
  const i = gd.indexOf('export const GUIDE_DIAGRAMS'); const s = gd.indexOf('{', i)
  let depth = 1, j = s + 1
  while (depth > 0 && j < gd.length) { if (gd[j] === '{') depth++; else if (gd[j] === '}') depth--; j++ }
  //  认的是登记项的真实形状 `id: XxxDiagram,`(不带括号的组件引用)。
  //  ⚠️ 第一版按「行首标识符 + 冒号」匹配,同一行写了三项就只数到第一项;第二版又只认
  //  `() => <X/>` 这种写法,结果把原有 121 项全漏了、每条线的欠账凭空暴涨。
  //  两次都是**判据自己在骗自己**,而且都装得像真的 —— 所以下面那条「解析结果不对劲」的
  //  空跑自检是必须的,正是它把这两次都当场拦下来了。
  for (const m of gd.slice(s + 1, j - 1).matchAll(/([a-zA-Z0-9_]+)\s*:\s*([A-Z][A-Za-z0-9_]*Diagram)\b/g)) registered.add(m[1]!)
}

console.log('\n— 「看懂这一屏」覆盖率 —')

//  空跑自检:解析一崩,下面每一条都会「0 缺失」地绿过去
registered.size >= 100 && expGroup.size >= 150 && discOfGroup.size >= 20
  ? ok(`解析到 ${expGroup.size} 个带内核的实验 / ${discOfGroup.size} 个分组 / ${registered.size} 张已登记引导图`)
  : bad(`解析结果不对劲(实验 ${expGroup.size} / 分组 ${discOfGroup.size} / 图 ${registered.size}) —— 源文件写法变了,下面的判据等于空跑`)
//  同样是空跑自检:mkLib 一改名,库层就又变成看不见的了 —— 那时上面的排除会静默失效
libIds.size >= 30
  ? ok(`另有 ${libIds.size} 个**库层**实验(mkLib 生成),按上面的理由不要求引导图`)
  : bad(`只认出 ${libIds.size} 个库层实验 —— mkLib 改名了?那库层会被当成「缺图」或被静默漏掉`)

const byDisc = new Map<string, { total: number; missing: string[] }>()
for (const [id, g] of expGroup) {
  if (libIds.has(id)) continue                            // 库层不要求(见上)
  const d = discOfGroup.get(g); if (!d) continue          // 孤儿分组(已下线的轨)不算
  const rec = byDisc.get(d) ?? { total: 0, missing: [] }
  rec.total++; if (!registered.has(id)) rec.missing.push(id)
  byDisc.set(d, rec)
}

for (const [disc, { total, missing }] of [...byDisc].sort()) {
  const cap = DEBT_CAP[disc]
  if (cap === undefined) { bad(`「${disc}」没在 DEBT_CAP 里登记 —— 新开职业线要同时把欠账上限写上`); continue }
  missing.length <= cap
    ? ok(`「${disc}」${total - missing.length}/${total} 有引导图,还欠 ${missing.length}(上限 ${cap})`)
    : bad(`「${disc}」欠账变多了:${missing.length} > 上限 ${cap} —— 新增实验忘了配引导图?缺:${missing.slice(0, 8).join(' ')}`)
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
