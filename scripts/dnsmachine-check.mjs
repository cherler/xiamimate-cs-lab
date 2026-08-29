import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:5180/spikes/dns-machine.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
const st = () => p.evaluate(() => window.__state())
ok(errs.length === 0, '无报错' + (errs[0] ? ':' + errs[0].slice(0, 120) : ''))
let s = await st(); ok(!s.assembled && s.filled === 0, '开局空机器、未拼齐')
await p.screenshot({ path: SHOT + '/dnsm-empty.png' })
// 拼零件
await p.evaluate(() => { window.__fill('域名'); window.__fill('DNS服务器') })
s = await st(); ok(s.filled === 2 && !s.assembled, '拼2个还不够、未拼齐(运行按钮该灰)')
await p.evaluate(() => window.__fill('缓存'))
s = await st(); ok(s.filled === 3 && s.assembled, '拼齐3个→assembled、可运行')
await p.screenshot({ path: SHOT + '/dnsm-assembled.png' })
// 运行
await p.evaluate(() => window.__run())
await p.waitForTimeout(1400); await p.screenshot({ path: SHOT + '/dnsm-run.png' })
await p.waitForTimeout(4200); s = await st()
ok(s.lit && s.phase === 'done', '运行跑通→点亮、phase=done')
await p.screenshot({ path: SHOT + '/dnsm-done.png' })
await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
