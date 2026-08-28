/**
 * 内核：缓冲池 midpoint-LRU —— MySQL InnoDB 怎么让全表扫描不冲掉热点页（后端 · 数据库系统）
 * 轴：step —— 一次全表扫描逐页装载，看新页进"中点"、热点区（young）毫发无损
 *
 * 普通 LRU 有个大坑:一次**全表扫描**会把海量只用一次的冷页塞到 LRU 头,把真正的热点页挤到尾部淘汰——
 *   扫描完缓存全是没用的冷页,热点全没了(**缓存污染**)。
 * MySQL InnoDB 的缓冲池用**改进版 LRU**:把 LRU 链表分成 **young(热,前 5/8) + old(冷,后 3/8)** 两段。
 *   · 新装载的页**不插链表头**,而是插到**中点(old 段头)**;
 *   · 只有当它在 old 段**再次被访问**(且过了很短的时间窗)才**升级到 young 头**。
 * 于是全表扫描的页:进 old、被用一次、从没升 young,很快从 old 尾淘汰——**young 里的热点毫发无损**。
 * 本例 young[A,B,C]+old[D,E],扫描装载 S1/S2/S3,全在 old 段打转,热点安然无恙。值:两段链表流转可手核。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type BufPoolState = {
  i: number
  step: number
  op: 'intro' | 'init' | 'scan' | 'done'
  young: string[]          // 热区（头在前）
  old: string[]            // 冷区（头=中点）
  loaded: string           // 本步装载的页
  evicted: string          // 本步从 old 尾淘汰的页
  scanned: string[]        // 已扫描装载的页
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<BufPoolState, 'i'>

const SCAN = ['S1', 'S2', 'S3']

export const bufferpoolKernel: Kernel<BufPoolState> = {
  kind: 'bufferpool',
  compile(_doc: SimDocument): CompiledModel<BufPoolState> {
    let young = ['A', 'B', 'C']
    let old = ['D', 'E']
    const scanned: string[] = []
    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step' | 'young' | 'old' | 'scanned'>) => frames.push({ step: frames.length, young: [...young], old: [...old], scanned: [...scanned], ...f })

    push({ op: 'intro', loaded: '', evicted: '', phase: 'run', focus: '普通 LRU 会被全表扫描冲掉热点；MySQL 用 midpoint 挡住',
      log: `**缓冲池 midpoint-LRU**\n普通 LRU 的坑：一次**全表扫描**会把海量只用一次的冷页塞到 LRU 头，把真正的热点页挤到尾部淘汰——扫描完热点全没了（**缓存污染**）。\nMySQL InnoDB 的招：LRU 链分成 **young(热) + old(冷)** 两段，新页**插中点(old 头)**、**再次访问才升 young**。看它怎么扛住扫描。` })

    push({ op: 'init', loaded: '', evicted: '', phase: 'run', focus: '初始：young=热点区，old=冷区，中间是"中点"',
      log: `**初始状态**\nyoung（热区）= [${young.join(', ')}]，old（冷区）= [${old.join(', ')}]。\n两段交界处就是"中点"——新装载的页从这里进（不是链表头）。现在来一次全表扫描。` })

    for (const p of SCAN) {
      old.unshift(p)                 // 插到中点（old 头）
      const evicted = old.pop()!     // old 尾淘汰
      scanned.push(p)
      push({ op: 'scan', loaded: p, evicted, phase: 'run', focus: `扫描装载 ${p} → 插中点(old 头)，淘汰 old 尾 ${evicted}`,
        log: `**扫描装载 ${p}**\n${p} 是扫描页、只用一次。它**插到中点**（old 段头，不碰 young）→ old=[${old.join(', ')}]，从 old 尾淘汰 **${evicted}**。\n注意：${p} 没升 young（没有第二次访问）。**young 还是 [${young.join(', ')}]，热点没动。**` })
    }

    push({ op: 'done', loaded: '', evicted: '', phase: 'done', focus: 'young 热点毫发无损，扫描只搅动了 old',
      log: `**扫描结束**\nyoung（热区）= [${young.join(', ')}] —— **和扫描前一模一样，热点全在！** 扫描的 ${SCAN.join('/')} 只在 old 段进出、各用一次、从没升 young，很快被淘汰。\n\n对比：**普通 LRU** 会把 S1/S2/S3 插到链表头，把 A/B/C 挤到尾部淘汰——扫描一次热点就没了。\n\n**要点**：midpoint 插入 + "二次访问才升 young" 让**一次性的扫描页进不了热区**，保护了真正被反复访问的热点。这就是 innodb_old_blocks_pct(old 段占比) 和 innodb_old_blocks_time(升 young 的时间窗) 两个参数背后的机制。面试讲：普通 LRU 的扫描污染、midpoint 怎么解、和 LRU-K/2Q 的思想相通。`,
    })

    const base0: Frame = { op: 'intro', step: -1, young: ['A', 'B', 'C'], old: ['D', 'E'], loaded: '', evicted: '', scanned: [], phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '装载步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
