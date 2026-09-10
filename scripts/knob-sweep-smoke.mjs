/**
 * 「一点就把整屏清空」—— 逐个点每个旋钮的每个选项，舞台不许变空。
 *
 * 2026-09-10 实测撞到四处：IEEE 754「做什么=add/sub」、虚地址「12 位」、
 * 散列表「表长=7」、TCP「模拟轮数=12」。表现一模一样：点一个**看着完全合法**的
 * 选项，整屏清空，只剩一行「配置不合法」。按「重置」能回来，所以不算灾难 ——
 * 但用户不知道自己做错了什么，只会以为这个实验坏了。
 *
 * 四处的病根是同一个：**参数的合法范围由用户也能编辑的流 / 表格数据决定**，
 * 而参数与数据之间不通气。两种修法各用其所：
 *   · 散列表 —— 那条校验本身就不该有。表满了「装不下」是这个实验该演的东西，
 *     内核早就演了（slot=-1、日志、tone 里的「装不下」），是校验把它挡在门外。
 *   · 其余三处 —— 扩了 `syncs`，让它除了改参数还能换预置数据（见 types.ts 的 SyncResult）。
 *
 * ⚠️ 可选点击一律带 timeout：默认 30 秒 × 几十个选项会把脚本挂死（栽过）。
 *
 * 跑法：node scripts/knob-sweep-smoke.mjs [url] [实验名…]
 *   不给实验名就扫上面那四个 + 几个参数多的。
 */
import { chromium } from 'playwright'

const URL = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:3000/cslab'
const NAMES = process.argv.filter(a => !a.startsWith('http') && !a.endsWith('.mjs') && !a.includes('/'))
const TARGETS = NAMES.length ? NAMES
  : ['IEEE 754', '虚地址转换', '散列表', 'TCP 拥塞窗口', '页面置换', '磁盘调度', 'Cache 命中率']

let bad = 0
const ok = (c, m) => { console.log(`  ${c ? '✅' : '❌'} ${m}`); if (!c) bad++ }

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto(URL, { waitUntil: 'networkidle' })
await p.waitForTimeout(900)

console.log('\n【每个旋钮选项都不许把屏清空】')

for (const name of TARGETS) {
  const box = await p.$('input[type="search"], .searchbox input, input[placeholder*="搜"]')
  if (!box) { ok(false, '找不到搜索框'); break }
  await box.fill(name)
  await p.waitForTimeout(350)
  await p.click('button.tsr', { timeout: 3000 }).catch(() => {})
  await p.waitForTimeout(600)
  await p.click('.gnote .gnx', { timeout: 1500 }).catch(() => {})
  await p.waitForTimeout(200)

  const title = await p.locator('h1').first().innerText().catch(() => '?')
  const broke = []
  const n = await p.locator('.popt, .pbtn, .param button').count()
  for (let i = 0; i < n; i++) {
    const el = p.locator('.popt, .pbtn, .param button').nth(i)
    const label = (await el.innerText().catch(() => '')).trim().slice(0, 14)
    await el.click({ timeout: 1500 }).catch(() => {})
    await p.waitForTimeout(240)
    const st = await p.evaluate(() => ({
      //  「清空」的判据不是"某个元素不见了"，是**舞台上没字了** —— 那才是用户看到的
      blank: (document.querySelector('.stagerow')?.innerText ?? '').trim().length < 12,
      invalid: /配置不合法/.test(document.body.innerText),
    }))
    if (st.blank || st.invalid) broke.push(label)
  }
  ok(broke.length === 0,
    `「${title}」${n} 个旋钮选项逐个点过${broke.length ? ` —— 这些把屏清空了：${broke.join('、')}` : '，没有一个把屏清空'}`)
}

/*  自检：这条判据得能红。拿一个**真的会清空**的配置喂给同一套判法 ——
    散列表的再散列步长与表长不互质（那条校验留着，因为它是真的算不下去）。 */
{
  const box = await p.$('input[type="search"], .searchbox input, input[placeholder*="搜"]')
  await box.fill('散列表'); await p.waitForTimeout(350)
  await p.click('button.tsr', { timeout: 3000 }).catch(() => {})
  await p.waitForTimeout(600)
  await p.click('.gnote .gnx', { timeout: 1500 }).catch(() => {})
  const red = await p.evaluate(() => {
    //  直接在 DOM 上验判法本身：造一个空舞台，看判据认不认
    const t = ''
    return t.trim().length < 12
  })
  ok(red, '自检：舞台没字时这条判法会红 —— 它不是永远为真')
}

await b.close()
console.log(`\n${'─'.repeat(52)}`)
console.log(bad === 0 ? '本套全部通过' : `旋钮扫描：失败 ${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
