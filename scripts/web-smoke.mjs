/**
 * 视图层冒烟测试：三个实验 + 参数联动 + 违规拦截 + 单向数据流。
 * 「做完就测」—— 前端必须进浏览器量数字，不能只看代码。
 *   node scripts/web-smoke.mjs [url]
 */
import { chromium } from 'playwright'

const URL = process.argv[2] ?? 'http://localhost:5178/'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewportSize: { width: 1460, height: 1080 }, deviceScaleFactor: 2 })

const errs = []
p.on('pageerror', e => errs.push('pageerror: ' + e.message))
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
p.on('response', r => { if (r.status() === 404) errs.push('404: ' + r.url()) })

let fail = 0
const ok = m => console.log(`  ✅ ${m}`)
const bad = m => { fail++; console.log(`  ❌ ${m}`) }

const snap = () => p.evaluate(() => ({
  title: document.querySelector('.top h1')?.textContent,
  chip: [...document.querySelectorAll('.chip')].map(c => c.textContent).join(' | '),
  tabs: [...document.querySelectorAll('.tabs button')].map(t => t.textContent),
  readouts: [...document.querySelectorAll('.pr')].map(r =>
    r.querySelector('.k')?.textContent + '=' + r.querySelector('.v')?.textContent),
  ticks: document.querySelectorAll('.tick').length,
  curTick: document.querySelector('.tick.cur')?.getAttribute('aria-label'),
  logRows: document.querySelectorAll('.log li').length,
  curLog: document.querySelector('.log li.cur .x')?.textContent?.slice(0, 34),
  bounds: document.querySelector('.bounds p')?.textContent?.slice(0, 28),
  violations: document.querySelectorAll('.viol').length,
  activeParams: [...document.querySelectorAll('.opts button.on')].map(x => x.textContent).join(','),
}))

await p.goto(URL, { waitUntil: 'networkidle' })
await p.waitForSelector('.tick')

console.log('\n【1】三个实验都能起来，且各自的舞台不同')
for (const [i, name] of [['Cache 命中率'], ['进程调度甘特图'], ['TCP 拥塞窗口']].entries()) {
  await p.click(`.nav button >> nth=${i}`)
  await p.waitForTimeout(200)
  const s = await snap()
  const shot = ['cache', 'sched', 'tcp'][i]
  await p.screenshot({ path: `/tmp/web-${shot}.png`, fullPage: true })
  s.title === name[0] && s.ticks > 0 && s.logRows > 0 && s.bounds
    ? ok(`${name[0].padEnd(12)} ${s.ticks} 步 · tab[${s.tabs.join('/')}] · 有边界栏`)
    : bad(`${name[0]} 起不来：${JSON.stringify(s)}`)
}

console.log('\n【2】验收标准 3：改一个状态，多个视图一起变（视图之间零互写）')
await p.click('.nav button >> nth=0')
await p.waitForTimeout(200)
const a = await snap()
await p.click('.tick >> nth=5')
await p.waitForTimeout(200)
const c = await snap()
const changed = ['readouts', 'curTick', 'curLog'].filter(k => JSON.stringify(a[k]) !== JSON.stringify(c[k]))
changed.length === 3
  ? ok(`点第 6 个刻度 → 读数 / 轴 / 日志 三处同时更新`)
  : bad(`只有 ${changed.join(',')} 变了，应当三处都变`)

const cellState = await p.evaluate(() => ({
  touched: document.querySelectorAll('.cell.touched').length,
  activeRow: document.querySelectorAll('.setrow.active').length,
  linkPath: !!document.querySelector('.stage svg path'),
  bitSegs: document.querySelectorAll('.seg').length,
}))
cellState.touched === 1 && cellState.activeRow === 1 && cellState.linkPath && cellState.bitSegs === 3
  ? ok('舞台同步：位域三段 · 高亮组 1 行 · 命中格 1 个 · 正交连线已画')
  : bad(`舞台没同步：${JSON.stringify(cellState)}`)

console.log('\n【3】参数改动 → 重跑仿真')
const before = await snap()
await p.click('.opts button:has-text("FIFO")')
await p.waitForTimeout(250)
const afterPolicy = await snap()
afterPolicy.activeParams.includes('FIFO') && JSON.stringify(afterPolicy.readouts) !== JSON.stringify(before.readouts)
  ? ok(`LRU → FIFO：参数高亮跟随，读数重算（${before.activeParams} → ${afterPolicy.activeParams}）`)
  : bad(`换替换策略没生效：${afterPolicy.activeParams}`)

await p.click('.opts button:has-text("LRU")')
await p.click('.param:has-text("相联度") .opts button:has-text("8")')
await p.waitForTimeout(250)
const afterWay = await snap()
afterWay.activeParams.includes('8')
  ? ok(`相联度 → 8 路：${afterWay.activeParams}`)
  : bad(`换相联度没生效：${afterWay.activeParams}`)

console.log('\n【4】验证器直通 UI：非法配置必须被拦住并说清楚')
// 容量 128 / 块 64 / 8 路 → 组数 = 128/64/8 = 0.25，非法
await p.click('.param:has-text("Cache 容量") .opts button:has-text("128")')
await p.click('.param:has-text("块大小") .opts button:has-text("64")')
await p.waitForTimeout(250)
const v = await snap()
await p.screenshot({ path: '/tmp/web-violation.png', fullPage: true })
v.violations > 0 && v.chip.includes('配置不合法')
  ? ok(`容量128/块64/8路 → 组数 0.25，被拦下并提示`)
  : bad(`非法配置没被拦：violations=${v.violations} chip=${v.chip}`)

const msg = await p.evaluate(() => document.querySelector('.viol p')?.textContent)
console.log(`      提示文案：${msg?.trim()}`)

console.log('\n【5】第二个 tab 真的是另一个视图')
await p.click('.param:has-text("Cache 容量") .opts button:has-text("256")')
await p.click('.param:has-text("块大小") .opts button:has-text("16")')
await p.click('.param:has-text("相联度") .opts button:has-text("2")')
await p.waitForTimeout(250)
await p.click('.tabs button >> nth=1')
await p.waitForTimeout(300)
await p.screenshot({ path: '/tmp/web-sweep.png', fullPage: true })
const sweep = await p.evaluate(() => ({
  bars: document.querySelectorAll('.sweep .bar').length,
  vals: [...document.querySelectorAll('.sweep .v')].map(x => x.textContent),
}))
sweep.bars >= 3
  ? ok(`命中率随相联度：${sweep.bars} 个扫描点 ${sweep.vals.join(' ')}`)
  : bad(`扫描视图没渲染：${JSON.stringify(sweep)}`)

console.log(`\n${'─'.repeat(50)}`)
console.log(errs.length ? `控制台错误 ${errs.length} 条：\n  ` + errs.slice(0, 4).join('\n  ') : '控制台无错误')
console.log(fail === 0 ? '视图层冒烟：通过' : `视图层冒烟：失败 ${fail} 项`)
await b.close()
process.exit(fail === 0 && errs.length === 0 ? 0 : 1)
