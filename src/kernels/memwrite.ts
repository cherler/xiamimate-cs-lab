/**
 * 内核：记忆写入 · 冲突消解 Memory Write —— 新信息进来，往长期记忆里怎么写（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 每条新事实：抽取 → 检索相似的旧记忆 → LLM 决定 ADD / UPDATE / DELETE / NOOP。
 *
 * 检索(第1课)是"读"，反思(第3课)是"消化"，这一课是"写"——**新信息来了，记忆库怎么更新、又不自相矛盾**。mem0 的两阶段设计：
 *   · **抽取(extract)**：从新对话里抽出若干**候选事实**。
 *   · **更新(update)**：每条候选事实**检索最相似的已有记忆**，让 LLM 挑一个操作：
 *       **ADD**(没有相似的→新建) · **UPDATE**(补充/修正已有) · **DELETE**(与已有矛盾→删掉旧的) · **NOOP**(已知道了→不动)。
 * 关键：不是无脑追加——**要和已有记忆比对、消解冲突**，否则"用户住北京"和"用户搬上海了"会并存、记忆自相矛盾、越用越脏。
 * ⚠️ mem0 论文是这套四操作;但**现在 OSS 默认改成"单遍 ADD-only"**(只加不改、简单但会积矛盾)。切「模式」对比两者。冲突判定由引擎按相似度现算。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Mode = '四步' | '单遍'
type Op = 'ADD' | 'UPDATE' | 'DELETE' | 'NOOP'
export type Mem = { id: string; text: string; stale?: boolean; justOp?: Op }
export type MemWState = {
  i: number
  step: number
  stage: 'intro' | 'process' | 'done'
  mode: Mode
  store: Mem[]              // 当前记忆库
  cur: number              // 当前处理第几条新事实（-1=开始）
  fact: string             // 当前新事实
  similar: string          // 检索到的最相似旧记忆（id，空=没有相似）
  op: Op | ''              // 本步决定的操作
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<MemWState, 'i'>

//  已有的长期记忆（固定输入）
const INIT: Mem[] = [
  { id: 'M1', text: '用户喜欢喝美式咖啡' },
  { id: 'M2', text: '用户住在北京' },
  { id: 'M3', text: '用户在用 Python 3.10' },
]
//  新进来的候选事实：四步模式各触发一种操作；相似=检索到的最相似旧记忆。
const NEW: { fact: string; op: Op; similar: string; result: string }[] = [
  { fact: '用户养了只叫咪咪的猫', op: 'ADD', similar: '', result: '用户养了只叫咪咪的猫' },
  { fact: '用户升级到 Python 3.12 了', op: 'UPDATE', similar: 'M3', result: '用户在用 Python 3.12' },
  { fact: '用户戒咖啡了、再也不喝', op: 'DELETE', similar: 'M1', result: '' },
  { fact: '用户住在北京（又提了一次）', op: 'NOOP', similar: 'M2', result: '' },
]
const OP_CN: Record<Op, string> = { ADD: '新建', UPDATE: '修正', DELETE: '删除', NOOP: '不动' }

export const memwriteKernel: Kernel<MemWState> = {
  kind: 'memwrite',
  compile(doc: SimDocument): CompiledModel<MemWState> {
    const mode = (String(doc.params?.mode ?? '四步') === '单遍' ? '单遍' : '四步') as Mode
    const frames: Frame[] = []
    let store: Mem[] = INIT.map(m => ({ ...m }))
    const b0 = { mode, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; store: Mem[]; cur: number; fact: string; similar: string; op: Op | ''; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)

    push({ stage: 'intro', store: store.map(m => ({ ...m })), cur: -1, fact: '', similar: '', op: '',
      focus: `已有 ${store.length} 条记忆，${NEW.length} 条新事实要写进去（模式：${mode}）`,
      log: `**记忆写入 · 冲突消解：新信息来了怎么写?**\n检索是"读"、反思是"消化"，这一课是"**写**"——记忆库怎么更新、又不自相矛盾。mem0 的做法：抽取候选事实 → 每条**检索最相似的旧记忆** → LLM 决定 **ADD(新建)/UPDATE(修正)/DELETE(删旧)/NOOP(不动)**。\n已有 ${store.length} 条：${store.map(m => m.text).join('；')}。\n模式 **${mode}**：${mode === '四步' ? '四操作、会比对消解冲突' : '单遍 ADD-only——只加不改(现 OSS 默认)，看它怎么积累矛盾'}。` })

    for (let k = 0; k < NEW.length; k++) {
      const n = NEW[k]!
      const effOp: Op = mode === '单遍' ? 'ADD' : n.op   // 单遍模式一律 ADD
      const clean = store.map(m => ({ ...m, justOp: undefined as Op | undefined, stale: m.stale }))
      let after: Mem[]
      let note: string
      if (effOp === 'ADD') {
        const nid = `M${INIT.length + k + 1}`
        after = [...clean, { id: nid, text: n.fact, justOp: 'ADD' }]
        //  单遍模式下若与旧记忆矛盾/重复，把旧的标记为 stale（积累矛盾）
        if (mode === '单遍' && n.similar) after = after.map(m => m.id === n.similar ? { ...m, stale: true } : m)
        note = mode === '单遍'
          ? (n.similar ? `单遍只会 ADD：直接新增、和旧记忆 ${n.similar} 并存——本该 ${n.op} 的没做，${n.similar} 变陈旧、矛盾没消解` : '无相似 → 新增一条')
          : '检索无相似记忆 → **ADD 新建**一条'
      } else if (effOp === 'UPDATE') {
        after = clean.map(m => m.id === n.similar ? { ...m, text: n.result, justOp: 'UPDATE', stale: false } : m)
        note = `检索到相似的 ${n.similar}「${INIT.find(m => m.id === n.similar)?.text ?? clean.find(m => m.id === n.similar)?.text}」→ 新信息是修正 → **UPDATE** 成「${n.result}」`
      } else if (effOp === 'DELETE') {
        after = clean.filter(m => m.id !== n.similar)
        note = `检索到 ${n.similar}「${clean.find(m => m.id === n.similar)?.text}」→ 新信息与它**矛盾** → **DELETE** 删掉旧的`
      } else { // NOOP
        after = clean.map(m => m.id === n.similar ? { ...m, justOp: 'NOOP' } : m)
        note = `检索到 ${n.similar}，内容**已知道了** → **NOOP** 不动`
      }
      store = after
      const last = k === NEW.length - 1
      push({
        stage: last ? 'done' : 'process', store: store.map(m => ({ ...m })), cur: k, fact: n.fact, similar: n.similar, op: effOp,
        focus: `新事实「${n.fact}」→ ${effOp}(${OP_CN[effOp]})`,
        log: `**新事实 ${k + 1}/${NEW.length}：「${n.fact}」**\n① 检索最相似旧记忆：${n.similar ? `命中 **${n.similar}**` : '无相似'}。\n② 决定操作：${note}。\n${last ? `\n\n**小结**：写记忆不是无脑追加，要**检索相似 + 消解冲突**：\n· **四步**(mem0 论文)：ADD 新建 / UPDATE 修正 / DELETE 删矛盾 / NOOP 去重——记忆库始终自洽。\n· **单遍 ADD-only**(现 OSS 默认)：只加不改，简单快，但**矛盾/陈旧会越积越多**(切模式看：美式咖啡 vs 戒咖啡、3.10 vs 3.12 会并存)。\n面试延伸：靠向量相似度找"该改哪条"、冲突消解(矛盾→删/改)、Zep/Graphiti 用双时间知识图给旧事实打"失效时间"而不真删。` : ''}`,
      })
    }

    const base0: Frame = { ...b0, stage: 'intro', step: -1, store: INIT.map(m => ({ ...m })), cur: -1, fact: '', similar: '', op: '', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '写入步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
