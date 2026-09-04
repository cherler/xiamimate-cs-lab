import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/build.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
await p.evaluate(() => { const P=window.__place; for(let c=1;c<=5;c++)P(3,c,'belt',0); P(3,6,'sorter',0,0); P(2,6,'belt',3);P(1,6,'belt',0); for(let c=7;c<=10;c++)P(1,c,'belt',0); P(3,7,'belt',1);P(4,7,'belt',1); for(let c=7;c<=10;c++)P(5,c,'belt',0) })
await p.waitForTimeout(200); await p.screenshot({ path: SHOT + '/ui-new.png' })
console.log('done'); await b.close()
