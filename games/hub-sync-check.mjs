/**
 * 两个游戏各有一份「课堂外壳」hub.ts,是**逐字节相同的拷贝**(两个游戏是 subtree
 * 收进来的独立仓,各自要能单独构建,所以不共享文件、不跨目录 import)。
 * 拷贝最怕的是改一处忘了另一处 —— 这条判据就钉这个,不一致直接判红。
 * 跑法:node games/hub-sync-check.mjs
 */
import { readFileSync } from 'node:fs'
const A = 'games/algo-cards/hub.ts', B = 'games/xiami-world/game/hub.ts'
const a = readFileSync(A, 'utf8'), b = readFileSync(B, 'utf8')
if (a === b) { console.log(`  ✅ 两份 hub.ts 一致(${a.length} 字节)`); process.exit(0) }
const la = a.split('\n'), lb = b.split('\n')
const i = la.findIndex((l, k) => l !== lb[k])
console.log(`  ❌ 两份 hub.ts 不一致,第 ${i + 1} 行起分岔:\n     ${A}: ${la[i]}\n     ${B}: ${lb[i]}`)
console.log('     改一处必须同步另一处:cp games/algo-cards/hub.ts games/xiami-world/game/hub.ts')
process.exit(1)
