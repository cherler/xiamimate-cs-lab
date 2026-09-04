import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const wait = ms => p.waitForTimeout(ms)
// ② win
await p.goto('http://localhost:5183/shaft.html', { waitUntil: 'networkidle' }); await wait(300)
await p.evaluate(() => { window.__auto(false); window.__reset(); window.__level(3, 9) })
for (let k=0;k<3;k++){ await p.evaluate(()=>window.__spawn([0,0,0])); await p.evaluate(()=>window.__dial(2)); await wait(150); await p.evaluate(()=>window.__dial(0)); await wait(1300) }
await wait(300); await p.screenshot({ path: SHOT + '/shaft-win.png' }); console.log('② win:', (await p.evaluate(()=>window.__state())).level.state)
// ② lose
await p.evaluate(() => { window.__auto(false); window.__reset(); window.__level(9,3); window.__dial(0) })
for (let i=0;i<9;i++){ await p.evaluate(()=>window.__spawn([2,2,2])); await wait(120) }
await wait(500); await p.screenshot({ path: SHOT + '/shaft-lose.png' }); console.log('② lose:', (await p.evaluate(()=>window.__state())).level.state)
// ③ win
await p.goto('http://localhost:5183/poison.html', { waitUntil: 'networkidle' }); await wait(300)
await p.evaluate(() => { window.__reset(); window.__level(2,9) })
await p.evaluate(()=>window.__set(85,'hold')); await wait(2800)
await p.evaluate(()=>window.__set(85,'hold')); await wait(2800)
await p.screenshot({ path: SHOT + '/poison-win.png' }); console.log('③ win:', (await p.evaluate(()=>window.__state())).level.state)
// ③ lose
await p.evaluate(() => { window.__reset(); window.__level(9,3) })
for (let i=0;i<3;i++){ await p.evaluate(()=>window.__set(90,'fill')); await wait(400) }
await p.screenshot({ path: SHOT + '/poison-lose.png' }); console.log('③ lose:', (await p.evaluate(()=>window.__state())).level.state)
await b.close()
