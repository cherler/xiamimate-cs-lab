import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
await p.goto('http://localhost:5183/build.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
await p.screenshot({ path: SHOT + '/skin-intro.png' })          // 入口:房子切面
await p.evaluate(() => window.__menu && window.__menu()); await p.waitForTimeout(400)
await p.screenshot({ path: SHOT + '/skin-menu.png' })           // 关卡地图(路由器内部)
await p.evaluate(() => window.__play(0)); await p.waitForTimeout(300)
await p.screenshot({ path: SHOT + '/skin-play.png' })           // 关内(走廊底 + 工作台 + 故事)
console.log('done'); await b.close()
