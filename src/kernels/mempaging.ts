/**
 * 内核：MemGPT 虚拟内存 / 分页 —— 给 LLM 做操作系统式的内存管理（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 上下文当 RAM、外部存储当磁盘，看它怎么换页：填满 → 内存压力 → 驱逐+递归摘要 → 缺页调回。
 *
 * MemGPT 的洞察：**把 LLM 上下文当"物理内存(RAM)"、外部存储当"磁盘"**，agent 用函数调用在两层间搬数据——
 * 这就是给大模型做**虚拟内存**。和 408 的**页面置换/缺页**是同一套思想。
 *   · **主上下文(RAM，进 prompt)**：① 系统指令(只读) ② 工作记忆(core，可函数改) ③ FIFO 消息队列(首槽=被驱逐消息的递归摘要)。
 *   · **外部存储(磁盘，不进 prompt)**：① recall(全消息库) ② archival(任意文本，可检索)。
 *   · **内存压力**：队列涨到窗口 **70%** → 插一条"内存压力警告"；到 100% → flush，队列管理器**驱逐**约 50% 窗口的老消息到 recall，
 *     并用"旧摘要+被驱逐消息"生成新的**递归摘要**放回队列首槽（有损压缩，但腾出了 RAM）。
 *   · **缺页(page fault)**：需要已驱逐的旧信息 → 函数调用从 recall/archival 检索 → **追加到队尾**、重新进上下文。
 * 数字来自 MemGPT 论文(70% 警告、100% flush、驱逐~50%、递归摘要);水位/驱逐/调回全现算。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Tier = 'system' | 'core' | 'summary' | 'msg'
export type Slot = { id: string; kind: Tier; text: string; tok: number; pagedIn?: boolean }
export type MemPState = {
  i: number
  step: number
  stage: 'intro' | 'fill' | 'pressure' | 'evict' | 'pagein' | 'done'
  N: number                 // 上下文窗口（RAM 容量）
  warnAt: number            // 内存压力警告线（70%）
  ram: Slot[]               // 主上下文（进 prompt）
  ramUsed: number
  recall: Slot[]            // 外部·recall（被驱逐的消息，磁盘）
  archival: Slot[]          // 外部·archival（可检索文本，磁盘）
  op: string                // 本步操作
  pressure: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<MemPState, 'i'>

const N = 100                                    // 窗口 100 tokens（小窗便于逐 token 看）
const WARN = Math.round(N * 0.7)                 // 70% 内存压力警告线（MemGPT 论文值）
const SYSTEM: Slot = { id: 'sys', kind: 'system', text: '系统指令（只读）', tok: 15 }
const CORE: Slot = { id: 'core', kind: 'core', text: '工作记忆：用户在修登录 500', tok: 12 }
//  陆续进来的消息（固定输入）
const MSGS: Slot[] = [
  { id: 'm1', kind: 'msg', text: '用户：登录接口报 500', tok: 12 },
  { id: 'm2', kind: 'msg', text: '助手：先看服务日志', tok: 12 },
  { id: 'm3', kind: 'msg', text: '工具：NullPointer at auth.py:42', tok: 14 },
  { id: 'm4', kind: 'msg', text: '助手：第 42 行没判空，改它', tok: 12 },
]
const SUMMARY: Slot = { id: 'sum', kind: 'summary', text: '[递归摘要] 修登录500：日志现 NPE、定位 auth.py:42', tok: 10 }

const used = (rs: Slot[]) => rs.reduce((a, s) => a + s.tok, 0)

export const mempagingKernel: Kernel<MemPState> = {
  kind: 'mempaging',
  compile(_doc: SimDocument): CompiledModel<MemPState> {
    const frames: Frame[] = []
    // archival 里预存一条可检索记忆（磁盘）
    const archival: Slot[] = [{ id: 'a1', kind: 'msg', text: 'archival：auth.py 用 JWT 鉴权', tok: 14 }]
    let ram: Slot[] = [SYSTEM, CORE]
    let recall: Slot[] = []
    const snap = (over: Partial<Frame> & { stage: Frame['stage']; op: string; focus: string; log: string }) =>
      frames.push({ N, warnAt: WARN, ram: ram.map(s => ({ ...s })), ramUsed: used(ram), recall: recall.map(s => ({ ...s })), archival: archival.map(s => ({ ...s })), pressure: used(ram) >= WARN, phase: 'run', step: frames.length, ...over } as Frame)

    snap({ stage: 'intro', op: '', focus: `上下文=RAM(容量 ${N})、外部存储=磁盘——给 LLM 做虚拟内存`,
      log: `**MemGPT 虚拟内存：给 LLM 做操作系统**\n上下文窗口有限，装不下所有历史。MemGPT 的招：**把上下文当"物理内存 RAM"、外部存储当"磁盘"**，用函数调用在两层间搬数据——就是**虚拟内存**（和 408 的页面置换/缺页一个思想）。\n**RAM(进 prompt)**：系统指令(只读) + 工作记忆(core，可改) + FIFO 消息队列。\n**磁盘(不进 prompt)**：recall(全消息库) + archival(可检索文本)。\n窗口 N=${N}，内存压力警告线 ${WARN}(=70%)。现在 RAM 只有系统+core=${used(ram)}t。` })

    // ── 填充：消息陆续进 RAM ──
    for (const m of MSGS) ram.push(m)
    snap({ stage: 'fill', op: `${MSGS.length} 条消息进入 FIFO 队列`, focus: `消息填进 RAM：${used([SYSTEM, CORE])} → ${used(ram)}t（越过 ${WARN} 警告线）`,
      log: `**① 消息填进 RAM(FIFO 队列)**\n对话一来一回，消息不断追加进 FIFO 队列。RAM 水位 ${used([SYSTEM, CORE])} → **${used(ram)}t**。\n窗口就 ${N}，很快逼近上限——这正是要换页的原因。` })

    // ── 内存压力：≥70% ──
    snap({ stage: 'pressure', op: '队列管理器插入"内存压力警告"', focus: `RAM ${used(ram)} ≥ ${WARN}(70%) → 内存压力警告`,
      log: `**② 内存压力警告（70%）**\nRAM 用到 **${used(ram)}t ≥ ${WARN}(=窗口 70%)**。队列管理器往队列里插一条**"内存压力警告"**系统消息，提醒该换页了（到 100% 就强制 flush）。\n就像 OS 里内存快满、触发换页的那个**中断**。` })

    // ── 驱逐 + 递归摘要（flush 老消息到 recall/磁盘）──
    const evicted = ram.filter(s => s.kind === 'msg').slice(0, 3)   // 驱逐最老的 3 条（~50% 窗口）
    recall = [...recall, ...evicted]
    ram = [SYSTEM, CORE, SUMMARY, ...ram.filter(s => s.kind === 'msg').slice(3)]
    snap({ stage: 'evict', op: `驱逐 ${evicted.length} 条老消息→recall(磁盘)，写递归摘要回队首`, focus: `驱逐换页：RAM 降到 ${used(ram)}t，被驱逐的进 recall`,
      log: `**③ 驱逐 + 递归摘要（换页到磁盘）**\n队列管理器把**最老的 ${evicted.length} 条消息**(${evicted.map(s => s.id).join('/')})驱逐到 **recall(磁盘)**；再用"旧摘要 + 被驱逐消息"生成一条**递归摘要**(${SUMMARY.tok}t)放回**队列首槽**。\nRAM ${used([SYSTEM, CORE, ...MSGS])} → **${used(ram)}t**，腾出空间。\n**这就是页面置换**：把不常用的"页"(老消息)换出到磁盘，只留摘要这个"索引"。有损，但会话能继续。` })

    // ── 缺页：需要已驱逐的旧信息 → 从 recall 调回 ──
    const need = recall.find(s => s.id === 'm3')!
    ram = [...ram, { ...need, pagedIn: true }]
    snap({ stage: 'pagein', op: `conversation_search 命中 recall 里的 ${need.id}，调回队尾`, focus: `缺页调入：需要 ${need.id}(已在磁盘) → 检索调回 RAM`,
      log: `**④ 缺页(page fault)：把旧信息调回来**\n接着用户追问"那个 NPE 具体在哪行?"——需要 **${need.id}**，但它已被驱逐到 recall(磁盘)、不在 RAM 里(**缺页**)。\nagent 发函数调用 \`conversation_search(NPE)\` → 命中 recall 里的 ${need.id} → 队列管理器把它**追加到队尾**、重新进上下文(RAM ${used(ram) - need.tok} → ${used(ram)}t)。\n**这就是缺页调入**：要用的页不在内存，从磁盘 load 回来。archival_memory_search 同理(从 archival 那层调)。` })

    snap({ stage: 'done', op: '', phase: 'done', focus: `完：上下文=RAM、外部=磁盘，函数调用换页;和 408 页面置换同一思想`,
      log: `**小结：agent 记忆 = 给 LLM 做虚拟内存**\n上下文(RAM，快·贵·小) ↔ 外部存储(磁盘，慢·便宜·大)，agent 用函数调用自己换页：\n· **core_memory_append/replace**：改工作记忆(RAM 里的 core)。\n· **archival_memory_insert/search**：写/读 archival(磁盘)。\n· **conversation_search**：搜 recall(磁盘的旧消息)。\n**OS 对照**：主上下文=物理内存、外部=磁盘、70% 警告=内存压力中断、驱逐+递归摘要=页面置换(换出)、检索调回=缺页调入(换入)。\n和你 408 的**页面置换/缺页**是同一套算法——只不过"页"换成了对话消息、"置换"多了一层有损摘要。面试延伸：递归摘要有损(细节丢了要靠 archival 精确调回)、换页太频繁=抖动(thrashing)。` })

    const base0: Frame = { N, warnAt: WARN, stage: 'intro', step: -1, ram: [SYSTEM, CORE], ramUsed: used([SYSTEM, CORE]), recall: [], archival, op: '', pressure: false, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '换页步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
