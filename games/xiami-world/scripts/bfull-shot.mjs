import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto('http://localhost:5183/bfull.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
console.log('errs', errs.slice(0,2))
// build caches then poison slot 2 (far right) so character must run there
await p.evaluate(() => { const m=window.__m(); for(const s of [0,1,2,0,1,2]) m.spawn(s) }); await p.waitForTimeout(7000)
await p.evaluate(() => { const m=window.__m(); m.slots[2]={state:'poison',ttl:1} })
// walk character left (away) to show the "run to it" gap
await p.keyboard.down('a'); await p.waitForTimeout(500); await p.keyboard.up('a')
await p.waitForTimeout(300)
await p.screenshot({ path: SHOT + '/bfull.png' })
console.log('bf', JSON.stringify(await p.evaluate(()=>window.__bf())))
await b.close()
