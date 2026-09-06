/**
 * 第五台设备 · 固态硬盘的**页面**冒烟。
 *
 * 分工照旧:
 *   · tests/ssd.test.ts(进 npm test)审**内核**:穷举配法、考点钉没钉死、该读错的读没读错。
 *   · 这一份审**页面**:那块盘是不是真的在用那个内核、拨杆和档位点不点得着、
 *     「时间达标但读错了」到底给不给过、课堂外壳的链接在不在。
 *
 * 跑法:先起 dev(npx vite --port 5186 --host 127.0.0.1),再 PORT=5186 node scripts/ssd-check.mjs
 */
import { chromium } from 'playwright'
import { LEVELS, sweep, runSSD, sameAsIdeal, wa } from '../game/build/ssd-core.ts'

const PORT = process.env.PORT || 5186
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const meets = (L, c) => c.ok && c.time <= L.par.time && (L.par.maxErase === undefined || c.maxErase <= L.par.maxErase)

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://127.0.0.1:${PORT}/ssd.html`, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)

console.log('\n固态硬盘页面冒烟 · 页面用的是不是那个内核\n')
if (await p.evaluate(() => typeof window.__ssdRun !== 'function')) {
  console.error('页面没暴露钩子 —— 是不是又开到了别的文档上?(200 不代表拿到的是那个东西)')
  await b.close(); process.exit(1)
}

/* ── ① 关卡数目与名字 ── */
const names = await p.evaluate(() => window.__ssdLevels())
ok(names.length === LEVELS.length && names.every((n, i) => n === LEVELS[i].name),
  `页面上的 ${names.length} 关和内核里的 ${LEVELS.length} 关同名同序`)

/* ── ② 两边跑同一批配法,时间 / 写放大 / 擦除次数逐个对 ── */
{
  const cases = []
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L).sort((a, z) => a.time - z.time)
    const picks = [all[0].cfg,
      { capacity: L.capOpts[0], victim: L.victimOpts[0], ftl: false, wcache: false, plp: false, wear: false },
      all[Math.floor(all.length / 2)].cfg, all[all.length - 1].cfg]
    for (const cfg of picks) {
      const r = runSSD(L.trace(cfg.capacity), cfg, L.nblk, L.ppb)
      cases.push({ lvl: i, cfg, time: r.time, wa: +wa(r).toFixed(3), maxErase: r.maxErase, lost: r.lost })
    }
  }
  const got = await p.evaluate(cs => cs.map(c => {
    window.__ssdPlay(c.lvl); window.__ssdSet(c.cfg); return window.__ssdRun()
  }), cases)
  const bad = cases.filter((c, k) => got[k]?.time !== c.time || got[k]?.wa !== c.wa || got[k]?.maxErase !== c.maxErase)
  ok(bad.length === 0,
    `页面跑出来的时间 / 写放大 / 最大擦除,和 node 里的内核逐个相等(${cases.length} 组配法)`
    + (bad.length ? ` ⚠️ 对不上 ${bad.length} 组,例:L${bad[0].lvl} 期望 ${bad[0].time}` : ''))
  ok(cases.length >= 24, `对比了 ${cases.length} 组配法 —— 太少的话上面那条等于空跑`)
  const lostCases = cases.filter((c, k) => c.lost > 0 && got[k]?.lost === c.lost && got[k]?.readOk === false)
  ok(lostCases.length > 0, `其中 ${lostCases.length} 组在页面上也如实报了「断电丢了数据、读到旧值」`)
}

/* ── ③ 每关的目标够得着,开局那台够不着 ── */
for (const [i, L] of LEVELS.entries()) {
  const best = sweep(L).filter(c => meets(L, c)).sort((a, z) => a.time - z.time)[0]
  const r = await p.evaluate(c => { window.__ssdPlay(c.lvl); window.__ssdSet(c.cfg); return window.__ssdRun() }, { lvl: i, cfg: best.cfg })
  const bare = await p.evaluate(c => { window.__ssdPlay(c.lvl); window.__ssdSet(c.cfg); return window.__ssdRun() },
    { lvl: i, cfg: { capacity: L.capOpts[0], victim: L.victimOpts[0], ftl: false, wcache: false, plp: false, wear: false } })
  ok(r.ok === true, `L${i}「${L.short}」正解 ${r.time} 拍${L.par.maxErase ? ` / 最大擦除 ${r.maxErase}` : ''} —— 页面判它达标`)
  ok(bare.ok !== true, `L${i}:开局那台(什么都不装,${bare.time} 拍)页面不给过`)
}

/* ── ④ 这台特有的对错轴:时间再快,读错了也不给过 ── */
{
  const L = LEVELS[4]
  const fast = await p.evaluate(() => { window.__ssdPlay(4); window.__ssdSet({ capacity: 16, victim: 'greedy', ftl: true, wcache: true }); return window.__ssdRun() })
  ok(fast.time <= L.par.time && fast.readOk === false && fast.ok === false,
    `L4:写缓存不带掉电保护,${fast.time} 拍比目标 ${L.par.time} 还快 —— 但丢了 ${fast.lost} 页、读到旧值,页面不给过`)
  const safe = await p.evaluate(() => { window.__ssdSet({ capacity: 16, victim: 'greedy', ftl: true, wcache: true, plp: true }); return window.__ssdRun() })
  ok(safe.readOk === true && safe.ok === true, `L4:补上掉电保护(${safe.time} 拍),读对了,才给过`)
}

/* ── ⑤ 预留空间报太满时,页面要拦住而不是崩 ── */
{
  const blown = await p.evaluate(() => { window.__ssdPlay(2); window.__ssdSet({ capacity: 64, victim: 'greedy', ftl: true }); return window.__ssdRun() })
  ok(blown.time !== undefined, 'L2 的最大档(容量 64)仍在可跑范围内 —— 关卡给的档位都必须是能跑通的')
}

/* ── ⑥ 拨杆和档位真的点得着 ──
   ⚠️ 真的用鼠标去点画布上的东西。画布上面有一条 36px 的课堂外壳条,所以页面坐标 = 画布坐标 + top。 */
{
  await p.evaluate(() => window.__ssdPlay(6))
  const ui = await p.evaluate(() => window.__ssdUI())
  const click = async b => { await p.mouse.click(b.x + b.bw / 2, ui.top + b.y + b.bh / 2); await p.waitForTimeout(40) }
  const now = () => p.evaluate(() => window.__ssdNow())
  for (const b of ui.parts) await click(b)
  const all = await now()
  ok(all.ftl && all.wcache && all.plp && all.wear, `终关四个拨杆逐个点开,四个都亮了(${JSON.stringify(all)})`)
  //  装上 FTL 之后回收策略那一行才会出来 —— 点它一下要真能改
  const ui2 = await p.evaluate(() => window.__ssdUI())
  ok(ui2.victims.length === 2, `装上 FTL 映射之后,回收策略那两个选项冒出来了(${ui2.victims.length} 个)`)
  await click(ui2.victims[1])
  ok((await now()).victim === 'round', '点「按块号轮着来」,策略真的切过去了')
  const caps = ui2.caps
  ok(caps.length >= 2, `对外容量有 ${caps.length} 档可选`)
  await click(caps[caps.length - 1])
  ok((await now()).capacity === caps[caps.length - 1].v, `点最后一档容量,真的切到了 ${caps[caps.length - 1].v} 页`)
  //  把 FTL 关掉,回收策略那一行就该收起来(没有映射层就没有垃圾回收这回事)
  await click(ui.parts.find(x => x.p === 'ftl'))
  const ui3 = await p.evaluate(() => window.__ssdUI())
  ok(ui3.victims.length === 0, '把 FTL 关掉,回收策略那一行跟着收起来 —— 不留看着能调其实没意义的选项')
}

/* ── ⑦ 文案里不许有 markdown 强调(canvas 会原样画出星号)── */
{
  const texts = await p.evaluate(() => window.__ssdTexts())
  const bad = texts.filter(t => /\*\*[一-龥]/.test(t || ''))
  ok(texts.length >= 24, `读到 ${texts.length} 条关卡文案 —— 太少说明钩子没拿到东西`)
  ok(bad.length === 0, `文案里没有漏网的 markdown 强调${bad.length ? ':' + bad[0].slice(0, 40) : ''}`)
}

/* ── ⑧ 课堂外壳 ── */
{
  const bar = await p.evaluate(() => document.body.innerText)
  ok(bar.includes('虾米课堂'), '外壳条上有「虾米课堂」返回主页')
  ok(bar.includes('回房子'), '有回房子(路由器)的路')
  ok(bar.includes('Cache'), '有回 Cache 那台的路')
  ok(bar.includes('固态硬盘'), '外壳条标题写着这是固态硬盘那台')
}

/* ── ⑨ 达标记进课堂外壳的存档 ── */
{
  const L = LEVELS[1], best = sweep(L).filter(c => meets(L, c)).sort((a, z) => a.time - z.time)[0]
  await p.evaluate(c => { window.__ssdPlay(1); window.__ssdSet(c); window.__ssdRun() }, best.cfg)
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('xmhub.ssd') || 'null'))
  ok(saved?.data?.['1']?.time === best.time, `通关成绩落进课堂外壳的存档(L1 记下 ${saved?.data?.['1']?.time} 拍)`)
}

ok(errs.length === 0, `全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
