import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const wait = ms => p.waitForTimeout(ms)
// ② 锁孔 + legend:摆两封信在不同层,拨盘停在其中一个形状
await p.goto('http://localhost:5183/shaft.html', { waitUntil: 'networkidle' }); await wait(300)
await p.evaluate(() => { window.__auto(false); window.__reset() })
await p.evaluate(()=>window.__spawn([0,1,2])); await wait(200)   // A 落 tier0
await p.evaluate(()=>window.__dial(0)); await wait(500)          // A→tier1 (要□)
await p.evaluate(()=>window.__spawn([2,0,1])); await wait(300)   // B 落 tier0 (要○)
await p.evaluate(()=>window.__dial(2))                           // 拨盘=○:B 的锁孔亮青,A 的琥珀
await wait(200); await p.screenshot({ path: SHOT + '/shaft-v2.png' })
// ③ legend + 放慢:桶半满、核心升近窗口
await p.goto('http://localhost:5183/poison.html', { waitUntil: 'networkidle' }); await wait(300)
await p.evaluate(() => { window.__reset(); window.__set(72, 'hold') }); await wait(150)
await p.screenshot({ path: SHOT + '/poison-v2.png' })
// ① legend + 冲好槽的红✕失误
await p.goto('http://localhost:5183/jiguan.html', { waitUntil: 'networkidle' }); await wait(300)
await p.evaluate(() => { window.__reset2(); window.__auto(false) })
for (const s of [0,1,2]) { await p.evaluate(s=>window.__spawn(s), s); await wait(120) }
await wait(6000)                        // 三槽缓存起来(good)
await p.evaluate(()=>window.__flush(0)) // 手贱冲了好槽 → 红✕
await wait(150); await p.screenshot({ path: SHOT + '/lane-v2.png' })
console.log('shots done')
await b.close()
