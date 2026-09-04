/** 舞台：思维树 ToT —— 一棵真的两层搜索树:根→生成→评估→剪枝→展开第二层→解路径 */
import type { ToTState } from '@engine/kernels/tot.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

const L1X = [10, 30, 50, 70, 90]   // 五个第一层节点的横向位置(%)
const L2X = [10, 30, 50]           // 三个第二层叶子(在留下的 sure 分支下)

export function ToTStage({ state }: StageProps<ToTState>) {
  const { root, l1, l2, stage, kept, solL1, solution, target } = state
  const showL2 = l2.length > 0
  const rootX = 50, rootY = 9, l1Y = 42, l2Y = 76
  const parentXof = (pi: number) => L1X[pi]!

  return (
    <div className="card">
      <h3>思维树 ToT <span className="hint">生成→评估→剪枝→深入,一棵真的搜索树</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot" style={{ fontSize: '14px' }}>{STAGE_CN[stage]}</span><span className="scdl">当前步 · 目标 {target}</span></div>
          <div className="scdk"><span className="scdn">{stage === 'root' || stage === 'generate' ? '—' : kept}</span><span className="scdl">剪枝后留下的分支</span></div>
          <div className="scdk"><span className="scdn good" style={{ fontSize: '13px' }}>{solL1 >= 0 ? solution : '搜索中'}</span><span className="scdl">解路径</span></div>
        </div>

        <div className="tottree2">
          <svg className="tottree2-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {/* 根 → 第一层 */}
            {l1.map((n, k) => (
              <line key={k} x1={rootX} y1={rootY + 6} x2={L1X[k]} y2={l1Y - 5}
                className={`tote ${n.pruned ? 'pruned' : ''} ${n.onPath ? 'path' : ''}`} vectorEffect="non-scaling-stroke" />
            ))}
            {/* 第一层 → 第二层(只有展开后、且父节点留下的) */}
            {showL2 && l2.map((lf, k) => (
              <line key={k} x1={parentXof(lf.parent)} y1={l1Y + 6} x2={L2X[k]} y2={l2Y - 5}
                className={`tote ${lf.onPath ? 'path' : ''}`} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>

          {/* 根节点 */}
          <div className="totn root" style={{ left: `${rootX}%`, top: `${rootY}%` }}>{root}</div>

          {/* 第一层 */}
          {l1.map((n, k) => (
            <div key={k} className={`totn ${nodeCls(n)}`} style={{ left: `${L1X[k]}%`, top: `${l1Y}%` }}>
              <span className="totn-op">{n.op}</span>
              <span className="totn-st">{n.state}{n.evaluated && (n.sure ? ' ✓sure' : ' ✗impossible')}</span>
            </div>
          ))}

          {/* 第二层叶子 */}
          {showL2 && l2.map((lf, k) => (
            <div key={k} className={`totn leaf ${lf.solves ? 'solve' : ''} ${lf.onPath ? 'onpath' : ''}`} style={{ left: `${L2X[k]}%`, top: `${l2Y}%` }}>
              <span className="totn-op">{lf.op}</span>
              <span className="totn-st">{lf.solves ? `= ${target} ✓` : ''}</span>
            </div>
          ))}
        </div>

        <div className="orcap">{rich(state.log)}</div>

        <p className="scnote">
          <b>思维树 ToT = 把推理组织成一棵搜索树</b>:每步<b>生成多个想法(分支)</b>、<b>评估</b>每个分支能不能通向解(sure/impossible)、
          <b>剪掉</b>没希望的、沿有希望的<b>再往深处展开一层</b>,走不通还能<b>回溯</b>换分支。比思维链(一条道走到黑、错了没回头)、
          自洽(多条独立线投票、每条内部还是直线)更进一步——显式地做<b>广度生成 + 评估剪枝 + 深度搜索</b>。
          擅长要探索/试错/规划的难题(24点、字谜、走迷宫);代价:分支多、评估多,更贵更慢。
        </p>
      </div>
    </div>
  )
}

const STAGE_CN: Record<ToTState['stage'], string> = {
  root: '根', generate: '生成分支', evaluate: '评估前景', prune: '剪枝', expand: '展开第二层', done: '找到解',
}
function nodeCls(n: ToTState['l1'][number]): string {
  if (n.onPath) return 'onpath'
  if (n.pruned) return 'pruned'
  if (n.evaluated) return n.sure ? 'sure' : 'impossible'
  return 'gen'
}
