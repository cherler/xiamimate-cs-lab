/**
 * 内核：Trie 自动补全 —— 前缀树存词，按前缀走查、收集子树、按频率排 Top-K（算法 · 项目实战 / 求职）
 * 轴：step —— 建 Trie → 输入前缀 → 沿树走到前缀节点 → DFS 收集所有补全 → 按热度排序返回
 *
 * 搜索框"输入几个字母就弹候选"就是这套。核心结构 **Trie(前缀树)**:每个节点是一个字符,
 * 从根到某节点的路径拼成一个前缀,单词在它的末尾节点上打标记(带热度/频率)。
 * 自动补全 = ① 沿 Trie 走到**前缀节点**(O(前缀长度),和词表大小无关);② 从该节点 DFS **收集子树里所有完整词**;
 *   ③ 按热度排序取 **Top-K** 作为候选。
 * 词表 cat/car/card/care/dog,输入前缀「car」→ 子树 car/card/care → 按频率排 care(4)/car(3)/card(2)。
 * 值:走查路径、收集到的词、排序都可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type TNode = { ch: string; kids: Record<string, TNode>; word: string | null; freq: number }
type FlatNode = { id: string; depth: number; ch: string; word: string | null; freq: number; onPath: boolean; isMatch: boolean }

const WORDS: [string, number][] = [['cat', 5], ['car', 3], ['card', 2], ['care', 4], ['dog', 6]]
const PREFIX = 'car'
const TOPK = 3

function buildTrie(): TNode {
  const root: TNode = { ch: '', kids: {}, word: null, freq: 0 }
  for (const [w, f] of WORDS) { let n = root; for (const c of w) { if (!n.kids[c]) n.kids[c] = { ch: c, kids: {}, word: null, freq: 0 }; n = n.kids[c]! } n.word = w; n.freq = f }
  return root
}
// 前序展平（root 不展示），按字母序
function flatten(root: TNode, pathSet: Set<string>, matchSet: Set<string>): FlatNode[] {
  const out: FlatNode[] = []
  const walk = (n: TNode, prefix: string, depth: number) => {
    for (const c of Object.keys(n.kids).sort()) {
      const kid = n.kids[c]!; const id = prefix + c
      out.push({ id, depth, ch: c, word: kid.word, freq: kid.freq, onPath: pathSet.has(id), isMatch: matchSet.has(id) })
      walk(kid, id, depth + 1)
    }
  }
  walk(root, '', 0)
  return out
}

export type TrieState = {
  i: number
  step: number
  op: 'intro' | 'build' | 'input' | 'walk' | 'collect' | 'rank'
  prefix: string
  walked: string           // 已走过的前缀部分
  nodes: FlatNode[]
  candidates: [string, number][]
  suggestions: [string, number][]
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<TrieState, 'i'>

export const trieKernel: Kernel<TrieState> = {
  kind: 'trie',
  compile(_doc: SimDocument): CompiledModel<TrieState> {
    const root = buildTrie()
    // 前缀路径的节点 id 集合（c, ca, car）
    const pathIds = (upto: number) => { const s = new Set<string>(); for (let k = 1; k <= upto; k++) s.add(PREFIX.slice(0, k)); return s }
    // 收集前缀节点子树里的词
    let node = root; for (const c of PREFIX) node = node.kids[c]!
    const found: [string, number][] = []
    ;(function dfs(n: TNode) { if (n.word) found.push([n.word, n.freq]); for (const k of Object.keys(n.kids).sort()) dfs(n.kids[k]!) })(node)
    const matchIds = new Set(found.map(([w]) => w))  // 词本身就是它末尾节点的 id
    const ranked = [...found].sort((a, b) => b[1] - a[1])
    const suggestions = ranked.slice(0, TOPK)

    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step'>) => frames.push({ step: frames.length, ...f })
    const flat = (pathUpto: number, matched: boolean) => flatten(root, pathIds(pathUpto), matched ? matchIds : new Set())

    push({ op: 'intro', prefix: '', walked: '', nodes: flat(0, false), candidates: [], suggestions: [], phase: 'run', focus: 'Trie(前缀树)：每个节点一个字符，路径拼成前缀',
      log: `**Trie 自动补全**\n搜索框"打几个字母就弹候选"的原理。核心结构 **Trie(前缀树)**：每个节点是一个字符，根到某节点的路径拼成一个前缀，单词在末尾节点打标记(带热度)。\n词表：${WORDS.map(([w, f]) => `${w}(${f})`).join('、')}。看输入前缀「${PREFIX}」怎么补全。` })

    push({ op: 'build', prefix: '', walked: '', nodes: flat(0, false), candidates: [], suggestions: [], phase: 'run', focus: '把词表建成 Trie（共享公共前缀）',
      log: `**建 Trie**\n把每个词按字符插进树，**公共前缀共享节点**（cat/car/card/care 共享 c→a）。带 ✓ 的节点是一个完整词的结尾。\n这样按前缀查，只跟**前缀长度**有关、和词表多大无关。` })

    push({ op: 'input', prefix: PREFIX, walked: '', nodes: flat(0, false), candidates: [], suggestions: [], phase: 'run', focus: `用户输入前缀「${PREFIX}」`,
      log: `**输入前缀「${PREFIX}」**\n要补全所有以 ${PREFIX} 开头的词。第一步：沿 Trie 从根往下走这几个字符。` })

    for (let k = 1; k <= PREFIX.length; k++) {
      const c = PREFIX[k - 1]!
      push({ op: 'walk', prefix: PREFIX, walked: PREFIX.slice(0, k), nodes: flat(k, false), candidates: [], suggestions: [], phase: 'run', focus: `走查：'${c}' → 到 "${PREFIX.slice(0, k)}"`,
        log: `**走查 '${c}'**\n沿边 '${c}' 往下 → 到达前缀 "${PREFIX.slice(0, k)}" 的节点。${k === PREFIX.length ? '前缀走完，停在前缀节点。' : '继续走下一个字符。'}` })
    }

    push({ op: 'collect', prefix: PREFIX, walked: PREFIX, nodes: flat(PREFIX.length, true), candidates: found, suggestions: [], phase: 'run', focus: '从前缀节点 DFS，收集子树里所有完整词',
      log: `**收集补全**\n站在 "${PREFIX}" 节点，往下 **DFS 遍历子树**，把所有带 ✓ 的完整词收集起来：\n${found.map(([w, f]) => `${w}(${f})`).join('、')}。这些都是以 ${PREFIX} 开头的词。` })

    push({ op: 'rank', prefix: PREFIX, walked: PREFIX, nodes: flat(PREFIX.length, true), candidates: found, suggestions, phase: 'done', focus: `按热度排序，返回 Top-${TOPK} 建议`,
      log: `**排序 + 返回 Top-${TOPK}**\n把收集到的词按**热度(频率)降序**排：${ranked.map(([w, f]) => `${w}(${f})`).join(' > ')}，取前 ${TOPK} 个作候选下拉：**${suggestions.map(([w]) => w).join('、')}**。\n\n**小结**：Trie 自动补全 = 沿树走到前缀节点(O(前缀长度)) + DFS 收集子树词 + 按热度排 Top-K。面试讲这个项目：为什么用 Trie(前缀查询快、公共前缀省空间) vs 遍历词表(O(N))、大词表怎么办(每个节点预存该子树 Top-K，查询就不用每次 DFS)、还能扩模糊匹配/拼写纠错(编辑距离)。搜索框、IDE 补全、输入法都用它。`,
    })

    const base0: Frame = { op: 'intro', step: -1, prefix: '', walked: '', nodes: flat(0, false), candidates: [], suggestions: [], phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '补全步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
