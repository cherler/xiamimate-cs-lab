/**
 * 内核：沙箱 / 权限 Sandbox & Permission —— 模型想跑的命令，放不放行？（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 一批操作逐个过权限决议：定性 → 规则(deny→ask→allow) → 沙箱(fail-closed) → 结局。
 *
 * Agent 会跑模型生成的命令/写文件——**怎么既让它干活、又不让它删库/联网偷数据**？这是安全面试大点。
 * 两道**相互独立**的墙（Codex 的两个正交轴）：
 *   ① 规则/审批：deny → ask → allow，**首次匹配即生效**（危险的先拦下）。模式(mode)决定"写"要不要问。
 *   ② 沙箱：物理隔离，**fail-closed**（宁可拦错不放过）——网络默认关、写只能在工作区内；两墙都过了才真跑。
 * 越权时**升级**：模型带理由申请更宽范围 → **一次**人工批准 → 只这一次（不是 allow-always，防权限蔓延）。
 * 这套是**确定性决议**（不是模型说了算）——正是工程会写错、面试爱问的地方。本实验真跑一遍。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Mode = '默认' | '接受编辑' | '计划' | '放行'   // default / acceptEdits / plan / bypass
type Effect = 'read' | 'write' | 'write-out' | 'net' | 'destroy'
type Rule = 'allow' | 'ask' | 'deny'
type Sand = 'ok' | 'block' | 'escalate' | 'skip'
type Final = 'run' | 'ask-run' | 'escalate-run' | 'blocked'
type Op = { id: number; cmd: string; effect: Effect; eLabel: string }
export type Resolved = { rule: Rule; ruleWhy: string; sandbox: Sand; sandboxWhy: string; final: Final; fLabel: string }
export type Deci = { cmd: string; final: Final; label: string }

export type PermState = {
  i: number
  step: number
  stage: 'intro' | 'op' | 'done'
  mode: Mode
  cur: number
  op?: Op
  res?: Resolved
  history: Deci[]
  total: number
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PermState, 'i'>

const E_LABEL: Record<Effect, string> = { read: '只读', write: '写(工作区内)', 'write-out': '写(工作区外)', net: '联网', destroy: '破坏性(rm -rf)' }
const F_LABEL: Record<Final, string> = { run: '✅ 放行运行', 'ask-run': '✅ 问过→批准→运行', 'escalate-run': '✅ 升级→一次性批准→运行', blocked: '⛔ 拒绝，不执行' }

//  模型这一轮想跑的一批操作（固定输入）。覆盖 放行 / 问一下 / deny规则拦 / 沙箱fail-closed / 越权升级 五条路。
const OPS: Op[] = [
  { id: 1, cmd: 'read auth.py', effect: 'read', eLabel: E_LABEL.read },
  { id: 2, cmd: 'edit auth.py（改第 42 行）', effect: 'write', eLabel: E_LABEL.write },
  { id: 3, cmd: 'rm -rf /tmp/*', effect: 'destroy', eLabel: E_LABEL.destroy },
  { id: 4, cmd: 'curl https://api.example.com', effect: 'net', eLabel: E_LABEL.net },
  { id: 5, cmd: 'write /etc/hosts', effect: 'write-out', eLabel: E_LABEL['write-out'] },
]

//  确定性决议：给定操作 + 模式，算出 规则→沙箱→结局。两轴独立、fail-closed、越权可一次性升级。
function resolve(op: Op, mode: Mode): Resolved {
  const e = op.effect
  // ── 轴①：规则/审批（deny → ask → allow，首次匹配）──
  let rule: Rule, ruleWhy: string
  if (e === 'destroy') {
    if (mode === '放行') { rule = 'allow'; ruleWhy = '放行模式跳过审批——连破坏性命令也放行（危险！）' }
    else { rule = 'deny'; ruleWhy = 'destructive 命中 deny 规则——deny 优先、首次匹配即拒，后面不看了' }
  } else if (e === 'read') {
    rule = 'allow'; ruleWhy = '只读，直接放行'
  } else if (e === 'net') {
    rule = 'allow'; ruleWhy = '规则层不拦网络，交给沙箱那道墙'
  } else { // write / write-out
    if (mode === '计划') { rule = 'deny'; ruleWhy = '计划模式=只读探查，任何写都拒' }
    else if (mode === '默认') { rule = 'ask'; ruleWhy = '默认模式：写操作要问一下人' }
    else { rule = 'allow'; ruleWhy = mode === '接受编辑' ? '接受编辑模式：工作区内的写直接放行' : '放行模式：跳过审批' }
  }
  if (rule === 'deny') return { rule, ruleWhy, sandbox: 'skip', sandboxWhy: 'deny 已拦下，不必再进沙箱', final: 'blocked', fLabel: F_LABEL.blocked }

  // ── 轴②：沙箱（物理隔离，fail-closed；和上面那道墙相互独立）──
  let sandbox: Sand, sandboxWhy: string, final: Final
  if (e === 'net') {
    sandbox = 'block'; sandboxWhy = '网络默认关闭、fail-closed——即便放行模式也拦（沙箱是独立的第二道墙）'; final = 'blocked'
  } else if (e === 'write-out') {
    sandbox = 'escalate'; sandboxWhy = 'workspace-write 只准动工作区内；越界 → 模型带理由申请更宽 + 一次人工批准（仅此一次，不是 allow-always）'; final = 'escalate-run'
  } else { // read / write(cwd) / destroy(仅放行模式走到这)
    sandbox = 'ok'; sandboxWhy = '沙箱允许：只读 / 工作区内的写'; final = rule === 'ask' ? 'ask-run' : 'run'
  }
  return { rule, ruleWhy, sandbox, sandboxWhy, final, fLabel: F_LABEL[final] }
}

export const permguardKernel: Kernel<PermState> = {
  kind: 'permguard',
  compile(doc: SimDocument): CompiledModel<PermState> {
    const mode = (['默认', '接受编辑', '计划', '放行'] as Mode[]).includes(doc.params?.mode as Mode) ? doc.params!.mode as Mode : '默认'
    const total = OPS.length
    const frames: Frame[] = []
    const history: Deci[] = []
    const push = (f: Omit<Frame, 'step' | 'total' | 'history' | 'mode'> & Partial<Frame>) =>
      frames.push({ mode, total, history: history.map(h => ({ ...h })), step: frames.length, ...f } as Frame)

    push({
      stage: 'intro', cur: -1, phase: 'run',
      focus: `模型想跑 ${total} 个操作，权限决议逐个判（当前模式：${mode}）`,
      log: `**沙箱 / 权限：模型想跑命令，放不放行？**\nAgent 要跑模型生成的命令/写文件——怎么既让它干活、又不让它删库/联网偷数据？靠**两道相互独立的墙**：\n**① 规则/审批**：deny → ask → allow，**首次匹配即生效**（危险的先拦）。模式（${mode}）决定"写"要不要问。\n**② 沙箱**：物理隔离、**fail-closed**（宁可拦错）——网络默认关、写只能在工作区内。**两墙都过才真跑。**\n本轮 ${total} 个操作，故意 cover 放行 / 问一下 / deny 拦 / 沙箱拦 / 越权升级 五条路。切换上面的「模式」看结局怎么变。`,
    })

    for (let k = 0; k < total; k++) {
      const op = OPS[k]!
      const res = resolve(op, mode)
      history.push({ cmd: op.cmd, final: res.final, label: res.fLabel })
      const last = k === total - 1
      push({
        stage: last ? 'done' : 'op', cur: k, op, res, phase: last ? 'done' : 'run',
        focus: `操作 ${k + 1}/${total}：${op.cmd}（${op.eLabel}）→ ${res.fLabel}`,
        log: `**操作 ${k + 1}：\`${op.cmd}\`**（定性：${op.eLabel}）\n**规则**：${res.ruleWhy} → **${res.rule === 'deny' ? '拒' : res.rule === 'ask' ? '问' : '放行'}**。\n${res.sandbox === 'skip' ? '（deny 已拦，不进沙箱。）' : `**沙箱**：${res.sandboxWhy}。`}\n→ **${res.fLabel}**。${last
          ? `\n\n**小结**：${history.filter(h => h.final !== 'blocked').length} 跑 / ${history.filter(h => h.final === 'blocked').length} 拦。要点：**两道墙相互独立**（规则放行 ≠ 沙箱放行，网络那条连放行模式都被沙箱拦）；**deny 优先、首次匹配**；**fail-closed**（宁可拦错不放过）；越权是**一次性升级**（带理由 + 一次人工批准，不给 allow-always，防权限蔓延）；模式是**安全 vs 顺手**的滑杆（默认问、接受编辑不问、计划只读、放行全跳过=危险）。对比 Aider 干脆不做沙箱，靠 git 自动提交 +/undo 兜底（可回滚≠隔离）。`
          : ''}`,
      })
    }

    const base0: Frame = { stage: 'intro', step: -1, mode, cur: -1, history: [], total, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '决议步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
