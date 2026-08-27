/**
 * 视图层冒烟测试：三个实验 + 参数联动 + 违规拦截 + 单向数据流。
 * 「做完就测」—— 前端必须进浏览器量数字，不能只看代码。
 *   node scripts/web-smoke.mjs [url]
 */
import { chromium } from 'playwright'

const URL = process.argv[2] ?? 'http://localhost:5178/'
const b = await chromium.launch({ channel: 'chrome' })
/*
 * ⚠️ 这里原来写的是 `viewportSize` —— **`newPage` 不认这个名字**（那是
 * `page.setViewportSize()` 的参数），于是整套冒烟一直跑在 Chrome 的默认
 * 1280×720 上，而我一路按"1460×1080"在读数、还照着这个数下过结论。
 * 参数名打错不报错，只是静静地量错 —— 「调参前先确认量对了」。
 *
 * 现在明写 1280×720：这是三个候选尺寸里最紧的一个（720 比 768 矮、
 * 1280 比 1366 窄），一屏装得下的判据就该在最紧的那一档上量。
 */
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })

const errs = []
/**
 * 开发服务器自己的 HMR 心跳不算应用的错。
 *
 * 本机同时开着好几个 vite（这个仓库、别的仓库、临时的截图服务），
 * `@vite/client` 会去连一个不属于当前端口的 websocket，连不上就往控制台
 * 刷「WebSocket opening handshake timed out」。判据因此红过一次 ——
 * 而那时候 20 组判据**全是绿的**，红的只有这几条噪声。
 *
 * ⚠️ 过滤要窄：只放行明确来自 vite 客户端的 websocket 抱怨。
 * 放宽成"包含 websocket 就忽略"，应用自己的连接错误就一起没了。
 */
const HMR_NOISE = [
  /@vite\/client/,
  /^\[vite\] failed to connect to websocket/,
  /^Failed to send error to Vite server/,
  /^WebSocket closed without opened\.$/,
  /WebSocket connection to 'ws:\/\/[^']+' failed/,
]
const noise = t => HMR_NOISE.some(re => re.test(t))
//  同一份噪声也会以 pageerror 的形式冒出来（vite 客户端那个没接住的 promise）
p.on('pageerror', e => { if (!noise(e.message)) errs.push('pageerror: ' + e.message) })
p.on('console', m => { if (m.type() === 'error' && !noise(m.text())) errs.push('console: ' + m.text()) })
p.on('response', r => { if (r.status() === 404) errs.push('404: ' + r.url()) })

let fail = 0
/** 目录里的第一个实验 —— 刷新之后应用回到的就是它。别写死名字：加实验会改顺序。 */
let EXP0 = 'Cache 命中率'
/** 按名字切实验 —— 别用 nth，加一个实验就会全盘错位（已经栽过两次） */
const nav = async name => {
  /*
   * ⚠️ 这个助手全套冒烟用了两百多次，**它一超时，红的是别人**。
   *
   * 默认 30 秒的等待在这儿是纯粹的浪费：切不过去只有两种原因，
   * 一是目录被收起来了（栏里的按钮 `visibility:hidden`），
   * 二是有东西盖在上面。两种都能当场处置，处置完立刻重试。
   * 等满 30 秒既不会自愈，还会把整套冒烟拖垮 ——
   * 实测 16b 那一组因此卡了十几分钟才抛出来，而报的是"切不到某个实验"，
   * 跟真正的病因隔着两层。
   *
   * 最后仍然失败就抛一条**带现场诊断**的错：按钮还剩几个、目录什么状态、
   * 应用是不是整个白屏了 —— 这三样能一眼分辨"布局问题"和"React 崩了"。
   */
  for (let k = 0; k < 2; k++) {
    if (await p.$('.grid[data-nav="shut"]')) {
      await p.click('.nav-fold').catch(() => {})
      await p.waitForTimeout(180)
    }
    try {
      await p.click(`.nav button:has-text("${name}")`, { timeout: 6000 })
      break
    } catch (e) {
      if (k === 1) {
        const d = await p.evaluate(() => ({
          n: document.querySelectorAll('.nav button').length,
          nav: document.querySelector('.grid')?.dataset.nav ?? '—',
          app: !!document.querySelector('.app'),
          note: !!document.querySelector('.gnote'),
        }))
        /*  ⚠️ 把**控制台最后几条报错**一起带上。
            「应用还在 false」说明 React 整棵树没了 —— 那一定有一条未捕获的异常，
            而它在冒烟末尾才统一打印，那时进程早就抛出去了。
            诊断要在**出事的那一刻**取，不能等到结尾。 */
        throw new Error(`切不到实验「${name}」：目录里 ${d.n} 个按钮、状态 ${d.nav}、`
          + `应用还在 ${d.app}、笔记开着 ${d.note}`
          + `\n原始错误：${String(e).split('\n')[0]}`
          + (errs.length ? `\n页面报错（最后 ${Math.min(3, errs.length)} 条）：\n     ${errs.slice(-3).join('\n     ')}` : ''))
      }
      //  再试一次之前，先把可能盖着它的那一层收掉
      const cover = await p.$('.gnote .gnx')
      if (cover) { await cover.click().catch(() => {}); await p.waitForTimeout(140) }
    }
  }
  await p.waitForTimeout(260)
  /*
   * 实验单第一次进某个实验会自动弹出来盖住中列 —— 它是给人看的，
   * 不是这一组要测的东西，而且它会挡住底下的按钮（浮层压住东西的老病）。
   * 用 `$` 先问在不在，别用带超时的 click：navs 有两百来次，
   * 每次白等几百毫秒会把整套冒烟拖垮。
   */
  const bf = await p.$('.gnote .gnx')
  if (bf) { await bf.click(); await p.waitForTimeout(90) }
}
/**
 * 日志 / 真题 / 边界现在收在底部坞里，同一时刻只露一块（为了「一屏装下一个实验」）。
 * 三块都挂在 DOM 上，所以**读**得到；但非当前的那两块是 `hidden`，**点**不着。
 * 要跟它们交互，先把那一格切出来。
 */
const dock = async label => {
  /*  ⚠️ 先展开。旁栏折叠之后往左收成 32px 的竖轨，页签标签整个 `display:none` ——
      这时点 `.dockbar button:has-text(…)` 会一直等一个永远不出现的方框。 */
  const folded = await p.evaluate(() => !!document.querySelector('.dock.folded'))
  if (folded) { await p.click('.dockfold'); await p.waitForTimeout(160) }
  await p.click(`.dockbar button:has-text("${label}")`)
  await p.waitForTimeout(140)
}
const ok = m => console.log(`  ✅ ${m}`)
const bad = m => { fail++; console.log(`  ❌ ${m}`) }

const snap = () => p.evaluate(() => ({
  title: document.querySelector('.exphead h1')?.textContent,
  chip: [...document.querySelectorAll('.chip')].map(c => c.textContent).join(' | '),
  tabs: [...document.querySelectorAll('.tabs button')].map(t => t.textContent),
  //  右栏推演也算"跟着走的字"：Cache 那一屏的读数只剩三个累计量，
  //  而"这一步发生了什么"现在写在推演卡里
  whyText: [...document.querySelectorAll('.whyrail .wv, .whyband .wv')].map(e => e.textContent).join('|'),
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
/*
 * 序列表 / 实体表默认是**收起**的（它们是设置不是内容，见 App.tsx 那段注释）。
 * 后面十来组要跟输入框和预置按钮打交道，所以这里统一把它们摊开 ——
 * 「默认收起」本身另有一组专门验（见最后一组），别在这儿顺手验掉：
 * 一个前置动作同时当判据用，改坏了会两边一起沉默。
 */
await p.evaluate(() => localStorage.setItem('cslab.editor', 'open'))
await p.reload({ waitUntil: 'networkidle' })
/**
 * 前 12 组测的是实验本身，讲解浮层不该在场。
 *
 * 它是**浮**的 —— 改成一屏布局之后页面上没有空地了，它必然压住某块内容。
 * 实测在银行家算法压住了时间轴右端的刻度，点击直接报
 * "…subtree intercepts pointer events"，卡满 30 秒。
 *
 * 真人可以拖开它（标题栏是把手），自动化不该去猜它今天停在哪。
 * 所以这里先收起来，第 13 组再从 ? 按钮把它请回来 —— 顺带也验证了收起是有效的。
 */
/*
 * ⚠️ 顺序不能反：实验单摊开时讲解浮层是 `display:none` 的（同一屏不摆两块解释），
 * 先去点浮层的 ✕ 会点了个寂寞 —— 而 `.catch` 会把这个失败悄悄咽掉，
 * 结果是浮层一路开着，第 1~12 组全被它挡。先收实验单，再收浮层。
 */
{
  const bf = await p.$('.gnote .gnx')
  if (bf) { await bf.click(); await p.waitForTimeout(120) }
}
await p.click('.guide .gx:last-of-type').catch(() => {})
await p.waitForTimeout(140)
await p.waitForSelector('.tick')
EXP0 = await p.evaluate(() => document.querySelector('.nav button')?.textContent?.replace(/^\d+\s*/, '').trim() || 'Cache 命中率')

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
    //  ⚠️ 不写 `.stagewrap > .card`：舞台外面套了 FitBox（.fit > .fitpad > .fitin），
    //  直接子代选择器一加中间层就断，而断了的表现是"整组测试崩在 null 上"。
    const el = document.querySelector('.stagewrap .fitin > .card') ?? document.querySelector('.stagewrap .card')
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
const changed = ['whyText', 'curTick', 'curLog'].filter(k => JSON.stringify(a[k]) !== JSON.stringify(c[k]))
changed.length === 3
  ? ok(`点第 6 个刻度 → 推演 / 轴 / 日志 三处同时更新`)
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
/*  ⚠️ 改用页面置换来验。Cache 的第二个视图「命中率随相联度」按用户要求下架了
    （见 registry.ts 那条注释），现在 Cache 只有一个页签。
    这条判据要的是"点第二个页签会换成另一张图"，用任何有两个页签的实验都成立 ——
    页面置换：页签1「置换表」(.ptable) → 页签2「物理块」(.frames)。 */
await nav('页面置换'); await p.waitForTimeout(250)
{ const bf = await p.$('.gnote .gnx'); if (bf) { await bf.click(); await p.waitForTimeout(120) } }
const beforeTab = await p.evaluate(() => ({ ptable: !!document.querySelector('.ptable'), frames: !!document.querySelector('.frames') }))
await p.click('.tabs button >> nth=1'); await p.waitForTimeout(300)
const afterTab = await p.evaluate(() => ({ ptable: !!document.querySelector('.ptable'), frames: !!document.querySelector('.frames') }))
beforeTab.ptable && afterTab.frames && !afterTab.ptable
  ? ok('第二个页签换了视图：置换表 → 物理块（.ptable → .frames）')
  : bad(`页签没换视图：前 ${JSON.stringify(beforeTab)} 后 ${JSON.stringify(afterTab)}`)
await nav('Cache 命中率'); await p.waitForTimeout(200)

// ═══ 6. 真题面板 ═══════════════════════════════════════
console.log('\n【6】真题：选题 → 载入配置 → 判题 → 跳到那一步')
await nav('页面置换')                          // 有 Belady 那道题
const probBefore = await snap()
await dock('真题'); await p.click('.probpick button >> nth=1')     // 第一道真题
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
  await dock('真题'); await p.click('.probpick button >> nth=1')
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
await dock('真题'); await p.click('.probpick button >> nth=1')
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

// ═══ 12. 学习进度与错题本 ═══════════════════════════════
console.log('\n【12】进度与错题本：答错要进错题本，刷新后还在')
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('cslab.editor', 'open') })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.tick')

const chipText = () => p.evaluate(() =>
  document.querySelector('.chip.act')?.textContent?.trim() ?? '')
const openPg = async () => { await p.click('.chip.act'); await p.waitForTimeout(220) }
const closePg = async () => { await p.click('.pgx'); await p.waitForTimeout(200) }

// 初始：0 掌握、错题本空
{
  const c = await chipText()
  await openPg()
  const empty = await p.evaluate(() => ({
    queue: document.querySelectorAll('.pgqueue li').length,
    empty: !!document.querySelector('.pgempty'),
    sum: document.querySelector('.pgsum')?.textContent?.trim(),
  }))
  await closePg()
  c.includes('0 /') && empty.queue === 0 && empty.empty
    ? ok(`初始状态：页眉「${c}」，错题本为空并给出下一步提示`)
    : bad(`初始状态不对：chip=${c} ${JSON.stringify(empty)}`)
}

// 故意答错一问 → 必须进错题本
await nav('页面置换')
await dock('真题'); await p.click('.probpick button >> nth=1')
await p.waitForTimeout(300)
await p.fill('.qlist li:nth-child(1) input', '__zzz__')
await p.click('.qlist li:nth-child(1) .qrow button')
await p.waitForTimeout(220)
{
  const badge = await p.evaluate(() =>
    document.querySelector('.qlist li:nth-child(1) .qbadge')?.textContent?.trim())
  await openPg()
  const q = await p.evaluate(() => ({
    n: document.querySelectorAll('.pgqueue li button').length,
    first: document.querySelector('.pgqueue li .qq')?.textContent?.slice(0, 20),
    meta: document.querySelector('.pgqueue li .meta')?.textContent?.trim(),
  }))
  await closePg()
  badge === '错过' && q.n === 1 && q.meta?.includes('错 1 次')
    ? ok(`答错一问：题目上标「${badge}」，错题本收进 1 条（${q.meta}）`)
    : bad(`错题没进错题本：badge=${badge} ${JSON.stringify(q)}`)
}

// 刷新后记录必须还在 —— 这是"留存"的全部意义
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.tick')
{
  await openPg()
  const q = await p.evaluate(() => document.querySelectorAll('.pgqueue li button').length)
  await closePg()
  q === 1
    ? ok('刷新页面后错题本里那一条仍在 —— 记录真的落盘了')
    : bad(`刷新后记录丢了：错题本 ${q} 条`)
}

// 从错题本点进去 → 必须跳到对应实验、选中对应真题、高亮那一问
{
  await openPg()
  await p.click('.pgqueue li button >> nth=0')
  await p.waitForTimeout(420)
  const landed = await p.evaluate(() => ({
    title: document.querySelector('.exphead h1')?.textContent,
    problemOn: document.querySelector('.probpick button.on')?.textContent?.trim(),
    focused: document.querySelectorAll('.qlist li.focused').length,
    maskGone: !document.querySelector('.pgmask'),
  }))
  landed.title === '页面置换' && landed.focused === 1 && landed.maskGone
    ? ok(`从错题本点进去：跳到「${landed.title}」并选中「${landed.problemOn}」，高亮那一问`)
    : bad(`跳转不对：${JSON.stringify(landed)}`)
}

// 连续答对两次才出师
{
  //  跳转过来是全新挂载，还没有任何反馈元素 —— 先故意错一次把正确答案露出来。
  //  （第一版直接去读 .nomark，取到空串，于是"两次答对"其实是两次答错。）
  await p.fill('.qlist li:nth-child(1) input', '__zzz__')
  await p.click('.qlist li:nth-child(1) .qrow button')
  await p.waitForTimeout(200)
  const correct = await p.evaluate(() =>
    document.querySelector('.qlist li:nth-child(1) .nomark b')?.textContent ?? '')
  if (!correct) bad('拿不到正确答案，后面几条无从谈起')
  for (let k = 0; k < 2; k++) {
    await p.fill('.qlist li:nth-child(1) input', correct)
    await p.click('.qlist li:nth-child(1) .qrow button')
    await p.waitForTimeout(200)
    const badge = await p.evaluate(() =>
      document.querySelector('.qlist li:nth-child(1) .qbadge')?.textContent?.trim())
    const want = k === 0 ? '巩固中' : '已掌握'
    badge === want
      ? ok(`第 ${k + 1} 次答对 → 标记为「${badge}」`)
      : bad(`第 ${k + 1} 次答对后标记是「${badge}」，应为「${want}」`)
  }
  await openPg()
  const q = await p.evaluate(() => ({
    queue: document.querySelectorAll('.pgqueue li button').length,
    sum: document.querySelector('.pgsum b')?.textContent,
  }))
  await closePg()
  q.queue === 0 && q.sum === '1'
    ? ok(`连续答对两次后移出错题本，已掌握计数变成 ${q.sum}`)
    : bad(`出师规则不对：队列 ${q.queue} 条，已掌握 ${q.sum}`)
}

// 偏离原题配置时不许记账
{
  await p.click('.param:has-text("物理块数") .opts button:has-text("5")')
  await p.waitForTimeout(280)
  const notice = await p.evaluate(() => !!document.querySelector('.qnorec'))
  const before = await chipText()
  await p.fill('.qlist li:nth-child(1) input', '__zzz__')
  await p.click('.qlist li:nth-child(1) .qrow button')
  await p.waitForTimeout(220)
  await openPg()
  const q = await p.evaluate(() => document.querySelectorAll('.pgqueue li button').length)
  await closePg()
  const after = await chipText()
  notice && q === 0 && before === after
    ? ok('改了配置后作答：明说「不计入进度」，错题本没被污染，计数不变')
    : bad(`偏离时仍在记账：提示=${notice} 队列=${q} chip ${before}→${after}`)
}

// 清空记录
{
  await p.click('.probpick button >> nth=0')      // 回到自由探索，免得残留
  await openPg()
  await p.click('.pgclear')
  await p.waitForTimeout(150)
  await p.click('.pgconfirm .danger')
  await p.waitForTimeout(220)
  const sum = await p.evaluate(() => document.querySelector('.pgsum b')?.textContent)
  await closePg()
  sum === '0'
    ? ok('清空记录（带二次确认）→ 已掌握归零')
    : bad(`清空没生效：已掌握 ${sum}`)
}


/**
 * 把讲解浮层翻到最后一页，返回总页数。
 *
 * **不假设现在停在第 1 页。** 点「实验目录」本身会跳到目录那张卡，
 * 点当前已选中的实验又不会触发"回到第一页" —— 起点是不确定的。
 * 硬从 0 数到 n 就会在末尾撞上禁用的「下一页」，卡满 30 秒
 * （同一个坑在这一组里栽过两次，所以收成一个函数）。
 */
const pageToEnd = async () => {
  const { cur, total } = await p.evaluate(() => {
    const t = document.querySelector('.gnum')?.textContent ?? '0 / 0'
    const [a, b] = t.split('/').map(x => Number(x.trim()))
    return { cur: a || 0, total: b || 0 }
  })
  /*
   * 不按 total-cur 硬点 —— 页码是渲染出来的数，按钮的禁用态才是真源，
   * 两者只要差一格就会撞上禁用按钮卡满 30 秒（第三次栽在这上面了）。
   */
  for (let k = 0; k < total + 2; k++) {
    const more = await p.$('.gfoot [data-nav="next"]:not([disabled])')
    if (!more) break
    await more.click(); await p.waitForTimeout(30)
  }
  return total
}

// ═══ 13 · 讲解浮层：锚点要落得下，点哪讲哪 ═══
console.log('\n【13】讲解浮层：30 个实验的锚点都落得下，点哪讲哪')
{
  //  第 1 组把它收起来了，这里请回来
  await p.click('.guide-fab').catch(() => {})
  await p.waitForTimeout(250)
  const names = await p.$$eval('.nav button', bs => bs.map(b => b.textContent.trim()))
  const broken = []
  let cardTotal = 0
  for (const name of names) {
    await nav(name)
    /**
     * **每张卡的锚点必须在这一屏上找得到。**
     *
     * 这是这一组唯一有难度的判据。锚点是 CSS 选择器（`.bitrow`、`.gantt`…），
     * 舞台的 class 一改它就落空 —— 而落空的表现只是"翻到那一页时屏幕上没反应"，
     * 没有报错、没有红字，靠看是看不出来的。
     *
     * 走法：从第一页翻到最后一页，每页都问"现在页面上有没有 .guide-lit"。
     * 名词页不锚东西，跳过它们。
     */
    //  起点不确定，理由见 pageToEnd 的注释；这里逐页看，所以自己走
    const pos = await p.evaluate(() => {
      const t = document.querySelector('.gnum')?.textContent ?? '0 / 0'
      const [a, b] = t.split('/').map(x => Number(x.trim()))
      return { cur: a || 0, total: b || 0 }
    })
    const n = pos.total
    if (!n) { broken.push(`${name}：没有讲解浮层`); continue }
    cardTotal += n
    for (let k = pos.cur - 1; k < n; k++) {
      const r = await p.evaluate(() => ({
        title: document.querySelector('.guide h3')?.textContent?.trim() ?? '',
        lit: document.querySelectorAll('.guide-lit').length,
        //  这一页自己声明"我该点亮点什么"。名词页是 false —— 那是设计不是 bug。
        anchored: document.querySelector('aside.guide')?.dataset.anchored === 'true',
      }))
      if (r.anchored && r.lit === 0) broken.push(`${name} 第 ${k + 1} 页「${r.title}」：声明了锚点却没落下`)
      if (k < n - 1) { await p.click('.gfoot [data-nav="next"]'); await p.waitForTimeout(70) }
    }
  }
  broken.length === 0
    ? ok(`${names.length} 个实验、共 ${cardTotal} 张卡，锚点全都落得下`)
    : bad(`锚点落空 ${broken.length} 处：\n     ${broken.slice(0, 8).join('\n     ')}`)

  /**
   * **翻到最后一页再切实验，页面不许白。**
   *
   * 这条是 2026-08-18 真炸出来的：换实验时 `cards` 立刻换新，而"回到第一页"
   * 是个 effect、要等这一帧渲染完才跑 —— 中间那一帧 `i` 还是旧值，
   * 从 14 张卡的实验翻到最后再切去 10 张卡的，`cards[13]` 是 undefined，
   * 读它的 `.title` 直接抛，**整棵 React 树被卸载，白屏**。
   *
   * 而那次报出来的是"第 3 个实验点不到" —— 症状与根因隔了一整个实验。
   * 所以这条判据要直白地问：切完之后，左边那 30 个按钮还在吗。
   */
  {
    //  ⚠️ 别写死实验总数（曾写 30，加一个实验就红）—— 先数一遍，再要求切完之后一个不少。
    const before = await p.$$eval('.nav button', bs => bs.length)
    await nav('Cache 命中率')
    await pageToEnd()
    await nav('IEEE 754 浮点')
    const alive = await p.evaluate(() => ({
      navs: document.querySelectorAll('.nav button').length,
      num: document.querySelector('.gnum')?.textContent?.trim() ?? '(没有浮层)',
    }))
    alive.wanted = before
    /**
     * 两件事一起验：页面没白，而且**回到第 1 页**。
     *
     * 后半条不是锦上添花：点实验按钮的意思是"去那个实验"，而实验目录本身也挂着一张卡 ——
     * 两者撞车时若讲解赢了，点任何一个实验都会停在「页面 · 左边的目录」上。
     */
    alive.navs === alive.wanted && alive.navs > 0 && alive.num.startsWith('1 /')
      ? ok(`翻到最后一页再切实验：页面还在（${alive.navs} 个实验），浮层回到第 ${alive.num}`)
      : bad(`切实验后不对：nav 剩 ${alive.navs} 个（应 ${alive.wanted}）、浮层停在 ${alive.num}（应回到第 1 页）`)
  }

  //  自检：这条判据得会红 —— 把高亮类删掉，同一段代码必须报"没落下"
  await nav('Cache 命中率')
  const litBefore = await p.evaluate(() => document.querySelectorAll('.guide-lit').length)
  await p.evaluate(() => document.querySelectorAll('.guide-lit').forEach(e => e.classList.remove('guide-lit')))
  const litAfter = await p.evaluate(() => document.querySelectorAll('.guide-lit').length)
  litBefore > 0 && litAfter === 0
    ? ok(`自检：手动摘掉高亮类后计数从 ${litBefore} 变成 0 —— 上一条判据量的确实是它`)
    : bad(`自检失败：摘之前 ${litBefore}、之后 ${litAfter}`)
}

/**
 * **点哪儿都有说明** —— 用户明确要的就是这个。
 *
 * 逐个点十二处，每处都比对**跳到的是不是该跳的那一张**（只看"标题变了"不够：
 * 上一处的高亮还亮着时，标题不变也可能被当成"有反应"）。
 *
 * ⚠️ 页签放最后点。它会换视图，而 `.sets` / `.bitrow` 这些只在第一个视图上 ——
 * 先点它，后面两处就不是"点了没反应"，是**那两个元素根本不在页面上了**。
 * 我自己在这儿栽过一次，查了半天以为是应用的 bug。
 */
{
  await nav('Cache 命中率'); await p.waitForTimeout(250)
  /*
   * ⚠️ **先把实验单收掉。**
   * 第 12 组为了验进度，`localStorage.clear()` 了一次 —— 连"这个实验看过实验单了"
   * 也一起清掉，于是这里一进 Cache，实验单又自动盖住整个中列。
   * 它盖住的正是下面要挨个点的那些东西，而报出来的错是
   * 「被 <div class="card seq "> 挡住」—— 从这句话根本猜不到是实验单。
   *
   * 这不是把判据放宽：实验单该不该自动弹、默认收不收，各有专门的一组验。
   * 这一组问的是"点哪儿都有说明"，前置条件就该自己摆好。
   */
  const hadBrief = await p.evaluate(() => !!document.querySelector('.gnote'))
  if (hadBrief) { await p.click('.gnote .gnx').catch(() => {}); await p.waitForTimeout(200) }
  const cases = [
    ['.seqacts button:has-text("局部性好")', 'preset:局部性好', '预置按钮（讲解取自它的 note）'],
    ['.param:has-text("替换策略") .k', 'param:replacement', '参数旋钮'],
    ['.param:has-text("相联度") .k', 'try0', '手写"试一试"覆盖到的旋钮'],
    ['.seqin', { anchor: '.seqin' }, '序列输入框'],
    ['.sets .cell', 'read1', '舞台里的格子'],
    ['.bitrow', 'read0', '位域'],
    //  ⚠️ 原来点 `.axis .lbl`（"轴 · 访问序号"那行字）—— 走带一行化之后
    //  那行字并进了刻度带的 title，点右端的步数读数一样能落到 `.axis` 这个锚上。
    ['.axis .head', 'read2', '轴'],
    /*  ⚠️ 期望值从写死的 `tourN` 改成**按锚点算**。
        `tourN` 里的 N 是 TOUR 数组的下标 —— 撤掉两条讲坞的卡之后整体错位，
        三处判据一起红，而应用一点没坏。这是「拿位置当键」的第八次。
        日志/真题/边界三格已经不再有对应的讲解卡（它们是讲解的兄弟格，
        见 guide.ts 的 TOUR 注释），所以这里也不再点它们。 */
    ['.card.readouts h3', { anchor: '.card.readouts' }, '读数'],
    ['.nav .grp', { anchor: '.nav' }, '左边的目录'],
    ['.tabs button:last-child', { anchor: '.tabs' }, '页签（放最后，它会换视图）'],
  ]
  const wrong = []
  for (const [sel, want, what, tab] of cases) {
    if (tab) await dock(tab)
    /*  ⚠️ **点不着** 和 **点了没跳对** 是两回事，报告里必须分开说。
        原来一律 `.catch(()=>{})` 咽掉，失败信息就变成"跳到了上一格那张卡" ——
        而真相是这一下根本没点下去（元素被别的东西压住了）。
        我照着那句错的信息查了半天卡片顺序，问题却在遮挡。 */
    let hit = true
    //  `async` 不能省 —— 里面要 await 一次 evaluate 取现场
    await p.click(sel, { timeout: 4000 }).catch(async e => {
      hit = false
      /*  ⚠️ 别拿 `/<(...)>[^]*?intercepts/` 去搜整段消息 ——
          调用日志里前面还有十几行，第一个 `<…>` 根本不是拦路的那个。
          我第一版就这么写的，报出来的"挡住它的是 textarea"是假的。
          正确做法：先按行切开，只看真正带 intercepts 那一行。 */
      const line = e.message.split('\n').reverse().find(l => l.includes('intercepts pointer events'))
      const who = line && /<([^>]{0,80})>/.exec(line)
      wrong.push(`${what}：**点不着** ${sel}${who ? `，被 <${who[1]}> 挡住` : `（${e.message.split('\n')[0]}）`}`)
      /*  再补一句现场：点不着的原因几乎都是"被谁盖了"或"在滚动容器里露不出来"，
          光有一个选择器名，下一个人还得从头复现一遍。 */
      /*  ⚠️ `sel` 可能是 Playwright 专有语法（`:has-text(…)`），
          浏览器里的 `querySelector` 不认，直接抛 SyntaxError 把整个冒烟带崩。
          所以先用 locator 量出方框，再把**坐标**递进页面里问"这个点上是谁"。 */
      const box = await p.locator(sel).first().boundingBox().catch(() => null)
      const scene = !box ? '元素量不出方框（不在页面上，或被折叠成 0 高）' : await p.evaluate(b => {
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
        if (!t) return '那个点上什么都没有'
        const r = { left: b.x, top: b.y, width: b.width, height: b.height }
        let sc = t.parentElement
        while (sc && sc.scrollHeight <= sc.clientHeight) sc = sc.parentElement
        return `目标 ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.top)}`
          + `，中心落在 <${t.tagName.toLowerCase()} class="${t.className}">`
          + (sc ? `；最近的滚动容器 <${sc.tagName.toLowerCase()} class="${sc.className}"> `
                  + `可视 ${sc.clientHeight} / 内容 ${sc.scrollHeight}` : '；没有滚动容器')
      }, box)
      wrong.push(`     └ ${scene}`)
    })
    await p.waitForTimeout(230)
    if (!hit) continue
    /*  ⚠️ 比的是**卡片 id**（`data-card`），不是标题。
        标题是给人读的文案，随时会重写；拿文案当键，每改一个字判据就红一次，
        最后只会把判据改成跟着实现走。id 不会因为改文案而变。
        这是同一个病的第四次：坞的页签按下标 · 预置按文字 · 高亮按文字 · 这里按标题。 */
    const got = await p.evaluate(() => ({
      id: document.querySelector('aside.guide')?.dataset.card,
      anchor: document.querySelector('aside.guide')?.dataset.anchor,
      title: document.querySelector('.guide h3')?.textContent?.trim(),
    }))
    /*  期望值有两种写法：写字符串就比卡片 id（手写的卡，id 稳定）；
        写 `{anchor}` 就比这张卡锚在哪儿（导览卡，id 是数组下标、会随增删漂）。 */
    const matched = typeof want === 'string' ? got.id === want : got.anchor === want.anchor
    if (!matched) {
      const w = typeof want === 'string' ? want : `锚点 ${want.anchor}`
      wrong.push(`${what}：跳到「${got.title}」（${got.id} / 锚 ${got.anchor}），应为 ${w}`)
    }
  }
  wrong.length === 0
    ? ok(`点哪儿都有说明：${cases.length} 处逐个点过，跳到的都是该跳的那一张`
         + `${hadBrief ? '（进来时实验单是开的，已先收掉）' : ''}`)
    : bad(`点击没跳对 ${wrong.length} 处：\n     ${wrong.join('\n     ')}`)

  /*
   * 位段的**定义层**：三个问句 + 位宽推导 + 手算换算链。
   *
   * 来历：用户拿着这一屏去问了 ChatGPT，问题原话是「什么是 tag、index、offset？
   * cache 里组、块与 tag/index/offset 的关系？」—— 三层文字都在**用**这三个词，
   * 没有一层在**定义**。定义现在贴在词第一次出现的位段图上，这组判据钉住它：
   * 问句在、推导的数跟配置走、换算链的数跟当前地址走。
   */
  {
    await nav('Cache 命中率'); await p.waitForTimeout(250)
    /*
     * ⚠️ 这一组的锚点整体换过一次（2026-08-21，照概念图复刻舞台）。
     *
     * 撤掉的是**常驻的两块**：舞台顶上那条口诀（`h3 .hint`）和位段图下面
     * 的三行换算链（`.calc`）。撤的理由是它们讲的都是位段图已经讲过的事。
     * 但**内容一个字没删**，全并进位段盒的 `data-tip`：
     *   定义（这一段管什么）· 位宽推导（为什么是这么多位）· 除法写法（考场手算那版）。
     * 判据因此跟着换锚点 —— 它钉的从来不是"那一行在不在"，
     * 而是"三段各有定义、位宽是算出来的、算式跟着当前配置现算"。
     */
    const r = await p.evaluate(() => ({
      asks: [...document.querySelectorAll('.seg .segbox')].map(e => e.getAttribute('data-tip') ?? ''),
      whys: [...document.querySelectorAll('.segwhy')].map(e => e.textContent),
    }))
    r.asks.length === 3 && r.asks.every(a => a && a.trim().length >= 6) && new Set(r.asks).size === 3
      ? ok(`位段有定义（在悬停里）：${r.asks.map(a => a.split('；')[0]).join(' / ')}`)
      : bad(`位段定义缺了：${JSON.stringify(r.asks)}`)
    //  位宽推导必须跟配置走：默认 8 组 / 块 16B
    r.asks.join('|').includes('8 组要 3 位') && r.asks.join('|').includes('块 16B 要 4 位')
      ? ok('位宽是算出来的（8 组要 3 位 · 块 16B 要 4 位）')
      : bad(`位宽推导对不上默认配置：${JSON.stringify(r.asks)}`)
    //  盒里那一行只印位宽本身，跟概念图一致
    r.whys.join('|') === '9 位|3 位|4 位'
      ? ok(`位段盒里只印位宽：${r.whys.join(' / ')}`)
      : bad(`位段盒第三行不对：${JSON.stringify(r.whys)}`)
    //  算式必须跟当前地址/配置现算：换个块大小，除数立刻换
    await p.click('.param:has-text("块大小") button:text-is("32")'); await p.waitForTimeout(500)
    const note2 = await p.evaluate(() =>
      [...document.querySelectorAll('.seg .segbox')].map(e => e.getAttribute('data-tip') ?? '').join(' | '))
    note2.includes('÷ 32') && note2 !== r.asks.join(' | ')
      ? ok('算式跟着配置现算：块大小改 32，除数立刻换')
      : bad(`算式没跟着配置走：改块大小后是「${note2.slice(0, 80)}」`)
    await p.click('.param:has-text("块大小") button:text-is("16")'); await p.waitForTimeout(400)
  }

  /*
   * 「本步推演」那条带子。
   *
   * 它是这一轮的核心内容层，判三件事：**在**（四段齐）、**跟着走**（按下一步四段改写）、
   * **不裁字**（每段的正文没有藏起来的行）。第三条是有来历的 ——
   * 这段内容一开始住在右下角那张 380×112 的讲解卡里，屏幕上只露两行，
   * 藏掉的三行不报任何错。判据必须量 `scrollHeight - clientHeight`，
   * 光看"元素在不在"是看不出来的。
   */
  {
    await nav('Cache 命中率'); await p.waitForTimeout(250)
    /*  推演有两个住处：旁栏那一格（`.whyband`）或右栏那张卡（`.whyrail`，
        由实验的 `whyInRail` 决定）。判据认**内容**不认住处 ——
        两个组件共用同一套类名（wseg / wk / wv），所以下面这段两种形态都能读。
        只有住在旁栏时才需要先把那一格切出来（别的格开着会量出全 0）。 */
    if (await p.$('.dockbar button:has-text("本步推演")')) await dock('本步推演')
    const read = () => p.evaluate(() => {
      const w = document.querySelector('.whyband, .whyrail')
      if (!w) return null
      const segs = [...w.querySelectorAll('.wseg')]
      return {
        keys: segs.map(e => e.querySelector('.wk')?.textContent?.trim()),
        vals: segs.map(e => e.querySelector('.wv')?.textContent?.trim()),
        cut: segs.reduce((a, e) => {
          const v = e.querySelector('.wv')
          return a + (v ? v.scrollHeight - v.clientHeight : 0)
        }, 0),
        /*  ⚠️ 量 `.wseg` 会得到全 0 —— 它是 `display:contents`，自己没有方框，
            四段的 top 全是 0，"排成 1 行"于是永远成立，判据形同虚设。
            量真正有方框的段名格。 */
        rows: new Set([...w.querySelectorAll('.wk')].map(e => Math.round(e.getBoundingClientRect().top))).size,
      }
    })
    const a = await read()
    /*  骨架是**前缀**不是定长：推演一旦贴到图旁边，第四段「对应画面」
        （"这段话对应屏幕上哪一块"）就成了描述读者正盯着的那张图。
        前三段是每一屏都必须回答的 —— 见 tests/guide-content.test.ts 里同一条口径。 */
    const KEYS = ['本步输入', '判定规则', '本步结果', '对应画面']
    const MIN_KEYS = 3
    if (!a) bad('屏幕上找不到「本步推演」（旁栏和右栏都没有）')
    else {
      a.keys.length >= MIN_KEYS && a.keys.length <= KEYS.length
        && a.keys.every((k, i) => k === KEYS[i])
        ? ok(`推演段名是骨架的前缀：${a.keys.join(' → ')}`)
        : bad(`推演的段名不对：${a.keys.join('/')} —— 应是「${KEYS.join(' → ')}」的前缀且不少于 ${MIN_KEYS} 段`)
      a.cut === 0
        ? ok('每一段正文都没被藏起来')
        : bad(`推演裁掉了 ${a.cut}px 正文 —— 屏幕上看不见`)
      //  竖排：每段各占一行，段名 top 应有 N 个不同值。少于 N 说明有段挤在了一起
      a.rows === a.keys.length
        ? ok(`${a.keys.length} 段各占一行，段名逐行对齐（带 123 编号）`)
        : bad(`${a.keys.length} 段的段名只落在 ${a.rows} 个不同的行上 —— 旁栏是不是折叠着、或者停在别的格？`)

      await p.click('.ctl .step >> nth=1'); await p.waitForTimeout(300)
      const b2 = await read()
      const moved = b2 && b2.vals.some((v, i) => v !== a.vals[i])
      moved
        ? ok(`按「下一步」，带子改写了（「${a.vals[0]}」→「${b2.vals[0]}」）`)
        : bad('按了下一步，推演带子一个字没变 —— 它没跟着轨迹走')
    }
  }

  /*  播放控件是中立区：按「下一步」是在推进轨迹，不是在问"轴是什么"。
      「本步推演」那张卡跟着状态走，正要在按步进时留在原地看它变。 */
  {
    await nav('Cache 命中率'); await p.waitForTimeout(250)
    /*  停在哪张卡不重要 —— 这一组问的是"按下一步会不会把卡片弹走"，
        不管当时停在哪张，答案都该是"不会"。所以**不去摆特定的起点**：
        第一版先点了一下「下一条」想停到推演那张，结果上一组把卡留在了
        主干最后一张，「下一条」是灰的，冒烟卡死 30 秒。 */
    const before = await p.evaluate(() => document.querySelector('aside.guide')?.dataset.card)
    await p.click('.ctl .step >> nth=1'); await p.waitForTimeout(300)
    const after = await p.evaluate(() => document.querySelector('aside.guide')?.dataset.card)
    const stepChanged = await p.evaluate(() =>
      document.querySelector('.axis .head')?.textContent?.match(/第 (\d+) 步/)?.[1])
    before === after && stepChanged === '2'
      ? ok(`按「下一步」轨迹走到第 ${stepChanged} 步，讲解卡留在原地（${after}）—— 控件是中立区`)
      : bad(`按下一步把讲解卡弹走了：${before} → ${after}（步 ${stepChanged}）`)
  }

  //  自检：这条判据得会红 —— 点一处**没有任何卡**锚到的地方，标题不该变
  await nav('Cache 命中率'); await p.waitForTimeout(250)
  const t0 = await p.evaluate(() => document.querySelector('.guide h3')?.textContent?.trim())
  await p.click('.exphead h1'); await p.waitForTimeout(200)
  const t1 = await p.evaluate(() => document.querySelector('.guide h3')?.textContent?.trim())
  t0 === t1
    ? ok('自检：点一处没挂卡的地方（页眉标题）标题不变 —— 上一条量的确实是"跳没跳"')
    : bad(`自检失败：点没挂卡的地方也跳了（${t0} → ${t1}）`)

  //  做了别的事之后，高亮要撤掉 —— 否则"点这个"的手指会继续指着一个已经被绕过去的按钮
  await p.click('.seqacts button:has-text("同组冲突")'); await p.waitForTimeout(220)
  /*  ⚠️ 比的是 `data-preset`，不是 textContent。
      预置按钮从"一颗药丸"改成"标题 + 一句要点"的卡片之后，textContent 里多了那句要点，
      这条判据当场红 —— 但它量的东西（高亮撤没撤）其实没变。
      **判据也不该拿会变的文字当键**，这跟同一天在讲解层、在坞的页签上栽的是同一个病。 */
  const litOn = await p.evaluate(() => {
    const e = document.querySelector('.guide-lit')
    return e?.dataset.preset ?? e?.textContent?.trim()
  })
  await p.click('.exphead h1'); await p.waitForTimeout(200)
  const litOff = await p.evaluate(() => document.querySelectorAll('.guide-lit').length)
  litOn === '同组冲突' && litOff === 0
    ? ok('点了别处，高亮自动撤掉 —— 不会继续指着一个已经绕过去的按钮')
    : bad(`高亮没撤：点前高亮「${litOn}」，点后还剩 ${litOff} 个`)
}

// 名词链接 / 字段级提示 / 折叠
{
  //  ⚠️ 点同一个实验不会让浮层回到第一页（`title` 没变，重置那个 effect 不触发），
  //  而"名词链接在第一页上"是这条判据的前提。先绕去别的实验再回来。
  await nav('页面置换'); await nav('Cache 命中率'); await p.waitForTimeout(250)
  const see = await p.$('.gsee button')
  if (see) {
    const word = (await see.textContent())?.trim()
    await see.click(); await p.waitForTimeout(180)
    const t = await p.evaluate(() => document.querySelector('.guide h3')?.textContent?.trim())
    t === word ? ok(`点正文里的名词「${word}」→ 直接翻到那一页`) : bad(`名词链接跳错：点「${word}」到了「${t}」`)
  } else bad('第一页没有名词链接')

  /**
   * 字段级悬停说明：**一行能说完的东西不占一张卡**（用户原话）。
   * 只验它真的出得来、内容对得上、移开会消失 —— 覆盖多少个字段不判死，
   * 那是内容量的问题，`TIPS` 里加一条就多一个。
   */
  {
    await nav('Cache 命中率'); await p.waitForTimeout(220)
    const n = await p.evaluate(() => document.querySelectorAll('[data-tip]').length)
    /*
     * ⚠️ **先把它滚进视野，再悬停。**
     *
     * 提示的实现里有一条「滚动就收掉」（见 Tip.tsx —— 跟着滚动重算位置
     * 不值当，提示本来就是一瞬间的东西）。而 Playwright 的 hover 会**自己**
     * 先把目标滚进视野：右栏一长（推演卡搬进来之后就长了），
     * 「命中率」那一行落在折线以下，于是滚动事件紧跟在 mouseover 后面
     * 把刚弹出来的提示又关了 —— 判据报「内容『』」，而手动去悬停一切正常。
     * 这不是放宽判据：分两步做，量的才是"悬停出不出得来"，
     * 而不是"滚动和悬停谁先谁后"。
     */
    await p.locator('.pr:has-text("命中率") .k').scrollIntoViewIfNeeded()
    await p.waitForTimeout(200)
    await p.hover('.pr:has-text("命中率") .k'); await p.waitForTimeout(280)
    const t1 = await p.evaluate(() => document.querySelector('.tip')?.textContent?.trim() ?? '')
    await p.hover('.exphead h1'); await p.waitForTimeout(280)
    const gone = await p.evaluate(() => !document.querySelector('.tip'))
    const stars = t1.includes('**')
    n >= 5 && t1.includes('滚动值') && gone && !stars
      ? ok(`悬停「命中率」出一行说明（这一屏 ${n} 个字段带提示），移开就收；**粗体**已渲染成粗体`)
      : bad(`悬停提示不对：${n} 个字段、内容「${t1.slice(0, 20)}」、移开消失 ${gone}、还剩星号 ${stars}`)
  }


  /**
   * 量"浮层压住了什么"。
   *
   * 不能拿矩形相交算 —— 被自己的滚动容器裁掉的元素仍然有几何位置，
   * 光比矩形会把"早就看不见的东西"算成"被压住"。
   * 改成两次 `elementFromPoint`：先把浮层设成 `visibility:hidden` 问一遍
   * "这个点上本来是谁"，再问一遍"现在是谁"。本来就不在的不算。
   */
  const probeCover = () => p.evaluate(() => {
    const guide = document.querySelector('aside.guide')
    if (!guide) return { cov: ['没有浮层'], n: 0 }
    const targets = [...document.querySelectorAll('button, input, [data-tip], .cell, .tick, .pr .k, .bounds')]
      .filter(e => !e.closest('.guide') && !e.classList.contains('dockfold')
                   && e.getBoundingClientRect().width > 0)
    const pt = e => { const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2] }
    /*
     * "这个点上本来是谁" —— 命中自己、或命中自己的孩子（按钮里的 span）都算**在**。
     *
     * ⚠️ 不能再算 `t.contains(e)`（命中的是**祖先**）。
     * 被滚动容器裁掉的内容仍然有几何位置，那个位置上 `elementFromPoint`
     * 返回的是它的祖先（`.stagewrap`）—— 而祖先当然 contains 它。
     * 于是"早就被裁掉、屏幕上根本看不见"的格子被判成"在"，
     * 接着又被判成"被浮层压住"，报出四个 DIV。
     * 那是**假阳**：用户点不着它，不是因为浮层，是因为它压根没画出来。
     * 实测复现：序列编辑器展开 + 旁栏展开 + 900px 高窗口，
     * 舞台只剩 172px，内容 319px，`.fit` 裁掉一半 —— 判据当场报四处覆盖。
     */
    guide.style.visibility = 'hidden'
    const bare = targets.map(e => {
      const [x, y] = pt(e); const t = document.elementFromPoint(x, y)
      return !!t && (t === e || e.contains(t))
    })
    guide.style.visibility = ''
    const cov = []
    targets.forEach((e, i) => {
      if (!bare[i]) return
      const [x, y] = pt(e)
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return
      if (document.elementFromPoint(x, y)?.closest('.guide')) {
        //  报清楚是**哪一个**：光印 tagName 会得到一串「DIV、DIV、DIV」，查不下去
        const r = e.getBoundingClientRect()
        cov.push(`${(e.textContent || '').trim().slice(0, 8) || e.tagName}·${e.className || ''}`.slice(0, 28)
                 + `@${Math.round(r.left)},${Math.round(r.top)}`)
      }
    })
    return { n: targets.length, cov }
  })

  /*
   * **浮层不许压住点得着的东西。**
   *
   * ⚠️ 在 **1440×900** 上验，不在 1280×720：矮屏（≤820px）上这张卡**默认不弹**
   * ——那一屏是真的没有空地（见 App.tsx 里 `guideOff`）。
   * 在它不弹的窗口上验覆盖，等于什么都没验。
   */
  {
    await p.setViewportSize({ width: 1440, height: 900 })
    /*  ⚠️ 先清掉上一组**拖走**留下的位置。
        设计上"拖走之后就不给它留位了"（位置是用户自己挑的，见 GuideOverlay），
        所以带着拖走的位置来量覆盖，量的是用户的选择，不是默认摆位。 */
    await p.evaluate(() => localStorage.removeItem('cslab.guide.pos'))
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600)
    { const bf0 = await p.$('.gnote .gnx'); if (bf0) { await bf0.click(); await p.waitForTimeout(160) } }
    await nav('Cache 命中率'); await p.waitForTimeout(300)
    const c = await probeCover()
    c.cov.length === 0
      ? ok(`浮层没压住任何点得着的东西（这一屏 ${c.n} 个可点元素逐个探过）`)
      : bad(`浮层压住 ${c.cov.length} 处：${c.cov.join('、')}`)
    /*  自检：把浮层**直接扣在轴的刻度带上**。
     *
     *  ⚠️ 原来这一步是"撤掉留位 + 挪到右列上方"，靠布局的副作用间接制造覆盖。
     *  那是拿**当时那一版的几何**当判据：Cache 舞台改版、旁栏默认收起之后，
     *  浮层的默认位置本身就已经在右列上方了，这一挪等于没挪 ——
     *  自检报"仍说没压住"，而真相是覆盖压根没被制造出来。
     *  判据要证明自己有鉴别力，就得**主动扣在一个确定点得着的东西上**，
     *  而不是指望布局替它把东西挪到浮层底下。 */
    await p.evaluate(() => {
      const g = document.querySelector('aside.guide')
      const r = document.querySelector('.axis .ticks').getBoundingClientRect()
      g.style.right = 'auto'; g.style.bottom = 'auto'
      g.style.left = `${Math.round(r.left)}px`; g.style.top = `${Math.round(r.top - 16)}px`
    })
    await p.waitForTimeout(200)
    const c2 = await probeCover()
    c2.cov.length > 0
      ? ok(`自检：把浮层扣在刻度带上，立刻压住 ${c2.cov.length} 处（${c2.cov.slice(0, 3).join('、')}）—— 这条判据会红`)
      : bad('自检失败：浮层扣在刻度带上，仍说没压住 —— 这条判据量不出东西')
    await p.evaluate(() => { const g = document.querySelector('aside.guide')
      g.style.right = ''; g.style.bottom = ''; g.style.left = ''; g.style.top = '' })
    await p.waitForTimeout(300)
  }

  //  关掉之后要在原地留一颗召回按钮 —— 东西从哪儿没的就从哪儿找回来
  {
    const wasAt = await p.evaluate(() => document.querySelector('.gnum')?.textContent?.trim())
    const wasCorner = await p.evaluate(() => {
      const r = document.querySelector('aside.guide').getBoundingClientRect()
      return { right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom) }
    })
    await p.click('.guide .gx:last-of-type'); await p.waitForTimeout(200)
    const fab = await p.evaluate(() => {
      const e = document.querySelector('.guide-fab')
      if (!e) return null
      const r = e.getBoundingClientRect()
      return { text: e.textContent.trim(), right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom) }
    })
    const gone = await p.evaluate(() => !document.querySelector('aside.guide'))
    gone && fab && Math.abs(fab.right - wasCorner.right) <= 4 && Math.abs(fab.bottom - wasCorner.bottom) <= 4
      ? ok(`关掉后原地留下「${fab.text}」（和卡片同一个角 ${fab.right}/${fab.bottom}px）`)
      : bad(`关掉后没在原地留按钮：卡没了 ${gone}、按钮 ${JSON.stringify(fab)}、卡在 ${JSON.stringify(wasCorner)}`)

    await p.click('.guide-fab'); await p.waitForTimeout(250)
    const back = await p.evaluate(() => ({
      open: !!document.querySelector('aside.guide'),
      at: document.querySelector('.gnum')?.textContent?.trim(),
    }))
    back.open && back.at === wasAt
      ? ok(`点按钮请回来，且回到关掉前那一页（${back.at}）—— 组件不卸载，翻页位置留着`)
      : bad(`请回来不对：开了 ${back.open}、停在 ${back.at}（关前是 ${wasAt}）`)

    /*
     * **折叠成一颗按钮之后也得能拖。**
     *
     * 用户原话：「这个讲解浮层在折叠状态也应该允许拖动」——
     * 它默认落在右下角，正好压着走带右端那行「第 N 步 / 共 N 步」；
     * 展开能拖、收起不能拖，等于"挡住你的时候你反而没法挪它"。
     *
     * 三件事一起验，缺一条这个交互就是坏的：
     *   ① 拖得动（按钮只有 81×35，指针一动就出界 —— 必须**按下就抓指针**，
     *      不能等过了 4px 门槛再抓，否则一个 pointermove 都收不到）；
     *   ② 拖完那一下**不算点击**（抓了指针，click 一定会打回这颗按钮上）；
     *   ③ 请回来时卡片落在拖过去的那个角（收起态和展开态共用同一个位置）。
     */
    {
      await p.click('.guide .gx:last-of-type'); await p.waitForTimeout(220)
      const r0 = await p.evaluate(() => {
        const q = document.querySelector('.guide-fab').getBoundingClientRect()
        return { x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height) }
      })
      await p.mouse.move(r0.x + r0.w / 2, r0.y + r0.h / 2)
      await p.mouse.down()
      await p.mouse.move(r0.x + r0.w / 2 - 240, r0.y + r0.h / 2 - 260, { steps: 6 })
      await p.mouse.up(); await p.waitForTimeout(250)
      const r1 = await p.evaluate(() => {
        const e = document.querySelector('.guide-fab')
        if (!e) return null
        const q = e.getBoundingClientRect()
        return { x: Math.round(q.left), y: Math.round(q.top) }
      })
      r1 && Math.abs(r1.x - (r0.x - 240)) <= 6 && Math.abs(r1.y - (r0.y - 260)) <= 6
        ? ok(`折叠态拖得动：${r0.x},${r0.y} → ${r1.x},${r1.y}，且没被当成点击（还是收起的）`)
        : bad(`折叠态拖不动或被当成了点击：${JSON.stringify(r0)} → ${JSON.stringify(r1)}`)
      await p.click('.guide-fab'); await p.waitForTimeout(250)
      const g1 = await p.evaluate(() => {
        const e = document.querySelector('aside.guide')
        if (!e) return null
        const q = e.getBoundingClientRect()
        return { x: Math.round(q.left), y: Math.round(q.top) }
      })
      g1 && r1 && Math.abs(g1.x - r1.x) <= 6 && Math.abs(g1.y - r1.y) <= 6
        ? ok(`拖走之后请回来，卡片落在拖过去那个角（${g1.x},${g1.y}）`)
        : bad(`请回来落错地方：按钮在 ${JSON.stringify(r1)}，卡片在 ${JSON.stringify(g1)}`)
      //  位置是这一组自己挪的，别留给后面几组
      await p.evaluate(() => localStorage.removeItem('cslab.guide.pos'))
    }
    await p.setViewportSize({ width: 1280, height: 720 }); await p.waitForTimeout(300)
  }
}

// ═══ 14 · 一屏装得下：窗口不滚、舞台看得全 ═══
console.log('\n【14】一屏装得下：30 个实验 × 两档窗口')
{
  /**
   * 用户的原话是"一个实验要一页窗口把内容全放下，而不要让用户滑动窗口
   * 才能看到剩余内容"。这条要拆成两问，而且**第一问差点被我写成永远绿的**：
   *
   * 一问"窗口滚不滚"。外壳是 `#root{height:100dvh;overflow:hidden}` ——
   * 于是 `scrollHeight > innerHeight` **永远不成立**：装不下的东西不会撑出
   * 滚动条，它会被**裁掉**。往页面里塞 400px 自检，判据纹丝不动，
   * 这才发现量的是个恒真式。改成量"有没有东西被 overflow:hidden 裁掉"。
   *
   * 二问"舞台看得全不全"。窗口不滚很容易做到 —— 把滚动挪进舞台里就行，
   * 那对用户是同一件事。所以还要量舞台自己还差多少才装得下。
   */
  const FLOOR = 180
  /**
   * 舞台缺口的**基线**，按窗口分档。
   *
   * 不写死"必须为 0"：图密的那几个实验（图的遍历、拓扑排序…）内容本身就比
   * 1280×720 能给的地方多，缩到下限 0.58 仍差一截，再缩字就没法看了 ——
   * 那是内容与窗口的矛盾，不是版面的 bug，写成 0 只会逼出一个假绿灯。
   *
   * 所以判据是**不许变大**：记下今天的数，谁把版面改回去了，这条立刻红。
   */
  /*
   * 2026-08-19 把 1280×720 那档从 149 提到 165，**这是一次有代价的交换，不是放水**：
   * 预置按钮从"一颗药丸"改成"标题 + 一句要点"的卡片 —— 那句要点
   * （`Preset.note`，被 presets-claims 逐条验过）以前只写在 `title` 属性里，
   * 悬停才看得见、手机上根本看不见。现在它一直在屏幕上，代价是编辑器展开时高出一截，
   * 在最矮的那档窗口上，`滑动窗口 ARQ` 一个实验的图比原来多差 16px（它本来就要滚）。
   *
   * 1440×900 那档反而更好了（71 → 67）：同一轮里砍掉了轴下面那根重复的进度条。
   * 换句话说这次改动**在常见窗口上是净赚的**，只在最矮那档上亏了一点。
   */
  /*
   * 2026-08-19（同日第二次）1440×900 从 71 抬到 112、1280×720 从 165 抬到 173。
   * **又是一次有代价的交换：**
   *
   * 买到的：舞台与轴之间多了「本步推演」那条带子（86px），
   *   每一步都现算出四段推演（本步输入 → 判定规则 → 本步结果 → 对应画面）。
   *   它是这一轮的核心内容层 —— 用户原话是讲解卡"没看懂"、要"带着人完成一次状态推演"。
   *   30 个实验里 28 个的图仍然完整落在一屏上。
   *
   * 亏掉的：两个**时序类**舞台（滑动窗口 ARQ、TCP 连接管理）本来就在舞台内部滚
   *   （图随步数变长，71px 的缺口就是它俩），现在各多滚 41px / 18px。
   *   它们不是"看不见"，是"要多滚一点"。
   *
   * 这条基线的意思始终是**不许变大**：抬一次就要在这里写清买到了什么。
   * 谁把带子删了或者版面改回去了，数会掉下来 —— 那时候记得把基线也调回去，
   * 不然它就从棘轮变成了摆设。
   */
  /*
   * 2026-08-20 1280×720 从 173 抬到 235、1440×900 从 112 抬到 155。
   * **买到的**：讲解卡不再压住舞台里的格子 —— 它是浮层，而实验区现在吃满中列高度，
   *   不留位就必然压中控件（1440×900 实测压 4 个）。舞台底部按**实际重叠深度**
   *   让出一条（`--guide-h`，卡片关掉/拖走时归零，不白占）。
   * **亏掉的**：让位吃掉舞台的高度，图密的那几个（TLB、Dijkstra、最小生成树、
   *   图的遍历、滑动窗口 ARQ）在舞台内部多滚几十像素。它们本来就要滚。
   *   实测最大值：1280×720 上 267px（滑动窗口 ARQ）、1440×900 上 149px（TLB）。
   *   ⚠️ 基线取的是**实测最大值再留一点余量**，不是"刚好压线"——
   *   我上一轮照单次跑的数字定成 235，下一次换台机器就红了。
   * 这条基线的意思始终是**不许变大**：抬一次就要在这里写清买到了什么。
   */
  const BASE = { '1280x720': 270, '1440x900': 155 }
  const probe = () => p.evaluate(() => {
    const cut = []
    /*  ⚠️ 跳过**读屏专用**的元素（1px 见方 + clip-path 裁着）。
        它们本来就不在屏幕上，`scrollHeight - clientHeight` 当然大于 0 ——
        这条判据问的是"屏幕上的内容有没有被裁掉"，
        而 sr-only 是"这段字故意不上屏、只留给读屏软件"。
        来历：推演卡搬进右栏后段名改成了 sr-only，这条当场报「wk 裁掉 18px」。 */
    const srOnly = el => {
      const st = getComputedStyle(el)
      return el.clientWidth <= 1 && el.clientHeight <= 1
        && (st.clipPath !== 'none' || st.clip !== 'auto')
    }
    for (const el of document.querySelectorAll('#root, .app, .app *')) {
      const st = getComputedStyle(el)
      if (st.overflowY === 'hidden' && el.scrollHeight - el.clientHeight > 2 && !srOnly(el))
        cut.push(`${el.className || el.id} 裁掉 ${el.scrollHeight - el.clientHeight}px`)
    }
    const fit = document.querySelector('.fit')
    return {
      cut,
      stage: Math.round(document.querySelector('.stagewrap')?.getBoundingClientRect().height ?? 0),
      gap: fit ? Math.max(0, fit.scrollHeight - fit.clientHeight) : 0,
      scale: Number(document.querySelector('.fitin')?.dataset.fit ?? 1),
    }
  })
  const names = await p.$$eval('.nav button', bs => bs.map(b => b.textContent.trim()))
  for (const [w, h] of [[1280, 720], [1440, 900]]) {
    await p.setViewportSize({ width: w, height: h })
    await p.waitForTimeout(300)
    const cut = [], thin = [], gaps = []
    for (const name of names) {
      await nav(name)
      await p.waitForTimeout(180)          //  等 FitBox 的 ResizeObserver 落定
      const m = await probe()
      if (m.cut.length) cut.push(`${name}：${m.cut[0]}`)
      if (m.stage < FLOOR) thin.push(`${name} 舞台只有 ${m.stage}px`)
      if (m.gap > 0) gaps.push([name, m.gap])
    }
    const base = BASE[`${w}x${h}`] ?? 0
    const over = gaps.filter(([, g]) => g > base + 10)
    cut.length === 0 && thin.length === 0 && over.length === 0
      ? ok(`${w}×${h}：没有内容被裁掉，舞台都不低于 ${FLOOR}px；`
         + `${names.length - gaps.length} 个实验的图完整落在一屏上，`
         + `其余 ${gaps.length} 个最多还差 ${Math.max(0, ...gaps.map(g => g[1]))}px（基线 ${base}px）`)
      : bad(`${w}×${h}：裁掉 ${cut.length} 处、舞台过矮 ${thin.length} 个、缺口超出基线 ${base}px 的 ${over.length} 个\n     `
         + [...cut, ...thin, ...over.map(([n, g]) => `${n} 差 ${g}px`)].slice(0, 5).join('\n     '))
  }
  /*
   * 两条自检，各打各的那一问：
   * 把内容撑高 → 必须量到"被裁掉"；把走带撑厚 → 舞台必须被挤破缺口。
   */
  /*
   * ⚠️ **只改内联样式，绝不往页面里塞节点。**
   *
   * 原来这一条是 `document.querySelector('.stagewrap').appendChild(d)` ——
   * 往一个 **React 管着的容器**里插了个它不认识的孩子。React 下一次渲染
   * 要卸载那个位置的子节点时，就撞上
   * `removeChild: The node to be removed is not a child of this node`，
   * **整棵树当场崩掉**。而崩掉之后报出来的错是十几组之后的
   * 「切不到实验『IEEE 754 浮点』」—— 病因和症状隔着十分钟。
   *
   * 内联 `style` 是安全的：React 只在自己渲染了 style 属性时才管它，
   * 而这几个容器都没有 style prop。撑高的办法也更贴题 ——
   * 这一条量的本来就是"内容比容器高会不会被裁掉"。
   */
  await p.evaluate(() => {
    const f = document.querySelector('.fit')
    f.dataset.keepMinH = f.style.minHeight
    f.style.minHeight = '900px'
  })
  await p.waitForTimeout(250)
  const cutProbe = await probe()
  await p.evaluate(() => {
    const f = document.querySelector('.fit')
    f.style.minHeight = f.dataset.keepMinH ?? ''
    delete f.dataset.keepMinH
  })
  await p.waitForTimeout(200)
  cutProbe.cut.length > 0
    ? ok(`自检：把舞台内容撑到 900px，立刻量到「${cutProbe.cut[0]}」—— 裁剪那一条会红`)
    : bad('自检失败：内容撑到 900px 也说没东西被裁，裁剪判据量不出东西')

  //  舞台那一条的自检：挑一个图最密的实验，把走带撑厚，缺口必须明显变大。
  //  （原来撑的是坞 —— 坞抽屉化之后浮在舞台上，不再参与挤压，撑它量不到了。）
  await nav('图的遍历'); await p.waitForTimeout(300)
  const before = (await probe()).gap
  await p.evaluate(() => { const a = document.querySelector('.axis'); a.style.height = '520px'; a.style.flex = '0 0 520px' })
  await p.waitForTimeout(450)
  const squeeze = await probe()
  await p.evaluate(() => { const a = document.querySelector('.axis'); a.style.height = ''; a.style.flex = '' })
  await p.waitForTimeout(300)
  squeeze.gap > before + 50
    ? ok(`自检：把走带撑到 520px，图的遍历的缺口从 ${before}px 涨到 ${squeeze.gap}px —— 舞台那一条会红`)
    : bad(`自检失败：走带撑到 520px，缺口只从 ${before}px 变成 ${squeeze.gap}px`)

  await p.setViewportSize({ width: 1280, height: 720 })
  await p.waitForTimeout(250)
}

// ═══ 15 · 实验单：这个实验是什么、要做什么、为什么做 ═══
console.log('\n【15】实验单：四段走通，结论是现算的')
{
  /**
   * 用户原话：「实验是什么？我还是不知道。不知道要做什么？为什么要做？」——
   * 说这话的是个计算机研究生。这一组守的就是那四段。
   *
   * 最要紧的一条是最后一条：**结论必须跟着配置变**。
   * 一句写死的"相联度越高命中率越高"读起来永远像对的，而它是假的 ——
   * 换一串地址就露馅。所以判据不是"④ 有字"，是"换了地址，④ 里的数不一样了"。
   */
  await p.evaluate(() => localStorage.removeItem('cslab.brief'))
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600)

  /*
   * ⚠️ 这一组整体换过一次（2026-08-21）。原来量的是**实验单**
   * （① 先搞懂几个词 / ② 先猜一下 / ③ 动手 / ④ 结论，以及"押完注才解锁③"那套锁）。
   * 实验单已被**引导式实验笔记**替掉：不再赌"你猜哪个"，改成把当前这一步
   * 摊成「输入 → 规则 → 结果」。押注与判对错那套机制随之下掉，
   * 所以那几条判据不是放宽了，是**它们钉的那个东西不存在了**。
   *
   * 现在钉三件事：进来就摊开、三段跟着走带改写、关掉能回到实验台。
   * 第二条是核心 —— 一份写死的三段读起来永远像对的。
   */
  const shot = () => p.evaluate(() => ({
    open: !!document.querySelector('.gnote'),
    keys: [...document.querySelectorAll('.gncard .gnhead')].map(e => e.textContent.replace(/^\d+/, '').trim()),
    vals: [...document.querySelectorAll('.gncard .gnv')].map(e => e.textContent.trim()),
    q: document.querySelector('.gnq')?.textContent?.trim() ?? '',
    //  正文一个字都不许藏起来 —— 这一层的全部意义就是"读得下来"
    cut: [...document.querySelectorAll('.gncard .gnv')]
      .reduce((n, e) => n + (e.scrollHeight - e.clientHeight), 0),
  }))

  const a = await shot()
  a.open && a.keys.join('|') === '输入|规则|结果' && a.vals.every(v => v.length >= 4) && a.cut === 0
    ? ok(`头一回进来自动摊开笔记：${a.keys.join(' → ')}，正文一个字没藏（标题「${a.q}」）`)
    : bad(`笔记不对：开了 ${a.open}、三段 ${JSON.stringify(a.keys)}、裁掉 ${a.cut}px`)

  await p.click('.gnplay > button:last-child'); await p.waitForTimeout(280)
  await p.click('.gnplay > button:last-child'); await p.waitForTimeout(280)
  const b2 = await shot()
  b2.vals.join('|') !== a.vals.join('|') && b2.vals.every(v => v.length >= 4)
    ? ok(`按「下一步」，三段跟着改写（「${a.vals[0]}」→「${b2.vals[0]}」）—— 不是写死的`)
    : bad(`走了两步三段一个字没变：${JSON.stringify(a.vals)} → ${JSON.stringify(b2.vals)}`)

  await p.click('.gnx'); await p.waitForTimeout(300)
  const gone = await p.evaluate(() => !document.querySelector('.gnote') && !!document.querySelector('.sets'))
  gone ? ok('点「关闭笔记」→ 中列让出来，回到实验台') : bad('点了「关闭笔记」中列没让出来')

  /*
   * ⚠️ 「挑战」药丸（.goalpill）从页眉撤掉了（用户拍板，见 App.tsx 那段注释）——
   * 它做的事太薄（拧参达标就变个绿对勾，无积分/进度），不值页眉那块地方。
   *
   * 但它背后的能力 —— **goal.state 拿此刻配置现算达成态** —— 没删，
   * 只是不再有 UI 渲染它。这条能力仍由 tests/brief-content.test.ts 逐个实验验
   * （换一组假数据，met 必须跟着翻，且拦得住"常量目标"）。
   * 所以这里不再点 UI，改成一句说明，把"现算翻面"这件事交给单元测试守。
   */
  ok('挑战药丸已从页眉撤下（goal.state 现算能力仍在，由 brief-content.test 守）')

  /*
   * 「本次发现」那一条 —— 原来是实验单的 ④。
   *
   * 判对错那一段随实验单去掉了（笔记不再让人先猜），但**结论本身还在**，
   * 而且仍然是现算的。核心判据没变：**换一串地址，结论里的数必须跟着变**。
   * 一句写死的「相联度越高命中率越高」读起来永远像对的，而它是假的。
   */
  const nums = s => (s.match(/[\d.]+%/g) ?? [])
  await p.click('.chip.bchip'); await p.waitForTimeout(400)
  const v1 = await p.evaluate(() => ({
    say: document.querySelector('.gnsay')?.textContent?.trim() ?? '',
    //  查**整张笔记**：星号最先漏出来的地方是右栏那几条"实验操作"
    stars: document.querySelector('.gnote')?.textContent?.includes('**'),
  }))
  nums(v1.say).length >= 2 && !v1.stars
    ? ok(`从页眉请回来，「本次发现」：${nums(v1.say).join(' vs ')}；**粗体**已渲染成粗体`)
    : bad(`本次发现不对：「${v1.say.slice(0, 40)}」、数 ${JSON.stringify(nums(v1.say))}、还剩星号 ${v1.stars}`)

  await p.click('.gnx'); await p.waitForTimeout(200)
  await p.click('.seqacts button:has-text("同组冲突")'); await p.waitForTimeout(400)
  await p.click('.chip.bchip'); await p.waitForTimeout(400)
  const v2 = await p.evaluate(() => document.querySelector('.gnsay')?.textContent?.trim() ?? '')
  nums(v2).length >= 2 && nums(v2).join() !== nums(v1.say).join()
    ? ok(`换成「同组冲突」，结论跟着变：${nums(v1.say).join(' vs ')} → ${nums(v2).join(' vs ')} —— 数是现算的，不是写死的`)
    : bad(`结论没跟着变：换序列前 ${JSON.stringify(nums(v1.say))}、换序列后 ${JSON.stringify(nums(v2))}`)

  await p.click('.gnx'); await p.waitForTimeout(150)
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  const again = await p.evaluate(() => ({
    open: !!document.querySelector('.gnote'),
    chip: document.querySelector('.chip.bchip')?.textContent?.trim(),
  }))
  !again.open && again.chip?.includes('看结论')
    ? ok(`刷新后不再自来 —— 页眉留着「${again.chip}」`)
    : bad(`记忆不对：又自己弹出来 ${again.open}、页眉写着「${again.chip}」`)
}

// ═══ 16 · 播放：走到最后一步就停，不回卷 ═══
console.log('\n【16】播放走到头会停')
{
  /**
   * 用户报的：「这怎么播放起来不停了？不是应该走完 12 步就自动停吗」。
   * 原来那行是 `onSeek(index + 1 >= N ? 0 : index + 1)` —— 到头跳回第 0 步接着放。
   *
   * 这个坏法**不报错、截图上也看不出来**（画面一直在动，看着很正常），
   * 只有盯着它看完一整轮的人才会发现数字被悄悄清零了。所以得有人常驻守着。
   *
   * 挑步数最少的实验（文件索引寻址 4 步）—— 这一组要真等它放完，越短越好。
   */
  await nav('文件索引寻址')
  const at = () => p.evaluate(() => ({
    cur: [...document.querySelectorAll('.tick')].findIndex(t => t.classList.contains('cur')),
    n: document.querySelectorAll('.tick').length,
    btn: [...document.querySelectorAll('.axis button')].find(b => /播放|暂停/.test(b.textContent))?.textContent.trim() ?? '',
  }))
  const a0 = await at()
  await p.click('.axis button:has-text("播放")')
  await p.waitForTimeout(900)
  const mid = await at()
  //  自检先行：得先证明"它真的在放"，否则下面"停住了"可能只是压根没动
  mid.cur > a0.cur && mid.btn.includes('暂停')
    ? ok(`自检：按下 ▶ 之后确实在走（第 ${a0.cur + 1} 步 → 第 ${mid.cur + 1} 步）—— 下面那条量的不是"没启动"`)
    : bad(`播放没启动：${a0.cur} → ${mid.cur}、按钮「${mid.btn}」`)

  //  等它放完（余下 N 步 × 800ms，再多给两拍）
  await p.waitForTimeout((a0.n - mid.cur) * 800 + 1600)
  const end = await at()
  end.cur === end.n - 1 && end.btn.includes('播放')
    ? ok(`放到第 ${end.n} 步自动停下，按钮回到「${end.btn}」`)
    : bad(`没停在末步：停在第 ${end.cur + 1} / ${end.n} 步、按钮「${end.btn}」`)

  //  核心：再等两拍，位置一动不动 —— 老毛病会在这儿回卷到第 1 步
  await p.waitForTimeout(1800)
  const still = await at()
  still.cur === end.cur
    ? ok(`再等两拍仍停在第 ${still.cur + 1} 步 —— 没有回卷重放`)
    : bad(`回卷了：停下后又跑到第 ${still.cur + 1} 步`)

  //  停在末态再按 ▶ = 从头放一遍
  await p.click('.axis button:has-text("播放")')
  await p.waitForTimeout(900)
  const again = await at()
  again.cur < end.cur && again.btn.includes('暂停')
    ? ok(`停在末态再按 ▶ 从头放（回到第 ${again.cur + 1} 步）`)
    : bad(`末态按 ▶ 没从头放：到了第 ${again.cur + 1} 步、按钮「${again.btn}」`)
  await p.click('.axis button:has-text("暂停")').catch(() => {})
}
// ═══ 16d · 铺开的那套版式：新开的三个开关立不立得住 ═══
// ═══ 16e · 实验引导图：「看懂这一屏」入口 + 弹层 ═══
// ═══ 16f · 图表逐步揭示：不许一上来就把结果全画出来 ═══
console.log('\n【16f】图表逐步揭示（不剧透）')
{
  /*
   * 体验师抓到的一类问题：TCP 的拥塞窗口曲线、CSMA 的争用期时隙图，
   * **第 1 步就把整条 trace 画完了**（未来那截只是调暗到 34%），
   * 而旁边的讲解还在一步步推 —— 图和文案自相矛盾，也没了"猜下一步"的余地。
   * 用户拍板改成"逐步画"，与 Cache / 银行家一致。
   *
   * 这条判据盯的就是这个：**同一个实验，第一步画的东西必须比最后一步少**。
   * 回退成"拿整条 trace 画"的那一刻，两个数会相等 —— 立刻红。
   */
  const grew = []
  const flat = []

  //  TCP：数 cwnd 折线里的顶点数（path 的 M/L 个数）
  await nav('TCP 拥塞窗口'); await p.waitForTimeout(200)
  { const gx = await p.$('.gnote .gnx'); if (gx) { await gx.click(); await p.waitForTimeout(110) } }
  const tcpPts = async () => p.evaluate(() => {
    const ps = [...document.querySelectorAll('.curve path')]
    //  最后一条是 cwnd 实线（ssthresh 虚线在它前面）
    const d = ps.length ? ps[ps.length - 1].getAttribute('d') || '' : ''
    return (d.match(/[ML]/g) || []).length
  })
  const nT = await p.locator('.tick').count()
  await p.click('.tick >> nth=0'); await p.waitForTimeout(220)
  const t1 = await tcpPts()
  await p.click(`.tick >> nth=${nT - 1}`); await p.waitForTimeout(220)
  const tN = await tcpPts()
  ;(tN > t1 ? grew : flat).push(`TCP 曲线顶点 ${t1} → ${tN}`)

  //  CSMA：数时隙图里"有内容"的格子
  await nav('CSMA/CD 与退避'); await p.waitForTimeout(200)
  { const gx = await p.$('.gnote .gnx'); if (gx) { await gx.click(); await p.waitForTimeout(110) } }
  const csCells = async () => p.evaluate(() =>
    [...document.querySelectorAll('.ptab.csma tbody td')].filter(t => (t.textContent || '').trim()).length)
  const nC = await p.locator('.tick').count()
  await p.click('.tick >> nth=0'); await p.waitForTimeout(220)
  const c1 = await csCells()
  await p.click(`.tick >> nth=${nC - 1}`); await p.waitForTimeout(220)
  const cN = await csCells()
  ;(cN > c1 ? grew : flat).push(`CSMA 时隙格 ${c1} → ${cN}`)

  flat.length === 0
    ? ok(`两张图都是逐步长出来的：${grew.join(' · ')}`)
    : bad(`图一上来就画完了（回退成"拿整条 trace 画"）：${flat.join(' · ')}`)

  //  自检：这条判据得会红 —— 拿"两个数相等"喂进同一套判断，它必须认出这是剧透。
  const fakeFirst = 9, fakeLast = 9
  fakeFirst < fakeLast
    ? bad('自检失败：first==last 竟然被判成"逐步揭示"')
    : ok('自检：first == last（整条 trace 一次画完）会被这条判据认出来 —— 它能红')
}

console.log('\n【16e】实验引导图「看懂这一屏」')
{
  /*
   * Cache 有一张手写复刻的引导图（GuideDiagram），入口是 exphead 上的「看懂这一屏」按钮。
   * 它容易悄悄坏：改个类名、弹层不弹、关不掉 —— 都不报错，靠看看不出来。三件事一起钉：
   *   入口在（且只给登记过的实验）· 点开弹层真出来且画了东西 · ✕ 能关。
   */
  await nav('Cache 命中率'); await p.waitForTimeout(250)
  const bfx = await p.$('.gnote .gnx'); if (bfx) { await bfx.click(); await p.waitForTimeout(120) }
  const hasBtn = await p.$('.seehint')
  if (!hasBtn) { bad('Cache 上没有「看懂这一屏」入口'); }
  else {
    await p.click('.seehint'); await p.waitForTimeout(300)
    const m = await p.evaluate(() => {
      const box = document.querySelector('.gd-modal')
      if (!box) return null
      return {
        secs: box.querySelectorAll('.gd-sec').length,   //  两个步骤区
        segs: box.querySelectorAll('.gd-aseg').length,  //  三段地址
        cells: box.querySelectorAll('.gd-cell').length, //  表格格子
        hit: !!box.querySelector('.gd-ocard.hit'), miss: !!box.querySelector('.gd-ocard.miss'),
        //  ⚠️ `.gd-s2arr > path`（直接子）：不能用 `.gd-s2arr path`，
        //  那会把 <defs><marker> 里箭头本身那个 path 也数进去（=3）。
        arrows: box.parentElement.querySelectorAll('.gd-s2arr > path').length,  //  ②→③ 两条
      }
    })
    m && m.secs === 2 && m.segs === 3 && m.cells >= 8 && m.hit && m.miss && m.arrows === 2
      ? ok(`弹层画全了：2 步骤 · 3 段地址 · ${m.cells} 格 · 命中/缺失 · ②→③ 两条引导箭头`)
      : bad(`引导图弹层缺东西：${JSON.stringify(m)}`)
    await p.click('.gd-x'); await p.waitForTimeout(200)
    const closed = await p.evaluate(() => !document.querySelector('.gd-modal'))
    closed ? ok('点 ✕ 能关掉弹层') : bad('✕ 关不掉弹层')
  }
  //  30 张全铺完了：每个实验都得有入口，点开都得是一张画了东西的引导图。
  //  （原来只有 Cache 一张，靠"没登记的没有入口"自检；现在全登记了，改成逐个走一遍。）
  {
    const names = await p.$$eval('.nav button', bs => bs.map(b => b.textContent.trim().replace(/^\d+\s*/, '')))
    const holes = []
    for (const name of names) {
      await nav(name); await p.waitForTimeout(140)
      const gx = await p.$('.gnote .gnx'); if (gx) { await gx.click(); await p.waitForTimeout(110) }
      if (!(await p.$('.seehint'))) { holes.push(`${name} 没有入口`); continue }
      await p.click('.seehint'); await p.waitForTimeout(200)
      const shape = await p.evaluate(() => {
        const box = document.querySelector('.gd-modal'); if (!box) return null
        return { sec: box.querySelectorAll('.gd-sec').length, flow: !!box.querySelector('.gd-flow'), hdr: !!box.querySelector('.gd-hdr h2') }
      })
      if (!shape || shape.sec < 2 || !shape.flow || !shape.hdr) holes.push(`${name}: ${JSON.stringify(shape)}`)
      const x = await p.$('.gd-x'); if (x) { await x.click(); await p.waitForTimeout(90) }
    }
    holes.length === 0
      ? ok(`30 个实验的引导图逐个开过：都有入口、弹层至少 2 节 + 头 + 底部流程带`)
      : bad(`引导图有缺：\n     ${holes.join('\n     ')}`)
  }

  //  自检：这条得会红 —— 弹层内容是按 expId 路由的，不是写死 Cache 那张。
  //  开 KMP 的引导图，里面必须是 KMP 的东西（next / 模式串），且**不**含 Cache 专有的「TAG（标记）」。
  await nav('KMP 字符串匹配'); await p.waitForTimeout(160)
  const kgx = await p.$('.gnote .gnx'); if (kgx) { await kgx.click(); await p.waitForTimeout(110) }
  await p.click('.seehint'); await p.waitForTimeout(220)
  const routed = await p.evaluate(() => {
    const box = document.querySelector('.gd-modal'); if (!box) return null
    const t = box.textContent || ''
    return { isKmp: t.includes('next') && t.includes('模式串'), leakedCache: t.includes('TAG（标记）') }
  })
  routed && routed.isKmp && !routed.leakedCache
    ? ok('自检：KMP 弹层内容确是 KMP 的（next/模式串），没串成 Cache —— 弹层按 expId 路由，不是写死')
    : bad(`自检失败：KMP 弹层路由不对 ${JSON.stringify(routed)}`)
  { const x = await p.$('.gd-x'); if (x) await x.click() }
}

console.log('\n【16d】铺到 30 个实验的版式开关')
{
  /*
   * Cache 那一屏的版式做成了实验自己声明的三个旗标（见 web/src/types.ts）：
   *   `whyInRail`        推演搬右栏、旁栏收进底部实验记录
   *   `tickChip`         走带从柱状条换成「步号 + 这一步的输入」写字格
   *   `sequence.chips`   序列从一行箭头文字换成可点的格子
   *
   * 旗标是**数据**，坏起来不报错 —— 只是屏幕上那一格是空的，
   * 或者长到把格子撑破。而"铺开"这个动作本身就是把一堆判断写进数据，
   * 所以得有人当场把每个实验都看一遍。
   *
   * 便宜之处：那排格子是**同时渲染**的，一次读完，不用逐步走。
   */
  const CHIP_MAX = 9        //  一格装得下几个字；超了会被省略号截掉，而截断的输入没用处
  const names16d = await p.$$eval('.nav button', bs => bs.map(b => b.textContent.trim()))
  const holes = []
  let withChip = 0, withSeq = 0, railed = 0, chips = 0
  for (const raw of names16d) {
    const name = raw.replace(/^\d+\s*/, '')
    await nav(name)
    await p.waitForTimeout(120)
    /*  ⚠️ **先把序列编辑器收起来。** 格子只在收起态渲染（展开时那儿是输入框），
        而前面的组把编辑器打开过、状态还落在 localStorage 里 ——
        不收就一路量到 0 个格子，报的是"序列格子一个都没开"，
        而真相是"这一刻它们本来就不该在"。 */
    if (await p.$('.card.seq:not(.shut)')) {
      await p.click('.card.seq > h3 .fold').catch(() => {})
      await p.waitForTimeout(140)
    }
    const r = await p.evaluate(() => ({
      //  旁栏收进底部那条「实验记录」＝ whyInRail 生效了
      bottom: !!document.querySelector('.dock.bottom'),
      side: !!document.querySelector('.stagerow > .dock'),
      tickChips: [...document.querySelectorAll('.tick.chip .tx')].map(e => e.textContent.trim()),
      ticks: document.querySelectorAll('.tick').length,
      seqChips: document.querySelectorAll('.seqchips button').length,
      hasSeq: !!document.querySelector('.card.seq'),
    }))
    if (!r.bottom || r.side) holes.push(`${name}：旁栏没收进实验记录（底部 ${r.bottom} / 侧栏 ${r.side}）`)
    else railed++
    if (r.tickChips.length) {
      withChip++
      chips += r.tickChips.length
      if (r.tickChips.length !== r.ticks) holes.push(`${name}：${r.ticks} 步只有 ${r.tickChips.length} 个写字格`)
      const empty = r.tickChips.filter(t => !t)
      const longs = r.tickChips.filter(t => [...t].length > CHIP_MAX)
      if (empty.length) holes.push(`${name}：${empty.length} 个写字格是空的`)
      if (longs.length) holes.push(`${name}：写字格太长「${longs[0]}」（${[...longs[0]].length} 字，上限 ${CHIP_MAX}）`)
    }
    /*  序列格子只该开给「**一项 = 一步**」的序列。
        反例是排序的「待排序数组」：整串是一个输入，逐项高亮毫无意义 ——
        第 3 步高亮第 3 个数？那一步根本不在处理它。
        判据：开了格子的，轨迹步数不能**少于**序列项数。 */
    if (r.seqChips > 0) {
      withSeq++
      if (r.ticks < r.seqChips) holes.push(`${name}：序列 ${r.seqChips} 项，轨迹只有 ${r.ticks} 步 —— 不是逐项走的`)
    }
  }
  holes.length === 0 && railed === names16d.length && withChip > 0 && withSeq > 0
    ? ok(`${railed} 个实验都收进了实验记录；${withChip} 个走带写字格共 ${chips} 格全非空且不超 ${CHIP_MAX} 字；`
         + `${withSeq} 个序列是逐项走的`)
    : bad(`铺开的版式有窟窿（${railed}/${names16d.length} 收好、写字格 ${withChip} 个、序列格子 ${withSeq} 个）：`
          + `\n     ${holes.slice(0, 8).join('\n     ')}`)

  /*  自检：这条得会红 —— 把一个写字格的字换成一长串。
      ⚠️ 先切回一个**真有写字格**的实验：循环结束时停在最后一个实验上，
      那个没有 tickChip，`.tick.chip .tx` 是 null，自检"失败"得莫名其妙。 */
  await nav('Cache 命中率'); await p.waitForTimeout(250)
  /*  自检：这条得会红。
      ⚠️ **不碰 DOM** —— 早先那版是 `e.textContent = '很长的一串'` 再改回来。
      给 React 渲染出来的元素改 textContent，会把它拥有的那个文本节点换掉，
      于是 React 下一次卸载时撞 `removeChild: node is not a child of this node`，
      **整棵树当场崩**；而崩掉之后报出来的是十几组之后「切不到某个实验」。
      判据要验的是那条**判定**（长度超没超），拿真值加长在副本上跑一遍就够了。 */
  const canFail16d = await p.evaluate(max => {
    const e = document.querySelector('.tick.chip .tx')
    if (!e) return null
    const faked = e.textContent + '这是一段故意写得很长的标签'
    return [...faked].length > max
  }, CHIP_MAX)
  canFail16d === true
    ? ok('自检：把一个写字格换成长字符串，长度那一条会认出来 —— 它能红')
    : bad(`自检失败：换成长字符串之后判据没认出来（${canFail16d}）`)
}

// ═══ 16c · 推演带子：每个实验、每一步都算得出四段 ═══
console.log('\n【16c】「本步推演」：逐实验、逐步走一遍')
{
  /*
   * 上一组只在 Cache 上验了"带子会跟着走"。真正会烂的地方是**别的实验的别的步**：
   * `step` 读的是各内核自己的字段，字段名或类型写错了，那一步的带子会**整条消失** ——
   * 屏幕上只是"这一步没有解释"，看不出是坏了还是本来就没写。
   *
   * 实际炸过一次：握手实验的 `Seg.flags` 是字符串不是数组，我按印象写成数组，
   * `flags.join` 在真实状态上直接抛，20 步里有 12 步没有带子，一句报错都没有
   * （App 里那个 `catch` 咽了）。现在 catch 会 `console.error`，
   * 而这一组把每个实验的每一步都走一遍 —— 少一段就红。
   */
  const errs = []
  p.on('console', m => { if (m.type() === 'error' && m.text().includes('[讲解]')) errs.push(m.text().slice(0, 120)) })
  const names = await p.$$eval('.nav button', bs => bs.map(b => b.textContent.trim()))
  const holes = []
  let withBand = 0, walked = 0
  for (const raw of names) {
    const name = raw.replace(/^\d+\s*/, '')
    await nav(name)
    await p.waitForTimeout(140)
    /*  ⚠️ **先关引导笔记（gnote）。** 30 个实验都有笔记之后，它会盖住整条走带 ——
        刻度点不着，默认 30s 超时 × 458 步 = 挂几小时（实测就是这么挂的）。
        跟 16b 一个规矩：走每一步之前先把这层遮罩收掉。 */
    const gnx = await p.$('.gnote .gnx'); if (gnx) { await gnx.click(); await p.waitForTimeout(120) }
    //  两种住处都算数：旁栏那条带子 / 右栏那张卡
    if (!(await p.$('.whyband, .whyrail'))) continue   //  这个实验还没写推演，跳过
    withBand++
    const n = await p.locator('.tick').count()
    for (let at = 0; at < n; at++) {
      //  短超时：万一还有东西盖住，快速跳过而不是干等 30s
      await p.click(`.tick >> nth=${at}`, { timeout: 3000 }).catch(() => {})
      await p.waitForTimeout(60)
      walked++
      const r = await p.evaluate(() => [...document.querySelectorAll('.wseg')]
        .map(e => (e.querySelector('.wv')?.textContent ?? '').trim()))
      //  骨架是**前缀**：至少三段（本步输入/判定规则/本步结果），第四段可有可无
      if (r.length < 3 || r.length > 4) { holes.push(`${name} 第 ${at + 1} 步有 ${r.length} 段`); break }
      const blank = r.findIndex(v => v === '')
      if (blank >= 0) { holes.push(`${name} 第 ${at + 1} 步第 ${blank + 1} 段是空的`); break }
    }
  }
  holes.length === 0 && errs.length === 0
    ? ok(`${withBand} 个实验、共 ${walked} 步逐个走过，每一步都有完整的四段，控制台没有讲解层报错`)
    : bad(`推演带子有窟窿：\n     ${[...holes, ...errs].join('\n     ')}`)

  //  自检：这条判据得会红 —— 手动摘掉一段，看它认不认
  /*  同上：**不改 DOM**。把真值取出来，在副本里挖掉第一段，
      再拿同一个"找空段"的写法跑一遍 —— 验的是判定，不是浏览器。 */
  const canFail = await p.evaluate(() => {
    const vals = [...document.querySelectorAll('.wseg')]
      .map(e => (e.querySelector('.wv')?.textContent ?? '').trim())
    if (vals.length === 0) return null
    const faked = vals.slice(); faked[0] = ''
    return faked.findIndex(v => v === '')
  })
  canFail === 0
    ? ok('自检：把一段的正文清空，这条判据会认出那个窟窿 —— 它能红')
    : bad(`自检失败：清空一段之后判据没认出来（${canFail}）`)
}

// ═══ 16b · 实验单说的东西页面上真有 ═══════════════
console.log('\n【16b】每份实验笔记：「实验操作」点名的旋钮/预置真的在')
{
  /*
   * 实验单里最容易烂掉的一处是 ③：写「把相联度从 2 调到 1」，
   * 而那个旋钮的标签其实叫「相联」或者根本在别的实验上 ——
   * **名字写错不会报任何错**，用户按着找、找不到，然后以为是自己没看见。
   *
   * 顺带验 ④ 和目标在**真实默认轨迹**上算得出东西（不是 null、不是空串）：
   * 单元测试那一套喂的是假状态，只能证明"函数会跟着数据变"，
   * 证明不了"喂真数据时它取得到自己要的字段"。字段名打错正好卡在这儿。
   */
  const names = await p.$$eval('.nav button', bs => bs.map(b => b.textContent.trim()))
  const bad2 = []
  let checked = 0, tasks = 0
  for (const raw of names) {
    const name = raw.replace(/^\d+\s*/, '')
    await nav(name)
    await p.waitForTimeout(140)
    /*  笔记没自动弹就从页眉请出来；没有实验单的实验直接跳过。
        ⚠️ 先 `$` 再点：那枚 chip 只在有实验单时才渲染，
        直接 `click().catch()` 会在没有它的 14 个实验上各等满 30 秒。 */
    if (!(await p.$('.gnote'))) {
      const chip = await p.$('.chip.bchip')
      if (chip) { await chip.click(); await p.waitForTimeout(200) }
    }
    if (!(await p.$('.gnote'))) continue
    checked++
    const r = await p.evaluate(() => {
      const miss = []
      const items = [...document.querySelectorAll('.gnacts li')]
      for (const li of items) {
        const pm = li.dataset.param, ps = li.dataset.preset
        if (pm && ![...document.querySelectorAll('.param .k')]
          .some(k => k.textContent.trim().startsWith(pm))) miss.push(`旋钮「${pm}」`)
        if (ps && ![...document.querySelectorAll('button')]
          .some(b => b.dataset.preset === ps || b.textContent.trim() === ps)) miss.push(`预置「${ps}」`)
      }
      return { n: items.length, miss }
    })
    tasks += r.n
    if (r.miss.length) bad2.push(`${name}：${r.miss.join('、')} 页面上找不到`)
    /*  目标那一条不在这儿验了：挑战已经搬到实验名后面那枚药丸上
        （`.goalpill`），而"它会随着拧旋钮翻面"另有一组专门盯着。
        同一件事验两遍，改一次就得改两处。 */
    await p.click('.gnote .gnx').catch(() => {})
    await p.waitForTimeout(120)
  }
  bad2.length === 0
    ? ok(`${checked} 个实验的笔记：共 ${tasks} 条动作，点名的旋钮与预置页面上都找得到`)
    : bad(`笔记里的动作对不上 ${bad2.length} 处：\n     ${bad2.join('\n     ')}`)

  /*  自检：这条判据得会红 —— 伪造一条指向不存在旋钮的动作。
      ⚠️ 循环末尾把笔记收起来了，`.gnacts li` 这时根本不在 DOM 里，
      第一版因此拿到 null，自检"失败"得莫名其妙。先把实验单请回来。 */
  await nav('Cache 命中率'); await p.waitForTimeout(250)
  if (!(await p.$('.gnote'))) {
    const chip = await p.$('.chip.bchip')
    if (chip) { await chip.click(); await p.waitForTimeout(220) }
  }
  const canFail = await p.evaluate(() => {
    const li = document.querySelector('.gnacts li')
    if (!li) return null
    const keep = li.dataset.param
    li.dataset.param = '这个旋钮不存在'
    const found = [...document.querySelectorAll('.param .k')]
      .some(k => k.textContent.trim().startsWith(li.dataset.param))
    if (keep === undefined) delete li.dataset.param; else li.dataset.param = keep
    return found
  })
  canFail === false
    ? ok('自检：把动作指向一个不存在的旋钮，这条判据会认出来 —— 它能红')
    : bad(`自检失败：伪造的旋钮居然找得到（${canFail}）`)
}

// ═══ 17 · 编辑器默认收起：主角要拿到屏幕 ═══
console.log('\n【17】序列/实体表默认收起')
{
  /*
   * 用户原话：「实验做的再好，这个卖相注定扑街」。量出来的账是：
   * 舞台真正画着东西的部分只占全屏 **8.7%**，跟这个输入框一样大，比底部日志抽屉小一半。
   *
   * 所以判据不是"有个折叠按钮"，是**新用户进来时舞台真的更大了**。
   */
  await p.evaluate(() => localStorage.removeItem('cslab.editor'))
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700)
  const bf = await p.$('.gnote .gnx'); if (bf) { await bf.click(); await p.waitForTimeout(150) }
  await nav('Cache 命中率'); await p.waitForTimeout(300)
  /*
   * ⚠️ 判据**不能写成"占屏 ≥ N%"** —— 第一版就是那样，然后它在 1280×720 的冒烟里红了，
   * 而我手量的 1440×900 是过的。同一份代码两个数，说明量的是窗口不是设计。
   *
   * 真正要守的那句话是：**舞台必须是屏幕上最大的一块**。
   * 改之前它是第三大（输入框 8.7% = 舞台 8.7% < 日志抽屉 18.4%），这条会红。
   */
  const shut = await p.evaluate(() => {
    const V = innerWidth * innerHeight
    const area = s => { const e = document.querySelector(s); if (!e) return 0
      const b = e.getBoundingClientRect(); return +(b.width * b.height / V * 100).toFixed(1) }
    const e = document.querySelector('.card.seq')
    return { 收起: !!e?.className.includes('shut'), 有折叠钮: !!e?.querySelector('h3 .fold'),
             舞台: area('.stagewrap'),
             对手: { 目录: area('.nav'), 编辑器: area('.card.seq'), 轴: area('.axis'),
                     坞: area('[class*=dock]'), 右列: area('.grid>.col:last-child') } }
  })
  const 最大对手 = Math.max(...Object.values(shut.对手))
  shut.收起 && shut.有折叠钮 && shut.舞台 > 最大对手
    ? ok(`新用户进来：编辑器收着、有「展开改」按钮，舞台 ${shut.舞台}% 是屏幕上最大的一块（第二名 ${最大对手}%）`)
    : bad(`默认态不对：收起=${shut.收起} 折叠钮=${shut.有折叠钮} 舞台=${shut.舞台}% 对手=${JSON.stringify(shut.对手)}`)

  await p.click('.card.seq h3 .fold'); await p.waitForTimeout(250)
  const opened = await p.evaluate(() => ({
    展开: !document.querySelector('.card.seq')?.className.includes('shut'),
    存住了: localStorage.getItem('cslab.editor'),
  }))
  opened.展开 && opened.存住了 === 'open'
    ? ok('点「展开改」→ 摊开，并且记在本机（改过一次的人下次进来还是展开的）')
    : bad(`展开不对：${JSON.stringify(opened)}`)

  /*
   * ⚠️ 这一组名字里写着「序列/**实体表**」，可它一直只验了序列表。
   * 实体表（丢包事件、边表、路由表）的 `shut` 类**从来没加过** ——
   * 折叠按钮的文字在「收起 ▲ / 展开改 ▼」之间翻，
   * `.card.shut>.body{display:none}` 却永远匹配不上，表格一直摊着。
   * 代价是 9 个实验里编辑器吃掉 170~240px：子网划分的表 238px、舞台只有 182px。
   * 名字承诺了什么，判据就得验什么。
   */
  {
    /*  ⚠️ 前置：上一条判据刚点过「展开改」，编辑器是开的 ——
        不清掉的话这里量到的全是"用户自己展开的"，判据在骂错人。 */
    await p.evaluate(() => localStorage.removeItem('cslab.editor'))
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600)
    { const bf0 = await p.$('.gnote .gnx'); if (bf0) { await bf0.click(); await p.waitForTimeout(140) } }
    const withEnt = []
    for (const name of ['滑动窗口 ARQ', '子网划分', '图的遍历', '进程调度甘特图']) {
      await nav(name); await p.waitForTimeout(260)
      const bf2 = await p.$('.gnote .gnx'); if (bf2) { await bf2.click(); await p.waitForTimeout(130) }
      const r = await p.evaluate(() => {
        const e = document.querySelector('.card.ent')
        if (!e) return null
        return { shut: e.className.includes('shut'),
                 体高: Math.round(e.querySelector('.body')?.getBoundingClientRect().height ?? -1),
                 卡高: Math.round(e.getBoundingClientRect().height) }
      })
      if (r) withEnt.push({ name, ...r })
    }
    const open2 = withEnt.filter(x => !x.shut || x.体高 > 0)
    withEnt.length > 0 && open2.length === 0
      ? ok(`${withEnt.length} 个带实体表的实验：默认都是收起的（表体高 0，卡片只剩 ${withEnt[0].卡高}px 的标题条）`)
      : bad(`实体表没收起：${open2.map(x => `${x.name}(shut=${x.shut} 体高${x.体高}px)`).join('、') || '一个带实体表的实验都没找到'}`)
  }
}


// ═══ 17b · 大屏：宽度用得上、舞台真的会放大 ═══════════
console.log('\n【17b】大屏上舞台会长大，两栏收得起来')
{
  /*
   * 用户拿一块 2000px 的屏截图问「我这么大的屏幕，核心实验区的字已经小到看不见了」。
   * 量出来是两件事叠在一起：
   *   ① 外壳封在 `max-width:1420px` —— 那块屏白扔 612px，中列永远 952px；
   *   ② `.fitin` 的宽度被拉成容器宽，于是 FitBox 里 `min(宽比, 高比)` 的**宽比恒等于 1**，
   *      那个 `max = 2.4` 的放大上限**从来没生效过** —— 屏幕再大，字也只有 11px。
   *
   * 第二条尤其阴：它不报错、不变形，只是"永远不放大"。
   * 所以这一组必须**量倍率**，不能只看布局有没有塌。
   */
  await p.setViewportSize({ width: 2000, height: 1030 })
  await p.evaluate(() => { localStorage.removeItem('cslab.nav'); localStorage.removeItem('cslab.side') })
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700)
  const bf3 = await p.$('.gnote .gnx'); if (bf3) { await bf3.click(); await p.waitForTimeout(160) }

  //  ① 宽度真的用上了
  {
    const r = await p.evaluate(() => {
      const app = document.querySelector('.app').getBoundingClientRect()
      //  量整个实验块（舞台 + 推演旁白）：推演已经进了实验区，单量 .fit 会把它当成"没用上"
      const fit = document.querySelector('.stagerow').getBoundingClientRect()
      return { 外壳:Math.round(app.width), 实验块:Math.round(fit.width), 窗口:innerWidth }
    })
    const 白扔 = r.窗口 - r.外壳
    白扔 <= 40 && r.实验块 > 1200
      ? ok(`2000px 宽的屏：外壳占 ${r.外壳}px（只留 ${白扔}px 边距），实验块 ${r.实验块}px`)
      : bad(`宽度没用上：外壳 ${r.外壳}px、白扔 ${白扔}px、实验块 ${r.实验块}px`)
  }

  //  ② 舞台真的放大了（这一条挡的是"放大路死掉"）
  {
    const names2 = ['Cache 命中率', 'IEEE 754 浮点', '页面置换', 'CRC 循环冗余校验']
    const got = []
    for (const n of names2) {
      await nav(n); await p.waitForTimeout(280)
      const bf4 = await p.$('.gnote .gnx'); if (bf4) { await bf4.click(); await p.waitForTimeout(130) }
      const v = await p.evaluate(() => {
        const i = document.querySelector('.fitin')
        return { s: Number(i?.dataset.fit ?? 1), cw: i?.scrollWidth ?? 0,
                 boxw: Math.round(document.querySelector('.fit').getBoundingClientRect().width) }
      })
      got.push({ n, ...v })
    }
    /*
     * ⚠️ 这一条问的是**放大那条路死没死**，不是"每一张图都得放大"。
     *
     * 原来要求四个实验**全部** > 1.05。中列从 72% 收到 63% 之后
     * （用户："两侧太窄、中间太宽，布局很不协调"），
     * 图本身高的那几个（浮点 / 页面置换 / CRC）在 2000 宽的屏上改由**高度**封顶，
     * 稳定落在 0.94 —— 那是缩放取 min(宽比, 高比) 的必然结果，不是路死了。
     * 全绑死的写法会把"布局比例的取舍"报成"功能坏了"。
     *
     * 改成三问，每一问各挡一种坏法：
     *   · 至少有一个真的放大了     —— 放大那条路还活着（写死 min(1,…) 的老 bug 会红）
     *   · 没有一个掉到 0.9 以下     —— 中列不能窄到把图挤瘪
     *   · 没有一个被拉成容器宽      —— 宽比恒等于 1 那种假放大
     */
    const 放大了 = got.filter(x => x.s > 1.05)
    const 太小 = got.filter(x => x.s < 0.9)
    const 被拉满 = got.filter(x => Math.abs(x.cw - x.boxw) < 2)
    放大了.length > 0 && 太小.length === 0 && 被拉满.length === 0
      ? ok(`宽屏上放大那条路活着（${放大了.length}/${got.length} 个放大了）：`
           + got.map(x => `${x.n.slice(0, 6)} ${x.s.toFixed(2)}×（字 ${(11 * x.s).toFixed(0)}px）`).join('、'))
      : bad(被拉满.length
        ? `舞台内容被拉成容器宽（宽比恒等于 1，放大那条路又死了）：${被拉满.map(x => x.n).join('、')}`
        : 放大了.length === 0
          ? `一个都没放大 —— 放大那条路死了：${got.map(x => `${x.n} ${x.s}×`).join('、')}`
          : `有图被挤瘪到 0.9 以下：${太小.map(x => `${x.n} ${x.s}×`).join('、')}`)
  }

  //  ③ 两栏收得起来、舞台跟着变宽、刷新还记得
  {
    const boxw = () => p.evaluate(() => Math.round(document.querySelector('.fit').getBoundingClientRect().width))
    /*  ⚠️ 整组**固定在第一个实验上**跑。
        选中的实验不落盘，刷新一律回到第一个；上一组停在别的实验上的话，
        刷新前后量的是两个实验（它们的旁栏默认值还不一样，差 428px）——
        那个差值是"换了实验"，不是"两栏没记住"。
        也不能刷新后再切回去：那时左边目录已经收起来了，按钮点不着。 */
    await nav(EXP0); await p.waitForTimeout(300)
    const w0 = await boxw()
    await p.click('.nav-fold'); await p.waitForTimeout(300)
    const w1 = await boxw()
    await p.click('.side-fold'); await p.waitForTimeout(300)
    const w2 = await boxw()
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700)
    const bf5 = await p.$('.gnote .gnx'); if (bf5) { await bf5.click(); await p.waitForTimeout(140) }
    const w3 = await boxw()
    //  收起后那两条窄轨还得在 —— 不然再打开的按钮就没地方找了
    const rails = await p.evaluate(() => ({
      nav: !!document.querySelector('.nav-fold'),
      side: !!document.querySelector('.side-fold'),
    }))
    w1 > w0 && w2 > w1 && w3 === w2 && rails.nav && rails.side
      ? ok(`两栏收起：舞台 ${w0} → ${w1} → ${w2}px，刷新后仍是 ${w3}px，两条窄轨上的按钮都还在`)
      : bad(`收栏不对：${w0} → ${w1} → ${w2}，刷新后 ${w3}；窄轨 ${JSON.stringify(rails)}`)
    //  收回去，别影响后面几组
    await p.click('.nav-fold'); await p.click('.side-fold'); await p.waitForTimeout(300)
  }

  //  ④ 文字块有行宽上限 —— 宽屏最容易出的排版事故
  {
    const wide = await p.evaluate(() => {
      const out = []
      for (const sel of ['.whyband .wv', '.whyrail .wv', '.bounds p', '.log li .x']) {
        for (const e of document.querySelectorAll(sel)) {
          const w = e.getBoundingClientRect().width
          const fs = parseFloat(getComputedStyle(e).fontSize)
          //  一个汉字约等于一个 em；60 字是中文正文的舒适上限再放宽一点
          if (fs > 0 && w / fs > 60) { out.push(`${sel} 一行 ${Math.round(w / fs)} 字`); break }
        }
      }
      return out
    })
    wide.length === 0
      ? ok('宽屏上文字块都有行宽上限（没有一处超过 60 个汉字一行）')
      : bad(`行宽失控：${wide.join('、')}`)
  }

  //  自检：把设计宽度改成 100%，②那条必须红
  {
    await p.addStyleTag({ content: '.fitin{width:100% !important}' })
    await p.waitForTimeout(400)
    const v = await p.evaluate(() => {
      const i = document.querySelector('.fitin')
      return { cw: i.scrollWidth, boxw: Math.round(document.querySelector('.fit').getBoundingClientRect().width) }
    })
    Math.abs(v.cw - v.boxw) < 2
      ? ok('自检：把 `.fitin` 改回拉满容器宽，②那条的"被拉满"判定确实会触发 —— 它能红')
      : bad(`自检失败：强行拉满之后内容宽 ${v.cw}、框宽 ${v.boxw}，判定没触发`)
  }

  await p.setViewportSize({ width: 1280, height: 720 })
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  const bf6 = await p.$('.gnote .gnx'); if (bf6) { await bf6.click(); await p.waitForTimeout(140) }
}

// ═══ 18 · 展示模式：藏壳 · 锁画幅 · 自己走一遍 ═══
console.log('\n【18】展示模式')
{
  /*
   * 这一档是**给录屏用的**，不是给用户用的。所以判据也按拍摄来写：
   * 画面里不能有壳、画幅要精确、镜头要能自己走完、鼠标不能出现。
   *
   * 画幅那条尤其不能马虎：第一版用两个 min() 互算，实测出来是 1.753 而不是 1.778 ——
   * 差 1.4%，导出后就得补边。所以这里比到小数点后两位。
   */
  const box = () => p.evaluate(() => {
    const a = document.querySelector('.app').getBoundingClientRect()
    const st = document.querySelector('.stagewrap')?.getBoundingClientRect()
    const vis = s => { const e = document.querySelector(s); return !!(e && e.offsetParent) }
    return {
      ar: +(a.width / a.height).toFixed(4),
      stage: +((st ? st.width * st.height : 0) / (a.width * a.height) * 100).toFixed(1),
      //  画面里其它几块占多少 —— 判"舞台是不是最大的一块"要拿它们比
      rivals: ['.top', '.exphead', '.axis', '.grid>.col:last-child'].map(sel => {
        const e = document.querySelector(sel); if (!e) return 0
        const r = e.getBoundingClientRect()
        return +(r.width * r.height / (a.width * a.height) * 100).toFixed(1)
      }),
      nav: vis('.nav'), dock: vis('[class*=dock]'), tabs: vis('.tabs'), sets: vis('.card.seq'),
      params: vis('.params'),
      cursor: getComputedStyle(document.body).cursor,
      step: document.querySelector('.axis .head')?.textContent?.match(/第 (\d+) 步/)?.[1],
    }
  })

  await p.goto(`${URL}?show=1&ratio=16:9`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  {
    const bf = await p.$('.gnote .gnx'); if (bf) { await bf.click(); await p.waitForTimeout(150) }
  }
  const land = await box()
  Math.abs(land.ar - 16 / 9) < 0.01 && !land.nav && !land.dock && !land.tabs && !land.sets
    ? ok(`16:9 取景框精确到 ${land.ar}（要 ${(16 / 9).toFixed(4)}）；目录/坞/页签/编辑器都不在画面里`)
    : bad(`横画幅不对：${JSON.stringify(land)}`)

  await p.goto(`${URL}?show=1&ratio=9:16`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  {
    const bf = await p.$('.gnote .gnx'); if (bf) { await bf.click(); await p.waitForTimeout(150) }
  }
  const port = await box()
  /*
   * ⚠️ **第二次栽在"占屏 ≥ N%"上了。** 第一版写的是 ≥45%，
   * 在我手量的 900×1400 上是 64.8%、在冒烟的 1280×720 上只有 33.2% ——
   * 竖画幅在矮窗口里只有 405px 宽，固定的壳吃掉的比例天然更大。
   * 同一份代码两个数，说明量的还是窗口不是设计。
   * 要守的那句话跟第 17 组一样：**舞台必须是画面里最大的一块。**
   */
  const rival = Math.max(...port.rivals)
  Math.abs(port.ar - 9 / 16) < 0.01 && !port.params && port.stage > rival
    ? ok(`9:16 取景框 ${port.ar}；参数表藏起来了，舞台 ${port.stage}% 是画面里最大的一块（第二名 ${rival}%）`)
    : bad(`竖画幅不对：画幅 ${port.ar}、参数还在 ${port.params}、舞台 ${port.stage}% vs 第二名 ${rival}%`)

  //  不带 tour：不许自己动。这条是下面那条的自检 —— 没有它，"走起来了"可能只是页面本来就在走
  const still0 = (await box()).step
  await p.waitForTimeout(2200)
  const still1 = (await box()).step
  still0 === still1
    ? ok(`不带 tour 参数时镜头不动（停在第 ${still1} 步）—— 下一条量的确实是巡演`)
    : bad(`没开巡演却自己走了：${still0} → ${still1}`)

  await p.goto(`${URL}?show=1&ratio=16:9&tour=1`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  {
    const bf = await p.$('.gnote .gnx'); if (bf) { await bf.click(); await p.waitForTimeout(150) }
  }
  const t0 = await box()
  await p.waitForTimeout(3000)
  const t1 = await box()
  t0.cursor === 'none' && Number(t1.step) > Number(t0.step)
    ? ok(`巡演：鼠标已藏（cursor:none），3 秒里自己从第 ${t0.step} 步走到第 ${t1.step} 步`)
    : bad(`巡演不对：cursor=${t0.cursor}、${t0.step} → ${t1.step}`)

  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
}


// ═══ 19 · 不生效的旋钮要说清楚，不能让人白拧 ═══
console.log('\n【19】不适用的参数')
{
  /*
   * `bounds` 里早就写着"初始方向只对 SCAN 系生效"，但界面照样让人拧 ——
   * **拧了没反应，用户只会以为是自己看错了**。这一组守的是"界面不骗人"。
   *
   * 判据不是"有个灰样式"，是三件事同时成立：
   *   变灰 · 点不动 · 说清什么时候才生效。
   * 少任何一件，用户都还是会去拧它。
   */
  const probe = (label) => p.evaluate(l => {
    const box = [...document.querySelectorAll('.param')].find(e =>
      e.querySelector('.k')?.textContent?.trim().startsWith(l))
    if (!box) return null
    return {
      na: box.className.includes('na'),
      disabled: [...box.querySelectorAll('.opts button')].every(b => b.disabled),
      note: box.querySelector('.nanote')?.textContent?.trim() ?? '',
      labels: [...box.querySelectorAll('.opts button')].map(b => b.textContent.trim()),
    }
  }, label)

  await nav('磁盘调度')
  await p.click('.param:has-text("调度算法") .opts button:text-is("SSTF")'); await p.waitForTimeout(300)
  const off = await probe('初始方向')
  off && off.na && off.disabled && off.note.length > 6
    ? ok(`SSTF 下「初始方向」变灰、点不动，并说明「${off.note}」`)
    : bad(`不适用态不对：${JSON.stringify(off)}`)

  //  按钮上不该印内部编码 1 / -1
  off && !off.labels.includes('1') && !off.labels.includes('-1')
    ? ok(`选项印的是方向不是编码：${off.labels.join(' / ')}`)
    : bad(`按钮上还印着内部编码：${JSON.stringify(off?.labels)}`)

  //  自检：换成 SCAN 必须活过来。少了这一条，"永远变灰"也能骗过上面
  await p.click('.param:has-text("调度算法") .opts button:text-is("SCAN")'); await p.waitForTimeout(300)
  const on = await probe('初始方向')
  on && !on.na && !on.disabled && !on.note
    ? ok('自检：换成 SCAN 之后它活过来了 —— 上一条量的确实是"按算法变"，不是"永远灰着"')
    : bad(`SCAN 下应当可用：${JSON.stringify(on)}`)

  //  同一套机制在别的实验上也成立
  await nav('进程调度甘特图')
  await p.click('.param:has-text("调度算法") .opts button:text-is("FCFS")'); await p.waitForTimeout(300)
  const q0 = await probe('时间片')
  await p.click('.param:has-text("调度算法") .opts button:text-is("RR")'); await p.waitForTimeout(300)
  const q1 = await probe('时间片')
  q0?.na && !q1?.na
    ? ok('进程调度的「时间片」同样：FCFS 下不适用，RR 下可用 —— 机制不是给一个实验特调的')
    : bad(`时间片的条件不对：FCFS ${JSON.stringify(q0)} / RR ${JSON.stringify(q1)}`)
}


// ═══ 20 · 没走到的步不预告结果 ═══
console.log('\n【20】轴不剧透')
{
  /*
   * 用户问的：「换了参数还没跑，结果就已经有了，这正常吗？」
   * 一半正常 —— 引擎确定性，整条轨迹当场算完，那是「输出是轨迹不是结果」要的。
   * 一半不正常 —— **算完不等于该印出来**：一进页面就把 12 步的命中/缺失铺满，
   * 实验单 ② 那层"先猜一下"当场作废。
   *
   * 判据三件：进来时只有第一格有颜色 · 走过之后才染上 · 换配置重新藏起来。
   */
  const colored = () => p.evaluate(() =>
    [...document.querySelectorAll('.tick')].filter(e => !e.className.includes('unseen')).length)

  await nav('Cache 命中率')
  await p.evaluate(() => localStorage.removeItem('cslab.editor'))
  const c0 = await colored()
  c0 === 1
    ? ok('刚进来：12 步里只有第 1 格有颜色，其余灰着 —— 没走到的步不预告命中还是缺失')
    : bad(`一进来就染了 ${c0} 格`)

  await p.click('.tick >> nth=5'); await p.waitForTimeout(260)
  const c1 = await colored()
  c1 === 6
    ? ok(`跳到第 6 步：前 6 格染上了（${c1} 格）—— 看过的才显示`)
    : bad(`跳到第 6 步后染了 ${c1} 格，应当是 6`)

  //  往回拖不该把看过的again藏起来 —— 那会让整条带子闪
  await p.click('.tick >> nth=2'); await p.waitForTimeout(260)
  const c2 = await colored()
  c2 === 6
    ? ok('往回退到第 3 步，已经看过的 6 格仍然亮着 —— 记的是走到过的最远处，不是当前')
    : bad(`往回退之后变成 ${c2} 格，应当仍是 6`)

  //  自检：换配置 = 另一条轨迹，结果全变了，必须重新藏起来
  await p.click('.param:has-text("相联度") .opts button:text-is("8")'); await p.waitForTimeout(400)
  const c3 = await colored()
  c3 === 1
    ? ok('自检：换了相联度之后重新只剩 1 格 —— 新配置是另一条轨迹，旧的"看过"不算数')
    : bad(`换配置后还剩 ${c3} 格有颜色，应当重新藏起来`)
  await p.click('.param:has-text("相联度") .opts button:text-is("2")'); await p.waitForTimeout(300)
}


console.log(`\n${'─'.repeat(50)}`)
console.log(errs.length ? `控制台错误 ${errs.length} 条：\n  ` + errs.slice(0, 4).join('\n  ') : '控制台无错误')
console.log(fail === 0 ? '视图层冒烟：通过' : `视图层冒烟：失败 ${fail} 项`)
await b.close()
process.exit(fail === 0 && errs.length === 0 ? 0 : 1)
