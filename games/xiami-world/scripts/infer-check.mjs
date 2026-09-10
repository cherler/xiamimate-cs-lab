/**
 * 第四台设备 · 大模型推理引擎的**页面**冒烟。
 *
 * 分工和 Cache 那台一样,说清楚免得两套判据互相以为对方管了:
 *   · tests/infer.test.ts(进 npm test)审**内核**:穷举所有配法、考点钉没钉死、输出恒不恒等。
 *   · 这一份审**页面**:那台机器是不是真的在用那个内核、拨杆和档位点不点得着、
 *     两个指标的达标判定对不对、课堂外壳的链接在不在。
 *
 * 「页面用的是不是同一个内核」怎么证:node 这边 import infer-core 跑一遍,浏览器那边打
 * __inferRun 跑同一批配法,两边的拍数逐个对。对不上就说明页面在用另一份。
 *
 * 跑法:先起 dev(npx vite --port 5185 --host 127.0.0.1),再 PORT=5185 node scripts/infer-check.mjs
 */
import { chromium } from 'playwright'
import { LEVELS, runEngine, sweep } from '../game/build/infer-core.ts'

const PORT = process.env.PORT || 5185
//  打 dev 独立跑。BASE 留着是为了将来:
//    (探索游戏 2026-09-10 已从虾米CS课堂去掉,不再挂 /cslab/world —— 现在只有独立模式)
const BASE = (process.env.BASE || `http://127.0.0.1:${PORT}`).replace(/\/$/, '')
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const meets = (L, r) => r.time <= L.par.time && (L.par.tpot === undefined || r.tpot <= L.par.tpot)

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`${BASE}/infer.html`, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)

console.log('\n推理引擎页面冒烟 · 页面用的是不是那个内核\n')
if (await p.evaluate(() => typeof window.__inferRun !== 'function')) {
  console.error('页面没暴露钩子 —— 是不是又开到了别的文档上?(200 不代表拿到的是那个东西)')
  await b.close(); process.exit(1)
}

/* ── ① 关卡数目与名字 ── */
const names = await p.evaluate(() => window.__inferLevels())
ok(names.length === LEVELS.length && names.every((n, i) => n === LEVELS[i].name),
  `页面上的 ${names.length} 关和内核里的 ${LEVELS.length} 关同名同序`)

/* ── ② 两边跑同一批配法,拍数和吐字间隔逐个对 ── */
{
  const cases = []
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L).sort((a, z) => a.time - z.time)
    const picks = [all[0].cfg,
      { batch: 1, page: L.pageOpts[0], spec: L.specOpts[0], kvcache: false, paged: false, cont: false, speculate: false },
      all[Math.floor(all.length / 3)].cfg, all[all.length - 1].cfg]
    for (const cfg of picks) {
      const r = runEngine(L.reqs, cfg, L.vram, L.maxLen)
      cases.push({ lvl: i, cfg, time: r.time, tpot: r.tpot, steps: r.steps })
    }
  }
  const got = await p.evaluate(cs => cs.map(c => {
    window.__inferPlay(c.lvl); window.__inferSet(c.cfg); return window.__inferRun()
  }), cases)
  const bad = cases.filter((c, k) => got[k]?.time !== c.time || got[k]?.tpot !== c.tpot || got[k]?.steps !== c.steps)
  ok(bad.length === 0,
    `页面跑出来的拍数 / 吐字间隔 / 步数,和 node 里的内核逐个相等(${cases.length} 组配法)`
    + (bad.length ? ` ⚠️ 对不上 ${bad.length} 组,例:L${bad[0].lvl} 期望 ${bad[0].time}` : ''))
  ok(cases.length >= 24, `对比了 ${cases.length} 组配法 —— 太少的话上面那条等于空跑`)
  ok(got.every(g => g.same === true), '页面每一次运行都报「吐出来的 token 逐字等于老老实实生成一遍」')
}

/* ── ③ 每关的目标够得着,开局那台够不着 ── */
for (const [i, L] of LEVELS.entries()) {
  const best = sweep(L).filter(c => meets(L, c)).sort((a, z) => a.time - z.time)[0]
  const r = await p.evaluate(c => { window.__inferPlay(c.lvl); window.__inferSet(c.cfg); return window.__inferRun() }, { lvl: i, cfg: best.cfg })
  const bare = await p.evaluate(c => { window.__inferPlay(c.lvl); window.__inferSet(c.cfg); return window.__inferRun() },
    { lvl: i, cfg: { batch: 1, page: L.pageOpts[0], spec: L.specOpts[0], kvcache: false, paged: false, cont: false, speculate: false } })
  ok(r.ok === true, `L${i}「${L.short}」正解 ${r.time} 拍${L.par.tpot ? ` / 吐字间隔 ${r.tpot}` : ''} —— 页面判它达标`)
  ok(bare.ok !== true, `L${i}:开局那台(什么都不装、批 1,${bare.time} 拍)页面不给过`)
}

/* ── ④ 两个指标的达标判定:时间够了但吐字间隔超上限,一样不给过 ──
   这是 L4 的全部考点,判定要是只看时间,那一关就白设计了。 */
{
  const L = LEVELS[4]
  const fast = await p.evaluate(() => { window.__inferPlay(4); window.__inferSet({ batch: 8, page: 8, spec: 0, kvcache: true, cont: true }); return window.__inferRun() })
  ok(fast.time <= L.par.time && fast.tpot > L.par.tpot && fast.ok === false,
    `L4:批 8 总时间 ${fast.time} 够快(目标 ${L.par.time}),但吐字间隔 ${fast.tpot} 超了上限 ${L.par.tpot} —— 页面不给过`)
  const mid = await p.evaluate(() => { window.__inferSet({ batch: 4, page: 8, spec: 0, kvcache: true, cont: true }); return window.__inferRun() })
  ok(mid.ok === true, `L4:批 4 两条线都过(${mid.time} 拍 / 吐字间隔 ${mid.tpot})`)
}

/* ── ⑤ 拨杆和档位真的点得着 ──
   ⚠️ 真的用鼠标去点画布上的东西,不绕过 UI 改状态。画布上面有一条 36px 的课堂外壳条,
   所以页面坐标 = 画布坐标 + top。 */
{
  await p.evaluate(() => window.__inferPlay(6))
  const ui = await p.evaluate(() => window.__inferUI())
  const click = async b => { await p.mouse.click(b.x + b.bw / 2, ui.top + b.y + b.bh / 2); await p.waitForTimeout(40) }
  const now = () => p.evaluate(() => window.__inferNow())
  for (const b of ui.parts) await click(b)
  const all = await now()
  ok(all.kvcache && all.paged && all.cont && all.speculate, `终关四个拨杆逐个点开,四个都亮了(${JSON.stringify(all)})`)
  //  刚点开投机时,草稿长度不能还留在 0 —— 那等于装了个不干活的零件
  ok(all.spec > 0, `点开〈投机解码〉之后草稿长度自动落到 ${all.spec}(留 0 的话这零件装了等于没装)`)
  //  装上分页之后,页大小那一行才会出现 —— 点它一下要真能改
  const ui2 = await p.evaluate(() => window.__inferUI())
  const pg = ui2.knobs.filter(k => k.key === 'page')
  ok(pg.length >= 4, `装上分页之后,页大小那一行冒出来了(${pg.length} 档)`)
  await click(pg[pg.length - 1])
  ok((await now()).page === pg[pg.length - 1].v, `点最后一档页大小,真的切到了 ${pg[pg.length - 1].v}`)
  //  再把分页关掉,页大小那一行就该收起来(旋钮不该在没意义的时候还杵在那儿)
  await click(ui.parts.find(b => b.p === 'paged'))
  const ui3 = await p.evaluate(() => window.__inferUI())
  ok(ui3.knobs.filter(k => k.key === 'page').length === 0, '把分页关掉,页大小那一行跟着收起来 —— 不留看着能调其实没意义的旋钮')
}

/* ── ⑥ 文案里不许有 markdown 强调(canvas 会原样画出星号)── */
{
  const texts = await p.evaluate(() => window.__inferTexts())
  const bad = texts.filter(t => /\*\*[一-龥]/.test(t || ''))
  ok(texts.length >= 24, `读到 ${texts.length} 条关卡文案 —— 太少说明钩子没拿到东西`)
  ok(bad.length === 0, `文案里没有漏网的 markdown 强调${bad.length ? ':' + bad[0].slice(0, 40) : ''}`)
}

/* ── ⑦ 课堂外壳 ── */
{
  const bar = await p.evaluate(() => document.body.innerText)
  /**
   * ⚠️ 这条原来钉的是模块名字面（'虾米课堂'），2026-09-10 改名成「虾米CS课堂」就红了。
   *    它真正要验的是**外壳条第一颗控件是一条返回主站的路**。**判据钉意思不钉字面。**
   *
   * ⚠️ 改成 `#xm-hub a.btn` 之后又错过一次，值得记下来：
   *    hub 只在**挂在平台上**时才把「回主站」渲染成 <a href>；dev 独立跑时它是
   *    一颗 <button>（点了弹「没有主站可回」）。于是 `a.btn` 抓到的是它**后面**
   *    那几颗跳转按钮，量到的 href 是 `http://127.0.0.1:5185/` —— 判据在量别的东西。
   *    **量错却不自知，比没量更糟。**
   *
   * 所以：认准**第一个子节点**（那才是回主站那颗），再按当下的模式判：
   *   挂在 /cslab/ 下 → 必须是 <a>，href 正好是 /cslab/
   *   dev 独立跑     → 必须是 <button>（没有主站可回，不能留一条死链）
   * 要连 href 一起验，就把这个脚本指向平台挂载点：
   *   BASE=http://localhost:3000/cslab/world node scripts/xxx-check.mjs
   *
   * ⚠️ **2026-09-10 起没有平台模式了**：用户把探索游戏从虾米CS课堂去掉（完成度太差），
   *    /cslab/world 不再挂载。所以现在只会走下面那条「dev 独立跑 → 必须是 <button>」，
   *    上面那条 href 分支是留着的：哪天放回去，判据不用重写。
   */
  const home = await p.evaluate(() => {
    const el = document.querySelector('#xm-hub')?.firstElementChild
    return el ? { tag: el.tagName, href: el.getAttribute('href') } : null
  })
  const onPlatform = new URL(p.url()).pathname.startsWith('/cslab/')
  const homeHref = onPlatform
    ? (home?.tag === 'A' && home.href === '/cslab/' ? '/cslab/' : `${home?.tag}:${home?.href}`)
    : (home?.tag === 'BUTTON' ? '/cslab/' : `${home?.tag}:${home?.href}`)
  ok(homeHref === '/cslab/', `外壳条第一颗控件是回主站的路（${onPlatform ? "挂在 /cslab/ 下,量到 href=" : "dev 独立跑,是一颗按钮:"}${homeHref}）`)
  ok(bar.includes('回房子'), '有回房子(路由器)的路')
  ok(bar.includes('Cache'), '有回 Cache 那台的路')
  ok(bar.includes('推理引擎'), '外壳条标题写着这是推理引擎那台')
}

/* ── ⑧ 达标记进课堂外壳的存档 ── */
{
  const L = LEVELS[1], best = sweep(L).filter(c => meets(L, c)).sort((a, z) => a.time - z.time)[0]
  await p.evaluate(c => { window.__inferPlay(1); window.__inferSet(c); window.__inferRun() }, best.cfg)
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('xmhub.infer') || 'null'))
  ok(saved?.data?.['1']?.time === best.time, `通关成绩落进课堂外壳的存档(L1 记下 ${saved?.data?.['1']?.time} 拍)`)
}

ok(errs.length === 0, `全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
