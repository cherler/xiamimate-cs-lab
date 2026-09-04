import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl'] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://localhost:${PORT}/gate-dns.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1800)
for (let i = 0; i < 20 && !(await p.evaluate(() => !!window.__gate)); i++) await p.waitForTimeout(300)
ok(errs.length === 0, '无控制台报错' + (errs[0] ? ':' + errs[0].slice(0, 140) : ''))
const snap = () => p.evaluate(() => window.__gate.snapshot())
let s = await snap()
ok(!!s && s.poison.every(v => v > 0.7) && !s.won, `开局:三档案柜都发紫(被投毒 poison=${s.poison})、未通关`)
await p.screenshot({ path: SHOT + '/gate-poison.png' })
// 冲干净三格 → 应触发通关(整片区点亮、掉素材)
await p.evaluate(() => window.__gate.devFlushAll()); await p.waitForTimeout(1400)
s = await snap()
ok(s.won && s.poison.every(v => v < 0.15), `三格全冲干净 → 通关:栅门开、整片区点亮(poison=${s.poison})`)
await p.screenshot({ path: SHOT + '/gate-lit.png' })
// 走到素材上捡起
await p.evaluate(() => window.__gate.devMove(1120)); await p.waitForTimeout(600)
s = await snap(); ok(s.got, '走到「真地址签」上 → 捡进右上角(素材到手)')
await p.screenshot({ path: SHOT + '/gate-got.png' })
await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
