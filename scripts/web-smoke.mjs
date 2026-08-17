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

const EXPS = [
  ['Cache 命中率', 'cache'],
  ['页面置换', 'page'],
  ['进程调度甘特图', 'sched'],
  ['磁盘调度', 'disk'],
  ['银行家算法', 'banker'],
  ['排序逐趟', 'sort'],
  ['Dijkstra 最短路', 'dijkstra'],
  ['TCP 拥塞窗口', 'tcp'],
  ['滑动窗口 ARQ', 'arq'],
]
console.log(`\n【1】${EXPS.length} 个实验都能起来，且各自的舞台不同`)
for (const [i, [name, shot]] of EXPS.entries()) {
  await p.click(`.nav button >> nth=${i}`)
  await p.waitForTimeout(220)
  const s = await snap()
  await p.screenshot({ path: `/tmp/web-${shot}.png`, fullPage: true })
  s.title === name && s.ticks > 0 && s.logRows > 0 && s.bounds
    ? ok(`${name.padEnd(14)} ${String(s.ticks).padStart(2)} 步 · tab[${s.tabs.join('/')}] · 有边界栏`)
    : bad(`${name} 起不来：${JSON.stringify(s)}`)
}

// 舞台必须真的不同 —— 不能五个实验长一个样
const stageSigs = []
for (let i = 0; i < EXPS.length; i++) {
  await p.click(`.nav button >> nth=${i}`); await p.waitForTimeout(200)
  stageSigs.push(await p.evaluate(() => {
    const el = document.querySelector('.col > .card')
    return [...el.querySelectorAll('*')].map(x => x.className).filter(Boolean).slice(0, 8).join(',')
  }))
}
new Set(stageSigs).size === EXPS.length
  ? ok(`${EXPS.length} 个舞台的 DOM 结构互不相同（渲染层可替换的实证）`)
  : bad(`有舞台长得一样：${stageSigs.length - new Set(stageSigs).size} 处重复`)

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

// ═══ 6. 真题面板 ═══════════════════════════════════════
console.log('\n【6】真题：选题 → 载入配置 → 判题 → 跳到那一步')
await p.click('.nav button >> nth=1')          // 页面置换（有 Belady 那道题）
await p.waitForTimeout(250)
const probBefore = await snap()
await p.click('.probpick button >> nth=1')     // 第一道真题
await p.waitForTimeout(300)
const probAfter = await p.evaluate(() => ({
  statement: document.querySelector('.probstate')?.textContent?.slice(0, 24),
  questions: document.querySelectorAll('.qlist li').length,
  chipOn: !!document.querySelector('.chip.on'),
}))
probAfter.questions > 0 && probAfter.statement && probAfter.chipOn
  ? ok(`选中真题：${probAfter.questions} 问 · 题干「${probAfter.statement}…」· 页眉有标记`)
  : bad(`真题没载入：${JSON.stringify(probAfter)}`)

// 故意填错 → 必须判错并给出正确答案
await p.fill('.qlist li:nth-child(1) input', '999')
await p.click('.qlist li:nth-child(1) .qrow button')
await p.waitForTimeout(200)
const wrong = await p.evaluate(() => ({
  cls: document.querySelector('.qlist li:nth-child(1)')?.className,
  fb: document.querySelector('.qlist li:nth-child(1) .nomark')?.textContent,
  jump: !!document.querySelector('.qlist li:nth-child(1) .jump'),
}))
wrong.cls === 'wrong' && wrong.fb && wrong.jump
  ? ok(`填错被判错，给出正确答案「${wrong.fb.trim()}」并提供跳转`)
  : bad(`判错逻辑不对：${JSON.stringify(wrong)}`)

// 用它给的正确答案再填一次 → 必须判对（说明答案是真从轨迹派生的）
const correct = await p.evaluate(() =>
  document.querySelector('.qlist li:nth-child(1) .nomark b')?.textContent ?? '')
await p.fill('.qlist li:nth-child(1) input', correct)
await p.click('.qlist li:nth-child(1) .qrow button')
await p.waitForTimeout(200)
const right2 = await p.evaluate(() => document.querySelector('.qlist li:nth-child(1)')?.className)
right2 === 'right'
  ? ok(`填入它给的答案「${correct}」判对 —— 答案确实从轨迹派生`)
  : bad(`填对了却没判对：class=${right2}`)

// 跳转按钮必须真的改变当前步
const stepBefore = await p.evaluate(() => document.querySelector('.tick.cur')?.getAttribute('aria-label'))
await p.click('.qlist li:nth-child(1) .jump').catch(() => {})
await p.waitForTimeout(200)
const stepAfter = await p.evaluate(() => document.querySelector('.tick.cur')?.getAttribute('aria-label'))
stepBefore !== stepAfter
  ? ok(`「跳到第 N 步看为什么」生效：${stepBefore} → ${stepAfter}`)
  : bad(`跳转没生效，仍停在 ${stepAfter}`)

// 改参数 → 必须提示已偏离原题
await p.click('.param:has-text("物理块数") .opts button:has-text("5")')
await p.waitForTimeout(250)
const drift = await p.evaluate(() => !!document.querySelector('.probdrift'))
drift ? ok('改参数后提示「配置已被改动，答案按当前配置算」')
      : bad('改参数后没提示偏离原题')
void probBefore

// ═══ 7. 四个新实验各自的核心视觉 ═══════════════════════
console.log('\n【7】新实验的舞台必须真的画出东西（不能只有壳）')
const nav = async name => {
  await p.click(`.nav button:has-text("${name}")`)
  await p.waitForTimeout(260)
}

// 排序：数组条 + 逐趟表
await nav('排序逐趟')
const sortView = await p.evaluate(() => ({
  bars: document.querySelectorAll('.sbar').length,
  vals: [...document.querySelectorAll('.sbar .sval')].map(x => x.textContent),
  hole: document.querySelectorAll('.sbar.hole').length,
}))
await p.click('.tabs button >> nth=1'); await p.waitForTimeout(240)
const sortPasses = await p.evaluate(() => ({
  rows: document.querySelectorAll('.ptab tbody tr').length,
  first: document.querySelector('.ptab tbody tr td.seq')?.textContent,
}))
await p.screenshot({ path: '/tmp/web-sort.png', fullPage: true })
sortView.bars === 8 && sortPasses.rows >= 3
  ? ok(`排序：8 个数组条（${sortView.vals.join(' ')}）· 逐趟表 ${sortPasses.rows} 行`)
  : bad(`排序舞台不对：${JSON.stringify({ sortView, sortPasses })}`)

// 挖坑法必须真的显示空位 —— 这是本轮修的那个 bug 的回归检查
await p.click('.tabs button >> nth=0'); await p.waitForTimeout(200)
let sawHole = false
for (let k = 0; k < 6; k++) {
  await p.click(`.tick >> nth=${k}`); await p.waitForTimeout(120)
  const h = await p.evaluate(() => ({
    hole: document.querySelectorAll('.sbar.hole').length,
    held: document.querySelector('.sheldbox b')?.textContent,
  }))
  if (h.hole === 1 && h.held) { sawHole = true; break }
}
sawHole
  ? ok('快排挖坑：某一步同时出现「1 个空位」和「手里端着的值」')
  : bad('快排从没显示过空位 —— 挖坑法又画成凭空多一个数了')

// Dijkstra：图 + 距离表
await nav('Dijkstra')
const dijView = await p.evaluate(() => ({
  nodes: document.querySelectorAll('.gnode').length,
  edges: document.querySelectorAll('.gedge').length,
  dists: [...document.querySelectorAll('.gnode em')].map(x => x.textContent),
}))
await p.click('.tabs button >> nth=1'); await p.waitForTimeout(240)
const dijTab = await p.evaluate(() => ({
  cols: document.querySelectorAll('.ptab.dij thead th').length,
  rows: document.querySelectorAll('.ptab.dij tbody tr').length,
}))
await p.screenshot({ path: '/tmp/web-dijkstra.png', fullPage: true })
dijView.nodes === 7 && dijView.edges === 12 && dijTab.rows === 7
  ? ok(`Dijkstra：7 顶点 12 边 · 距离表 ${dijTab.rows}×${dijTab.cols - 1}`)
  : bad(`Dijkstra 舞台不对：${JSON.stringify({ dijView, dijTab })}`)

// 距离必须随时间轴变化（不是画完就不动的静态图）
await p.click('.tabs button >> nth=0'); await p.waitForTimeout(200)
await p.click('.tick >> nth=0'); await p.waitForTimeout(180)
const d0 = await p.evaluate(() => [...document.querySelectorAll('.gnode em')].map(x => x.textContent).join(','))
await p.click('.tick >> nth=14'); await p.waitForTimeout(180)
const d1 = await p.evaluate(() => [...document.querySelectorAll('.gnode em')].map(x => x.textContent).join(','))
d0 !== d1
  ? ok(`拖时间轴，顶点上的距离跟着变：${d0} → ${d1}`)
  : bad(`距离不随时间轴变：始终 ${d0}`)

// 银行家：矩阵 + 安全序列
await nav('银行家算法')
const bankView = await p.evaluate(() => ({
  rows: document.querySelectorAll('.ptab.bank tbody tr').length,
  work: [...document.querySelectorAll('.ptab.bank td.work')].map(x => x.textContent),
}))
await p.click('.tabs button >> nth=1'); await p.waitForTimeout(240)
const bankSearch = await p.evaluate(() => ({
  verdict: document.querySelector('.bverdict b')?.textContent,
  seqLen: document.querySelectorAll('.bseq b').length,
}))
await p.screenshot({ path: '/tmp/web-banker.png', fullPage: true })
bankView.rows === 5 && bankView.work.length === 3
  ? ok(`银行家：5 个进程 · Work=(${bankView.work.join(' ')})`)
  : bad(`银行家舞台不对：${JSON.stringify({ bankView, bankSearch })}`)

// 第 1 步不许剧透答案 —— 学生还没推，安全序列就摆出来的话这个实验就白做了
bankSearch.verdict === '推演中' && bankSearch.seqLen === 0
  ? ok(`第 1 步不剧透：只显示「${bankSearch.verdict}」，安全序列为空`)
  : bad(`第 1 步就把答案摊开了：判定「${bankSearch.verdict}」序列 ${bankSearch.seqLen} 个`)

// 走到最后一步必须给出完整安全序列
await p.click('.tabs button >> nth=0'); await p.waitForTimeout(150)
const nTicks = await p.evaluate(() => document.querySelectorAll('.tick').length)
await p.click(`.tick >> nth=${nTicks - 1}`); await p.waitForTimeout(200)
await p.click('.tabs button >> nth=1'); await p.waitForTimeout(200)
const finalSeq = await p.evaluate(() =>
  [...document.querySelectorAll('.bseq b')].map(x => x.textContent))
finalSeq.length === 5
  ? ok(`末步给出完整安全序列：${finalSeq.join(' → ')}`)
  : bad(`末步安全序列不完整：${finalSeq.join(' ')}（应有 5 个）`)

// ARQ：时空图 + 窗口
await nav('滑动窗口')
const arqView = await p.evaluate(() => ({
  msgs: document.querySelectorAll('.amsg').length,
  lost: document.querySelectorAll('.amsg.lost').length,
  tags: document.querySelectorAll('.atag').length,
}))
await p.click('.tabs button >> nth=1'); await p.waitForTimeout(240)
const arqWin = await p.evaluate(() => ({
  cells: document.querySelectorAll('.acell').length,
  inwin: document.querySelectorAll('.acell.inwin').length,
}))
await p.screenshot({ path: '/tmp/web-arq.png', fullPage: true })
arqView.msgs > 8 && arqView.lost >= 1 && arqWin.cells === 16
  ? ok(`ARQ：时空图 ${arqView.msgs} 条报文（其中 ${arqView.lost} 条丢失）· 窗口 16 格`)
  : bad(`ARQ 舞台不对：${JSON.stringify({ arqView, arqWin })}`)

// GBN → SR：重传次数必须下降（内核里最关键的那条性质要能在 UI 上看见）
const readTx = () => p.evaluate(() => {
  const rs = [...document.querySelectorAll('.pr')]
  const r = rs.find(x => x.querySelector('.k')?.textContent === '其中重传')
  return r?.querySelector('.v')?.textContent
})
await p.click('.tabs button >> nth=0'); await p.waitForTimeout(150)
const lastTick = await p.evaluate(() => document.querySelectorAll('.tick').length)
await p.click(`.tick >> nth=${lastTick - 1}`); await p.waitForTimeout(200)
const gbnTx = await readTx()
await p.click('.param:has-text("协议") .opts button:has-text("SR")')
await p.waitForTimeout(300)
const srTicks = await p.evaluate(() => document.querySelectorAll('.tick').length)
await p.click(`.tick >> nth=${srTicks - 1}`); await p.waitForTimeout(220)
const srTx = await readTx()
Number(srTx) < Number(gbnTx) && Number(gbnTx) > 0
  ? ok(`UI 上也能看出 SR 更省：GBN 重传 ${gbnTx} 次 → SR 重传 ${srTx} 次`)
  : bad(`SR 没比 GBN 省或读数没变：GBN=${gbnTx} SR=${srTx}`)

// ═══ 8. 新实验的真题 ═══════════════════════════════════
console.log('\n【8】四个新实验的真题都能判对（答案从轨迹派生）')
for (const name of ['排序逐趟', 'Dijkstra', '银行家算法', '滑动窗口']) {
  await nav(name)
  const picks = await p.evaluate(() => document.querySelectorAll('.probpick button').length)
  if (picks < 2) { bad(`${name} 没有真题可选`); continue }
  await p.click('.probpick button >> nth=1')
  await p.waitForTimeout(320)
  const nq = await p.evaluate(() => document.querySelectorAll('.qlist li').length)
  // 每一问都先故意填错拿到答案，再填回去 —— 验证答案确实是算出来的
  let allRight = true, answers = []
  for (let k = 1; k <= nq; k++) {
    await p.fill(`.qlist li:nth-child(${k}) input`, '__zzz__')
    await p.click(`.qlist li:nth-child(${k}) .qrow button`)
    await p.waitForTimeout(140)
    const correct = await p.evaluate(i =>
      document.querySelector(`.qlist li:nth-child(${i}) .nomark b`)?.textContent ?? '', k)
    if (!correct) { allRight = false; break }
    answers.push(correct)
    await p.fill(`.qlist li:nth-child(${k}) input`, correct)
    await p.click(`.qlist li:nth-child(${k}) .qrow button`)
    await p.waitForTimeout(140)
    const cls = await p.evaluate(i =>
      document.querySelector(`.qlist li:nth-child(${i})`)?.className, k)
    if (cls !== 'right') { allRight = false; break }
  }
  allRight
    ? ok(`${name.padEnd(12)} ${nq} 问全部判对 · 答案 [${answers.join(' | ')}]`)
    : bad(`${name} 有问判不对（第 ${answers.length + 1} 问）`)
}

console.log(`\n${'─'.repeat(50)}`)
console.log(errs.length ? `控制台错误 ${errs.length} 条：\n  ` + errs.slice(0, 4).join('\n  ') : '控制台无错误')
console.log(fail === 0 ? '视图层冒烟：通过' : `视图层冒烟：失败 ${fail} 项`)
await b.close()
process.exit(fail === 0 && errs.length === 0 ? 0 : 1)
