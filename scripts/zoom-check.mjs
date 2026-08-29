import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:5180/spikes/zoom.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(700)
await p.screenshot({ path: SHOT + '/zoom-0.png' })
// 俯冲中:直接把 target 卡在 0.5 附近(设 target 后立即截,趁 tween 还在 ~0.5)
await p.evaluate(() => window.__zoom(1))
await p.waitForTimeout(260); await p.screenshot({ path: SHOT + '/zoom-mid.png' })
await p.waitForTimeout(1400); await p.screenshot({ path: SHOT + '/zoom-in.png' })
const z = await p.evaluate(() => window.__z)
await b.close()
console.log('zoom | pageerrors:', errs.length, errs.slice(0,2), '| final z=', z.toFixed(2))
