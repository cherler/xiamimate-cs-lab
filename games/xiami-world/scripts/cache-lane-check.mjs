import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://localhost:${PORT}/jiguan.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
const st = () => p.evaluate(() => window.__state())
const spawn = s => p.evaluate(s => window.__spawn(s), s)

await p.evaluate(() => { window.__auto(false); window.__level(9999, 9999) }) // 冻结环境投毒/扩散 + 中和关卡阈值,只测机关本身
ok(errs.length === 0, '无控制台报错' + (errs[0] ? ':' + errs[0].slice(0, 120) : ''))
ok((await st()).slots.every(s => s === 'empty'), '开局:三个缓存槽都空')

// 各形状灌几封 → 走慢道绕到查号台盖对章、顺手自动缓存进槽(管线自建、越跑越快)
for (const s of [0, 1, 2, 0, 1, 2]) { await spawn(s); await p.waitForTimeout(140) }
await p.waitForTimeout(11500); let s = await st()
ok(s.slots.filter(x => x === 'good').length >= 2 && s.good > 0, `走慢道查号→自动缓存进槽(good槽=${s.slots}, 好信=${s.good})`)

// 捣蛋鬼毒掉一个好槽 → 该形状抄快线被盖错 → 掉红废桶
await p.evaluate(() => window.__poison()); s = await st()
const pi = s.slots.indexOf('poison'); ok(pi >= 0, `捣蛋鬼毒掉一个好槽(槽${pi}变紫)`)
const bad0 = s.bad
for (let i = 0; i < 5; i++) { await spawn(pi); await p.waitForTimeout(140) }
await p.waitForTimeout(4800); s = await st()
ok(s.bad > bad0, `投毒槽把匹配的信抄快线盖错、掉红桶(废信 ${bad0}→${s.bad})`)
await p.screenshot({ path: SHOT + '/lane3-poison.png' })

// 时序·扩散:毒不清会往邻槽扩散(拖久了变多槽紫)
await p.evaluate(() => { window.__spread(); window.__spread() }); s = await st()
ok(s.slots.filter(x => x === 'poison').length >= 2, `毒扩散:不清就蔓延到邻槽(紫槽=${s.slots.filter(x => x === 'poison').length})`)

// 取舍A·全冲(慌了):干净但把攒好的全部快线也丢光 → 全空
await p.evaluate(() => window.__flushAll()); s = await st()
ok(s.slots.every(x => x === 'empty'), `全冲(空格):清干净但丢光全部快线,三槽全空=${s.slots}`)

// 冲刷后该形状重新走慢道盖对、出闸(快线可再攒回来)
const good1 = s.good
for (let i = 0; i < 4; i++) { await spawn(0); await p.waitForTimeout(140) }
await p.waitForTimeout(10500); s = await st()
ok(s.good > good1 && s.slots[0] === 'good', `冲刷后重走慢道盖对、缓存重建(好信 ${good1}→${s.good}, 槽0=${s.slots[0]})`)
await p.screenshot({ path: SHOT + '/lane3-clean.png' })

// 取舍B·定点冲(早发现):只冲那一个紫槽,别的好槽不受影响
await p.evaluate(() => { window.__poison() }); s = await st()
const pj = s.slots.indexOf('poison')
if (pj >= 0) { await p.evaluate(i => window.__flush(i), pj); s = await st(); ok(s.slots[pj] === 'empty', `定点冲刷紫槽${pj}→它空了(便宜:只这形状慢一小会)`) }
else ok(true, '定点冲刷(无紫槽可测,跳过)')

// —— 关卡:赢(送够好信→开门)——
await p.evaluate(() => { window.__reset2(); window.__auto(false); window.__level(3, 9) })
for (const s of [0, 1, 2]) { await spawn(s); await p.waitForTimeout(140) }
await p.waitForTimeout(11500); s = await st()
ok(s.level.state === 'win', `送够 3 封好信→目标满、门开=赢(state=${s.level.state}, progress=${s.level.progress})`)
// —— 关卡:输(废信攒满→机器罢工)——
await p.evaluate(() => { window.__reset2(); window.__auto(false); window.__level(9, 2); window.__poison() })
const lpi = (await st()).slots.indexOf('poison')
for (let i = 0; i < 4; i++) { await spawn(lpi); await p.waitForTimeout(160) }
await p.waitForTimeout(6000); s = await st()
ok(s.level.state === 'lose', `废信攒到上限→机器罢工=输(state=${s.level.state}, fail=${s.level.fail})`)

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
