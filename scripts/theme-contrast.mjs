/**
 * 两套外观下的对比度体检 —— **在真浏览器里量算出来的颜色**，不是照着调色板算。
 *
 *   node scripts/theme-contrast.mjs [url] [--all] [--min=4.5]
 *
 * 默认只走前 6 个实验（快），`--all` 走全部 30 个。
 *
 * ## 为什么必须在浏览器里量
 *
 * 页面上真正决定「读不读得出来」的是**合成之后**的颜色：
 * 一个 `color:var(--now)` 的字压在 `background:#F0B42918` 的块上，
 * 而那个块又压在 `--panel` 上，`--panel` 又压在 `--void` 上。
 * 调色板上的六个色号全部达标，不代表页面上任何一处达标。
 *
 * 所以这里做两件笨事：
 *   1. 逐层往上找背景，遇到半透明就按 alpha 合成，直到拿到不透明的底色；
 *   2. 拿合成后的底色和 `getComputedStyle().color` 算 WCAG 对比度。
 *
 * ## 门槛
 *
 * 正文档 4.5:1；≥18.66px 且加粗、或 ≥24px 的按大字档 3:1（WCAG 的原文口径）。
 * 本仓满屏是 9.5~12px 的等宽小字，所以基本都走 4.5 那一档。
 *
 * ## 例外只有一条，而且是**故意的弱**
 *
 * `.setrow.vacant`（Cache 里空的那些行）用 `--ghost`：它说的是"这儿什么都没有"，
 * 抢眼反而误导。深色主题里它一直就是 2.0:1，不是这次改浅色改坏的。
 * 例外写在这里、可以被数出来 —— 比在判据里悄悄放行强。
 */
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const URL = args.find(a => !a.startsWith('--')) ?? 'http://127.0.0.1:3000/lab'
const ALL = args.includes('--all')
const MIN = Number(args.find(a => a.startsWith('--min='))?.slice(6) ?? 4.5)

/** 故意做弱的元素：选择器 → 理由。命中的会被单列出来，不计入失败。 */
const DELIBERATELY_FAINT = {
  '.setrow.vacant': '空行的占位字：说的是"这儿什么都没有"，抢眼反而误导',
}

/**
 * 深色主题的欠账基线 —— **已经还清，所以是 0。**
 *
 * 这个数的历史值得留着：做浅色那一轮，深色有 **617** 处 9~12px 的小字压在
 * 2.5~4.2:1（`--faint` 在 `--panel` 上只有 2.55:1）。当时判据写成"不许比 617 多"，
 * 因为把深色一起改会动到一个用户已经看惯的界面，要单独拍板。
 * 后来拍了板：整条字阶往上挪，层级改由字号 / 字距 / 大小写承担 → 617 归零。
 *
 * ⚠️ 617 这个数被我写错过两次，两次都是判据自己的毛病，不是页面的：
 *   · 第一次按印象填 51（拿总数减去页眉那几处心算的）—— **没量过的数别写**；
 *   · 第二次量出 99 / 100，看着像"改坏一处"，实际是去重键漏了实验名，
 *     两处不相干的 `em` 撞在同一个 2.67 上（见下面 uniq 的注释）。
 *
 * 要重新取基线：把 `git show <某个提交>:web/src/*.css` 换回去，用同一个脚本
 * 跑 `--all`，读「以上 N 处」那一行。
 */
const DARK_DEBT_BASELINE = 0

const MEASURE = ({ deliberate, min }) => {
  const parse = (c) => {
    const m = c.match(/[\d.]+/g)
    if (!m) return null
    return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]]
  }
  /**
   * 正常的 alpha 合成（source-over）。
   *
   * ⚠️ 第一版写成 `….concat(1)` —— **合成结果一律当成不透明**。
   * 于是「15% 的深蓝叠在 6% 的蓝上」这一步之后循环就以为拿到底色了，
   * 停在一个几乎全黑的值上，往上真正的白卡片根本没参与运算。
   * 报出来是 `1.26:1` 这种吓人的数字，**而页面上那处其实是 4.6:1，是好的**。
   *
   * 错的测量比没有测量更糟：我差点按这个数去改一个没问题的配色。
   */
  const over = (f, b) => {
    const a = f[3] + b[3] * (1 - f[3])
    if (a === 0) return [0, 0, 0, 0]
    return [0, 1, 2].map(i => (f[i] * f[3] + b[i] * b[3] * (1 - f[3])) / a).concat(a)
  }
  const lum = (c) => {
    const s = c.slice(0, 3).map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

  /**
   * 从元素往上找，把沿途的半透明背景合成掉，直到拿到不透明的底。
   *
   * ⚠️ **DOM 上的父子不等于画面上的上下。** 磁盘调度那些刻度标签是
   * `position:absolute; left:12px` 从 9px 的圆点里探出来的 —— 它在 DOM 里是
   * 圆点的孩子，画面上却落在旁边的图底上。照 DOM 算，底色就成了圆点的琥珀，
   * 而文字也是琥珀，于是报出 `1:1`，**页面上那处其实清清楚楚**。
   *
   * 所以先看几何：元素的中心点不在这个祖先的盒子里，就说明它压根没盖在那块背景上，跳过。
   *
   * ⚠️ 但这条**只对脱离文档流的元素用**。第一版无差别地用，于是进度面板里
   * 被滚出可视区的那些行（在 `.pgbody` 的 overflow 之外）也匹配不上 `.pgwrap`，
   * 一路掉到遮罩层上去算，报出两处 2.3:1 的假失败。
   * 一个修法造出下一个假象 —— 判据每改一次都得重新问「它现在会不会说谎」。
   */
  const groundOf = (el) => {
    let acc = null
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const escapes = ['absolute', 'fixed'].includes(getComputedStyle(el).position)
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (!c || c[3] === 0) continue
      if (escapes && n !== el) {
        const b = n.getBoundingClientRect()
        if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) continue
      }
      acc = acc === null ? c : over(acc, c)
      if (acc[3] >= 0.999) return acc
    }
    //  一路走到根都没遇到不透明的底 —— 那就是浏览器画布本身。
    //  这里的判据不能瞎猜白色：深色主题下猜白会把一堆好的判成坏的。
    const canvas = parse(getComputedStyle(document.documentElement).backgroundColor)
    const base = canvas && canvas[3] > 0 ? canvas : [255, 255, 255, 1]
    return acc ? over(acc, base) : base
  }

  const out = []
  for (const el of document.querySelectorAll('body *')) {
    // 只看**自己直接持有文字**的元素；容器的 color 会被子元素覆盖，算它等于算重
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
    if (!own) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.opacity === '0') continue
    const fg = parse(s.color)
    if (!fg || fg[3] === 0) continue
    /**
     * **element opacity 必须算进去。**
     *
     * 第一版只在 `opacity === '0'` 时跳过，其余一律按 `color` 的原值算 ——
     * 于是 `.ptab td.future{opacity:.34}` 被量成 4.14:1，而它实际接近 1.5:1。
     * 本仓有九处用 opacity 表示"还没轮到 / 不适用"，全都被高估了。
     *
     * 自己和祖先的 opacity 要连乘：一个 .5 套一个 .4 是 .2，不是 .5。
     */
    let fade = 1
    for (let n = el; n; n = n.parentElement) fade *= parseFloat(getComputedStyle(n).opacity)
    const bg = groundOf(el)
    const k = ratio(over([fg[0], fg[1], fg[2], fg[3] * fade], bg), bg)
    const px = parseFloat(s.fontSize)
    const big = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700)
    const need = big ? 3 : min
    if (k >= need) continue
    const hit = Object.keys(deliberate).find(sel => el.closest(sel))
    out.push({
      sel: (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).join('.') : '')).slice(0, 60),
      text: (el.textContent || '').trim().slice(0, 18),
      px, k: Math.round(k * 100) / 100, need, exempt: hit ?? null,
      //  被 opacity 压淡的：本仓用它表示"还没轮到 / 不适用"（未来的步、空的槽、
      //  禁用的按钮）。那是**语义**，不是"这条不重要" —— 单列一栏报出来，
      //  跟"该看清却看不清"的问题分开数。
      faded: Math.round(fade * 100) / 100,
      //  平台页眉页脚是**主站的制品**，颜色定在 tools-frontend 的 globals.css 里，
      //  本仓一行都改不动。混在一起报会让人以为是本仓的问题，
      //  而且它在深浅两套下是同一批数字 —— 那正说明它跟本仓的主题无关。
      chrome: !!el.closest('.xm-embedded-chrome'),
    })
  }
  // 同一条规则会命中很多同类元素，按「选择器 + 比值」去重，只留一条代表
  const seen = new Set()
  return out.filter(x => { const key = `${x.sel}|${x.k}`; if (seen.has(key)) return false; seen.add(key); return true })
}

const browser = await chromium.launch()
let failures = 0, exempted = 0, darkDebt = 0
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await ctx.addInitScript(t => localStorage.setItem('xm-theme', t), theme)
  const page = await ctx.newPage()
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  const names = await page.$$eval('.nav button', bs => bs.map(b => b.textContent.trim()))
  const list = ALL ? names : names.slice(0, 6)
  console.log(`\n【${theme === 'light' ? '白天' : '黑夜'}】走 ${list.length} / ${names.length} 个实验，门槛 ${MIN}:1`)

  const bad = []
  for (let i = 0; i < list.length; i++) {
    await page.click(`.nav button >> nth=${i}`)
    await page.waitForTimeout(160)
    // 真题面板与错题本也要走到 —— 它们的样式跟舞台是两套
    for (const found of await page.evaluate(MEASURE, { deliberate: DELIBERATELY_FAINT, min: MIN })) {
      bad.push({ ...found, exp: list[i] })
    }
  }
  await page.click('.chip.act')
  await page.waitForTimeout(200)
  for (const found of await page.evaluate(MEASURE, { deliberate: DELIBERATELY_FAINT, min: MIN })) {
    bad.push({ ...found, exp: '进度面板' })
  }

  /**
   * 跨实验去重时**必须带上实验名**。
   *
   * 第一版的键是 `选择器|比值`。于是磁盘调度里一个 `em` 是 2.67:1、
   * 散列表里另一个 `em` 也是 2.67:1 —— 两处毫不相干的问题被当成同一条，
   * 后一条从此看不见。后来前者因为底色差了 0.4 个 RGB 变成 2.66，
   * 碰撞解开，计数从 99 跳到 100，**看起来像"改坏了一处"，其实一处都没坏**。
   *
   * 页面内的去重在 MEASURE 里已经做过了（同一条 CSS 规则命中的一批元素），
   * 这里只是把各实验的结果拼起来，本来就不该合并。
   */
  const uniq = (rows) => {
    const seen = new Set()
    return rows.filter(x => {
      const k = `${x.exp}|${x.sel}|${x.k}`
      if (seen.has(k)) return false
      seen.add(k); return true
    })
  }
  const mine = uniq(bad.filter(x => !x.exempt && !x.chrome && x.faded >= 0.999))
  const faded = uniq(bad.filter(x => !x.exempt && !x.chrome && x.faded < 0.999))
  const chrome = uniq(bad.filter(x => !x.exempt && x.chrome))
  exempted += bad.filter(x => x.exempt).length

  for (const x of mine) console.log(`  ❌ ${x.k}:1（要 ${x.need}）${x.px}px  ${x.sel}  「${x.text}」  ← ${x.exp}`)
  if (!mine.length) console.log('  ✅ 本仓所有承载文字的元素都达标')

  if (theme === 'light') {
    failures += mine.length
  } else {
    darkDebt = mine.length
    console.log(`  ↑ 以上 ${mine.length} 处是**改浅色之前就有的**深色欠账（基线 ${DARK_DEBT_BASELINE}）——`)
    console.log('    多半是 --faint(#5D5A73) 压在 --panel 上只有 2.55:1。要不要一起修是另一件事。')
    if (mine.length > DARK_DEBT_BASELINE) {
      failures += mine.length - DARK_DEBT_BASELINE
      console.log(`  ❌ 深色欠账变多了：${DARK_DEBT_BASELINE} → ${mine.length}`)
    }
  }

  if (faded.length) {
    console.log(`  ◌ 另有 ${faded.length} 处是被 opacity 压淡的（"还没轮到 / 不适用"）：`)
    for (const x of faded.slice(0, 40)) console.log(`     ${x.k}:1（透明度 ${x.faded}）${x.sel}  「${x.text}」`)
    console.log('     这是语义不是疏忽 —— 未来的步、空的槽、禁用的按钮本来就该退到后面。')
  }
  if (chrome.length) {
    console.log(`  ⚙️ 另有 ${chrome.length} 处在**平台页眉页脚**里（主站制品，本仓改不动）：`)
    for (const x of chrome.slice(0, 4)) console.log(`     ${x.k}:1  ${x.sel}  「${x.text}」`)
    console.log('     深浅两套下是同一批数字 —— 说明跟本仓的主题无关，改法在 tools-frontend/app/globals.css。')
  }
  for (const [sel, why] of Object.entries(DELIBERATELY_FAINT)) {
    const n = bad.filter(x => x.exempt === sel).length
    if (n) console.log(`  ⚪️ 故意做弱（不计失败）：${sel} × ${n} —— ${why}`)
  }
  await ctx.close()
}
await browser.close()
console.log(failures === 0
  ? `\n对比度体检通过 —— 浅色 0 处不达标；深色欠账 ${darkDebt}（未超基线 ${DARK_DEBT_BASELINE}）；另有 ${exempted} 处写明的故意例外`
  : `\n对比度体检失败 ${failures} 处`)
process.exit(failures === 0 ? 0 : 1)
