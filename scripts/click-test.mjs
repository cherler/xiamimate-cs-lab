import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/build.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
const r = await p.evaluate(() => window.__intro())
await p.mouse.click(1150, 650); await p.waitForTimeout(150)  // click empty area — should NOT enter
const after1 = await p.evaluate(() => window.__intro()) // still intro if router rect still updating (menu doesn't call renderIntro → rect frozen)
await p.mouse.click(r.x + r.w/2, r.y + r.h/2); await p.waitForTimeout(300)  // click router → enter
const shot = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
await p.screenshot({ path: shot + '/click-after.png' })
console.log('router rect', JSON.stringify(r))
await b.close()
