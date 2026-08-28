/**
 * 内核：复合索引 · 最左前缀 + 覆盖索引 —— 一个 idx(a,b,c) 能被哪些查询用上（后端 · 数据库系统）
 * 轴：step —— 拿几条 SQL 打在同一个复合索引上，逐条判：走不走索引、要不要回表
 *
 * 复合索引 idx(a,b,c) 在 B+树里是按 (a, 然后 b, 然后 c) 排序的。两条规则决定它值不值：
 *   · **最左前缀**：只有从 a 开始、连续命中的等值条件才能用来在树里定位。
 *       WHERE a=… ✓用a；a=…AND b=… ✓用a,b；但 WHERE b=…（跳过a）✗根本用不上→全表扫；
 *       WHERE a=…AND c=…（b断了）只能用到 a。
 *   · **覆盖索引**：如果 SELECT 要的列全在索引里(a/b/c)，直接从索引拿数据、**不用回表**(不去主键树捞整行)；
 *       只要 SELECT 里有一个索引外的列(如 d)，就得**回表**，慢。
 * 值:每条查询的"可用前缀"和"是否覆盖"都由规则算出、可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const IDX = ['a', 'b', 'c']
type Q = { where: string[]; select: string[]; note: string }
const QUERIES: Q[] = [
  { where: ['a'], select: ['a', 'b', 'c'], note: '最左列 a 命中 → 用索引；SELECT 全在索引里 → 覆盖，不回表' },
  { where: ['a', 'b'], select: ['a'], note: 'a、b 连续命中 → 用到 (a,b)；覆盖，不回表' },
  { where: ['a', 'b', 'c'], select: ['a', 'b', 'c'], note: '三列全命中 → 用到 (a,b,c) 整个索引；覆盖' },
  { where: ['b'], select: ['a'], note: '跳过了最左列 a → 违反最左前缀，索引用不上 → 全表扫描' },
  { where: ['a', 'c'], select: ['a'], note: 'a 命中，但 b 断了 → c 无法用于定位，只用到 a' },
  { where: ['a'], select: ['a', 'b', 'd'], note: 'a 命中走索引；但 SELECT 里 d 不在索引 → 要回表捞 d' },
]

const prefixOf = (eq: string[]) => { const p: string[] = []; for (const col of IDX) { if (eq.includes(col)) p.push(col); else break } return p }
const coveringOf = (sel: string[]) => sel.every(c => IDX.includes(c))

export type CIndexState = {
  i: number
  step: number
  op: 'intro' | 'query' | 'summary'
  qi: number
  where: string[]
  select: string[]
  prefix: string[]         // 索引里被用于定位的列
  usesIndex: boolean
  covering: boolean
  history: { label: string; prefix: string[]; usesIndex: boolean; covering: boolean }[]
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<CIndexState, 'i'>

const qlabel = (q: Q) => `WHERE ${q.where.map(c => `${c}=?`).join(' AND ')} · SELECT ${q.select.join(',')}`

export const compositeindexKernel: Kernel<CIndexState> = {
  kind: 'compositeindex',
  compile(_doc: SimDocument): CompiledModel<CIndexState> {
    const frames: Frame[] = []
    const hist: CIndexState['history'] = []
    const push = (f: Omit<Frame, 'step' | 'history'>) => frames.push({ step: frames.length, history: hist.map(h => ({ ...h })), ...f })

    push({ op: 'intro', qi: -1, where: [], select: [], prefix: [], usesIndex: false, covering: false, phase: 'run', focus: '复合索引 idx(a,b,c)：两条规则决定它有没有用',
      log: `**复合索引 idx(a,b,c)**\nB+树里数据按 (a, 再 b, 再 c) 排序。两条规则：\n· **最左前缀**：只有从 a 起、连续命中的等值条件能用来定位。\n· **覆盖索引**：SELECT 的列全在索引里 → 不用回表。\n下面拿 6 条查询打在这个索引上，逐条判。` })

    QUERIES.forEach((q, qi) => {
      const prefix = prefixOf(q.where)
      const usesIndex = prefix.length > 0
      const covering = coveringOf(q.select)
      hist.push({ label: qlabel(q), prefix, usesIndex, covering })
      push({ op: 'query', qi, where: q.where, select: q.select, prefix, usesIndex, covering, phase: 'run',
        focus: `Q${qi + 1}：${usesIndex ? `用索引 (${prefix.join(',')})` : '用不上索引'}${usesIndex ? (covering ? '，覆盖' : '，回表') : ''}`,
        log: `**Q${qi + 1}**  ${qlabel(q)}\n${usesIndex ? `最左前缀命中 **(${prefix.join(',')})** → 走索引定位` : '**跳过了最左列 a → 用不上索引 → 全表扫描**'}\n${usesIndex ? (covering ? '需要的列全在索引里 → **覆盖索引，不回表** ✅' : 'SELECT 里有索引外的列 → **要回表** 捞整行') : ''}\n${q.note}` })
    })

    push({ op: 'summary', qi: -1, where: [], select: [], prefix: [], usesIndex: false, covering: false, phase: 'done', focus: '两条规则：最左前缀（能不能用）+ 覆盖（要不要回表）',
      log: `**总结：复合索引的两条命门**\n· **最左前缀**：查询条件必须从最左列 a 开始、连续。跳列(WHERE b=)或断层(WHERE a AND c，中间缺 b)，后面的列就用不上——所以复合索引的**列顺序**极其讲究，把最常用/区分度高的放左边。\n· **覆盖索引**：SELECT 的列都在索引里就不用回表（少一次主键树查找），是常见优化——需要哪几列，就把它们塞进索引。\n\n看懂这两条，就知道 EXPLAIN 里为什么有的查询 key=idx、有的 type=ALL(全表扫)，以及为什么建索引要卡列顺序。这是 SQL 索引调优最核心的一课。` })

    const base0: Frame = { op: 'intro', step: -1, qi: -1, where: [], select: [], prefix: [], usesIndex: false, covering: false, history: [], phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '查询步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
