import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/build.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
await p.evaluate(() => window.__level(4))
await p.evaluate(() => { const P=window.__place; for(let c=1;c<=5;c++)P(3,c,'belt',0); P(3,6,'buffer',0); for(let c=7;c<=10;c++)P(3,c,'belt',0) })
await p.evaluate(() => { window.__run(); window.__stepN(10) }); await p.waitForTimeout(150)
await p.screenshot({ path: SHOT + '/lv5-mid.png' })
await p.evaluate(() => window.__stepN(160)); await p.waitForTimeout(150)
await p.screenshot({ path: SHOT + '/lv5-win.png' })
console.log('done'); await b.close()
