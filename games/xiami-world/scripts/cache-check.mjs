/**
 * 第三台设备 · Cache 的**页面**冒烟。
 *
 * 分工要说清楚,不然两套判据会互相以为对方管了:
 *   · tests/cache.test.ts(进 npm test)审的是**内核**:穷举所有配法,考点钉没钉死、cache 透不透明。
 *   · 这一份审的是**页面**:那台机器有没有真的在用那个内核、点位条真能挪刀、容量超了拦不拦、
 *     文案有没有漏网的 markdown 星号、课堂外壳的链接在不在。
 *
 * 「页面用的是不是同一个内核」怎么证:node 这边直接 import cache-core 跑一遍,
 * 浏览器那边打 __cacheRun 跑同一批配法,**两边的拍数逐个对**。对不上就说明页面在用另一份
 * (打包漏了、缓存旧了、有人在页面里又抄了一份仿真)—— 这正是前两台机器只能靠约定的那件事。
 *
 * 跑法:先起 dev(npx vite --port 5184 --host 127.0.0.1),再 PORT=5184 node scripts/cache-check.mjs
 */
import { chromium } from 'playwright'
import { LEVELS, runCache, sweep } from '../game/build/cache-core.ts'

const PORT = process.env.PORT || 5184
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://127.0.0.1:${PORT}/cache.html`, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)

console.log('\nCache 页面冒烟 · 页面用的是不是那个内核\n')

if (await p.evaluate(() => typeof window.__cacheRun !== 'function')) {
  console.error('页面没暴露钩子 —— 是不是又开到了别的文档上?(200 不代表拿到的是那个东西)')
  await b.close(); process.exit(1)
}

/* ── ① 关卡数目与名字,页面和内核一致 ── */
const names = await p.evaluate(() => window.__cacheLevels())
ok(names.length === LEVELS.length && names.every((n, i) => n === LEVELS[i].name),
  `页面上的 ${names.length} 关和内核里的 ${LEVELS.length} 关同名同序`)

/* ── ② 两边跑同一批配法,拍数逐个对 ── */
{
  //  每关取:最优配法、开局那台、外加几种随便挑的 —— 覆盖命中/缺失/写回/预取各条路径
  const cases = []
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L).sort((a, z) => a.cycles - z.cycles)
    const picks = [all[0].cfg, { ob: 0, ib: 0, ways: L.wayOpts[0], lru: false, wb: false, pf: false },
      all[Math.floor(all.length / 3)].cfg, all[all.length - 1].cfg]
    for (const cfg of picks) cases.push({ lvl: i, cfg, want: runCache(L.trace, cfg).cycles })
  }
  const got = await p.evaluate(cs => cs.map(c => {
    window.__cachePlay(c.lvl); window.__cacheSet(c.cfg); return window.__cacheRun()
  }), cases)
  const bad = cases.filter((c, k) => got[k]?.cycles !== c.want)
  ok(bad.length === 0,
    `页面跑出来的拍数和 node 里的内核逐个相等(${cases.length} 组配法)`
    + (bad.length ? ` ⚠️ 对不上 ${bad.length} 组,例:L${bad[0].lvl} 期望 ${bad[0].want}` : ''))
  //  空跑自检:配法一少,上面那条就是在比空数组
  ok(cases.length >= 24, `对比了 ${cases.length} 组配法 —— 太少的话上面那条等于空跑`)
  //  页面也得同意「cache 是透明的」
  ok(got.every(g => g.over || g.transparent === true), '页面每一次运行都报「结果与不要 cache 直接跑一致」')
}

/* ── ③ 每一关的目标都够得着,而且开局那台够不着 ── */
for (const [i, L] of LEVELS.entries()) {
  const best = sweep(L).sort((a, z) => a.cycles - z.cycles)[0]
  const r = await p.evaluate(c => { window.__cachePlay(c.lvl); window.__cacheSet(c.cfg); return window.__cacheRun() }, { lvl: i, cfg: best.cfg })
  const bare = await p.evaluate(lvl => { window.__cachePlay(lvl); return window.__cacheRun() }, i)
  ok(r.ok === true, `L${i}「${L.name}」最优配法 ${r.cycles} 拍 ≤ 目标 ${L.par.cycles} —— 页面判它达标`)
  ok(bare.ok !== true, `L${i}:开局那台(一刀没下 = 1 个字的 cache,${bare.cycles} 拍)页面不给过`)
}

/* ── ④ 两把刀:读数牌上的 ± 是正经控制,位条点击是快捷方式 ──
   ⚠️ 这一段**真的用鼠标去点画布上的按钮**,不是绕过 UI 调状态 —— 按钮画在那儿却点不着
   是这类 canvas 界面最容易出的错(前一台就出过两个热区叠 0.3px 的事故)。
   画布上面还有一条 36px 的课堂外壳条,所以页面坐标 = 画布坐标 + top。 */
{
  const g = await p.evaluate(() => window.__cacheGeo())
  await p.evaluate(() => window.__cachePlay(0))
  const ui = await p.evaluate(() => window.__cacheUI())
  const clickBtn = async b => { await p.mouse.click(b.x + b.bw / 2, ui.top + b.y + b.bh / 2); await p.waitForTimeout(40) }
  const now_ = () => p.evaluate(() => window.__cacheNow())

  // 块大小 +3 次 → offset 3 位 = 8 个字
  const obPlus = ui.steps.find(s => s.w === 'ob' && s.d > 0), ibPlus = ui.steps.find(s => s.w === 'ib' && s.d > 0)
  const obMinus = ui.steps.find(s => s.w === 'ob' && s.d < 0)
  for (let i = 0; i < 3; i++) await clickBtn(obPlus)
  let now = await now_()
  ok(now.ob === 3, `点三下「块大小 +」,offset 变成 ${now.ob} 位(该是 3)—— 按钮画在那儿就要点得着`)
  for (let i = 0; i < 3; i++) await clickBtn(ibPlus)
  now = await now_()
  ok(now.ob === 3 && now.ib === 3, `再点三下「组数 +」:offset ${now.ob} 位 / index ${now.ib} 位(该是 3 / 3)`)
  // 减到底就该停住,不许变负
  for (let i = 0; i < 6; i++) await clickBtn(obMinus)
  now = await now_()
  ok(now.ob === 0 && now.ib === 3, `「块大小 −」按到底就停在 0 位(现在 ${now.ob} / ${now.ib})—— 不会变负、也不会顺手改了另一把刀`)

  // 位条点击:两刀分开时,挪的是近的那把
  await p.evaluate(() => { window.__cachePlay(0); window.__cacheSet({ ob: 3, ib: 3, ways: 1 }) })
  const far = await p.evaluate(x => window.__cacheCut(x), g.barX + g.barW - 8 * g.cw)
  ok(far.ob === 3 && far.ib === 5, `位条上点右起第 8 道缝(离左刀近):挪的是左刀 → offset ${far.ob} / index ${far.ib}(该是 3 / 5)`)
  const near = await p.evaluate(x => window.__cacheCut(x), g.barX + g.barW - 1 * g.cw)
  ok(near.ob === 1 && near.ib >= 0, `再点右起第 1 道缝(离右刀近):挪的是右刀 → offset ${near.ob}(该是 1)`)
  const edge = await p.evaluate(x => window.__cacheCut(x), g.barX + g.barW + 50)
  ok(edge.ob >= 0 && edge.ib >= 0, `一路推到最右边也不会让两把刀交叉(offset ${edge.ob} / index ${edge.ib})`)
}

/* ── ⑤ 容量超了要拦下来 ── */
{
  const L0 = LEVELS[0]
  const over = await p.evaluate(() => { window.__cachePlay(0); window.__cacheSet({ ob: 10, ib: 0, ways: 1 }); return window.__cacheRun() })
  ok(over.over === true && over.cycles === undefined,
    `容量 ${over.cap} 字 > 芯片给的 ${L0.cap} 字 —— 页面拒绝运行(面积是给死的,这条不能糊弄过去)`)
}

/* ── ⑥ 文案里不许有 markdown 强调 ──
   canvas 是 fillText 画的,不认 markdown,`**加粗**` 会被原样画成星号。这个坑在前两台踩过三次。
   ⚠️ 判据只查中文前面的 `**`,因为前缀写法里 `1**` / `10*` 是真的内容。 */
{
  const texts = await p.evaluate(() => window.__cacheTexts())
  const bad = texts.filter(t => /\*\*[一-龥]/.test(t || ''))
  ok(texts.length >= 20, `读到 ${texts.length} 条关卡文案 —— 太少说明钩子没拿到东西,下一条等于空跑`)
  ok(bad.length === 0, `文案里没有漏网的 markdown 强调${bad.length ? ':' + bad[0].slice(0, 40) : ''}`)
  //  能判红的自检
  ok(/\*\*[一-龥]/.test('这是**加粗**'), '自检:那条正则确实认得出 markdown 强调')
}

/* ── ⑦ 课堂外壳:标题、返回主页、以及回前两台机器的路 ── */
{
  const bar = await p.evaluate(() => document.body.innerText)
  ok(bar.includes('虾米课堂'), '外壳条上有「虾米课堂」返回主页')
  ok(bar.includes('回房子'), '有回房子(路由器)的路')
  ok(bar.includes('CPU'), '有回 CPU 流水线的路')
  ok(bar.includes('Cache'), '外壳条标题写着这是 Cache 那台')
}

/* ── ⑧ 达标会记进进度 ── */
{
  const L = LEVELS[2], best = sweep(L).sort((a, z) => a.cycles - z.cycles)[0]
  await p.evaluate(c => { window.__cachePlay(2); window.__cacheSet(c); window.__cacheRun() }, best.cfg)
  //  存盘键归课堂外壳管(xmhub.<key>),不是这台机器自己定的 —— 找错键会看到一个永远为空的对象
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('xmhub.cache') || 'null'))
  ok(saved?.data?.['2']?.cycles === best.cycles, `通关成绩落进课堂外壳的存档(L2 记下 ${saved?.data?.['2']?.cycles} 拍)`)
}

ok(errs.length === 0, `全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
