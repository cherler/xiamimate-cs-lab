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
// 进副本 → 扫 → 钻散热片 → 进对照实验
await p.mouse.click(137, 268); await p.waitForTimeout(250)
await p.mouse.click(1090, 300); await p.waitForTimeout(450)
await p.mouse.click(1150, 46); await p.waitForTimeout(300)
await p.mouse.click(1025, 350); await p.waitForTimeout(450)
ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
ok(await p.evaluate(() => window.__expState?.scene) === 'Experiment', '钻进了对照实验台')
// 挑「散热热阻」(第1个, y=190) → 跑 (y=378)
await p.mouse.click(160, 190); await p.waitForTimeout(200)
await p.mouse.click(160, 378); await p.waitForTimeout(350)
let st = await p.evaluate(() => window.__expState)
ok(Math.abs(st.endA - 21) < 0.6, `堵着一组=求解器 21℃（实测 ${Number(st.endA).toFixed(1)}）`)
ok(Math.abs(st.endB - 7.5) < 0.6, `通着一组=求解器 7.5℃（实测 ${Number(st.endB).toFixed(1)}）`)
ok(st.endA - st.endB > 10, `两组分叉明显（Δ=${(st.endA - st.endB).toFixed(1)}℃）`)
ok(st.understood === true, '跑散热热阻 → 看懂了（破案）')
// 换错变量「环境温度」(第2个, y=246) → 跑，understood 应保持 false
await p.mouse.click(160, 246); await p.waitForTimeout(200)
await p.mouse.click(160, 378); await p.waitForTimeout(350)
st = await p.evaluate(() => window.__expState)
ok(st.understood === false, '跑环境温度 → 没破案（只有散热热阻能解释）')
await p.screenshot({ path: 'scripts/shot-experiment.png' })
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
