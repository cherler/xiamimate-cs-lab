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
  ['第三批内核 · 浮点 / 流水线 / 虚存 / 乘除', 'round3-arch.test.ts'],
  ['第四批内核 · CRC / 海明码 / 子网 / 握手', 'round4-net.test.ts'],
  ['第五批内核 · AVL / 散列 / 哈夫曼 / KMP', 'round5-ds.test.ts'],
  ['第六批内核 · MST / 拓扑关键路径 / 分区 / inode', 'round6-graph-os.test.ts'],
  ['第七批内核 · B+树 / 遍历 / 信号量 / 位示图 / CSMA', 'round7-final.test.ts'],
  ['预置串的说法必须为真', 'presets-claims.test.ts'],
  ['学习进度的规则', 'progress-rules.test.ts'],
  ['跨设备合并的规则', 'sync-merge.test.ts'],
  ['讲解层的内容规则', 'guide-content.test.ts'],
  ['实验单的内容规则', 'brief-content.test.ts'],
  ['实物渲染层的边界', 'render-only.test.ts'],
  ['CSS 令牌都有定义', 'css-tokens.test.ts'],
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
