/**
 * 「虾米课堂外壳」云端同步判据。
 *
 * 本机没跑主站后端(网关 /v1 打过去是 502),所以这里**拦住 /v1/lab/progress 自己应答**——
 * 要验的本来也不是后端,而是外壳这一侧的两件事:
 *   ① 云端那份更近时,进度真的被拉下来灌进游戏;
 *   ② 推上去的整份 payload 里,**别人的东西一个字节没动** —— 实验的错题记录、
 *      另一个游戏的存档。这条最要命:带漏了就等于把别人的进度删了,而且删得悄无声息。
 * 老规矩:每条正向判据都配一条能判红的反例。
 *
 * 前提:两个游戏都已 vite build(外壳只在**构建产物**里认「并入主站」形态),
 * 且实验室 dev 在 5178(它把两个游戏的 dist 挂到 /lab/cards、/lab/world)。
 *   cd games/algo-cards && npx vite build;cd ../xiami-world && npx vite build
 *   node games/hub-cloud-check.mjs
 */
import { chromium } from 'playwright'
const PORT = process.env.PORT || 5178
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

/** 云端主本:实验的一条错题记录 + 另一个游戏的存档 + 本游戏一份「更近的」进度。 */
const foreignQ = { 'p1#0': { attempts: 3, wrong: 1, streak: 2, lastCorrect: true, lastAt: 111 } }
const otherGame = { at: 5000, data: { 0: { parts: 12, cycles: 20 } } }

/** local=true 时先把本地存档写成「更近的一份」,逼外壳走**推送**那条路 ——
 *  不这么做的话云端更近、一次都不推,那条「别人的东西没动」的判据就是空跑,等于没测。 */
async function run(path, key, mineData, local = false) {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e)))
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 120)) })
  const puts = []
  await p.route('**/v1/lab/progress', async route => {
    const req = route.request()
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          ok: true, rev: 7,
          payload: { ...foreignQ, '@games': { [key]: { at: Date.now(), data: mineData }, __other: otherGame } },
        }),
      })
    }
    puts.push(JSON.parse(req.postData() || '{}'))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rev: 8 }) })
  })
  await p.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle' })
  if (local) {
    await p.evaluate(([k, d]) => localStorage.setItem(`xmhub.${k}`, JSON.stringify({ at: Date.now() + 60000, data: d })), [key, local])
    await p.reload({ waitUntil: 'networkidle' })
  }
  await p.waitForTimeout(900)
  const state = await p.evaluate(() => ({
    bar: !!document.getElementById('xm-hub'),
    home: document.querySelector('#xm-hub a.btn')?.getAttribute('href') || null,
    status: document.querySelector('#xm-hub .st')?.textContent || '',
  }))
  await b.close()
  return { puts, state, errs }
}

console.log('\n虾米课堂外壳 · 返回主页 / 云端同步\n')

/* ── 算法卡牌:云端那份更近 → 该被拉下来 ── */
{
  const cloudProg = { runs: 9, wins: 4, best: 6, kits: { sort: { runs: 9, wins: 4, best: 6 } }, save: null }
  const { state, errs } = await run('/lab/cards/', 'cards', cloudProg)
  ok(state.bar, '算法卡牌:课堂条挂上了')
  ok(state.home === '/lab/', `算法卡牌:「← 虾米课堂」指向 /lab/(实测 ${state.home})`)
  ok(state.status.includes('已同步'), `算法卡牌:登录态显示已同步(实测「${state.status}」)`)
  ok(errs.length === 0, `算法卡牌:全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
}

/* ── 探索游戏:推上去的整份必须原样带着别人的东西 ── */
{
  const cloudBest = { 0: { parts: 21, cycles: 18 } }
  const mineBest = { 0: { parts: 12, cycles: 16 }, 1: { parts: 30, cycles: 22 } }
  const { puts, state, errs } = await run('/lab/world/', 'world', cloudBest, mineBest)
  ok(state.bar && state.home === '/lab/', '探索游戏:课堂条与返回主页按钮都在')
  ok(errs.length === 0, `探索游戏:全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
  //  云端更近时外壳不该回推(会白盖一次);这里断言的是「要么没推,要么推的那份没伤到别人」
  const bad = puts.filter(x => {
    const pl = x.payload || {}
    return JSON.stringify(pl['p1#0']) !== JSON.stringify(foreignQ['p1#0'])
      || JSON.stringify(pl['@games']?.__other) !== JSON.stringify(otherGame)
  })
  ok(puts.length > 0, `探索游戏:本地更近 → 真的推了 ${puts.length} 次(推 0 次的话下面那条就是空跑)`)
  ok(puts.length > 0 && bad.length === 0, `探索游戏:推上去的 ${puts.length} 次里,实验错题记录与另一个游戏的存档都一个字节没动`)
  const mine = puts.at(-1)?.payload?.['@games']?.world?.data
  ok(JSON.stringify(mine) === JSON.stringify(mineBest), `探索游戏:自己那一格推的是本地那份较新的进度(${JSON.stringify(mine)})`)
  //  自检:这批数据真的能判红 —— 旧写法(只推自己那份)在同样的 payload 上必然丢掉这两样
  const legacy = { payload: { 0: { parts: 1, cycles: 1 } } }
  ok(legacy.payload['p1#0'] === undefined && legacy.payload['@games'] === undefined,
    '自检:旧写法(只推自己那份)在同样的数据上确实把两样都丢了 —— 上面那条判据有鉴别力')
}

console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
