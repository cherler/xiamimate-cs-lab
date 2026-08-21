/**
 * AI 助手（虾米君）大脑。
 * 铁律：求解器算，助手只翻译现象、提可检验的猜想、指下一步——**绝不自己算、不编造事实里没有的数字**。
 * 只在"认知节点"被调用（进副本、扫出异常、选变量前、破案、结冰示警），不进 60fps 机械回路。
 */

/** 认知节点：只有这些时刻才该唤醒助手 */
export type CognitiveNode = 'enter' | 'anomaly' | 'before-pick' | 'cracked' | 'freeze-warn'

/** 发给助手的事实清单——全部来自求解器/世界。助手引用的每个数字都必须在这里出现。 */
export type Facts = {
  chapter: string
  node: CognitiveNode
  /** 屏幕此刻的真实读数（求解器算的），供助手引用具体数字 */
  readings?: Record<string, number>
  /** 玩家做过什么 */
  flags?: Record<string, boolean>
}

export type Line = { who: string; text: string }

export interface PartnerBrain {
  react(facts: Facts): Promise<Line | null>
}

const WHO = '虾米君'

/** V0 兜底：确定性脚本。不联网、不花钱、不会胡说；数字只从 readings 取。 */
export class ScriptedPartner implements PartnerBrain {
  async react(f: Facts): Promise<Line | null> {
    switch (f.node) {
      case 'enter':
        return { who: WHO, text: '机器在转，柜里却是热的……拿热成像扫扫看？' }
      case 'anomaly': {
        const t = f.readings?.condenser
        return { who: WHO, text: t != null
          ? `散热片 ${t.toFixed(0)}℃，通红——热堆这儿出不去了。点它钻进去。`
          : '有个地方特别烫，钻进去看看。' }
      }
      case 'before-pick':
        return { who: WHO, text: '别急着修。先猜：把散热片弄通，柜里会变凉，还是没区别？只改一个变量。' }
      case 'cracked': {
        const a = f.readings?.blocked, b = f.readings?.clear
        return { who: WHO, text: (a != null && b != null)
          ? `看——堵着 ${a.toFixed(1)}℃，通着 ${b.toFixed(1)}℃。制冷不是造冷，是把热搬出去；堵了就搬不动。`
          : '制冷不是造冷，是把热搬出去；堵了就搬不动。' }
      }
      case 'freeze-warn':
        return { who: WHO, text: '等等——它在往冰点冲。疫苗冻了跟热了一样废，窗口别设太低。' }
      default:
        return null
    }
  }
}

export type ModelConfig = { baseUrl: string; apiKey: string; model: string }

/** 真模型：OpenAI 兼容 chat completions。系统提示钉死"只翻译、不算数、不编造"。端点由外部注入。 */
export class ModelPartner implements PartnerBrain {
  private cfg: ModelConfig
  constructor(cfg: ModelConfig) { this.cfg = cfg }
  async react(f: Facts): Promise<Line | null> {
    const sys = [
      '你是虾米镇里维修工的 AI 搭档「虾米君」。用户正在修一台设备。',
      '下面每个数字都是仿真求解器算出的事实。不要自己算、不要改、不要编造事实里没有的数字。',
      '你的活：把现象翻译成人话、提一个可检验的猜想、指下一步。口语，一句话，别超过 40 字。',
    ].join('\n')
    const facts = JSON.stringify({ node: f.node, readings: f.readings ?? {}, flags: f.flags ?? {} })
    try {
      const r = await fetch(`${this.cfg.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({
          model: this.cfg.model, max_tokens: 120, temperature: 0.6,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: `场景事实：${facts}\n说一句。` },
          ],
        }),
      })
      if (!r.ok) return null
      const j = await r.json() as { choices?: { message?: { content?: string } }[] }
      const text = j.choices?.[0]?.message?.content?.trim()
      return text ? { who: '虾米君', text } : null
    } catch {
      return null
    }
  }
}

/** 有完整配置就用真模型，否则脚本兜底。模型永远只是叠加——它挂了也不影响玩。 */
export function makePartner(cfg?: Partial<ModelConfig>): PartnerBrain {
  if (cfg?.baseUrl && cfg?.apiKey && cfg?.model) return new ModelPartner(cfg as ModelConfig)
  return new ScriptedPartner()
}
