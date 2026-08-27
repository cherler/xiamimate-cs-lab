/**
 * 内核：Merkle 树（密码学 · 完整性校验）
 * 轴：step —— 4 个数据块自底向上两两哈希，汇成一个根哈希
 *
 * 怎么用一个小指纹保证一大堆数据没被改？Merkle 树:每个数据块先算叶子哈希,相邻两个哈希拼起来
 * 再哈希成父节点,层层向上,最后汇成**一个根哈希(Merkle root)**。只要有任何一个块被改,
 * 它的叶子哈希变→父变→…→根变,根一对就知道数据动过。而且验证某个块只需 O(log n) 个兄弟哈希,
 * 不用下载全部数据。区块链、Git、IPFS、BitTorrent 的完整性校验全靠它。
 *
 * 本例 4 个块 [10,20,30,40],用玩具哈希 h(x)=(x·31+7) mod 97 演示。根哈希可核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const H = (x: number) => (x * 31 + 7) % 97
const Hpair = (l: number, r: number) => (l * 31 + r * 17 + 7) % 97

export type MerkleState = {
  i: number
  step: number
  data: number[]
  leaves: number[]       // 叶子哈希（-1 未算）
  parents: number[]      // 两个父节点
  root: number
  act: string            // 'leaf'|'parent'|'root'|'done'
  focus: number          // 当前算的节点下标
  phase: 'run' | 'done'
  log: string
}

export const MERKLE_VISIBLE = ['step', 'data', 'leaves', 'parents', 'root', 'act', 'focus', 'phase', 'log'] as const

type Frame = Omit<MerkleState, 'i'>
const DATA = [10, 20, 30, 40]

export const merkleKernel: Kernel<MerkleState> = {
  kind: 'merkle',
  compile(_doc: SimDocument): CompiledModel<MerkleState> {
    const frames: Frame[] = []
    const leaves = [-1, -1, -1, -1]
    const parents = [-1, -1]
    let root = -1
    const snap = (act: string, focus: number, log: string) => frames.push({
      step: frames.length, data: DATA, leaves: [...leaves], parents: [...parents], root, act, focus, phase: 'run', log,
    })
    for (let k = 0; k < 4; k++) {
      leaves[k] = H(DATA[k]!)
      snap('leaf', k, `叶子 L${k} = h(数据 ${DATA[k]}) = **${leaves[k]}**。`)
    }
    parents[0] = Hpair(leaves[0]!, leaves[1]!)
    snap('parent', 0, `父 P0 = h(L0 ∥ L1) = h(${leaves[0]} ∥ ${leaves[1]}) = **${parents[0]}**。`)
    parents[1] = Hpair(leaves[2]!, leaves[3]!)
    snap('parent', 1, `父 P1 = h(L2 ∥ L3) = h(${leaves[2]} ∥ ${leaves[3]}) = **${parents[1]}**。`)
    root = Hpair(parents[0]!, parents[1]!)
    snap('root', 0, `根 Root = h(P0 ∥ P1) = h(${parents[0]} ∥ ${parents[1]}) = **${root}**。`)
    frames.push({
      step: frames.length, data: DATA, leaves: [...leaves], parents: [...parents], root, act: 'done', focus: -1, phase: 'done',
      log: `**Merkle 树建好**：根哈希 = **${root}**。任何一个数据块被改,它的叶子→父→根都会变,根一对就露馅;而验证某个块只需 O(log n) 个兄弟哈希,不用下载全部。区块链、Git、IPFS 全靠它做完整性校验。`,
    })
    const base0: Frame = { step: -1, data: DATA, leaves: [-1, -1, -1, -1], parents: [-1, -1], root: -1, act: '', focus: -1, phase: 'run', log: '' }
    return {
      axis: { kind: 'step', label: '节点' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
