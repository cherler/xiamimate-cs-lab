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
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
// 进副本
await p.mouse.click(314, 150); await p.waitForTimeout(250)
await p.mouse.click(1090, 300); await p.waitForTimeout(450)
ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
ok(await p.evaluate(() => window.__instanceState?.scene) === 'Instance', '进入副本大空间')
ok(await p.evaluate(() => window.__instanceState?.thermal) === false, '开局热成像是关的')
// 开热成像（按钮在 W-130=1150, y=46）
await p.mouse.click(1150, 46); await p.waitForTimeout(350)
const st = await p.evaluate(() => window.__instanceState)
ok(st?.thermal === true, '热成像已开')
const cond = st.parts.find(x => x.id === 'condenser')?.temp
const inside = st.parts.find(x => x.id === 'inside')?.temp
ok(cond > 60, `散热片扫出高温 ${Number(cond).toFixed(0)}℃（通红）`)
// 关键判据：工具读出的温度 = 求解器算的 30 + 90*0.5 = 75℃，不是手绘颜色
ok(Math.abs(cond - 75) < 0.5, `散热片温度==求解器的 75℃（实测 ${Number(cond).toFixed(1)}）`)
ok(cond > inside, `散热片(${Number(cond).toFixed(0)}) 比柜内(${Number(inside).toFixed(0)}) 烫——热堆在出口`)
// 点通红的散热片钻进去（860,400）
await p.mouse.click(860, 400); await p.waitForTimeout(300)
ok(await p.evaluate(() => window.__instanceState?.drilled) === 'condenser', '点散热片钻了进去')
await p.screenshot({ path: 'scripts/shot-scan.png' })
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
