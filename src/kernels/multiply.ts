/**
 * 内核：定点数乘除逐步（计算机组成原理）
 * 轴：step —— 每步是一次"判断 → 加减 → 移位"
 *
 * 三种算法：
 *   原码一位乘  逐位看乘数末位，决定加不加被乘数，然后右移
 *   Booth       看乘数末位与附加位的组合（00/11 不动、01 加、10 减）
 *   加减交替    除法，不恢复余数：靠上一轮余数的正负决定这一轮加还是减
 *
 * 全程用位串手算，不借宿主的乘除 —— 否则"为什么要移位"这个考点就没了。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type MulState = {
  i: number
  /** 轮次（从 1 开始）；0 表示初始化 */
  round: number
  /** 部分积（高位）—— 除法里是余数 */
  hi: string
  /** 乘数 / 商（低位） */
  lo: string
  /** Booth 的附加位 */
  extra: string
  /** 本步的动作 */
  act: 'init' | 'add' | 'sub' | 'none' | 'shift' | 'correct' | 'done'
  /** 本步依据的判断位 */
  judge: string
  /** 除法专用：当前商与余数的十进制值（乘法时为 null）。
   *  显式吐出来，免得靠位串反解还要猜是补码还是原码。 */
  q: number | null
  rem: number | null
  log: string
}

export const MUL_VISIBLE =
  ['i', 'round', 'hi', 'lo', 'extra', 'act', 'judge', 'q', 'rem', 'log'] as const

type Frame = Omit<MulState, 'i'>

/** n 位补码位串 */
const toComp = (v: number, n: number): string => {
  const m = ((v % (1 << n)) + (1 << n)) % (1 << n)
  return m.toString(2).padStart(n, '0')
}
const fromComp = (s: string): number => {
  const v = parseInt(s, 2)
  return s[0] === '1' ? v - (1 << s.length) : v
}
const negComp = (s: string) => toComp(-fromComp(s), s.length)

/** 等长补码加法，溢出位直接丢（模 2^n） */
function addC(a: string, b: string): string {
  let carry = 0, out = ''
  for (let k = a.length - 1; k >= 0; k--) {
    const s = Number(a[k]) + Number(b[k]) + carry
    out = String(s & 1) + out
    carry = s >> 1
  }
  return out
}

export const multiplyKernel: Kernel<MulState> = {
  kind: 'multiply',

  compile(doc: SimDocument): CompiledModel<MulState> {
    const algorithm = str(doc.params, 'algorithm')
    const bits = num(doc.params, 'bits')
    const ops = (doc.streams.find(s => s.name === 'operands')?.values ?? []) as number[]
    const x = ops[0] ?? 0        // 被乘数 / 被除数
    const y = ops[1] ?? 1        // 乘数 / 除数

    const frames: Frame[] = []
    const put = (f: Partial<Frame> & { act: Frame['act']; log: string }) => frames.push({
      round: frames.at(-1)?.round ?? 0,
      hi: frames.at(-1)?.hi ?? '0'.repeat(bits),
      lo: frames.at(-1)?.lo ?? '0'.repeat(bits),
      extra: frames.at(-1)?.extra ?? '',
      judge: '', q: null, rem: null, ...f,
    })

    const X = toComp(x, bits)
    const Y = toComp(y, bits)
    const negX = negComp(X)

    if (algorithm === 'Booth') {
      let hi = '0'.repeat(bits)
      let lo = Y
      let extra = '0'
      put({ act: 'init', round: 0, hi, lo, extra,
        log: `初始化：部分积 = 0，乘数 = ${Y}（${y}），末尾补一个附加位 0` })

      for (let r = 1; r <= bits; r++) {
        const pair = lo[bits - 1] + extra
        let act: Frame['act'] = 'none'
        let why: string
        if (pair === '01') { hi = addC(hi, X); act = 'add'; why = `01 → 部分积 + [X]补（+${x}）` }
        else if (pair === '10') { hi = addC(hi, negX); act = 'sub'; why = `10 → 部分积 − [X]补（−${x}）` }
        else why = `${pair} → 不加不减`
        put({ act, round: r, hi, lo, extra, judge: pair,
          log: `第 ${r} 轮 · 判断位 ${lo[bits - 1]}${extra} = ${pair}：${why}` })

        //  算术右移一位：hi 的符号位保持，hi 的最低位挤进 lo，lo 的最低位成为新附加位
        extra = lo[bits - 1]
        lo = hi[bits - 1] + lo.slice(0, bits - 1)
        hi = hi[0] + hi.slice(0, bits - 1)
        put({ act: 'shift', round: r, hi, lo, extra,
          log: `第 ${r} 轮 · 算术右移一位：符号位不变，最低位挤进乘数寄存器` })
      }
      const prod = fromComp(hi + lo)
      put({ act: 'done', round: bits, hi, lo, extra,
        log: `Booth 完成：${x} × ${y} = ${prod}（乘积 ${hi}${lo}）` })
    }

    else if (algorithm === '原码一位乘') {
      //  原码乘：符号单独处理，数值部分用绝对值
      const sign = (x < 0 ? 1 : 0) ^ (y < 0 ? 1 : 0)
      const ax = toComp(Math.abs(x), bits)
      const ay = toComp(Math.abs(y), bits)
      let hi = '0'.repeat(bits)
      let lo = ay
      put({ act: 'init', round: 0, hi, lo, extra: '',
        log: `原码乘：符号位单独算 —— ${x < 0 ? 1 : 0} ⊕ ${y < 0 ? 1 : 0} = ${sign}；`
          + `数值部分用绝对值 |${x}| × |${y}|` })

      for (let r = 1; r <= bits; r++) {
        const b = lo[bits - 1]
        if (b === '1') hi = addC(hi, ax)
        put({ act: b === '1' ? 'add' : 'none', round: r, hi, lo, judge: b,
          log: `第 ${r} 轮 · 乘数末位 = ${b}：${b === '1' ? `部分积 + |X|（+${Math.abs(x)}）` : '不加'}` })
        //  逻辑右移（原码没有符号扩展）
        lo = hi[bits - 1] + lo.slice(0, bits - 1)
        hi = '0' + hi.slice(0, bits - 1)
        put({ act: 'shift', round: r, hi, lo,
          log: `第 ${r} 轮 · 逻辑右移一位（原码补 0，不是补符号位）` })
      }
      const mag = parseInt(hi + lo, 2)
      put({ act: 'done', round: bits, hi, lo,
        log: `原码一位乘完成：数值 ${mag}，符号 ${sign} → ${x} × ${y} = ${sign ? -mag : mag}` })
    }

    else {
      // ── 加减交替法（不恢复余数）────────────────────────
      //  第一版按"补码直接除"写，商和余数都对不上定义式。
      //  改成教材里先讲的形式：符号单独算，数值部分用绝对值做加减交替。
      //  每轮的判据是**上一轮余数的正负**，这正是"不恢复余数"省下的那一步。
      const AX = Math.abs(x), AY = Math.abs(y)
      const qSign = (x < 0) !== (y < 0) ? -1 : 1
      const rSign = x < 0 ? -1 : 1
      const wide = bits + 1                       // 余数要多一位放符号
      const showR = (v: number) => toComp(v, wide)

      let R = 0
      let qbits = ''
      const xb = toComp(AX, bits)

      put({ act: 'init', round: 0, hi: showR(0), lo: '0'.repeat(bits), q: 0, rem: 0,
        log: `加减交替法：|被除数| = ${AX}（${xb}），|除数| = ${AY}；`
          + `商的符号 ${x < 0 ? '−' : '+'} ⊕ ${y < 0 ? '−' : '+'} = ${qSign < 0 ? '负' : '正'}，`
          + `余数符号跟被除数走` })

      for (let r = 1; r <= bits; r++) {
        const inBit = Number(xb[r - 1])
        const wasNeg = R < 0
        //  余数为正就减除数，为负就加除数 —— 不必先把上一步减错的加回来
        R = 2 * R + inBit + (wasNeg ? AY : -AY)
        const bit = R >= 0 ? 1 : 0
        qbits += String(bit)
        put({
          act: wasNeg ? 'add' : 'sub', round: r, judge: String(bit),
          hi: showR(R), lo: qbits.padStart(bits, '0'),
          q: parseInt(qbits, 2), rem: R,
          log: `第 ${r} 轮 · 余数左移一位并落下被除数第 ${r} 位（${inBit}），`
            + `上一步余数为${wasNeg ? '负 → 加' : '正 → 减'}除数 → ${R}；`
            + `${R >= 0 ? '结果非负' : '结果为负'} → 上商 ${bit}`,
        })
      }

      let corrected = false
      if (R < 0) { R += AY; corrected = true }
      const qv = parseInt(qbits, 2) * qSign
      const rv = R * rSign
      put({
        act: 'correct', round: bits, hi: showR(R), lo: qbits.padStart(bits, '0'),
        q: qv, rem: rv,
        log: corrected
          ? `末轮余数为负，加一次除数把它恢复成正确的余数 → ${R}`
          : `末轮余数非负，无需恢复`,
      })
      put({
        act: 'done', round: bits, hi: showR(R), lo: qbits.padStart(bits, '0'),
        q: qv, rem: rv,
        log: `${x} ÷ ${y} = 商 ${qv} 余 ${rv}（验算：${qv} × ${y} + ${rv} = ${qv * y + rv}）`,
      })
    }

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({
        i: -1, round: 0, hi: '0'.repeat(bits), lo: '0'.repeat(bits),
        extra: '', act: 'init', judge: '', q: null, rem: null, log: '',
      }),
      describe: s => s.log,
      step(prev) {
        const base = prev ?? this.initial()
        const i = base.i + 1
        if (i >= frames.length) return null
        return { state: { i, ...frames[i] }, done: i === frames.length - 1 }
      },
    }
  },
}
