import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://localhost:${PORT}/poison.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(300)
const st = () => p.evaluate(() => window.__state())
const set = (v, m) => p.evaluate(([v, m]) => window.__set(v, m), [v, m])
const mode = m => p.evaluate(m => window.__mode(m), m)
const wait = ms => p.waitForTimeout(ms)

await p.evaluate(() => { window.__reset(); window.__level(9999, 9999) }) // 中和关卡阈值,只测机关本身
ok(errs.length === 0, '无控制台报错' + (errs[0] ? ':' + errs[0].slice(0, 120) : ''))
let s = await st(); ok(s.w === 0 && s.success === 0 && s.mode === 'hold', '开局:桶空、成功0、阀在停')

// 反转+因果链:灌毒 → 桶重 → 升降台升(w 升 = 台升)
await mode('fill'); await wait(1100); s = await st()
ok(s.w > 10, `灌紫毒→配重变重→升降台上升(w=${s.w},毒就是动力=反转)`)

// 过冲受罚:逼近红线还猛灌 → 撞顶甩飞、归零重来
await set(88, 'fill'); await wait(500); s = await st()
ok(s.fails >= 1 && s.w < 60, `灌过头冲过红线→核心甩飞、桶归零(失败=${s.fails}, w=${s.w})`)

// 可预演·预告落点:同一位置不同阀档,幽灵判词不同
await set(80, 'fill'); s = await st(); ok(s.forecast === 'over', `预演:w=80还在灌→会冲过红线(判词=${s.forecast}/红)`)
await set(80, 'hold'); s = await st(); ok(s.forecast === 'ok', `预演:w=80改停→稳在窗口里(判词=${s.forecast}/青)`)
await set(30, 'hold'); s = await st(); ok(s.forecast === 'short', `预演:w=30停着→到不了窗口(判词=${s.forecast}/黄)`)
await p.evaluate(() => window.__ghost(false)); s = await st(); ok(s.ghost === false, '预演可关(G)——关掉后 ghost=false')
await p.evaluate(() => window.__ghost(true))

// 成功:核心停在青窗口里稳住~2.5s → 滚上出闸台、掉素材
await set(84, 'hold') // 从窗口顶(84)起步:渗漏 -6/s,2 秒内 84→72 仍在窗口 → held 攒够
const suc0 = (await st()).success, sh0 = (await st()).shards
await wait(2600); s = await st()
ok(s.success > suc0 && s.shards > sh0, `核心在窗口里顶住→出闸成功、掉维修素材(成功=${s.success}, 素材=${s.shards})`)
await p.screenshot({ path: SHOT + '/poison-run.png' })

// H 慢降:松开后核心慢慢落回(不再有快排 D)
await set(80, 'hold'); await wait(1500); s = await st()
ok(s.w < 80, `H(慢降):松开→配重慢慢变轻→升降台缓缓落(w=${s.w})`)

// —— 关卡:赢(顶两枚核心出闸→开门)——
await p.evaluate(() => { window.__reset(); window.__level(2, 9) })
await set(84, 'hold'); await wait(2600)
await set(84, 'hold'); await wait(2600); s = await st()
ok(s.level.state === 'win', `顶两枚核心进窗口稳住→门开=赢(state=${s.level.state}, progress=${s.level.progress})`)
// —— 关卡:输(冲过红线甩飞到上限)——
await p.evaluate(() => { window.__reset(); window.__level(9, 3) })
for (let i = 0; i < 3; i++) { await set(90, 'fill'); await wait(400) }
s = await st()
ok(s.level.state === 'lose', `连着冲过红线甩飞到上限=输(state=${s.level.state}, fail=${s.level.fail})`)

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
