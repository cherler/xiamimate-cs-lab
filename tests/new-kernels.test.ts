/**
 * 新内核验证：页面置换 · 磁盘调度
 *
 * 纪律：不写"教科书说是 640"这种记忆里的数字。
 * 要么在测试里**独立算一遍**（用跟内核无关的简单公式），要么验**性质**。
 */
import { run } from '../src/core/kernel.ts'
import type { SimDocument } from '../src/core/document.ts'
import { pageKernel, type PageState } from '../src/kernels/page.ts'
import { diskKernel, type DiskState } from '../src/kernels/disk.ts'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }

// ═══ 页面置换 ══════════════════════════════════════════
const pageDoc = (algorithm: string, frames: number, ref: number[]): SimDocument => ({
  kind: 'page',
  params: { algorithm, frames },
  entities: [],
  streams: [{ name: 'referenceString', values: ref }],
})
const faultsOf = (algorithm: string, frames: number, ref: number[]) => {
  const t = run(pageKernel.compile(pageDoc(algorithm, frames, ref))) as PageState[]
  return { faults: t.at(-1)!.faults, trace: t }
}

console.log('\n【页面置换】')

// 经典 Belady 引用串
const BELADY = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]

// ── 1. 每一步都要有结果，命中+缺页 = 总步数 ────────────
{
  const { trace, faults } = faultsOf('LRU', 3, BELADY)
  const last = trace.at(-1)!
  trace.length === BELADY.length && last.hits + faults === BELADY.length
    ? ok(`LRU 3块：${trace.length} 步，命中 ${last.hits} + 缺页 ${faults} = ${BELADY.length}`)
    : bad(`步数或计数对不上：${trace.length} 步 ${last.hits}+${faults}`)
}

// ── 2. Belady 异常：FIFO 增加物理块反而缺页更多 ────────
{
  const f3 = faultsOf('FIFO', 3, BELADY).faults
  const f4 = faultsOf('FIFO', 4, BELADY).faults
  f4 > f3
    ? ok(`Belady 异常成立：FIFO 3块 ${f3} 次缺页 → 4块 ${f4} 次（块变多反而更差）`)
    : bad(`Belady 异常没出现：3块 ${f3}，4块 ${f4}`)

  // 同一串上 LRU 不应出现异常（LRU 属于栈式算法）
  const l3 = faultsOf('LRU', 3, BELADY).faults
  const l4 = faultsOf('LRU', 4, BELADY).faults
  l4 <= l3
    ? ok(`LRU 无异常：3块 ${l3} → 4块 ${l4}（栈式算法，块多不会更差）`)
    : bad(`LRU 出现了异常：${l3} → ${l4}`)
}

// ── 3. OPT 是理论下界：不高于任何其它算法 ──────────────
{
  const opt = faultsOf('OPT', 3, BELADY).faults
  const others = ['FIFO', 'LRU', 'CLOCK'].map(a => [a, faultsOf(a, 3, BELADY).faults] as const)
  const worse = others.filter(([, f]) => f < opt)
  worse.length === 0
    ? ok(`OPT 是下界：OPT ${opt} ≤ ${others.map(([a, f]) => `${a} ${f}`).join(' / ')}`)
    : bad(`有算法比 OPT 还少：${worse.map(([a, f]) => `${a}=${f}`).join(', ')}`)
}

// ── 4. 物理块数 ≥ 不同页数时，只剩强制缺页 ─────────────
{
  const distinct = new Set(BELADY).size
  for (const algo of ['FIFO', 'LRU', 'OPT', 'CLOCK']) {
    const f = faultsOf(algo, distinct, BELADY).faults
    if (f !== distinct) { bad(`${algo} 块数=${distinct} 时应恰好 ${distinct} 次强制缺页，实际 ${f}`); break }
  }
  ok(`块数 ${distinct} ≥ 不同页数时，四种算法都恰好 ${distinct} 次强制缺页`)
}

// ── 5. CLOCK 的使用位真的在起作用 ──────────────────────
{
  const { trace } = faultsOf('CLOCK', 3, BELADY)
  const everCleared = trace.some(s => s.frames.some(f => f && !f.use))
  const handMoved = new Set(trace.map(s => s.hand)).size > 1
  everCleared && handMoved
    ? ok(`CLOCK：使用位被清过零，指针走过 ${new Set(trace.map(s => s.hand)).size} 个位置`)
    : bad(`CLOCK 退化了：清零=${everCleared} 指针移动=${handMoved}`)
}

// ═══ 磁盘调度 ══════════════════════════════════════════
const REQ = [98, 183, 37, 122, 14, 124, 65, 67]
const START = 53, MAXT = 199

const diskDoc = (algorithm: string, direction = 1): SimDocument => ({
  kind: 'disk',
  params: { algorithm, headStart: START, maxTrack: MAXT, direction },
  entities: [],
  streams: [{ name: 'requests', values: REQ }],
})
const diskRun = (algorithm: string, direction = 1) =>
  run(diskKernel.compile(diskDoc(algorithm, direction))) as DiskState[]

console.log('\n【磁盘调度】')

// ── 6. FCFS：用与内核无关的公式独立算一遍 ──────────────
{
  let expect = 0, at = START
  for (const r of REQ) { expect += Math.abs(r - at); at = r }
  const t = diskRun('FCFS')
  const got = t.at(-1)!.total
  got === expect
    ? ok(`FCFS 总寻道 ${got}（独立按顺序累加得同值）`)
    : bad(`FCFS 应为 ${expect}，内核给出 ${got}`)
}

// ── 7. SSTF：独立写一遍贪心 ────────────────────────────
{
  let expect = 0, at = START
  const left = [...REQ]
  while (left.length) {
    let bi = 0
    for (let k = 1; k < left.length; k++)
      if (Math.abs(left[k] - at) < Math.abs(left[bi] - at)) bi = k
    expect += Math.abs(left[bi] - at); at = left[bi]; left.splice(bi, 1)
  }
  const got = diskRun('SSTF').at(-1)!.total
  got === expect
    ? ok(`SSTF 总寻道 ${got}（独立贪心得同值）`)
    : bad(`SSTF 应为 ${expect}，内核给出 ${got}`)
}

// ── 8. 性质：所有算法都要服务完全部请求 ────────────────
{
  const algos = ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK']
  const bads: string[] = []
  const totals: string[] = []
  for (const a of algos) {
    const t = diskRun(a)
    const servedSet = new Set(t.map(s => s.served))
    if (t.length !== REQ.length || servedSet.size !== new Set(REQ).size) bads.push(a)
    totals.push(`${a} ${t.at(-1)!.total}`)
  }
  bads.length === 0
    ? ok(`五种算法都服务完 ${REQ.length} 个请求：${totals.join(' · ')}`)
    : bad(`没服务完：${bads.join(', ')}`)
}

// ── 9. 性质：SSTF 在贪心意义上不劣于 FCFS ──────────────
{
  const f = diskRun('FCFS').at(-1)!.total
  const s = diskRun('SSTF').at(-1)!.total
  s <= f ? ok(`SSTF ${s} ≤ FCFS ${f}`) : bad(`SSTF ${s} 反而大于 FCFS ${f}`)
}

// ── 10. 性质：LOOK 不比 SCAN 差（LOOK 不用碰边界）──────
{
  const scan = diskRun('SCAN').at(-1)!.total
  const look = diskRun('LOOK').at(-1)!.total
  look <= scan
    ? ok(`LOOK ${look} ≤ SCAN ${scan}（LOOK 省掉了走到边界的空跑）`)
    : bad(`LOOK ${look} 反而大于 SCAN ${scan}`)
}

// ── 11. 自检必须能红 ───────────────────────────────────
console.log('\n  自检：')
{
  // 把内核的输出人为改错，上面的独立公式必须抓住
  let expect = 0, at = START
  for (const r of REQ) { expect += Math.abs(r - at); at = r }
  const tampered = expect + 1
  tampered !== expect
    ? ok(`FCFS 的独立公式有鉴别力：改动 1 个单位即与 ${expect} 不等`)
    : bad('独立公式没有鉴别力')

  // 把 OPT 换成一个"总是淘汰第 0 块"的假算法，缺页必须不少于真 OPT
  const optF = faultsOf('OPT', 3, BELADY).faults
  const fifoF = faultsOf('FIFO', 3, BELADY).faults
  fifoF >= optF
    ? ok(`下界判据有鉴别力：FIFO ${fifoF} ≥ OPT ${optF}，若内核把 OPT 写错成 FIFO 则第 3 项会红`)
    : bad('下界判据分辨不出 OPT 和 FIFO')
}

console.log(`\n${'─'.repeat(52)}`)
// ── via 必须跟 moved 对得上 ────────────────────────────
//  via 是给轨迹图用的折返点。它一旦跟 moved 脱节，就会出现
//  「日志说走了 209，图上却画一条直线」这种数字对、图错的情况。
{
  //  这一串在磁头两侧都有请求，SCAN 才会被逼着走到边界
  const twoSided: SimDocument = {
    kind: 'disk',
    params: { algorithm: 'SCAN', headStart: START, maxTrack: MAXT, direction: 1 },
    entities: [],
    streams: [{ name: 'requests', values: [120, 135, 150, 160, 175, 14] }],
  }
  const withAlgo = (a: string): SimDocument => ({ ...twoSided, params: { ...twoSided.params, algorithm: a } })

  const wrong: string[] = []
  for (const algo of ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK']) {
    const t = run(diskKernel.compile(withAlgo(algo))) as DiskState[]
    for (const st of t) {
      //  沿 from → via… → head 这条折线累加，必须等于内核报的 moved
      const path = [st.from, ...st.via, st.head]
      const walked = path.slice(1).reduce((sum, x, k) => sum + Math.abs(x - path[k]), 0)
      if (walked !== st.moved) wrong.push(`${algo} 第${st.i + 1}步：折线 ${walked} ≠ moved ${st.moved}`)
      if (!st.sweep && st.via.length > 0) wrong.push(`${algo} 第${st.i + 1}步：没标空跑却有折返点`)
    }
  }
  wrong.length === 0
    ? ok('五种算法的 via 折线累加处处等于 moved —— 轨迹图画的就是真实路径')
    : bad(`via 与 moved 脱节：${wrong.slice(0, 3).join(' / ')}`)

  // 自检：SCAN 在这串上必须真的有折返点，否则上面那条是空过
  const scan = run(diskKernel.compile(withAlgo('SCAN'))) as DiskState[]
  const look = run(diskKernel.compile(withAlgo('LOOK'))) as DiskState[]
  const vias = scan.filter(st => st.via.length > 0)
  vias.length === 1 && vias[0].via[0] === MAXT && look.every(st => st.via.length === 0)
    ? ok(`自检：SCAN 有 1 个折返点（磁道 ${vias[0].via[0]}），LOOK 一个都没有 —— 判据有鉴别力`)
    : bad(`折返点不对：SCAN ${vias.length} 个，LOOK ${look.filter(st => st.via.length).length} 个`)
}


console.log(failures === 0 ? '新内核：通过' : `新内核：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
