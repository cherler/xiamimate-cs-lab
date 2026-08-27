/** 舞台：二分查找 —— 有序数组，[lo,hi] 区间每步对半砍、mid 指针跳，直到命中 */
import type { BinSearchState } from '@engine/kernels/binsearch.ts'
import type { StageProps } from '../types.ts'

export function BinSearchStage({ state }: StageProps<BinSearchState>) {
  const { arr, target, lo, hi, mid, cmp, found, compares, phase } = state
  return (
    <div className="card">
      <h3>二分查找 <span className="hint">有序=每问一次砍掉一半</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{target}</span><span className="scdl">要找的数</span></div>
          <div className="scdk"><span className="scdn">[{lo},{hi}]</span><span className="scdl">当前区间</span></div>
          <div className="scdk"><span className="scdn">{compares}</span><span className="scdl">比较次数</span></div>
        </div>

        <div className="bswrap">
          <div className="bsrow">
            {arr.map((v, k) => {
              const inRange = k >= lo && k <= hi
              const isMid = k === mid && phase !== 'done'
              const isFound = k === found && (cmp === 'hit' || phase === 'done')
              return (
                <div key={k} className="bscol">
                  <div className={`bscell ${inRange ? '' : 'out'} ${isMid ? 'mid' : ''} ${isFound ? 'found' : ''}`}>{v}</div>
                  <span className="bsidx">{k === lo ? 'lo' : k === hi ? 'hi' : k === mid ? 'mid' : ''}</span>
                </div>
              )
            })}
          </div>
          <div className="orcap">
            {mid < 0 ? '按「下一步」开始:看正中间那个数'
              : cmp === 'hit' ? `arr[${mid}]=${arr[mid]} 正好=${target}——命中!`
              : cmp === 'go-right' ? `arr[${mid}]=${arr[mid]} < ${target} → 砍掉左半,只看右边`
              : `arr[${mid}]=${arr[mid]} > ${target} → 砍掉右半,只看左边`}
          </div>
        </div>

        {phase === 'done'
          ? <p className="scnote">只用 <b>{compares}</b> 次比较,就在 {arr.length} 个数里定位了 {target}(下标 {found})。每次比较<b>砍掉一半</b>候选——所以是 <b>log₂n</b>:百万个数也只要 ~20 步。这就是"有序 + 每次排除一半"的威力,B+树索引、二分定位 bug、猜数游戏都靠它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>灰掉的格子=已经排除的候选。看正中间那个:目标比它大就只可能在右半、比它小只可能在左半——一次比较砍一半。</p>}
      </div>
    </div>
  )
}
