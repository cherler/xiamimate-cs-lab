import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const wait = ms => p.waitForTimeout(ms)
await p.goto('http://localhost:5183/demo.html', { waitUntil: 'networkidle' }); await wait(400)
await p.keyboard.press('Space'); await wait(300)
// walk near station 0
await p.evaluate(() => window.__walkTo(700)); await wait(600)
await p.screenshot({ path: SHOT + '/bl-corridor.png' })
// operate cache (legend visible)
await p.evaluate(() => window.__walkTo(820)); await p.evaluate(() => window.__enter()); await wait(1100)
await p.evaluate(() => { const m=window.__am(); m.spawn(0); m.spawn(1); m.spawn(2) }); await wait(5000); await p.evaluate(()=>window.__am().poison()); await wait(700)
await p.screenshot({ path: SHOT + '/bl-op-cache.png' })
await p.evaluate(() => window.__forceSolve()); await wait(400)
// operate poison (station 2) to show a different machine embedded
await p.evaluate(() => { window.__walkTo(1950); window.__enter(); window.__forceSolve() }); await wait(300)
await p.evaluate(() => window.__walkTo(3080)); await p.evaluate(() => window.__enter()); await wait(1100)
await p.evaluate(() => { const m=window.__am(); m.w=76; m.mode='fill' }); await wait(150)
await p.screenshot({ path: SHOT + '/bl-op-poison.png' })
console.log('done'); await b.close()
