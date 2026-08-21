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
await p.evaluate(() => localStorage.removeItem('xiami.progress'))
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
// 进副本 → enter 节点
await p.mouse.click(314, 150); await p.waitForTimeout(250)
await p.mouse.click(1090, 300); await p.waitForTimeout(450)
ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
ok((await p.evaluate(() => window.__partnerLine))?.length > 0, '进副本时虾米君开口（enter）')
// 开热成像 → anomaly 节点，台词带求解器的 75℃
await p.mouse.click(1150, 46); await p.waitForTimeout(300)
const anom = await p.evaluate(() => window.__partnerLine)
ok(/75/.test(anom), `扫出异常时台词带求解器的 75℃（「${anom?.slice(0, 24)}…」）`)
// 钻进去 → 对照实验 before-pick
await p.mouse.click(860, 400); await p.waitForTimeout(400)
ok((await p.evaluate(() => window.__partnerLine))?.length > 0, '进实验台时虾米君提示（before-pick）')
// 挑散热热阻 → 跑 → cracked，台词带 21 与 7.5
await p.mouse.click(160, 190); await p.waitForTimeout(180)
await p.mouse.click(160, 378); await p.waitForTimeout(300)
const crack = await p.evaluate(() => window.__partnerLine)
ok(/21/.test(crack) && /7\.5/.test(crack), `破案台词带求解器的 21 与 7.5（「${crack?.slice(0, 28)}…」）`)
// 回去修 → 清灰 → 选冷冻 → freeze-warn
await p.mouse.click(760, 620); await p.waitForTimeout(400)
await p.mouse.click(640, 300); await p.waitForTimeout(350)
await p.mouse.click(400, 430); await p.waitForTimeout(300)
const warn = await p.evaluate(() => window.__partnerLine)
ok(/冰点|冻/.test(warn), `设冷冻时虾米君示警（「${warn?.slice(0, 24)}…」）`)
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
