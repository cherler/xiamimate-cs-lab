/**
 * 把虾米伙伴的平台设计令牌同步进本仓。
 *
 * **为什么落成文件而不是运行时 fetch。** 本仓的 styles.css 在构建期就要用到这些变量
 * （字体族、页眉高度）。运行时拉的话，样式表加载完成前整页是错的，会闪一下；
 * 而且离线 / 主站没起时本仓就直接构建不出来 —— 本仓还要能打成一个自包含 HTML。
 *
 * **为什么落成的文件要提交进仓。** 一份干净 clone 不装主站也能构建。
 * 文件头写清楚是生成物、真源在哪，谁改了它下次同步就会被覆盖。
 *
 * 取值优先级：
 *   1. --from=<路径>            显式指定
 *   2. 同级目录的主站仓         ../xiamimate-tools-frontend/out/chrome/tokens.css
 *      （主站 dev 只写 public/chrome，所以那儿也找一遍）
 *   3. --origin=<https://…>     从已部署的站点取（手边没有源码时用这条）
 *
 * 用法：node scripts/sync-brand-tokens.mjs [--from=…] [--origin=https://xiamimate.com] [--check]
 * --check 只比对不写：CI 里用它挡住「改了主站没同步」。
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const TARGET = path.join(ROOT, 'web', 'src', 'brand-tokens.css')
const MAIN = path.resolve(ROOT, '..', 'xiamimate-tools-frontend')
const CANDIDATES = [
  path.join(MAIN, 'out', 'chrome', 'tokens.css'),
  path.join(MAIN, 'public', 'chrome', 'tokens.css'),
]

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)

const HEADER = `/* 由 scripts/sync-brand-tokens.mjs 从虾米伙伴主站同步，勿手改。
   真源：xiamimate-tools-frontend/app/brand-tokens.css
   改动流程：改主站那一份 → 主站 node scripts/build-chrome-artifacts.mjs → 本仓 npm run sync:tokens

   本仓怎么用它，见 web/src/styles.css 顶部那段注释 ——
   **不是全盘照搬**：本仓是深色仪表台，配色是自己的，只借字体族与页眉几何。 */
`

async function fetchTokens() {
  if (typeof args.from === 'string') return readFile(args.from, 'utf8')
  if (typeof args.origin === 'string') {
    const url = `${args.origin.replace(/\/$/, '')}/chrome/tokens.css`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`取 ${url} 失败：HTTP ${res.status}`)
    return res.text()
  }
  for (const c of CANDIDATES) {
    try { return await readFile(c, 'utf8') } catch { /* 试下一个 */ }
  }
  throw new Error(
    `找不到主站导出的令牌，试过：\n  ${CANDIDATES.join('\n  ')}\n`
    + '先在主站仓跑 node scripts/build-chrome-artifacts.mjs，'
    + '或用 --origin=https://xiamimate.com 从线上取。',
  )
}

// 剥掉主站导出脚本自己的那行文件头，换成本仓的 —— 否则同步进来的文件里
// 会有两段"勿手改"，且指向不同的地方。
const incoming = HEADER + (await fetchTokens())
  .replace(/^\/\* 由 scripts\/build-chrome-artifacts[^\n]*\n/, '')
const current = await readFile(TARGET, 'utf8').catch(() => '')

if (args.check) {
  if (current === incoming) {
    console.log('[tokens] 与主站一致 ✅')
  } else {
    console.error('[tokens] 与主站不一致 —— 跑 npm run sync:tokens 同步过来。')
    process.exit(1)
  }
} else if (current === incoming) {
  console.log('[tokens] 已是最新，未改动。')
} else {
  await writeFile(TARGET, incoming, 'utf8')
  console.log(`[tokens] 已更新 ${path.relative(ROOT, TARGET)}`)
}
