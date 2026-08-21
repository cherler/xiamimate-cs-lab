import { chromium } from 'playwright'
const URL = 'http://localhost:5180/?scripted=1'
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(URL, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.removeItem('xiami.progress'))
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
ok(await p.evaluate(() => window.__townState?.clinicFixed) === false, '开局诊所未修')
// 进副本 → 扫 → 钻散热片 → 对照实验 → 破案
await p.mouse.click(479, 184); await p.waitForTimeout(250)
await p.mouse.click(1090, 300); await p.waitForTimeout(450)
await p.mouse.click(1150, 46); await p.waitForTimeout(300)
await p.mouse.click(1025, 350); await p.waitForTimeout(450)
await p.mouse.click(160, 190); await p.waitForTimeout(200)
await p.mouse.click(160, 378); await p.waitForTimeout(350)
ok(await p.evaluate(() => window.__expState?.understood) === true, '对照实验破案')
// 回去修 → Repair
await p.mouse.click(760, 620); await p.waitForTimeout(400)
ok(await p.evaluate(() => window.__repairState?.scene) === 'Repair', '进入修复')
// 清灰
await p.mouse.click(640, 300); await p.waitForTimeout(350)
ok(await p.evaluate(() => window.__repairState?.cleaned) === true, '清了散热片积灰')
// 反转：先选"冷冻"——会冻坏，不安全，完不成
await p.mouse.click(400, 430); await p.waitForTimeout(250)
ok(await p.evaluate(() => window.__repairState?.windowSafe) === false, '设成冷冻→不安全（会冻坏疫苗）')
await p.mouse.click(640, 560); await p.waitForTimeout(300)
ok(await p.evaluate(() => window.__game?.scene.isActive('Repair')) === true, '不安全时完不成，还在修复')
// 选对："冷藏 2–8℃"——安全
await p.mouse.click(880, 430); await p.waitForTimeout(250)
ok(await p.evaluate(() => window.__repairState?.windowSafe) === true, '设成冷藏 2–8℃→安全')
// 完成修复 → 回镇
await p.mouse.click(640, 560); await p.waitForTimeout(450)
ok(await p.evaluate(() => window.__game?.scene.isActive('Town')) === true, '完成修复→回到小镇')
ok(await p.evaluate(() => window.__townState?.clinicFixed) === true, '诊所变已恢复')
// 持久化
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
ok(await p.evaluate(() => window.__townState?.clinicFixed) === true, '刷新后仍已恢复')
// 自检：清进度→回到未修
await p.evaluate(() => localStorage.removeItem('xiami.progress'))
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
ok(await p.evaluate(() => window.__townState?.clinicFixed) === false, '清进度后回到未修（自检：持久化能红）')
await p.screenshot({ path: 'scripts/shot-play.png' })
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
