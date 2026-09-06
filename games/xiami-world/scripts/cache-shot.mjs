/**
 * Cache 那台机器的截图工具 —— 美术和版面只能靠看,判据看不出「字压在字上」。
 *
 * 用法:node scripts/cache-shot.mjs <关卡号> '<配置 JSON>' <输出路径>
 *   node scripts/cache-shot.mjs 2 '{"ob":0,"ib":3,"ways":2}' /tmp/l2.png
 * 关卡号和配置都可以留空(传 "")—— 那就照开局那台的样子。
 * 先起 dev:npx vite --port 5184 --host 127.0.0.1
 */
import { chromium } from 'playwright'
const PORT = process.env.PORT || 5184
const [lvlArg, cfgArg, out] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://127.0.0.1:${PORT}/cache.html`, { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
if (lvlArg) await p.evaluate(i => window.__cachePlay(+i), lvlArg)
if (cfgArg) await p.evaluate(c => { window.__cacheSet(JSON.parse(c)); window.__cacheRun() }, cfgArg)
await p.waitForTimeout(500)
await p.screenshot({ path: out || '/tmp/cache.png' })
console.log('截图:', out || '/tmp/cache.png', ' 控制台报错:', errs.slice(0, 4))
await b.close()
