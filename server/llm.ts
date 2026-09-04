/**
 * 所有模型调用的唯一入口 + 它与「虾米伙伴」积分账户之间的闸口。
 *
 * 移植自 xiamimate-stock-lab 的 apps/api/stock_decision/llm.py，改写成 TS。
 * 语言换了，**协议一字不改**：主站 xiamimate-tools-backend 暴露的
 *   /v1/credits/reserve  → 按最坏情况冻结额度，返回 hold_id
 *   /v1/credits/commit   → 按真实 token 结算，冻多的自动退回
 *   /v1/credits/release  → 整笔释放（调用失败时，不扣分）
 *
 * 闸口怎么工作：
 *   调用前：按 max_tokens 估算向主站冻结 →
 *   调用中：模型返回真实 usage →
 *   调用后：按真实 token 结算；失败则整笔释放。
 * 冻结而不是直接扣，是因为「这次花多少」只有调用完才知道。
 *
 * 没接入主站时它是透明的：XM_API_BASE 没配（本地开发）就整条跳过，
 * 不冻结、不结算、也不报错 —— 但会在返回里如实说明「未接入积分」，不假装扣过。
 *
 * 它只会扣发起请求的那个人：浏览器发起的调用把用户的 xm_session Cookie
 * 原样转发给主站，主站自己解出是谁，本进程从头到尾不知道 user_id，也就伪造不了别人。
 * 后台任务（无 Cookie）走内网密钥 + 显式 user_id，需在 .env 配 XM_INTERNAL_KEY / XM_OWNER_USER_ID。
 */
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'node:crypto'

// ── 供应商：MiniMax 主用，DeepSeek 兜底。两家都是 Anthropic 兼容端点。 ──
export type Provider = 'minimax' | 'deepseek'

function providerConfig(p: Provider): { apiKey: string; baseURL: string; model: string } {
  if (p === 'deepseek') {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
      baseURL: process.env.DEEPSEEK_BASE_URL ?? '',
      model: process.env.DEEPSEEK_MODEL ?? '',
    }
  }
  return {
    apiKey: process.env.MINIMAX_API_KEY ?? '',
    baseURL: process.env.MINIMAX_BASE_URL ?? '',
    model: process.env.MINIMAX_MODEL ?? '',
  }
}

// ── 计费主体：浏览器转发 Cookie，后台用内网密钥 ──
export type Principal =
  | { kind: 'browser'; cookie: string }
  | { kind: 'internal'; userId: string }
  | null

function principalHeaders(pr: Principal): { headers: Record<string, string>; userId: string } | null {
  if (!pr) return null
  if (pr.kind === 'browser') {
    if (!pr.cookie) return null
    return { headers: { Cookie: pr.cookie }, userId: '' }
  }
  const key = process.env.XM_INTERNAL_KEY ?? ''
  if (!key || !pr.userId) return null
  return { headers: { 'X-Internal-Key': key }, userId: pr.userId }
}

// ── 一次调用的计费句柄 ──
class Meter {
  active = false
  holdId = ''
  cost = 0
  tokens = 0
  note = '未接入积分(本地单机模式)'
  private base = ''
  private headers: Record<string, string> = {}
  private userId = ''
  private commitKey = ''
  private releaseKey = ''
  constructor(readonly module: string, readonly task: string) {}

  /** 幂等键必须每次调用唯一：同一个 hold 结算两次是两笔账，不是重放。 */
  private key(scope: string): string {
    return `${this.module}:${this.task}:${scope}:${randomUUID().replace(/-/g, '').slice(0, 20)}`
  }

  async reserve(estimatedTokens: number, pr: Principal): Promise<void> {
    const base = process.env.XM_API_BASE ?? ''
    if (!base) { this.note = '未接入积分(本地单机模式)'; return }
    const who = principalHeaders(pr)
    if (!who) { this.note = '未识别到登录身份,本次不计费'; return }
    this.base = base
    this.headers = who.headers
    this.userId = who.userId
    this.commitKey = this.key('commit')   // 提前生成：重试落在同一个键上才叫幂等
    this.releaseKey = this.key('release')
    const payload: Record<string, unknown> = {
      module: this.module, task: this.task,
      estimated_tokens: Math.max(0, estimatedTokens),
      searches: 0, idempotency_key: this.key('reserve'),
    }
    if (this.userId) payload.user_id = this.userId
    try {
      const { status, data } = await post(base, '/v1/credits/reserve', payload, this.headers)
      if (status >= 400) { this.note = `冻结失败(status=${status}),本次不计费`; return }
      this.holdId = String((data as Record<string, unknown>)?.hold_id ?? '')
      if (this.holdId) { this.active = true; this.note = '已冻结额度' }
    } catch (e) {
      // 闸口连不上 ≠ 用户没钱。挡住调用会让主站抖一下就把整个实验室弄瘫；
      // 漏计的这一次有日志可查、金额有限。两害相权取其轻。
      console.warn('[llm] 积分闸口不可达,本次不计费:', (e as Error).message)
      this.note = '积分闸口不可达,本次未计费(已记日志)'
    }
  }

  async commit(tokens: number): Promise<void> {
    if (!this.active || !this.holdId) return
    const payload: Record<string, unknown> = {
      module: this.module, task: this.task, hold_id: this.holdId,
      tokens: Math.max(0, tokens), searches: 0, idempotency_key: this.commitKey,
    }
    if (this.userId) payload.user_id = this.userId
    try {
      const { status, data } = await post(this.base, '/v1/credits/commit', payload, this.headers)
      if (status >= 400) {
        // 结算失败不能反过来打断已成功的业务调用；冻结由主站 release_stale_holds 兜底回收。
        console.error('[llm] 积分结算失败 hold=%s status=%s', this.holdId, status)
        this.note = '结算失败,已记日志(冻结将由主站超时释放)'
        return
      }
      const d = data as Record<string, unknown>
      this.cost = Number(d?.cost ?? 0)
      this.tokens = Number(d?.tokens ?? 0)
      this.note = `本次消耗 ${this.cost} 积分`
    } catch (e) {
      console.error('[llm] 积分结算异常 hold=%s:', this.holdId, (e as Error).message)
      this.note = '结算异常,已记日志(冻结将由主站超时释放)'
    }
  }

  async release(): Promise<void> {
    if (!this.active || !this.holdId) return
    const payload: Record<string, unknown> = { hold_id: this.holdId, idempotency_key: this.releaseKey }
    if (this.userId) payload.user_id = this.userId
    try {
      await post(this.base, '/v1/credits/release', payload, this.headers)
    } catch (e) {
      console.error('[llm] 积分释放失败 hold=%s:', this.holdId, (e as Error).message)
    }
    this.note = '调用失败,已退回冻结额度'
  }

  summary(): { metered: boolean; credits: number; tokens: number; note: string } {
    return { metered: this.active, credits: this.cost, tokens: this.tokens, note: this.note }
  }
}

async function post(base: string, path: string, payload: unknown, headers: Record<string, string>) {
  const res = await fetch(base.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })
  let data: unknown = null
  try { data = await res.json() } catch { /* 空体或非 JSON */ }
  return { status: res.status, data }
}

// ── 对外主接口：估额 → 冻结 → 调模型 → 结算/释放 ──
export type GenOptions = {
  module: string           // 计费模块名，如 'lab_ai'
  task: string             // 操作名，如 'quiz' / 'ask' / 'cards'
  system: string
  prompt: string
  maxTokens?: number
  provider?: Provider
  principal?: Principal
}

export type GenResult = {
  text: string
  usage: { input: number; output: number }
  billing: { metered: boolean; credits: number; tokens: number; note: string }
  provider: Provider
}

function isConfigured(p: Provider): boolean {
  const c = providerConfig(p)
  return !!(c.apiKey && c.baseURL && c.model)
}

export async function generate(opts: GenOptions): Promise<GenResult> {
  const maxTokens = opts.maxTokens ?? 1024
  // 主用供应商在前、另一家兜底在后;只试**配置齐全**的,没配的直接跳过。
  // 于是:主家一抖(网络/5xx/限流/超时)就自动切兜底,而不是把整个答疑/复习/面试打回一个错误。
  const primary = opts.provider ?? 'minimax'
  const fallback: Provider = primary === 'minimax' ? 'deepseek' : 'minimax'
  const candidates = [primary, fallback].filter(isConfigured)
  if (candidates.length === 0) {
    throw new Error('没有可用的大模型供应商(检查 .env 的 MINIMAX_*/DEEPSEEK_* 是否配齐 API_KEY/BASE_URL/MODEL)')
  }

  // 估额：提示词约按 1 token≈2 汉字/4 字符粗估 + 最坏输出。冻多退多，估粗无害。
  const estIn = Math.ceil((opts.system.length + opts.prompt.length) / 3)

  let lastErr: unknown
  for (let i = 0; i < candidates.length; i++) {
    const provider = candidates[i]!
    const cfg = providerConfig(provider)
    //  每次尝试各自一套计费:失败的那次 release 退回冻结、成功的那次 commit 结算。
    //  幂等键在 Meter 里每次唯一,两次尝试是两笔独立的账,不会互相污染。
    const meter = new Meter(opts.module, opts.task)
    await meter.reserve(estIn + maxTokens, opts.principal ?? null)
    const client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL })
    try {
      const r = await client.messages.create({
        model: cfg.model,
        max_tokens: maxTokens,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
      })
      const text = r.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text).join('')
      const usage = { input: r.usage?.input_tokens ?? 0, output: r.usage?.output_tokens ?? 0 }
      await meter.commit(usage.input + usage.output)
      return { text, usage, billing: meter.summary(), provider }
    } catch (e) {
      await meter.release()   // 这次没成 → 退回冻结额度,不扣分
      lastErr = e
      const next = candidates[i + 1]
      if (next) console.warn(`[llm] 供应商 ${provider} 调用失败,切兜底 ${next}:`, (e as Error).message)
    }
  }
  // 所有配置齐全的供应商都失败了 → 抛最后一个错(调用方各自有 fallback 兜底题面/错误提示)
  throw lastErr
}
