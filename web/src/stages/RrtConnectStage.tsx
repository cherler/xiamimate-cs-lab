/** 舞台：RRT-Connect —— 世界+障碍，起点树/终点树两色长出，EXTEND 迈步 + CONNECT 贪心连接，相遇后高亮完整路径 */
import type { RRTCState } from '@engine/kernels/rrtconnect.ts'
import type { StageProps } from '../types.ts'

const SZ = 336, PAD = 22

export function RrtConnectStage({ state }: StageProps<RRTCState>) {
  const { phase, op, W, start, goal, obstacles, treeS, treeG, extendS, sample, qnew, connectPath, rejected, path, found, focus } = state
  const done = phase === 'done'
  const scale = (SZ - 2 * PAD) / W
  const sx = (x: number) => PAD + x * scale
  const sy = (y: number) => SZ - PAD - y * scale
  const tree = (nodes: typeof treeS, cls: string) => nodes.map((n, idx) => {
    if (n.parent < 0) return null
    const p = nodes[n.parent]!
    return <line key={cls + idx} x1={sx(p.x)} y1={sy(p.y)} x2={sx(n.x)} y2={sy(n.y)} className={cls} />
  })

  return (
    <div className="card">
      <h3>RRT-Connect 双向规划 <span className="hint">起点树+终点树同时长，EXTEND 迈一步 + CONNECT 贪心互相靠拢</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn rc-sc">{treeS.length}</span><span className="scdl">起点树节点</span></div>
          <div className="scdk"><span className="scdn rc-gc">{treeG.length}</span><span className="scdl">终点树节点</span></div>
          <div className="scdk"><span className="scdn sk-neg">{rejected}</span><span className="scdl">丢弃</span></div>
          <div className="scdk"><span className="scdn" style={{ fontSize: '13px' }}>{done && path ? `${path.length - 1} 段` : (op === 'extend' ? `EXTEND ${extendS ? '起点' : '终点'}树` : op === 'connect' ? `CONNECT ${extendS ? '终点' : '起点'}树` : '双向搜索')}</span><span className="scdl">{done ? '两树相遇' : '状态'}</span></div>
        </div>

        <div className="fk-wrap">
          <svg className="fk-svg" viewBox={`0 0 ${SZ} ${SZ}`} width={SZ} height={SZ}>
            <rect x={sx(0)} y={sy(W)} width={W * scale} height={W * scale} className="rrt-world" />
            {obstacles.map((o, i) => <rect key={'o' + i} x={sx(o.x0)} y={sy(o.y1)} width={(o.x1 - o.x0) * scale} height={(o.y1 - o.y0) * scale} className="rrt-obs" />)}
            {/* 两棵树的边 */}
            {tree(treeS, 'rc-edgeS')}
            {tree(treeG, 'rc-edgeG')}
            {/* 最终路径 */}
            {path && <polyline points={path.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')} className="rc-path" fill="none" />}
            {/* CONNECT 贪心链 */}
            {connectPath && !done && <polyline points={connectPath.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')} className="rc-connect" fill="none" />}
            {/* 采样 + q_new */}
            {sample && !done && <circle cx={sx(sample.x)} cy={sy(sample.y)} r={3.5} className="rc-sample" />}
            {qnew && !done && <circle cx={sx(qnew.x)} cy={sy(qnew.y)} r={5} className="rc-qnew" />}
            {/* 节点 */}
            {treeS.map((n, idx) => <circle key={'ns' + idx} cx={sx(n.x)} cy={sy(n.y)} r={idx === 0 ? 0 : 2.4} className="rc-nodeS" />)}
            {treeG.map((n, idx) => <circle key={'ng' + idx} cx={sx(n.x)} cy={sy(n.y)} r={idx === 0 ? 0 : 2.4} className="rc-nodeG" />)}
            {/* 起点、终点 */}
            <rect x={sx(start.x) - 6} y={sy(start.y) - 6} width={12} height={12} className="rc-start" />
            <circle cx={sx(goal.x)} cy={sy(goal.y)} r={6} className={`rc-goal ${found ? 'hit' : ''}`} />
          </svg>

          <div className="fk-side">
            <div className="km-legend">
              <span><i className="km-dot" style={{ background: 'var(--hit)' }} />起点树</span>
              <span><i className="km-dot" style={{ background: 'var(--miss)' }} />终点树</span>
              <span><i className="km-dot" style={{ background: 'var(--now)' }} />q_new / CONNECT</span>
            </div>
            <p className="fk-explain">{focus}。</p>
            {done && <p className="fk-explain" style={{ color: 'var(--hit)' }}>两棵树相遇、拼出完整路径 ✓</p>}
          </div>
        </div>

        <p className="scnote">{done
          ? <><b>RRT-Connect = 双向两棵树 + 贪心 CONNECT</b>：一棵从起点、一棵从终点长；EXTEND 让当前树迈一步得 q_new，CONNECT 让另一棵树<b>连续迈步（一次走一串）</b>去够 q_new；相遇即拼出路径、否则交换两树。两头对着挖、比单树 RRT 快很多，是 <b>MoveIt/OMPL 机械臂规划的默认</b>。同样概率完备、不最优。<b>连</b>：「RRT」(单树)、「RRT*」(最优)、「PRM」(多查询)、「Dubins」(车上两点转移换成曲线)。</>
          : <>EXTEND 一棵树迈一步、CONNECT 另一棵树贪心去够它——两头对着挖、接上就成路。绿=起点树、红=终点树。</>}</p>
      </div>
    </div>
  )
}
