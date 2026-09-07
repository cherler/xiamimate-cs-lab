/**
 * 提示词加载器 —— 极小的一份:读文件、拼 snippet、填变量、缓存。
 *
 * 为什么要有它:提示词以前是 quiz.ts 里的字符串拼接,改一个字要动 TS、review 时混在逻辑中间、
 * 也没法让判据检查「那几条规矩还在不在」。搬成 markdown 之后这三件事都成立了。
 * 形制参考清华 OpenMAIC 的 `templates/<id>/system.md` + `{{snippet:…}}`(MIT)。
 *
 * ⚠️ 占位符找不到时**原样留着**而不是抛异常 —— OpenMAIC 的 README 把这条叫
 * "silent-passthrough gotcha"。留着的话 `{{snippet:option-rules}}` 会被当字面量发给模型,
 * 那几条选项规则就等于没写、而且没人会发现。所以 render 之后必须检查还有没有 `{{`,
 * tests/prompt-rules.test.ts 里有一条判据专盯这个。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DIR = dirname(fileURLToPath(import.meta.url))
const cache = new Map<string, string>()

function readMd(name: string): string {
  const hit = cache.get(name)
  if (hit !== undefined) return hit
  const text = readFileSync(join(DIR, `${name}.md`), 'utf8')
  cache.set(name, text)
  return text
}

/** 渲染一份提示词:先拼 snippet,再填变量。 */
export function prompt(id: string, vars: Record<string, string> = {}): string {
  let out = readMd(id)
  out = out.replace(/\{\{snippet:([a-z0-9-]+)\}\}/g, (_, s: string) => readMd(`_${s}`).trim())
  out = out.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, k: string) => vars[k] ?? m)
  return out.trim()
}

/** 渲染完还剩占位符 = 有东西没填上,发出去等于把字面量喂给模型。判据和运行时都用它。 */
export const unresolved = (text: string): string[] =>
  [...text.matchAll(/\{\{[^}]+\}\}/g)].map(m => m[0])
