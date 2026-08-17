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
/** 按名字切实验 —— 别用 nth，加一个实验就会全盘错位（已经栽过两次） */
const nav = async name => {
  await p.click(`.nav button:has-text("${name}")`)
  await p.waitForTimeout(260)
}
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

/*
 * 实验名单**从页面读**，不再手写。
 * 手写的那份跟注册表顺序错位过两次（插入新实验时位置不同就整体串号），
 * 每次都要花时间才认出是名单过期而不是应用坏了。
 */
const EXPS = await p.evaluate(() =>
  [...document.querySelectorAll('.nav button')].map(b => ({
    label: b.querySelector('span:last-child')?.textContent ?? '',
    idx: b.querySelector('.n')?.textContent ?? '',
  })))

console.log(`\n【1】${EXPS.length} 个实验都能起来，且各自的舞台不同`)
for (const [i, e] of EXPS.entries()) {
  await p.click(`.nav button >> nth=${i}`)
  await p.waitForTimeout(200)
  const s = await snap()
  s.title === e.label && s.ticks > 0 && s.logRows > 0 && s.bounds
    ? ok(`${e.label.padEnd(16)} ${String(s.ticks).padStart(3)} 步 · tab[${s.tabs.join('/')}] · 有边界栏`)
    : bad(`${e.label} 起不来：标题「${s.title}」 步数 ${s.ticks} 边界栏 ${!!s.bounds}`)
}

// 舞台必须真的不同 —— 不能几个实验长一个样
const stageSigs = []
for (let i = 0; i < EXPS.length; i++) {
  await p.click(`.nav button >> nth=${i}`); await p.waitForTimeout(180)
  stageSigs.push(await p.evaluate(() => {
    //  认舞台自己的容器，不靠"中列第几张卡片"猜 ——
    //  之前每加一个编辑器（序列 / 实体）这条就会误报一次
    const el = document.querySelector('.stagewrap > .card')
    /*
     * 两处一直有问题，一起修在根因上：
     * 1) `.className` 对 SVG 元素返回 SVGAnimatedString 对象，一律 stringify 成
     *    "[object SVGAnimatedString]" —— 凡是带 SVG 的舞台，这个签名一直在比垃圾。
     *    改用 getAttribute('class')。
     * 2) 只取前 8 个元素，共用同一个视觉原语（如 MST 与拓扑都用 GraphView）
     *    的两个舞台必然撞签名。那是**设计上的复用**，不是退化 ——
     *    所以签名要取得更深，让它们在共用部分之后的差异显出来。
     */
    return [...el.querySelectorAll('*')]
      .map(x => x.getAttribute('class') || x.tagName)
      .slice(0, 40).join(',')
  }))
}
new Set(stageSigs).size === EXPS.length
  ? ok(`${EXPS.length} 个舞台的 DOM 结构互不相同（渲染层可替换的实证）`)
  : bad(`有舞台长得一样：${stageSigs.length - new Set(stageSigs).size} 处重复`)

console.log('\n【2】验收标准 3：改一个状态，多个视图一起变（视图之间零互写）')
await nav('Cache 命中率')
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
await nav('页面置换')                          // 有 Belady 那道题
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
for (const name of ['排序逐趟', 'Dijkstra', '银行家算法', '滑动窗口',
                     'IEEE 754', '指令流水线', '虚地址转换', '定点乘除',
                     'CRC', '海明码', '子网划分', 'TCP 连接管理',
                     'AVL', '散列表', '哈夫曼', 'KMP',
                     '最小生成树', '拓扑排序', '动态分区', '文件索引',
                     'B+ 树', '图的遍历', '信号量', '位示图', 'CSMA']) {
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

// ═══ 9. 驱动序列可编辑 ═══════════════════════════════
console.log('\n【9】驱动序列可编辑：改题面数据，不只是改参数')
const seqOf = () => p.evaluate(() => ({
  text: document.querySelector('.seqin')?.value,
  echo: document.querySelector('.seqecho')?.textContent,
  err: document.querySelector('.seqerr')?.textContent,
  bad: !!document.querySelector('.card.seq.bad'),
  ticks: document.querySelectorAll('.tick').length,
  presets: document.querySelectorAll('.seqacts button:not(.ghost)').length,
}))
const setSeq = async v => {
  await p.fill('.seqin', v)
  await p.waitForTimeout(230)
}

// 四个实验都要有编辑器
for (const name of ['Cache 命中率', '页面置换', '磁盘调度', '排序逐趟']) {
  await nav(name)
  const s = await seqOf()
  s.text && s.presets >= 3 && !s.bad
    ? ok(`${name.padEnd(12)} 有编辑器 · ${s.presets} 个预置 · 当前「${s.text.slice(0, 26)}…」`)
    : bad(`${name} 编辑器不对：${JSON.stringify(s)}`)
}

// 改序列 → 步数必须跟着变（真的重跑了，不是摆设）
await nav('页面置换')
const seqBefore = await seqOf()
await setSeq('1 2 3 1 2 3')
const seqAfter = await seqOf()
seqAfter.ticks === 6 && seqAfter.ticks !== seqBefore.ticks
  ? ok(`引用串改成 6 项 → 轨迹从 ${seqBefore.ticks} 步变成 ${seqAfter.ticks} 步`)
  : bad(`改序列没重跑：${seqBefore.ticks} → ${seqAfter.ticks}`)

// 分隔符要宽容：中文逗号、顿号、换行混用
await setSeq('1，2、3\n4 5,6')
const mixed = await seqOf()
mixed.ticks === 6 && !mixed.bad
  ? ok('分隔符宽容：中文逗号 / 顿号 / 换行 / 英文逗号混用都能解析出 6 项')
  : bad(`混合分隔符解析失败：${JSON.stringify(mixed)}`)

// 打坏字符 → 必须报错，且仿真停在上一次有效的序列（不能跳回原始串）
await setSeq('1 2 abc 4')
const broken = await seqOf()
broken.bad && broken.err?.includes('第 3 项') && broken.ticks === 6
  ? ok(`敲坏字符：报「${broken.err.split('——')[0].trim()}」，轨迹仍停在上一次有效的 6 步`)
  : bad(`坏输入处理不对：${JSON.stringify(broken)}`)

// 修好 → 立刻恢复
await setSeq('1 2 3 4')
const fixed = await seqOf()
!fixed.bad && fixed.ticks === 4
  ? ok(`改回合法值 → 立刻重跑成 ${fixed.ticks} 步`)
  : bad(`改回来没恢复：${JSON.stringify(fixed)}`)

// 预置串要真的载入
await p.click('.seqacts button:not(.ghost) >> nth=0')
await p.waitForTimeout(240)
const preset = await seqOf()
preset.ticks === 12 && preset.text.startsWith('1 2 3 4')
  ? ok(`点「Belady 经典串」→ 载入 12 项，轨迹 ${preset.ticks} 步`)
  : bad(`预置没载入：${JSON.stringify(preset)}`)

// 已经规范的十进制输入不该再来一行冗余回显
await nav('页面置换')
await setSeq('1 2 3 4')
const noEcho = await seqOf()
noEcho.echo === undefined && !noEcho.bad
  ? ok('输入已规范时不显示回显（输入框自己就是回显，不制造噪音）')
  : bad(`规范输入仍显示回显：${JSON.stringify(noEcho)}`)
await setSeq('1，2、3 4')
const normEcho = await seqOf()
normEcho.echo?.includes('1') && !normEcho.bad
  ? ok('用了中文分隔符时显示回显，学生能看见系统理解成了什么')
  : bad(`归一化后没回显：${JSON.stringify(normEcho)}`)

// 十六进制：回显必须把理解到的值摊出来（学生输 10，十六进制下是 16）
await nav('Cache 命中率')
await setSeq('10 20 10')
const hexEcho = await seqOf()
hexEcho.echo?.includes('0x10') && !hexEcho.bad
  ? ok(`十六进制回显：输入「10 20 10」→ 解析为 ${hexEcho.echo.replace('解析为', '').trim()}`)
  : bad(`十六进制回显不对：${JSON.stringify(hexEcho)}`)

// 越界值要被验证器拦住，而且编辑器必须还在（否则学生改坏了就再也改不回来）
await nav('磁盘调度')
await setSeq('10 20 9999')
const oob = await p.evaluate(() => ({
  viol: document.querySelectorAll('.viol').length,
  msg: document.querySelector('.viol p')?.textContent,
  editorStillThere: !!document.querySelector('.seqin'),
}))
oob.viol > 0 && oob.editorStillThere
  ? ok(`磁道 9999 越界被拦下（${oob.msg?.trim().slice(0, 32)}），且编辑器仍在，改得回来`)
  : bad(`越界处理不对：${JSON.stringify(oob)}`)
await p.click('.seqacts button.ghost:has-text("恢复默认")')
await p.waitForTimeout(240)
const restored = await p.evaluate(() => ({
  viol: document.querySelectorAll('.viol').length,
  ticks: document.querySelectorAll('.tick').length,
}))
restored.viol === 0 && restored.ticks === 8
  ? ok(`点「恢复默认」→ 回到 ${restored.ticks} 步，违规清零`)
  : bad(`恢复默认失效：${JSON.stringify(restored)}`)

// 选了真题再改序列 → 必须提示偏离原题
await nav('页面置换')
await p.click('.probpick button >> nth=1')
await p.waitForTimeout(300)
const beforeDrift = await p.evaluate(() => !!document.querySelector('.probdrift'))
await setSeq('1 2 3 4 5')
const afterDrift = await p.evaluate(() => !!document.querySelector('.probdrift'))
!beforeDrift && afterDrift
  ? ok('选了真题后改引用串 → 提示「配置已被改动」（答案按当前序列算）')
  : bad(`序列偏离没提示：改前 ${beforeDrift} 改后 ${afterDrift}`)

// ═══ 10. 实体表可编辑 ═══════════════════════════════════
console.log('\n【10】实体表可编辑：进程表 / 图的边 / 资源矩阵 / 丢包事件')
const entOf = () => p.evaluate(() => ({
  tables: document.querySelectorAll('.ent .enttab').length,
  rows: document.querySelectorAll('.ent tbody tr').length,
  inputs: document.querySelectorAll('.ent input, .ent select').length,
  presets: document.querySelectorAll('.entacts button:not(.ghost)').length,
  ticks: document.querySelectorAll('.tick').length,
  bad: document.querySelectorAll('.ent input.bad').length,
}))

for (const [name, tables] of [['进程调度', 1], ['Dijkstra', 1], ['银行家算法', 2], ['TCP 拥塞窗口', 1], ['滑动窗口', 1]]) {
  await nav(name)
  const e = await entOf()
  e.tables === tables && e.inputs > 0 && e.presets >= 3
    ? ok(`${name.padEnd(12)} ${e.tables} 张表 · ${e.rows} 行 · ${e.inputs} 个输入 · ${e.presets} 个预置`)
    : bad(`${name} 实体表不对：${JSON.stringify(e)}`)
}

// 改一个格子 → 仿真必须重跑
await nav('进程调度')
const p0 = await entOf()
await p.fill('.ent tbody tr:nth-child(1) td:nth-child(3) input', '12')
await p.waitForTimeout(280)
const p1 = await entOf()
p1.ticks > p0.ticks
  ? ok(`把 P1 服务时间改成 12 → 轨迹从 ${p0.ticks} 步涨到 ${p1.ticks} 步`)
  : bad(`改服务时间没重跑：${p0.ticks} → ${p1.ticks}`)

// 半截输入（清空）不许喂给仿真
await p.fill('.ent tbody tr:nth-child(1) td:nth-child(3) input', '')
await p.waitForTimeout(250)
const half = await entOf()
half.bad === 1 && half.ticks === p1.ticks
  ? ok(`清空那一格：标红但轨迹仍是 ${half.ticks} 步 —— 半截输入没喂给仿真`)
  : bad(`半截输入处理不对：标红 ${half.bad} 个，轨迹 ${half.ticks} 步`)
await p.fill('.ent tbody tr:nth-child(1) td:nth-child(3) input', '7')
await p.waitForTimeout(250)

// 加行 / 删行
const rowsBefore = (await entOf()).rows
await p.click('.entadd')
await p.waitForTimeout(260)
const added = await entOf()
await p.click('.ent tbody tr:last-child td.act button')
await p.waitForTimeout(260)
const removed = await entOf()
added.rows === rowsBefore + 1 && removed.rows === rowsBefore
  ? ok(`加一行 → ${added.rows} 行，删掉 → ${removed.rows} 行，轨迹跟着重算`)
  : bad(`增删行不对：${rowsBefore} → ${added.rows} → ${removed.rows}`)

// 进程重名必须被验证器拦住，且编辑器仍在（改坏了得改得回来）
await p.fill('.ent tbody tr:nth-child(2) td:nth-child(1) input', 'P1')
await p.waitForTimeout(280)
const dup = await p.evaluate(() => ({
  viol: document.querySelectorAll('.viol').length,
  msg: document.querySelector('.viol p')?.textContent,
  editorStillThere: !!document.querySelector('.ent input'),
}))
dup.viol > 0 && dup.msg?.includes('重复') && dup.editorStillThere
  ? ok(`进程重名被拦下（${dup.msg.trim().slice(0, 24)}），编辑器仍在`)
  : bad(`重名没被拦：${JSON.stringify(dup)}`)
await p.click('.entacts button.ghost')
await p.waitForTimeout(280)
const back = await entOf()
back.rows === rowsBefore && (await p.evaluate(() => document.querySelectorAll('.viol').length)) === 0
  ? ok(`点「恢复默认」→ 回到 ${back.rows} 行，违规清零`)
  : bad(`恢复默认失效：${back.rows} 行`)

// 预置：护航效应（说法已被引擎测试验过）载入后必须真的改变结果
await p.click('.entacts button:has-text("护航效应")')
await p.waitForTimeout(300)
const convoyFcfs = await p.evaluate(() => document.querySelectorAll('.tick').length)
await p.click('.param:has-text("调度算法") .opts button:has-text("SRTF")')
await p.waitForTimeout(300)
const convoyOk = await p.evaluate(() => ({
  rows: document.querySelectorAll('.ent tbody tr').length,
  burst: document.querySelector('.ent tbody tr:nth-child(1) td:nth-child(3) input')?.value,
}))
convoyOk.rows === 4 && convoyOk.burst === '20' && convoyFcfs > 20
  ? ok(`载入「护航效应」：4 个进程，长作业服务时间 ${convoyOk.burst}，轨迹 ${convoyFcfs} 步`)
  : bad(`预置没载入：${JSON.stringify(convoyOk)}`)

// 图的边：删掉通往 G 的边 → G 必须变成不可达
await nav('Dijkstra')
await p.click('.entacts button:has-text("G 不可达")')
await p.waitForTimeout(320)
const unreachable = await p.evaluate(() => {
  const g = [...document.querySelectorAll('.gnode')].find(n => n.querySelector('b')?.textContent === 'G')
  return { dist: g?.querySelector('em')?.textContent, edges: document.querySelectorAll('.gedge').length }
})
unreachable.dist === '∞'
  ? ok(`载入「G 不可达」：图上只剩 ${unreachable.edges} 条边，G 的距离显示 ∞`)
  : bad(`G 居然可达：${JSON.stringify(unreachable)}`)

// 自环必须被拦（边可编辑之后才可能出现的非法状态）
await p.click('.entacts button.ghost')
await p.waitForTimeout(280)
await p.selectOption('.ent tbody tr:nth-child(1) td:nth-child(2) select', 'A')
await p.waitForTimeout(300)
const loop = await p.evaluate(() => ({
  viol: document.querySelectorAll('.viol').length,
  msg: document.querySelector('.viol p')?.textContent,
  editorStillThere: !!document.querySelector('.ent select'),
}))
loop.viol > 0 && loop.msg?.includes('自环') && loop.editorStillThere
  ? ok(`把边改成 A→A：自环被拦下（${loop.msg.trim().slice(0, 20)}），编辑器仍在`)
  : bad(`自环没被拦：${JSON.stringify(loop)}`)
await p.click('.entacts button.ghost')
await p.waitForTimeout(280)

// 银行家：两张表，改总量必须能把安全状态改成不安全
await nav('银行家算法')
await p.click('.tabs button >> nth=1')      // 判定在「安全性检查」这个 tab 上
await p.waitForTimeout(240)
const bankBefore = await p.evaluate(() => document.querySelectorAll('.tick').length)
await p.click(`.tick >> nth=${bankBefore - 1}`)
await p.waitForTimeout(250)
const verdictBefore = await p.evaluate(() =>
  document.querySelector('.bverdict b')?.textContent)
//  降到 4 的话已分配 7 > 4，那是「状态非法」不是「不安全」——
//  降到 7 才刚好把可用量压到 0，逼出真正的不安全状态
await p.fill('.ent .enttab:nth-child(1) tbody tr:nth-child(1) td:nth-child(2) input', '7')
await p.waitForTimeout(320)
const n2 = await p.evaluate(() => document.querySelectorAll('.tick').length)
await p.click(`.tick >> nth=${n2 - 1}`)
await p.waitForTimeout(250)
const verdictAfter = await p.evaluate(() => document.querySelector('.bverdict b')?.textContent)
verdictBefore === '安全状态' && verdictAfter === '不安全状态'
  ? ok(`把 A 资源总量从 10 改成 7 → 判定从「${verdictBefore}」变成「${verdictAfter}」`)
  : bad(`改总量没改变判定：${verdictBefore} → ${verdictAfter}`)

// 已分配超过总量 = 状态本身非法，不是"不安全"
await p.fill('.ent .enttab:nth-child(1) tbody tr:nth-child(1) td:nth-child(2) input', '1')
await p.waitForTimeout(320)
const illegal = await p.evaluate(() => ({
  viol: document.querySelectorAll('.viol').length,
  msg: document.querySelector('.viol p')?.textContent,
}))
illegal.viol > 0 && illegal.msg?.includes('超过总量')
  ? ok(`已分配 7 > 总量 1：判为状态非法而不是「不安全」（${illegal.msg.trim().slice(0, 26)}）`)
  : bad(`没区分「非法」与「不安全」：${JSON.stringify(illegal)}`)
await p.click('.entacts button.ghost')
await p.waitForTimeout(280)

// ARQ：删掉丢包事件 → 重传必须归零
await nav('滑动窗口')
await p.click('.entacts button:has-text("不丢包")')
await p.waitForTimeout(320)
const lastN = await p.evaluate(() => document.querySelectorAll('.tick').length)
await p.click(`.tick >> nth=${lastN - 1}`)
await p.waitForTimeout(250)
const noLoss = await p.evaluate(() => {
  const r = [...document.querySelectorAll('.pr')].find(x => x.querySelector('.k')?.textContent === '其中重传')
  return { retrans: r?.querySelector('.v')?.textContent, rows: document.querySelectorAll('.ent tbody tr').length }
})
noLoss.retrans === '0'
  ? ok(`载入「不丢包」：丢包表清空（${noLoss.rows} 行提示），重传次数 ${noLoss.retrans}`)
  : bad(`不丢包却有重传：${JSON.stringify(noLoss)}`)

// ═══ 11. 图的连线必须真的接在结点上 ═══════════════════
console.log('\n【11】图视图：连线端点必须贴着结点中心')
//  这条是补的：viewBox 用 xMidYMid meet 时 SVG 坐标系与结点的百分比定位不重合，
//  三个图实验的连线都离结点中心 50~125px。图"看着像那么回事"，所以一直没发现。
for (const [name, directed] of [['Dijkstra', 0], ['最小生成树', 0], ['拓扑排序', 1]]) {
  await nav(name)
  const gap = await p.evaluate(() => {
    const nodes = [...document.querySelectorAll('.gnode')].map(n => {
      const b = n.getBoundingClientRect()
      return { cx: b.left + b.width / 2, cy: b.top + b.height / 2 }
    })
    let max = 0
    for (const line of document.querySelectorAll('.gedge line')) {
      const b = line.getBoundingClientRect()
      //  线的包围盒四个角里，离结点最近的两个就是它的两端
      const ends = [[b.left, b.top], [b.right, b.bottom], [b.left, b.bottom], [b.right, b.top]]
        .map(([x, y]) => Math.min(...nodes.map(n => Math.hypot(n.cx - x, n.cy - y))))
        .sort((a, z) => a - z).slice(0, 2)
      max = Math.max(max, ends[1])
    }
    return Math.round(max)
  })
  //  无向图应当严丝合缝；有向图为箭头主动缩进约 4.5 个 viewBox 单位
  const limit = directed ? 45 : 12
  gap <= limit
    ? ok(`${name.padEnd(10)} 所有连线端点离结点中心 ≤ ${gap}px（上限 ${limit}）`)
    : bad(`${name} 连线没接上：最远 ${gap}px，上限 ${limit}px`)
}

console.log(`\n${'─'.repeat(50)}`)
console.log(errs.length ? `控制台错误 ${errs.length} 条：\n  ` + errs.slice(0, 4).join('\n  ') : '控制台无错误')
console.log(fail === 0 ? '视图层冒烟：通过' : `视图层冒烟：失败 ${fail} 项`)
await b.close()
process.exit(fail === 0 && errs.length === 0 ? 0 : 1)
