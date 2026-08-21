import { chromium } from 'playwright'
const URL = 'http://localhost:5180/'
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })

// 干净开局：清进度再刷新
await p.goto(URL, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.removeItem('xiami.progress'))
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
ok(await p.evaluate(() => window.__townState?.clinicFixed) === false, '开局诊所未修')

// 进副本：点诊所开委托板 → 点进入副本
await p.mouse.click(314, 150); await p.waitForTimeout(250)
await p.mouse.click(1090, 300); await p.waitForTimeout(450)
ok(await p.evaluate(() => window.__game?.scene.isActive('Instance')) === true, '进入了副本(Instance)')
ok(await p.evaluate(() => window.__game?.scene.isActive('Town')) === false, '离开了小镇(Town 已停)')

// 完成修复 → 回镇
await p.mouse.click(640, 690); await p.waitForTimeout(450)
ok(await p.evaluate(() => window.__game?.scene.isActive('Town')) === true, '修完回到小镇')
ok(await p.evaluate(() => window.__townState?.clinicFixed) === true, '诊所变"已恢复"')

// 持久化：刷新还记得
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1100)
ok(await p.evaluate(() => window.__townState?.clinicFixed) === true, '刷新后诊所仍是已恢复（存下来了）')

// 自检：清进度 → 刷新 → 回到未修（证明持久化不是永远绿）
await p.evaluate(() => localStorage.removeItem('xiami.progress'))
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1100)
ok(await p.evaluate(() => window.__townState?.clinicFixed) === false, '清进度后回到未修（自检：持久化能红）')

await p.screenshot({ path: 'scripts/shot-loop.png' })
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
