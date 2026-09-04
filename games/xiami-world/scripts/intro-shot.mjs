import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/build.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(700)
await p.screenshot({ path: SHOT + '/skin-intro2.png' })
// click near the router region (house at center, router ~ study top-left)
const before = await p.evaluate(() => window.__scene ? 'x' : (document.title))
// click elsewhere (should NOT enter) then on router
await p.mouse.click(1100, 600); await p.waitForTimeout(150)
const r = await p.evaluate(() => window.__intro && window.__intro())
console.log('router rect:', JSON.stringify(r))
await b.close()
