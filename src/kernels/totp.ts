/**
 * 内核：TOTP 动态口令 —— 手机验证器每 30 秒变的 6 位码怎么来的（安全 · 密码学 · 认证）
 * 轴：step —— 当前时间 → 除 30 取整=时间窗 T → HMAC(K,T) → 截断成 6 位码
 *
 * TOTP(Google Authenticator/各种二次验证)：手机和服务器**不通信**，却能各自算出同一个 6 位码——
 * 因为它们共享同一个密钥 K，又都看当前时间：把时间按 30 秒切成"窗口" T=⌊t/30⌋，
 * 码 = 截断( HMAC(K, T) ) 取 6 位。
 *   · 同一个 30 秒窗口内，T 不变 → 码不变（所以有 30 秒有效期）
 *   · 跨到下一个窗口，T+1 → HMAC 全变 → 新码
 *   · 服务器用同一 K + 当前时间算同一个码，一致就放行；为容忍时钟差，允许 ±1 个窗口
 * 为能算，用玩具 HMAC=FNV 滚动哈希 mod 10⁶（结构真实、码由代码算，可复算核对）。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type TotpState = {
  i: number
  step: number
  op: 'intro' | 'code' | 'same' | 'next' | 'verify'
  t: number            // 当前时间（秒）
  T: number            // 时间窗 = floor(t/30)
  code: string         // 本步的 6 位码
  prevCode: string     // 上一步的码（对比"变没变"）
  history: { t: number; T: number; code: string }[]  // 已算过的
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<TotpState, 'i'>

const STEP_SEC = 30
const K = [0x4b, 0x65, 0x79, 0x31]   // 'Key1'
const fnv = (bytes: number[]) => { let h = 2166136261 >>> 0; for (const b of bytes) { h = (h ^ b) >>> 0; h = Math.imul(h, 16777619) >>> 0 } return h >>> 0 }
const codeOf = (T: number) => String(fnv([...K, T & 0xff, (T >> 8) & 0xff]) % 1000000).padStart(6, '0')
const winOf = (t: number) => Math.floor(t / STEP_SEC)

export const totpKernel: Kernel<TotpState> = {
  kind: 'totp',
  compile(_doc: SimDocument): CompiledModel<TotpState> {
    const frames: Frame[] = []
    const hist: { t: number; T: number; code: string }[] = []
    let prev = ''
    const push = (f: Omit<Frame, 'step' | 'prevCode' | 'history'>) => { frames.push({ step: frames.length, prevCode: prev, history: hist.map(h => ({ ...h })), ...f }); prev = f.code }

    push({ op: 'intro', t: 0, T: 0, code: '', phase: 'run', focus: '手机每 30 秒变的 6 位码，从哪来？',
      log: `**TOTP 动态口令**（Google Authenticator / 二次验证）\n手机和服务器**不联网通信**，却各自算出同一个 6 位码。靠两样都有的东西：**共享密钥 K** + **当前时间**。\n把时间按 30 秒切成"窗口" T=⌊t/30⌋，码 = 截断( HMAC(K, T) ) 取 6 位。看它怎么随时间变。` })

    { const t = 0, T = winOf(t), code = codeOf(T); hist.push({ t, T, code })
      push({ op: 'code', t, T, code, phase: 'run', focus: `t=${t}s → 窗口 T=${T} → 算出码`,
        log: `**t = ${t}s**\n① 时间窗 T = ⌊${t}/30⌋ = **${T}**\n② HMAC(K, ${T}) → 一串哈希\n③ 截断取 6 位 → 码 = **${code}**\n这就是此刻手机屏上显示的动态口令。` }) }

    { const t = 15, T = winOf(t), code = codeOf(T)
      push({ op: 'same', t, T, code, phase: 'run', focus: `t=${t}s：还在同一窗口 → 码不变`,
        log: `**t = ${t}s**\nT = ⌊${t}/30⌋ = **${T}**，和刚才**同一个窗口** → 码还是 **${code}**（没变）。\n所以一个码在这 30 秒里一直有效——你有时间把它敲进去。` }) }

    { const t = 30, T = winOf(t), code = codeOf(T); hist.push({ t, T, code })
      push({ op: 'next', t, T, code, phase: 'run', focus: `t=${t}s：跨到下一窗口 → 换新码`,
        log: `**t = ${t}s**\nT = ⌊${t}/30⌋ = **${T}**，**跳到新窗口**！HMAC(K, ${T}) 全变 → 新码 = **${code}**（旧码 ${prev} 作废）。\n每过 30 秒就翻一个新码，截屏偷走的旧码很快失效。` }) }

    { const t = 30, T = winOf(t), code = codeOf(T)
      push({ op: 'verify', t, T, code, phase: 'done', focus: '服务器验证：同 K 同时间算同一个码',
        log: `**服务器怎么验**\n你把码 ${code} 提交，服务器**用同一个 K + 它自己的当前时间**算 T=${T} 的码，一致 → 放行。全程没传过密钥、没联网对表。\n为容忍两边时钟略有偏差，服务器一般同时校验 **T−1、T、T+1** 三个窗口（±30 秒）。\n\n要点：**共享密钥 + 时间窗 + HMAC** 让双方离线算出同一串一次性码。这就是 TOTP(RFC 6238)——各种 App 的二次验证、动态令牌都用它。` }) }

    const base0: Frame = { op: 'intro', step: -1, t: 0, T: 0, code: '', prevCode: '', history: [], phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '时间步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(p) { const b = p ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
