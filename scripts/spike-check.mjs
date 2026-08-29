import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const url = process.argv[2], name = process.argv[3]
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = [], logs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') logs.push(m.text()) })
await p.goto(url, { waitUntil: 'networkidle' }).catch(e => errs.push('goto:' + e))
await p.waitForTimeout(2600)
const info = await p.evaluate(() => {
  const c = document.querySelector('#canvas canvas') || document.querySelector('#canvas svg') || document.querySelector('canvas') || document.querySelector('svg')
  return { has: !!c, tag: c && c.tagName }
}).catch(e => ({ err: String(e) }))
await p.screenshot({ path: SHOT + '/' + name + '.png' })
await b.close()
console.log(name, '| pageerrors:', errs.length, errs.slice(0, 3))
console.log(name, '| console.errors:', logs.length, logs.slice(0, 2))
console.log(name, '| render:', JSON.stringify(info))
