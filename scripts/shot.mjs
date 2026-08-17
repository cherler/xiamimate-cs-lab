import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewportSize: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', e => errs.push('pageerror: ' + e.message))
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
await p.goto('file://' + process.argv[2])
await p.waitForTimeout(400)

// 初始态
await p.screenshot({ path: '/tmp/s0.png', fullPage: true })

// 量一下单向数据流：点第 6 步，检查所有视图都跟着变
const before = await p.evaluate(() => ({
  tag: document.getElementById('rTag').textContent,
  set: document.getElementById('rSet').textContent,
  logCur: document.querySelector('#log li.cur .x').textContent.slice(0, 20),
  tickCur: document.querySelector('.tick.cur').dataset.i,
  touched: document.querySelectorAll('.cell.touched').length,
}))
await p.click('.tick[data-i="5"]')
await p.waitForTimeout(250)
const after = await p.evaluate(() => ({
  tag: document.getElementById('rTag').textContent,
  set: document.getElementById('rSet').textContent,
  logCur: document.querySelector('#log li.cur .x').textContent.slice(0, 20),
  tickCur: document.querySelector('.tick.cur').dataset.i,
  touched: document.querySelectorAll('.cell.touched').length,
  evicted: document.querySelectorAll('.cell.evicted').length,
  linkPath: !!document.querySelector('#linkSvg path'),
  bitSegs: document.querySelectorAll('.seg').length,
}))
await p.screenshot({ path: '/tmp/s5.png', fullPage: true })

console.log('初始:', JSON.stringify(before))
console.log('第6步:', JSON.stringify(after))
console.log('错误:', errs.length ? errs : '无')
await b.close()
