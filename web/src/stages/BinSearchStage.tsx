/** 舞台：二分查找 —— 有序数组，[lo,hi] 区间每步对半砍、mid 指针跳，直到命中 */
import type { BinSearchState } from '@engine/kernels/binsearch.ts'
import type { StageProps } from '../types.ts'

export function BinSearchStage({ state }: StageProps<BinSearchState>) {
  const { arr, target, lo, hi, mid, cmp, found, compares, phase , sorted, reallyThere, bound } = state
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
                  {(() => {
                    const marker = k === lo ? 'lo' : k === hi ? 'hi' : k === mid ? 'mid' : ''
                    return <span className={`bsidx ${marker === 'mid' ? 'mid' : marker ? 'lohi' : ''}`}>{marker}</span>
                  })()}
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

        {/*  前提没成立时先摆一条横幅 —— 这一屏最该看见的是"它安静地失败了" */}
        {!sorted && (
          <div className="bsWarn">
            ⚠️ 这份数组<b>没有排序</b> —— 二分查找的前提被破坏了。
            算法照跑不误、不报错，但它每一步的推断（"比它大就只可能在右半"）已经没有依据。
          </div>
        )}

        {phase === 'done'
          ? (found >= 0
            ? <p className="scnote">只用 <b>{compares}</b> 次比较，就在 {arr.length} 个数里定位了 {target}（下标 {found}）；
              上界是 ⌈log₂(n+1)⌉ = <b>{bound}</b> 次。每次比较<b>砍掉一半</b>候选 —— 所以是 <b>log₂n</b>，
              百万个数也只要 ~20 步。B+树索引、二分定位 bug、猜数游戏都靠它。
              　把「数组」换成<b>乱序</b>那一档试试：同一批数、只是顺序变了，你会看到它怎么"找不到"。</p>
            : reallyThere >= 0
              ? <p className="scnote"><b>没找到 —— 可 {target} 明明在数组里（下标 {reallyThere}）。</b>
                这份数组<b>没有排序</b>，而二分的每一步推断都建立在有序之上；前提一破，
                那句"只可能在右半"就不成立，它会把目标所在的半边<b>整个扔掉</b>。
                　注意它<b>没有报错、没有崩、也没跑慢</b> —— 照样 {compares} 次比较干净利落地返回"不存在"。
                <b>这才是二分最危险的地方：它失败得很安静。</b>
                用二分之前先确认有序，不是形式主义 —— 出事时你连一条线索都拿不到。</p>
              : <p className="scnote">区间缩到 lo&gt;hi，<b>{target} 确实不在数组里</b>（线性扫也确认了），用了 {compares} 次比较。
                　停下来时的 <b>lo={lo}</b> 就是它<b>该插进去的位置</b> —— 这正是 lower_bound 的用处：
                二分不只回答"在不在"，还回答"该放哪儿"。有序数组的插入、范围查询都靠这一点。</p>)
          : <p className="scnote" style={{ opacity: .85 }}>灰掉的格子=已经排除的候选。看正中间那个：目标比它大就只可能在右半、比它小只可能在左半 —— 一次比较砍一半。
            {sorted ? '' : '　—— 但这份数组没排序，"只可能"三个字此刻是没有依据的。'}</p>}
      </div>
    </div>
  )
}
