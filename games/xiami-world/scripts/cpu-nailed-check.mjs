/**
 * CPU 关卡「有没有被钉死」的对抗性判据。
 *
 * 冒烟判据(cpu-check.mjs)问的是「正解能过、我挑的那几种错法过不了」。
 * 这一套问的是更狠的一句:**有没有哪台错的机器,碰巧也能过?**
 *
 * 做法是穷举:
 *   ① 上排 5^5 = 3125 种装法(只算这一关**真的给了**的零件),看每一种能不能过。
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
  7: { 1: 'hazard', 2: 'flush' },      // 终关:两样都要
}
/** 「达到目标拍数」非有不可的零件。**结构冒险那一关只会变慢、不会算错**,
 *  所以它的考点在这儿而不在 REQUIRED —— 优化关也得钉死,不然等于没考点。 */
const FAST_REQUIRED = {
  5: { 0: 'icache' },                  // 结构冒险:不装指令缓存就够不着目标拍数
  7: { 0: 'icache' },                  // 终关同理
}
/** 五级顺序里「也算对」的摆法上限。多出来就说明仿真对顺序的约束又松了。
 *
 * ⚠️ 2026-09-06 调过一次 L3(5→6)、L5(4→5),而且**不是为了让判据变绿**:
 * 新放行的那一种是 `if>id>mem>ex>wb`(访存排在执行前面)。查过之后确认它在**这套指令集里
 * 确实合法** —— 本作的 `lw r1,[2]` 地址是**立即数**,不需要 ALU 先算,所以访存放在执行前
 * 自洽。真 MIPS 的 `lw r1, off(r2)` 要 ALU 算有效地址,才**强制** MEM 在 EX 之后。
 * 这是本作 ISA 的一处简化,写在这儿而不是藏起来;哪天把 lw 改成基址+偏移,这两个数会自己掉回去。 */
const ORDER_CAP = { 0: 5, 1: 8, 2: 10, 3: 6, 4: 2, 5: 5, 7: 1 }
/** 切级关(第 6 关)不摆零件、只下刀,两套穷举都不适用 —— **跳过要写出口**,别静默略过。 */
const SPLIT_LEVELS = new Set([6])

const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`http://localhost:${PORT}/cpu.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
if (await p.evaluate(() => typeof window.__cpuRun !== 'function')) { console.error('页面没暴露钩子'); await b.close(); process.exit(1) }

const FIVE = ['if', 'id', 'ex', 'mem', 'wb']
const TOPS = [null, 'wire', 'hazard', 'flush', 'icache']
const NLV = (await p.evaluate(() => window.__cpuLevels())).length

console.log('\nCPU 关卡对抗性审查 · 穷举所有装法与摆法\n')

/* ── ① 上排装法穷举 ── */
const sweep = await p.evaluate(({ FIVE, TOPS, NLV }) => {
  const out = []
  for (let lvl = 0; lvl < NLV; lvl++) {
    const L = window.__cpuPlay(lvl)
    if (!L.parts.length) { out.push({ lvl, passing: null, par: L.par }); continue }   // 切级关:没有零件可摆
    const allowed = new Set(L.parts)   // 只穷举这一关真的给了的零件
    const passing = []
    for (let m = 0; m < 5 ** 5; m++) {   // 5 种零件(含「不装」)× 5 个槽
      const tp = [0, 1, 2, 3, 4].map(i => TOPS[Math.floor(m / 5 ** i) % 5])
      if (tp.some(t => t && !allowed.has(t))) continue
      window.__cpuSet(FIVE, tp)
      const r = window.__cpuRun()
      if (r && r.ok) passing.push({ tp, parts: r.parts, cyc: r.cycles })
    }
    out.push({ lvl, passing, par: L.par })
  }
  return out
}, { FIVE, TOPS, NLV })

for (const r of sweep) {
  if (r.passing === null) { ok(SPLIT_LEVELS.has(r.lvl), `L${r.lvl}:切级关,不摆零件 —— 两套穷举都不适用,已在 SPLIT_LEVELS 里写明跳过`); continue }
  ok(r.passing.length > 0, `L${r.lvl}:至少有一台机器能过(${r.passing.length} 种装法)`)
  const fastNeed = FAST_REQUIRED[r.lvl]
  if (fastNeed) {
    const fast = r.passing.filter(x => x.cyc <= r.par.cycles)
    ok(fast.length > 0, `L${r.lvl}:目标拍数 ≤${r.par.cycles} 够得着(${fast.length} 种装法达标)`)
    const cheat = fast.filter(x => Object.entries(fastNeed).some(([i, k]) => x.tp[+i] !== k))
    ok(cheat.length === 0,
      `L${r.lvl}:达标的装法里没有一种能绕开〈${Object.values(fastNeed).join('/')}〉(例外 ${cheat.length} 种)`
      + (cheat.length ? ` ⚠️ 例:${cheat.slice(0, 2).map(v => v.tp.map(t => t || '-').join(',')).join(' | ')}` : ''))
  }
  const need = REQUIRED[r.lvl]
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
const SOLUTION = { 0: [null, null, null, null, null], 1: [null, null, null, 'wire', null], 2: [null, null, null, 'wire', 'wire'], 3: [null, 'hazard', null, 'wire', 'wire'], 4: [null, 'hazard', 'flush', 'wire', 'wire'], 5: ['icache', 'hazard', null, 'wire', 'wire'], 7: ['icache', 'hazard', 'flush', 'wire', 'wire'] }
const orders = await p.evaluate(({ orders, SOLUTION, NLV }) => {
  const out = []
  for (let lvl = 0; lvl < NLV; lvl++) {
    if (!SOLUTION[lvl]) { out.push({ lvl, list: null }); continue }
    window.__cpuPlay(lvl)
    const okOrders = []
    for (const o of orders) { window.__cpuSet(o, SOLUTION[lvl]); const r = window.__cpuRun(); if (r && r.ok) okOrders.push(o.join('>')) }
    out.push({ lvl, list: okOrders })
  }
  return out
}, { orders: perm(FIVE), SOLUTION, NLV })

for (const r of orders) {
  if (r.list === null) continue   // 切级关(上面已经明说跳过)
  ok(r.list.includes('if>id>ex>mem>wb'), `L${r.lvl}:真 CPU 的那个顺序(if>id>ex>mem>wb)当然要能过`)
  ok(r.list.length <= ORDER_CAP[r.lvl],
    `L${r.lvl}:另有 ${r.list.length - 1} 种顺序也算对(上限 ${ORDER_CAP[r.lvl] - 1};多出来说明仿真对顺序的约束松了)`)
}
//  能判红的自检:上限如果放到「全过」,这套判据就什么也证明不了 —— 这里确认它确实没全过
const allPass = orders.filter(r => r.list && r.list.length === 120)
ok(allPass.length === 0, `自检:没有哪一关是「怎么摆都对」(否则「顺序是仿真自己认的」这句话就是空的)`)

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
