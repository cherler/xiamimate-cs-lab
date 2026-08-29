/**
 * 维修助手「小修」· 接真大模型(MiniMax,OpenAI 兼容)。
 * 三种帮助,都不点名答案(懂才能合):
 *   · explainHand —— 纯静态:把手里每张牌能干嘛讲清楚(不靠网,永远可用,是"至少要有用"的地板);
 *   · askDuel     —— 多回合副本:读已知证据 → 指出还差啥没查、下一步方法 → 可能原因(LLM,失败落到 explainHand);
 *   · askCauses   —— 单发副本:据真症状给"可能是哪些原因"的病因方向(LLM,失败落到通用提示)。
 * 数字/症状/读数都来自真求解器,助手只做诊断推理,绝不告诉你该出哪张牌、是哪个故障。
 */
import type { DuelReading } from './duel.ts'

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

/** 共用:一次 chat,拿不到就回 null(让各入口自己决定怎么兜底)。dev 走 Vite 代理 /partner 兜 CORS。 */
async function chat(sys: string, user: string): Promise<string | null> {
  const base = env.DEV ? '/partner' : env.VITE_PARTNER_BASEURL
  const key = env.VITE_PARTNER_KEY, model = env.VITE_PARTNER_MODEL
  if (!base || !key || !model) return null
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: 1024, temperature: 0.7, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
    })
    if (!r.ok) return null
    const j = await r.json() as { choices?: { message?: { content?: string } }[] }
    const text = j.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    return text || null
  } catch { return null }
}

export type HandCard = { kind: 'probe' | 'fix' | 'wait'; name: string; note: string }

/** 纯静态:讲清手里每张牌能干嘛。不靠网络,永远可用——玩家一懵就有救。 */
export function explainHand(cards: HandCard[]): string {
  const probes = cards.filter(c => c.kind === 'probe')
  const fixes = cards.filter(c => c.kind === 'fix')
  const wait = cards.find(c => c.kind === 'wait')
  const parts: string[] = []
  if (probes.length) parts.push('🔍 探针(只查不修,先拿它取证):' + probes.map(c => `${c.name}—${c.note}`).join(';'))
  if (fixes.length) parts.push('🔧 处置(对症才有用;乱修白费一回合、故障还会恶化):' + fixes.map(c => `${c.name}—${c.note}`).join(';'))
  if (wait) parts.push('⏳ ' + wait.name + '—' + wait.note)
  parts.push('思路:先探针弄清是哪儿的毛病,再对症下手。')
  return parts.join('\n')
}

/** 大白话解读已探到的读数 —— 把生数字翻成人话:每条对照"正常是多少"、指出哪个不对劲、毛病多半在哪。
 *  内置、可靠、不靠网(小修的地板);数字/正常值都来自真求解器。 */
export function interpretReadings(readings: DuelReading[]): string {
  const known = readings.filter(r => r.value !== null && r.plain)
  if (!known.length) return '先出几张探针卡量量数(摸一摸、听一听),我才好帮你看是哪儿的毛病~'
  const body = known.map(r => '· ' + r.plain).join('\n')
  const off = known.filter(r => r.off && r.label !== '柜内' && r.label !== '现象')
  const tail = off.length
    ? `\n\n👉 毛病多半就在「${off.map(r => r.label).join('、')}」这块。`
    : (known.length >= 3 ? '\n\n👉 量到的都正常,毛病可能藏在还没查的那项——把没查的补上。' : '')
  return body + tail
}

export type DuelCtx = { appliance: string; state: string; known: string[]; hand: HandCard[] }

/** 多回合副本的"我懵了怎么办":读证据 → 还差啥没查/下一步方法 → 可能原因。LLM 失败落到 explainHand。 */
export async function askDuel(ctx: DuelCtx): Promise<string> {
  const handTxt = ctx.hand.map(c => `[${c.kind === 'probe' ? '探针' : c.kind === 'fix' ? '处置' : '等待'}]${c.name}(${c.note})`).join('、')
  const knownTxt = ctx.known.length ? ctx.known.join(';') : '还没探到任何读数'
  const sys = `你是"虾米家"维修助手「小修」,像邻居家爱帮忙的小孩,**全程大白话、绝不甩专业术语**。玩家在修${ctx.appliance},多回合诊断:先探针量数、再对症处置,乱修会浪费回合、故障还会恶化。`
    + `重点(共不超过 130 字,亲切口语):`
    + `①把玩家已经量到的读数,一个个对照"正常是多少"翻成人话——哪个不对劲、它意味着啥(例:"漏进来的热 95、正常才 10,门缝在灌热");`
    + `②顺带一句手里的牌大致两种(探针只查、处置才修),先查清再动手;`
    + `**别甩术语、也别直接说该出哪张牌**。用"·"分点。`
  const user = `当前状态:${ctx.state}\n已知读数:${knownTxt}\n手牌:${handTxt}\n我有点懵,该从哪下手?`
  const out = await chat(sys, user)
  return out ?? (explainHand(ctx.hand) + '\n(助手没接上,先照这个思路走。)')
}

/** 单发副本:据真症状给"可能是哪些原因"的病因方向。 */
export async function askCauses(appliance: string, symptom: string): Promise<string> {
  const sys = `你是"虾米家"的维修助手「小修」,亲切、口语、简短。用户在修一台${appliance}。`
    + `你的任务:根据它表现出来的真实症状,列出**可能造成这些现象的 2~3 种原因方向**,帮用户缩小怀疑范围。`
    + `**不要直接告诉他该做什么、该修哪儿、该用哪张卡**——只给"可能是……"的病因方向,让他自己判断。`
    + `每条一句话,用"·"分点,总共不超过 70 字。`
  const out = await chat(sys, `症状(求解器算出来的):${symptom}\n可能是哪些原因造成的?`)
  return out ?? '(暂时连不上助手)先盯住症状里最反常的那个细节:它到底卡在哪一步、哪个环节的表现最不对劲,顺着那儿想。'
}
