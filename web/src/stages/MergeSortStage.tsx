/**
 * 舞台：归并排序 —— 上=原数组柱状图（蓝=左段、琥珀=右段、旗=各自队首、灰=不在本次归并），
 * 下=输出缓冲（比两段队首、取小的接上，末格按来源染色）。
 *
 * ⚠️ 柱子的 key 原来用的是**值**（原注释写着"值互异"）。2026-09-09 补厚加了
 * 「大量重复（考稳定性）」那一档，值一重复 key 就撞。改用**原始下标**（`tags`，
 * 跟着元素一起搬家）—— 它天然唯一，而且正好就是判"稳不稳定"要看的那个东西。
 *
 * 补厚后这一屏多了两块：读数里的**缓冲区峰值**（归并要 O(n)，快排是原地的）、
 * 以及底下的**数据形状表**（四种形状的比较次数几乎不动 —— 拿去跟快排那一屏的 11 倍对照）。
 */
import type { MergeSortState } from '@engine/kernels/mergesort.ts'
import type { StageProps } from '../types.ts'

const SLOT = 66, BARW = 54, AREA = 208, BARMAX = 142, BARMIN = 30

export function MergeSortStage({ state }: StageProps<MergeSortState>) {
  const {
    arr, tags, n, width, lo, mid, hi, li, rj, out, took, from, act, phase,
    compares, moves, bufPeak, passes, totalCompares, totalMoves, totalBuf, totalPasses,
    dataKind, tie, passKind, stable, hasTies, shapeSweep, shapeSpread, nlogn,
  } = state
  const done = phase === 'done'
  const merging = act === 'emit' || act === 'drain'
  const showSeg = merging || act === 'merged'
  const maxV = Math.max(...arr, 1)

  /*  重复值标上 a/b/c —— 按**原始下标**排序定字母。
      「归并排序是稳定的」这句话，就靠排完之后看 3a 有没有跑到 3b 后面。 */
  const letter = new Map<number, string>()
  {
    const byVal = new Map<number, number[]>()
    arr.forEach((v, k) => { const g = byVal.get(v) ?? []; g.push(tags[k]); byVal.set(v, g) })
    for (const [, g] of byVal) {
      if (g.length < 2) continue
      g.slice().sort((a, b) => a - b).forEach((t, idx) => letter.set(t, String.fromCharCode(97 + idx)))
    }
  }
  return (
    <div className="card">
      <h3>归并排序 <span className="hint">分到不能再分，再两两有序地合并回去</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{done ? '全' : width}</span><span className="scdl">当前段宽</span></div>
          <div className="scdk"><span className="scdn">{showSeg ? `[${lo},${hi})` : done ? '全区' : '—'}</span><span className="scdl">归并区段</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'good' : ''}`}>{out.length}</span><span className="scdl">已输出</span></div>
          <div className="scdk"><span className="scdn">{compares} / {moves}</span><span className="scdl">比较 / 搬运</span></div>
          {/*  ⭐ 补厚的落点：归并"没有坏情况"是**拿空间换的**，这一栏就是那笔账 */}
          <div className="scdk"><span className="scdn">{bufPeak}</span><span className="scdl">缓冲区峰值（快排是 0）</span></div>
          <div className="scdk"><span className="scdn">{passes}</span><span className="scdl">已走趟数</span></div>
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
                <div key={tags[k]} className={`bc-bar ${role}`} style={{ transform: `translateX(${k * SLOT}px)`, width: BARW, height: h }}>
                  {isHeadL && <span className="bc-flag ptr">左首</span>}
                  {isHeadR && <span className="bc-flag focus">右首</span>}
                  <span className="bc-v">{v}{letter.get(tags[k]) && <i className="bc-sub">{letter.get(tags[k])}</i>}</span>
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

        {/*  数据形状表：归并的比较次数几乎不随形状变 —— 拿去跟快排那一屏对照 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>数据形状</span><span>n=128 比较</span><span>增长指数</span><span></span><span></span></div>
            {shapeSweep.map(sw => (
              <div className="qsrow" key={sw.data}>
                <span>{sw.data}{sw.data === dataKind ? ' ◀' : ''}</span>
                <span>{sw.rows[sw.rows.length - 1].compares}</span>
                <span className="dimv">{sw.slope.toFixed(2)}</span>
                <span /><span />
              </div>
            ))}
            <div className="orcap">
              同一套参数（{tie} · {passKind}）在四种数据形状上各跑一遍，只计数不出帧。
              最费的比最省的多 <b className={shapeSpread < 3 ? 'good' : 'bad'}>{shapeSpread} 倍</b>。
            </div>
          </div>
        )}

        <div className="orcap">
          {act === '' ? '按「下一步」开始:把数组看成一堆长度 1 的有序段,两两归并'
            : act === 'done' ? `段宽 ${width} 的两段归并成宽 ${out.length} 的有序段 [${out.join(',')}]`
              : act === 'drain' ? `另一段空了 → ${from === 'L' ? '左' : '右'}段剩下的 ${took} 直接接上`
                : `比两段队首,${from === 'L' ? '左' : '右'}段的 ${took} 更小 → 取它进输出`}
        </div>

        {done
          ? (
            <p className="scnote">
              n={n}：走了 <b>{totalPasses}</b> 趟、比较 <b>{totalCompares}</b> 次、搬运 {totalMoves} 次，
              <b>缓冲区峰值 {totalBuf}</b> 个元素（对照 n·log₂n = {nlogn}）。
              <br />
              <b>① 换数据形状会怎样。</b>四种形状各扫一遍，最费的比最省的多 <b>{shapeSpread} 倍</b>
              {shapeSpread < 3
                ? <> —— <b>归并没有坏情况</b>。而隔壁<b>快排</b>那一屏上同样的对照是 <b>1137 → 12720（差 11 倍）</b>。</>
                : <> —— ⚠️ <b>这一档已经不是"最坏也一样"了</b>。自然归并有了"好情况"（已排好序），也就等于承认了"坏情况"；
                  固定倍增那一版才是四种形状几乎不动的那个。</>}
              <br />
              {/*  ⚠️ 缓冲区那句话得按**实测值**说：自然归并 + 已排好序时一次归并都不做、峰值是 0，
                   照着模板印"0 个元素，也就是 O(n)"是自相矛盾的。 */}
              {totalBuf > 0
                ? <><b>② 而这个代价是空间。</b>缓冲区峰值 <b>{totalBuf}</b> 个元素（n={n}），也就是 <b>O(n)</b>；
                  快排是<b>原地</b>的，只花 O(log n) 的递归栈。<b>这就是实践中快排更常用的理由</b> ——
                  而数据大到装不下内存时（外部排序），反倒只有归并做得了。</>
                : <><b>② 这一趟一次归并都没做，所以缓冲区峰值是 0。</b>但归并一般要 <b>O(n)</b> 的额外缓冲 ——
                  换个数据形状（或换回固定倍增）就看得见。快排是<b>原地</b>的，那一栏永远是 0。</>}
              {hasTies && <>
                <br />
                <b>③ "归并排序是稳定的"，稳的其实是一个字符。</b>当前是「{tie}」：{stable
                  ? <>相等时先取<b>左</b>段，而左段在原数组里本来就在前面 —— 等值元素的角标 a/b/c <b>原序保住了</b>。
                    把「取小的规则」换成「相等时取右段」再看：只把 <code>&lt;=</code> 改成 <code>&lt;</code>，排序结果一模一样，而角标会乱。</>
                  : <>相等时先取<b>右</b>段。排序结果照样正确，<b>但等值元素的角标被打乱了</b> —— 稳定性没了。
                    按多关键字排序（先按成绩再按姓名）时，这一个字符决定结果对不对。</>}
              </>}
            </p>
          )
          : <p className="scnote" style={{ opacity: .85 }}>蓝=正在归并的左段、琥珀=右段,「左首/右首」=各自队首,灰=不在本次归并。归并只做一件事:比两段队首、把小的先接进下面的输出缓冲——因为两段各自已有序,队首就是各自最小。写回后柱子滑成有序。</p>}
      </div>
    </div>
  )
}
