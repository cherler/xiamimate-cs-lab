/** 舞台：规划 —— 计划模式门(只读/解锁) + Todo 状态机(恰一个进行中) + 复述(注意力操控) */
import type { PlanState, Todo } from '@engine/kernels/planning.ts'
import type { StageProps } from '../types.ts'

const ST_ICON: Record<string, string> = { pending: '○', active: '◐', done: '✓' }
const ST_CN: Record<string, string> = { pending: '待办', active: '进行中', done: '完成' }

export function PlanningStage({ state }: StageProps<PlanState>) {
  const { stage, mode, planMode, todos, writeBlocked, recited, op } = state
  const active = todos.filter(t => t.status === 'active').length
  const done = todos.filter(t => t.status === 'done').length

  return (
    <div className="card">
      <h3>规划 · 计划模式 + Todo <span className="hint">先想后做：只读门 → 批准 → 状态机推进 → 复述防漂移</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{mode}</span><span className="scdl">模式</span></div>
          <div className="scdk"><span className={`scdn ${planMode ? 'hot' : ''}`}>{planMode ? '计划中·只读' : '执行·已解锁'}</span><span className="scdl">状态</span></div>
          <div className="scdk"><span className="scdn">{done}/{todos.length}</span><span className="scdl">完成</span></div>
        </div>

        {/* 计划模式门 */}
        <div className={`pl-gate ${planMode ? (writeBlocked ? 'locked' : 'soft') : 'open'}`}>
          {planMode
            ? (writeBlocked
              ? '🔒 计划模式（硬门禁）：批准前只能读——想写文件被权限层挡下'
              : '📝 计划模式（软建议）：工具照样能调，只是劝你先规划')
            : '🔓 计划已批准 → 退出计划模式，写操作解锁'}
        </div>

        {/* Todo 状态机 */}
        <div className="pl-todos">
          <div className="pl-h">Todo（恰好一个进行中）{active > 1 && <em className="pl-warn"> ⚠ 违反"恰一个"不变量</em>}</div>
          {todos.length === 0
            ? <div className="pl-empty">计划模式里还在探查，未拟出</div>
            : todos.map((t: Todo) => (
              <div key={t.id} className={`pl-t ${t.status} ${t.added ? 'added' : ''}`}>
                <span className="pl-tic">{ST_ICON[t.status]}</span>
                <span className="pl-tt">{t.text}</span>
                <span className="pl-ts">{ST_CN[t.status]}{t.added ? ' · 新插入' : ''}</span>
              </div>
            ))}
        </div>

        {recited && <div className="pl-recite">🔁 复述：整张 todo 重新贴到上下文<b>近端</b> —— 把全局计划推回模型的近端注意力，对抗长任务里的 <b>lost-in-the-middle</b> 漂移（不是记账，是把模型摁在当前步）</div>}

        {stage === 'done'
          ? <p className="scnote"><b>规划远不止"一张清单"</b>：<b>计划模式=硬门禁</b>(权限层强制"批准前只读"，和沙箱/权限模式一脉) vs 软建议(DeepSeek)；<b>Todo 状态机</b>(恰一个进行中、整表替换或增量 TaskCreate/TaskUpdate)；<b>复述=注意力操控</b>(每轮把计划贴回近端、对抗 lost-in-the-middle——最不显眼也最深)；<b>重规划</b>(计划是随现实滚动的活文档)。面试延伸：plan mode 为何只读优先、todo 为何"恰一个进行中"、architect/editor 双模型、ReAct vs Plan-and-Solve vs ToT。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。{op && `（${op}）`}</p>}
      </div>
    </div>
  )
}
