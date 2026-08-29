import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/jiguan.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(300)
// 玩到一半:关掉环境投毒,灌几封好信让目标条涨起来 + 手动投一个毒制造一个红
await p.evaluate(() => { window.__reset2 && window.__reset2(); window.__auto(false) })
for (const s of [0,1,2,0,1,2]) { await p.evaluate(s=>window.__spawn(s), s); await p.waitForTimeout(120) }
await p.waitForTimeout(6000) // 让它们查号缓存+送出闸,目标条填几格
await p.evaluate(() => window.__poison())
for (let i=0;i<3;i++){ await p.evaluate(()=>window.__spawn(0)); await p.waitForTimeout(120) }
await p.waitForTimeout(2500)
await p.screenshot({ path: SHOT + '/lane-playing.png' })
console.log('mid:', JSON.stringify(await p.evaluate(()=>window.__state())))
// 逼出赢:继续灌好信到目标满
await p.evaluate(() => window.__auto(false))
for (let k=0;k<14;k++){ await p.evaluate(s=>window.__spawn(s), k%3); await p.waitForTimeout(200) }
await p.waitForTimeout(7000)
await p.screenshot({ path: SHOT + '/lane-win.png' })
console.log('end:', JSON.stringify(await p.evaluate(()=>window.__state())))
await b.close()
