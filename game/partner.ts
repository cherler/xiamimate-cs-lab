import { makePartner, type Facts } from '../agents/partner.ts'

// Vite 环境变量注入模型端点；没配就脚本兜底
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}
export const partner = makePartner({
  baseUrl: env.VITE_PARTNER_BASEURL,
  apiKey: env.VITE_PARTNER_KEY,
  model: env.VITE_PARTNER_MODEL,
})

/** 在认知节点让虾米君说话。异步；脚本兜底会立即返回。挂了返回 null，不影响玩。 */
export async function speak(setLine: (text: string) => void, facts: Facts): Promise<void> {
  const line = await partner.react(facts)
  if (line) {
    setLine(line.text)
    ;(window as unknown as { __partnerLine: string }).__partnerLine = line.text
  }
}
