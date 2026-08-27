/** 舞台：归并排序 —— 分到长度 1 的有序段，两两归并：比两段队首、取小的进输出，段宽翻倍到全有序 */
import type { MergeSortState } from '@engine/kernels/mergesort.ts'
import type { StageProps } from '../types.ts'

export function MergeSortStage({ state }: StageProps<MergeSortState>) {
  const { arr, n, width, lo, mid, hi, li, rj, out, took, from, focus, act, phase } = state
  const done = phase === 'done'
  const merging = act === 'emit' || act === 'drain'
  return (
    <div className="card">
      <h3>归并排序 <span className="hint">分到不能再分，再两两有序地合并回去</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '全' : width}</span><span className="scdl">当前段宽</span></div>
          <div className="scdk"><span className="scdn">{merging || act === 'done' ? `[${lo},${hi})` : done ? '全区' : '—'}</span><span className="scdl">归并区段</span></div>
          <div className="scdk"><span className="scdn">{out.length}</span><span className="scdl">已输出</span></div>
        </div>

        <div className="mswrap">
          <div className="msseg">原数组（同色=一个有序段，两两归并）</div>
          <div className="msrow">
            {arr.map((v, k) => {
              const inSeg = (merging || act === 'done') && k >= lo && k < hi
              const inLeft = merging && k >= lo && k < mid
              const inRight = merging && k >= mid && k < hi
              const isFront = merging && (k === li || k === rj) && (k >= lo && k < hi)
              const isFocus = merging && k === focus
              const cls = [
                'mscell',
                inLeft ? 'lrun' : '', inRight ? 'rrun' : '',
                act === 'done' && inSeg ? 'merged' : '',
                isFront ? 'front' : '', isFocus ? 'take' : '',
                (merging || act === 'done') && !inSeg ? 'dim' : '',
              ].filter(Boolean).join(' ')
              return (
                <div key={k} className="mscol">
                  <div className={cls}>{v}</div>
                  <span className="mstag">{isFocus ? '取' : k === li && inLeft ? '左▸' : k === rj && inRight ? '右▸' : ''}</span>
                </div>
              )
            })}
          </div>

          <div className="msseg" style={{ marginTop: 6 }}>输出缓冲（比两段队首，取小的接上）</div>
          <div className="msrow msout">
            {out.length === 0
              ? <div className="msempty">—</div>
              : out.map((v, k) => (
                <div key={k} className={`mscell ob ${k === out.length - 1 && took >= 0 ? (from === 'L' ? 'fromL' : 'fromR') : ''}`}>{v}</div>
              ))}
          </div>

          <div className="orcap">
            {act === '' ? '按「下一步」开始:把数组看成一堆长度 1 的有序段,两两归并'
              : act === 'done' ? `段宽 ${width} 的两段归并成宽 ${out.length} 的有序段 [${out.join(',')}]`
                : act === 'drain' ? `另一段空了 → ${from === 'L' ? '左' : '右'}段剩下的 ${took} 直接接上`
                  : `比两段队首,${from === 'L' ? '左' : '右'}段的 ${took} 更小 → 取它进输出`}
          </div>
        </div>

        {done
          ? <p className="scnote"><b>分治</b>的另一面:快排先分区再递归,归并是<b>分到底(长度 1)再两两合并回去</b>。合并两个已排好的段,只需比各自<b>队首</b>取小的,一趟线性就拼成更长的有序段;段宽 1→2→4… 直到全有序。它<b>稳定</b>、最坏也稳稳 <b>O(n log n)</b>,代价是要额外缓冲。外部排序(大到装不下内存,分块排好再多路归并)、稳定排序、链表排序都靠它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>上=原数组(蓝=正在归并的左段、琥珀=右段,▸=各自队首,灰=不在本次归并),下=输出缓冲。归并只做一件事:比两段队首、把小的先接进输出——因为两段各自已有序,队首就是各自最小。</p>}
      </div>
    </div>
  )
}
