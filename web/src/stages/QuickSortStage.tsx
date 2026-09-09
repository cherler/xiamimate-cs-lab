/** 舞台：快速排序 —— 仪表级动效版。
 *
 *  柱子按**原始下标**做 key，位置用 translateX(槽位) —— 一交换，两根柱子的槽位对调，
 *  CSS transition 就把它们**滑着**换过去（FLIP），像真在排序而不是一帧帧跳。
 *
 *  ⚠️ key 原来用的是**值**（注释里写着"本实验 7 个值互异"）。2026-09-09 补厚加了
 *  「全都一样」「大量重复（3 种值）」两档数据，值一重复 key 就撞 —— React 会报
 *  "两个孩子用了同一个 key"，动画也会乱窜。原始下标（`tags`，跟着元素一起搬家）
 *  天然唯一，而且正好就是判"稳不稳定"要看的那个东西。
 *
 *  语义色：琥珀=基准 pivot、蓝=扫描指针 j、绿=已归位(锁定)、淡绿=已收入左区、灰=不在当前区间。
 */
import type { QuickSortState } from '@engine/kernels/quicksort.ts'
import type { StageProps } from '../types.ts'

const AREA = 208, BARMAX = 130, BARMIN = 28

export function QuickSortStage({ state }: StageProps<QuickSortState>) {
  const {
    arr, tags, lo, hi, pivotVal, iPtr, jPtr, act, locked, sortedCount, n, phase,
    compares, swaps, maxDepth, nlogn, nsq, slope, degraded, scale, stable, hasTies,
    dataKind, pivotRule, partRule, totalCompares, totalDepth,
  } = state
  const done = phase === 'done'
  const inPart = pivotVal >= 0 && !done
  const maxV = Math.max(...arr, 1)
  //  n 变了槽宽也得变，不然 10 根柱子会顶出舞台
  const SLOT = n <= 8 ? 66 : 52
  const BARW = SLOT - 12

  /*  重复值标上 a/b/c —— 按**原始下标**排序定字母。
      快排不稳定这句话，就靠排完之后看 3a 有没有跑到 3b 后面。 */
  const letter = new Map<number, string>()
  {
    const byVal = new Map<number, number[]>()
    arr.forEach((v, k) => { const g = byVal.get(v) ?? []; g.push(tags[k]); byVal.set(v, g) })
    for (const [, g] of byVal) {
      if (g.length < 2) continue
      const order = g.slice().sort((a, b) => a - b)
      order.forEach((t, idx) => letter.set(t, String.fromCharCode(97 + idx)))
    }
  }

  return (
    <div className="card">
      <h3>快速排序 <span className="hint">选基准，小的甩左、大的甩右，分而治之</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{inPart ? pivotVal : '—'}</span><span className="scdl">当前基准</span></div>
          <div className="scdk"><span className="scdn">{inPart ? `[${lo},${hi}]` : done ? '全区' : '—'}</span><span className="scdl">处理区间</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'good' : ''}`}>{sortedCount}/{n}</span><span className="scdl">已归位</span></div>
          <div className="scdk"><span className="scdn">{compares} / {swaps}</span><span className="scdl">比较 / 交换</span></div>
          {/*  最深递归是"会不会爆栈"的唯一凭据 —— 理想 log₂n，最坏 n */}
          <div className="scdk">
            <span className={`scdn ${maxDepth >= n ? 'bad' : ''}`}>{maxDepth}</span>
            <span className="scdl">最深递归（理想 {Math.log2(n).toFixed(1)}）</span>
          </div>
        </div>

        <div className="bc-wrap">
          <div className="bc-chart" style={{ width: n * SLOT, height: AREA }}>
            {inPart && <div className="bc-band" style={{ transform: `translateX(${lo * SLOT}px)`, width: (hi - lo + 1) * SLOT - (SLOT - BARW) }} />}
            {arr.map((v, k) => {
              const inRange = inPart && k >= lo && k <= hi
              const isPivot = inPart && k === hi && act !== 'place'
              const isScan = inPart && k === jPtr && (act === 'grow' || act === 'swap' || act === 'keep')
              const isPlace = act === 'place' && (partRule.startsWith('三路') ? k >= iPtr && k <= jPtr : k === jPtr)
              const lessZone = inPart && k >= lo && k <= iPtr
              const isLock = locked[k] || done
              const role = (isPlace || isLock) ? 'done' : isPivot ? 'focus' : isScan ? 'ptr'
                : lessZone ? 'soft' : (inRange || !inPart) ? '' : 'dim'
              const h = Math.round((v / maxV) * BARMAX + BARMIN)
              const lt = letter.get(tags[k])
              return (
                <div key={tags[k]} className={`bc-bar ${role}`}
                     style={{ transform: `translateX(${k * SLOT}px)`, width: BARW, height: h }}>
                  {(isPivot || isScan) && <span className={`bc-flag ${isPivot ? 'focus' : 'ptr'}`}>{isPivot ? '基准' : 'j'}</span>}
                  {isLock && !done && <span className="bc-tick">✓</span>}
                  <span className="bc-v">{v}{lt && <i className="bc-sub">{lt}</i>}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="orcap">
          {act === '' ? `按「下一步」开始：数据「${dataKind}」，基准按「${pivotRule}」挑，${partRule}`
            : act === 'pivot' ? `新区间 [${lo},${hi}]（长 ${hi - lo + 1}）：挑出基准 ${pivotVal}`
              : act === 'swap' ? `换位：和 #${state.swapWith} 交换`
                : act === 'grow' ? `${arr[jPtr]} < ${pivotVal} → 原地并入左区（<区扩大）`
                  : act === 'keep' ? `${arr[jPtr]} ${partRule.startsWith('三路') ? `= ${pivotVal} → 留在中间那堆` : `≥ ${pivotVal} → 不动，留右边`}`
                    : act === 'place' ? `基准归位（绿=最终位置）—— 再切左右两段递归`
                      : act === 'single' ? `区间只剩 1 个数，天然有序，直接归位`
                        : `排好序：[${arr.join(',')}]`}
        </div>

        {/*  规模验证：同一档参数静默跑几个 n，只计数不出帧。
             "退化成 n²"必须是这一列量出来的，不能是旁白里写上去的。 */}
        <div className="qsscale">
          <div className="qsrow qshead"><span>n</span><span>比较次数</span><span>n·log₂n</span><span>n(n−1)/2</span><span>最深递归</span></div>
          {scale.map(r => (
            <div className="qsrow" key={r.n}>
              <span>{r.n}</span>
              <span className={r.compares >= r.nsq * 0.9 ? 'bad' : ''}>{r.compares}</span>
              <span className="dimv">{r.nlogn}</span>
              <span className="dimv">{r.nsq}</span>
              <span className={r.depth >= r.n ? 'bad' : ''}>{r.depth}</span>
            </div>
          ))}
          <div className="orcap">
            实测增长指数 <b className={degraded ? 'bad' : 'good'}>{slope.toFixed(2)}</b>
            　（O(n log n) 在这一段是 1.28，O(n²) 是 2.0）
            {partRule.startsWith('三路') && <>　三路每个元素最多比两次，比较次数跟两路不是同一把尺，看指数才公平</>}
          </div>
        </div>

        {done
          ? (
            <p className="scnote">
              n={n} 比较 <b>{totalCompares}</b> 次、交换 {swaps} 次，最深递归 <b>{totalDepth}</b> 层（n·log₂n={nlogn}，n(n−1)/2={nsq}）。<br />
              {degraded ? (
                <>
                  ⚠️ <b>这一档退化了</b> —— 实测增长指数 {slope.toFixed(2)}，是 O(n²) 不是 O(n log n)。递归深度 {totalDepth} 层（理想 {Math.log2(n).toFixed(1)}），
                  <b>规模再大一点就是爆栈</b>；C++ <code>std::sort</code> 用 introsort 正是为这个：快排打底、<b>递归太深自动切成堆排序保底</b>。
                  退化的样子看每一趟的「左段/右段」：<b>总有一边是空的</b>，一趟只定下 1 个数。<br />
                  {pivotRule.startsWith('末元素') && dataKind !== '全都一样' && !dataKind.startsWith('大量重复')
                    ? <><b>修法就在旁边</b>：把「选基准」换成三数取中或随机，同一份数据立刻回到 O(n log n) —— 这就是"实际实现取首中尾三个数的中位数"在躲的东西。</>
                    : <><b>这一档换基准救不了</b> —— 元素大量相等，挑谁当基准都一样。得换<b>分区</b>：三路分区一趟把等于基准的全部锁定，增长指数掉到 1。</>}
                </>
              ) : slope <= 1.1 ? (
                /*  ⚠️ 别对三路分区说"每趟切成两半、深度接近 log₂n" —— 它在全相等数据上深度是 1，
                    而 log₂10≈3.3。那句话会在屏幕上直接印成假话。 */
                <>实测增长指数 <b>{slope.toFixed(2)}</b> —— <b>线性</b>。三路分区一趟就把等于基准的<b>整堆</b>锁定，递归只有 {totalDepth} 层：
                  这份数据里不同的值本来就没几个，排序要做的事本来就少。<b>两路分区看不见这一点</b>，它一次只能定一个，于是把等值元素反复搬来搬去。</>
              ) : (
                <>实测增长指数 {slope.toFixed(2)} —— 这才是快排该有的样子：每趟把区间大致切成两半，深度 {totalDepth} 层接近 log₂{n}≈{Math.log2(n).toFixed(1)}。</>
              )}
              {hasTies && <><br />{stable
                ? <>等值元素（角标 a/b/c）的原始次序这一档<b>碰巧</b>没被打乱 —— 那是运气，快排不保证。</>
                : <><b>看等值元素的角标</b>：排完之后 a/b/c 的次序被打乱了。快排<b>不稳定</b> —— 按多关键字排序（先按成绩再按姓名）时这一点直接决定结果对不对。</>}</>}
            </p>
          )
          : <p className="scnote" style={{ opacity: .85 }}>琥珀=基准、蓝=扫描指针 j、绿✓=已归位、淡绿=已收进左区、灰=不在当前区间。看 j 一路扫，扫完基准归位、区间一切为二 —— 柱子会滑着交换。</p>}
      </div>
    </div>
  )
}
