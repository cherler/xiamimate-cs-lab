/** 一次性探针：打印各实验引擎算出的钉死答案 + 关键 trace，供人工核对。 */
import { CATALOG, traceOf } from '../server/catalog.ts'

for (const e of CATALOG) {
  const t = traceOf(e)
  console.log(`\n=== ${e.id} (${e.title})  trace 长度=${t.length} ===`)
  for (const f of e.facts) {
    const { answer, step, evidence } = f.compute(t as Record<string, unknown>[])
    console.log(`  [${f.id}] 答案=${answer}  (第${step}帧)  证据: ${evidence.slice(0, 80)}`)
  }
}
