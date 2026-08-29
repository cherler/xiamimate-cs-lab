import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1180, height: 820 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://localhost:${PORT}/dns-machine.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
const st = () => p.evaluate(() => window.__state())
const use = (t, part) => p.evaluate(([t, part]) => window.__use(t, part), [t, part])
const force = k => p.evaluate(k => window.__force(k), k)

ok(errs.length === 0, '无控制台报错' + (errs[0] ? ':' + errs[0].slice(0, 120) : ''))
await force('poison'); await p.waitForTimeout(400); let s = await st()
ok(s.fault === 'poison' && !s.canOpen && s.tanks.every(t => t === 'poison'), '投毒:三罐都是紫色(脏)、网页打不开')
await p.screenshot({ path: SHOT + '/dnsv-poison.png' })
// 冲刷一罐(看喷溅) → 加载 → 被回填、还失败(不是一键)
await use('flush', 'd-browser'); await p.waitForTimeout(160); await p.screenshot({ path: SHOT + '/dnsv-flush.png' })
await use('load', 'gate'); await p.waitForTimeout(120); s = await st()
ok(!s.won && s.tanks[0] === 'poison' && s.down > 0, `只冲一罐→加载:被下游回填成紫、打不开、断网 ${s.down}%`)
// 三罐全冲 + 加载 → 通
await use('flush', 'd-browser'); await use('flush', 'd-os'); await use('flush', 'd-recursive'); await use('load', 'gate')
await p.waitForTimeout(300); s = await st()
ok(s.won, `三罐全冲干净→加载:网页通了(${s.moves} 步)`)
await p.screenshot({ path: SHOT + '/dnsv-win.png' })
// 换故障=换工具
await force('hijack'); await use('flush', 'd-browser'); await use('flush', 'd-os'); await use('flush', 'd-recursive'); await use('load', 'gate'); s = await st()
ok(!s.won, '域名劫持:冲罐没用')
await use('knife', 'hosts'); await use('load', 'gate'); s = await st(); ok(s.won, '涂改刀划掉 hosts → 通了')
await force('down'); await use('wrench', 'reroute'); await use('load', 'gate'); s = await st(); ok(s.won, '递归掉线:道岔扳手换 DNS → 通了')
// 瞎试有代价
await force('poison'); for (let i = 0; i < 8 && !(await st()).lost; i++) await use('load', 'gate')
s = await st(); ok(s.lost && s.down >= 100, `没诊断反复瞎加载 → 断网满、失败(代价 ${s.down}%)`)

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
