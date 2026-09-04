import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://localhost:${PORT}/factory.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
const st = () => p.evaluate(() => window.__state())
const walk = x => p.evaluate(x => window.__walk(x), x)
const rep = (t, part) => p.evaluate(([t, part]) => window.__repair(t, part), [t, part])
const solve = f => f === 'poison' ? [['flush', 'd-browser'], ['flush', 'd-os'], ['flush', 'd-recursive'], ['load', 'gate']] : f === 'hijack' ? [['knife', 'hosts'], ['load', 'gate']] : [['wrench', 'reroute'], ['load', 'gate']]

ok(errs.length === 0, '无控制台报错' + (errs[0] ? ':' + errs[0].slice(0, 120) : ''))
ok((await st()).machines.every(m => m.broken), '开局三台机器都坏了')

// —— DNS:走过去 → 进入 → 真维修解开 → 出来变已修 ——
await walk(900); await p.waitForTimeout(1500)
ok((await st()).near === 'dns', '走到 DNS 查名机旁(镜头跟随、靠近提示)')
await p.evaluate(() => window.__enter()); let s = await st()
ok(s.entered === 'dns' && s.repair && s.repair.fault, `进入 DNS 维修(真 DnsRepair,随机故障=${s.repair.fault})`)
for (const [t, part] of solve(s.repair.fault)) await rep(t, part)
await p.waitForTimeout(200); s = await st()
ok(s.repair.won, `对症修好 DNS(${s.repair.fault})→ 网页通了`)
await p.screenshot({ path: SHOT + '/factory-repair-win.png' })
await p.evaluate(() => window.__exit()); s = await st()
ok(!s.entered && !s.machines.find(m => m.id === 'dns').broken, '返回巡线,DNS 变「已修」(绿✓)')
await p.screenshot({ path: SHOT + '/factory-fixed.png' })

// —— TCP / IP:占位维修(进入 → 点一下修好)——
for (const [x, id] of [[2500, 'tcp'], [4100, 'ip']]) {
  await p.evaluate(x => window.__teleport(x), x); await p.waitForTimeout(300)
  await p.evaluate(() => window.__enter()); s = await st()
  ok(s.entered === id, `走到并进入 ${id.toUpperCase()}`)
  await p.mouse.click(640, 360); await p.waitForTimeout(150); s = await st()
  ok(!s.entered && !s.machines.find(m => m.id === id).broken, `${id.toUpperCase()} 占位修好、返回巡线`)
}
s = await st()
ok(s.machines.every(m => !m.broken), '三台全修好 = 全线通(闭环跑通:巡线→进机器→修好→下一台)')

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
