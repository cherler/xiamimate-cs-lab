/**
 * CPU 关卡「有没有被钉死」的对抗性判据。
 *
 * 冒烟判据(cpu-check.mjs)问的是「正解能过、我挑的那几种错法过不了」。
 * 这一套问的是更狠的一句:**有没有哪台错的机器,碰巧也能过?**
 *
 * 做法是穷举:
 *   ① 上排 4^5 = 1024 种装法(只算这一关**真的给了**的零件),看每一种能不能过。
 *      对每一关声明「非有不可的零件」,凡是缺了它还能过的,一律判红。
 *   ② 五级顺序 5! = 120 种摆法,看还有哪些顺序也算对 —— 数目只许比声明的少或相等。
 *
 * 这套判据抓到过两个真问题,都不是「跑不通」而是「跑通了但理由是错的」:
 *   · 控制冒险那一关,**一个零件都不装也能过** —— 错误机器把分支操作数读成旧值、
 *     误判相等提前跳走,碰巧跳过了同一条指令,终值一模一样。答案对了,理由是错的。
 *     修法是把「非执行不可」的那条挪到作废阴影之外,让任何走错路都在终值上留痕。
 *   · 〈取指〉级原来什么都不做,于是把它摆到译码后面机器照样算对 —— 而关卡文案写着
 *     「顺序是仿真自己认的」。修法是:没走过取指级的指令,后面几级不许对它做事。
 *
 * 跑法:先起 dev(npx vite --port 5183 --host 127.0.0.1),再 PORT=5183 node scripts/cpu-nailed-check.mjs
 */
import { chromium } from 'playwright'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

/** 每一关「非有不可」的零件:槽位 → 零件。缺了它还能过 = 这一关没被钉死。 */
const REQUIRED = {
  1: { 3: 'wire' },                    // 隔一条的前递通路
  2: { 3: 'wire', 4: 'wire' },         // 真前递单元本来就有两条
  3: { 1: 'hazard' },                  // load-use 躲不掉的停顿
  4: { 2: 'flush' },                   // 分支作废
  5: { 1: 'hazard', 2: 'flush' },      // 终关:两样都要
}
/** 五级顺序里「也算对」的摆法上限。多出来就说明仿真对顺序的约束又松了。 */
const ORDER_CAP = { 0: 5, 1: 8, 2: 10, 3: 5, 4: 2, 5: 1 }

const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`http://localhost:${PORT}/cpu.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
if (await p.evaluate(() => typeof window.__cpuRun !== 'function')) { console.error('页面没暴露钩子'); await b.close(); process.exit(1) }

const FIVE = ['if', 'id', 'ex', 'mem', 'wb']
const TOPS = [null, 'wire', 'hazard', 'flush']
const NLV = (await p.evaluate(() => window.__cpuLevels())).length

console.log('\nCPU 关卡对抗性审查 · 穷举所有装法与摆法\n')

/* ── ① 上排装法穷举 ── */
const sweep = await p.evaluate(({ FIVE, TOPS, NLV }) => {
  const out = []
  for (let lvl = 0; lvl < NLV; lvl++) {
    const L = window.__cpuPlay(lvl)
    const allowed = new Set(L.parts)   // 只穷举这一关真的给了的零件
    const passing = []
    for (let m = 0; m < 1024; m++) {
      const tp = [0, 1, 2, 3, 4].map(i => TOPS[(m >> (i * 2)) & 3])
      if (tp.some(t => t && !allowed.has(t))) continue
      window.__cpuSet(FIVE, tp)
      const r = window.__cpuRun()
      if (r && r.ok) passing.push({ tp, parts: r.parts, cyc: r.cycles })
    }
    out.push({ lvl, passing })
  }
  return out
}, { FIVE, TOPS, NLV })

for (const r of sweep) {
  const need = REQUIRED[r.lvl]
  ok(r.passing.length > 0, `L${r.lvl}:至少有一台机器能过(${r.passing.length} 种装法)`)
  if (!need) continue
  const violate = r.passing.filter(x => Object.entries(need).some(([i, k]) => x.tp[+i] !== k))
  ok(violate.length === 0,
    `L${r.lvl}:缺了「非有不可」的零件就一定过不了(${r.passing.length} 种能过的装法里,例外 ${violate.length} 种)`
    + (violate.length ? ` ⚠️ 例:${violate.slice(0, 2).map(v => v.tp.map(t => t || '-').join(',')).join(' | ')}` : ''))
  const bare = r.passing.find(x => x.tp.every(t => !t))
  ok(!bare, `L${r.lvl}:一个零件都不装的空机器过不了(空机器能过 = 答案对了但理由是错的)`)
}

/* ── ② 五级顺序穷举 ── */
const perm = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]))
const SOLUTION = { 0: [null, null, null, null, null], 1: [null, null, null, 'wire', null], 2: [null, null, null, 'wire', 'wire'], 3: [null, 'hazard', null, 'wire', 'wire'], 4: [null, 'hazard', 'flush', 'wire', 'wire'], 5: [null, 'hazard', 'flush', 'wire', 'wire'] }
const orders = await p.evaluate(({ orders, SOLUTION, NLV }) => {
  const out = []
  for (let lvl = 0; lvl < NLV; lvl++) {
    window.__cpuPlay(lvl)
    const okOrders = []
    for (const o of orders) { window.__cpuSet(o, SOLUTION[lvl]); const r = window.__cpuRun(); if (r && r.ok) okOrders.push(o.join('>')) }
    out.push({ lvl, list: okOrders })
  }
  return out
}, { orders: perm(FIVE), SOLUTION, NLV })

for (const r of orders) {
  ok(r.list.includes('if>id>ex>mem>wb'), `L${r.lvl}:真 CPU 的那个顺序(if>id>ex>mem>wb)当然要能过`)
  ok(r.list.length <= ORDER_CAP[r.lvl],
    `L${r.lvl}:另有 ${r.list.length - 1} 种顺序也算对(上限 ${ORDER_CAP[r.lvl] - 1};多出来说明仿真对顺序的约束松了)`)
}
//  能判红的自检:上限如果放到「全过」,这套判据就什么也证明不了 —— 这里确认它确实没全过
const allPass = orders.filter(r => r.list.length === 120)
ok(allPass.length === 0, `自检:没有哪一关是「怎么摆都对」(否则「顺序是仿真自己认的」这句话就是空的)`)

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
