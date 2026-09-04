import { makePartner, ScriptedPartner, type Facts } from '../agents/partner.ts'
import { playLine } from './ui/audio.ts'

// Vite 环境变量注入模型端点；没配就脚本兜底
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

// ?scripted=1 强制脚本（冒烟用：确定性、不打真模型、不花钱）
const forceScripted =
  typeof location !== 'undefined' && /[?&]scripted\b/.test(location.search)

const scripted = new ScriptedPartner()

/** 真大脑：配好端点且非强制脚本时用模型，否则脚本 */
export const partner = forceScripted
  ? scripted
  : makePartner({
      baseUrl: env.VITE_PARTNER_BASEURL,
      apiKey: env.VITE_PARTNER_KEY,
      model: env.VITE_PARTNER_MODEL,
    })

function setPartnerLine(setLine: (text: string) => void, text: string) {
  setLine(text)
  ;(window as unknown as { __partnerLine: string }).__partnerLine = text
}

/**
 * 在认知节点让咕噜说话。
 *
 * **先秒显脚本兜底**（脚本是同步的、立即返回，画面不卡），
 * 再后台请真模型；模型回来了、且比兜底更自然，就替换。
 * 这样：模型慢/挂/空，玩家已经有一句对的话；模型好，就升级成它。
 * 契合铁律——模型永远只是叠加，它不影响玩、也不改数。
 */
export async function speak(setLine: (text: string) => void, facts: Facts): Promise<void> {
  const base = await scripted.react(facts)
  if (base) setPartnerLine(setLine, base.text)
  playLine(facts.node) // 固定台词配音（静音/无音频则跳过）
  if (partner === scripted) return // 未配模型/强制脚本：到此为止
  const line = await partner.react(facts)
  if (line && line.text !== base?.text) setPartnerLine(setLine, line.text)
}
