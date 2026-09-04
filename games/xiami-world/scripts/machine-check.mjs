import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:5180/spikes/machine.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.screenshot({ path: SHOT + '/machine-idle.png' })
await p.click('#run')
await p.waitForTimeout(1800)  // 运转中(第3档附近)
await p.screenshot({ path: SHOT + '/machine-run.png' })
await p.waitForTimeout(3500)  // 完成
await p.screenshot({ path: SHOT + '/machine-done.png' })
await b.close()
console.log('machine | pageerrors:', errs.length, errs.slice(0,3))
