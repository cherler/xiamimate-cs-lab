import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/poison.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(300)
await p.evaluate(() => { window.__reset(); window.__set(78, 'fill') }); await p.waitForTimeout(150)
await p.screenshot({ path: SHOT + '/poison-2btn.png' }); console.log('shot')
await b.close()
