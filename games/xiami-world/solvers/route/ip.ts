/**
 * IPv4 地址与前缀 · 纯运算，可单测
 *
 * 一切按真实规则算：点分十进制 ↔ 32 位整数，CIDR 前缀匹配用位运算。
 * 这是路由的地基——路由表查表、"同网段判断"全靠它，错一位验证器就抓得出。
 */

/** 点分十进制 → 32 位无符号整数 */
export function ipToInt(ip: string): number {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`非法 IPv4: ${ip}`)
  }
  return ((p[0]! << 24) | (p[1]! << 16) | (p[2]! << 8) | p[3]!) >>> 0
}

/** 32 位整数 → 点分十进制 */
export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

/** CIDR 前缀，如 "10.1.0.0/16" */
export type Prefix = { network: number; len: number; text: string }

export function parsePrefix(cidr: string): Prefix {
  const [ip, lenStr] = cidr.split('/')
  const len = Number(lenStr)
  if (!ip || !Number.isInteger(len) || len < 0 || len > 32) throw new Error(`非法前缀: ${cidr}`)
  const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0
  const network = (ipToInt(ip) & mask) >>> 0
  return { network, len, text: `${intToIp(network)}/${len}` }
}

/** 一个 IP 落在这个前缀里吗（前 len 位相同） */
export function inPrefix(ip: number, pfx: Prefix): boolean {
  const mask = pfx.len === 0 ? 0 : (0xffffffff << (32 - pfx.len)) >>> 0
  return ((ip & mask) >>> 0) === pfx.network
}

/** 两个 IP 在同一个网段吗（按给定前缀长度） */
export function sameSubnet(a: number, b: number, prefixLen: number): boolean {
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0
  return ((a & mask) >>> 0) === ((b & mask) >>> 0)
}
