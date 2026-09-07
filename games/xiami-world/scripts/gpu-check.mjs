/**
 * 第七台设备 · GPU 的**页面**冒烟。
 *
 * 分工照旧:tests/gpu.test.ts 审内核(穷举、钉考点、该算错的算错);这一份审页面 ——
 * 那个 kernel 是不是真的在用那个内核、旋钮点不点得着、
 * 「时间达标但算错了」到底给不给过、屏幕上那三张图和内核算的是不是同一回事。
 *
 * 跑法:先起 dev(npx vite --port 5188 --host 127.0.0.1),再 PORT=5188 node scripts/gpu-check.mjs
 */
import { chromium } from 'playwright'
import { LEVELS, sweep, runGpu, demoGlobalAddrs, demoSharedBanks, transactionsFor, conflictFor, N, WARP, BANKS } from '../game/build/gpu-core.ts'

const PORT = process.env.PORT || 5188
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://127.0.0.1:${PORT}/gpu.html`, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)

console.log('\nGPU 页面冒烟 · 页面用的是不是那个内核\n')
if (await p.evaluate(() => typeof window.__gpuRun !== 'function')) {
  console.error('页面没暴露钩子 —— 是不是又开到了别的文档上?(200 不代表拿到的是那个东西)')
  await b.close(); process.exit(1)
}

const names = await p.evaluate(() => window.__gpuLevels())
ok(names.length === LEVELS.length && names.every((n, i) => n === LEVELS[i].name),
  `页面上的 ${names.length} 关和内核里的 ${LEVELS.length} 关同名同序`)

/* ── 两边跑同一批配法,拍数 / 事务 / 冲突 / 驻留逐个对 ── */
{
  const cases = []
  for (const [i, L] of LEVELS.entries()) {
    const all = sweep(L).sort((a, z) => a.time - z.time)
    const picks = [all[0].cfg,
      { tile: L.tileOpts[0], pad: L.padOpts[0], bLayout: L.layoutOpts[0], regs: L.regOpts[0], mapping: L.mapOpts[0], sync: false },
      all[Math.floor(all.length / 2)].cfg, all[all.length - 1].cfg]
    for (const cfg of picks) {
      const r = runGpu(cfg)
      cases.push({ lvl: i, cfg, time: r.time, trans: r.trans, worstConflict: r.worstConflict, resident: r.resident, divergent: r.divergent })
    }
  }
  const got = await p.evaluate(cs => cs.map(c => { window.__gpuPlay(c.lvl); window.__gpuSet(c.cfg); return window.__gpuRun() }), cases)
  const bad = cases.filter((c, k) => got[k]?.time !== c.time || got[k]?.trans !== c.trans
    || got[k]?.worstConflict !== c.worstConflict || got[k]?.resident !== c.resident || got[k]?.divergent !== c.divergent)
  ok(bad.length === 0, `页面跑出来的拍数 / 事务 / 冲突 / 驻留 / 发散,和 node 里的内核逐个相等(${cases.length} 组配法)`
    + (bad.length ? ` ⚠️ 对不上 ${bad.length} 组,例:L${bad[0].lvl} 期望 ${bad[0].time}` : ''))
  ok(cases.length >= 24, `对比了 ${cases.length} 组配法 —— 太少的话上面那条等于空跑`)
  const raced = cases.filter((c, k) => c.cfg.tile > 0 && !c.cfg.sync && got[k]?.calcOk === false)
  ok(raced.length > 0, `其中 ${raced.length} 组在页面上也如实报了「分了块没打栅栏 → 算错」`)
}

/* ── 每关的目标够得着,开局那台够不着 ── */
for (const [i, L] of LEVELS.entries()) {
  const best = sweep(L).filter(c => c.ok && c.time <= L.par.time).sort((a, z) => a.time - z.time)[0]
  const r = await p.evaluate(c => { window.__gpuPlay(c.lvl); window.__gpuSet(c.cfg); return window.__gpuRun() }, { lvl: i, cfg: best.cfg })
  const bare = await p.evaluate(c => { window.__gpuPlay(c.lvl); window.__gpuSet(c.cfg); return window.__gpuRun() },
    { lvl: i, cfg: { tile: L.tileOpts[0], pad: L.padOpts[0], bLayout: L.layoutOpts[0], regs: L.regOpts[0], mapping: L.mapOpts[0], sync: false } })
  ok(r.ok === true, `L${i}「${L.short}」正解 ${r.time} 拍 —— 页面判它达标`)
  ok(bare.ok !== true, `L${i}:开局那台(${bare.time} 拍${bare.calcOk ? '' : '、而且算错了'})页面不给过`)
}

/* ── 对错轴:时间再快,算错了也不给过 ── */
{
  const L = LEVELS[2]
  const race = await p.evaluate(() => { window.__gpuPlay(2); window.__gpuSet({ tile: 16, pad: 1, bLayout: 'row', regs: 128, mapping: 'row', sync: false }); return window.__gpuRun() })
  ok(race.time < L.par.time && race.calcOk === false && race.ok === false,
    `L2:不打栅栏 ${race.time} 拍比目标 ${L.par.time} 还快 —— 但算错了,页面不给过`)
  const safe = await p.evaluate(() => { window.__gpuSet({ tile: 16, pad: 1, bLayout: 'row', regs: 128, mapping: 'row', sync: true }); return window.__gpuRun() })
  ok(safe.calcOk === true && safe.ok === true, `L2:打上栅栏(${safe.time} 拍)算对了,才给过`)
}

/* ── 屏幕上那三张图,和内核算的是同一回事 ── */
{
  const cfg = { tile: 32, pad: 0, bLayout: 'col', regs: 32, mapping: 'row', sync: true }
  await p.evaluate(c => { window.__gpuPlay(6); window.__gpuSet(c) }, cfg)
  ok(transactionsFor(demoGlobalAddrs(cfg)) === WARP, `按列摆时,那 32 条地址确实散成 ${WARP} 笔(页面上就是 32 种颜色)`)
  ok(conflictFor(demoSharedBanks(cfg)) === BANKS, `不留 padding 时,那 32 条地址确实全压在一个 bank 上`)
  const good = { ...cfg, pad: 1, bLayout: 'row' }
  ok(transactionsFor(demoGlobalAddrs(good)) === 1 && conflictFor(demoSharedBanks(good)) === 1,
    '按行摆 + 留一个字之后:一笔事务、一路不撞')
}

/* ── 旋钮真的点得着 ── */
{
  await p.evaluate(() => window.__gpuPlay(6))
  const now = () => p.evaluate(() => window.__gpuNow())
  /*  ⚠️ 每点一下都要**重新取一次坐标**。
      有的旋钮是条件出现的(分块打开之后「每行多留」那一行才冒出来),一冒出来底下的行整体下移
      —— 拿第一次取的坐标接着点,后面几下全点空了,而且**不报错**,只是没反应。
      判据自己就栽过这一下:配出来的机器差一个旋钮没拨到位,却报「一路点下来配成了正解」。 */
  const click = async (key, v) => {
    const ui = await p.evaluate(() => window.__gpuUI())
    const x = key === 'part' ? ui.parts[0] : ui.knobs.find(k => k.key === key && k.v === v)
    if (!x) return false
    await p.mouse.click(x.x + x.bw / 2, ui.top + x.y + x.bh / 2); await p.waitForTimeout(40)
    return true
  }
  await click('tile', 32)
  ok(await p.evaluate(() => window.__gpuUI().knobs.some(k => k.key === 'pad')), '分块之后「共享内存每行多留」那一行才出现')
  for (const [k, v] of [['pad', 1], ['bLayout', 'row'], ['regs', 32], ['mapping', 'sorted'], ['part', 0]])
    ok(await click(k, v), `点得着「${k}」那一档`)
  const st = await now()
  ok(st.tile === 32 && st.pad === 1 && st.bLayout === 'row' && st.regs === 32 && st.mapping === 'sorted' && st.sync,
    `一路点下来配成了正解(${JSON.stringify(st)})`)
  const r = await p.evaluate(() => window.__gpuRun())
  ok(r.ok === true, `而且这台点出来的机器真的达标(${r.time} 拍)`)
  //  把分块关掉,padding 那一行要收起来、栅栏也该跟着灭
  await click('tile', 0)
  const ui3 = await p.evaluate(() => window.__gpuUI())
  ok(ui3.knobs.filter(k => k.key === 'pad').length === 0 && (await now()).sync === false,
    '把分块关掉:padding 那一行收起来、同步栅栏也跟着灭 —— 没有共享内存就没这两件事')
}

/* ── 文案 / 外壳 / 存档 ── */
{
  const texts = await p.evaluate(() => window.__gpuTexts())
  ok(texts.length >= 24, `读到 ${texts.length} 条关卡文案`)
  ok(texts.filter(t => /\*\*[一-龥]/.test(t || '')).length === 0, '文案里没有漏网的 markdown 强调')
  const bar = await p.evaluate(() => document.body.innerText)
  ok(bar.includes('虾米课堂') && bar.includes('回房子') && bar.includes('推理引擎') && bar.includes('GPU'),
    '外壳条上有返回主页、回房子、回推理引擎的路,标题写着 GPU')
  const L = LEVELS[1], best = sweep(L).filter(c => c.ok && c.time <= L.par.time).sort((a, z) => a.time - z.time)[0]
  await p.evaluate(c => { window.__gpuPlay(1); window.__gpuSet(c); window.__gpuRun() }, best.cfg)
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('xmhub.gpu') || 'null'))
  ok(saved?.data?.['1']?.time === best.time, `通关成绩落进课堂外壳的存档(L1 记下 ${saved?.data?.['1']?.time} 拍)`)
}

ok(errs.length === 0, `全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
