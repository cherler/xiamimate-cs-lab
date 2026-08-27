/**
 * 量具：把一个实验的某个参数逐档扫过去，打印**末步的全部读数**。
 *
 * 为什么在浏览器里量而不是在 node 里跑内核：
 * 很多实验的 `defaultDoc` 带实体表（页表、指令表、进程表），那份配置只活在
 * `registry.ts` 里，而它 import 了 .tsx，node 侧的 tsconfig 进不去。
 * 手写一份等价的 doc 就等于**又造了一个真源** —— 上一次这么干，量出来的
 * TLB 命中全是 0，因为我漏了页表。
 *
 * ⚠️ 只读**右列读数**（`.readouts .pr`）。光写 `.pr` 会把舞台内部的读数也捞进来 ——
 * 有几个实验在舞台里也摆了同名字段，量出来就是「地址总数=128 · … · 地址总数=128 · …」，
 * 看着像界面重复列了两遍，其实是量具的选择器太宽。**量错却不自知比没量更糟。**
 *
 * 用法：node scripts/sweep-readouts.mjs <url> <实验名> [参数标签]
 *   不给参数标签就只打印当前配置下的读数。
 */
import { chromium } from 'playwright'

const [url, expName, paramLabel] = process.argv.slice(2)
if (!url || !expName) { console.error('用法: node scripts/sweep-readouts.mjs <url> <实验名> [参数标签]'); process.exit(1) }

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(url, { waitUntil: 'networkidle' })
await p.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cslab.guide.closed', '1')
  localStorage.setItem('cslab.editor', 'open')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.click(`.nav button:has-text("${expName}")`)
await p.waitForTimeout(500)
const bf = await p.$('.brief .bfx'); if (bf) { await bf.click(); await p.waitForTimeout(200) }

/** 跳到末步再读 —— 读数是滚动值，中途读到的是半截 */
const readAtEnd = async () => {
  const n = await p.evaluate(() => document.querySelectorAll('.tick').length)
  await p.click(`.tick >> nth=${n - 1}`)
  await p.waitForTimeout(280)
  return p.evaluate(() => ({
    steps: document.querySelectorAll('.tick').length,
    readouts: [...document.querySelectorAll('.readouts .pr')].map(e =>
      `${e.querySelector('.k')?.textContent?.trim()}=${e.querySelector('.v')?.textContent?.trim()}`),
  }))
}

if (!paramLabel) {
  const r = await readAtEnd()
  console.log(`${expName}｜${r.steps} 步`)
  console.log('  ' + r.readouts.join('  ·  '))
} else {
  const opts = await p.evaluate(l => {
    const box = [...document.querySelectorAll('.param')].find(e =>
      e.querySelector('.k')?.textContent?.trim().startsWith(l))
    return [...(box?.querySelectorAll('.opts button') ?? [])].map(b => b.textContent.trim())
  }, paramLabel)
  console.log(`${expName}｜参数「${paramLabel}」共 ${opts.length} 档`)
  for (const o of opts) {
    await p.click(`.param:has-text("${paramLabel}") .opts button:text-is("${o}")`)
    await p.waitForTimeout(320)
    const r = await readAtEnd()
    console.log(`  ${o.padEnd(10)} ${String(r.steps).padStart(3)} 步 | ${r.readouts.join('  ')}`)
  }
}
await b.close()
