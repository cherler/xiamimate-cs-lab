/** 舞台：哈希雪崩 —— 两个哈希逐位对比，数翻转位 */
import type { HashAvalState } from '@engine/kernels/hashaval.ts'
import type { StageProps } from '../types.ts'

export function HashAvalStage({ state }: StageProps<HashAvalState>) {
  const { a, b, hashA, hashB, bitsA, bitsB, pos, flipped, phase } = state
  const done = phase === 'done'
  return (
    <div className="card">
      <h3>哈希雪崩效应 <span className="hint">输入改一点，输出翻一半</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">"{a}" vs "{b}"</span><span className="scdl">输入·改一点点</span></div>
          <div className="scdk"><span className="scdn">{hashA} / {hashB}</span><span className="scdl">两个哈希</span></div>
          <div className="scdk"><span className={`scdn ${flipped >= 6 ? 'ok' : ''}`}>{flipped}/16</span><span className="scdl">翻转位数</span></div>
        </div>
        <div className="cx-rows">
          <div className="cx-row"><span className="cx-lbl">h(&ldquo;{a}&rdquo;)</span>{bitsA.map((x, i) => <span key={i} className={`cx-cell ${i === pos ? 'cur' : ''}`}>{x}</span>)}</div>
          <div className="cx-row"><span className="cx-lbl">h(&ldquo;{b}&rdquo;)</span>{bitsB.map((x, i) => {
            const diff = bitsA[i] !== x
            return <span key={i} className={`cx-cell ${i <= pos || done ? (diff ? 'flip' : 'same') : ''} ${i === pos ? 'cur' : ''}`}>{x}</span>
          })}</div>
        </div>
        {done
          ? <p className="scnote">只把 &ldquo;{a}&rdquo; 改成 &ldquo;{b}&rdquo;（一个字母），16 位哈希就翻转了 <b>{flipped} 位（≈一半）</b>。输入微小变化 → 输出面目全非，这就是<b>雪崩效应</b>——防篡改的根基，让攻击者没法一点点凑出想要的哈希。真实 SHA-256 是 256 位、雪崩更彻底。</p>
          : <p className="scnote" style={{ opacity: .85 }}>逐位比较两个哈希：<span style={{ color: 'var(--miss)' }}>红=翻转</span>、绿=相同。好的哈希函数里，一位输入之差应引起约一半输出位翻转，且不可预测。</p>}
      </div>
    </div>
  )
}
