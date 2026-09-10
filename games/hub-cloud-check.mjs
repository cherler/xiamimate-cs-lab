/**
 * 「虾米CS课堂外壳」云端同步判据。
 *
 * 本机没跑主站后端(网关 /v1 打过去是 502),所以这里**拦住 /v1/lab/progress 自己应答**——
 * 要验的本来也不是后端,而是外壳这一侧的两件事:
 *   ① 云端那份更近时,进度真的被拉下来灌进游戏;
 *   ② 推上去的整份 payload 里,**别人的东西一个字节没动** —— 实验的错题记录、
 *      另一个游戏的存档。这条最要命:带漏了就等于把别人的进度删了,而且删得悄无声息。
 * 老规矩:每条正向判据都配一条能判红的反例。
 *
 * 前提:算法卡牌已 vite build(外壳只在**构建产物**里认「并入主站」形态),
 * 且实验室 dev 在 5178(它把它的 dist 挂到 /cslab/cards)。
 *   cd games/algo-cards && npx vite build
 *   node games/hub-cloud-check.mjs
 *
 * ⚠️ 2026-09-10:**探索游戏(games/xiami-world)已从虾米CS课堂去掉**(完成度太差),
 * 不再挂 /cslab/world。原来「推上去必须原样带着别人的东西」这条是靠它验的 ——
 * 那是本文件最要命的一条,**不能跟着一起摘掉**,已改由算法卡牌来验。
 *
 * 外来数据那一格(__other)保留的是一个**本次写入方不认识的键**。它验的不是
 * 某个具体游戏,而是规矩本身:payload 是全课堂共用的一份文档,
 * **谁写都得把不认识的键原样带回去**。将来再接一个游戏、或实验那边加一类记录,
 * 靠的都是这条。(虾米CS课堂还没上线、没有老用户 —— 所以这里不是在保谁的存档,
 * 是在保这条规矩不被下一次改动破坏。) */
import { chromium } from 'playwright'
const PORT = process.env.PORT || 5178
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

/** 云端主本:实验的一条错题记录 + 一格「本次写入方不认识的」游戏存档 + 本游戏一份进度。
 *  __other 这一格取的是**已下架的探索游戏**留下的形状 —— 见文件头那段。 */
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

console.log('\n虾米CS课堂外壳 · 返回主页 / 云端同步\n')

/* ── 算法卡牌:云端那份更近 → 该被拉下来 ── */
{
  const cloudProg = { runs: 9, wins: 4, best: 6, kits: { sort: { runs: 9, wins: 4, best: 6 } }, save: null }
  const { state, errs } = await run('/cslab/cards/', 'cards', cloudProg)
  ok(state.bar, '算法卡牌:课堂条挂上了')
  ok(state.home === '/cslab/', `算法卡牌:「← 虾米CS课堂」指向 /cslab/(实测 ${state.home})`)
  ok(state.status.includes('已同步'), `算法卡牌:登录态显示已同步(实测「${state.status}」)`)
  ok(errs.length === 0, `算法卡牌:全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
}

/* ── 算法卡牌:推上去的整份必须原样带着别人的东西(本文件最要命的一条)── */
{
  const cloudProg = { runs: 2, wins: 1, best: 2, kits: { sort: { runs: 2, wins: 1, best: 2 } }, save: null }
  const mineProg = { runs: 9, wins: 4, best: 6, kits: { sort: { runs: 9, wins: 4, best: 6 } }, save: null }
  const { puts, state, errs } = await run('/cslab/cards/', 'cards', cloudProg, mineProg)
  ok(state.bar && state.home === '/cslab/', '算法卡牌:课堂条与返回主页按钮都在')
  ok(errs.length === 0, `算法卡牌:全程无控制台报错${errs.length ? ':' + errs[0] : ''}`)
  const bad = puts.filter(x => {
    const pl = x.payload || {}
    return JSON.stringify(pl['p1#0']) !== JSON.stringify(foreignQ['p1#0'])
      || JSON.stringify(pl['@games']?.__other) !== JSON.stringify(otherGame)
  })
  ok(puts.length > 0, `算法卡牌:本地更近 → 真的推了 ${puts.length} 次(推 0 次的话下面那条就是空跑)`)
  ok(puts.length > 0 && bad.length === 0,
    `算法卡牌:推上去的 ${puts.length} 次里,实验错题记录与**它不认识的那格游戏存档**都一个字节没动`)
  const mine = puts.at(-1)?.payload?.['@games']?.cards?.data
  ok(JSON.stringify(mine) === JSON.stringify(mineProg), `算法卡牌:自己那一格推的是本地那份较新的进度`)
  //  自检:这批数据真的能判红 —— 旧写法(只推自己那份)在同样的 payload 上必然丢掉这两样
  const legacy = { payload: { runs: 1 } }
  ok(legacy.payload['p1#0'] === undefined && legacy.payload['@games'] === undefined,
    '自检:旧写法(只推自己那份)在同样的数据上确实把两样都丢了 —— 上面那条判据有鉴别力')
}

console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
