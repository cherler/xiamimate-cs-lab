/** 舞台：RRT 运动规划 —— 世界+障碍，树逐节点长出绕障碍，采样点/迈步/丢弃可见，到终点回溯高亮路径 */
import type { RRTState } from '@engine/kernels/rrt.ts'
import type { StageProps } from '../types.ts'

const SZ = 336, PAD = 22

export function RRTStage({ state }: StageProps<RRTState>) {
  const { phase, op, W, start, goal, goalR, obstacles, nodes, sample, nearest, newNode, goalward, rejected, reason, path, found, focus } = state
  const done = phase === 'done'
  const scale = (SZ - 2 * PAD) / W
  const sx = (x: number) => PAD + x * scale
  const sy = (y: number) => SZ - PAD - y * scale
  const pathSet = new Set<string>()
  if (path) for (let i = 1; i < path.length; i++) pathSet.add(`${path[i - 1]}-${path[i]}`)
  const nn = nearest >= 0 ? nodes[nearest] : null

  return (
    <div className="card">
      <h3>RRT 运动规划 <span className="hint">随机采样→最近点迈一步→撞障碍丢弃→长树到终点</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{nodes.length}</span><span className="scdl">树节点数</span></div>
          <div className="scdk"><span className="scdn sk-neg">{rejected}</span><span className="scdl">丢弃(撞障碍/出界)</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{done && path ? `${path.length - 1} 段路径` : '探索中'}</span><span className="scdl">{done ? '到达终点' : '状态'}</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${SZ} ${SZ}`} width={SZ} height={SZ}>
            {/* 边框 */}
            <rect x={sx(0)} y={sy(W)} width={W * scale} height={W * scale} className="rrt-world" />
            {/* 障碍 */}
            {obstacles.map((o, i) => <rect key={'o' + i} x={sx(o.x0)} y={sy(o.y1)} width={(o.x1 - o.x0) * scale} height={(o.y1 - o.y0) * scale} className="rrt-obs" />)}
            {/* 终点区域 */}
            <circle cx={sx(goal.x)} cy={sy(goal.y)} r={goalR * scale} className="rrt-goalr" />
            {/* 树的边 */}
            {nodes.map((n, idx) => {
              if (n.parent < 0) return null
              const p = nodes[n.parent]!
              const onPath = pathSet.has(`${n.parent}-${idx}`)
              return <line key={'e' + idx} x1={sx(p.x)} y1={sy(p.y)} x2={sx(n.x)} y2={sy(n.y)} className={`rrt-edge ${onPath ? 'path' : ''}`} />
            })}
            {/* 采样与迈步（非 done 时） */}
            {sample && !done && nn && (
              <>
                <line x1={sx(nn.x)} y1={sy(nn.y)} x2={sx(sample.x)} y2={sy(sample.y)} className="rrt-reach" />
                <circle cx={sx(sample.x)} cy={sy(sample.y)} r={4} className={`rrt-sample ${goalward ? 'goalward' : ''}`} />
                {newNode && <circle cx={sx(newNode.x)} cy={sy(newNode.y)} r={5} className="rrt-new" />}
                {op === 'reject' && newNode === null && <circle cx={sx(nn.x + (sample.x - nn.x) / Math.hypot(sample.x - nn.x, sample.y - nn.y) * 1.6)} cy={sy(nn.y + (sample.y - nn.y) / Math.hypot(sample.x - nn.x, sample.y - nn.y) * 1.6)} r={5} className="rrt-rej" />}
              </>
            )}
            {/* 节点 */}
            {nodes.map((n, idx) => <circle key={'n' + idx} cx={sx(n.x)} cy={sy(n.y)} r={idx === 0 ? 0 : 2.6} className="rrt-node" />)}
            {/* 起点、终点 */}
            <rect x={sx(start.x) - 6} y={sy(start.y) - 6} width={12} height={12} className="rrt-start" />
            <circle cx={sx(goal.x)} cy={sy(goal.y)} r={5} className={`rrt-goal ${found ? 'hit' : ''}`} />
          </svg>

          <div className="fk-side">
            <div className="km-legend">
              <span><i className="km-dot" style={{ background: 'var(--hit)' }} />起点</span>
              <span><i className="km-dot" style={{ background: 'var(--now)' }} />终点</span>
              <span><i className="km-dot" style={{ background: 'var(--dim)' }} />障碍</span>
            </div>
            {op !== 'intro' && sample && (
              <div className={`rrt-info ${op === 'reject' ? 'rej' : op === 'summary' ? 'ok' : 'ext'}`}>
                <div className="km-mh">采样 ({sample.x}, {sample.y}){goalward ? ' · 朝终点' : ''}</div>
                <div className="km-ml">最近节点 #{nearest}</div>
                {op === 'reject' ? <div className="km-ml brake">迈一步 {reason} → 丢弃</div>
                  : op === 'summary' ? <div className="km-ml ok">够到终点！回溯 {path ? path.length - 1 : 0} 段</div>
                    : <div className="km-ml ok">迈一步 → 加节点 #{nodes.length - 1}</div>}
              </div>
            )}
            {done && path && <div className="rrt-path">路径：{path.join(' → ')}</div>}
          </div>
        </div>

        {done
          ? <p className="scnote">RRT 用"随机采样 + 最近点迈一步 + 碰撞丢弃"让树像根系朝空白蔓延、自动绕开障碍，回溯出路径。<b>概率完备</b>(采样够多迟早找到)但<b>不最优</b>(路径歪、要平滑或用 RRT*)。旋钮：step、goal bias、碰撞检测。高维(机械臂 6/7 关节)也照用——采样式打败网格法的维度爆炸。配合 IK(路径点→关节角)、PID(跟踪)就能避障抓取。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。{op === 'reject' ? '这一步撞了障碍/出界→丢弃：撞的方向长不出去，树只往空白处蔓延，这就是 RRT 自动避障。' : op === 'extend' ? '朝随机采样点、从最近节点迈一步 step，没撞障碍就加进树、连一条边。' : '树从起点长出，随机采样引导它朝各方向探索、绕过中央障碍去终点。'}</p>}
      </div>
    </div>
  )
}
