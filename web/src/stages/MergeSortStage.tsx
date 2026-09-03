/** 舞台：归并排序 —— 仪表级动效。上=原数组柱状图(蓝=左段、琥珀=右段、旗=各自队首、灰=不在本次归并),
 *  下=输出缓冲(比两段队首、取小的接上,末格按来源染色)。写回后柱子按值滑成有序(FLIP,值互异)。 */
import type { MergeSortState } from '@engine/kernels/mergesort.ts'
import type { StageProps } from '../types.ts'

const SLOT = 66, BARW = 54, AREA = 208, BARMAX = 142, BARMIN = 30

export function MergeSortStage({ state }: StageProps<MergeSortState>) {
  const { arr, n, width, lo, mid, hi, li, rj, out, took, from, act, phase } = state
  const done = phase === 'done'
  const merging = act === 'emit' || act === 'drain'
  const showSeg = merging || act === 'done'
  const maxV = Math.max(...arr, 1)
  return (
    <div className="card">
      <h3>归并排序 <span className="hint">分到不能再分，再两两有序地合并回去</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '全' : width}</span><span className="scdl">当前段宽</span></div>
          <div className="scdk"><span className="scdn">{showSeg ? `[${lo},${hi})` : done ? '全区' : '—'}</span><span className="scdl">归并区段</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'good' : ''}`}>{out.length}</span><span className="scdl">已输出</span></div>
        </div>

        <div className="bc-wrap">
          <div className="bc-chart" style={{ width: n * SLOT, height: AREA }}>
            {showSeg && <div className="bc-band" style={{ transform: `translateX(${lo * SLOT}px)`, width: (hi - lo) * SLOT - (SLOT - BARW) }} />}
            {arr.map((v, k) => {
              const inLeft = merging && k >= lo && k < mid
              const inRight = merging && k >= mid && k < hi
              const inSeg = showSeg && k >= lo && k < hi
              const isHeadL = inLeft && k === li
              const isHeadR = inRight && k === rj
              const settled = act === 'done' && inSeg
              const role = settled ? 'done' : inLeft ? 'ptr' : inRight ? 'focus' : (showSeg && !inSeg) ? 'dim' : ''
              const h = Math.round((v / maxV) * BARMAX + BARMIN)
              return (
                <div key={v} className={`bc-bar ${role}`} style={{ transform: `translateX(${k * SLOT}px)`, width: BARW, height: h }}>
                  {isHeadL && <span className="bc-flag ptr">左首</span>}
                  {isHeadR && <span className="bc-flag focus">右首</span>}
                  <span className="bc-v">{v}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bc-outlab">输出缓冲 · 比两段队首取小的接上（<b style={{ color: 'var(--f-tag)' }}>蓝=取自左段</b>、<b style={{ color: 'var(--now)' }}>琥珀=取自右段</b>）</div>
        <div className="bc-out">
          {out.length === 0 ? <span className="bc-empty">—（还没开始归并）</span>
            : out.map((v, k) => <div key={k} className={`bc-oc ${k === out.length - 1 && took >= 0 ? (from === 'L' ? 'fromL' : 'fromR') : ''}`}>{v}</div>)}
        </div>

        <div className="orcap">
          {act === '' ? '按「下一步」开始:把数组看成一堆长度 1 的有序段,两两归并'
            : act === 'done' ? `段宽 ${width} 的两段归并成宽 ${out.length} 的有序段 [${out.join(',')}]`
              : act === 'drain' ? `另一段空了 → ${from === 'L' ? '左' : '右'}段剩下的 ${took} 直接接上`
                : `比两段队首,${from === 'L' ? '左' : '右'}段的 ${took} 更小 → 取它进输出`}
        </div>

        {done
          ? <p className="scnote"><b>分治</b>的另一面:快排先分区再递归,归并是<b>分到底(长度 1)再两两合并回去</b>。合并两个已排好的段,只需比各自<b>队首</b>取小的,一趟线性就拼成更长的有序段;段宽 1→2→4… 直到全有序。它<b>稳定</b>、最坏也稳稳 <b>O(n log n)</b>,代价是要额外缓冲。外部排序(大到装不下内存,分块排好再多路归并)、稳定排序、链表排序都靠它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>蓝=正在归并的左段、琥珀=右段,「左首/右首」=各自队首,灰=不在本次归并。归并只做一件事:比两段队首、把小的先接进下面的输出缓冲——因为两段各自已有序,队首就是各自最小。写回后柱子滑成有序。</p>}
      </div>
    </div>
  )
}
