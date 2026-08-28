/**
 * 内核：HMAC —— 用嵌套哈希给消息盖一个"只有持密钥者能算"的防篡改标签（安全 · 密码学 · 完整性）
 * 轴：step —— K⊕ipad → 内层哈希 → K⊕opad → 外层哈希 = HMAC，再演示篡改被发现
 *
 * MAC(消息认证码)= 给消息盖个标签,收方用同一密钥重算、一比对就知道有没有被改。
 * 直接 H(m) 不行(没密钥,谁都能算标签);H(K‖m) 也不行(Merkle-Damgård 哈希有"长度扩展攻击":
 *   攻击者知道 H(K‖m) 就能算出 H(K‖m‖pad‖m') 而不需要 K)。
 * HMAC 用**两层嵌套**堵住:HMAC(K,m)=H( (K⊕opad) ‖ H( (K⊕ipad) ‖ m ) )。
 *   ipad=0x36×B、opad=0x5c×B,密钥在内外两层各揉一次,长度扩展就失效。
 * 为了能算,用玩具哈希 H(x)=逐字节 h=(h*31+b) mod 256(结构真实、值由代码算)。
 * 值:K⊕ipad/opad 的异或可逐字节手核;两次哈希由代码算,篡改后标签必变→收方拒收。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type HmacState = {
  i: number
  step: number
  op: 'intro' | 'ipad' | 'inner' | 'opad' | 'outer' | 'verify'
  K: number[]
  m: number[]
  ki: number[]        // K⊕ipad
  ko: number[]        // K⊕opad
  inner: number       // 内层哈希结果（-1 未算）
  mac: number         // HMAC（-1 未算）
  tamperM: number[]   // 篡改后的消息
  tamperMac: number   // 篡改后重算的 HMAC（-1 未到验证步）
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<HmacState, 'i'>

const IPAD = 0x36
const OPAD = 0x5c
const K = [0x4b, 0x65, 0x79, 0x31]   // 'Key1'（= 块大小 B=4）
const M = [0x48, 0x69]               // 'Hi'
const M2 = [0x48, 0x6a]              // 'Hj'（改了第 2 字节）
const H = (bytes: number[]) => { let h = 0; for (const b of bytes) h = (h * 31 + b) & 0xff; return h }
const hex = (n: number) => n.toString(16).padStart(2, '0')
const hx = (a: number[]) => a.map(hex).join(' ')

export const hmacKernel: Kernel<HmacState> = {
  kind: 'hmac',
  compile(_doc: SimDocument): CompiledModel<HmacState> {
    const ki = K.map(k => k ^ IPAD)
    const ko = K.map(k => k ^ OPAD)
    const inner = H([...ki, ...M])
    const mac = H([...ko, inner])
    const tInner = H([...ki, ...M2])
    const tMac = H([...ko, tInner])

    const frames: Frame[] = []
    const empty = { ki: [] as number[], ko: [] as number[], inner: -1, mac: -1, tamperM: [] as number[], tamperMac: -1 }
    const push = (f: Omit<Frame, 'step' | 'K' | 'm'>) => frames.push({ step: frames.length, K: [...K], m: [...M], ...f })

    push({ ...empty, op: 'intro', phase: 'run', focus: 'MAC：给消息盖一个只有持密钥者能算的标签',
      log: `**要给消息盖"防篡改标签"（MAC）**\n收方用同一密钥重算标签、一比对就知道有没有被改。\n· 直接 H(m)？没密钥——**谁都能算**，挡不住伪造。\n· H(K‖m)？很多哈希有**长度扩展攻击**：知道 H(K‖m) 就能续算 H(K‖m‖…)，不用 K。\nHMAC 用**两层嵌套**堵住：HMAC = H( (K⊕opad) ‖ H( (K⊕ipad) ‖ m ) )。密钥 K='Key1'，消息 m='Hi'。` })

    push({ ...empty, op: 'ipad', ki, phase: 'run', focus: '内层：K ⊕ ipad（ipad=0x36 重复）',
      log: `**第 1 步：K ⊕ ipad**\n把密钥和 ipad(=0x36 重复)逐字节异或：\nK      = ${hx(K)}\nⓘpad  = 36 36 36 36\nK⊕ipad = ${hx(ki)}（可逐字节手核）` })

    push({ ...empty, op: 'inner', ki, inner, phase: 'run', focus: '内层哈希 inner = H(K⊕ipad ‖ m)',
      log: `**第 2 步：内层哈希**\n把 (K⊕ipad) 拼上消息 m，一起哈希：\ninner = H(${hx(ki)} ‖ ${hx(M)}) = **${hex(inner)}**\n（玩具哈希 h=(h*31+b) mod 256，结构和真 HMAC 一致）` })

    push({ ...empty, op: 'opad', ki, ko, inner, phase: 'run', focus: '外层：K ⊕ opad（opad=0x5c 重复）',
      log: `**第 3 步：K ⊕ opad**\n换 opad(=0x5c 重复)再和密钥异或：\nK      = ${hx(K)}\nⓞpad  = 5c 5c 5c 5c\nK⊕opad = ${hx(ko)}\n密钥在内外两层各揉一次——这正是堵住长度扩展的关键。` })

    push({ ...empty, op: 'outer', ki, ko, inner, mac, phase: 'run', focus: 'HMAC = H(K⊕opad ‖ inner)',
      log: `**第 4 步：外层哈希 = HMAC**\n把 (K⊕opad) 拼上内层结果再哈希：\nHMAC = H(${hx(ko)} ‖ ${hex(inner)}) = **${hex(mac)}**\n这个 ${hex(mac)} 就是消息 'Hi' 的认证标签，随消息一起发给收方。` })

    push({ ...empty, op: 'verify', ki, ko, inner, mac, tamperM: M2, tamperMac: tMac, phase: 'done', focus: '篡改演示：改一个字节，标签对不上',
      log: `**验证 / 篡改**\n攻击者把消息从 'Hi'(${hx(M)}) 改成 'Hj'(${hx(M2)})，但**没有密钥 K**。\n收方用 K 重算：新 HMAC = ${hex(tMac)} ≠ 附带的 ${hex(mac)} → **判定被篡改，拒收**。\n\n关键：没有 K 就**算不出**正确标签，改一个字节标签就对不上。HMAC = 密钥 + 哈希 = 既防伪造又防篡改。真实里用 HMAC-SHA256，TLS、JWT、API 签名、微信支付回调验签全靠它。` })

    const base0: Frame = { op: 'intro', step: -1, K: [...K], m: [...M], ...empty, phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: 'HMAC 步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
