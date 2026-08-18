/**
 * 并入虾米伙伴之后的冒烟 —— **必须从平台入口跑**，直接开 :5178 什么都验不到
 *（`/chrome` 与 `/v1` 都在主站那个源上）。
 *
 * ## 本机怎么起（默认入口 :3000，跟虾米看股、虾米看AI 一样）
 *
 *   本仓            npm run web:lab           Vite dev，VITE_BASE=/lab/，:5178
 *   tools-frontend  npm run dev               主站 :3000，next.config 把 /lab/* 转过去
 *   tools-backend   bash scripts/dev.sh       账号与进度接口 :8200
 *   然后            node scripts/platform-smoke.mjs
 *
 * ## 另一个入口：本地网关（验**静态**形态用）
 *
 *   npm run web:build:lab
 *   node scripts/local-gateway.mjs --lab=static --main=static
 *   node scripts/platform-smoke.mjs http://127.0.0.1:8090
 *
 * :3000 那条走的是 Next dev 的 rewrites，方便但**不是线上的形状**；网关那条与
 * `deploy/caddy-snippet.conf` 一一对应，能验到「不存在的资源回不回 404」这类
 * 只有静态托管才成立的事。两条都要能跑通。
 *
 * 与 web-smoke.mjs 的分工：那个验本仓自己的 30 个实验（独立形态），
 * 这个只验**并入的那五件事**（wiki/27）：路由 · 身份 · 外观 · 数据 · 计费。
 * 计费在本仓不适用（运行时不调模型）。
 */
import { chromium } from 'playwright'

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const LAB = `${BASE}/lab/`

let failures = 0
const ok = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { failures++; console.log(`  ❌ ${m}`) }

// ── 先确认三个上游都在，缺谁说谁 ────────────────────────
for (const [what, path, hint] of [
  ['入口', '/lab/', '起 npm run web:lab（VITE_BASE=/lab/），以及主站 npm run dev 或 npm run gateway'],
  ['平台页眉制品', '/chrome/manifest.json', '在 xiamimate-tools-frontend 跑 node scripts/build-chrome-artifacts.mjs'],
  ['主站后端', '/v1/session', '在 xiamimate-tools-backend 跑 bash scripts/dev.sh'],
]) {
  const r = await fetch(BASE + path).catch(() => null)
  if (!r?.ok) {
    console.error(`✗ ${what} 不可达（${BASE}${path}）—— ${hint}`)
    process.exit(1)
  }
}
/**
 * **入口回 200 不等于拿到的是本仓。**
 *
 * 这个前置检查栽过一次：主站 dev 的 rewrite 把 /lab/* 转给 :5178，而那边的
 * dev server 是用 `npm run web`（base = `/`）起的 —— HTML 照样回 200，
 * 但里面写的是 `src="/src/main.tsx"`，转回主站就是 404，页面一片空白。
 * 判据要挂在**内容**上：HTML 里的资源链接必须带 /lab 前缀。
 */
{
  const html = await fetch(`${BASE}/lab/`).then(r => r.text())
  const srcs = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map(m => m[1])
  const stray = srcs.filter(s => !s.startsWith('/lab/'))
  if (stray.length) {
    console.error(`✗ /lab/ 的 HTML 里有不带 /lab 前缀的资源链接：${stray.join(' ')}`)
    console.error('  → 本仓的 dev server 用 npm run web:lab 起（VITE_BASE=/lab/），不是 npm run web')
    process.exit(1)
  }
}

const browser = await chromium.launch()

/** 相对亮度 → 对比度。判"读不读得出来"要有数，不能靠看截图觉得还行。 */
const lum = (css) => {
  const [r, g, b] = css.match(/[\d.]+/g).slice(0, 3).map(Number)
    .map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', e => errs.push(`pageerror: ${e.message}`))
  return { ctx, page, errs }
}

// ══ 1 · 外观：平台页眉页脚真的挂上了 ══════════════════════
console.log('\n【外观】')
const { ctx, page, errs } = await fresh()
await page.goto(LAB, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

{
  const cur = await page.textContent('.xm-embedded-chrome.topbar .switch-cur').catch(() => null)
  cur === '虾米做实验'
    ? ok(`平台页眉挂上了，当前模块「${cur}」`)
    : bad(`页眉没挂上或模块 key 不对（读到「${cur}」）—— 检查 lib/modules.ts 的 key=lab`)
}
{
  //  账号区必须在最右边。制品自造类名把左右两块挤在一起的事出过（wiki/27 · 6.11 #4）。
  const gap = await page.evaluate(() => {
    const l = document.querySelector('.xm-embedded-chrome .brand-switch')?.getBoundingClientRect()
    const r = document.querySelector('.xm-embedded-chrome .top-actions')?.getBoundingClientRect()
    return l && r ? Math.round(r.left - l.right) : -1
  })
  gap > 200 ? ok(`页眉左右两块分得开（间距 ${gap}px）`) : bad(`页眉左右挤在一起（间距 ${gap}px）`)
}
{
  const f = await page.evaluate(() => {
    const el = document.querySelector('#xm-chrome-footer > .site-footer')
    if (!el) return null
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, fg: s.color, h: Math.round(el.getBoundingClientRect().height),
             page: getComputedStyle(document.body).backgroundColor }
  })
  if (!f) { bad('平台页脚没挂上') } else {
    const r = contrast(f.bg, f.fg)
    r >= 4.5
      ? ok(`页脚读得出来：对比度 ${r.toFixed(2)}:1（底 ${f.bg} 字 ${f.fg}，高 ${f.h}px）`)
      : bad(`页脚字读不出来：对比度只有 ${r.toFixed(2)}:1`)
    //  自检：这条判据得会红 —— 把补上去的背景拿掉（退回本仓的深色底），
    //  同一个算式必须给出不合格的数。否则它只是在复述"页脚有背景"。
    const naive = contrast(f.page, f.fg)
    naive < 4.5
      ? ok(`自检：不补背景的话对比度只有 ${naive.toFixed(2)}:1 —— 上一条判据有鉴别力`)
      : bad(`自检失败：不补背景也是 ${naive.toFixed(2)}:1，上一条说明不了问题`)
  }
}
{
  //  平台页眉在第一屏必须看得见。本仓的逐步日志曾经用 scrollIntoView 把整页滚下去，
  //  并入之后正好把页眉滚出屏幕 —— 而它存在的全部意义就是让人一眼认出这是虾米伙伴。
  const y = await page.evaluate(() => window.scrollY)
  y === 0 ? ok('打开页面不自动滚动，平台页眉留在第一屏')
          : bad(`打开就滚了 ${y}px —— 平台页眉被顶出屏幕`)
}
{
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  font.includes('PingFang SC')
    ? ok('字体族取自平台令牌（PingFang SC 打头）')
    : bad(`字体没接上令牌：${font}`)
}

// ══ 2 · 路由：本仓自己的界面一点没少 ══════════════════════
console.log('\n【路由】')
{
  const s = await page.evaluate(() => ({
    title: document.querySelector('.top h1')?.textContent,
    exps: document.querySelectorAll('.nav button').length,
    ticks: document.querySelectorAll('.tick').length,
  }))
  s.exps === 30 && s.ticks > 0
    ? ok(`挂在 /lab/ 下照常跑：「${s.title}」· ${s.exps} 个实验 · ${s.ticks} 步`)
    : bad(`本仓界面不完整：${JSON.stringify(s)}`)
  /**
   * 不存在的资源必须 404，不能是「200 + 首页 HTML」——
   * 那种坏法不报错、不 404，就是给错东西：浏览器把 HTML 当 JS 解析，
   * 控制台一句 `Unexpected token '<'`，而页面看上去只是"没渲染"。
   *
   * **只有静态形态验得了。** dev 模式下网关把 /lab/* 原样转给 Vite，
   * 而 Vite 自己就会回退 index.html —— 那是它的开发行为，跟线上的 Caddy 无关。
   * 在 dev 下判它红等于误报，判它绿等于没验；所以如实说「这一条没验」。
   */
  const dev = await fetch(LAB).then(r => r.text()).then(t => t.includes('/@vite/client'))
  if (dev) {
    console.log('  ⚠️  「不存在的资源回 404」这一条在 dev 模式下验不了'
      + '（Vite 自己会回退 index.html）—— 跑 npm run web:build:lab 后用 --lab=static 再验一次')
  } else {
    const asset404 = await fetch(`${BASE}/lab/assets/根本不存在.js`).then(r => r.status)
    asset404 === 404
      ? ok('不存在的资源回 404，不是 200 + 首页 HTML')
      : bad(`不存在的资源回了 ${asset404} —— 这会让"图挂了看不出来"`)
  }
}

// ══ 3 · 身份 + 数据：未登录 → 登录 → 上云 ═════════════════
console.log('\n【身份与数据】')
{
  await page.click('.chip.act')
  const tag = await page.textContent('.pgcloud').catch(() => null)
  tag === '仅本机'
    ? ok('未登录时面板如实说「仅本机」，并提示登录后可跨设备')
    : bad(`未登录时的说法不对：「${tag}」`)
  await page.click('.pgx')
}

const email = `labsmoke_${Date.now().toString(36)}@example.com`
{
  const r = await page.request.post(`${BASE}/v1/auth/register`,
    { data: { email, password: 'secret123' } })
  r.ok() ? ok(`注册并登录 ${email}`) : bad(`注册失败：${r.status()} ${await r.text()}`)
}

await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
{
  await page.click('.chip.act')
  const tag = await page.textContent('.pgcloud').catch(() => null)
  tag === '已同步'
    ? ok('登录后刷新 → 面板显示「已同步」')
    : bad(`登录后仍显示「${tag}」`)
  await page.click('.pgx')
}

// 答一道题（故意答错，错题本才有东西可验），等防抖推上去
{
  await page.click('.probpick button >> nth=1')          // 选第一道真题
  await page.waitForTimeout(300)
  await page.fill('.qlist li:first-child input', '这肯定不对')
  await page.click('.qlist li:first-child button')
  await page.waitForTimeout(2200)                        // 防抖 1.5s + 一次往返

  const cloud = await page.request.get(`${BASE}/v1/lab/progress`).then(r => r.json())
  const keys = Object.keys(cloud.payload ?? {})
  keys.length === 1 && cloud.payload[keys[0]].wrong === 1 && cloud.rev >= 1
    ? ok(`答错一题 → 云端 rev=${cloud.rev} 记着 ${keys[0]}（错 1 次）`)
    : bad(`没推上去或推错了：${JSON.stringify(cloud)}`)
}
const errsAfter = errs.filter(e => !/favicon/i.test(e))
errsAfter.length === 0 ? ok('控制台无错误') : bad(`控制台有 ${errsAfter.length} 条错误：${errsAfter.join(' | ')}`)

// ══ 4 · 换一台"设备"：合并而不是覆盖 ══════════════════════
console.log('\n【跨设备合并】')
{
  //  第二台设备：同一个账号，但本机先有一条**别的**记录。
  //  合并对了两条都在；写成"后来的整份盖掉先来的"就只剩一条 ——
  //  而丢掉的那条是用户昨天做的题，没有任何地方找得回来。
  const two = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  for (const c of await ctx.cookies()) await two.addCookies([c])
  //  用一个**真实存在**的题号（page-1 的第 1 问）。第一版随手编了个 'zzz-别的题#0'：
  //  云端两条都在（合并是对的），但错题本只显示 1 条 —— 因为错题本只列得出
  //  当前题库里有的题。判据当场看着像 bug，其实是我给的数据不在题库里。
  const other = 'page-1#0'
  const local = { v: 1, q: { [other]: { attempts: 3, wrong: 2, streak: 0, lastCorrect: false, lastAt: 1 } } }
  await two.addInitScript(s => localStorage.setItem('cslab.progress.v1', s), JSON.stringify(local))
  const p2 = await two.newPage()
  await p2.goto(LAB, { waitUntil: 'networkidle' })
  await p2.waitForTimeout(2000)

  const merged = await p2.request.get(`${BASE}/v1/lab/progress`).then(r => r.json())
  const keys = Object.keys(merged.payload ?? {})
  keys.length === 2 && keys.includes(other)
    ? ok(`第二台设备登录 → 两边的记录都在（${keys.length} 问）`)
    : bad(`合并丢了东西：云端只剩 ${JSON.stringify(keys)}`)

  //  两问都做过、都还没掌握 → 页眉上的"已掌握"仍是 0，红点该是 2
  const dot = await p2.textContent('.chip.act .dot').catch(() => null)
  await p2.click('.chip.act')
  const queue = await p2.evaluate(() => document.querySelectorAll('.pgqueue li button').length)
  queue === 2 && dot === '2'
    ? ok('错题本合并后有 2 条，页眉红点也是 2')
    : bad(`错题本 ${queue} 条、页眉红点「${dot}」—— 应该都是 2`)
  await two.close()
}

await ctx.close()
await browser.close()
console.log(failures === 0 ? '\n并入冒烟全部通过' : `\n并入冒烟失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
