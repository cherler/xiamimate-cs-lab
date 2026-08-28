/**
 * 内核：AES 一轮 —— 4×4 状态矩阵走过 SubBytes→ShiftRows→MixColumns→AddRoundKey（安全 · 密码学 · 对称加密）
 * 轴：step —— 用 FIPS-197 官方测试向量,看一个分组在一轮里被怎么搅
 *
 * AES 是当今最主流的对称加密。它把 16 字节明文摆成 4×4 状态矩阵,反复做同一套轮变换:
 *   · SubBytes  逐字节查 S-盒替换  —— 非线性「混淆」,让密文和密钥关系乱
 *   · ShiftRows 每行循环左移(第 r 行移 r)—— 让字节跨列「扩散」
 *   · MixColumns 每列在 GF(2⁸) 里线性混合 —— 让一字节影响整列(扩散)
 *   · AddRoundKey 和轮密钥逐字节异或 —— 把密钥揉进来
 * 用 FIPS-197 附录 B 的向量(明文 3243f6a8…、密钥 2b7e1516…),真 AES 实现,
 * 每个字节可对标标准。SubBytes/ShiftRows/AddRoundKey 可手核,MixColumns 由代码算(GF 运算)。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type AesState = {
  i: number
  step: number
  op: 'intro' | 'addkey0' | 'sub' | 'shift' | 'mix' | 'addkey1'
  mat: number[]        // 16 字节，行主序展示 mat[r*4+c]
  prev: number[]       // 上一步矩阵（高亮变化）
  keyMat: number[]     // AddRoundKey 步展示的轮密钥（否则空）
  phase: 'run' | 'done'
  focus: string
  log: string
}
type Frame = Omit<AesState, 'i'>

// —— GF(2^8) 与 S-盒（程序生成，非手填表）——
const gmul = (a: number, b: number) => { let p = 0; for (let k = 0; k < 8; k++) { if (b & 1) p ^= a; const hi = a & 0x80; a = (a << 1) & 0xff; if (hi) a ^= 0x1b; b >>= 1 } return p }
const ginv = (a: number) => { if (a === 0) return 0; for (let b = 1; b < 256; b++) if (gmul(a, b) === 1) return b; return 0 }
const rotl8 = (x: number, s: number) => ((x << s) | (x >>> (8 - s))) & 0xff
const SBOX: number[] = Array.from({ length: 256 }, (_, a) => { const s = ginv(a); return (s ^ rotl8(s, 1) ^ rotl8(s, 2) ^ rotl8(s, 3) ^ rotl8(s, 4) ^ 0x63) & 0xff })

const hex = (n: number) => n.toString(16).padStart(2, '0')
const parse = (s: string) => s.match(/../g)!.map(h => parseInt(h, 16))

// 明文与密钥（FIPS-197 附录 B），按列主序填进 4×4：mat_row_major[r*4+c] = bytes[c*4+r]
const PT = parse('3243f6a8885a308d313198a2e0370734')
const KEY = parse('2b7e151628aed2a6abf7158809cf4f3c')
const toRowMajor = (bytes: number[]) => { const m = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) m[r * 4 + c] = bytes[c * 4 + r]; return m }

// 轮密钥 1（key expansion，只算 word 4..7）
function roundKey1(): number[] {
  const w: number[][] = [0, 1, 2, 3].map(i => KEY.slice(i * 4, i * 4 + 4))
  const rot = (x: number[]) => [x[1]!, x[2]!, x[3]!, x[0]!]
  const sub = (x: number[]) => x.map(b => SBOX[b]!)
  const t = sub(rot(w[3]!)); t[0]! ^= 0x01 // Rcon[1]=01
  w[4] = w[0]!.map((b, j) => b ^ t[j]!)
  for (let i = 5; i < 8; i++) w[i] = w[i - 1]!.map((b, j) => b ^ w[i - 4]![j]!)
  const bytes = [4, 5, 6, 7].flatMap(i => w[i]!)
  return toRowMajor(bytes)
}

const subBytes = (m: number[]) => m.map(b => SBOX[b]!)
const shiftRows = (m: number[]) => { const o = m.slice(); for (let r = 1; r < 4; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = m[r * 4 + ((c + r) % 4)]!; return o }
const mixCols = (m: number[]) => { const o = new Array(16); for (let c = 0; c < 4; c++) { const a = [0, 1, 2, 3].map(r => m[r * 4 + c]!); o[0 * 4 + c] = gmul(a[0]!, 2) ^ gmul(a[1]!, 3) ^ a[2]! ^ a[3]!; o[1 * 4 + c] = a[0]! ^ gmul(a[1]!, 2) ^ gmul(a[2]!, 3) ^ a[3]!; o[2 * 4 + c] = a[0]! ^ a[1]! ^ gmul(a[2]!, 2) ^ gmul(a[3]!, 3); o[3 * 4 + c] = gmul(a[0]!, 3) ^ a[1]! ^ a[2]! ^ gmul(a[3]!, 2) } return o }
const addKey = (m: number[], k: number[]) => m.map((b, j) => b ^ k[j]!)

export const aesroundKernel: Kernel<AesState> = {
  kind: 'aesround',
  compile(_doc: SimDocument): CompiledModel<AesState> {
    const K0 = toRowMajor(KEY)
    const K1 = roundKey1()
    const s0 = toRowMajor(PT)
    const s1 = addKey(s0, K0)          // AddRoundKey round 0 → 轮 1 起点
    const s2 = subBytes(s1)
    const s3 = shiftRows(s2)
    const s4 = mixCols(s3)
    const s5 = addKey(s4, K1)          // AddRoundKey round 1 → 轮 2 起点

    const frames: Frame[] = []
    const push = (f: Omit<Frame, 'step'>) => frames.push({ step: frames.length, ...f })
    const row = (m: number[]) => [0, 1, 2, 3].map(r => m.slice(r * 4, r * 4 + 4).map(hex).join(' ')).join(' / ')

    push({ op: 'intro', mat: s0, prev: s0, keyMat: [], phase: 'run', focus: '把 16 字节明文摆成 4×4 状态矩阵',
      log: `**明文摆成状态矩阵**（FIPS-197 官方向量）\n明文 = 3243f6a8 885a308d 313198a2 e0370734\n按列填进 4×4：\n${row(s0)}\nAES 就是让这个矩阵反复走一套轮变换。看**一轮**里它被怎么搅。` })
    push({ op: 'addkey0', mat: s1, prev: s0, keyMat: K0, phase: 'run', focus: 'AddRoundKey（轮0）：先和初始密钥异或',
      log: `**AddRoundKey（轮 0）**\n开工先把状态和**初始密钥**逐字节异或(密钥 2b7e1516…)。\n状态 → ${row(s1)}\n这就是「轮 1」的起点。异或可逐字节手核。` })
    push({ op: 'sub', mat: s2, prev: s1, keyMat: [], phase: 'run', focus: 'SubBytes：逐字节查 S-盒替换（混淆）',
      log: `**SubBytes**\n每个字节查 **S-盒**替换(如 19→d4、a0→e0…)。S-盒 = GF(2⁸) 求逆 + 仿射变换，是 AES 唯一的**非线性**步骤，负责「混淆」——把密文和密钥的关系搅乱。\n状态 → ${row(s2)}` })
    push({ op: 'shift', mat: s3, prev: s2, keyMat: [], phase: 'run', focus: 'ShiftRows：第 r 行循环左移 r（扩散）',
      log: `**ShiftRows**\n第 0 行不动，第 1 行左移 1、第 2 行左移 2、第 3 行左移 3(循环)。让字节**跨列扩散**，单看一列不再是原来那几个字节。\n状态 → ${row(s3)}\n（纯位置搬移，可手核）` })
    push({ op: 'mix', mat: s4, prev: s3, keyMat: [], phase: 'run', focus: 'MixColumns：每列在 GF(2⁸) 线性混合（扩散）',
      log: `**MixColumns**\n每一**列**乘一个固定矩阵(在 GF(2⁸) 里做 ×2/×3 与异或)，让一个字节影响整列 4 个字节——强「扩散」。这一步是 GF 运算，值由代码算出。\n状态 → ${row(s4)}` })
    push({ op: 'addkey1', mat: s5, prev: s4, keyMat: K1, phase: 'done', focus: 'AddRoundKey（轮1）：揉进本轮密钥，一轮完成',
      log: `**AddRoundKey（轮 1）**\n和**本轮密钥**(密钥扩展算出)异或，把密钥揉进来。\n状态 → ${row(s5)}\n\n**一轮完成**。对标 FIPS-197：这正是"轮 2 起点" a49c7ff2 689f352b…（列主序）。\nAES-128 一共 **10 轮**（末轮省掉 MixColumns），Sub/Shift/Mix/AddKey 反复叠加：混淆(SubBytes)+扩散(ShiftRows/MixColumns)+密钥混入(AddRoundKey)，几轮后每个密文位都依赖所有明文位和密钥位——这就是现代分组密码的骨架。` })

    const base0: Frame = { op: 'intro', step: -1, mat: s0, prev: s0, keyMat: [], phase: 'run', focus: '', log: '' }
    return {
      axis: { kind: 'step', label: '轮内步' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) { const b = prev ?? this.initial(); const idx = b.i + 1; if (idx >= frames.length) return null; return { state: { i: idx, ...frames[idx]! }, done: idx === frames.length - 1 } },
    }
  },
}
