import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto('http://localhost:5183/blight.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
console.log('errs', errs.slice(0,2))
// walk to station
await p.evaluate(() => window.__walkTo(1080)); await p.waitForTimeout(600)
await p.screenshot({ path: SHOT + '/blight-walk.png' })
console.log('walk', JSON.stringify(await p.evaluate(()=>window.__bl())))
// enter operate + poison to show state
await p.evaluate(() => window.__enter()); await p.waitForTimeout(900)
await p.evaluate(() => { const m=window.__m(); m.spawn(0); m.spawn(1); m.spawn(2) }); await p.waitForTimeout(5000)
await p.evaluate(() => window.__m().poison()); await p.waitForTimeout(800)
await p.screenshot({ path: SHOT + '/blight-operate.png' })
console.log('op', JSON.stringify(await p.evaluate(()=>window.__bl())))
await b.close()
