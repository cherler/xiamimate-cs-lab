import { chromium } from 'playwright'
const SHOT = '/private/tmp/claude-501/-Users-liuzhenhai-projects-xiamimate/189a1dc3-5374-4dac-bc37-f53e9009146c/scratchpad'
const PORT = process.env.PORT || 5183
let pass = 0, fail = 0; const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto(`http://localhost:${PORT}/build.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
const st = () => p.evaluate(() => window.__state())
// 在页面里注册铺设助手
await p.evaluate(() => {
  window.__belts = (r, c1, c2, dir) => { for (let c = c1; c <= c2; c++) window.__place(r, c, 'belt', dir) }
  window.__vbelts = (c, r1, r2, dir) => { const a = Math.min(r1, r2), z = Math.max(r1, r2); for (let r = a; r <= z; r++) window.__place(r, c, 'belt', dir) }
})
const load = (i) => p.evaluate((i) => window.__level(i), i)
const runN = (n) => p.evaluate((n) => { window.__run(); window.__stepN(n) }, n)
ok(errs.length === 0, '无控制台报错' + (errs[0] ? ':' + errs[0].slice(0, 120) : ''))

// 第1关 路由器分拣:△上口 ○下口(路由器默认三向:△左=上 ○右=下)
await load(0)
await p.evaluate(() => {
  const P = window.__place; window.__belts(3, 1, 5, 0); P(3, 6, 'router', 0)
  P(2, 6, 'belt', 3); window.__belts(1, 6, 10, 0)           // △→上→r1
  P(4, 6, 'belt', 1); window.__belts(5, 6, 10, 0)           // ○→下→r5
})
await runN(120); let s = await st()
ok(s.done && s.pass && s.deliveredBy[0] === 3 && s.deliveredBy[1] === 3, `L1 路由器分拣 △上3/○下3=通过(by=${JSON.stringify(s.deliveredBy)}, parts=${s.parts}, cyc=${s.cycles})`)
await p.screenshot({ path: SHOT + '/lv1.png' })
// 反例:路由器设成「△挑向左」→ ○也走直(右)不下去 → 失败
await p.evaluate(() => { window.__reset(); window.__place(3, 6, 'router', 0, 1) })
await runN(120); s = await st()
ok(s.done && !s.pass, `L1 路由器换错模式(△挑左)→○不进下口→失败(wrong=${s.wrong},lost=${s.lost})`)

// 第2关 复制广播:复制器朝右→上下各一份→直接进上口/下口
await load(1)
await p.evaluate(() => {
  const P = window.__place; window.__belts(3, 1, 5, 0); P(3, 6, 'copier', 0)  // T型:上下各一份
  P(2, 6, 'belt', 3); window.__belts(1, 6, 10, 0)           // 上份→r1
  P(4, 6, 'belt', 1); window.__belts(5, 6, 10, 0)           // 下份→r5
})
await runN(120); s = await st()
ok(s.done && s.pass && s.deliveredBy[0] === 4 && s.deliveredBy[1] === 4, `L2 复制广播 两口各4=通过(by=${JSON.stringify(s.deliveredBy)}, parts=${s.parts})`)
// 失控保护:复制器某出口把包送回进料带→接成环→无限增殖 → 必须快速判失败,不能永远转
await p.evaluate(() => { window.__reset(); for (let c = 1; c <= 4; c++) window.__place(3, c, 'belt', 0); window.__place(3, 5, 'copier', 1) })
await runN(200); s = await st()
ok(s.done && !s.pass && s.cycles <= 300, `L2 复制器接成环→失控保护快速判失败(overflowed=${s.overflowed}, cyc=${s.cycles})`)

// 第3关 缓存命中:见过→上快线 没见过→右查号
await load(2)
await p.evaluate(() => {
  const P = window.__place; window.__belts(3, 1, 5, 0); P(3, 6, 'cache', 0)
  P(2, 6, 'belt', 3); window.__belts(1, 6, 10, 0)           // 见过→上→快线 r1
  P(3, 7, 'belt', 1); P(4, 7, 'belt', 1); window.__belts(5, 7, 10, 0)  // 没见过→右→下→查号 r5
})
await runN(120); s = await st()
ok(s.done && s.pass && s.deliveredBy[0] === 3 && s.deliveredBy[1] === 2, `L3 缓存 快线3/查号2=通过(by=${JSON.stringify(s.deliveredBy)})`)

// 第4关 缓冲队列(排序):乱序进→排序模式→按序出
await load(3)
await p.evaluate(() => { const P = window.__place; window.__belts(3, 1, 5, 0); P(3, 6, 'queue', 0, 1); window.__belts(3, 7, 10, 0) })
await runN(160); s = await st()
ok(s.done && s.pass && s.deliveredBy[0] === 4, `L4 缓冲队列排序 按序4=通过(by=${JSON.stringify(s.deliveredBy)}, wrong=${s.wrong})`)
// 反例:队列切「限速」FIFO→乱序原样出→按序口失败
await p.evaluate(() => { window.__reset(); window.__place(3, 6, 'queue', 0, 0) })
await runN(160); s = await st()
ok(s.done && !s.pass, `L4 队列换「限速」→乱序原样出→失败(wrong=${s.wrong})`)

// 第5关 缓存+路由(组合):见过→快线;没见过→路由器分△站/○站
await load(4)
await p.evaluate(() => {
  const P = window.__place; window.__belts(4, 1, 3, 0); P(4, 4, 'cache', 0)
  window.__vbelts(4, 1, 3, 3); window.__belts(0, 4, 10, 0)  // 见过→上(c4)→r0 快线
  P(4, 5, 'router', 0)                                       // 没见过→右→路由器
  P(3, 5, 'belt', 3); window.__belts(2, 5, 10, 0)           // △→上→r2 △站
  P(5, 5, 'belt', 1); window.__belts(6, 5, 10, 0)           // ○→下→r6 ○站
})
await runN(140); s = await st()
ok(s.done && s.pass && JSON.stringify(s.deliveredBy) === '[3,1,1]', `L5 缓存+路由 快线3/△1/○1=通过(by=${JSON.stringify(s.deliveredBy)}, parts=${s.parts})`)
await p.screenshot({ path: SHOT + '/lv5.png' })

// 第6关 拥塞削平(路由+队列):峰值分流后各接「限速」队列削成1/拍
await load(5)
await p.evaluate(() => {
  const P = window.__place; P(3, 1, 'belt', 0); P(3, 2, 'router', 0)
  P(2, 2, 'belt', 3); P(1, 2, 'queue', 0, 0); window.__belts(1, 3, 10, 0)  // △→上→限速队列→r1
  P(4, 2, 'belt', 1); P(5, 2, 'queue', 0, 0); window.__belts(5, 3, 10, 0)  // ○→下→限速队列→r5
})
await runN(120); s = await st()
ok(s.done && s.pass && s.deliveredBy[0] === 2 && s.deliveredBy[1] === 2 && s.lost === 0, `L6 拥塞 路由+限速队列 △2/○2 零丢=通过(by=${JSON.stringify(s.deliveredBy)}, lost=${s.lost}, parts=${s.parts})`)
await p.screenshot({ path: SHOT + '/lv6.png' })
// 反例:队列用「排序」模式→△支只见0,2缺号卡住→△站收不满→失败
await p.evaluate(() => { window.__reset(); window.__place(1, 2, 'queue', 0, 1); window.__place(5, 2, 'queue', 0, 1) })
await runN(120); s = await st()
ok(s.done && !s.pass && s.stuck && s.cycles < 60, `L6 队列用「排序」→缺号卡死→快速判失败(stuck=${s.stuck}, cyc=${s.cycles}, by=${JSON.stringify(s.deliveredBy)})`)

// 第7关 广播+分拣(组合):复制器上下各一份,上份存档,下份交路由分△站/○站
await load(6)
await p.evaluate(() => {
  const P = window.__place; P(3, 1, 'belt', 0); P(3, 2, 'copier', 0)      // T型:上下各一份
  P(2, 2, 'belt', 3); window.__belts(1, 2, 10, 0)           // 上份→存档 r1
  P(4, 2, 'belt', 1); P(5, 2, 'belt', 0); P(5, 3, 'router', 0)  // 下份→下→右→路由器 r5c3
  P(4, 3, 'belt', 3); window.__belts(3, 3, 10, 0)           // △→上→r3 △站
  P(6, 3, 'belt', 1); window.__belts(7, 3, 10, 0)           // ○→下→r7 ○站
})
await runN(140); s = await st()
ok(s.done && s.pass && JSON.stringify(s.deliveredBy) === '[4,2,2]', `L7 广播+分拣 存档4/△2/○2=通过(by=${JSON.stringify(s.deliveredBy)}, parts=${s.parts})`)
await p.screenshot({ path: SHOT + '/lv7.png' })

// 终关 输入网址回车:缓存+路由全拼
await p.evaluate(() => window.__play(7))
await p.evaluate(() => {
  const P = window.__place; window.__belts(4, 1, 3, 0); P(4, 4, 'cache', 0)
  window.__vbelts(4, 1, 3, 3); window.__belts(1, 4, 10, 0)  // 见过→上(c4)→r1 快线
  P(4, 5, 'router', 0)
  P(3, 5, 'belt', 3); window.__belts(2, 5, 10, 0)           // △→上→r2 △站
  P(5, 5, 'belt', 1); window.__belts(6, 5, 10, 0)           // ○→下→r6 ○站
})
await runN(180); s = await st()
ok(s.done && s.pass && JSON.stringify(s.deliveredBy) === '[5,1,1]', `终关 快线5/△1/○1=通过(by=${JSON.stringify(s.deliveredBy)}, parts=${s.parts}, cyc=${s.cycles})`)
await p.screenshot({ path: SHOT + '/build-final.png' })
await p.waitForTimeout(1200); await p.screenshot({ path: SHOT + '/build-finale-win.png' })

// 甲·线速样板:两股等长汇入同一格 → 撞包(证明新机制:一格一拍只容一个包)
await p.evaluate(() => window.__play(8))
await p.evaluate(() => {
  const P = window.__place
  window.__belts(3, 1, 5, 0); P(3, 6, 'belt', 1)  // A(r3)→右到c6→下汇入 r4c6
  window.__belts(5, 1, 5, 0); P(5, 6, 'belt', 3)  // B(r5)→右到c6→上汇入 r4c6(等长)
  window.__belts(4, 6, 10, 0)                       // r4 → 存档
})
await runN(80); s = await st()
ok(s.done && !s.pass && s.collided, `甲 双路等长汇入→撞包判失败(collided=${s.collided}, lost=${s.lost}, cyc=${s.cycles})`)
await p.screenshot({ path: SHOT + '/jia-collide.png' })
// 修:A 支上放个〈缓冲队列〉切限速,错开一拍 → 两股交替并入,不撞
await p.evaluate(() => { window.__reset(); window.__erase(3, 5); window.__place(3, 5, 'queue', 0, 0) })
await runN(80); s = await st()
ok(s.done && s.pass && s.deliveredBy[0] === 8, `甲 A支加限速队列错峰→交替汇入→通过(by=${JSON.stringify(s.deliveredBy)}, cyc=${s.cycles})`)
await p.screenshot({ path: SHOT + '/jia-pass.png' })

// 甲2 双源按序汇入:限速错峰并一道 + 排序把号理顺 → 按序存档
await p.evaluate(() => window.__play(9))
await p.evaluate(() => {
  const P = window.__place
  window.__belts(3, 1, 4, 0); P(3, 5, 'belt', 1)               // A(r3 偶数)→c5→下 → r4c5
  window.__belts(5, 1, 4, 0); P(5, 5, 'queue', 3, 0)           // B(r5 奇数)→限速队列(朝上)错峰 → r4c5
  P(4, 5, 'belt', 0); P(4, 6, 'belt', 0)                        // 合流一道
  P(4, 7, 'queue', 0, 1); window.__belts(4, 8, 10, 0)          // 排序队列把号理顺 → 按序存档 r4
})
await runN(160); s = await st()
ok(s.done && s.pass && s.deliveredBy[0] === 8 && !s.collided, `甲2 双源按序汇入 限速错峰+排序=通过(by=${JSON.stringify(s.deliveredBy)}, wrong=${s.wrong}, cyc=${s.cycles})`)
await p.screenshot({ path: SHOT + '/jia2.png' })
// 反例:第二个队列也用「限速」(不排序)→ 乱序进按序口 → 失败
await p.evaluate(() => { window.__reset(); window.__place(4, 7, 'queue', 0, 0) })
await runN(160); s = await st()
ok(!s.pass && s.deliveredBy[0] < 8, `甲2 第二队列不排序→乱序进按序口→不通过(by=${JSON.stringify(s.deliveredBy)}, wrong=${s.wrong})`)

// 甲3 汇入三向分拣:两股限速错峰并一道 → 路由器三向分到 △/□/○ 站
await p.evaluate(() => window.__play(10))
await p.evaluate(() => {
  const P = window.__place
  window.__belts(3, 1, 4, 0); P(3, 5, 'belt', 1)               // A(r3)→c5→下 → r4c5
  window.__belts(5, 1, 4, 0); P(5, 5, 'queue', 3, 0)           // B(r5)→限速队列(朝上)错峰 → r4c5
  P(4, 5, 'belt', 0); P(4, 6, 'belt', 0); P(4, 7, 'router', 0) // 合流一道 → 路由器
  P(3, 7, 'belt', 3); window.__belts(2, 7, 10, 0)              // △→上→r2 △站
  window.__belts(4, 8, 10, 0)                                   // □→直→r4 □站
  P(5, 7, 'belt', 1); window.__belts(6, 7, 10, 0)              // ○→下→r6 ○站
})
await runN(160); s = await st()
ok(s.done && s.pass && JSON.stringify(s.deliveredBy) === '[2,2,2]', `甲3 汇入三向分拣 △2/□2/○2=通过(by=${JSON.stringify(s.deliveredBy)}, collided=${s.collided}, cyc=${s.cycles})`)
await p.screenshot({ path: SHOT + '/jia3.png' })

// 真·路由器 按址转发:搭一棵转发树,一位一位看地址,把 0/1/2/3 各归网段
await p.evaluate(() => window.__play(11))
await p.evaluate(() => {
  const P = window.__place
  P(3, 1, 'belt', 0); P(3, 2, 'belt', 0); P(3, 3, 'arouter', 0, 1)  // 看高位:{0,1}→右 {2,3}→上
  P(3, 4, 'belt', 0); P(3, 5, 'arouter', 1, 0)                       // {0,1} 看低位(朝下):0→下 1→右
  window.__belts(4, 5, 10, 0)                                         // addr0 → 下 → r4 网段0
  window.__belts(3, 6, 10, 0)                                         // addr1 → 右 → r3 网段1
  P(2, 3, 'belt', 3); P(1, 3, 'arouter', 0, 0)                       // {2,3} 上 → 看低位:2→右 3→上
  window.__belts(1, 4, 10, 0)                                         // addr2 → 右 → r1 网段2
  P(0, 3, 'belt', 0); window.__belts(0, 4, 10, 0)                    // addr3 → 上 → r0 网段3
})
await runN(160); s = await st()
ok(s.done && s.pass && JSON.stringify(s.deliveredBy) === '[2,2,2,2]', `真路由器 按址转发 四网段各2=通过(by=${JSON.stringify(s.deliveredBy)}, wrong=${s.wrong}, cyc=${s.cycles})`)
await p.screenshot({ path: SHOT + '/router-real.png' })

await b.close(); console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0)
