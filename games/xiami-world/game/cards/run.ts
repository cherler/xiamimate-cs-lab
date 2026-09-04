/**
 * 房子肉鸽跑图 · 一局的骨架(工具箱流派)。
 * build = 跨电器通用的**工具/技能**(引擎级修饰符,不碰电器专属处置卡);每台电器仍用自己的原生卡。
 * 一局 = 一张线性小图:维修 → 五金店 → 疑难(精英) → 全屋大故障(Boss);越往后时钟涨得越快。
 * 贯穿资源:口碑(血条,修砸掉,归零=被扫地出门这局结束)+ 钱(买工具)。修好一台 → 三选一拿件工具。
 * 这里只放经济/地图/工具(纯逻辑、可测);副本本身仍由真求解器判(ThermalDuel/DnsDuel + mods/hardMul)。
 */
import type { RunMods } from './duel.ts'

export type ToolId = 'buffer' | 'intuition' | 'monitor' | 'firstaid'
export type Tool = { id: ToolId; name: string; desc: string; price: number; consumable?: boolean; mod?: Partial<RunMods> }

export const TOOLS: Record<ToolId, Tool> = {
  buffer: { id: 'buffer', name: '缓冲垫', desc: '时钟涨得慢(变质/断网 ×0.6)', price: 3, mod: { clockMul: 0.6 } },
  intuition: { id: 'intuition', name: '老师傅的直觉', desc: '开局白送一个读数', price: 3, mod: { startReveals: 1 } },
  monitor: { id: 'monitor', name: '监控仪', desc: '每回合自动亮一个未知读数', price: 4, mod: { autoRevealPerTurn: 1 } },
  firstaid: { id: 'firstaid', name: '急救包', desc: '危急时按一下,时钟压回一截(一次性)', price: 2, consumable: true },
}
export const ALL_TOOLS = Object.keys(TOOLS) as ToolId[]

/** 拥有的(非消耗)工具 → 合成 RunMods(叠加)。 */
export function modsOf(tools: ToolId[]): RunMods {
  const m: RunMods = { clockMul: 1, startReveals: 0, autoRevealPerTurn: 0 }
  for (const id of tools) {
    const mod = TOOLS[id].mod; if (!mod) continue
    if (mod.clockMul !== undefined) m.clockMul *= mod.clockMul
    if (mod.startReveals) m.startReveals += mod.startReveals
    if (mod.autoRevealPerTurn) m.autoRevealPerTurn += mod.autoRevealPerTurn
  }
  return m
}

export type NodeType = 'repair' | 'shop' | 'elite' | 'boss'
export type Appliance = 'fridge' | 'router'
export type MapNode = { type: NodeType; appliance?: Appliance; label: string; hardMul: number; reward: number }

/** 线性小图(垂直切片);越往后 hardMul 越大 = 时钟涨更快。 */
export function makeMap(): MapNode[] {
  return [
    { type: 'repair', appliance: 'fridge', label: '厨房 · 冰箱不制冷', hardMul: 1, reward: 4 },
    { type: 'shop', label: '五金店 · 补货', hardMul: 1, reward: 0 },
    { type: 'elite', appliance: 'router', label: '书房 · 路由器(疑难)', hardMul: 1.3, reward: 6 },
    { type: 'boss', appliance: 'fridge', label: '全屋大故障 · 冰箱(双重故障)', hardMul: 1.6, reward: 0 },
  ]
}

export type RunState = {
  rep: number
  money: number
  tools: ToolId[]
  firstaid: number
  map: MapNode[]
  pos: number
  over: 'win' | 'lose' | null
}

export const START_REP = 3
export function startRun(): RunState {
  return { rep: START_REP, money: 5, tools: [], firstaid: 0, map: makeMap(), pos: 0, over: null }
}
export function currentNode(r: RunState): MapNode { return r.map[r.pos]! }
export function runMods(r: RunState): RunMods { return modsOf(r.tools) }

/** 修好一台:赚钱;Boss 修好 = 通关。 */
export function onWin(r: RunState): void {
  const node = currentNode(r)
  r.money += node.reward
  if (node.type === 'boss') r.over = 'win'
}
/** 修砸(时钟爆了):掉口碑;归零 = 这局失败。 */
export function onLose(r: RunState): void {
  r.rep -= 1
  if (r.rep <= 0) { r.rep = 0; r.over = 'lose' }
}
export function advance(r: RunState): void { if (r.pos < r.map.length - 1) r.pos++ }

/** 三选一奖励池:非消耗品拿过就不再出,消耗品(急救包)总能拿。 */
export function rewardChoices(r: RunState): ToolId[] {
  return ALL_TOOLS.filter(id => TOOLS[id].consumable || !r.tools.includes(id)).slice(0, 3)
}
export function takeTool(r: RunState, id: ToolId): void {
  if (TOOLS[id].consumable) r.firstaid += 1
  else if (!r.tools.includes(id)) r.tools.push(id)
}
/** 商店购买:钱够且没重复拥有 → 扣钱入手。 */
export function buyTool(r: RunState, id: ToolId): boolean {
  const t = TOOLS[id]
  if (r.money < t.price || (!t.consumable && r.tools.includes(id))) return false
  r.money -= t.price; takeTool(r, id); return true
}
