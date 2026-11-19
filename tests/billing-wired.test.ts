/**
 * AI 学伴的计费真接上了吗。
 *
 * 2026-09-10 用户问「AI 伙伴的计费逻辑是做了吗」。查下来：**管道全通，闸门没开** ——
 * `server/llm.ts` 的三段式闸口（reserve/commit/release）写得很完整，
 * 但主站的 `KNOWN_MODULES` 里没有 `lab_ai`，本仓 `.env` 里没有 `XM_API_BASE`。
 * 于是每一次调用都是免费的，而且：
 *
 *   **「计费没接通」和「接通了、正常扣分」在屏幕上长得一模一样。**
 *
 * Meter 拿到 4xx 只记一句「冻结失败，本次不计费」就继续答题，用户照常拿到答案。
 * 模型的钱在真花，账一分没记。**这种坏法不报错、不 404、不白屏，只能靠判据抓。**
 *
 * 所以这一套钉的是那三处 + 一处显示：
 *   ① 子应用用的模块名，主站的白名单认得（否则 reserve 400）
 *   ② 主站给它定过价（显式条目，不是落到 DEFAULT 上）
 *   ③ 部署清单里写着 XM_API_BASE 这一步（不配就连闸口都不打）
 *   ④ 每一处模型调用都把 principal 传下去了（漏一处就是那一次不计费）
 *   ⑤ 前端把 billing 显示出来（否则用户和我们都看不见有没有扣）
 *
 * ①② 要读兄弟仓 `xiamimate-tools-backend`。**没 checkout 就跳过**——
 * 这条判据宁可不跑，也不能假失败。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

let failures = 0
const ok = (m: string) => console.log(`  ✅ ${m}`)
const bad = (m: string) => { failures++; console.log(`  ❌ ${m}`) }
const skip = (m: string) => console.log(`  ⚠️  ${m}`)

const ROOT = new URL('../', import.meta.url).pathname
const SERVER = join(ROOT, 'server')

//  ⚠️ 正则一律提成常量放最前面。两个原因，两个都栽过：
//    · 正则字面量顶在语句开头会被解析成除号（esbuild 直接报 Syntax error）
//    · const 不提升，写在使用点下面是 ReferenceError
const RE_PRIN = /\bprincipal\s*:/
const RE_ENV = /^XM_API_BASE=\S/m
const RE_BILL = /\bbilling\b/
const RE_NOTE = /<BillingNote\s*\/>/
//  必须截在 postJSON 函数体里 —— 截在六个调用点上，新加一个接口就会漏
function hasBillingHook(source: string): boolean {
  const file = ts.createSourceFile('AiCompanion.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const fn = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'postJSON')
  if (!fn || !ts.isFunctionDeclaration(fn) || !fn.body) return false
  let found = false
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'setBilling') found = true
    ts.forEachChild(node, visit)
  }
  visit(fn.body)
  return found
}
const RE_402 = /status === 402[\s\S]{0,200}?throw new QuotaRefused/
const RE_RETHROW = /if \(e instanceof QuotaRefused\) throw e/
const RE_VID = /x-visitor-id/i
const RE_XFF = /x-forwarded-for/i
const RE_NULLCOOKIE = /if\s*\(!pr\.cookie\)\s*return null/

console.log('\n【AI 学伴的计费真接上了】')

// ── ④ 每一处模型调用都带上了计费主体 ────────────────────────────
//  先跑这条：它顺便算出「本仓用的是哪个模块名」，①② 要拿去跟主站对。
const srcFiles = readdirSync(SERVER).filter(f => f.endsWith('.ts'))
  .map(f => ({ name: f, text: readFileSync(join(SERVER, f), 'utf8') }))
const RE_GEN = /generate\(\{([\s\S]*?)\}\)/g
const calls: { file: string; body: string }[] = []
for (const f of srcFiles) {
  if (f.name === 'llm.ts') continue          // 闸口自己，不是调用点
  for (const m of f.text.matchAll(RE_GEN)) calls.push({ file: f.name, body: m[1] })
}
{
  calls.length > 0
    ? ok(`找到 ${calls.length} 处模型调用：${[...new Set(calls.map(c => c.file))].join('、')}`)
    : bad('一处 generate({…}) 都没找到 —— 结构变了，这套判据要跟着改')

  const noPrincipal = calls.filter(c => !RE_PRIN.test(c.body))
  noPrincipal.length === 0
    ? ok('每一处调用都把 principal 传下去了 —— 漏一处就是那一次静默免费')
    : bad(`这些调用没传 principal，它们永远不会计费：${noPrincipal.map(c => c.file).join('、')}`)

  const noModule = calls.filter(c => !/\bmodule\s*:/.test(c.body))
  noModule.length === 0
    ? ok('每一处调用都写了 module')
    : bad(`这些调用没写 module：${noModule.map(c => c.file).join('、')}`)
}

//  模块名必须只有一个。写岔一个字母，主站白名单就不认 → 那一处静默免费。
const modules = [...new Set(calls.flatMap(c => [...c.body.matchAll(/\bmodule:\s*'([a-z_]+)'/g)].map(m => m[1])))]
{
  modules.length === 1
    ? ok(`模块名只有一个：'${modules[0]}'`)
    : bad(`模块名不止一个（${modules.join('、') || '一个都没解析到'}）—— 白名单只认对得上的那个，别的静默免费`)
}
const MODULE = modules[0] ?? ''

// ── ①② 主站认这个模块，而且给它定过价 ──────────────────────────
const BE = join(ROOT, '..', 'xiamimate-tools-backend')
if (!existsSync(BE)) {
  skip(`兄弟仓 xiamimate-tools-backend 不在同一 checkout —— ①② 这次跳过（宁可不跑，不假失败）`)
} else if (!MODULE) {
  skip('本仓模块名没解析出来，①② 无从比对')
} else {
  const gw = readFileSync(join(BE, 'app', 'routes', 'credits_gateway.py'), 'utf8')
  const known = gw.match(/^KNOWN_MODULES\s*=\s*\{([^}]*)\}/m)
  if (!known) bad('主站 KNOWN_MODULES 解析不出来 —— 结构变了，这条判据要跟着改')
  else {
    const set = [...known[1].matchAll(/"([a-z_]+)"/g)].map(m => m[1])
    set.includes(MODULE)
      ? ok(`主站白名单认得 '${MODULE}'（KNOWN_MODULES = ${set.join('、')}）`)
      : bad(`主站 KNOWN_MODULES 里没有 '${MODULE}' —— reserve 会回 400 bad_module，`
          + `而本仓 Meter 只记一句日志就继续答题：**用户照常拿到答案、一分不扣、页面上看不出来**`)
  }

  const pr = readFileSync(join(BE, 'app', 'pricing.py'), 'utf8')
  const mul = pr.match(/^MODULE_MULTIPLIERS\s*=\s*\{([\s\S]*?)^\}/m)
  if (!mul) bad('主站 MODULE_MULTIPLIERS 解析不出来 —— 结构变了，这条判据要跟着改')
  else {
    const priced = [...mul[1].matchAll(/"([a-z_]+)"\s*:/g)].map(m => m[1])
    /**
     * 为什么「落到 DEFAULT 上」不算数：行为上确实也是 1.0，可那是
     * **「没人给它定过价」**，不是「定过，定的是 1.0」。半年后看那张表，
     * 前者会让人以为漏了一行。判据要钉的是后一种意思。
     */
    priced.includes(MODULE)
      ? ok(`主站给 '${MODULE}' 写了显式倍率条目（不是落到 DEFAULT 上）`)
      : bad(`主站 MODULE_MULTIPLIERS 里没有 '${MODULE}' —— 会落到 DEFAULT，等于没定过价`)
  }
}

// ── ③ 部署清单里写着 XM_API_BASE 这一步 ────────────────────────
{
  const dep = readFileSync(join(ROOT, 'deploy', 'README.md'), 'utf8')
  dep.includes('XM_API_BASE')
    ? ok('部署清单里写了 XM_API_BASE —— 不配它，Meter 直接短路，连闸口都不打')
    : bad('deploy/README.md 没提 XM_API_BASE。上线时漏配 = AI 学伴全程免费，而且没有任何报错')

  //  本机 .env：只在它存在时判。CI/别人的机器上没有 .env 是正常的，不该假失败。
  const env = join(ROOT, '.env')
  if (!existsSync(env)) skip('本机没有 .env —— 跳过「本地是否已接入闸口」这一条')
  else {
    RE_ENV.test(readFileSync(env, 'utf8'))
      ? ok('本机 .env 配了 XM_API_BASE（启动日志应为「计费：已接入主站计费」）')
      : bad('本机 .env 没有 XM_API_BASE —— 本地跑 AI 学伴不会计费（线上同理）')
  }
}

// ── ⑤ 前端把 billing 显示出来 ──────────────────────────────────
{
  const ai = readFileSync(join(ROOT, 'web', 'src', 'shell', 'AiCompanion.tsx'), 'utf8')
  /**
   * 服务端每个响应都带 billing，2026-09-10 之前前端收下就丢了。
   * 不显示的后果不只是用户不知道花了几分 —— **是我们自己也看不出闸口通没通**。
   */
  RE_BILL.test(ai) && RE_NOTE.test(ai)
    ? ok('前端截下了 billing 并渲染成一条「本次消耗」')
    : bad('AiCompanion 没有显示 billing —— 「计费没通」和「正常扣分」在屏幕上就没法分辨')

  //  必须截在 postJSON 那一层：截在六个调用点上，新加一个接口就会漏
  hasBillingHook(ai)
    ? ok('截在 postJSON 这一层 —— 新加的接口自动带上，漏不掉')
    : bad('billing 不是在 postJSON 里截的 —— 新接口会漏掉，且漏了看不出来')
}

// ── ⑥ 限流要**真的限住** ──────────────────────────────────────
/**
 * 用户 2026-09-10：AI 学伴「不堵,留作免费试用,但加按 IP 的日限」。
 *
 * 一个不阻止调用的限流不是限流。之前那条路是:reserve 失败 → 记一句日志 →
 * **照样调模型**。于是未登录的人可以无限白拿真的大模型回答。
 *
 * 分界线是 **402**：闸口认出了这个人并且明确说"你没额度了"(登录用户余额为 0,
 * 或游客今天的体验额度用完)—— 必须停。其余(400 配置错、5xx、连不上)是
 * 闸口"没能判断",继续放行并亮警示条,那是另一条有意的取舍。
 */
{
  const llm = readFileSync(join(SERVER, 'llm.ts'), 'utf8')

  RE_402.test(llm)
    ? ok('闸口回 402 时抛 QuotaRefused —— 不是记一句日志就接着调模型')
    : bad('llm.ts 没有对 402 单独处理：额度用完照样会调模型，**限流等于没做**')

  //  catch 不能把它吞回"闸口不可达"那一档 —— 吞了就白做
  RE_RETHROW.test(llm)
    ? ok('catch 里把 QuotaRefused 原样抛出，没被当成「连不上」吞掉')
    : bad('QuotaRefused 会被 catch 吞成「闸口不可达」→ 继续调模型，限流失效')

  /**
   * reserve 必须在 try **之外**。挪进 try 里的话，抛出的 QuotaRefused 会被
   * 那个 catch 接住、走进 release + 换下一个供应商重试 —— 于是"额度用完"
   * 反而变成了对第二家供应商再发一次请求。
   */
  const loop = llm.slice(llm.indexOf('for (let i = 0; i < candidates.length'))
  const iReserve = loop.indexOf('meter.reserve(')
  const iTry = loop.indexOf('try {')
  iReserve > 0 && iTry > iReserve
    ? ok('reserve 排在 try 之外 —— 额度被拒时直接穿出去，不会被当成"这家供应商挂了"去重试')
    : bad(`reserve 落在 try 里面了（reserve@${iReserve} / try@${iTry}）—— 额度用完会变成换一家供应商再发一次`)

  //  没登录也要打闸口。返回 null 就等于"连闸口都不打" = 无限白拿。
  const idx = llm.indexOf('function principalHeaders')
  const ph = idx >= 0 ? llm.slice(idx, idx + 900) : ''
  !RE_NULLCOOKIE.test(ph)
    ? ok('没有 Cookie 也照打闸口（走游客试用额度），不是直接放行')
    : bad('principalHeaders 在没 Cookie 时返回 null —— 未登录连闸口都不打，可以无限白拿')

  //  游客的两个识别维度都要转发,否则主站看到的是本进程的内网地址
  const idx2 = (srcFiles.find(f => f.name === 'index.ts')?.text) ?? ''
  RE_VID.test(idx2) && RE_XFF.test(idx2)
    ? ok('转发了 x-visitor-id 与 x-forwarded-for —— 主站才认得出是哪个游客')
    : bad('没转发游客标识：主站只看得到本进程的内网地址，全部游客挤进同一个桶')

  //  前端也要把游客标识带上,否则后端只能按 IP 计(整个办公室共用一份)
  const ai = readFileSync(join(ROOT, 'web', 'src', 'shell', 'AiCompanion.tsx'), 'utf8')
  ai.includes("'xm:vid'") && RE_VID.test(ai)
    ? ok('前端带上了 xm:vid（与主站共用同一个 key，不是各写各的）')
    : bad('前端没送 x-visitor-id，或没有复用主站的 xm:vid —— 同一个人会在两边各拿一份额度')
}

// ── ⑦ 用户看到的单位一律是「积分」，不是「次」 ────────────────
/**
 * 用户 2026-09-10 当场抓出来的：AI 学伴的消耗条写成「游客体验：今天还剩 4 / 5 次」。
 * **「次」是积分制之前的说法，早废弃了**——全平台只有积分一套口径：
 * 页眉胶囊未登录写「◈ 今日 N 积分」、登录写余额，`/v1/guest/quota` 的
 * limit/used/left 也都是积分。
 *
 * 换算成"次"看着更好懂，实际是把口径拆成两套，而且**一次调用未必正好 1 分**
 * （token 多就不止），"次"根本对不上账。
 *
 * 它会退化，是因为源头还留着旧说法（backend config.py 那行注释就写过
 * 「游客每日 5 次体验」，我正是照着它写回去的）。所以钉在**给用户看的文案**上。
 */
{
  const ai = readFileSync(join(ROOT, 'web', 'src', 'shell', 'AiCompanion.tsx'), 'utf8')
  const llm = readFileSync(join(SERVER, 'llm.ts'), 'utf8')

  //  只看 JSX 文本与 note 模板里的量词，不看注释（注释里讲"这次/一次"是正常中文）
  const segs = [
    ...[...ai.matchAll(/<p className="aic-bill[^"]*">([\s\S]*?)<\/p>/g)].map(m => m[1]),
    ...[...llm.matchAll(/this\.note = [^\n]*/g)].map(m => m[0]),
  ]
  const shown = segs.join('\n')
  segs.length >= 4
    ? ok(`取到 ${segs.length} 段给用户看的计费文案（消耗条 + 服务端 note）`)
    : bad(`只解析到 ${segs.length} 段计费文案 —— 结构变了，这条判据要跟着改`)

  //  「N 次」「还剩 N 次」这种量词是旧口径；「本次 / 这次 / 一次」是正常中文，放行
  const BAD_UNIT = /(?:剩|还剩|已用|共|\d|\}|>)\s*次(?!数)/
  !BAD_UNIT.test(shown)
    ? ok('用户看到的都是「积分」，没有把额度换算成「次」')
    : bad(`计费文案里出现了「次」这个量词（旧口径）：${shown.match(BAD_UNIT)?.[0]}`)

  shown.includes('积分')
    ? ok('文案里确实讲了积分 —— 上一条不是因为整段文案都空')
    : bad('计费文案里一个「积分」都没有')
}

// ── 自检：上面每一条都得能红 ──────────────────────────────────
console.log('\n【自检：这些判据能红吗】')
{
  //  ④ 漏传 principal
  const FAKE_CALL = "module: 'lab_ai', task: 'ask', system: SYSTEM, prompt, maxTokens: 700"
  !RE_PRIN.test(FAKE_CALL)
    ? ok('自检：一处漏传 principal 的调用会被抓住')
    : bad('自检失败：漏传 principal 认不出来')

  //  ① 白名单里没有本仓的模块名
  const FAKE_KNOWN = 'KNOWN_MODULES = {"stocks"}'
  const set = [...(FAKE_KNOWN.match(/\{([^}]*)\}/)?.[1] ?? '').matchAll(/"([a-z_]+)"/g)].map(m => m[1])
  MODULE && !set.includes(MODULE)
    ? ok(`自检：白名单退回 {"stocks"} 时，①那条会红（那正是 2026-09-10 之前的实况）`)
    : bad('自检失败：①认不出白名单缺了本仓模块')

  //  ② 只有 stocks 的倍率表
  const FAKE_MUL = 'MODULE_MULTIPLIERS = {\n    "stocks": 1.0,\n}'
  const priced = [...(FAKE_MUL.match(/\{([\s\S]*?)\}/)?.[1] ?? '').matchAll(/"([a-z_]+)"\s*:/g)].map(m => m[1])
  MODULE && !priced.includes(MODULE)
    ? ok('自检：倍率表里没有本仓模块时，②那条会红')
    : bad('自检失败：②认不出倍率表缺了本仓模块')

  //  ⑥ 402 被当成普通错误吞掉
  const FAKE_LLM = "if (status >= 400) { this.note = `冻结失败`; return }"
  !RE_402.test(FAKE_LLM)
    ? ok('自检：把 402 混进 `status >= 400` 一把抓时，⑥那条会红（那正是加限流之前的写法）')
    : bad('自检失败：⑥认不出"402 没被单独处理"')

  /**
   * ⑧ **「额度用完」不许和「模型挂了」共用一个兜底。**
   *
   * 两种都该落回引擎讲解（实验照用），但用户看到的必须不一样：
   * 模型挂了是我们的事，不用打扰他；额度用完了是**他能做点什么** —— 登录，用自己的积分。
   * 原来 server/quiz.ts 的 explainQuestion 一律 `console.warn` 然后静默降级，
   * 游客打满 5 次之后第 6 次讲解忽然变素，而**页面上一个字的解释都没有**。
   * （2026-09-11 真机联测打出来的：前 5 次 source=llm，第 6 次 source=engine、note 为空。）
   */
  //  ⚠️ 正则别放在语句开头 —— esbuild 会把行首的 `/` 当成除号，整个文件语法崩。
  const RE_QUOTA_NOTE = /\bQuotaRefused\b[\s\S]{0,400}?note:/
  const qz = srcFiles.find(f => f.name === 'quiz.ts')?.text ?? ''
  const tail = qz.slice(qz.indexOf('catch (e)', qz.indexOf('explainQuestion')))
  RE_QUOTA_NOTE.test(tail)
    ? ok('⑧ 额度用完时会带一句给用户的说明，不是静默降级')
    : bad('⑧ explainQuestion 把 QuotaRefused 和别的报错一起吞了 —— '
      + '用户只看到讲解变素，不知道是额度到头、也不知道登录就能继续')

  //  ⑧ 自检：并回同一个 catch 的写法要能被抓住
  const FAKE_CATCH = "} catch (e) {\n  console.warn('失败，用引擎兜底')\n  return fallback\n}"
  !RE_QUOTA_NOTE.test(FAKE_CATCH)
    ? ok('自检：把 QuotaRefused 并回通用 catch 时，⑧那条会红')
    : bad('自检失败：⑧认不出"额度用完被静默吞掉"')

  //  ⑦ 把积分换算成「次」
  const BAD_UNIT2 = /(?:剩|还剩|已用|共|\d|\}|>)\s*次(?!数)/
  BAD_UNIT2.test('今天还剩 <b>{left}</b> / {b.limit} 次') && !BAD_UNIT2.test('本次消耗 <b>1</b> 积分')
    ? ok('自检：「还剩 4 / 5 次」会被抓住，而「本次消耗 1 积分」不误伤')
    : bad('自检失败：⑦的量词判据要么抓不住旧写法，要么误伤「本次」')

  //  ⑤ 截在调用点而不是 postJSON 上
  const FAKE_UI = 'async function postJSON<T>(path, body) {\n  const data = await r.json()\n  return data\n}\nsetBilling(d.billing)'
  !hasBillingHook(FAKE_UI)
    ? ok('自检：billing 截在 postJSON 之外时，⑤那条会红')
    : bad('自检失败：⑤认不出截错了地方')
  hasBillingHook(`async function postJSON() { ${' '.repeat(900)} setBilling(data.billing) }`)
    ? ok('自检：函数变长不影响归属判断')
    : bad('自检失败：⑤仍然依赖字符距离')
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failures === 0 ? '本套全部通过' : `AI 学伴计费：失败 ${failures} 项`)
process.exit(failures === 0 ? 0 : 1)
