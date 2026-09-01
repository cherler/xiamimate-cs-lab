/**
 * 内核：Agent 主循环 · 防死循环 —— 想→做→看的循环，怎么**正确地停**（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 一次 ReAct 循环逐步跑，重点看它**什么时候、为什么停**。
 *
 * Agent = LLM + 工具 + 循环：Thought(想)→Action(调工具)→Observation(看结果)→…。循环好写，**难的是让它正确地停**：
 *   · 正常：模型不再发工具调用（觉得够了）→ 给 Final Answer。
 *   · 陷入重复：模型一直发同一个动作 → **stuck 检测**（最近几步动作相同就中止），防死循环。
 *   · 超预算：一直不收敛 → 撞上**步数/成本预算**上限 → 停，交当前 best-effort。
 *   · 出错/崩溃：中途异常 → **不硬崩，autosubmit 交一版**当前最好结果（SWE-agent 的做法），别白跑。
 * 这套**终止逻辑是确定性状态机**——正是工程会写错（跑飞、烧钱、白跑）、面试爱问的地方。切「场景」看四条终止路径。
 * 术语：**step**=一次模型请求+它的工具；**turn**=零或多个 step。预算通常按 step/成本算。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Scenario = '正常' | '重复' | '超预算' | '出错'
type Kind = 'intro' | 'thought' | 'action' | 'observation' | 'answer' | 'halt' | 'error'
type Halt = '' | 'answer' | 'stuck' | 'budget' | 'error'
type Turn = { kind: Kind; text: string; tool?: string; arg?: string; bad?: boolean }
export type ReactState = {
  i: number
  step: number
  scenario: Scenario
  round: number
  kind: Kind
  text: string
  tool: string
  arg: string
  obs: string
  history: Turn[]
  stepCount: number       // 已走的 step 数（一次 action = 一步）
  budget: number          // 步数预算上限
  recent: string[]        // 最近几步的动作（stuck 检测的滑动窗口）
  halt: Halt              // 终止原因（空=还在跑）
  answer: string
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<ReactState, 'i'>

const BUDGET = 6           // 步数预算
const STUCK_K = 3          // 最近 K 步动作相同 → 判定 stuck

type Rnd = { t: string; tool: string; arg: string; o: string; bad?: boolean }
//  每个场景的动作剧本（固定输入）。控制逻辑(stuck/预算/终止)由引擎**现算**，不写死。
const SCRIPTS: Record<Scenario, { rounds: Rnd[]; answer?: string; crash?: string }> = {
  正常: {
    rounds: [
      { t: '要算温差，先查北京气温', tool: 'search', arg: '北京 气温', o: '30°C' },
      { t: '再查上海', tool: 'search', arg: '上海 气温', o: '25°C' },
      { t: '两地都有了，用计算器算差', tool: 'calc', arg: '30 - 25', o: '5' },
    ],
    answer: '北京今天最高 30°C，上海 25°C，北京比上海热 5°C。',
  },
  重复: {
    rounds: [
      { t: '查北京气温', tool: 'search', arg: '北京 气温', o: '（超时）无结果', bad: true },
      { t: '没拿到，再试一次', tool: 'search', arg: '北京 气温', o: '（超时）无结果', bad: true },
      { t: '还不行，再试', tool: 'search', arg: '北京 气温', o: '（超时）无结果', bad: true },
      { t: '再来一次', tool: 'search', arg: '北京 气温', o: '（超时）无结果', bad: true },
    ],
  },
  超预算: {
    rounds: [
      { t: '先查天气', tool: 'search', arg: '天气', o: '一堆结果' },
      { t: '范围太大，查北京天气', tool: 'search', arg: '北京 天气', o: '一堆结果' },
      { t: '再缩，查北京今天', tool: 'search', arg: '北京 今天 天气', o: '一堆结果' },
      { t: '看看小时预报', tool: 'search', arg: '北京 逐小时', o: '一堆结果' },
      { t: '换个源', tool: 'search', arg: '北京 气象台', o: '一堆结果' },
      { t: '再换一个', tool: 'search', arg: '北京 天气 API', o: '一堆结果' },
      { t: '还想接着搜…', tool: 'search', arg: '北京 实时', o: '' },
    ],
  },
  出错: {
    rounds: [
      { t: '先改配置', tool: 'edit', arg: 'config.yaml', o: 'applied' },
      { t: '跑测试验证', tool: 'run', arg: 'pytest', o: '测到一半…' },
    ],
    crash: '沙箱进程被 OOM Killer 杀掉（异常）',
  },
}

export const reactagentKernel: Kernel<ReactState> = {
  kind: 'reactagent',
  compile(doc: SimDocument): CompiledModel<ReactState> {
    const scenario = (['正常', '重复', '超预算', '出错'] as Scenario[]).includes(doc.params?.scenario as Scenario) ? doc.params!.scenario as Scenario : '正常'
    const S = SCRIPTS[scenario]
    const frames: Frame[] = []
    const history: Turn[] = []
    const recent: string[] = []
    let stepCount = 0
    let halt: Halt = ''
    const base = (over: Partial<Frame>): Frame => ({
      scenario, round: 0, kind: 'intro', text: '', tool: '', arg: '', obs: '',
      history: history.map(h => ({ ...h })), stepCount, budget: BUDGET, recent: [...recent],
      halt, answer: '', phase: 'run', focus: '', log: '', step: frames.length, ...over,
    })
    const push = (over: Partial<Frame>) => frames.push(base(over))

    push({ kind: 'intro', focus: `Agent 主循环，场景：${scenario}——看它什么时候、为什么停`,
      log: `**Agent 主循环 · 防死循环**\nThought→Action→Observation 循环好写，**难的是让它正确地停**。四条终止路径（切「场景」看）：\n· **正常**：模型不再发工具→Final Answer。\n· **重复**：一直发同一动作→**stuck 检测**中止（最近 ${STUCK_K} 步动作相同）。\n· **超预算**：不收敛→撞 ${BUDGET} 步预算→停、交 best-effort。\n· **出错**：中途崩→**不硬崩、autosubmit 交一版**。\n本次场景 = **${scenario}**。` })

    let round = 0
    for (const r of S.rounds) {
      round++
      // Thought
      push({ kind: 'thought', round, text: r.t, focus: `第 ${round} 轮 · 想：${r.t}`,
        log: `**💭 Thought（第 ${round} 轮）**\n${r.t}` })
      history.push({ kind: 'thought', text: r.t })

      // Action —— 一步，计数 + 进 stuck 窗口
      stepCount++
      const actKey = `${r.tool}(${r.arg})`
      recent.push(actKey)
      history.push({ kind: 'action', text: actKey, tool: r.tool, arg: r.arg })
      // stuck 检测：最近 STUCK_K 步动作是否全相同（现算）
      const win = recent.slice(-STUCK_K)
      const stuck = win.length === STUCK_K && win.every(a => a === win[0])
      push({ kind: 'action', round, tool: r.tool, arg: r.arg, focus: `第 ${round} 轮 · 做：${actKey}（第 ${stepCount}/${BUDGET} 步）`,
        log: `**🔧 Action（第 ${round} 轮，第 ${stepCount}/${BUDGET} 步）**\n调用 **${r.tool}(${r.arg})**。\nstuck 窗口（最近 ${STUCK_K} 步）：${recent.slice(-STUCK_K).map(a => `\`${a}\``).join(' ')}${stuck ? ' ← **全相同！**' : ''}` })

      // 终止判定①：stuck
      if (stuck) {
        halt = 'stuck'
        push({ kind: 'halt', round, phase: 'done', focus: 'stuck 检测：最近 3 步动作相同 → 中止',
          log: `**🛑 停：陷入重复（stuck）**\n最近 ${STUCK_K} 步都是 \`${actKey}\`——模型卡住了、在原地打转。**stuck 检测中止循环**，防止无限跑下去烧钱。\n（工程上：检测"重复动作/无进展"，或干脆给个步数上限兜底。）` })
        break
      }
      // 终止判定②：预算
      if (stepCount >= BUDGET) {
        halt = 'budget'
        push({ kind: 'halt', round, phase: 'done', focus: `步数达上限 ${BUDGET} → 超预算终止`,
          log: `**🛑 停：超预算**\n走满 **${BUDGET}** 步还没收敛。**撞上步数/成本预算上限**（SWE-agent 有 per_instance_cost_limit）→ 停下，**交当前 best-effort**，别无限烧算力。\n（硬上限安全但可能截断正经活；软终止靠 stuck 检测+压缩兜底。）` })
        break
      }

      // Observation
      history.push({ kind: 'observation', text: r.o, bad: r.bad })
      push({ kind: 'observation', round, obs: r.o, text: r.o, focus: `第 ${round} 轮 · 看：${r.o || '（空）'}`,
        log: `**👀 Observation（第 ${round} 轮）**\n工具返回：**${r.o || '（空/无结果）'}**${r.bad ? '——没进展，下一轮还这么调就危险了。' : '。'}` })

      // 出错场景：跑到 crash 点
      if (scenario === '出错' && S.crash && round === S.rounds.length) {
        halt = 'error'
        history.push({ kind: 'error', text: S.crash, bad: true })
        push({ kind: 'halt', round, phase: 'done', answer: '（best-effort）已改好 config.yaml，测试未跑完', focus: '中途崩溃 → autosubmit 交一版',
          log: `**🛑 停：出错也交一版（autosubmit-on-error）**\n${S.crash}——本该整个 Agent 崩、啥也拿不到。但 **autosubmit-on-error**：不硬崩，**尽力交一版**当前进展（已改好的 config.yaml）当结果。\n（SWE-agent：崩了也 autosubmit 一个 best-effort patch，别让一次跑白费。）` })
        break
      }
    }

    // 正常收尾
    if (!halt && S.answer) {
      halt = 'answer'
      history.push({ kind: 'answer', text: S.answer })
      push({ kind: 'answer', round, phase: 'done', answer: S.answer, focus: '模型不再发工具 → 正常终止',
        log: `**✅ 正常终止：Final Answer**\n${S.answer}\n\n模型这一步**不再发工具调用**——说明它觉得够了 → 循环自然结束。\n**小结**：主循环难在"正确地停"。四条路：正常(无工具调用)、重复(stuck 检测)、超预算(步数/成本上限)、出错(autosubmit 交一版)。step=一次模型请求+工具；turn=零或多个 step；预算按 step/成本算。Codex/DeepSeek 无硬 turn 上限、靠压缩+stuck 兜底；SWE-agent/OpenHands 有 max_iterations 硬上限。` })
    }

    const base0: Frame = base({ kind: 'intro', step: -1 })
    return {
      axis: { kind: 'step', label: '循环步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
