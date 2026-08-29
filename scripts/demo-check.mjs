import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://localhost:${PORT}/demo.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
const wd = () => p.evaluate(() => window.__world())
const wait = ms => p.waitForTimeout(ms)

ok(errs.length === 0, '无控制台报错' + (errs[0] ? ':' + errs[0].slice(0, 140) : ''))
ok((await wd()).mode === 'intro', '开场:intro')
await p.keyboard.press('Space'); await wait(200); ok((await wd()).mode === 'walk', '空格→进入连续走廊 walk')

// 走到第一台机器、就地操作(真嵌入机关)
await p.evaluate(() => window.__walkTo(820)); await wait(300)
await p.evaluate(() => window.__enter()); await wait(1200) // 等镜头推近 zoom>0.9 机关才 update
let d = await wd(); ok(d.mode === 'operate' && d.activeIdx === 0, `走到缓存机→就地操作(mode=${d.mode}, zoom=${d.zoom})`)
// 真通关:目标设1、冻结投毒、灌一封好信 → 送达=赢 → 世界检测→拉回走廊
await p.evaluate(() => { const m = window.__am(); m.level.goal = 1; m.poisonT = 999; m.spawn(0) })
await wait(11000)
d = await wd(); ok(d.mode === 'walk' && d.stations[0] === true, `缓存机真通关→拉回走廊、门面点亮(stations=${d.stations})`)
await p.screenshot({ path: SHOT + '/bl-world.png' })

// 第二、三台快进
await p.evaluate(() => window.__walkTo(1950)); await wait(200); await p.evaluate(() => window.__enter()); await wait(300); await p.evaluate(() => window.__forceSolve()); await wait(200)
d = await wd(); ok(d.stations[1] === true, `递归查号修通(stations=${d.stations})`)
await p.evaluate(() => window.__walkTo(3080)); await wait(200); await p.evaluate(() => window.__enter()); await wait(300); await p.evaluate(() => window.__forceSolve()); await wait(200)
d = await wd(); ok(d.stations[2] === true && d.active === -1, `连接引擎修通、三台全通(stations=${d.stations})`)

// 走到核心→终章
await p.evaluate(() => { window.__walkTo(3950); window.__toCore() }); await wait(2000)
d = await wd(); ok(d.mode === 'finale', `全通→核心重启终章(mode=${d.mode})`)
await p.screenshot({ path: SHOT + '/bl-finale.png' })

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
