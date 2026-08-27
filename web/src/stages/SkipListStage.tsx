/** 舞台：跳表 —— 多层链表，查找从高层往下逐层逼近 */
import type { SkipListState } from '@engine/kernels/skiplist.ts'
import type { StageProps } from '../types.ts'

export function SkipListStage({ state }: StageProps<SkipListState>) {
  const { levels, target, level, val, act, compares, path, phase } = state
  const done = phase === 'done'
  const onPath = (lv: number, v: number) => path.some(p => p.level === lv && p.val === v)
  return (
    <div className="card">
      <h3>跳表 Skip List <span className="hint">高层"快车道"跳过大段，右不动就下沉</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">找 {target}</span><span className="scdl">目标</span></div>
          <div className="scdk"><span className="scdn">L{levels.length - 1 - level} : {val}</span><span className="scdl">当前位置</span></div>
          <div className="scdk"><span className="scdn">{compares}</span><span className="scdl">比较次数</span></div>
        </div>
        <div className="sl-levels">
          {levels.map((row, lv) => (
            <div key={lv} className="sl-row">
              <span className="sl-lbl">L{levels.length - 1 - lv}</span>
              <div className="sl-nodes">
                {row.map(v => (
                  <span key={v} className={`sl-node ${lv === level && v === val ? 'cur' : ''} ${onPath(lv, v) ? 'path' : ''} ${v === target ? 'target' : ''}`}>{v}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {done
          ? <p className="scnote">找到 {target}，只比较了 <b>{compares}</b> 次（单层链表要一个个走）。跳表用高层快车道跳过大段节点——<b>能右就右、右不动就下沉</b>，平均 O(log n)。Redis 的 zset、LevelDB 的 memtable 都用它，比平衡树好写（插入靠抛硬币定层数，不用旋转）。</p>
          : <p className="scnote" style={{ opacity: .85 }}>从最高层最左出发。本层下一个 ≤ 目标就往右；否则下沉一层。层层逼近直到命中。蓝框=当前、浅色=走过的路。</p>}
      </div>
    </div>
  )
}
