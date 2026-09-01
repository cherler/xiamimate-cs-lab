/**
 * 内核：上下文压缩 Context Compaction —— Agent 长会话「记不住怎么办」（大模型 · 项目实战 / 求职八股）
 * 轴：step —— 一条会话被压缩的全过程，**每一步都真的改动那份消息列表**：满了 → 分区 → 剪 → 压 → 成。
 *
 * 这是大模型应用/Agent 工程师面试最高频的一题：**上下文窗口爆了怎么办？**
 * Agent 每一步都要把整段历史塞进 prompt 再问模型，会话一长就撞上窗口上限。做法收敛成三步操作：
 *   ① 分区：留头（系统+首任务，钉住）+ 留最近（原样）+ 压中间；分界不拆「工具调用↔结果」对；
 *   ② 先剪超大工具输出（最便宜的一招，够了就停）；
 *   ③ 还超 → 压中间：总结（8段摘要，有损·花模型调用·记得住）或 省略（一行标记，免费·失忆）。
 * 每个 token 都现算；素材来自真实开源框架（Codex / Claude Code / OpenHands / SWE-agent / DeepSeek Harness，见 brief）。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Role = 'system' | 'user' | 'assistant' | 'tool_call' | 'tool_result'
type Region = 'head' | 'middle' | 'tail' | 'pruned' | 'summary' | 'elide'
type Msg = { id: number; role: Role; tok: number; label: string; big?: boolean; pair?: number }
export type ViewMsg = Msg & { region: Region; shownTok: number; note?: string }

export type CompactState = {
  i: number
  step: number
  stage: 'full' | 'partition' | 'prune' | 'rebuild'
  strategy: '总结' | '省略'
  N: number
  thresholdRatio: number
  retainRatio: number
  threshold: number
  retain: number
  msgs: ViewMsg[]        // 当前帧每条消息的区域/显示 token
  running: number        // 当前保留的 token 合计
  before: number         // 压缩前合计
  meter?: { sample: string; chars: number; est: number; real: number }  // 只在「满了」这步给 CJK 陷阱用
  summary?: { sec: string; text: string }[]   // 只在「成·总结」这步：真实的 8 段式摘要内容
  dropped?: string[]                          // 总结时被丢弃的（整屏日志/文件/冗余）
  relievedByPrune: boolean
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<CompactState, 'i'>

//  一次真实的「修登录 500」调试会话（越调越长 → 上下文最终撑爆，这正是压缩存在的理由）。
//  tok = 该条的 token 成本（固定输入）。big=超大工具结果，是先被剪枝的对象。
//  pair 指向它配对的那条（tool_call ↔ 紧随其后的 tool_result），分区时这一对不能被拆开。
const CONV: Msg[] = [
  { id: 1,  role: 'system',      tok: 12, label: '系统提示 + 工具清单（bash/read/edit…）' },
  { id: 2,  role: 'user',        tok: 5,  label: '修复登录接口的 500 错误' },
  { id: 3,  role: 'tool_call',   tok: 4,  label: 'bash: tail 服务日志', pair: 4 },
  { id: 4,  role: 'tool_result', tok: 16, label: '[日志] …NullPointer at auth.py:42 …(整屏)', big: true },
  { id: 5,  role: 'assistant',   tok: 6,  label: '空指针，读 auth.py 看那一行' },
  { id: 6,  role: 'tool_call',   tok: 4,  label: 'read auth.py', pair: 7 },
  { id: 7,  role: 'tool_result', tok: 15, label: '[文件] def login(): …（200 行）', big: true },
  { id: 8,  role: 'assistant',   tok: 6,  label: '第 42 行 user 对象没判空' },
  { id: 9,  role: 'assistant',   tok: 6,  label: '也可能是 session 已过期' },
  { id: 10, role: 'assistant',   tok: 6,  label: '查了下超时配置：30 分钟' },
  { id: 11, role: 'tool_call',   tok: 5,  label: 'bash: 复现一次登录', pair: 12 },
  { id: 12, role: 'tool_result', tok: 8,  label: '[复现] user 确实是 None' },
  { id: 13, role: 'assistant',   tok: 6,  label: '确认了，加判空这一处' },
  { id: 14, role: 'tool_call',   tok: 5,  label: 'edit auth.py:42', pair: 15 },
  { id: 15, role: 'tool_result', tok: 3,  label: 'applied' },
  { id: 16, role: 'tool_call',   tok: 5,  label: 'bash: pytest', pair: 17 },
  { id: 17, role: 'tool_result', tok: 14, label: '[测试] 1 passed, 1 failed（token 过期用例）', big: true },
  { id: 18, role: 'assistant',   tok: 7,  label: 'token 过期的断言挂了，那是另一个问题' },
  { id: 19, role: 'assistant',   tok: 6,  label: '先改 token 校验逻辑，再重跑一遍' },
]

const PRUNED_TOK = 4     // 超大工具结果剪枝后：头4096 + [中间略] + 尾1024 ≈ 一小段
const SUMMARY_TOK = 20   // 8 段式摘要的 token 成本（有损压缩，换一次模型调用）
const ELIDE_TOK = 4      // 「[N 条消息已省略]」一行的成本（无损压缩不存在——这是全丢）

//  「总结」到底把中间那段压成了什么 —— 这是本实验的核心，之前只给了个占位符。
//  真实做法：把中间那段喂给大模型 + 一个固定模板（Claude Code/DeepSeek/Codex 的 8 段），
//  模型**读完写出下面这份摘要**。它是一次大模型调用、有损——不是引擎算出来的，这里给你看真实产出。
//  规律：**留决策/状态/文件/错误，丢冗长的输入输出**。下面是本例（修登录 500）真实会被压成的样子。
const SUMMARY8: { sec: string; text: string }[] = [
  { sec: '① 意图', text: '修复登录接口的 500 错误' },
  { sec: '② 关键概念', text: '空指针(NPE)、session 过期' },
  { sec: '③ 文件与代码', text: 'auth.py — login() 第 42 行' },
  { sec: '④ 错误与修复', text: '500 根因=user 对象为 None 未判空 → 已加判空并 applied' },
  { sec: '⑤ 待办', text: 'token 过期的测试用例仍 failed，未解决' },
  { sec: '⑥ 当前进展', text: '判空修复已应用；pytest 结果 1 passed / 1 failed' },
  { sec: '⑦ 下一步', text: '改 token 校验逻辑，重跑测试' },
  { sec: '⑧ 关键上下文', text: 'session 超时配置 = 30 分钟' },
]
//  被丢掉的（不进摘要）——正是最占 token、最没长期价值的那些。
const DROPPED: string[] = [
  '整屏 NPE 堆栈日志（只留「NPE at auth:42」这一句）',
  'auth.py 200 行文件内容（只留「login() 第 42 行」）',
  '复现命令的完整输出、几条逐字的试探性推理',
]

//  ~4 字/token 的估算 heuristic（DeepSeek Harness 明说它「低估中文和 JSON」）。
const estTok = (s: string) => Math.ceil([...s].length / 4)
//  正经数一遍：中文字≈1 token，其余（英文/数字/符号）≈0.3 token。中文会被上面的估算严重低估。
const realTok = (s: string) => {
  let cjk = 0, other = 0
  for (const ch of s) (/[一-鿿]/.test(ch) ? cjk++ : other++)
  return Math.ceil(cjk + other * 0.3)
}

const sum = (ms: ViewMsg[]) => ms.reduce((a, m) => a + m.shownTok, 0)
const view = (m: Msg, region: Region, shownTok = m.tok, note?: string): ViewMsg => ({ ...m, region, shownTok, note })

export const ctxcompactKernel: Kernel<CompactState> = {
  kind: 'ctxcompact',
  compile(doc: SimDocument): CompiledModel<CompactState> {
    const strategy = (String(doc.params?.strategy ?? '总结') === '省略' ? '省略' : '总结') as '总结' | '省略'
    const thresholdRatio = Number(doc.params?.thresholdRatio ?? 0.8)
    const retainRatio = 0.16                     // DeepSeek Harness 的真实值
    const N = 120                                // 上下文窗口（小窗口便于逐 token 核对）
    const threshold = Math.floor(N * thresholdRatio)
    const retain = Math.ceil(N * retainRatio)

    const before = CONV.reduce((a, m) => a + m.tok, 0)
    const frames: Frame[] = []
    const b0 = { strategy, N, thresholdRatio, retainRatio, threshold, retain, before, phase: 'run' as const }
    const push = (f: Omit<Frame, keyof typeof b0 | 'step'> & Partial<Frame>) =>
      frames.push({ ...b0, step: frames.length, ...f } as Frame)

    // 分区：头（到第一条 user 任务为止）+ 尾（最新往回收，≤retain，不拆 call/result 对）+ 中间
    const firstUser = CONV.findIndex(m => m.role === 'user')
    const headIds = new Set(CONV.slice(0, firstUser + 1).map(m => m.id))
    const tailIds = new Set<number>()
    let tailTok = 0
    for (let k = CONV.length - 1; k > firstUser; k--) {
      const m = CONV[k]!
      if (headIds.has(m.id)) break
      const next = tailTok + m.tok
      if (next > retain && tailIds.size > 0) {
        if (m.role === 'tool_call' && m.pair && tailIds.has(m.pair)) { tailIds.add(m.id); tailTok = next }
        break
      }
      tailIds.add(m.id); tailTok = next
    }
    const regionOf = (m: Msg): Region => headIds.has(m.id) ? 'head' : tailIds.has(m.id) ? 'tail' : 'middle'
    const all = CONV.map(m => view(m, 'middle'))
    const parted = CONV.map(m => view(m, regionOf(m)))
    const headTok = sum(parted.filter(m => m.region === 'head'))
    const midCount = parted.filter(m => m.region === 'middle').length
    const pruned = parted.map(m => m.region === 'middle' && m.big ? view(m, 'pruned', PRUNED_TOK, `${m.tok}t→${PRUNED_TOK}t`) : m)
    const afterPrune = sum(pruned)
    const relievedByPrune = afterPrune < threshold
    const bigInMid = parted.filter(m => m.region === 'middle' && m.big).length
    const midToks = sum(pruned.filter(m => m.region === 'middle'))

    // 压中间后的重建视图（若剪枝已够则不压）
    const checkpoint: ViewMsg = strategy === '总结'
      ? { id: 1000, role: 'user', tok: SUMMARY_TOK, region: 'summary', shownTok: SUMMARY_TOK, label: '[压缩摘要·8段] 意图/关键概念/文件与代码/错误与修复/待办/当前进展/下一步/关键上下文' }
      : { id: 1000, role: 'user', tok: ELIDE_TOK, region: 'elide', shownTok: ELIDE_TOK, label: `[中间 ${midCount} 条消息已省略，共 ${midToks}t]` }
    const rebuilt = relievedByPrune ? pruned
      : [...pruned.filter(m => m.region === 'head'), checkpoint, ...pruned.filter(m => m.region === 'tail')]
    const afterCompress = sum(rebuilt)

    // ── 满了：会话铺开 + 超阈值 + CJK 陷阱（就地一个提示，不再单开步）──
    const sample = '第 42 行 user 对象没判空，session 可能已过期'
    const est = estTok(sample), real = realTok(sample)
    push({
      stage: 'full', msgs: all, running: before, relievedByPrune,
      meter: { sample, chars: [...sample].length, est, real },
      focus: `会话 ${CONV.length} 条、合计 ${before} tokens，超过阈值 ${threshold}（窗口 ${N}×${thresholdRatio}）→ 得压缩`,
      log: `**会话满了，该压缩了**\nAgent 每一步都要把**整段历史**塞进 prompt。这段「修登录 500」的调试已经 ${CONV.length} 条、**${before} tokens**，超过阈值 **${threshold}**（=窗口 ${N} × ${thresholdRatio}）。\n⚠️ 顺带一个坑：很多框架用「4字/token」估 token，它**低估中文**——一句「${sample}」估 ${est}、实际 ${real}（低估 ${(real / est).toFixed(1)}×）；你以为没满、其实早超了。下面按真实 token 压。`,
    })

    // ── ① 分区 ──
    push({
      stage: 'partition', msgs: parted, running: before, relievedByPrune,
      focus: `切三段：留头 ${headTok}t（钉住）· 压中间 ${midCount} 条 · 留尾 ${tailTok}t（原样）`,
      log: `**① 切三段：留头 + 留最近 + 压中间**\n**留头**（蓝，系统提示+第一条任务，${headTok}t，钉住——丢了它 Agent 忘了在干嘛）；**留尾**（绿，最新对话 ${tailTok}t，原样保留，预算 retainRatio ${retainRatio}×${N}≈${retain}t）；**中间**（灰，${midCount} 条）就是要压的。\n⚠️ 分界处不拆「工具调用↔结果」这一对：结果留着、调用被压走，模型看不懂结果哪来的。`,
    })

    // ── ② 先剪超大工具输出（中间还在，只是大块被剪短）──
    push({
      stage: 'prune', msgs: pruned, running: afterPrune, relievedByPrune,
      focus: `先剪 ${bigInMid} 个超大工具输出：${before} → ${afterPrune} tokens`,
      log: `**② 先剪超大工具输出**（最便宜的一招）\n中间那些**整屏的日志/文件输出**（黄色那几条）最占地方又最没密度，先剪成「头4096 + [中间略] + 尾1024 字」——不花模型调用。剪了 ${bigInMid} 个：**${before} → ${afterPrune}**。\n${relievedByPrune ? `已 < 阈值 ${threshold} → **够了，不用总结**。下一步就是最终视图。` : `仍 ≥ 阈值 ${threshold} → 光剪不够，下一步把整个中间压掉。`}`,
    })

    // ── ③ 成：压中间（若还超）+ 重建视图，一步到位、列表明显收缩 ──
    const showSummary = !relievedByPrune && strategy === '总结'
    push({
      stage: 'rebuild', msgs: rebuilt, running: afterCompress, relievedByPrune, phase: 'done',
      summary: showSummary ? SUMMARY8 : undefined,
      dropped: showSummary ? DROPPED : undefined,
      focus: relievedByPrune
        ? `剪枝已够：${before} → ${afterCompress} tokens，回到阈值 ${threshold} 之下`
        : `压中间【${strategy}】+ 重建：中间 ${midToks}t → ${strategy === '总结' ? SUMMARY_TOK : ELIDE_TOK}t，${before} → ${afterCompress}（省 ${before - afterCompress}）`,
      log: relievedByPrune
        ? `**成：剪枝已够，${before} → ${afterCompress}**\n光剪超大工具输出就落回阈值 ${threshold} 之下了，**不用总结**。喂给模型 = 头 + 剪过的中间 + 尾。\n🔑 原始日志一条没删（append-only、可回放）；系统提示在最前，保住 KV 缓存。`
        : `**③ 压中间 → 成：${before} → ${afterCompress}**\n中间那 ${midCount} 条${strategy === '总结'
            ? `收成**一段 8 段式摘要**（紫色那行：意图·关键概念·文件与代码·错误与修复·待办·当前进展·下一步·关键上下文）——有损、花一次模型调用，但记得住`
            : `收成一行「[${midCount} 条已省略]」——免费、确定，但**全丢**、Agent 失忆`}：${afterPrune} → **${afterCompress}**。（切换「压中间」参数看另一种。）\n喂给模型 = **头 + ${strategy === '总结' ? '摘要' : '省略标记'} + 尾**，回到阈值 ${threshold} 之下。🔑 原始日志没删（可回放）、系统提示在最前保 KV 缓存。`,
    })

    const base0: Frame = { ...b0, stage: 'full', step: -1, msgs: all, running: before, relievedByPrune, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '压缩步' },
      initial: () => ({ i: -1, ...base0, phase: 'run' }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
