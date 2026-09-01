/**
 * 内核：提示词组装 · 缓存友好排序 —— 每轮怎么拼 prompt，才能省 10 倍钱（大模型 · 项目实战 / Agent 工程八股）
 * 轴：step —— 把各段按 tools→system→messages 拼好、定缓存断点 → 第1轮写缓存 → 第2轮读缓存(0.1×) → 对比乱序如何毁掉缓存。
 *
 * Agent 每一步都要重拼 prompt。它不是"拼字符串"，关键是**排序要缓存友好**——这是省钱的算法核心：
 *   · **前缀缓存是"最长相同前缀"匹配**：缓存覆盖 `tools → system → messages`(就这顺序)到断点为止；**断点及之前任何一处变了，缓存全失效**、后面全部重算。
 *   · **缓存读只要 0.1× 基础价**(写 1.25×)——命中缓存＝省 90%。所以要**静态的排前面、动态的排后面**，把断点放在"逐轮都不变的最后一块"。
 *   · **经典翻车**：把每轮都变的东西(时间戳/运行时快照)塞进靠前的块 → 前缀每轮都不同 → 缓存永远不命中、每轮全价重算。
 * 本实验拼 6 段、算两轮成本，切「排序」看 静态优先 vs 乱序 差多少。缓存命中/成本全现算。和 KV 缓存、上下文压缩(保前缀)同源。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

type Ord = '静态优先' | '乱序'
type Tier = 'tools' | 'system' | 'messages'
export type Sec = { id: string; name: string; tier: Tier; dyn: boolean; tok: number; cached: boolean }
export type PBState = {
  i: number
  step: number
  stage: 'intro' | 'assemble' | 'turn1' | 'turn2' | 'done'
  ordering: Ord
  secs: Sec[]               // 已排序的段（cached=在稳定前缀里）
  prefixTok: number         // 可缓存前缀 tokens
  tailTok: number           // 动态尾部 tokens
  turn2Cached: number       // 第2轮：等效 = cached×0.1 + tail
  turn2Full: number         // 不用缓存的全价
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<PBState, 'i'>

const READ = 0.1   // 缓存读 = 0.1× 基础价（Anthropic prompt caching）
//  6 段（含各自 tier / 是否逐轮变 / tokens）。静态优先：动态的都排到最后。
function layout(ordering: Ord): Sec[] {
  if (ordering === '静态优先') {
    return [
      { id: 'tools', name: '工具 schema', tier: 'tools', dyn: false, tok: 40, cached: false },
      { id: 'sys', name: '系统身份 + 人设', tier: 'system', dyn: false, tok: 25, cached: false },
      { id: 'proj', name: '项目指令 CLAUDE.md', tier: 'system', dyn: false, tok: 20, cached: false },
      { id: 'rt', name: '运行时快照(沙箱/审批)', tier: 'messages', dyn: true, tok: 12, cached: false },
      { id: 'hist', name: '对话历史', tier: 'messages', dyn: true, tok: 60, cached: false },
      { id: 'msg', name: '本轮用户消息', tier: 'messages', dyn: true, tok: 15, cached: false },
    ]
  }
  //  乱序：把逐轮变的"运行时快照"塞进 system(靠前) → system 每轮都变 → 缓存从这里就断了
  return [
    { id: 'tools', name: '工具 schema', tier: 'tools', dyn: false, tok: 40, cached: false },
    { id: 'sysrt', name: '系统身份 + 运行时快照(混进来了)', tier: 'system', dyn: true, tok: 37, cached: false },
    { id: 'proj', name: '项目指令 CLAUDE.md', tier: 'system', dyn: false, tok: 20, cached: false },
    { id: 'hist', name: '对话历史', tier: 'messages', dyn: true, tok: 60, cached: false },
    { id: 'msg', name: '本轮用户消息', tier: 'messages', dyn: true, tok: 15, cached: false },
  ]
}

export const promptbuildKernel: Kernel<PBState> = {
  kind: 'promptbuild',
  compile(doc: SimDocument): CompiledModel<PBState> {
    const ordering = (String(doc.params?.ordering ?? '静态优先') === '乱序' ? '乱序' : '静态优先') as Ord
    const secs = layout(ordering)
    //  缓存前缀 = 从头到"第一个动态段之前"的连续静态段（断点放最后一个静态块）
    const firstDyn = secs.findIndex(s => s.dyn)
    secs.forEach((s, idx) => { s.cached = firstDyn === -1 ? true : idx < firstDyn })
    const prefixTok = secs.filter(s => s.cached).reduce((a, s) => a + s.tok, 0)
    const tailTok = secs.filter(s => !s.cached).reduce((a, s) => a + s.tok, 0)
    const total = prefixTok + tailTok
    const turn2Cached = Math.round((prefixTok * READ + tailTok) * 10) / 10
    const turn2Full = total

    const frames: Frame[] = []
    const b0 = { ordering, secs: secs.map(s => ({ ...s })), prefixTok, tailTok, turn2Cached, turn2Full, phase: 'run' as const }
    const push = (over: Partial<Frame> & { stage: Frame['stage']; secs: Sec[]; focus: string; log: string }) =>
      frames.push({ ...b0, step: frames.length, ...over } as Frame)
    const uncached = secs.map(s => ({ ...s, cached: false }))
    const bpName = secs.filter(s => s.cached).slice(-1)[0]?.name ?? '（无静态前缀）'

    push({ stage: 'intro', secs: uncached, focus: `每轮重拼 prompt，6 段——排序决定省不省钱（${ordering}）`,
      log: `**提示词组装：每轮怎么拼 prompt 才省钱**\nAgent 每一步都要把 tools + system + 历史 重新拼成 prompt 问模型。不是"拼字符串"——**排序要缓存友好**。\n**前缀缓存**：命中缓存的部分只花 **0.1× 基础价**(省 90%)，但它是**最长相同前缀**匹配——tools→system→messages 到断点为止，**断点前任何一处变了、缓存全废**。\n本次排序 **${ordering}**，6 段待拼。看它怎么定断点、两轮成本差多少。` })

    push({ stage: 'assemble', secs: secs.map(s => ({ ...s })), focus: `按 tools→system→messages 排；断点放在「${bpName}」后 → 前缀 ${prefixTok}t 可缓存、尾部 ${tailTok}t 动态`,
      log: `**① 排序 + 定缓存断点**\n顺序固定 **tools → system → messages**。断点放在**逐轮都不变的最后一块**——本例是「${bpName}」。\n→ **可缓存前缀 ${prefixTok}t**(绿)、**动态尾部 ${tailTok}t**(黄，逐轮变、进不了缓存)。\n${ordering === '乱序' ? '⚠️ 乱序把逐轮变的「运行时快照」混进了 system(靠前)——system 每轮都变，缓存**从这里就断**，后面 system/历史 全进不了缓存。' : '静态的(工具/身份/项目指令)全排在前面，所以前缀又长又稳。'}` })

    push({ stage: 'turn1', secs: secs.map(s => ({ ...s })), focus: `第 1 轮：全冷，前缀写入缓存(1.25×)`,
      log: `**② 第 1 轮：写缓存**\n第一次跑，缓存里什么都没有——前缀 ${prefixTok}t 这次是**写入缓存**(1.25× 基础价)，尾部照常全价。写这一次是为了后面能读。` })

    push({ stage: 'turn2', secs: secs.map(s => ({ ...s })), focus: `第 2 轮：前缀命中缓存(0.1×) → 等效 ${turn2Cached}t vs 全价 ${turn2Full}t`,
      log: `**③ 第 2 轮：读缓存(省 90%)**\n历史涨了、来了新消息(尾部变)，但**静态前缀 ${prefixTok}t 没变 → 命中缓存、只花 0.1×**。\n等效成本 = 前缀 ${prefixTok}×0.1 + 尾部 ${tailTok} = **${turn2Cached}t**，对比不用缓存的全价 **${turn2Full}t**——省 ${Math.round((1 - turn2Cached / turn2Full) * 100)}%。\n${ordering === '乱序' ? '乱序里前缀只有工具那 40t 能缓存，省得少。' : '静态优先前缀长，省得多；对话越长、轮数越多，省得越狠。'}` })

    push({ stage: 'done', secs: secs.map(s => ({ ...s })), phase: 'done', focus: `完：静态前排、动态后排、断点放稳定块末尾——省 ${Math.round((1 - turn2Cached / turn2Full) * 100)}%`,
      log: `**小结：拼 prompt 的钱都在"排序"里**\n前缀缓存是**最长相同前缀**匹配、命中只花 **0.1×**。所以：\n· **静态排前面**(工具/身份/项目指令)、**动态排后面**(运行时快照/历史/本轮消息)；断点放"逐轮都不变的最后一块"。\n· **别把逐轮变的东西塞进靠前的块**(时间戳、运行时快照)——前缀每轮不同、缓存永不命中、每轮全价(乱序模式就是这翻车)。这也是为什么 Claude Code 把 CLAUDE.md 当**独立 user 消息**放后面、DeepSeek 把运行时快照当**单独消息**注入——就为了别动那段可缓存前缀。\n和 KV 缓存、上下文压缩(重建时原样重放系统提示保前缀)同源:**都在保护那段能复用的前缀**。面试延伸:指令权威层级(system>developer>user>项目文件)、工具 schema 放 prompt 里 vs 单独数组、4 个缓存断点分层(工具/系统各设一个)。` })

    const base0: Frame = { ...b0, stage: 'intro', step: -1, secs: uncached, focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '组装步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
