import { chromium } from 'playwright'
const URL = 'http://localhost:5180/?scripted=1'
let pass = 0, fail = 0
const ok = (c, w) => { if (c) { pass++; console.log('  ✅ ' + w) } else { fail++; console.log('  ❌ ' + w) } }
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(URL, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.removeItem('xiami.progress'))
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
// 点路由器 → 钻进去
await p.mouse.click(797, 297); await p.waitForTimeout(300)
await p.mouse.click(1090, 302); await p.waitForTimeout(500)
ok(errs.length === 0, `无控制台报错${errs.length ? '：' + errs[0].slice(0, 140) : ''}`)
ok(await p.evaluate(() => window.__netState?.scene) === 'NetCase', '进入网络关')
// 押注面板该弹出来
await p.waitForTimeout(700)
ok(await p.evaluate(() => window.__netState?.guess) === null, '动手前还没押')
await p.mouse.click(537, 404); await p.waitForTimeout(350)
ok(await p.evaluate(() => window.__netState?.guess) === 'down', '押了「网断了」')
// 密：网没断，但网页打不开
let st = await p.evaluate(() => window.__netState)
ok(st.pingOk === true, 'IP 直连是通的（游戏没事）—— 网没断')
ok(st.siteOpen === false, '同一时刻网页打不开 —— 这就是这一关的密')
// 动手三件
await p.mouse.click(250, 470); await p.waitForTimeout(320)
await p.mouse.click(250, 530); await p.waitForTimeout(320)
st = await p.evaluate(() => window.__netState)
ok(st.done['ping-ip'] && st.done.resolve, '量过 IP、也解析过')
ok(st.dns === '192.168.1.1', '这时还用着路由器的 DNS')
// 换 DNS → 修好
await p.mouse.click(250, 590); await p.waitForTimeout(350)
st = await p.evaluate(() => window.__netState)
ok(st.dns === '223.5.5.5', '换成了公共 DNS')
ok(st.siteOpen === true, '换完网页能开了')
// 回房子 + 持久化
await p.mouse.click(1130, 660); await p.waitForTimeout(450)
ok(await p.evaluate(() => !!window.__houseState), '回到了房子')
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900)
const fixed = await p.evaluate(() => JSON.parse(localStorage.getItem('xiami.progress') || '{}').fixed || [])
ok(fixed.includes('router'), '刷新后仍记得路由器修好了（存下来了）')
// 自检：清进度就该忘掉
await p.evaluate(() => localStorage.removeItem('xiami.progress'))
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900)
const after = await p.evaluate(() => JSON.parse(localStorage.getItem('xiami.progress') || '{}').fixed || [])
ok(!after.includes('router'), '清进度后忘掉（自检：持久化能判红）')
await b.close()
console.log(`\n${pass} ✅  ${fail} ❌`)
process.exit(fail ? 1 : 0)
