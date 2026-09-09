/**
 * 舞台：二叉堆 —— 完全二叉树(父≥子) + 数组双视图。
 *
 * 补厚后这一屏的落点是底下那张表：**两种建法在几个 n 上的建堆比较次数与增长指数**。
 * 「建堆是 O(n)」是这个数据结构最反直觉的一件事，而它只能量出来。
 */
import type { HeapState } from '@engine/kernels/heap.ts'
import type { StageProps } from '../types.ts'

const W = 300, LH = 34, PAD = 16

function pos(i: number) {
  const d = Math.floor(Math.log2(i + 1))
  const cnt = 2 ** d
  const posInLevel = i - (cnt - 1)
  const x = PAD + ((posInLevel + 0.5) / cnt) * (W - 2 * PAD)
  const y = 16 + d * LH
  return { x, y }
}

export function HeapStage({ state }: StageProps<HeapState>) {
  const {
    arr, heapN, node, child, act, stage, sortedFrom, phase,
    build, after, dataKind, n, compares, swaps, buildCompares, totalCompares,
    heapSorted, builtArr, buildSweep, nlogn, drawn, omitted,
  } = state
  const done = phase === 'done'
  //  n 变了树的层数也得变（原来写死 3 层，n=12 要 4 层）
  const depth = Math.max(1, Math.ceil(Math.log2(n + 1)))
  const H = 16 + depth * LH
  const mine = buildSweep.find(x => x.build === build)
  const other = buildSweep.find(x => x.build !== build)
  const bigMine = mine?.rows[mine.rows.length - 1].compares ?? 0
  const bigOther = other?.rows[other.rows.length - 1].compares ?? 0
  return (
    <div className="card">
      <h3>二叉堆 <span className="hint">父永远≥子，堆顶永远最大</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{arr[0] ?? '—'}</span><span className="scdl">堆顶(最大)</span></div>
          <div className="scdk"><span className="scdn">{heapN}</span><span className="scdl">堆内元素</span></div>
          <div className="scdk"><span className="scdn">{stage === 'build' ? '建堆' : stage === 'extract' ? '取顶' : '—'}</span><span className="scdl">当前阶段</span></div>
          <div className="scdk"><span className="scdn">{compares} / {swaps}</span><span className="scdl">比较 / 交换</span></div>
          {/*  ⭐ 补厚的落点：建堆到底是 O(n) 还是 O(n log n)，只能量 */}
          <div className="scdk"><span className="scdn hot">{buildCompares}</span><span className="scdl">建堆共比较几次</span></div>
          <div className="scdk">
            <span className={`scdn ${heapSorted ? '' : 'bad'}`}>{heapSorted ? '是' : '否'}</span>
            <span className="scdl">建完堆后数组有序吗</span>
          </div>
        </div>

        <div className="hpwrap">
          <svg className="hptree" viewBox={`0 0 ${W} ${H + 8}`} preserveAspectRatio="xMidYMid meet">
            {/* 边 */}
            {Array.from({ length: heapN }, (_, i) => i).filter(i => i > 0).map(i => {
              const c = pos(i), p = pos(Math.floor((i - 1) / 2))
              return <line key={`e${i}`} x1={p.x} y1={p.y} x2={c.x} y2={c.y} stroke="var(--line)" strokeWidth="1" />
            })}
            {/* 节点 */}
            {Array.from({ length: heapN }, (_, i) => {
              const { x, y } = pos(i)
              const isNode = i === node && !done
              const isChild = i === child && act === 'sift'
              const fill = isNode ? 'color-mix(in srgb,var(--now) 30%,var(--panel))'
                : isChild ? 'color-mix(in srgb,var(--hit) 26%,var(--panel))' : 'var(--panel)'
              const stroke = isNode ? 'var(--now)' : isChild ? 'var(--hit)' : 'var(--line)'
              return (
                <g key={`n${i}`}>
                  <circle cx={x} cy={y} r="12" fill={fill} stroke={stroke} strokeWidth={isNode || isChild ? 2 : 1} />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fontWeight={700} fill="var(--ink)">{arr[i]}</text>
                </g>
              )
            })}
          </svg>

          <div className="hprow">
            {arr.map((v, k) => {
              const out = k >= sortedFrom
              const isN = k === node && !done
              const isC = k === child && act === 'sift'
              return (
                <div key={k} className={`hpcell ${out ? 'out' : ''} ${isN ? 'node' : ''} ${isC ? 'child' : ''}`}>
                  <span className="hpv">{v}</span>
                  <span className="hpi">{out ? '已排' : `#${k}`}</span>
                </div>
              )
            })}
          </div>

          <div className="orcap">
            {act === ''
              ? '按「下一步」开始:乱序数组,从最后一个非叶节点倒着 sift-down 建堆'
              : act === 'sift' ? `${arr[node]} 比更大的孩子小 → 交换(绿),继续往下沉`
                : act === 'extract' ? `取堆顶最大值 ${arr[sortedFrom]} → 和末尾对调、排到数组尾(就位),堆缩小`
                  : act === 'done' ? `复原完成:新堆顶 ${arr[0]} 是剩下的最大;取出的最大已在尾部`
                    : `节点 ${node >= 0 ? arr[node] : ''} 已 ≥ 孩子,到位`}
          </div>
        </div>

        {/*  两种建法的规模表：「建堆是 O(n)」只能量出来 */}
        {done && (
          <div className="qsscale">
            <div className="qsrow qshead"><span>建法</span><span>n=64</span><span>n=256</span><span>n=512</span><span>增长指数</span></div>
            {buildSweep.map(x => (
              <div className="qsrow" key={x.build}>
                <span>{x.build.startsWith('自底') ? 'Floyd' : '逐个插入'}{x.build === build ? ' ◀' : ''}</span>
                {[64, 256, 512].map(nn => (
                  <span key={nn} className="dimv">{x.rows.find(r => r.n === nn)?.compares}</span>
                ))}
                <span className={x.slope < 1.15 ? 'good' : 'bad'}>{x.slope.toFixed(2)}</span>
              </div>
            ))}
            <div className="orcap">
              数据形状「{dataKind}」下各建一次堆，只计数不出帧。指数 1.0 = <b>线性</b>（这就是那个 O(n)）。
            </div>
          </div>
        )}

        {done
          ? (
            <p className="scnote">
              建堆用了 <b>{buildCompares}</b> 次比较{after !== '只建堆' && <>，全程共 <b>{totalCompares}</b> 次（对照 n·log₂n = {nlogn}）</>}。
              <br />
              <b>① 建堆到底是 O(n) 还是 O(n log n)？</b>两种建法各扫一遍（只计数不出帧）：
              自底向上（Floyd）增长指数 <b>{buildSweep[0]?.slope.toFixed(2)}</b>、逐个插入 <b>{buildSweep[1]?.slope.toFixed(2)}</b>。
              为什么 Floyd 能是线性？<b>越靠近叶子的节点越多，而它们能下沉的高度越小</b> ——
              一半的节点是叶子、根本不用沉，四分之一只沉一层……加起来收敛到 O(n)。
              {/*  ⚠️ 别写死"差 X 倍"：实测下来这个倍数**取决于数据形状**（升序差 3.6 倍、
                   随机 1.18 倍、完全逆序一模一样）。写死一个数在另外两档上就是假话。 */}
              <br />
              在<b>这一档数据</b>（{dataKind}）上，n=512 时当前建法 <b>{bigMine}</b> 次、另一种 <b>{bigOther}</b> 次 ——
              {Math.max(bigMine, bigOther) / Math.max(1, Math.min(bigMine, bigOther)) < 1.05
                ? <> <b>几乎一模一样</b>。这不矛盾：{dataKind}恰好本来就是个最大堆，逐个插入时一次都不用上浮。
                  <b>换成「已经排好序」再看</b>，那才是逐个插入最惨的一档。</>
                : <> 差 <b>{(Math.max(bigMine, bigOther) / Math.max(1, Math.min(bigMine, bigOther))).toFixed(2)} 倍</b>。</>}
              <br />
              <b>② 一个常见的误解：堆不是排好序的。</b>建完堆之后数组是 [{builtArr.join(',')}] ——
              {heapSorted
                ? <> 这一档<b>碰巧</b>是升序的，但那是巧合。</>
                : <> <b>它不是有序的</b>。堆只保证"每个父亲 ≥ 它的孩子"，也就是<b>只有堆顶是全体最大</b>；
                  兄弟之间、隔房的叔侄之间<b>完全没有大小关系</b>。</>}
              想要有序，得反复"取堆顶" —— <b>那就是堆排序</b>。
              {omitted > 0 && <><br />⚠️ 逐帧只画了前 {drawn} 步，后面画不下 —— 上面这些计数是全量精确的。</>}
            </p>
          )
          : <p className="scnote" style={{ opacity: .85 }}>上=树(琥珀圈=正下沉的节点、绿圈=更大的孩子),下=同一个堆压进数组(#k=下标,绿"已排"=取出的最大值)。孩子在 2i+1、2i+2。看节点比孩子小就往下沉。</p>}
      </div>
    </div>
  )
}
