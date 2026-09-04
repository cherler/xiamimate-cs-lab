import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/jiguan.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(300)
// —— 玩到一半:部分目标 + 一两个红 ——
await p.evaluate(() => { window.__reset2(); window.__auto(false) })
for (const s of [0,1,2,0,1,2]) { await p.evaluate(s=>window.__spawn(s), s); await p.waitForTimeout(120) }
await p.waitForTimeout(4500)
await p.evaluate(() => window.__poison())
for (let i=0;i<2;i++){ await p.evaluate(()=>window.__spawn(0)); await p.waitForTimeout(140) }
await p.waitForTimeout(2200)
await p.screenshot({ path: SHOT + '/lane-playing.png' })
console.log('mid:', JSON.stringify((await p.evaluate(()=>window.__state())).level))
// —— 逼输:毒一个槽、猛灌那形状 → 红桶攒满 6 ——
await p.evaluate(() => { window.__reset2(); window.__auto(false); window.__poison() })
const st = await p.evaluate(()=>window.__state()); const pi = st.slots.indexOf('poison')
for (let i=0;i<9;i++){ await p.evaluate(pi=>window.__spawn(pi), pi); await p.waitForTimeout(160) }
await p.waitForTimeout(3000)
await p.screenshot({ path: SHOT + '/lane-lose.png' })
console.log('lose:', JSON.stringify((await p.evaluate(()=>window.__state())).level))
await b.close()
