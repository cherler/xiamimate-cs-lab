/**
 * 内核：工具调用 Tool Calling —— 模型发的调用怎么被处理（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 一批工具调用逐个过流水线：解析 → 门禁 → 执行 → 回灌。每一步真的处理一个调用、往历史里追加一条结果。
 *
 * Agent = LLM + 工具 + 循环。**模型决定调哪个工具**（这步是模型的事、不确定）；**harness 怎么处理这个调用**
 * （解析、分发、执行、把结果喂回）——**这套是确定性流水线，也正是工程上会写错的地方、面试爱问的地方**。本实验真跑一遍：
 *   ① 解析(parse)：把模型发的那段文本 → {工具名, 参数}；不合法就 PARSE_ERROR。
 *   ② 门禁(guard)：是不是已知工具？UNKNOWN_TOOL；权限允许吗？危险操作 DENY。
 *   ③ 执行(execute)：跑这个工具（calc 由引擎真算），带超时。
 *   ④ 回灌(inject)：把结果（或错误）当成一条 tool_result，**配对着它的调用**喂回模型，进入下一轮。
 * 关键八股：**出错不抛异常终止循环，而是把错误当结果喂回**——模型看到错误能重试/换招。
 * 编码不只有 JSON（Codex 的 apply_patch 是自由文本、Aider 用文本 diff），并行/独占、配对——都在下面讲。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type CallStatus = 'ok' | 'denied' | 'unknown' | 'malformed'
type PS = 'pass' | 'fail' | 'skip'          // 流水线每一格：过了/卡在这/没走到
export type Pipe = { parse: PS; guard: PS; exec: PS; inject: PS }
type Call = { id: number; enc: 'JSON' | '自由文本'; raw: string; name: string; args: string; safe: boolean; status: CallStatus; result: string; err: string }
export type HistItem = { name: string; ok: boolean; text: string }

export type ToolCallState = {
  i: number
  step: number
  stage: 'emit' | 'call' | 'done'
  cur: number                 // 当前处理到第几个调用（-1=刚发出这批）
  call?: Call                 // 当前调用
  pipe: Pipe                  // 当前调用走到哪、卡在哪
  outcome: CallStatus | '—'   // 当前调用的结局
  history: HistItem[]         // 已回灌的结果/错误（配对累积）
  total: number
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<ToolCallState, 'i'>

//  一个真计算器工具：解析 "a*b / a-b / a+b" 并求值（execute 这步由引擎真算，不是写死）。
const calcTool = (expr: string): string => {
  const m = expr.match(/^\s*(-?\d+)\s*([-+*])\s*(-?\d+)\s*$/)
  if (!m) return 'ERR'
  const a = +m[1]!, b = +m[3]!
  return String(m[2] === '-' ? a - b : m[2] === '+' ? a + b : a * b)
}
const CALC_EXPR = '1234*5678'

//  模型这一轮发出的一批工具调用（固定输入，像 reactagent 的剧本）。覆盖 4 种结局：成功 / 权限拒绝 / 未知工具 / 解析失败。
const CALLS: Call[] = [
  { id: 1, enc: 'JSON', raw: '{"name":"read_file","args":{"path":"auth.py"}}', name: 'read_file', args: 'path=auth.py', safe: true, status: 'ok', result: 'def login(user): …（auth.py 前 20 行）', err: '' },
  { id: 2, enc: 'JSON', raw: `{"name":"calc","args":{"expr":"${CALC_EXPR}"}}`, name: 'calc', args: `expr=${CALC_EXPR}`, safe: true, status: 'ok', result: '', err: '' },   // result 由引擎真算，见下
  { id: 3, enc: 'JSON', raw: '{"name":"run_shell","args":{"cmd":"rm -rf /tmp/*"}}', name: 'run_shell', args: 'cmd=rm -rf /tmp/*', safe: false, status: 'denied', result: '', err: 'ABORTED：destructive shell 命中 deny 规则，需人工批准' },
  { id: 4, enc: 'JSON', raw: '{"name":"web_serch","args":{"q":"login 500"}}', name: 'web_serch', args: 'q=login 500', safe: true, status: 'unknown', result: '', err: 'UNKNOWN_TOOL：没有名为 web_serch 的工具（是不是 web_search?）' },
  { id: 5, enc: 'JSON', raw: '{"name":"calc","args":{"expr":"2+', name: '', args: '', safe: true, status: 'malformed', result: '', err: 'PARSE_ERROR：JSON 不完整，无法解析' },
]
CALLS[1]!.result = calcTool(CALC_EXPR)   // = 7006652，由 calc 工具真算出来

//  每种结局对应的流水线走位（回灌永远发生——错误也当 tool_result 喂回，这是关键）。
const PIPE_OF: Record<CallStatus, Pipe> = {
  ok:        { parse: 'pass', guard: 'pass', exec: 'pass', inject: 'pass' },
  denied:    { parse: 'pass', guard: 'fail', exec: 'skip', inject: 'pass' },
  unknown:   { parse: 'pass', guard: 'fail', exec: 'skip', inject: 'pass' },
  malformed: { parse: 'fail', guard: 'skip', exec: 'skip', inject: 'pass' },
}
const OUTCOME_LINE: Record<CallStatus, string> = {
  ok: '✅ 已执行，结果配对回灌',
  denied: '⛔ 门禁拒绝，错误回灌（循环不中断）',
  unknown: '❓ 未知工具，错误回灌（循环不中断）',
  malformed: '💥 解析失败，错误回灌（循环不中断）',
}

export const toolcallKernel: Kernel<ToolCallState> = {
  kind: 'toolcall',
  compile(_doc: SimDocument): CompiledModel<ToolCallState> {
    const total = CALLS.length
    const frames: Frame[] = []
    const history: HistItem[] = []
    const NOPIPE: Pipe = { parse: 'skip', guard: 'skip', exec: 'skip', inject: 'skip' }
    const push = (f: Omit<Frame, 'step' | 'total' | 'history'> & Partial<Frame>) =>
      frames.push({ total, history: history.map(h => ({ ...h })), step: frames.length, ...f } as Frame)

    // ── 发出：模型这一轮吐了 5 个工具调用（先看原始文本 + 编码这回事）──
    push({
      stage: 'emit', cur: -1, pipe: NOPIPE, outcome: '—', phase: 'run',
      focus: `模型这一轮发出 ${total} 个工具调用，harness 要逐个处理`,
      log: `**工具调用：模型发了，harness 怎么接？**\nAgent 里，**模型决定调哪个工具**（这步是模型的事）；接下来 **harness 怎么处理这个调用是确定性流水线**：解析 → 门禁 → 执行 → 回灌。\n本轮模型一口气发了 ${total} 个调用，故意cover 4 种结局。\n⚠️ 编码不只有 JSON：Codex 的 \`apply_patch\` 是**自由文本**（不塞 JSON）、Aider 直接用**文本 diff**、有的用 XML 标签。为什么？——**模型无关**（本地/不支持 function-calling 的模型也能用）、避免在 JSON 里塞代码的转义地狱。`,
    })

    // ── 逐个过流水线 ──
    for (let k = 0; k < total; k++) {
      const c = CALLS[k]!
      const pipe = PIPE_OF[c.status]
      const injected: HistItem = c.status === 'ok'
        ? { name: c.name, ok: true, text: c.result }
        : { name: c.name || '(解析失败)', ok: false, text: c.err }
      history.push(injected)
      const detail = c.status === 'ok'
        ? (c.name === 'calc' ? `执行：calc 引擎真算 ${c.args.replace('expr=', '')} = **${c.result}** → 配对回灌` : `门禁：只读、放行 → 执行 → 结果配对回灌`)
        : c.status === 'denied' ? `门禁：destructive shell **命中 deny 规则** → 不执行，错误回灌`
        : c.status === 'unknown' ? `门禁：工具表里没有 **${c.name}** → UNKNOWN_TOOL，错误回灌`
        : `解析：JSON 截断、**parse 失败** → 没走到门禁，错误回灌`
      push({
        stage: k === total - 1 ? 'done' : 'call', cur: k, call: c, pipe, outcome: c.status,
        phase: k === total - 1 ? 'done' : 'run',
        focus: `调用 ${k + 1}/${total}：${c.name || '(malformed)'} → ${OUTCOME_LINE[c.status]}`,
        log: `**调用 ${k + 1}：${c.name || '(解析失败)'}**（${c.enc} 编码）\n\`${c.raw}\`\n${detail}。\n${c.status === 'ok'
          ? '解析✓→门禁✓→执行✓→回灌✓，一路走完。'
          : `**关键：${c.status === 'malformed' ? '解析' : '门禁'}就挡下了，但错误被当成一条 tool_result 喂回模型——循环不中断**，模型看到错误能重试/换招。`}${k === total - 1
          ? `\n\n**小结**：${total} 个调用，${history.filter(h => h.ok).length} 成 / ${history.filter(h => !h.ok).length} 败；**失败全变成结果、没有一个抛异常终止循环**。两个工程点：**配对**——每条结果都带着它的 call_id 喂回，别拆（拆了模型认不出哪个结果对哪个调用）；**并行 vs 独占**——只读/独立的调用（read_file、calc）可并行跑（DeepSeek 默认最多 10 个），写/shell 必须独占排队，不然互相踩。`
          : ''}`,
      })
    }

    const base0: Frame = { stage: 'emit', step: -1, cur: -1, pipe: NOPIPE, outcome: '—', history: [], total, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '处理步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
