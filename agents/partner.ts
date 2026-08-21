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

/**
 * 每个认知节点的情境。喂给模型的不是光秃秃的 node 名——那样它不知道是冷藏柜、会瞎编。
 * 情境把"这是什么场景、readings 是什么"讲清楚，模型才是翻译而不是发明。
 */
const NODE_CONTEXT: Record<CognitiveNode, string> = {
  'enter': '玩家刚进诊所疫苗冷藏柜内部。柜子通着电、压缩机在转，可柜里是热的。提示他拿热成像扫一扫。',
  'anomaly': '玩家用热成像扫描，散热片异常烫（readings.condenser ℃）。说明热搬到散热片却排不出去。提示他点散热片钻进去。',
  'before-pick': '玩家进了对照实验台，要找出柜里为什么热。提示他别急着修，先只改一个变量做对照。',
  'cracked': '对照实验：散热片堵着时柜内 readings.blocked ℃、通着时 readings.clear ℃。说明制冷=把热搬出去、堵了搬不动。用这两个数点破它。',
  'freeze-warn': '玩家修好散热后把温控窗口设到冰点以下，柜子往冰点冲。警告他疫苗冻了跟热了一样废、窗口别太低。',
}

/** 真模型：OpenAI 兼容 chat completions。系统提示钉死"只翻译、不算数、不编造"。端点由外部注入。 */
export class ModelPartner implements PartnerBrain {
  private cfg: ModelConfig
  constructor(cfg: ModelConfig) { this.cfg = cfg }
  async react(f: Facts): Promise<Line | null> {
    const sys = '你是维修工的 AI 搭档「虾米君」，口语、俏皮、简短。下面的数字是仿真求解器算的事实，绝不自己编数字。只说一句话，不超过 35 字。'
    const facts = JSON.stringify(f.readings ?? {})
    try {
      // baseUrl 约定以 /v1 结尾（OpenAI 兼容），这里补 /chat/completions
      const r = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({
          // MiniMax-M3 等推理模型会先吐 <think>，token 给足，正文才有位置
          model: this.cfg.model, max_tokens: 1024, temperature: 0.7,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: `情境：${NODE_CONTEXT[f.node]}\n数据：${facts}\n以虾米君的口吻说一句。` },
          ],
        }),
      })
      if (!r.ok) return null
      const j = await r.json() as { choices?: { message?: { content?: string } }[] }
      // 剥掉推理块，只留正文；模型不给正文就返回 null（脚本兜底）
      const text = j.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
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
