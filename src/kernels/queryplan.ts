/**
 * 内核：执行计划 / 优化器选路 —— 同一个查询，优化器按"扫多少行"估代价选访问路径（后端 · 数据库系统）
 * 轴：step —— 列出候选访问路径(全表扫 / 走各索引)、各自估扫描行数，选代价最低的，输出 EXPLAIN
 *
 * 一条 SQL,数据库**基于代价的优化器(CBO)**会枚举几种**访问路径**、估每种要扫多少行,挑最省的。
 * 看懂它就能读 EXPLAIN:type(ALL全表扫 / ref等值索引 / range范围索引)、key(用了哪个索引)、rows(估扫描行数)。
 * 本例表 10000 行,查询 WHERE city='北京' AND age>30:
 *   · 全表扫描 → 扫 10000 行;· 走 idx(city) → city 命中 500 行再过滤;· 走 idx(age) → age 范围命中 6000 行。
 * 优化器选 **idx(city)**(估 500 行最少)。值:每条路径的估算行数、选择结果可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Path = { name: string; type: string; key: string; rows: number; note: string }
const TOTAL = 10000
//  选择率(命中比例)——由这个和总行数现算每条路径的估扫描行数(优化器代价的核心)
const CITY_SEL = 0.05   // city='北京' 等值命中 5%
const AGE_SEL = 0.60    // age>30 范围命中 60%
const est = (sel: number) => Math.round(TOTAL * sel)
const PATHS: Path[] = [
  { name: '全表扫描', type: 'ALL', key: '—', rows: TOTAL, note: `不走索引，扫全表 ${TOTAL} 行、逐行判 city 和 age` },
  { name: '走 idx(city)', type: 'ref', key: 'idx_city', rows: est(CITY_SEL), note: `city='北京' 等值命中≈${est(CITY_SEL)} 行(选择率${CITY_SEL * 100}%)，再回表过滤 age` },
  { name: '走 idx(age)', type: 'range', key: 'idx_age', rows: est(AGE_SEL), note: `age>30 范围命中≈${est(AGE_SEL)} 行(选择率${AGE_SEL * 100}%)，再回表过滤 city` },
]
//  优化器选代价(估扫描行数)最低的那条 —— argmin，现算
const CHOSEN = PATHS.reduce((best, p, idx, arr) => (p.rows < arr[best]!.rows ? idx : best), 0)

export type QPlanState = {
  i: number
  step: number
  op: 'intro' | 'path' | 'choose'
  query: string
  paths: Path[]
  revealed: number         // 已列出的候选路径数
  cur: number              // 本步在看的路径下标（-1）
  chosen: number           // 选中的路径（-1 未选）
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<QPlanState, 'i'>

const Q = "SELECT * FROM users WHERE city='北京' AND age>30"

export const queryplanKernel: Kernel<QPlanState> = {
  kind: 'queryplan',
  compile(_doc: SimDocument): CompiledModel<QPlanState> {
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'query' | 'paths'>) => frames.push({ step: frames.length, query: Q, paths: PATHS, ...f })

    push({ op: 'intro', revealed: 0, cur: -1, chosen: -1, phase: 'run', focus: '优化器基于代价：估每种访问路径扫多少行，选最省的',
      log: `**执行计划：优化器怎么选路**\n一条 SQL，数据库的**基于代价优化器(CBO)**会枚举几种**访问路径**、估每种扫多少行，挑最省的。\n查询：\`${Q}\`（表 ${TOTAL} 行）。看它比较三条路径。` })

    PATHS.forEach((p, idx) => {
      push({ op: 'path', revealed: idx + 1, cur: idx, chosen: -1, phase: 'run',
        focus: `候选路径：${p.name}（type=${p.type}，估扫 ${p.rows} 行）`,
        log: `**候选路径 ${idx + 1}：${p.name}**\ntype = **${p.type}**${p.key !== '—' ? `，key = ${p.key}` : ''}，估**扫描 ${p.rows} 行**。\n${p.note}` })
    })

    push({ op: 'choose', revealed: PATHS.length, cur: CHOSEN, chosen: CHOSEN, phase: 'done',
      focus: `选 ${PATHS[CHOSEN]!.name}：估扫 ${PATHS[CHOSEN]!.rows} 行最少`,
      log: `**优化器选择**\n比三条路径的估扫描行数：全表 ${PATHS[0]!.rows}、idx(city) ${PATHS[1]!.rows}、idx(age) ${PATHS[2]!.rows} → 选 **${PATHS[CHOSEN]!.name}**（${PATHS[CHOSEN]!.rows} 行最少）。\nEXPLAIN 就会显示：type=**${PATHS[CHOSEN]!.type}**、key=**${PATHS[CHOSEN]!.key}**、rows≈**${PATHS[CHOSEN]!.rows}**。\n\n**小结**：优化器不看"哪个索引最新"，而是**估代价(要扫多少行)选最省的**。看懂 EXPLAIN：type=ALL 是全表扫(危险)、ref 是等值索引、range 是范围索引；rows 是估扫描行数；key 是实际用的索引。为什么有时"建了索引却不走"——因为优化器算出走索引反而更贵(如命中行太多、回表成本高)，或**统计信息过期**导致估错。面试讲：CBO 怎么估代价、type 各档含义、索引失效的常见原因、怎么用 EXPLAIN 调优。`,
    })

    const base0: Frame = { op: 'intro', step: -1, query: Q, paths: PATHS, revealed: 0, cur: -1, chosen: -1, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '选路步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
