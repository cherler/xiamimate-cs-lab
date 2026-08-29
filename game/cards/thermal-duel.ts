/**
 * 冰箱副本 v2 · 多回合"对战"模型 —— 敌人=故障,而且**故障每回合主动反扑**。
 *
 * 守铁律"仿真是核心":稳态 solveThermal 是真理源;我只在它上面加一层
 * "柜内温朝稳态弛豫"的真动态。于是——
 *   · 时钟/变质:柜里越久越暖,变质条自己涨(不是脚本计时,是温度积出来的);
 *   · 故障反扑:散热片被烫太久 → 压缩机烤降频,**冒出次生故障**(从求解器读数越过物理阈值涌现,不是编剧写的);
 *   · 懂才能合:顶层只看得到"柜内温+变质",真病因藏在读数背后,得**出探针卡取证**才知道,再下手处置。
 * 一个副本 = 探针→推断→处置→故障反扑→再诊断 的多轮拉锯,全程 solver 判、绝不喂答案。
 */
import { solveThermal, type ThermalInput } from '../../solvers/thermal.ts'
import type { DuelCard as GenCard, DuelView, RunMods } from './duel.ts'
import { NO_MODS } from './duel.ts'

export type Fault = 'coils' | 'seal' | 'refrigerant' | 'derate' // derate=次生(压缩机降频)
export type Reading = 'inside' | 'condenser' | 'load' | 'pump'

export type DuelCard =
  | { id: string; kind: 'probe'; name: string; note: string; reveal: Reading }
  | { id: string; kind: 'fix'; name: string; note: string; clears: Fault }
  | { id: string; kind: 'wait'; name: string; note: string }

export const CARDS: DuelCard[] = [
  { id: 'probe-condenser', kind: 'probe', name: '摸后背散热片', note: '读散热片温度', reveal: 'condenser' },
  { id: 'probe-load', kind: 'probe', name: '关门测漏热', note: '读漏进来的热负荷', reveal: 'load' },
  { id: 'probe-pump', kind: 'probe', name: '听压缩机', note: '读它还在使多大劲搬热', reveal: 'pump' },
  { id: 'clean-coils', kind: 'fix', name: '清理散热片 / 挪开离墙', note: '把散热热阻降回去', clears: 'coils' },
  { id: 'fix-seal', kind: 'fix', name: '关严门 / 换密封条', note: '堵住漏进来的热', clears: 'seal' },
  { id: 'refill', kind: 'fix', name: '加制冷剂', note: '缺剂了→恢复搬热功率', clears: 'refrigerant' },
  { id: 'rest-compressor', kind: 'fix', name: '让压缩机歇口气', note: '烤降频了→散掉热再战', clears: 'derate' },
  { id: 'wait', kind: 'wait', name: '关上门等一会儿', note: '不动手,让它自己走一步(凉下来/或更糟)' },
]

const HEALTHY: ThermalInput = { pumpWatts: 100, Rcond: 0.1, Tambient: 25, load: 10 }
const COLD = 8       // ℃:柜内到这算够凉
const SPOIL_T = 12   // ℃:超过这个温度食物开始变质
const RELAX = 0.5    // 柜内温每回合朝稳态弛豫的比例
const SPOIL_RATE = 1.2
const PROBE_MUL = 0.4  // 探针"快":摸一下听一下只花小半个回合(取证便宜,鼓励先查)
const WRONG_FIX = 20   // 错处置"慢又亏":拆错零件白耽误一大截工夫——变质额外飙升(乱试代价大)
const HOT = 90       // ℃:散热片到这算"烫"
const HOT_TURNS = 3  // 连续烫这么多回合 → 压缩机烤降频

/** 当前 active 故障 → 求解器输入参数(healthy 基线上叠加)。 */
function paramsOf(faults: Set<Fault>): ThermalInput {
  const p: ThermalInput = { ...HEALTHY }
  if (faults.has('coils')) p.Rcond = 1.0
  if (faults.has('seal')) p.load = 95
  if (faults.has('refrigerant')) p.pumpWatts = 15
  if (faults.has('derate')) p.pumpWatts = p.pumpWatts * 0.4 // 降频:在现有功率上再砍
  return p
}

export type Snapshot = {
  turn: number
  inside: number                          // 柜内温(始终可见——你摸得到)
  spoil: number                           // 0..100 变质
  won: boolean
  lost: boolean
  faults: Fault[]                          // 真值(内部/测试用;UI 不直接显示,要玩家探针+推断)
  known: Partial<Record<Reading, number>> // 已探针读到的真值(UI 显示这些)
  events: string[]                         // 本回合发生了啥
}

export class ThermalDuel {
  faults = new Set<Fault>()
  inside: number
  spoil = 0
  turn = 0
  won = false
  lost = false
  known: Partial<Record<Reading, number>> = {}
  events: string[] = []
  private hotStreak = 0
  private stepMul = 1       // 这一步时钟涨幅倍率(探针便宜)
  private stepAdd = 0       // 这一步额外变质(错处置昂贵)
  cards = CARDS
  mods: RunMods = NO_MODS   // 工具箱修饰符
  hardMul = 1               // 难度:精英/Boss 让时钟涨更快

  /** 数字=随机挑一种真故障开局(防刷);数组=指定(设计关卡/测试用)。mods/hardMul 由跑图层注入。 */
  constructor(initial: Fault[] | number, mods: RunMods = NO_MODS, hardMul = 1) {
    this.mods = mods; this.hardMul = hardMul
    const kinds: Fault[] = ['coils', 'seal', 'refrigerant']
    if (typeof initial === 'number') this.faults.add(kinds[Math.abs(initial) % 3]!)
    else for (const f of initial) this.faults.add(f)
    this.inside = solveThermal(paramsOf(this.faults)).Tinside // 开局已在坏平衡(偏暖)
    for (let i = 0; i < mods.startReveals; i++) this.revealOne()
  }

  /** 亮一个还没探到的读数(工具用)。 */
  revealOne(): boolean {
    for (const k of ['condenser', 'load', 'pump'] as Reading[]) if (this.known[k] === undefined) { this.known[k] = this.read(k); return true }
    return false
  }
  /** 急救包:把变质压回一截。 */
  easeClock(amount: number): void { this.spoil = Math.max(0, this.spoil - amount) }

  private read(r: Reading): number {
    const s = solveThermal(paramsOf(this.faults))
    if (r === 'inside') return this.inside
    if (r === 'condenser') return s.condenserTemp
    if (r === 'load') return paramsOf(this.faults).load
    return paramsOf(this.faults).pumpWatts
  }

  /** 世界回合:故障"行动"——柜内朝稳态弛豫、变质累积、散热片烫太久则烤出次生故障。 */
  private worldTurn() {
    const p = paramsOf(this.faults), s = solveThermal(p)
    this.inside += RELAX * (s.Tinside - this.inside)
    const stateSpoil = this.inside > SPOIL_T ? (this.inside - SPOIL_T) * SPOIL_RATE * this.stepMul : 0
    this.spoil = Math.min(100, this.spoil + (stateSpoil + this.stepAdd) * this.mods.clockMul * this.hardMul)
    this.stepMul = 1; this.stepAdd = 0
    for (let i = 0; i < this.mods.autoRevealPerTurn; i++) this.revealOne() // 监控仪:每回合自动亮一个
    // 故障反扑:散热片持续烫 → 压缩机被烤降频(从 solver 读数涌现的次生故障)
    if (s.condenserTemp >= HOT) this.hotStreak++; else this.hotStreak = 0
    if (this.hotStreak >= HOT_TURNS && this.faults.size > 0 && !this.faults.has('derate')) {
      this.faults.add('derate'); this.hotStreak = 0
      delete this.known.pump // 降频了,之前量的压缩机功率作废——得重新听一次
      this.events.push('⚡ 散热片烫太久,压缩机被烤到降频了!(冒出次生故障,压缩机功率得重量)')
    }
    this.turn++
    if (this.spoil >= 100) this.lost = true
    else if (this.faults.size === 0 && Math.round(this.inside * 10) / 10 <= COLD) this.won = true
  }

  /** 出一张牌 → 世界回合推进 → 返回新快照。 */
  play(cardId: string): Snapshot {
    if (this.won || this.lost) return this.snapshot()
    const card = CARDS.find(c => c.id === cardId)
    this.events = []
    if (!card) return this.snapshot()
    if (card.kind === 'probe') {
      this.stepMul = PROBE_MUL // 取证便宜
      const v = this.read(card.reveal); this.known[card.reveal] = v
      this.events.push(`探针「${card.name}」→ ${labelOf(card.reveal)} = ${v.toFixed(0)}${unitOf(card.reveal)}`)
    } else if (card.kind === 'fix') {
      if (this.faults.has(card.clears)) { this.faults.delete(card.clears); this.events.push(`处置「${card.name}」→ 清掉「${card.clears}」这一层 ✓`) }
      else { this.stepAdd = WRONG_FIX; this.events.push(`处置「${card.name}」→ 拆错地方了!白折腾一大截(变质飙升)`) } // 乱试代价大
    } else {
      this.events.push('关上门等一会儿…')
    }
    this.worldTurn()
    return this.snapshot()
  }

  snapshot(): Snapshot {
    return {
      turn: this.turn, inside: +this.inside.toFixed(1), spoil: +this.spoil.toFixed(0),
      won: this.won, lost: this.lost, faults: [...this.faults], known: { ...this.known }, events: [...this.events],
    }
  }

  // —— 通用回合制外壳的适配 ——
  hand(): GenCard[] { return CARDS.map(c => ({ id: c.id, kind: c.kind, name: c.name, note: c.note })) }
  view(): DuelView {
    const s = this.snapshot()
    const cond = s.known.condenser, load = s.known.load, pump = s.known.pump
    return {
      title: '冰箱 · 不制冷',
      statusLabel: '柜内温度', statusValue: `${s.inside}℃`, statusOk: s.inside <= COLD,
      clockLabel: '变质', clock: s.spoil, clockHint: '放着不停会越攒越多,满了食物全坏',
      readings: [
        { label: '柜内', value: `${s.inside}℃`, ref: '正常≤8℃', off: s.inside > COLD, plain: `柜里现在 ${s.inside}℃,可冰箱得凉到 8℃ 以下才算好——现在太暖了` },
        { label: '散热片', value: cond === undefined ? null : `${cond.toFixed(0)}℃`, ref: '正常≈35℃', off: cond !== undefined && cond >= 80, plain: cond === undefined ? undefined : cond >= 80 ? `后背散热片烫到 ${cond.toFixed(0)}℃!热搬出来了却散不掉(正常也就 35℃ 上下)` : `后背散热片 ${cond.toFixed(0)}℃,不烫,正常(要是堵住散不掉会烫到一百多度)` },
        { label: '漏热', value: load === undefined ? null : `${load.toFixed(0)}W`, ref: '正常≈10', off: load !== undefined && load > 30, plain: load === undefined ? undefined : load > 30 ? `往柜里漏进来的热 ${load.toFixed(0)},太多了(正常也就 10 上下)——多半是门没关严 / 密封条老化` : `漏进来的热 ${load.toFixed(0)},不多,正常` },
        { label: '压缩机', value: pump === undefined ? null : `${pump.toFixed(0)}W`, ref: '正常≈100', off: pump !== undefined && pump < 60, plain: pump === undefined ? undefined : pump < 60 ? `压缩机只使了 ${pump.toFixed(0)} 的劲搬热,没力气(正常满功率约 100)——像缺制冷剂,或它累到降频了` : `压缩机 ${pump.toFixed(0)},满功率在搬热,正常` },
      ],
      turn: s.turn, won: s.won, lost: s.lost, events: s.events,
      wonText: '🎉 修好了!柜内凉透了', lostText: '💀 拖太久,食物全变质了',
    }
  }
}

export function labelOf(r: Reading): string { return r === 'inside' ? '柜内' : r === 'condenser' ? '散热片' : r === 'load' ? '漏热负荷' : '压缩机功率' }
export function unitOf(r: Reading): string { return r === 'load' || r === 'pump' ? 'W' : '℃' }
