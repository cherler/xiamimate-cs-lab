/**
 * CSS 里引用的自定义属性，必须真的有人定义过。
 *
 * ## 为什么值得单开一套
 *
 * `var(--ink-3)` 这种写法**不报错**：CSS 遇到未定义的变量就当作无效值，
 * 属性静默回落到继承值。屏幕上的结果是"颜色好像不太对"，
 * 而不是任何一处红字 —— 肉眼过一遍截图根本分不出来。
 *
 * 我在这一轮里一次写错了两个（`--ink-3` / `--fs-1`，真名是 `--faint` / `--t-ui`），
 * 原因都是**照着印象里的命名习惯填**，而不是照着这个仓库的令牌表填。
 * 这条判据把"想不起来就去查"变成一道过不去的墙。
 *
 * 只扫 `web/src` 下的 .css —— 舞台各自的样式也在里面。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

const files: string[] = []
const walk = (d: string) => {
  for (const n of readdirSync(d)) {
    const f = join(d, n)
    if (statSync(f).isDirectory()) walk(f)
    else if (n.endsWith('.css')) files.push(f)
  }
}
walk('web/src')

/**
 * ⚠️ **先把注释剥掉再扫。**
 *
 * 判据第一版直接扫原文，于是把一句写在注释里的
 * 「先写的是 `columns:var(--set-cols)`，后来换掉了」当成了真引用 ——
 * 报「引用了不存在的令牌」，而那个令牌本来就该不存在。
 * 判据比它要守的东西还爱叫，人就会开始忽略它。
 */
const strip = (t: string) => t.replace(/\/\*[^]*?\*\//g, '')
const texts = files.map(f => ({ f, t: strip(readFileSync(f, 'utf8')) }))
const all = texts.map(x => x.t).join('\n')

/** 定义处：`--name:` 出现在声明位置。取全仓库的并集 —— 令牌是跨文件用的。 */
const defined = new Set([...all.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]!))

/**
 * **在 CSS 之外定义的令牌，要在这里登记，并写清是谁定义的。**
 *
 * 登记表不是"把红的关掉"的开关 —— 每一条都得说得出定义方在哪，
 * 说不出来的就是真错。名单短是好事：长到十几条，说明样式在到处接外部约定。
 */
const EXTERNAL: Record<string, string> = {
  //  列数是渲染时才知道的，由舞台内联写在 style 上
  '--n': 'CrcStage.tsx / HammingStage.tsx 内联赋值（列数随位宽变）',
  //  平台外壳自带的一套令牌，页脚借它对色
  '--surface-card': '虾米伙伴外壳 CSS 定义在页脚根元素上（styles.css 那段注释里有交代）',
  //  Cache 表的列数随相联度变，整份网格模板由舞台算好内联写上
  '--cols': 'CacheStage.tsx / AStarStage.tsx 内联赋值（列数由舞台算好）',
  //  并查集按「根」给节点染色，色相由舞台按连通分量内联算出
  '--hue': 'UnionFindStage.tsx 内联赋值（节点色相=所属集团的根，同色一伙）',
}
for (const k of Object.keys(EXTERNAL)) defined.add(k)

console.log('\n【CSS 令牌都有定义】')
{
  ok(`扫了 ${files.length} 个样式文件，${defined.size} 个令牌有定义`
     + `（其中 ${Object.keys(EXTERNAL).length} 个来自 CSS 之外，已登记）`)

  const missing: string[] = []
  for (const { f, t } of texts) {
    for (const m of t.matchAll(/var\(\s*(--[\w-]+)/g)) {
      const name = m[1]!
      //  `var(--x, 回落值)` 里的回落值不算 —— 有回落就不是静默失败
      const rest = t.slice(m.index! + m[0].length)
      if (/^\s*,/.test(rest)) continue
      if (!defined.has(name)) missing.push(`${f.replace('web/src/', '')} 用了 ${name}`)
    }
  }
  const uniq = [...new Set(missing)]
  uniq.length === 0
    ? ok('每一处 var(--…) 都指向一个定义过的令牌')
    : bad(`引用了不存在的令牌：\n     ${uniq.join('\n     ')}`)

  /*
   * 自检：这条判据必须真的抓得住。
   * 造一段引用了不存在令牌的 CSS，走同一段匹配逻辑 —— 它得被挑出来；
   * 同时带回落值的那种不该被挑（否则判据会误杀一批合法写法）。
   */
  const probe = '.x{color:var(--zhe-ge-ling-pai-bu-cun-zai)}.y{color:var(--ye-bu-cun-zai, #000)}'
  const caught: string[] = []
  for (const m of probe.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (/^\s*,/.test(probe.slice(m.index! + m[0].length))) continue
    if (!defined.has(m[1]!)) caught.push(m[1]!)
  }
  caught.length === 1 && caught[0] === '--zhe-ge-ling-pai-bu-cun-zai'
    ? ok('自检：编造的令牌会被抓住，带回落值的不会被误杀 —— 它能红')
    : bad(`自检失败：抓到 ${JSON.stringify(caught)}`)
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
