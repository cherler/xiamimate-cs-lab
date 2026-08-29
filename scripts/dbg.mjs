import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage()
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error') errs.push('console:'+m.text().slice(0,200)) })
await p.goto('http://localhost:5183/jiguan.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
console.log('errs:', JSON.stringify(errs.slice(0,3), null, 1))
console.log('__auto?', await p.evaluate(() => typeof window.__auto))
await b.close()
