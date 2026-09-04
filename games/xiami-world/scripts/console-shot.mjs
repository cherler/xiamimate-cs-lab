import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/demo.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
await p.evaluate(() => window.__key(' ')); await p.waitForTimeout(600)
await p.screenshot({ path: SHOT + '/console-start.png' })
// mid: fix node 0 + 1 to show conduit lighting up
await p.evaluate(() => window.__enter(0)); await p.waitForTimeout(300); await p.evaluate(() => window.__forceWin()); await p.waitForTimeout(300)
await p.screenshot({ path: SHOT + '/console-mid.png' })
console.log('done'); await b.close()
