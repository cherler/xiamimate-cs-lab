/**
 * DNS 送信之路 · 角色布局
 *
 * 每一"站"= 一个活角色精灵（路A：角色本身就是节点，反馈发生在角色身上）。
 * 一条从左下（你的电脑）爬到右上（权威塔）的路，越往上塔越大=纵深。
 * root/tld/authoritative 都是权威侧的塔，复用塔精灵、只是越来越大。
 */
import type { Hop } from '../../solvers/dns/types.ts'

export type Station = {
  hop: Hop
  name: string
  x: number
  y: number
  /** 精灵贴图 key；无（hosts）用简单绘制 */
  sprite?: 'dns-cabinet' | 'dns-doorman' | 'dns-tower'
  /** 精灵目标高度（px），按角色重要性/纵深定 */
  h?: number
}

export const STATIONS: Station[] = [
  { hop: 'hosts',         name: 'hosts',      x: 195, y: 566 },
  { hop: 'browser-cache', name: '浏览器缓存', x: 335, y: 548, sprite: 'dns-cabinet', h: 132 },
  { hop: 'os-cache',      name: '系统缓存',   x: 490, y: 528, sprite: 'dns-cabinet', h: 132 },
  { hop: 'recursive',     name: '门房·递归',  x: 675, y: 486, sprite: 'dns-doorman', h: 158 },
  { hop: 'root',          name: '根',         x: 852, y: 410, sprite: 'dns-tower',   h: 130 },
  { hop: 'tld',           name: '.com',       x: 1010, y: 330, sprite: 'dns-tower',  h: 158 },
  { hop: 'authoritative', name: '权威',       x: 1158, y: 236, sprite: 'dns-tower',  h: 188 },
]

/** 你的电脑（信使出发/归来） */
export const HOME = { x: 78, y: 588 }

export function stationOf(hop: Hop): Station | undefined {
  return STATIONS.find(s => s.hop === hop)
}
