import { chromium } from 'playwright'
const URL = 'http://localhost:5180/'
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(URL, { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
ok(await p.locator('canvas').count() > 0, 'canvas 存在')
const inTown = await p.evaluate(() => window.__game?.scene.isActive('Town'))
ok(inTown, 'Boot 预载后进入了 Town 场景')
// 开局委托板应是关的
const before = await p.evaluate(() => window.__townState?.boardOpen)
ok(before === false, '开局委托板是关的')
// 点诊所（游戏坐标==屏幕坐标，scale=1）
await p.mouse.click(314, 150)
await p.waitForTimeout(300)
const after = await p.evaluate(() => window.__townState)
ok(after?.boardOpen === true, '点诊所后委托板打开')
ok(after?.commission === '冷藏柜停了', `委托标题正确（${after?.commission}）`)
await p.screenshot({ path: 'scripts/shot-town.png' })
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
