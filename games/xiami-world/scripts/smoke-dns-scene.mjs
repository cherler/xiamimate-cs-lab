import { chromium } from 'playwright'
const URL = 'http://localhost:5180/?scripted=1'
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(900)
await p.evaluate(() => window.__game.scene.start('DnsScene', { level:false })); await p.waitForTimeout(700)
await p.evaluate(() => window.__game.scene.getScene('DnsScene').sim.clear('all'))
const st = () => p.evaluate(() => window.__dnsScene)
const notes = () => p.evaluate(() => { const sc=window.__game.scene.getScene('DnsScene'); const o={}; sc.notes.forEach((t,k)=>o[k]=t.text); return o })

ok(errs.length === 0, `无控制台报错${errs.length ? '：'+errs[0].slice(0,120) : ''}`)
ok((await st()).scene === 'DnsScene', '进入 DNS 活场景')

// 查询前缓存空
let n = await notes()
ok(n['browser-cache'] === '（空）', '查询前浏览器缓存记事本是空的')

// 发起查询 → 信使跑通 → 缓存写进记事本
await p.mouse.click(100, 680); await p.waitForTimeout(4200)
let s = await st()
ok(s.lastCorrect === true && s.timelineLen === 7, `信使跑完全程7跳、成功（${s.timelineLen}跳）`)
n = await notes()
ok(n['browser-cache'].includes('example.com') && n['browser-cache'].includes('3600'),
   '查询后浏览器缓存记事本出现 example.com + TTL')

// 快进2小时 → TTL 过期 → 记事本清空
await p.mouse.click(516, 628); await p.mouse.click(516, 628); await p.waitForTimeout(300)
n = await notes()
ok(n['browser-cache'] === '（空）', '快进2小时后缓存过期、记事本清空（S2 深度肉眼可见）')

// 演示弄坏 → 信使卡在递归、红
await p.mouse.click(262, 680); await p.waitForTimeout(200)
await p.mouse.click(100, 680); await p.waitForTimeout(2500)
s = await st()
ok(s.lastCorrect === false && s.curHop === 'recursive', '弄坏后信使卡在递归站（curHop=recursive、失败）')

// 自检：这条能红——把弄坏换成正常查询，curHop 应到 authoritative
await p.mouse.click(424, 680); await p.waitForTimeout(200)  // 重置
await p.mouse.click(100, 680); await p.waitForTimeout(4000)
s = await st()
ok(s.curHop === 'authoritative' && s.lastCorrect === true, '重置后正常查询走到权威（证明"卡住"判据能区分）')

await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
