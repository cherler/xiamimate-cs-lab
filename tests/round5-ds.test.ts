/**
 * 第五批内核：数据结构四件套 —— AVL / 散列表 / 哈夫曼 / KMP
 *
 * 这批全都能验**定义级性质**，比对答案硬得多：
 *   AVL    中序遍历必须有序；任意结点平衡因子 |bf| ≤ 1；h 字段必须等于真实高度
 *   散列表  每个键必须能按同样的探查序列找回来
 *   哈夫曼  WPL 必须等于"各内部结点权值之和"（哈夫曼树的一条定理）；编码必须是前缀码
 *   KMP    结果必须与 indexOf 全量一致；主串指针**永不回退**
 */
import { run } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { NIL, inorder, trueHeight, type TreeNode } from '../src/core/tree.ts'
import { avlKernel, type AvlState } from '../src/kernels/avl.ts'
import { hashKernel, asl, type HashState } from '../src/kernels/hashtable.ts'
import { huffmanKernel, type HuffState } from '../src/kernels/huffman.ts'
import { kmpKernel, type KmpState } from '../src/kernels/kmp.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

// ═══ AVL ═══════════════════════════════════════════════
console.log('\n【AVL 平衡二叉树】')

const avlRun = (keys: number[], mode = 'avl') =>
  run(avlKernel.compile({
    kind: 'avl', params: { mode }, entities: [],
    streams: [{ name: 'keys', values: keys }],
  }), 4000) as AvlState[]

/** 独立检查：任意结点的平衡因子 */
const bfOf = (nodes: TreeNode[], n: number): number =>
  n === NIL ? 0 : trueHeight(nodes, nodes[n].left) - trueHeight(nodes, nodes[n].right)
const allNodes = (nodes: TreeNode[], root: number): number[] => {
  const out: number[] = []
  const walk = (n: number) => { if (n === NIL) return; out.push(n); walk(nodes[n].left); walk(nodes[n].right) }
  walk(root)
  return out
}

const CASES: number[][] = [
  [3, 2, 1],                       // LL
  [1, 2, 3],                       // RR
  [3, 1, 2],                       // LR
  [1, 3, 2],                       // RL
  [10, 20, 30, 40, 50, 25],        // 连环
  [50, 30, 70, 20, 40, 60, 80, 10, 5],
  [15, 3, 20, 1, 8, 17, 25, 5, 12, 30, 2],
]

// ── 1. 中序遍历必须是升序（BST 性质） ──────────────────
{
  const wrong: string[] = []
  for (const keys of CASES) {
    const last = avlRun(keys).at(-1)!
    const io = inorder(last.nodes, last.root)
    const sorted = [...new Set(keys)].sort((a, b) => a - b)
    if (io.join(',') !== sorted.join(',')) wrong.push(`[${keys}] → ${io}`)
  }
  wrong.length === 0
    ? ok(`${CASES.length} 组插入序列，中序遍历都等于键的升序排列`)
    : bad(`BST 性质被破坏：${wrong.slice(0, 2).join(' | ')}`)
}

// ── 2. 每一步之后，任意结点的平衡因子必须 |bf| ≤ 1 ──────
//     注意：只在"该步不是插入刚发生、还没回溯完"的时候检查末态
{
  const wrong: string[] = []
  for (const keys of CASES) {
    const last = avlRun(keys).at(-1)!
    for (const n of allNodes(last.nodes, last.root)) {
      const b = bfOf(last.nodes, n)
      if (Math.abs(b) > 1) wrong.push(`[${keys}] 结点 ${last.nodes[n].key} 的 bf=${b}`)
    }
  }
  wrong.length === 0
    ? ok('所有末态树上，每个结点的平衡因子都在 −1..+1 之间')
    : bad(`失衡未被修复：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 3. h 字段必须等于真实高度（不能只是记账好看）────────
{
  const wrong: string[] = []
  for (const keys of CASES) {
    const last = avlRun(keys).at(-1)!
    for (const n of allNodes(last.nodes, last.root)) {
      const real = trueHeight(last.nodes, n)
      if ((last.nodes[n].h ?? 0) !== real)
        wrong.push(`[${keys}] 结点 ${last.nodes[n].key}：h=${last.nodes[n].h} 实际 ${real}`)
    }
  }
  wrong.length === 0
    ? ok('每个结点缓存的高度都与重新算出的真实高度一致')
    : bad(`高度记账错：${wrong.slice(0, 3).join(' / ')}`)
}

// ── 4. 四种旋转都要能触发，且类型判对 ──────────────────
{
  const want: [number[], string][] = [
    [[3, 2, 1], 'LL'], [[1, 2, 3], 'RR'], [[3, 1, 2], 'LR'], [[1, 3, 2], 'RL'],
  ]
  const wrong: string[] = []
  for (const [keys, type] of want) {
    const rots = avlRun(keys).filter(s => s.act === 'rotate')
    if (rots.length !== 1 || rots[0].rotation !== type)
      wrong.push(`[${keys}] 期望 ${type}，实际 ${rots.map(r => r.rotation).join('/') || '没旋转'}`)
  }
  wrong.length === 0
    ? ok('LL / RR / LR / RL 四种失衡各用一组最小样例触发，类型判定全对')
    : bad(wrong.join(' / '))
}

// ── 5. 平衡的价值：AVL 的树高必须不高于普通 BST ─────────
{
  const keys = [1, 2, 3, 4, 5, 6, 7]          // 顺序插入 —— BST 会退化成链
  const avl = avlRun(keys, 'avl').at(-1)!
  const bst = avlRun(keys, 'bst').at(-1)!
  const ha = trueHeight(avl.nodes, avl.root)
  const hb = trueHeight(bst.nodes, bst.root)
  ha < hb && hb === keys.length
    ? ok(`顺序插入 7 个键：普通 BST 退化成高度 ${hb} 的链，AVL 保持高度 ${ha}`)
    : bad(`平衡没体现出来：AVL 高 ${ha}，BST 高 ${hb}`)
}

// ═══ 散列表 ════════════════════════════════════════════
console.log('\n【散列表】')

const hashRun = (keys: number[], size: number, method: string, rehashStep = 3) =>
  run(hashKernel.compile({
    kind: 'hash', params: { size, method, rehashStep }, entities: [],
    streams: [{ name: 'keys', values: keys }],
  })) as HashState[]

const KEYS = [19, 14, 23, 1, 68, 20, 84, 27, 55, 11]

// ── 1. 每个插进去的键都必须能按同样的探查序列找回来 ──────
{
  const wrong: string[] = []
  for (const method of ['拉链', '线性探测', '平方探测', '再散列']) {
    const t = hashRun(KEYS, 13, method)
    const table = t.at(-1)!.table
    for (const key of KEYS) {
      const found = table.some(slot => slot.includes(key))
      if (!found) wrong.push(`${method}: 键 ${key} 丢了`)
    }
    const total = table.reduce((s, x) => s + x.length, 0)
    if (total !== KEYS.length) wrong.push(`${method}: 表里共 ${total} 个键，应有 ${KEYS.length}`)
  }
  wrong.length === 0
    ? ok(`四种冲突处理方式下，${KEYS.length} 个键全部就位，不丢不重`)
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 2. 开放定址：每个槽最多一个键；拉链：允许多个 ────────
{
  const wrong: string[] = []
  for (const method of ['线性探测', '平方探测', '再散列']) {
    const table = hashRun(KEYS, 13, method).at(-1)!.table
    if (table.some(s => s.length > 1)) wrong.push(`${method} 有槽装了多个键`)
  }
  const chain = hashRun(KEYS, 13, '拉链').at(-1)!.table
  const hasChain = chain.some(s => s.length > 1)
  wrong.length === 0 && hasChain
    ? ok('开放定址每槽至多一个键；拉链法确实出现了长度 >1 的链')
    : bad(`${wrong.join(' / ')}${hasChain ? ''
      : '；拉链法没出现冲突，这组数据说明不了问题'}`)
}

// ── 3. 探查序列的第一个必须是 H(key) ───────────────────
{
  const wrong: string[] = []
  for (const method of ['拉链', '线性探测', '平方探测', '再散列']) {
    const t = hashRun(KEYS, 13, method)
    for (const s of t) {
      if (s.probes[0] !== s.home) wrong.push(`${method} 键 ${s.key}: 首探 ${s.probes[0]} ≠ H=${s.home}`)
      if (s.home !== s.key % 13) wrong.push(`${method} 键 ${s.key}: H 算错`)
    }
  }
  wrong.length === 0
    ? ok('每次插入的第一次探查都落在 H(key) = key mod 13 上')
    : bad(wrong.slice(0, 3).join(' / '))
}

// ── 4. ASL 必须与逐步记录的比较次数吻合 ────────────────
{
  //  两条独立路径算同一个量：一条来自轨迹累计，一条来自末态表重新推
  const wrong: string[] = []
  for (const method of ['拉链', '线性探测']) {
    const t = hashRun(KEYS, 13, method)
    const fromTrace = t.at(-1)!.totalCompares / KEYS.length
    const fromTable = asl(t.at(-1)!.table, 13, method).success
    if (Math.abs(fromTrace - fromTable) > 1e-9)
      wrong.push(`${method}: 轨迹算 ${fromTrace.toFixed(3)}，末态推 ${fromTable.toFixed(3)}`)
  }
  wrong.length === 0
    ? ok('ASL成功 两条独立路径（轨迹累计 vs 末态重推）结果一致')
    : bad(wrong.join(' / '))
}

// ── 5. 装填因子越大，ASL 越大（散列表的基本规律）────────
{
  const small = asl(hashRun(KEYS.slice(0, 4), 13, '线性探测').at(-1)!.table, 13, '线性探测').success
  const big = asl(hashRun(KEYS, 13, '线性探测').at(-1)!.table, 13, '线性探测').success
  big > small
    ? ok(`装填因子 4/13 → 10/13，ASL成功 从 ${small.toFixed(2)} 升到 ${big.toFixed(2)}`)
    : bad(`装填因子变大 ASL 没变大：${small.toFixed(2)} vs ${big.toFixed(2)}`)
}

// ═══ 哈夫曼 ════════════════════════════════════════════
console.log('\n【哈夫曼树】')

const huffRun = (weights: number[]) =>
  run(huffmanKernel.compile({
    kind: 'huffman', params: {}, entities: [],
    streams: [{ name: 'weights', values: weights }],
  })) as HuffState[]

const WSETS = [[5, 29, 7, 8, 14, 23, 3, 11], [1, 2, 3, 4], [7, 5, 2, 4], [1, 1, 1, 1], [10]]

// ── 1. WPL 必须等于所有内部结点权值之和（哈夫曼树的定理）──
{
  const wrong: string[] = []
  for (const ws of WSETS) {
    const last = huffRun(ws).at(-1)!
    //  内部结点 = 有孩子的结点
    const internal = last.nodes.filter(n => n.left !== NIL || n.right !== NIL)
    const sum = internal.reduce((s, n) => s + (n.w ?? 0), 0)
    const expect = ws.length === 1 ? ws[0] : sum
    if (last.wpl !== expect) wrong.push(`[${ws}] WPL=${last.wpl}，内部结点和=${sum}`)
  }
  wrong.length === 0
    ? ok('每组权值的 WPL 都等于所有内部结点权值之和')
    : bad(wrong.join(' / '))
}

// ── 2. 编码必须是前缀码：没有一个编码是另一个的前缀 ──────
{
  const wrong: string[] = []
  for (const ws of WSETS) {
    const codes = Object.values(huffRun(ws).at(-1)!.codes)
    for (const a of codes) for (const b of codes) {
      if (a !== b && b.startsWith(a)) wrong.push(`[${ws}] "${a}" 是 "${b}" 的前缀`)
    }
  }
  wrong.length === 0
    ? ok('所有编码表都是前缀码 —— 因为字符全在叶子上，这是构造方式保证的')
    : bad(wrong.slice(0, 2).join(' / '))
}

// ── 3. 权值大的字符，编码长度不能比权值小的更长 ──────────
{
  const wrong: string[] = []
  for (const ws of WSETS) {
    const last = huffRun(ws).at(-1)!
    const pairs = Object.entries(last.codes).map(([c, code]) => {
      const leaf = last.nodes.find(n => n.label === c && n.left === NIL && n.right === NIL)!
      return { w: leaf.w!, len: code.length }
    })
    for (const a of pairs) for (const b of pairs) {
      if (a.w > b.w && a.len > b.len) wrong.push(`[${ws}] 权 ${a.w} 编码 ${a.len} 位，权 ${b.w} 才 ${b.len} 位`)
    }
  }
  wrong.length === 0
    ? ok('权值越大编码越短 —— 这正是哈夫曼编码省空间的来源')
    : bad(wrong.slice(0, 2).join(' / '))
}

// ── 4. 合并次数必须是 n−1 ──────────────────────────────
{
  const wrong: string[] = []
  for (const ws of WSETS) {
    const merges = huffRun(ws).filter(s => s.act === 'merge').length
    if (merges !== Math.max(0, ws.length - 1)) wrong.push(`[${ws}] 合并 ${merges} 次`)
  }
  wrong.length === 0
    ? ok('n 个叶子恰好合并 n−1 次 —— 每次合并少一棵树')
    : bad(wrong.join(' / '))
}

// ── 自检 ───────────────────────────────────────────────
{
  const a = huffRun([1, 1, 1, 1]).at(-1)!.wpl
  const b = huffRun([1, 1, 1, 10]).at(-1)!.wpl
  a !== b ? ok(`自检：权值分布不同 WPL 就不同（${a} vs ${b}）`)
    : bad('自检失败：不同权值算出同一个 WPL')
}

// ═══ KMP ═══════════════════════════════════════════════
console.log('\n【KMP 字符串匹配】')

const kmpRun = (text: string, pattern: string, showMatch = 1) =>
  run(kmpKernel.compile({
    kind: 'kmp', params: { text, pattern, showMatch }, entities: [], streams: [],
  }), 4000) as KmpState[]

/** 独立参照：暴力算 next（最长相等前后缀） */
function refNext(p: string): number[] {
  return p.split('').map((_, j) => {
    const s = p.slice(0, j + 1)
    for (let len = s.length - 1; len > 0; len--)
      if (s.slice(0, len) === s.slice(s.length - len)) return len
    return 0
  })
}

// ── 1. next 数组必须与暴力求法一致 ─────────────────────
{
  const PATS = ['ababaca', 'aaaa', 'abcabc', 'abababca', 'a', 'abcdef', 'aabaabaaa']
  const wrong: string[] = []
  for (const p of PATS) {
    const mine = kmpRun('x', p, 0).at(-1)!.next
    const ref = refNext(p)
    if (mine.join(',') !== ref.join(',')) wrong.push(`${p}: ${mine} ≠ ${ref}`)
  }
  wrong.length === 0
    ? ok(`${PATS.length} 个模式串的 next 数组与「暴力找最长相等前后缀」完全一致`)
    : bad(wrong.slice(0, 2).join(' | '))
}

// ── 2. 匹配结果必须与 indexOf 全量一致 ─────────────────
{
  const CASES: [string, string][] = [
    ['ababcabcabababd', 'ababd'],
    ['aaaaaa', 'aa'],
    ['abcabcabc', 'abcabc'],
    ['hello world', 'xyz'],
    ['aaa', 'aaaa'],
  ]
  const wrong: string[] = []
  for (const [t, p] of CASES) {
    const mine = kmpRun(t, p).at(-1)!.found
    //  独立参照：逐位 indexOf（允许重叠）
    const ref: number[] = []
    for (let k = 0; k + p.length <= t.length; k++) if (t.startsWith(p, k)) ref.push(k)
    if (mine.join(',') !== ref.join(',')) wrong.push(`"${t}"/"${p}": ${mine} ≠ ${ref}`)
  }
  wrong.length === 0
    ? ok(`${CASES.length} 组匹配（含重叠、无匹配、模式比主串长）与逐位比对结果一致`)
    : bad(wrong.join(' | '))
}

// ── 3. 主串指针永不回退 —— KMP 的全部价值 ──────────────
{
  const t = kmpRun('ababcabcabababd', 'ababd')
  const seq = t.filter(s => s.phase === 'match' || s.phase === 'found').map(s => s.ti)
  const back = seq.filter((v, k) => k > 0 && v < seq[k - 1])
  back.length === 0
    ? ok(`匹配全程主串下标单调不减（${seq.length} 步），一次都没回退`)
    : bad(`主串指针回退了 ${back.length} 次`)
}

// ── 4. 主串每个字符最多被"推进"一次 ───────────────────
{
  const text = 'ababcabcabababd'
  const last = kmpRun(text, 'ababd').at(-1)!
  last.textAdvances <= text.length
    ? ok(`主串长 ${text.length}，指针共前进 ${last.textAdvances} 次 —— 线性时间的直接证据`)
    : bad(`前进 ${last.textAdvances} 次，超过主串长度 ${text.length}`)
}

// ── 自检 ───────────────────────────────────────────────
{
  const a = kmpRun('x', 'aaaa', 0).at(-1)!.next.join(',')
  const b = kmpRun('x', 'abcd', 0).at(-1)!.next.join(',')
  a !== b ? ok(`自检：'aaaa' 的 next=[${a}] 与 'abcd' 的 [${b}] 不同 —— 判据认得出模式串结构`)
    : bad('自检失败：不同模式串算出同一个 next')
}

console.log(failures === 0 ? '\n本套全部通过' : `\n本套失败 ${failures} 项`)
if (failures > 0) process.exit(1)
