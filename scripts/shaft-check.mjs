import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://localhost:${PORT}/shaft.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
const st = () => p.evaluate(() => window.__state())
const dial = s => p.evaluate(s => window.__dial(s), s)
const spawn = a => p.evaluate(a => window.__spawn(a), a)
const wait = ms => p.waitForTimeout(ms)

await p.evaluate(() => { window.__auto(false); window.__reset(); window.__level(9999, 9999) }) // 冻结自动进料 + 清干净 + 中和关卡阈值,只测机关本身
ok(errs.length === 0, '无控制台报错' + (errs[0] ? ':' + errs[0].slice(0, 120) : ''))
let s = await st(); ok(s.tiers.every(t => t === null) && s.success === 0, '开局:三层都空、成功0')

// 一封地址 [0,1,2] 的信:拨盘逐层对上 → 一层层穿到底 = 成功
await dial(2)                            // 先把拨盘停在不匹配首段(△)的档,信才稳稳卡在第一层
await spawn([0, 1, 2]); await wait(200); s = await st()
ok(JSON.stringify(s.tiers[0]) === '[0,1,2]', `信落入第一层(tier0=${JSON.stringify(s.tiers[0])})`)
await dial(0); await wait(500); s = await st()
ok(s.tiers[0] === null && JSON.stringify(s.tiers[1]) === '[0,1,2]', `拨盘=△对上第一段→放行到第二层(tier1=${JSON.stringify(s.tiers[1])})`)
await dial(1); await wait(500); s = await st()
ok(JSON.stringify(s.tiers[2]) === '[0,1,2]', `拨盘=□对上第二段→放行到第三层(tier2=${JSON.stringify(s.tiers[2])})`)
await dial(2); await wait(500); s = await st()
ok(s.success === 1 && s.tiers.every(t => t === null), `拨盘=○对上第三段→穿到底、真地址托盘+1(成功=${s.success})`)

// 一物多用:拨盘停在错形状,门就是不开(信干等,不放行)
await spawn([1, 0, 2]); await wait(200); await dial(2); await wait(600); s = await st()
ok(JSON.stringify(s.tiers[0]) === '[1,0,2]' && s.success === 1, `拨盘=○但这段要□→门不开,信卡在第一层(拨盘一物多用、对不上不放行)`)

// 并行取舍:A=[1,0,2] 先放到 tier1(在那儿等□);再来 B=[2,2,2] 落 tier0(等○)
await dial(1); await wait(500)          // A 这一段要□(1),放行到 tier1;tier1 这段要△(0),A 停在 tier1
s = await st(); ok(JSON.stringify(s.tiers[1]) === '[1,0,2]', `A 放行到第二层、停在那儿(tier1=${JSON.stringify(s.tiers[1])})`)
await spawn([2, 2, 2]); await wait(200); s = await st()
ok(JSON.stringify(s.tiers[1]) === '[1,0,2]' && JSON.stringify(s.tiers[0]) === '[2,2,2]', `两封信卡在不同层、各要不同段:tier1 等△、tier0 等○——拨盘一次只给一个`)
const sc0 = s.success
await dial(0); await wait(1200); s = await st() // 拨△:A 从 tier1 起穿到底(它 addr[1]=0,addr[2]=2…需再拨),B 干等
ok(JSON.stringify(s.tiers[0]) === '[2,2,2]' && s.success >= sc0, `拨△时只服务 A 那条线,B=[2,2,2]仍在 tier0 干等=时序取舍`)
await p.screenshot({ path: SHOT + '/shaft-run.png' })

// 拖延的代价:队满(QMAX=4)再来 → 溢出退信
const rj0 = (await st()).reject
await p.evaluate(() => { for (let i = 0; i < 6; i++) window.__spawn([1, 1, 1]) }); s = await st()
ok(s.reject > rj0, `顶上排队塞满、再来的信溢出退信(退信 ${rj0}→${s.reject})`)

// —— 关卡:赢(送对够多地址→开门)——
await p.evaluate(() => { window.__auto(false); window.__reset(); window.__level(3, 9) })
for (let k = 0; k < 3; k++) { await spawn([0, 0, 0]); await dial(2); await wait(150); await dial(0); await wait(1300) }
s = await st(); ok(s.level.state === 'win', `送对 3 封地址→目标满、门开=赢(state=${s.level.state}, progress=${s.level.progress})`)
// —— 关卡:输(拨盘一直不对、队塞爆溢出退信到上限)——
await p.evaluate(() => { window.__auto(false); window.__reset(); window.__level(9, 3); window.__dial(0) })
for (let i = 0; i < 9; i++) { await spawn([2, 2, 2]); await wait(120) } // 拨盘=△永不匹配○,全堵→溢出
await wait(400); s = await st()
ok(s.level.state === 'lose', `拨盘一直不对、队爆溢出到上限=输(state=${s.level.state}, fail=${s.level.fail})`)

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
