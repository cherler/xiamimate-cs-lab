/**
 * 跑全部测试。任何一项失败即整体失败。
 * 「做完就测」—— 每次改完引擎或内核，先跑这个。
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const tsxBin = resolve(here, '..', 'node_modules', '.bin', 'tsx')

const SUITES = [
  ['阶段 0 · 收敛与确定性（标准 2 / 4）', 'phase0-convergence.test.ts'],
  ['parameter 轴 · 高阶内核', 'parameter-axis.test.ts'],
  ['标准 5 · 内核可插拔', 'kernel-pluggable.test.ts'],
  ['标准 6 · DSL 是唯一入口', 'dsl-sole-entry.test.ts'],
  ['L2 · 组合原语 compare', 'compose-l2.test.ts'],
  ['新内核 · 页面置换 / 磁盘调度', 'new-kernels.test.ts'],
  ['第二批内核 · 排序 / Dijkstra / 银行家 / ARQ', 'round2-kernels.test.ts'],
  ['预置串的说法必须为真', 'presets-claims.test.ts'],
] as const

let failed = 0
for (const [name, file] of SUITES) {
  console.log(`\n${'═'.repeat(52)}\n▶ ${name}`)
  try {
    execFileSync(tsxBin, [join(here, file)], { stdio: 'inherit' })
  } catch {
    failed++
  }
}

console.log(`\n${'═'.repeat(52)}`)
if (failed === 0) {
  console.log(`全部通过（${SUITES.length} 套）`)
} else {
  console.log(`失败 ${failed} / ${SUITES.length} 套`)
  process.exit(1)
}
