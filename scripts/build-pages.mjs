import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const base = process.env.PAGES_BASE || '/xiamimate-cs-lab/'
if (!/^\/(?:[a-zA-Z0-9_-]+\/)+$/.test(base)) throw new Error('PAGES_BASE must be an absolute project path ending in /')
const env = { ...process.env, VITE_GITHUB_PAGES: 'true' }
const build = (cwd, args) => execFileSync(process.execPath, [resolve(cwd, 'node_modules/vite/bin/vite.js'), 'build', ...args], { cwd, env, stdio: 'inherit' })

build(root, ['--config', 'web/vite.config.ts', '--base', base, 'web'])
const cards = resolve(root, 'games/algo-cards')
build(cards, ['--base', `${base}cards/`])
const output = resolve(root, 'web/dist')
await cp(resolve(cards, 'dist'), resolve(output, 'cards'), { recursive: true })
for (const [source, target] of [['explainer-hub', 'explainer'], ['qwen-browser', 'explainer-live']]) {
  const html = await readFile(resolve(root, 'experiments', source, 'index.html'), 'utf8')
  await mkdir(resolve(output, target), { recursive: true })
  await writeFile(resolve(output, target, 'index.html'), html.replaceAll('href="/cslab/', `href="${base}`))
}
await writeFile(resolve(output, '.nojekyll'), '')
console.log(`Pages build: ${output} mounted at ${base}; no platform or AI backend required.`)
