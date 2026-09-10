/**
 * 第六台设备 · 内存条(DRAM)的**页面**冒烟。
 *
 * 分工照旧:tests/dram.test.ts 审内核(穷举、钉考点、该读错的读错);这一份审页面 ——
 * 那台控制器是不是真的在用那个内核、旋钮和拨杆点不点得着、
 * 「时间达标但读错了」到底给不给过、地址位条画的和内核算的是不是同一回事。
 *
 * 跑法:先起 dev(npx vite --port 5187 --host 127.0.0.1),再 PORT=5187 node scripts/dram-check.mjs
 */
import { chromium } from 'playwright'
import { LEVELS, sweep, runDram, decode } from '../game/build/dram-core.ts'

const PORT = process.env.PORT || 5187
//  打 dev 独立跑。BASE 留着是为了将来:
//    (探索游戏 2026-09-10 已从虾米CS课堂去掉,不再挂 /cslab/world —— 现在只有独立模式)
const BASE = (process.env.BASE || `http://127.0.0.1:${PORT}`).replace(/\/$/, '')
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`${BASE}/dram.html`, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)

console.log('\n内存条页面冒烟 · 页面用的是不是那个内核\n')
if (await p.evaluate(() => typeof window.__dramRun !== 'function')) {
  console.error('页面没暴露钩子 —— 是不是又开到了别的文档上?(200 不代表拿到的是那个东西)')
  await b.close(); process.exit(1)
}

/* ── ① 关卡数目与名字 ── */
const names = await p.evaluate(() => window.__dramLevels())
ok(names.length === LEVELS.length && names.every((n, i) => n === LEVELS[i].name),
  `页面上的 ${names.length} 关和内核里的 ${LEVELS.length} 关同名同序`)

/* ── ② 两边跑同一批配法,时间 / 行命中 / 掉头次数逐个对 ── */
{
  const cases = []
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L).sort((a, z) => a.time - z.time)
    const picks = [all[0].cfg,
      { banks: L.bankOpts[0], bankBits: L.bankBitOpts[0], window: L.winOpts[0], page: L.pageOpts[0], sched: false, wbuf: false, fwd: false },
      all[Math.floor(all.length / 2)].cfg, all[all.length - 1].cfg]
    for (const cfg of picks) {
      const r = runDram(L.reqs, cfg)
      cases.push({ lvl: i, cfg, time: r.time, hits: r.hits, turns: r.turns, hazards: r.hazards })
    }
  }
  const got = await p.evaluate(cs => cs.map(c => {
    window.__dramPlay(c.lvl); window.__dramSet(c.cfg); return window.__dramRun()
  }), cases)
  const bad = cases.filter((c, k) => got[k]?.time !== c.time || got[k]?.hits !== c.hits || got[k]?.turns !== c.turns)
  ok(bad.length === 0,
    `页面跑出来的时间 / 行命中 / 掉头次数,和 node 里的内核逐个相等(${cases.length} 组配法)`
    + (bad.length ? ` ⚠️ 对不上 ${bad.length} 组,例:L${bad[0].lvl} 期望 ${bad[0].time}` : ''))
  ok(cases.length >= 24, `对比了 ${cases.length} 组配法 —— 太少的话上面那条等于空跑`)
  const stale = cases.filter((c, k) => c.hazards > 0 && !c.cfg.fwd && got[k]?.readOk === false)
  ok(stale.length > 0, `其中 ${stale.length} 组在页面上也如实报了「撞上写缓冲、读到旧值」`)
}

/* ── ③ 每关的目标够得着,开局那台够不着 ── */
for (const [i, L] of LEVELS.entries()) {
  const best = sweep(L).filter(c => c.ok && c.time <= L.par.time).sort((a, z) => a.time - z.time)[0]
  const r = await p.evaluate(c => { window.__dramPlay(c.lvl); window.__dramSet(c.cfg); return window.__dramRun() }, { lvl: i, cfg: best.cfg })
  const bare = await p.evaluate(c => { window.__dramPlay(c.lvl); window.__dramSet(c.cfg); return window.__dramRun() },
    { lvl: i, cfg: { banks: L.bankOpts[0], bankBits: L.bankBitOpts[0], window: L.winOpts[0], page: L.pageOpts[0], sched: false, wbuf: false, fwd: false } })
  ok(r.ok === true, `L${i}「${L.short}」正解 ${r.time} 拍 —— 页面判它达标`)
  ok(bare.ok !== true, `L${i}:开局那台(${bare.time} 拍)页面不给过 —— 旋钮的默认值不能就是正解`)
}

/* ── ④ 对错轴:时间再快,读到旧值也不给过 ── */
{
  const L = LEVELS[5]
  const fast = await p.evaluate(() => { window.__dramPlay(5); window.__dramSet({ banks: 1, bankBits: 'low', window: 4, page: 'open', sched: true, wbuf: true }); return window.__dramRun() })
  ok(fast.time <= L.par.time && fast.readOk === false && fast.ok === false,
    `L5:装了写缓冲没装转发,${fast.time} 拍已经达标(目标 ${L.par.time})—— 但撞了 ${fast.hazards} 次、读到旧值,页面不给过`)
  const safe = await p.evaluate(() => { window.__dramSet({ banks: 1, bankBits: 'low', window: 4, page: 'open', sched: true, wbuf: true, fwd: true }); return window.__dramRun() })
  ok(safe.readOk === true && safe.ok === true && safe.time === fast.time,
    `L5:补上转发,时间一分没变(${safe.time} 拍)却读对了 —— 转发不要钱,不装纯粹是白错`)
}

/* ── ⑤ 地址位条画的,和内核算的是同一回事 ── */
{
  await p.evaluate(() => { window.__dramPlay(3); window.__dramSet({ banks: 4, bankBits: 'low', window: 1, page: 'open' }) })
  const lo = await p.evaluate(() => [0, 16, 32, 48].map(a => window.__dramDecode(a).bank))
  ok(JSON.stringify(lo) === JSON.stringify([0, 16, 32, 48].map(a => decode(a, { banks: 4, bankBits: 'low', window: 1, page: 'open', sched: false, wbuf: false, fwd: false }).bank)),
    `交织切法下页面算出的 bank 号和内核一致(${lo.join(',')})`)
  await p.evaluate(() => window.__dramSet({ banks: 4, bankBits: 'high', window: 1, page: 'open' }))
  const hi = await p.evaluate(() => [0, 16, 32, 48].map(a => window.__dramDecode(a).bank))
  ok(new Set(hi).size === 1, `取高位时那四行全落在同一个 bank(${hi.join(',')})`)
}

/* ── ⑥ 旋钮和拨杆真的点得着 ──
   ⚠️ 真的用鼠标去点画布上的东西。画布上面有一条 36px 的课堂外壳条,页面坐标 = 画布坐标 + top。 */
{
  await p.evaluate(() => window.__dramPlay(6))
  const ui = await p.evaluate(() => window.__dramUI())
  const click = async b => { await p.mouse.click(b.x + b.bw / 2, ui.top + b.y + b.bh / 2); await p.waitForTimeout(40) }
  const now = () => p.evaluate(() => window.__dramNow())
  for (const b of ui.parts) await click(b)
  const all = await now()
  ok(all.sched && all.wbuf && all.fwd, `终关三个拨杆逐个点开,三个都亮了(${JSON.stringify(all)})`)
  ok(all.window > 1, `点开〈调度器〉之后窗口自动从 1 跳到 ${all.window}(留 1 的话这零件装了等于没装)`)
  //  装上调度器之后「调度窗口」那一行才出来
  const ui2 = await p.evaluate(() => window.__dramUI())
  const wk = ui2.knobs.filter(k => k.key === 'win')
  ok(wk.length >= 3, `装上调度器之后,调度窗口那一行冒出来了(${wk.length} 档)`)
  await click(wk[wk.length - 1])
  ok((await now()).window === wk[wk.length - 1].v, `点最后一档窗口,真的切到了 ${wk[wk.length - 1].v}`)
  //  bank 数调到 1 之后,「bank 位切在」那一行就该收起来(一个 bank 切法没意义)
  const bk = ui2.knobs.filter(k => k.key === 'banks')
  await click(bk[0])
  const ui3 = await p.evaluate(() => window.__dramUI())
  ok((await now()).banks === bk[0].v && ui3.knobs.filter(k => k.key === 'bankBits').length === 0,
    'bank 数调回 1,「bank 位切在」那一行跟着收起来 —— 不留看着能调其实没意义的旋钮')
  //  再调回多 bank,那一行要回来
  await click(bk[bk.length - 1])
  const ui4 = await p.evaluate(() => window.__dramUI())
  ok(ui4.knobs.filter(k => k.key === 'bankBits').length === 2, 'bank 数调回去,「bank 位切在」那一行又回来了')
}

/* ── ⑦ 文案里不许有 markdown 强调(canvas 会原样画出星号)── */
{
  const texts = await p.evaluate(() => window.__dramTexts())
  const bad = texts.filter(t => /\*\*[一-龥]/.test(t || ''))
  ok(texts.length >= 24, `读到 ${texts.length} 条关卡文案 —— 太少说明钩子没拿到东西`)
  ok(bad.length === 0, `文案里没有漏网的 markdown 强调${bad.length ? ':' + bad[0].slice(0, 40) : ''}`)
}

/* ── ⑧ 课堂外壳 ── */
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
  ok(bar.includes('内存条'), '外壳条标题写着这是内存条那台')
}

/* ── ⑨ 达标记进课堂外壳的存档 ── */
{
  const L = LEVELS[1], best = sweep(L).filter(c => c.ok && c.time <= L.par.time).sort((a, z) => a.time - z.time)[0]
  await p.evaluate(c => { window.__dramPlay(1); window.__dramSet(c); window.__dramRun() }, best.cfg)
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('xmhub.dram') || 'null'))
  ok(saved?.data?.['1']?.time === best.time, `通关成绩落进课堂外壳的存档(L1 记下 ${saved?.data?.['1']?.time} 拍)`)
}

ok(errs.length === 0, `全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
