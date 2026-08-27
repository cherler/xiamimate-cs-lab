/** 舞台：快速排序 —— 选基准 pivot，一趟扫描把小的甩左、大的留右，pivot 归位后分左右两段递归 */
import type { QuickSortState } from '@engine/kernels/quicksort.ts'
import type { StageProps } from '../types.ts'

export function QuickSortStage({ state }: StageProps<QuickSortState>) {
  const { arr, lo, hi, pivotVal, iPtr, jPtr, act, locked, sortedCount, n, phase } = state
  const done = phase === 'done'
  const inPart = pivotVal >= 0 && !done
  return (
    <div className="card">
      <h3>快速排序 <span className="hint">选基准，小的甩左、大的甩右，分而治之</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{inPart ? pivotVal : '—'}</span><span className="scdl">当前基准</span></div>
          <div className="scdk"><span className="scdn">{inPart ? `[${lo},${hi}]` : done ? '全区' : '—'}</span><span className="scdl">处理区间</span></div>
          <div className="scdk"><span className="scdn">{sortedCount}/{n}</span><span className="scdl">已归位</span></div>
        </div>

        <div className="qswrap">
          <div className="qsrow">
            {arr.map((v, k) => {
              const inRange = inPart && k >= lo && k <= hi
              const isPivot = inPart && v === pivotVal && k === hi && act !== 'place'
              const isScan = inPart && k === jPtr && (act === 'grow' || act === 'swap' || act === 'keep')
              const isPlace = act === 'place' && k === jPtr
              const lessZone = inPart && k >= lo && k <= iPtr    // 已收入 <pivot 的左区
              const isLock = locked[k]
              const cls = [
                'qscell',
                isLock ? 'lock' : '',
                isPivot ? 'pivot' : '',
                isScan ? 'scan' : '',
                isPlace ? 'place' : '',
                lessZone && !isLock ? 'less' : '',
                inRange ? '' : (inPart ? 'dim' : ''),
              ].filter(Boolean).join(' ')
              return (
                <div key={k} className="qscol">
                  <div className={cls}>{v}</div>
                  <span className="qstag">{isPivot ? '基准' : isScan ? 'j扫' : isLock ? '✓' : k === iPtr && inPart ? 'i' : ''}</span>
                </div>
              )
            })}
          </div>
          <div className="orcap">
            {act === '' ? '按「下一步」开始:挑区间末元素当基准,扫描把比它小的收到左边'
              : act === 'pivot' ? `新区间 [${lo},${hi}]:挑末元素 ${pivotVal} 当基准,准备扫描`
                : act === 'swap' ? `${arr[iPtr]} < ${pivotVal} → 换进左区(和 #${iPtr} 交换)`
                  : act === 'grow' ? `${arr[jPtr]} < ${pivotVal} → 原地并入左区(<区扩大)`
                    : act === 'keep' ? `${arr[jPtr]} ≥ ${pivotVal} → 不动,留右边`
                      : act === 'place' ? `基准 ${pivotVal} 归位到 #${jPtr}(绿=最终位置)——再切左右两段递归`
                        : act === 'single' ? `区间只剩 1 个数,天然有序,直接归位`
                          : `排好序:[${arr.join(',')}]`}
          </div>
        </div>

        {done
          ? <p className="scnote"><b>分而治之</b>:每趟 partition 选个基准,把比它小的甩左、不小于的留右,基准就落到<b>最终位置</b>(绿=永久锁定);再对左右两段各自递归,段越切越短到 1。平均 <b>O(n log n)</b>、原地、常数因子小——实践中最快的通用排序,C++ <code>sort</code>、各语言库底子都有它。最坏(已近有序且总挑到极值)退化到 O(n²),用随机/三数取中基准规避。</p>
          : <p className="scnote" style={{ opacity: .85 }}>琥珀=基准 pivot、蓝=扫描指针 j、i=左区(比基准小)的右边界、绿✓=已归位(最终位置)、灰=不在当前区间。看 j 一路扫:小的收进左区、大的留右,扫完基准归位、区间一切为二。</p>}
      </div>
    </div>
  )
}
