import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://localhost:${PORT}/card-demo.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(700)
const dm = () => p.evaluate(() => window.__demo)
const cmb = () => p.evaluate(() => window.__demo.cmb)
const playType = (t, l) => p.evaluate(([t, l]) => window.__cmbPlayType(t, l), [t, l])
const endTurn = () => p.evaluate(() => window.__cmbEnd())
const pickReward = t => p.evaluate(t => window.__cmbReward(t), t)
const sleep = ms => p.waitForTimeout(ms)
const brokenN = s => s.layers.filter(l => l.broken || l.decay > 0).length

let sawMulti = false, bossShot = false
async function driveOneStage(maxTurns) {
  for (let t = 0; t < maxTurns; t++) {
    let s = await cmb(); if (!s || s.won || s.lost) break
    if (brokenN(s) >= 2 && s.hand.some(h => h.type === 'k-aoe' && h.playable)) { await playType('k-aoe', null); await sleep(12); s = await cmb() }
    for (const l of s.layers) {
      if (!(l.broken || l.decay > 0)) continue
      const ct = l.counterType
      if (ct && s.hand.some(h => h.type === ct && h.playable)) await playType(ct, l.key)
      else if (s.hand.some(h => h.type === 'k-chain' && h.playable)) await playType('k-chain', l.key)
      else if (s.hand.some(h => h.type === 'quickfix' && h.playable)) await playType('quickfix', l.key)
      await sleep(12); s = await cmb(); if (!s || s.won || s.lost) break
    }
    s = await cmb(); if (!s || s.won || s.lost) break
    if (s.intentBoss && s.hand.some(h => h.type === 'k-bulwark' && h.playable)) await playType('k-bulwark', null)
    if (s.clock >= 45 && s.hand.some(h => h.type === 'k-buffer' && h.playable)) await playType('k-buffer', null)
    await endTurn(); await sleep(30)
    const c1 = await cmb()
    if (c1 && c1.enemyCards.length >= 2) { sawMulti = true; if (!bossShot) { await sleep(120); await p.screenshot({ path: SHOT + '/combat-boss.png' }); bossShot = true } }
  }
}

// —— 路由器副本:弧线三关 + 真求解器判 ——
await p.evaluate(() => window.__startCombat()); await sleep(500)
let s = await cmb(), d = (await dm()).dg
ok(errs.length === 0, '无控制台报错' + (errs[0] ? ':' + errs[0].slice(0, 140) : ''))
ok(!!d && d.dom === 'net' && d.stage === 0, `进路由器副本·第 1 关(小怪波),stage=${d?.stage}`)
ok(!!s && s.enemyCards.length >= 1, `开局亮出破坏卡:${s?.enemyCards[0]}`)
ok(!!s && !!s.metric, `DnsSim 真判读上屏:${s?.metric}`)
const hit = s.layers.find(l => l.broken || l.decay > 0)
ok(!!hit && !!hit.attack && !!hit.counter, `受创层写明破坏卡+对症卡:${hit?.name} 被【${hit?.attack}】→ 对症【${hit?.counter}】`)
await p.screenshot({ path: SHOT + '/combat-enemycard.png' })

let maxStage = 0, cleared = false, rewardShot = false
for (let round = 0; round < 5; round++) {
  await driveOneStage(30)
  const dg = (await dm()).dg; if (!dg) break
  maxStage = Math.max(maxStage, dg.stage)
  if (dg.cleared) { cleared = true; break }
  if (dg.reward) {
    if (!rewardShot) { await sleep(150); await p.screenshot({ path: SHOT + '/combat-reward.png' }); rewardShot = true }
    const kw = dg.reward.find(t => t.startsWith('k-'))
    await pickReward(kw || dg.reward[0]); await sleep(250)
  } else break // 输了这一关
}
ok(sawMulti, 'Boss/精英 一回合连打多层(见到 ≥2 张破坏卡同时砸下)')
ok(maxStage >= 2 || cleared, `弧线推进到 Boss 关(打到 stage ${maxStage}${cleared ? ' · 通关' : ' · 倒在半路,平衡不再一路平推'})`)

// —— 冰箱副本:同引擎换领域 + solveThermal 真判 ——
await p.evaluate(() => window.__startDungeon('fridge')); await sleep(450)
s = await cmb(); d = (await dm()).dg
ok(!!d && d.dom === 'fridge', '进冰箱副本(同引擎换领域)')
ok(!!s && !!s.metric && s.metric.includes('℃'), `solveThermal 真算柜内温度上屏:${s?.metric}`)
const fh = s.layers.find(l => l.broken || l.decay > 0)
ok(!!fh && !!fh.attack && !!fh.counter, `冰箱破坏卡+对症卡:${fh?.name} 被【${fh?.attack}】→ 对症【${fh?.counter}】`)
ok(s.layers.some(l => l.name.includes('散热') || l.name.includes('门封') || l.name.includes('压缩机')), '冰箱盘面是冷链五环')
await sleep(150); await p.screenshot({ path: SHOT + '/combat-fridge.png' })

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
