import { chromium } from 'playwright'
const URL = 'http://localhost:5180/?craft'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(900)

const st = () => p.evaluate(() => window.__craftState)
const sc = () => p.evaluate(() => window.__game.scene.getScene('Craft'))
const add = (n) => p.evaluate((n) => window.__game.scene.getScene('Craft').benchAdd(n), n)
const clr = () => p.evaluate(() => window.__game.scene.getScene('Craft').clearBench())
const react = () => p.evaluate(() => {
  const r = window.__game.scene.getScene('Craft').fireReact()
  return { ok: r.ok, out: r.ok ? r.reaction.output : null, reason: r.ok ? null : r.reason, already: r.ok ? r.already : null }
})
const owns = (n) => p.evaluate((n) => window.__game.scene.getScene('Craft').getEngine().owns(n), n)
// 等变态动画走完(busy→false),不死等
const idle = async () => { for (let i = 0; i < 40; i++) { if (!(await st()).busy) return; await p.waitForTimeout(100) } }

ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
let s = await st()
ok(s && s.scene === 'Craft', '进入反应台场景')
ok(s.total === 151 && s.made === 0, `起手 0/${s.total} 已点亮`)

// ① 正确合成:电平 + 时间 → 信号
await add('电平'); await add('时间')
s = await st(); ok(s.bench.length === 2 && s.bench.includes('电平') && s.bench.includes('时间'), '两样原子进了反应台')
await p.screenshot({ path: SHOT + '/craft-bench.png' }) // 料在台上
let r = await react()
ok(r.ok && r.out === '信号', '电平+时间 → 信号(反应成功)')
await idle() // 等变态动画走完
ok(await owns('信号'), '合成后库存里有了 信号')
s = await st(); ok(s.made === 1, '进度 1/151')
await p.screenshot({ path: SHOT + '/craft-made.png' }) // 变态后产物卡

// ② 错配:比特 + 密钥 → 无反应(懂才能合)
await add('比特'); await add('密钥')
r = await react()
ok(!r.ok && r.reason === 'no-reaction', '比特+密钥 → 无反应(不是硬拼形状)')
s = await st(); ok(s.made === 1, '错配不涨进度')
await clr()

// ③ 两级链:自造的 信号 + 比特 → 码元
await add('信号'); await add('比特')
r = await react()
ok(r.ok && r.out === '码元', '信号(自造)+比特 → 码元(两级链,自造件当原料)')
await idle()
s = await st(); ok(s.made === 2, '进度 2/151')

// ④ 差一味:标识 + 比特(还差 固化)→ incomplete
await add('标识'); await add('比特')
r = await react()
ok(!r.ok && r.reason === 'incomplete', '标识+比特 → 还差一味(incomplete)')
await clr()

// ⑤ 补齐 → MAC地址(落地"标识是唯一地址原子")
await add('标识'); await add('比特'); await add('固化')
r = await react()
ok(r.ok && r.out === 'MAC地址', '标识+比特+固化 → MAC地址(地址是反应不是原子)')
await idle()

// 自检:判据能区分对错——①给 ok=true 且产物对,②给 ok=false/no-reaction,已两向覆盖。
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
