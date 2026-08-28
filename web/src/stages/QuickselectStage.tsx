/** 舞台：快速选择 —— 数组 partition，pivot 落位后只递归目标所在的一侧 */
import type { QSelState } from '@engine/kernels/quickselect.ts'
import type { StageProps } from '../types.ts'

export function QuickselectStage({ state }: StageProps<QSelState>) {
  const { op, round, arr, lo, hi, pivot, pivotIdx, target, decision, answer, phase } = state
  const done = phase === 'done'
  const inWin = (idx: number) => idx >= lo && idx <= hi
  // 下一轮保留的窗口（用于把"丢掉的一半"变灰）
  const nextLo = decision === 'right' ? pivotIdx + 1 : lo
  const nextHi = decision === 'left' ? pivotIdx - 1 : hi

  return (
    <div className="card">
      <h3>快速选择 Quickselect <span className="hint">找第 K 大不用全排序，平均 O(n)</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'intro' ? '就绪' : `第 ${round} 轮`}</span><span className="scdl">partition</span></div>
          <div className="scdk"><span className="scdn">{pivotIdx >= 0 ? `pivot ${pivot}→idx${pivotIdx}` : `目标 idx${target}`}</span><span className="scdl">{pivotIdx >= 0 ? 'pivot 落位' : '目标下标'}</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'ok' : ''}`}>{done ? `第${3}大=${answer}` : decision === 'left' ? '递归左半' : decision === 'right' ? '递归右半' : '—'}</span><span className="scdl">决策</span></div>
        </div>

        {/* 数组 */}
        <div className="qs-arr">
          {arr.map((v, idx) => {
            const discarded = op !== 'intro' && !done && !(idx >= nextLo && idx <= nextHi)
            const isPivot = idx === pivotIdx && pivotIdx >= 0
            const isTarget = idx === target
            return (
              <div key={idx} className={`qs-cell ${inWin(idx) ? 'win' : ''} ${discarded ? 'drop' : ''} ${isPivot ? 'pivot' : ''} ${done && idx === target ? 'ans' : ''}`}>
                <span className="qs-v">{v}</span>
                <span className="qs-idx">{idx}{isTarget && <i>◎目标</i>}</span>
              </div>
            )
          })}
        </div>

        {op !== 'intro' && !done && (
          <div className={`qs-note ${decision === 'left' ? 'l' : 'r'}`}>
            pivot <b>{pivot}</b> 落在下标 <b>{pivotIdx}</b>，{pivotIdx > target ? `> 目标 ${target} → 目标在左，只递归 [${lo},${pivotIdx - 1}]` : `< 目标 ${target} → 目标在右，只递归 [${pivotIdx + 1},${hi}]`}（另一半整个丢掉 ✂）
          </div>
        )}
        {done && <div className="qs-note found">✅ pivot 落在下标 {pivotIdx} = 目标 {target} → 第 3 大 = <b>{answer}</b></div>}

        {done
          ? <p className="scnote"><b>Quickselect = partition 定 pivot 位置 + 只递归目标所在的一侧</b>。每轮丢掉一半 → 平均 T(n)=T(n/2)+O(n)=<b>O(n)</b>（快排两侧都递归=O(n㏒n)）。最坏 O(n²)（pivot 每次极端），随机选 pivot 可避免。求第 K 大/Top-K、找中位数都用它——比"全排序再取第 K 个"快一个量级。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。partition 把 pivot 放到它排序后的最终位置。关键：拿这个位置和目标下标比一下，就知道答案在**哪一半**——然后<b>只递归那一半</b>、另一半直接丢。这就是它比全排序快的原因。</p>}
      </div>
    </div>
  )
}
