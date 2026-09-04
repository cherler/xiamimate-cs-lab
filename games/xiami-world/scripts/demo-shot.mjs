import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/demo.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
await p.evaluate(() => window.__key(' '))            // 进世界
await p.evaluate(() => window.__walkTo(500)); await p.waitForTimeout(600)  // 站在门1前一点,看门+捣蛋鬼
await p.screenshot({ path: SHOT + '/demo-overworld.png' })
console.log('shot')
await b.close()
