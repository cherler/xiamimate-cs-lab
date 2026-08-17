/**
 * 把 Vite 产物压成一个自包含 HTML —— 用于分享/离线查看，不引额外依赖。
 *   npm run web:single
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'web', 'dist')
const assets = join(dist, 'assets')

let html = readFileSync(join(dist, 'index.html'), 'utf8')
const files = readdirSync(assets)

const css = files.find(f => f.endsWith('.css'))
const js = files.find(f => f.endsWith('.js'))
if (!css || !js) { console.error('dist/assets 里找不到 css 或 js，先跑 npm run web:build'); process.exit(1) }

// 必须用**替换函数**而不是替换字符串：
// 字符串形式里 $& 表示"被匹配的原文"，而压缩后的 JS 包体必然含 $& ——
// 那会把原来的 <script src> 标签又插回去，看起来像"没替换成功"。
html = html.replace(
  new RegExp(`<link[^>]+href="[^"]*${css}"[^>]*>`),
  () => `<style>\n${readFileSync(join(assets, css), 'utf8')}\n</style>`)
html = html.replace(
  new RegExp(`<script[^>]+src="[^"]*${js}"[^>]*></script>`),
  () => `<script type="module">\n${readFileSync(join(assets, js), 'utf8')}\n</script>`)

// 守卫：查还有没有指向外部资源的**标签**。
// 不能查裸字符串 "/assets/" —— 内联进来的 JS 包体自己就含这个字样，会误报。
const external = html.match(/<(?:script[^>]+src|link[^>]+href)="(?!data:)[^"]+"/g) ?? []
if (external.length > 0) {
  console.error('还有未内联的外部引用：\n  ' + external.join('\n  '))
  process.exit(1)
}

const out = join(root, 'docs', 'mockups', 'workbench-live.html')
writeFileSync(out, html)
console.log(`单文件产物 ${out}`)
console.log(`大小 ${(html.length / 1024).toFixed(0)} KB`)
