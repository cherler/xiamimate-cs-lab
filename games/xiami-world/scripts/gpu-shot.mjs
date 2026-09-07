/**
 * GPU 那台的截图工具 —— 版面和甘特图只能靠看,判据看不出「字压在字上」。
 * 用法:node scripts/infer-shot.mjs <关卡号> '<配置 JSON>' <输出路径>
 * 先起 dev:npx vite --port 5188 --host 127.0.0.1
 */
import { chromium } from 'playwright'
const PORT = process.env.PORT || 5188
const [lvlArg, cfgArg, out] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://127.0.0.1:${PORT}/gpu.html`, { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
if (lvlArg) await p.evaluate(i => window.__gpuPlay(+i), lvlArg)
if (cfgArg) await p.evaluate(c => { window.__gpuSet(JSON.parse(c)); window.__gpuRun() }, cfgArg)
await p.waitForTimeout(400)
await p.screenshot({ path: out || '/tmp/infer.png' })
console.log('截图:', out || '/tmp/infer.png', ' 控制台报错:', errs.slice(0, 4))
await b.close()
