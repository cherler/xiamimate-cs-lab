/**
 * 内核：Raft 共识 · 选主 + 日志复制（分布式系统 · 后端/基础架构面试核心）
 * 轴：step —— 3 个节点从一次选举到一条日志复制到多数派并提交
 *
 * 分布式系统里多台机器要对「谁是主、日志长什么样」达成一致,又不能有单点——Raft 是最主流的答案。
 * 两件事:
 *   ① 选主(leader election):节点默认是 Follower;选举超时后变 Candidate,任期(term)+1、给自己投一票、
 *      向别人拉票;**拿到多数票(过半)**就当选 Leader。任期号保证「一个任期最多一个 Leader」。
 *   ② 日志复制(log replication):客户端命令只发给 Leader;Leader 追加到自己日志,再 AppendEntries 复制给
 *      Follower;**一旦复制到多数派**,这条日志就**提交(committed)**,可以安全地应用到状态机。
 *
 * 招牌时刻:本例 3 节点、多数派=2。N1 超时→拿到 N1+N2 两票当选;客户端命令复制到 N1+N2 两份即提交。
 * 「过半」是 Raft 的灵魂:任何两个多数派必有交集,于是不会选出两个主、不会提交冲突的日志。
 *
 * 值全部可核:每个节点的角色/任期/日志、候选人票数、提交位置都在状态里。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Role = 'follower' | 'candidate' | 'leader'
type Entry = { term: number; cmd: string }
type Node = { id: number; role: Role; term: number; votedFor: number; log: Entry[] }

export type RaftState = {
  i: number
  step: number
  nodes: Node[]
  term: number              // 当前任期
  candidate: number         // 本轮候选人 id（-1 = 无）
  votes: number             // 候选人已得票数
  majority: number          // 多数派门槛
  committed: number         // 已提交的日志条数（提交位置）
  cur: number               // 本步动作节点（0 = 无，-1 = 客户端）
  op: string                // timeout|requestVote|grantVote|becomeLeader|clientCmd|append|done
  msg: string               // 本步 RPC / 事件说明
  phase: 'run' | 'done'
  log: string
}

export const RAFT_VISIBLE = [
  'step', 'nodes', 'term', 'candidate', 'votes', 'majority', 'committed', 'cur', 'op', 'msg', 'phase', 'log',
] as const

type Frame = Omit<RaftState, 'i'>

type Op =
  | { k: 'timeout'; n: number }
  | { k: 'requestVote'; n: number }
  | { k: 'grantVote'; n: number; to: number }
  | { k: 'becomeLeader'; n: number }
  | { k: 'clientCmd'; cmd: string }
  | { k: 'append'; n: number }
const SCHEDULE: Op[] = [
  { k: 'timeout', n: 1 },
  { k: 'requestVote', n: 1 },
  { k: 'grantVote', n: 2, to: 1 },
  { k: 'becomeLeader', n: 1 },
  { k: 'clientCmd', cmd: 'x=5' },
  { k: 'append', n: 2 },
  { k: 'append', n: 3 },
]

const cloneN = (ns: Node[]) => ns.map(n => ({ ...n, log: n.log.map(e => ({ ...e })) }))

export const raftKernel: Kernel<RaftState> = {
  kind: 'raft',

  compile(_doc: SimDocument): CompiledModel<RaftState> {
    const N = 3
    const majority = Math.floor(N / 2) + 1   // = 2
    const frames: Frame[] = []
    const nodes: Node[] = Array.from({ length: N }, (_, k) => ({
      id: k + 1, role: 'follower' as Role, term: 0, votedFor: -1, log: [] as Entry[],
    }))
    const G = (id: number) => nodes.find(n => n.id === id)!
    let term = 0, candidate = -1, votes = 0, committed = 0

    // 已复制某条目的节点数（按 leader 日志长度 = 1 的那条算）
    const replicaCount = () => nodes.filter(n => n.log.length >= 1).length

    for (const op of SCHEDULE) {
      let cur = 0, opk = op.k, msg = '', log = ''
      if (op.k === 'timeout') {
        cur = op.n
        term += 1
        const c = G(op.n)
        c.role = 'candidate'; c.term = term; c.votedFor = op.n
        candidate = op.n; votes = 1
        msg = `选举超时`
        log = `N${op.n} 选举超时 → 变 **Candidate**,任期 term=${term},先**给自己投一票**(${votes}/${majority})。`
      } else if (op.k === 'requestVote') {
        cur = op.n
        msg = `RequestVote(term ${term}) → 其它节点`
        log = `N${op.n} 向其它节点广播 **RequestVote**(term ${term}):「我要当 term ${term} 的主,投我。」`
      } else if (op.k === 'grantVote') {
        cur = op.n
        const v = G(op.n)
        v.term = term; v.votedFor = op.to
        votes += 1
        msg = `N${op.n} 投给 N${op.to}`
        log = `N${op.n} 把 term ${term} 的票投给 N${op.to}(它本任期还没投过)。N${op.to} 现在 **${votes}/${majority}** 票` +
          (votes >= majority ? `——**已过半!**` : `。`)
      } else if (op.k === 'becomeLeader') {
        cur = op.n
        const l = G(op.n)
        l.role = 'leader'
        nodes.forEach(n => { if (n.id !== op.n && n.role === 'candidate') n.role = 'follower' })
        msg = `当选 Leader`
        log = `N${op.n} 拿到多数票(${votes}/${majority}) → 当选 **Leader**(term ${term})。从此只有它接客户端写、并向大家复制日志。`
      } else if (op.k === 'clientCmd') {
        cur = -1
        const leader = nodes.find(n => n.role === 'leader')!
        leader.log.push({ term, cmd: op.cmd })
        msg = `客户端 → Leader`
        log = `客户端把命令「${op.cmd}」发给 Leader N${leader.id} → 它**追加到自己日志**(第 1 条,term ${term}),但还**没提交**(只有它一份)。`
      } else {
        cur = op.n
        const leader = nodes.find(n => n.role === 'leader')!
        const f = G(op.n)
        f.log = leader.log.map(e => ({ ...e }))
        const reps = replicaCount()
        msg = `AppendEntries → N${op.n}`
        if (committed < 1 && reps >= majority) {
          committed = 1
          log = `Leader 把日志 AppendEntries 复制给 N${op.n} → 已在 **${reps}/${majority}** 个节点上(过半!)→ 这条日志**提交(committed)**,可以安全应用到状态机了。`
        } else {
          log = `Leader 把日志复制给 N${op.n}(第 ${reps} 份)${committed >= 1 ? '——这条早已提交,N' + op.n + ' 只是追平。' : '。'}`
        }
      }
      frames.push({
        step: frames.length, nodes: cloneN(nodes), term, candidate, votes, majority, committed,
        cur, op: opk, msg, phase: 'run', log,
      })
    }

    const lf = frames[frames.length - 1]!
    frames.push({
      ...lf, nodes: cloneN(nodes), cur: 0, op: 'done', msg: '', phase: 'done',
      log: `**招牌时刻**：N1 靠**过半票**当选 Leader(term ${term})、一条日志复制到**多数派**即提交。Raft 的灵魂是「过半」——任何两个多数派必有交集,于是永远不会有两个主、不会提交冲突的日志。这就是 etcd、Consul、TiKV 底下那台共识机。`,
    })

    const base0: Frame = {
      step: -1, nodes: cloneN(nodes.map(n => ({ ...n, role: 'follower' as Role, term: 0, votedFor: -1, log: [] }))),
      term: 0, candidate: -1, votes: 0, majority, committed: 0, cur: 0, op: '', msg: '', phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '共识步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 }
      },
    }
  },
}
