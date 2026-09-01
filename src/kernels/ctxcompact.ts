/**
 * 内核：上下文压缩 Context Compaction —— Agent 长会话「记不住怎么办」（大模型 · 项目实战 / 求职八股）
 * 轴：step —— 一次真实的压缩流水线，逐段跑给你看
 *
 * 这是大模型应用/Agent 工程师面试最高频的一道题:**「上下文窗口爆了怎么办?」**
 * 每个真实的编码 Agent(Codex / Claude Code / Aider / OpenHands / SWE-agent / DeepSeek Harness)都得解决它。
 * 做法收敛成一套流水线,本实验把它**真跑一遍、每个 token 数都算出来**:
 *   ① 量 token(常见坑:~4字/token 的估算会**低估中文**,压缩触发晚了);
 *   ② 压力检查:累计 ≥ 窗口×阈值(DeepSeek Harness thresholdRatio=0.8)就触发;
 *   ③ 分区:**留头**(系统提示+第一条任务,钉住) + **留最近**(retainRatio=0.16 的尾巴,原样保留) + **压中间**;
 *      —— 分界处不能拆散 工具调用/结果 这一对(call 没了 result、或 result 没了 call,模型会看懵);
 *   ④ 先剪超大工具结果(最便宜的一招:头4096 + [中间略] + 尾1024),够了就不总结;
 *   ⑤ 还超 → 压中间:**总结**(换成一段 8 段式摘要,省 token 但有损、要花一次模型调用) 或 **省略**(直接[N条已略],免费但全丢);
 *   ⑥ 重建视图 = 头 + 摘要 + 尾;**原始日志一条不删**(append-only,可回放可审计)。
 * 数据来自真实开源框架(见 brief 的引用);token 成本是固定输入(像 reactagent 的剧本),分区/累计/剪枝/前后对比全**现算**。
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
  stage: 'intro' | 'meter' | 'pressure' | 'partition' | 'prune' | 'compress' | 'rebuild'
  strategy: '总结' | '省略'
  N: number
  thresholdRatio: number
  retainRatio: number
  threshold: number
  retain: number
  msgs: ViewMsg[]        // 当前帧每条消息的区域/显示 token
  running: number        // 当前保留的 token 合计
  before: number         // 压缩前合计（首帧算出，后面帧带着）
  meter?: { sample: string; chars: number; est: number; real: number }
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
    const base = { strategy, N, thresholdRatio, retainRatio, threshold, retain, before, phase: 'run' as const }
    const push = (f: Omit<Frame, 'step' | keyof typeof base> & Partial<Frame>) =>
      frames.push({ ...base, step: frames.length, ...f } as Frame)

    // ── ① intro：整段会话铺开，token 一路涨 ──
    const all = CONV.map(m => view(m, 'middle'))
    push({
      stage: 'intro', msgs: all, running: before, relievedByPrune: false,
      focus: `一次「修登录 500」的调试会话，越调越长：${CONV.length} 条消息、合计 ${before} tokens`,
      log: `**上下文压缩：Agent 长会话「记不住怎么办」**\nAgent 每一步都要把**整段历史**塞进 prompt 再问模型。会话一长，就撞上**上下文窗口**上限（本例窗口 N=${N} tokens）。\n这是大模型应用/Agent 工程面试最高频的一题。看真实框架怎么处理：一次「修登录 500」的调试，${CONV.length} 条消息、合计 **${before} tokens**。`,
    })

    // ── ② 量 token：中文被低估的坑 ──
    const sample = '第 42 行 user 对象没判空，session 可能已过期'
    const est = estTok(sample), real = realTok(sample)
    push({
      stage: 'meter', msgs: all, running: before, relievedByPrune: false,
      meter: { sample, chars: [...sample].length, est, real },
      focus: `量 token 的坑：一段中文「${sample}」估算 ${est} tokens，实际约 ${real} tokens——低估 ${(real / est).toFixed(1)}×`,
      log: `**① 量 token —— 别被估算骗了**\n很多框架用「**~4 字/token**」快速估 token（DeepSeek Harness 明说它「低估中文和 JSON schema」）。\n拿本会话里一句中文「${sample}」：${[...sample].length} 字 → 估算 **${est}** tokens，但正经数是 **${real}** tokens，**低估 ${(real / est).toFixed(1)}×**。\n后果：按估算你以为离满还早，其实早该压缩了——**中文场景压缩触发得偏晚**。本实验下面用的是真实 token 数。`,
    })

    // ── ③ 压力检查：≥ 阈值就触发 ──
    push({
      stage: 'pressure', msgs: all, running: before, relievedByPrune: false,
      focus: `压力检查：累计 ${before} ≥ 阈值 ${threshold}（=窗口 ${N}×${thresholdRatio}）→ 触发压缩`,
      log: `**② 压力检查**\n触发线 = 窗口 × thresholdRatio = ${N} × ${thresholdRatio} = **${threshold}** tokens（DeepSeek Harness 默认 0.8；Goose 0.8；Codex ~0.9）。\n当前累计 **${before}** ${before >= threshold ? '≥' : '<'} ${threshold} → ${before >= threshold ? '**触发压缩**。' : '还没到，先不动。'}\n（第二个触发点:真撞上「上下文超限」报错时,兜底再压一次。）`,
    })

    // ── ④ 分区：留头 + 留尾（不拆 call/result 对）+ 压中间 ──
    //  头 = 到「第一条 user 任务」为止（系统提示 + 任务，钉住不动）
    const firstUser = CONV.findIndex(m => m.role === 'user')
    const headIds = new Set(CONV.slice(0, firstUser + 1).map(m => m.id))
    //  尾 = 从最新往回收，累计 ≤ retain；遇到「结果」就把它的「调用」一起收，别拆对
    const tailIds = new Set<number>()
    let tailTok = 0
    for (let k = CONV.length - 1; k > firstUser; k--) {
      const m = CONV[k]!
      if (headIds.has(m.id)) break
      const next = tailTok + m.tok
      if (next > retain && tailIds.size > 0) {
        //  预算到顶。但若正卡在一对 call/result 中间，则把这一对补全再停。
        if (m.role === 'tool_call' && m.pair && tailIds.has(m.pair)) { tailIds.add(m.id); tailTok = next }
        break
      }
      tailIds.add(m.id); tailTok = next
    }
    const regionOf = (m: Msg): Region => headIds.has(m.id) ? 'head' : tailIds.has(m.id) ? 'tail' : 'middle'
    const parted = CONV.map(m => view(m, regionOf(m)))
    const headTok = sum(parted.filter(m => m.region === 'head'))
    const midCount = parted.filter(m => m.region === 'middle').length
    push({
      stage: 'partition', msgs: parted, running: before, relievedByPrune: false,
      focus: `分区：头 ${headTok}t（钉住）· 中间 ${midCount} 条（待压）· 尾 ${tailTok}t（原样留，retain=${retain}）`,
      log: `**③ 分区：留头 + 留最近 + 压中间**\n- **头**（蓝）：系统提示 + 第一条任务，**钉住不动**——丢了它 Agent 会忘了自己在干嘛（keep_first）。共 ${headTok}t。\n- **尾**（绿）：最新的对话，**原样保留**——正在做的事最重要。预算 retainRatio×N = 0.16×${N} = **${retain}t**，收了 ${tailTok}t。\n- **中间**（灰）：${midCount} 条，**要压的就是这里**。\n⚠️ 分界处**不拆散 工具调用↔结果**这一对：结果留下、调用被压走，模型就看不懂这结果哪来的。所以尾巴宁可略超预算也把成对的补齐。`,
    })

    // ── ⑤ 先剪超大工具结果（最便宜的一招）──
    const pruned = parted.map(m =>
      m.region === 'middle' && m.big
        ? view(m, 'pruned', PRUNED_TOK, `${m.tok}t→${PRUNED_TOK}t`)
        : m)
    const afterPrune = sum(pruned)
    const relievedByPrune = afterPrune < threshold
    const bigInMid = parted.filter(m => m.region === 'middle' && m.big).length
    push({
      stage: 'prune', msgs: pruned, running: afterPrune, relievedByPrune,
      focus: `先剪 ${bigInMid} 个超大工具结果：合计 ${before} → ${afterPrune}${relievedByPrune ? `（< ${threshold}，压力解除，免总结）` : `（仍 ≥ ${threshold}，继续压）`}`,
      log: `**④ 先剪超大工具结果（cheapest lever first）**\n中间那些**整屏的工具输出**最占地方又最没信息密度。先把它们剪成「头 4096 字 + [中间略] + 尾 1024 字」（DeepSeek 的 tool-result pruner，不花模型调用）。\n本例剪了 **${bigInMid}** 个：合计 ${before} → **${afterPrune}** tokens。\n${relievedByPrune ? `已 < 阈值 ${threshold} → **压力解除，这一步就够了，不必总结**。（这就是"先上最便宜的一招"。）` : `仍 ≥ 阈值 ${threshold} → 光剪不够，进入下一步压中间。`}`,
    })

    // ── ⑥ 还超 → 压中间：总结 or 省略 ──
    let rebuilt: ViewMsg[]
    let afterCompress = afterPrune
    if (relievedByPrune) {
      rebuilt = pruned
    } else {
      const kept = pruned.filter(m => m.region !== 'middle')
      const midToks = sum(pruned.filter(m => m.region === 'middle'))
      const checkpoint: ViewMsg = strategy === '总结'
        ? { id: 1000, role: 'user', tok: SUMMARY_TOK, region: 'summary', shownTok: SUMMARY_TOK,
            label: `[压缩摘要·8段] 意图/关键概念/文件与代码/错误与修复/待办/当前进展/下一步/关键上下文` }
        : { id: 1000, role: 'user', tok: ELIDE_TOK, region: 'elide', shownTok: ELIDE_TOK,
            label: `[中间 ${midCount} 条消息已省略，共 ${midToks}t]` }
      //  重建视图：头 + 检查点 + 尾（保持原顺序）
      const headPart = kept.filter(m => m.region === 'head')
      const tailPart = kept.filter(m => m.region === 'tail')
      rebuilt = [...headPart, checkpoint, ...tailPart]
      afterCompress = sum(rebuilt)
      push({
        stage: 'compress', msgs: rebuilt, running: afterCompress, relievedByPrune,
        focus: `压中间【${strategy}】：中间 ${midToks}t → ${checkpoint.shownTok}t，合计 → ${afterCompress}`,
        log: strategy === '总结'
          ? `**⑤ 压中间 —— 总结（summarize）**\n把中间那段换成**一段结构化摘要**（DeepSeek/Claude Code/Codex 都用固定模板，8 段：意图·关键概念·文件与代码·错误与修复·待办·当前进展·下一步·关键上下文）。\n中间 ${midToks}t → 摘要 **${SUMMARY_TOK}t**，合计 → **${afterCompress}**。\n**代价**：要**花一次模型调用**、且**有损**（细节没了）。**好处**：信息密度高，Agent 还记得来龙去脉。切到「省略」看另一种。`
          : `**⑤ 压中间 —— 省略（elide / truncate）**\n最省事:中间直接换成一行「[${midCount} 条已省略]」（SWE-agent 的做法，不花模型调用）。\n中间 ${midToks}t → **${ELIDE_TOK}t**，合计 → **${afterCompress}**。\n**好处**:免费、确定性、可回放。**代价**:**全丢**——Agent 忘了中间发生过什么。切到「总结」对比:总结贵但记得住,省略便宜但失忆。`,
      })
    }

    // ── ⑦ 重建 + 原始日志不动 ──
    push({
      stage: 'rebuild', msgs: rebuilt, running: afterCompress, relievedByPrune, phase: 'done',
      focus: `压缩完成：${before} → ${afterCompress} tokens（省 ${before - afterCompress}），回到阈值 ${threshold} 之下`,
      log: `**⑥ 重建视图 —— 喂给模型的是「头 + ${relievedByPrune ? '剪枝后的中间' : strategy === '总结' ? '摘要' : '省略标记'} + 尾」**\n**${before} → ${afterCompress} tokens**（省 ${before - afterCompress}），落回阈值 ${threshold} 之下,会话能继续。\n🔑 **原始日志一条没删**:压缩改的是「喂给模型的视图」,底层是 **append-only** 事件日志——可回放、可审计(DeepSeek/OpenHands 都这样)。而且重建时**系统提示和工具原样在最前面**,保住了服务商的 **KV/前缀缓存**(不然整段重算,又慢又贵)。\n\n**面试落点**:上下文爆了→①量 token(注意中文被低估)②到阈值触发③留头+留尾(别拆 call/result 对)④先剪超大工具输出⑤还超就总结(有损·花钱·记得住)或省略(免费·确定·失忆)⑥原始日志留底可回放。总结 vs 省略、剪枝 vs 总结的取舍、怎么保 KV 缓存——都是高频追问。`,
    })

    const base0: Frame = { ...base, stage: 'intro', step: -1, msgs: all, running: before, relievedByPrune: false, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '压缩步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
