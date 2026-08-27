/** 舞台：思维树 ToT —— 推理展开成树，每步生成多个想法、评估前景、剪枝、沿有希望的搜索 */
import type { ToTState } from '@engine/kernels/tot.ts'
import type { StageProps } from '../types.ts'

export function ToTStage({ state }: StageProps<ToTState>) {
  const { target, root, thoughts, stage, chosen, solution, phase } = state
  const done = phase === 'done'
  const showThoughts = thoughts.length > 0
  const showEval = stage === 'evaluate' || stage === 'prune' || stage === 'expand' || done
  const showExpand = stage === 'expand' || done
  const n = thoughts.length || 5
  const W = 340, cx = W / 2
  return (
    <div className="card">
      <h3>思维树 ToT <span className="hint">推理展开成树：生成多个想法、评估、剪枝、搜索</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{root}</span><span className="scdl">起始数字</span></div>
          <div className="scdk"><span className="scdn">{target}</span><span className="scdl">目标</span></div>
          <div className="scdk"><span className="scdn">{showEval ? thoughts.filter(t => t.pruned).length : '—'}</span><span className="scdl">已剪枝</span></div>
        </div>

        <div className="totwrap">
          <svg className="tottree" viewBox={`0 0 ${W} 150`} preserveAspectRatio="xMidYMid meet">
            {/* 根 */}
            <g>
              <rect x={cx - 30} y="4" width="60" height="20" rx="4" fill="color-mix(in srgb,var(--now) 16%,var(--panel))" stroke="var(--now)" strokeWidth="1" />
              <text x={cx} y="18" textAnchor="middle" fontSize="10" fontWeight={700} fill="var(--ink)">{root}</text>
            </g>
            {/* 分支 */}
            {showThoughts && thoughts.map((t, k) => {
              const bx = (W / (n + 1)) * (k + 1)
              const sure = t.sure
              const pruned = t.pruned
              const col = !showEval ? 'var(--line)' : pruned ? 'var(--miss)' : 'var(--hit)'
              const isChosen = showExpand && k === chosen
              return (
                <g key={k} opacity={pruned ? 0.4 : 1}>
                  <line x1={cx} y1="24" x2={bx} y2="64" stroke={isChosen ? 'var(--hit)' : col} strokeWidth={isChosen ? 1.6 : 0.8} strokeDasharray={pruned ? '3 2' : 'none'} />
                  <text x={(cx + bx) / 2} y={(24 + 64) / 2 - 1} textAnchor="middle" fontSize="5.5" fill="var(--faint)">{t.op}</text>
                  <rect x={bx - 20} y="64" width="40" height="20" rx="4"
                    fill={pruned ? 'var(--panel)' : sure && showEval ? 'color-mix(in srgb,var(--hit) 12%,var(--panel))' : 'var(--panel)'}
                    stroke={col} strokeWidth={isChosen ? 1.6 : 0.8} strokeDasharray={pruned ? '3 2' : 'none'} />
                  <text x={bx} y="77" textAnchor="middle" fontSize="8" fontWeight={600} fill="var(--ink)">{t.state}</text>
                  {showEval && (
                    <text x={bx} y="93" textAnchor="middle" fontSize="5.5" fill={pruned ? 'var(--miss)' : 'var(--hit)'}>
                      {pruned ? '✗ 剪掉' : sure ? '✓ 有希望' : ''}
                    </text>
                  )}
                  {/* 解节点 */}
                  {isChosen && (
                    <g>
                      <line x1={bx} y1="84" x2={bx} y2="112" stroke="var(--hit)" strokeWidth="1.6" />
                      <text x={bx} y="102" textAnchor="middle" fontSize="5.5" fill="var(--hit)">12×2=24</text>
                      <rect x={bx - 22} y="112" width="44" height="20" rx="4" fill="color-mix(in srgb,var(--hit) 22%,var(--panel))" stroke="var(--hit)" strokeWidth="1.2" />
                      <text x={bx} y="125" textAnchor="middle" fontSize="9" fontWeight={800} fill="var(--hit)">24 ✓</text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          <div className="orcap">
            {stage === '' || stage === 'root' ? `从 ${root} 凑 ${target}:思维链只走一条线,ToT 展开一棵想法树`
              : stage === 'generate' ? '生成想法(分支):挑两数运算,得到 5 个候选中间状态'
                : stage === 'evaluate' ? '评估每个分支:剩两数能到 24 吗?{12,2}/{8,3}/{6,4} 有希望、{7,2}/{1,2} 死路'
                  : stage === 'prune' ? '剪枝:剪掉 impossible 的两条,不在死路上浪费'
                    : `沿有希望的展开:${solution}——找到解!走不通还能回溯换分支`}
          </div>
        </div>

        {done
          ? <p className="scnote">思维链一条道走到黑、错一步没回头;自洽采多条独立线投票,但每条内部仍是一条线。<b>思维树 ToT</b> 更进一步:把中间状态当<b>树节点</b>,每步<b>生成多个想法分支</b>、用<b>评估器</b>判前景(sure/impossible)、<b>剪掉</b>没希望的、沿有希望的<b>搜索</b>(广度/深度优先,还能<b>回溯</b>换分支)。像下棋在脑中推演多步、剪掉臭棋。擅长需要<b>探索、试错、规划</b>的难题(24点、字谜、走迷宫);代价是分支多、评估多,更贵更慢。</p>
          : <p className="scnote" style={{ opacity: .85 }}>树的根是起始数字,每条边是一步运算、得到一个中间状态(分支)。评估器给每个分支判前景:<b>绿=有希望(sure)、红虚线=死路(剪掉)</b>。只沿有希望的往下展开、搜索到解;走不通可回溯换一个 sure 分支。这就是"生成→评估→剪枝→搜索"。</p>}
      </div>
    </div>
  )
}
