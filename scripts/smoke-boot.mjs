import { chromium } from 'playwright'
const URL = 'http://localhost:5180/'
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(URL, { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
ok(await p.locator('canvas').count() > 0, 'Phaser canvas 存在')
const state = await p.evaluate(() => {
  const g = window.__game
  if (!g) return { ready: false }
  const boot = g.scene.getScene('Boot')
  return { ready: !!g.isBooted, hasBoot: !!boot, active: g.scene.isActive('Boot') }
})
ok(state.ready, '游戏已启动（isBooted）')
ok(state.hasBoot && state.active, 'Boot 场景在跑')
await p.screenshot({ path: 'scripts/shot-boot.png' })
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
