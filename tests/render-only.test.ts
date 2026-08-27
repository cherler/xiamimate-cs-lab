/**
 * 实物渲染层的边界 —— **只做展示，不承载判定**。
 *
 * 这一条是三块一体那份纪律的具体化：屏幕上每个数只有一个来源，
 * 就是那条被验过的轨迹。3D 层一旦自己算起来，就出现了第二个来源，
 * 而两个来源里错的那个长得跟对的一模一样。
 *
 * 所以判据不是"看代码觉得它没算"，是**它根本够不着引擎**：
 * 不许 import `@engine/*`，也不许 import 别的舞台或注册表。
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

const DIR = path.resolve(import.meta.dirname, '..', 'web', 'src', 'stages')
/** 纯展示层：文件名以 3d 结尾的那些 */
const RENDER_ONLY = readdirSync(DIR).filter(f => /3d\.tsx?$/.test(f))

console.log('\n【实物渲染层够不着引擎】')
{
  RENDER_ONLY.length > 0
    ? ok(`找到 ${RENDER_ONLY.length} 个纯展示层：${RENDER_ONLY.join(', ')}`)
    : bad('一个都没找到 —— 这套判据要么文件改名了，要么根本没跑到')

  const banned = /from\s+['"](@engine\/|\.\.\/registry|\.\/[A-Z]\w*Stage)/
  const dirty: string[] = []
  for (const f of RENDER_ONLY) {
    const src = readFileSync(path.join(DIR, f), 'utf8')
    //  逐行看，好把行号报出来 —— 只说"这个文件不干净"没法改
    src.split('\n').forEach((line, i) => {
      if (banned.test(line)) dirty.push(`${f}:${i + 1} ${line.trim().slice(0, 60)}`)
    })
  }
  dirty.length === 0
    ? ok('没有一个展示层 import 了引擎、注册表或别的舞台')
    : bad(`展示层碰了不该碰的：\n     ${dirty.join('\n     ')}`)

  /*
   * 自检：这条判据得真的抓得住。
   * 拿一行伪造的 import 喂给同一个正则 —— 抓不住就说明它形同虚设。
   */
  banned.test("import { run } from '@engine/core/kernel.ts'")
    ? ok('自检：伪造一行 `from "@engine/…"` 确实会被抓住 —— 这条判据能红')
    : bad('自检失败：正则连最直白的那种都抓不住')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
