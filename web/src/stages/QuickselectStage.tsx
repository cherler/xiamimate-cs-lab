/** 舞台：快速选择 —— 仪表级动效柱状图。partition 定 pivot 落位，只递归目标所在的一侧。
 *  柱子按值 key(值互异)、translateX 定槽位——每轮 partition 后柱子滑到新位置。
 *  琥珀=pivot 落位、灰=已丢弃的一半、band=当前窗口、◎=目标第 K 位(固定槽位)。 */
import type { QSelState } from '@engine/kernels/quickselect.ts'
import type { StageProps } from '../types.ts'

const SLOT = 66, BARW = 54, AREA = 208, BARMAX = 142, BARMIN = 30

export function QuickselectStage({ state }: StageProps<QSelState>) {
  const { op, round, arr, lo, hi, pivot, pivotIdx, target, decision, answer, phase, focus } = state
  const done = phase === 'done'
  const n = arr.length
  const maxV = Math.max(...arr, 1)
  const nextLo = decision === 'right' ? pivotIdx + 1 : lo
  const nextHi = decision === 'left' ? pivotIdx - 1 : hi
  return (
    <div className="card">
      <h3>快速选择 Quickselect <span className="hint">找第 K 大不用全排序，平均 O(n)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'intro' ? '就绪' : `第 ${round} 轮`}</span><span className="scdl">partition</span></div>
          <div className="scdk"><span className="scdn">{pivotIdx >= 0 ? `pivot ${pivot}→idx${pivotIdx}` : `目标 idx${target}`}</span><span className="scdl">{pivotIdx >= 0 ? 'pivot 落位' : '目标下标'}</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'good' : ''}`}>{done ? `第 K 大=${answer}` : decision === 'left' ? '递归左半' : decision === 'right' ? '递归右半' : '—'}</span><span className="scdl">决策</span></div>
        </div>

        <div className="bc-wrap">
          <div className="bc-chart" style={{ width: n * SLOT, height: AREA }}>
            {op !== 'intro' && !done && <div className="bc-band" style={{ transform: `translateX(${lo * SLOT}px)`, width: (hi - lo + 1) * SLOT - (SLOT - BARW) }} />}
            {arr.map((v, k) => {
              const inWin = k >= lo && k <= hi
              const discarded = op !== 'intro' && !done && !(k >= nextLo && k <= nextHi)
              const isPivot = k === pivotIdx && pivotIdx >= 0 && !done
              const isAns = done && k === target
              const role = isAns ? 'done' : isPivot ? 'focus' : discarded ? 'dim' : (inWin || op === 'intro') ? '' : 'dim'
              const h = Math.round((v / maxV) * BARMAX + BARMIN)
              return (
                <div key={v} className={`bc-bar ${role}`} style={{ transform: `translateX(${k * SLOT}px)`, width: BARW, height: h }}>
                  {isPivot && <span className="bc-flag focus">pivot</span>}
                  {isAns && <span className="bc-tick">✓</span>}
                  <span className="bc-v">{v}</span>
                </div>
              )
            })}
            {/* 目标第 K 位：排序后的固定下标，标记钉在这个槽位不随柱子动 */}
            <div className="bc-mark" style={{ transform: `translateX(${target * SLOT}px)`, width: BARW }}>◎第K</div>
          </div>
        </div>

        <div className="orcap">
          {op === 'intro' ? '按「下一步」开始:挑 pivot 做 partition,让它落到排序后的最终位置'
            : done ? `pivot 落在下标 ${pivotIdx} = 目标 ${target} → 第 K 大 = ${answer}`
              : pivotIdx > target ? `pivot ${pivot} 落在下标 ${pivotIdx} > 目标 ${target} → 目标在左，只递归 [${lo},${pivotIdx - 1}]，右半整个丢 ✂`
                : pivotIdx < target ? `pivot ${pivot} 落在下标 ${pivotIdx} < 目标 ${target} → 目标在右，只递归 [${pivotIdx + 1},${hi}]，左半整个丢 ✂`
                  : `pivot 正好落在目标下标 ${target} → 命中`}
        </div>

        {done
          ? <p className="scnote"><b>Quickselect = partition 定 pivot 位置 + 只递归目标所在的一侧</b>。每轮丢掉一半 → 平均 T(n)=T(n/2)+O(n)=<b>O(n)</b>（快排两侧都递归=O(n㏒n)）。最坏 O(n²)（pivot 每次极端），随机选 pivot 可避免。求第 K 大/Top-K、找中位数都用它——比"全排序再取第 K 个"快一个量级。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{focus}。琥珀=pivot 落位、绿◎=目标第 K 位、灰=已丢弃的一半、band=当前还在找的窗口。看一眼 pivot 落点和目标下标,就知道答案在**哪一半**——然后<b>只递归那一半</b>,柱子会滑到新布局。</p>}
      </div>
    </div>
  )
}
