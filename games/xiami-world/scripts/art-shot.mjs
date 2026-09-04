import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/jiguan.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
await p.evaluate(() => window.__auto(false))
// build up cached slots then poison one
for (const s of [0,1,2,0,1,2]) { await p.evaluate(s=>window.__spawn(s), s); await p.waitForTimeout(120) }
await p.waitForTimeout(8000)
await p.evaluate(() => window.__poison())
for (let i=0;i<3;i++){ await p.evaluate(()=>window.__spawn(0)); await p.waitForTimeout(150) }
await p.waitForTimeout(1200)
await p.screenshot({ path: SHOT + '/art-cache.png' })
console.log('state', JSON.stringify(await p.evaluate(()=>window.__state())))
await b.close()
