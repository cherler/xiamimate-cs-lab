/**
 * DNS 横链布局：把仿真的每一"站"排成一条从左到右的路。
 * 信使沿这些站点逐跳移动；每个 Hop 对应一个站的屏幕坐标。
 * V2 会把这条横链弯成爬塔的路，但站点语义不变——只换坐标。
 */
import type { Hop } from '../../solvers/dns/types.ts'

export type Station = { hop: Hop; name: string; x: number; y: number }

/** 1280×720 舞台上的一条链。缓存三站在近处（家门口），权威三站在远处（高塔） */
export const STATIONS: Station[] = [
  { hop: 'hosts',         name: 'hosts',      x: 130, y: 470 },
  { hop: 'browser-cache', name: '浏览器缓存', x: 258, y: 470 },
  { hop: 'os-cache',      name: '系统缓存',   x: 388, y: 470 },
  { hop: 'recursive',     name: '门房·递归',  x: 560, y: 420 },
  { hop: 'root',          name: '根',         x: 758, y: 342 },
  { hop: 'tld',           name: '.com',       x: 948, y: 270 },
  { hop: 'authoritative', name: '权威',       x: 1140, y: 200 },
]

/** 玩家电脑（信使的出发/归来点） */
export const HOME = { x: 62, y: 502 }

export function stationOf(hop: Hop): Station | undefined {
  return STATIONS.find(s => s.hop === hop)
}
