/**
 * 内核：短链系统 · 发号器 + Base62 真仿真 —— 长 URL 怎么变成唯一短码，短码怎么跳回长 URL（后端 · 系统设计）
 * 轴：step —— 发号器给自增 ID → Base62 编码成短码 → 存映射；访问时短码解码回 ID → 查库 → 302 跳转
 *
 * 短链的核心机制不是"画几个框",而是一个具体算法:**怎么生成又短又唯一的码**。
 * 做法:一个**全局发号器**发单调自增的 ID(天然唯一、不碰撞),再把 ID 用 **Base62**(0-9a-zA-Z 共 62 个字符)编码成短字符串。
 * Base62 比十进制短得多:1 亿(十进制 9 位)编码成 "6LAze"(5 位);6 位 Base62 = 62^6 ≈ 568 亿个码,够用很久。
 * 访问短码时反过来:Base62 解码回 ID → 查映射表拿长 URL → 返回 302 跳转。
 * 本仿真真发号、真编码/解码(可逐位手核),三条长 URL 走一遍,再演示一次跳转和容量估算。
 * 为什么不用哈希(会碰撞、要处理冲突)、不用 URL 自增明文(能被爬虫顺号遍历),讲解卡里说清。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

const B62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const enc = (n: number): string => { if (n === 0) return '0'; let s = ''; let x = n; while (x > 0) { s = B62[x % 62]! + s; x = Math.floor(x / 62) } return s }
const dec = (code: string): number => [...code].reduce((a, c) => a * 62 + B62.indexOf(c), 0)

export type UrlEntry = { longUrl: string; id: number; code: string }
export type UrlState = {
  i: number
  step: number
  phase: 'intro' | 'issue' | 'redirect' | 'capacity' | 'done'
  op: 'intro' | 'issue' | 'redirect' | 'capacity' | 'summary'
  counter: number                                              // 发号器：下一个要发的号
  entries: UrlEntry[]                                          // 已建映射（累积）
  cur: number                                                 // 本步在操作的映射下标（-1）
  lookup: { code: string; id: number; longUrl: string } | null // 跳转步的解码结果
  codeLen: number                                             // 容量演示：短码位数
  capacity: number                                            // 62^codeLen
  focus: string
  log: string
}
type Frame = Omit<UrlState, 'i'>

const START = 100000000                                        // 发号器起始号（1 亿，模拟已发过一些）
const URLS = [
  'https://xiamimate.com/reports/2026/q3-amazon-earbuds-market-insight',
  'https://example.com/promo?utm_source=weibo&utm_campaign=summer&ref=banner',
  'https://docs.google.com/spreadsheets/d/1AbC_dEfGhIjKlMnOpQr/edit#gid=0',
]

export const urlshortenerKernel: Kernel<UrlState> = {
  kind: 'urlshortener',
  compile(_doc: SimDocument): CompiledModel<UrlState> {
    const frames: Frame[] = []
    const snap = (e: UrlEntry[]): UrlEntry[] => e.map(x => ({ ...x }))
    const push = (f: Omit<Frame, 'step'>) => frames.push({ step: frames.length, ...f })

    // —— 开场 ——
    push({
      phase: 'intro', op: 'intro', counter: START, entries: [], cur: -1, lookup: null, codeLen: 6, capacity: 62 ** 6,
      focus: '短链核心=怎么生成又短又唯一的码：发号器给自增 ID + Base62 编码',
      log: `**短链系统：短码怎么来**\n核心机制不是画框，是一个具体算法：**怎么生成又短又唯一的码**。\n做法：一个**全局发号器**发单调自增 ID（天然唯一、不碰撞），再把 ID 用 **Base62**（\`0-9a-zA-Z\` 共 62 个字符）编码成短字符串。\n发号器从 **${START.toLocaleString()}** 开始。看三条长 URL 怎么各拿一个短码。`,
    })

    // —— 第一幕：发号 + Base62 编码，累积映射 ——
    let counter = START
    const entries: UrlEntry[] = []
    URLS.forEach((longUrl, idx) => {
      const id = counter; counter += 1                 // 发号器：真发一个自增号
      const code = enc(id)                             // 真 Base62 编码
      entries.push({ longUrl, id, code })
      let log: string
      if (idx === 0) {
        // 第一条：展开 Base62 逐位编码，能手核
        let x = id; const rows: string[] = []
        while (x > 0) { rows.push(`${x} % 62 = ${x % 62} → '${B62[x % 62]}'，${x} ÷ 62 = ${Math.floor(x / 62)}`); x = Math.floor(x / 62) }
        log = `**URL #1 → 发号 ${id.toLocaleString()} → Base62 编码**\n发号器发出自增 ID **${id.toLocaleString()}**，再 Base62 编码（不断取余 62、映射到字符、商继续，最后倒序）：\n${rows.map(r => '· ' + r).join('\n')}\n倒序拼起来 → 短码 **${code}**。\n注意：十进制 ${String(id).length} 位数，Base62 只要 **${code.length}** 位 —— 这就是用 62 进制的意义（越多字符、每位信息量越大、码越短）。`
      } else {
        log = `**URL #${idx + 1} → 发号 ${id.toLocaleString()} → 短码 ${code}**\n下一个自增 ID **${id.toLocaleString()}** → Base62 → **${code}**。\n发号器保证唯一，所以短码一定不重复；ID 连续，短码也接近连续（${entries[idx - 1]!.code} → ${code}）。存进映射表 \`${code} → 长URL\`。`
      }
      push({ phase: 'issue', op: 'issue', counter, entries: snap(entries), cur: idx, lookup: null, codeLen: 6, capacity: 62 ** 6, focus: `发号 ${id.toLocaleString()} → Base62 → 短码 ${code}`, log })
    })

    // —— 第二幕：访问短码 → 解码 → 查库 → 302 ——
    const target = entries[0]!
    const decodedId = dec(target.code)
    push({
      phase: 'redirect', op: 'redirect', counter, entries: snap(entries), cur: 0,
      lookup: { code: target.code, id: decodedId, longUrl: target.longUrl }, codeLen: 6, capacity: 62 ** 6,
      focus: `访问 /${target.code} → 解码回 ${decodedId.toLocaleString()} → 查库 → 302 跳转`,
      log: `**访问 \`短链域名/${target.code}\` → 跳转**\n反过来走：把短码 **${target.code}** Base62 **解码**回 ID = **${decodedId.toLocaleString()}**（${[...target.code].map(c => `'${c}'=${B62.indexOf(c)}`).join(', ')}，按 62 进制累加）—— 正好等于当初发的号，编码/解码是可逆的一对。\n拿 ID 查映射表 → 长 URL：\n\`${target.longUrl}\`\n返回 **302** 让浏览器跳过去。（用 302 而非 301：301 永久、浏览器会缓存、省服务器但**统计不到点击**；302 每次都回服务器、能统计，短链要看数据一般用 302。）`,
    })

    // —— 第三幕：容量估算 ——
    const cap6 = 62 ** 6
    push({
      phase: 'capacity', op: 'capacity', counter, entries: snap(entries), cur: -1, lookup: null, codeLen: 6, capacity: cap6,
      focus: `6 位 Base62 = 62^6 ≈ ${(cap6 / 1e8).toFixed(0)} 亿个短码`,
      log: `**容量：短码要几位够用？**\n每位 62 种取值，L 位就是 **62^L** 个码：\n· 6 位 = 62^6 = **${cap6.toLocaleString()}** ≈ **${(cap6 / 1e8).toFixed(0)} 亿**\n· 7 位 = 62^7 ≈ ${((62 ** 7) / 1e12).toFixed(1)} 万亿\n发号器从小号开始，码会随号增长而变长（6 位能撑到发到 568 亿号）。对比：同样表示 568 亿，十进制要 11 位、Base62 只要 6 位。`,
    })

    // —— 收尾 ——
    push({
      phase: 'done', op: 'summary', counter, entries: snap(entries), cur: -1, lookup: null, codeLen: 6, capacity: cap6,
      focus: '发号器保唯一 + Base62 保短 + 缓存扛读 + 302 可统计',
      log: `**小结：短链的机制**\n① **短码怎么来**：全局发号器发自增 ID（唯一、不碰撞）+ Base62 编码（短）。为什么不用**哈希**（如 MD5 取前几位）？会**碰撞**，得检测冲突再加盐重算，复杂；为什么不直接用**十进制自增明文**？能被爬虫**顺号遍历**你全站短链，且比 Base62 长。\n② **怎么跳转**：短码 Base62 解码回 ID → 查映射表 → 302（可统计点击）/301（永久省服务器但统计不到）。\n③ **怎么扛量**：短链是**读多写少**（约 100:1），热点码放缓存（Redis）扛读；映射表量大就按 code 分片。\n④ **发号器怎么做**：单点自增是瓶颈，实际用号段(一次取一批号发)/雪花算法/Redis INCR 做分布式发号。\n面试讲清这四点，就答到了短链设计的核心。`,
    })

    const base0: Frame = { phase: 'intro', op: 'intro', step: -1, counter: START, entries: [], cur: -1, lookup: null, codeLen: 6, capacity: 62 ** 6, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '设计步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
