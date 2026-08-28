/** 舞台：Trie 自动补全 —— 缩进树显示前缀树，走查路径高亮，收集子树词按热度排 Top-K */
import type { TrieState } from '@engine/kernels/trie.ts'
import type { StageProps } from '../types.ts'

export function TrieStage({ state }: StageProps<TrieState>) {
  const { op, prefix, walked, nodes, candidates, suggestions, phase } = state
  const done = phase === 'done'
  const showInput = op !== 'intro' && op !== 'build'

  return (
    <div className="card">
      <h3>Trie 自动补全 <span className="hint">前缀树走查 + 收集子树 + 按热度 Top-K</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn hot">{op === 'intro' ? '看结构' : op === 'build' ? '建树' : op === 'walk' ? `走到 "${walked}"` : op === 'collect' ? '收集' : op === 'rank' ? '排序' : `前缀 ${prefix}`}</span><span className="scdl">本步</span></div>
          <div className="scdk"><span className="scdn">{candidates.length ? `${candidates.length} 个候选` : '—'}</span><span className="scdl">子树里的词</span></div>
          <div className="scdk"><span className={`scdn ${done ? 'ok' : ''}`}>{suggestions.length ? suggestions.map(s => s[0]).join(' ') : '—'}</span><span className="scdl">Top-K 建议</span></div>
        </div>

        {/* 搜索框 */}
        {showInput && (
          <div className="tr-search">
            🔎 <span className="tr-typed">{prefix}</span><span className="tr-caret" />
            {done && <span className="tr-drop">
              {suggestions.map(([w, f], i) => <span key={w} className="tr-sug"><b>{w}</b><i>热度 {f}</i>{i === 0 && <em>最热</em>}</span>)}
            </span>}
          </div>
        )}

        {/* Trie 缩进树 */}
        <div className="tr-tree">
          {nodes.map(n => (
            <div key={n.id} className={`tr-node ${n.onPath ? 'path' : ''} ${n.isMatch && n.word ? 'match' : ''}`} style={{ paddingLeft: `${n.depth * 22 + 8}px` }}>
              <span className="tr-ch">{n.ch}</span>
              {n.word && <span className="tr-word">✓ {n.word} <i>热度{n.freq}</i></span>}
            </div>
          ))}
        </div>

        {candidates.length > 0 && !done && (
          <div className="tr-collect">前缀 "{walked}" 子树里的词：{candidates.map(([w, f]) => <span key={w} className="tr-cand">{w}<i>{f}</i></span>)}</div>
        )}

        {done
          ? <p className="scnote"><b>Trie 自动补全 = 走到前缀节点（O(前缀长度)）+ DFS 收集子树词 + 按热度排 Top-K</b>。面试讲：为什么用 Trie（前缀查询快、公共前缀省空间）而不是遍历词表 O(N)、大词表怎么优化（每个节点预存该子树 Top-K，查询就不用每次 DFS）、还能扩模糊匹配/拼写纠错（编辑距离）。搜索框、IDE 补全、输入法都用它。</p>
          : <p className="scnote" style={{ opacity: .85 }}>{state.focus}。看缩进树：这就是 Trie，公共前缀共享节点、✓ 标记完整词。补全时沿前缀路径（绿色）走到底，再把它子树里所有的词收集起来、按热度排序。</p>}
      </div>
    </div>
  )
}
