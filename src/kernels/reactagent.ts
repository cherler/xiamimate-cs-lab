/**
 * 内核：ReAct Agent 循环 —— 大模型"边想边做"：Thought→Action→Observation 循环调工具（大模型 · 项目实战 / 求职）
 * 轴：step —— 一个多步问题，Agent 交替"推理"和"调用工具"，直到能回答
 *
 * 光有大模型答不了"需要查实时信息/算数/查库"的问题(它会编)。**Agent** = LLM + 工具 + 循环。
 * **ReAct**(Reasoning+Acting)范式把这个循环显式化:
 *   · Thought(想):模型推理下一步该干嘛;
 *   · Action(做):调用一个工具(search/calc/…)并给参数;
 *   · Observation(看):把工具返回的结果喂回给模型;
 *   · 重复,直到模型觉得够了 → Final Answer。
 * 关键:每一步的"想"都基于前面所有的"想+做+看"(整个轨迹拼进 prompt),所以能一步步逼近答案。
 * 本例问「北京今天比上海热多少度」,Agent 依次 search 两地气温、calc 求差,最后作答。可逐步核对。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Turn = { kind: 'thought' | 'action' | 'observation'; text: string; tool?: string; arg?: string }
export type ReactState = {
  i: number
  step: number
  kind: 'intro' | 'thought' | 'action' | 'observation' | 'answer'
  round: number
  text: string             // 本步内容
  tool: string             // action 步的工具名
  arg: string              // action 步的参数
  obs: string              // observation 步的工具返回
  history: Turn[]          // 已发生的 Thought/Action/Observation（累积轨迹）
  answer: string           // 最终答案（answer 步）
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<ReactState, 'i'>

const QUESTION = '北京今天比上海热多少度？'
//  search 返回的是工具的外部数据(模拟真实检索);calc 是算术,由引擎**真算**——这才配得上"Agent 用真结果、少幻觉"
const BEIJING = 30, SHANGHAI = 25   // 两次 search 返回的气温(外部数据)
//  一个真的计算器工具：解析 "a - b / a + b / a * b" 并求值
const calcTool = (expr: string): string => {
  const m = expr.match(/^\s*(-?\d+)\s*([-+*])\s*(-?\d+)\s*$/)
  if (!m) return '?'
  const a = +m[1]!, b = +m[3]!
  return String(m[2] === '-' ? a - b : m[2] === '+' ? a + b : a * b)
}
const CALC_ARG = `${BEIJING} - ${SHANGHAI}`
const DIFF = calcTool(CALC_ARG)   // 由 calc 工具现算 = "5"
const SCRIPT: ({ k: 'thought'; text: string } | { k: 'action'; tool: string; arg: string } | { k: 'observation'; obs: string } | { k: 'answer'; text: string })[] = [
  { k: 'thought', text: '要回答温差，先得知道两地的气温。先查北京。' },
  { k: 'action', tool: 'search', arg: '北京 今天 气温' },
  { k: 'observation', obs: `北京今天最高气温 ${BEIJING}°C` },
  { k: 'thought', text: `北京 ${BEIJING}°C。再查上海。` },
  { k: 'action', tool: 'search', arg: '上海 今天 气温' },
  { k: 'observation', obs: `上海今天最高气温 ${SHANGHAI}°C` },
  { k: 'thought', text: `两地都有了：${BEIJING} 和 ${SHANGHAI}。用计算器算差，别口算出错。` },
  { k: 'action', tool: 'calc', arg: CALC_ARG },
  { k: 'observation', obs: DIFF },   // calc 工具真算出来的，不是写死
  { k: 'thought', text: `差是 ${DIFF}°C，可以回答了。` },
  { k: 'answer', text: `北京今天最高 ${BEIJING}°C，上海 ${SHANGHAI}°C，北京比上海热 ${DIFF}°C。` },
]

export const reactagentKernel: Kernel<ReactState> = {
  kind: 'reactagent',
  compile(_doc: SimDocument): CompiledModel<ReactState> {
    const frames: Frame[] = []
    const history: Turn[] = []
    let round = 1
    const push = (f: Omit<Frame, 'step' | 'history'>) => frames.push({ step: frames.length, history: history.map(h => ({ ...h })), ...f })

    push({ kind: 'intro', round: 0, text: '', tool: '', arg: '', obs: '', answer: '', phase: 'run', focus: 'Agent = LLM + 工具 + 循环；ReAct 把"想→做→看"显式化',
      log: `**ReAct Agent**\n光有大模型答不了"要查实时信息/算数"的问题（它会编）。**Agent = LLM + 工具 + 循环**。ReAct 范式把循环显式化：\n**Thought**(想下一步)→**Action**(调工具)→**Observation**(看结果)→…→**Final Answer**。\n每一步的"想"都基于前面所有的想+做+看。\n问题：「${QUESTION}」看它怎么一步步解。` })

    for (const s of SCRIPT) {
      if (s.k === 'thought') {
        push({ kind: 'thought', round, text: s.text, tool: '', arg: '', obs: '', answer: '', phase: 'run', focus: `第 ${round} 轮 · Thought：${s.text}`,
          log: `**💭 Thought（第 ${round} 轮）**\n${s.text}\n（模型基于目前的整个轨迹推理下一步。）` })
        history.push({ kind: 'thought', text: s.text })
      } else if (s.k === 'action') {
        push({ kind: 'action', round, text: '', tool: s.tool, arg: s.arg, obs: '', answer: '', phase: 'run', focus: `第 ${round} 轮 · Action：${s.tool}(${s.arg})`,
          log: `**🔧 Action（第 ${round} 轮）**\n调用工具 **${s.tool}**，参数「${s.arg}」。\n（模型输出结构化的工具调用，框架去真正执行它——这就是 function calling。）` })
        history.push({ kind: 'action', text: `${s.tool}(${s.arg})`, tool: s.tool, arg: s.arg })
      } else if (s.k === 'observation') {
        push({ kind: 'observation', round, text: '', tool: '', arg: '', obs: s.obs, answer: '', phase: 'run', focus: `第 ${round} 轮 · Observation：${s.obs}`,
          log: `**👀 Observation（第 ${round} 轮）**\n工具返回：**${s.obs}**。\n（把真实结果喂回给模型，进入下一轮"想"。所以 Agent 用的是真数据、不是瞎编。）` })
        history.push({ kind: 'observation', text: s.obs })
        round++
      } else {
        push({ kind: 'answer', round, text: s.text, tool: '', arg: '', obs: '', answer: s.text, phase: 'done', focus: 'Final Answer：够了，作答',
          log: `**✅ Final Answer**\n${s.text}\n\n**小结**：ReAct 让大模型"边想边做"——遇到答不了的就调工具、拿真结果、再继续想，把整个轨迹拼进 prompt 保证每步有上下文。这就是 Agent 的骨架（LangChain/AutoGPT/各种 Copilot 都基于它）。工程要点：工具怎么描述给模型（function schema）、循环怎么停（模型说 Final 或到步数上限）、出错怎么办（观察到错误就重试/换工具）、别让它无限循环。面试讲：ReAct vs function calling（一个是提示范式、一个是模型原生能力）、多步任务怎么拆、怎么防跑飞。` })
      }
    }

    const base0: Frame = { kind: 'intro', step: -1, round: 0, text: '', tool: '', arg: '', obs: '', history: [], answer: '', phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'ReAct 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
