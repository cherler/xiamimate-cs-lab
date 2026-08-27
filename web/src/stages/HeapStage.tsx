/** 舞台：二叉堆 —— 完全二叉树(父≥子)+数组双视图，节点 sift-down 下沉、取堆顶把最大排到尾 */
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
  const { arr, heapN, node, child, act, stage, sortedFrom, phase } = state
  const done = phase === 'done'
  const H = 16 + 3 * LH
  return (
    <div className="card">
      <h3>二叉堆 <span className="hint">父永远≥子，堆顶永远最大</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{arr[0] ?? '—'}</span><span className="scdl">堆顶(最大)</span></div>
          <div className="scdk"><span className="scdn">{heapN}</span><span className="scdl">堆内元素</span></div>
          <div className="scdk"><span className="scdn">{stage === 'build' ? '建堆' : '取顶'}</span><span className="scdl">当前阶段</span></div>
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

        {done
          ? <p className="scnote">完全二叉树 + <b>父≥子</b>=最大堆,<b>堆顶永远最大</b>。sift-down 让不满足的节点一路下沉到位;建堆 O(n)、取最大 O(log n)。反复"取顶→补位→下沉"就是<b>堆排序</b>(O(n log n))。堆是优先队列的标配:任务调度、Dijkstra、Top-K、合并 K 路有序流,都靠它 O(log n) 拿最值。数组下标 i 的孩子在 2i+1/2i+2,不用指针。</p>
          : <p className="scnote" style={{ opacity: .85 }}>上=树(琥珀圈=正下沉的节点、绿圈=更大的孩子),下=同一个堆压进数组(#k=下标,绿"已排"=取出的最大值)。孩子在 2i+1、2i+2。看节点比孩子小就往下沉。</p>}
      </div>
    </div>
  )
}
