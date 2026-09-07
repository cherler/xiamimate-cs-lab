/**
 * 第 0 步「还没开始」全量冒烟 —— 四个学科目录里的每个实验逐个进一遍，看渲染层那一帧站不站得住。
 *
 * 起因（用户 2026-09-07）：「虾米课堂的所有实验，第一步是默认已经走完了的吗？」
 * 是的。改法是在**渲染层**加一帧：状态取内核的 `initial()`，下标取 −1，轨迹一个字不动
 * （往 trace 里插一帧会让 fact 的 `compute(t)[0]`、进度键、分享链接、逐帧比对的判据全体挪位）。
 *
 * 为什么非要全量跑：240 个 stage 是照着**轨迹帧**写的，初始态里数组是空的、计数器是 0、
 * 指针是 −1。类型对得上（实测 285/286 个实验的 initial() 字段集和 trace[0] 完全一致），
 * 但 `arr[0].x` 这种写法类型检查看不出来，一空就炸。这类崩溃在页面上表现为
 * **整棵 React 树消失**（白屏），不看控制台根本不知道是哪个实验坏的。
 *
 * 判的是三件事：
 *   ① 进页面默认停在第 0 步（而不是"第一步已经走完了"）
 *   ② 舞台画得出来、控制台没有未捕获异常
 *   ③ 第 0 步不剧透 —— 逐步日志一行不列、走带上没有一格亮着结果
 *
 * 覆盖面：四个 active 学科目录里的 251 个实验。EXPERIMENTS 里有 287 个，差的 36 个
 * 属于已下线的后端轨等孤儿分组（registry.ts 里写明「group 成孤儿不显示」），
 * 用户在界面上根本点不到 —— 不是这套冒烟漏了。
 *
 * 跑法：npm run smoke:zero（先 npm run web 起 5178），或 node scripts/step-zero-smoke.mjs <url>
 */
import { chromium } from 'playwright'

const URL = process.argv[2] ?? 'http://localhost:5178/'
let bad = 0
const ok = m => console.log('  ✅ ' + m)
const no = m => { bad++; console.log('  ❌ ' + m) }

const NOISE = [/@vite\/client/, /^\[vite\] failed to connect to websocket/, /Download the React DevTools/]

const browser = await chromium.launch()
const p = await browser.newPage({ viewport: { width: 1440, height: 960 } })
let errs = []
p.on('console', m => { if (m.type() === 'error' && !NOISE.some(r => r.test(m.text()))) errs.push(m.text()) })
p.on('pageerror', e => errs.push(String(e)))

await p.goto(URL, { waitUntil: 'networkidle' })
await p.waitForSelector('.nav button', { timeout: 20000 })

/*  ⚠️ `.nav button` 只列**当前学科**的实验（49 个），全站是 286 个。
    第一版就栽在这儿：报「49 个实验全过」看着很绿，其实五分之四根本没进去过。
    所以先把学科标签枚举出来，逐个学科切进去再扫。 */
const discs = await p.$$eval('.disctab:not(.soon)', bs => bs.map(b => b.textContent.trim()))
const names = []
for (let di = 0; di < discs.length; di++) {
  await p.click(`.disctab:not(.soon) >> nth=${di}`)
  await p.waitForTimeout(300)
  const got = await p.$$eval('.nav button', bs => bs.map(b => b.textContent.trim()).filter(Boolean))
  for (const n of got) names.push({ di, name: n })
}
/*  同一个实验可能挂在两个学科下（SOFT_LINKS 软链），所以「进去过几次」和
    「覆盖了几个实验」是两个数，都报出来 —— 只报大的那个会把覆盖面说胖。 */
const uniq = new Set(names.map(x => x.name)).size
console.log(`\n— 第 0 步全量冒烟 · ${discs.length} 个学科、进 ${names.length} 次（去重 ${uniq} 个实验）—\n`)

const broken = [], notZero = [], spoiled = [], blank = [], noStart = []
let curDisc = -1
for (const { di, name } of names) {
  if (di !== curDisc) { await p.click(`.disctab:not(.soon) >> nth=${di}`); await p.waitForTimeout(300); curDisc = di }
  errs = []
  //  目录可能是收起的
  if (await p.$('.grid[data-nav="shut"]')) { await p.click('.nav-fold').catch(() => {}); await p.waitForTimeout(120) }
  try { await p.click(`.nav button:has-text("${name}")`, { timeout: 6000 }) }
  catch { broken.push(`${name}(切不过去)`); continue }
  await p.waitForTimeout(220)

  const v = await p.evaluate(() => ({
    head: document.querySelector('.axis .head .cur')?.textContent ?? '',
    zeroCur: !!document.querySelector('.tick0.cur'),
    //  走带上"已经走过"的格子：还没开始时应该一个都没有
    walked: document.querySelectorAll('.tick:not(.unseen)').length,
    ticks: document.querySelectorAll('.tick').length,
    logRows: document.querySelectorAll('.card.log li').length,
    //  第 0 步的舞台位置上应该是那张起点卡（不是各实验自己的舞台 —— 舞台会把
    //  initial() 里的占位零值当结论画出来，见 shell/StartFrame.tsx 顶上那段）
    start: !!document.querySelector('.startframe'),
    stage: !!document.querySelector('.stage, .card'),
    app: !!document.querySelector('.app'),
  }))

  if (!v.app) { blank.push(name); continue }
  if (errs.length) broken.push(`${name}：${errs[0].slice(0, 110)}`)
  //  轨迹只有一步的实验没有走带（AxisBand 在 N===0 时不渲染），跳过①③
  if (v.ticks > 0) {
    if (!(v.zeroCur && v.head.includes('第 0 步'))) notZero.push(`${name}（走带显示「${v.head}」）`)
    if (v.walked > 0 || v.logRows > 0) spoiled.push(`${name}（${v.walked} 格已亮 / 日志 ${v.logRows} 行）`)
  }
  if (!v.stage) blank.push(name)
  if (v.ticks > 0 && !v.start) noStart.push(name)
}

blank.length === 0 ? ok(`${uniq} 个实验在第 0 步都画得出舞台（进了 ${names.length} 次）`) : no(`${blank.length} 个实验第 0 步是白的：${blank.slice(0, 8).join(' ')}`)
broken.length === 0 ? ok('第 0 步没有一个实验报未捕获异常') : no(`${broken.length} 个实验在第 0 步报错：\n     ${broken.slice(0, 6).join('\n     ')}`)
notZero.length === 0 ? ok('每个实验进来都停在第 0 步（不再是"第一步已经走完了"）') : no(`${notZero.length} 个实验没停在第 0 步：${notZero.slice(0, 6).join('；')}`)
noStart.length === 0 ? ok('第 0 步摆的是起点卡，不是拿初始态硬画的舞台') : no(`${noStart.length} 个实验第 0 步没摆起点卡：${noStart.slice(0, 6).join(' ')}`)
spoiled.length === 0 ? ok('第 0 步不剧透：走带全灰、逐步日志一行不列') : no(`${spoiled.length} 个实验在第 0 步就把结果亮出来了：${spoiled.slice(0, 6).join('；')}`)

/*  能判红的自检 —— 走到第 1 步之后，上面三条必须**全部反转**。
    不验这一下的话，「走带里一格都没亮」既可能是"第 0 步守住了"，
    也可能是选择器写错了永远查不到东西，两者长得一模一样。 */
{
  //  自检前先切回第一个学科的第一个实验 —— 扫完停在哪个实验上是不定的，
  //  而轨迹只有一步的实验根本没有走带（AxisBand 在 N===0 时不渲染），点谁都点不着
  await p.click('.disctab:not(.soon) >> nth=0'); await p.waitForTimeout(400)
  await p.waitForSelector('.axis .ctl .step', { timeout: 10000 })
  await p.click('.axis .ctl .step >> nth=1')   // ▶ 下一步
  await p.waitForTimeout(260)
  const after = await p.evaluate(() => ({
    start: !!document.querySelector('.startframe'),
    head: document.querySelector('.axis .head .cur')?.textContent ?? '',
    zeroCur: !!document.querySelector('.tick0.cur'),
    walked: document.querySelectorAll('.tick:not(.unseen)').length,
    logRows: document.querySelectorAll('.card.log li').length,
  }))
  after.head.includes('第 1 步') && !after.zeroCur && !after.start
    ? ok(`自检：按一下 ▶ 就走到第 1 步（「${after.head}」）`)
    : no(`自检失败：按了 ▶ 还停在「${after.head}」/ 起点卡还在 ${after.start} —— 第 0 步成了走不出去的死格`)
  after.walked > 0 && after.logRows > 0
    ? ok(`自检：第 1 步确实亮了 ${after.walked} 格、日志列了 ${after.logRows} 行 —— 上面那条「不剧透」不是选择器写错`)
    : no(`自检失败：走到第 1 步仍然 ${after.walked} 格亮、日志 ${after.logRows} 行，选择器查不到东西，「不剧透」那条等于空跑`)
}

await browser.close()
console.log(bad === 0 ? '\n本套全部通过' : `\n本套失败 ${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
