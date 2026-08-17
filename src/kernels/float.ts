/**
 * 内核：IEEE 754 浮点（计算机组成原理）
 * 轴：step —— 每步是转换/运算过程里的一个环节
 *
 * 两种模式：
 *   encode  一个十进制数怎么变成 32/64 位的那一串 0/1
 *   add     两个浮点数相加：对阶 → 尾数运算 → 规格化 → 舍入
 *
 * 全程用整数位串手算，**不借助宿主的浮点运算** ——
 * 否则"舍入误差从哪来"这个考点就被 JS 的 double 悄悄吃掉了。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type FloatState = {
  i: number
  /** 本步在做什么，视图据此高亮对应的位段 */
  phase: 'sign' | 'int' | 'frac' | 'normalize' | 'exponent' | 'mantissa' | 'assemble'
        | 'align' | 'addsub' | 'round' | 'done' | 'special'
  /** 当前的位串（长度 = 32 或 64）；未定的位用 '?' */
  bits: string
  /** 本步刚确定/改动的位下标 */
  touched: number[]
  /** 面板上要显示的中间量 */
  detail: Record<string, string>
  log: string
}

export const FLOAT_VISIBLE = ['i', 'phase', 'bits', 'touched', 'detail', 'log'] as const

type Fmt = { total: number; expBits: number; manBits: number; bias: number }
const FORMATS: Record<string, Fmt> = {
  single: { total: 32, expBits: 8, manBits: 23, bias: 127 },
  double: { total: 64, expBits: 11, manBits: 52, bias: 1023 },
}

type Frame = Omit<FloatState, 'i'>

/** 十进制整数部分 → 二进制串（不用 toString(2)，逐次除 2 才是考场上的做法） */
function intToBin(n: number): { bin: string; steps: string[] } {
  const steps: string[] = []
  if (n === 0) return { bin: '0', steps: ['0 ÷ 2 = 0 余 0'] }
  let x = n
  let out = ''
  while (x > 0) {
    const r = x % 2
    steps.push(`${x} ÷ 2 = ${Math.floor(x / 2)} 余 ${r}`)
    out = String(r) + out
    x = Math.floor(x / 2)
  }
  return { bin: out, steps }
}

/**
 * 小数部分 → 二进制串（逐次乘 2 取整）。
 *
 * 位数不能写死。像 1e-5 这种数，前面有十几个 0 才轮到第一个 1，
 * 固定取 manBits+8 位就会把有效数字截在半截上（实测 1e-5 编码尾巴全是 0）。
 * 所以按"**见到第一个 1 之后再取 need 位**"来收，另设一个绝对上限兜底。
 */
function fracToBin(f: number, need: number): { bin: string; steps: string[]; exact: boolean } {
  const steps: string[] = []
  const HARD_CAP = 1200                 // 非规格化数最深也就 1074 位
  let x = f
  let out = ''
  let seenOne = false
  let after = 0
  for (let k = 0; k < HARD_CAP && x > 0; k++) {
    x *= 2
    const bit = x >= 1 ? 1 : 0
    if (steps.length < 12) steps.push(`${(x / 2).toFixed(6)} × 2 = ${x.toFixed(6)} → 取整数位 ${bit}`)
    out += bit
    if (bit === 1) { x -= 1; seenOne = true }
    if (seenOne) { after++; if (after > need) break }
  }
  return { bin: out, steps, exact: x === 0 }
}

/** 位串加法（无符号，等长），返回和与进位 */
function addBits(a: string, b: string): { sum: string; carry: number } {
  let carry = 0
  let out = ''
  for (let k = a.length - 1; k >= 0; k--) {
    const s = Number(a[k]) + Number(b[k]) + carry
    out = String(s & 1) + out
    carry = s >> 1
  }
  return { sum: out, carry }
}

/** 位串减法（a − b，要求 a ≥ b），返回差 */
function subBits(a: string, b: string): string {
  let borrow = 0
  let out = ''
  for (let k = a.length - 1; k >= 0; k--) {
    let s = Number(a[k]) - Number(b[k]) - borrow
    if (s < 0) { s += 2; borrow = 1 } else borrow = 0
    out = String(s) + out
  }
  return out
}

const cmpBits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
/** 阶码右对齐（高位补零） */
const pad = (s: string, n: string, len: number) => s.padStart(len, n)
/**
 * 尾数**左对齐**（低位补零）。
 * 一开始两处都用了 padStart，结果 10 的尾数 "010" 被补成 "…00010"，
 * 整串位往右挪了 20 位 —— 编码全错。尾数和阶码的补位方向是相反的。
 */
const padM = (s: string, len: number) => s.padEnd(len, '0')

/** 十进制 → 位串各字段（不经过宿主浮点） */
function encodeFields(value: number, fmt: Fmt) {
  const sign = value < 0 || Object.is(value, -0) ? 1 : 0
  const av = Math.abs(value)
  const ip = Math.floor(av)
  const fp = av - ip
  const { bin: ib, steps: isteps } = intToBin(ip)
  //  多取几位再舍入，不然"舍入"这一步无从演示
  const { bin: fb, steps: fsteps, exact } = fracToBin(fp, fmt.manBits + 8)  // need 是"第一个 1 之后"的位数
  return { sign, ip, fp, ib, fb, isteps, fsteps, exact }
}

export const floatKernel: Kernel<FloatState> = {
  kind: 'float',

  compile(doc: SimDocument): CompiledModel<FloatState> {
    const format = str(doc.params, 'format')
    const operation = str(doc.params, 'operation')      // 'encode' | 'add' | 'sub'
    const fmt = FORMATS[format] ?? FORMATS.single
    const operands = (doc.streams.find(s => s.name === 'operands')?.values ?? []) as number[]
    void num

    const frames: Frame[] = []
    const unknown = '?'.repeat(fmt.total)
    const put = (f: Partial<Frame> & { phase: Frame['phase']; log: string }) =>
      frames.push({ bits: frames.at(-1)?.bits ?? unknown, touched: [], detail: {}, ...f })

    /** 把某段位写进当前位串 */
    const write = (bits: string, at: number, seg: string) =>
      bits.slice(0, at) + seg + bits.slice(at + seg.length)

    // ── encode：一个数怎么变成那串 0/1 ──────────────────
    const runEncode = (value: number, prefix = '') => {
      const f = encodeFields(value, fmt)
      let bits = unknown

      if (value === 0) {
        bits = '0'.repeat(fmt.total)
        put({ phase: 'special', bits, touched: [...Array(fmt.total).keys()],
          detail: { 值: '0' },
          log: `${prefix}0 是特殊值：阶码与尾数全 0（符号位决定 +0 还是 −0）` })
        put({ phase: 'done', bits, log: `${prefix}编码完成` })
        return { bits, fields: f }
      }

      bits = write(bits, 0, String(f.sign))
      put({ phase: 'sign', bits, touched: [0],
        detail: { 原值: String(value), 符号: f.sign ? '负 → 1' : '正 → 0' },
        log: `${prefix}第 1 步 · 符号位：${value} 是${f.sign ? '负' : '正'}数，S = ${f.sign}` })

      put({ phase: 'int', bits,
        detail: { 整数部分: String(f.ip), 二进制: f.ib, 除二取余: f.isteps.join('  ') },
        log: `${prefix}第 2 步 · 整数部分 ${f.ip} 除二取余 → ${f.ib}` })

      put({ phase: 'frac', bits,
        detail: {
          小数部分: String(f.fp),
          二进制: f.fb ? '0.' + f.fb.slice(0, 24) + (f.fb.length > 24 ? '…' : '') : '0',
          是否有限: f.exact ? '有限位可精确表示' : '无限循环，必须截断 —— 舍入误差从这里来',
        },
        log: `${prefix}第 3 步 · 小数部分 ${f.fp} 乘二取整 → 0.${f.fb.slice(0, 16)}${f.fb.length > 16 ? '…' : ''}` })

      //  规格化：把二进制小数点挪到第一个 1 的右边
      const whole = f.ib + f.fb
      const firstOne = whole.indexOf('1')
      const pointAt = f.ib.length          // 小数点原本的位置
      const e = pointAt - firstOne - 1     // 1.xxx × 2^e
      const mantissaAll = whole.slice(firstOne + 1)

      put({ phase: 'normalize', bits,
        detail: {
          规格化前: `${f.ib}.${f.fb.slice(0, 12)}${f.fb.length > 12 ? '…' : ''}`,
          规格化后: `1.${mantissaAll.slice(0, 12)}${mantissaAll.length > 12 ? '…' : ''} × 2^${e}`,
          阶码E: String(e),
        },
        log: `${prefix}第 4 步 · 规格化：小数点左移 ${e} 位，写成 1.M × 2^${e}（隐含的那个 1 不存进去）` })

      const expVal = e + fmt.bias
      const expBin = pad(intToBin(expVal).bin, '0', fmt.expBits)
      bits = write(bits, 1, expBin)
      put({ phase: 'exponent', bits,
        touched: Array.from({ length: fmt.expBits }, (_, k) => 1 + k),
        detail: { 真值e: String(e), 偏置: String(fmt.bias), 移码E: `${e} + ${fmt.bias} = ${expVal}`, 二进制: expBin },
        log: `${prefix}第 5 步 · 阶码用移码：${e} + ${fmt.bias} = ${expVal} → ${expBin}` })

      //  舍入：就近偶数（IEEE 754 默认）
      const keep = mantissaAll.slice(0, fmt.manBits)
      const rest = mantissaAll.slice(fmt.manBits)
      const kept = padM(keep, fmt.manBits).slice(0, fmt.manBits)
      let manBin = kept
      let roundedUp = false
      if (rest.length > 0 && rest[0] === '1') {
        const stickyOne = rest.slice(1).includes('1')
        const lsbOne = kept[fmt.manBits - 1] === '1'
        if (stickyOne || lsbOne) {          // 大于半 → 进；正好半 → 向偶数
          const { sum } = addBits(kept, pad('1', '0', fmt.manBits))   // 加 1 是加在末位，右对齐
          manBin = sum
          roundedUp = true
        }
      }
      bits = write(bits, 1 + fmt.expBits, manBin)
      put({ phase: 'mantissa', bits,
        touched: Array.from({ length: fmt.manBits }, (_, k) => 1 + fmt.expBits + k),
        detail: {
          尾数全长: mantissaAll.length > 40 ? mantissaAll.slice(0, 40) + '…' : mantissaAll || '（全 0）',
          保留: String(fmt.manBits) + ' 位',
          舍去部分: rest.slice(0, 12) || '（无）',
          舍入: rest.length === 0 ? '不需要舍入'
            : roundedUp ? '就近舍入 → 进 1' : '就近舍入 → 舍去',
        },
        log: `${prefix}第 6 步 · 尾数取 ${fmt.manBits} 位${rest.length === 0 ? '（正好装下）'
          : roundedUp ? '，舍去部分过半，末位进 1' : '，舍去部分不足半，直接截断'}` })

      put({ phase: 'assemble', bits, touched: [...Array(fmt.total).keys()],
        detail: {
          符号: bits[0],
          阶码: bits.slice(1, 1 + fmt.expBits),
          尾数: bits.slice(1 + fmt.expBits),
          十六进制: '0x' + BigInt('0b' + bits).toString(16).toUpperCase().padStart(fmt.total / 4, '0'),
        },
        log: `${prefix}第 7 步 · 拼装：1 位符号 + ${fmt.expBits} 位阶码 + ${fmt.manBits} 位尾数` })

      return { bits, fields: f }
    }

    if (operation === 'encode') {
      const v = operands[0] ?? 0
      runEncode(v)
      put({ phase: 'done', log: `${v} 的 IEEE 754 ${format === 'double' ? '双' : '单'}精度编码完成` })
    } else {
      // ── add / sub：对阶 → 尾数运算 → 规格化 → 舍入 ────
      const sub = operation === 'sub'
      const a = operands[0] ?? 0
      const b = (operands[1] ?? 0) * (sub ? -1 : 1)

      const fa = encodeFields(a, fmt)
      const fb = encodeFields(b, fmt)
      const expOf = (f: ReturnType<typeof encodeFields>) => {
        const whole = f.ib + f.fb
        const one = whole.indexOf('1')
        return one < 0 ? null : f.ib.length - one - 1
      }
      const manOf = (f: ReturnType<typeof encodeFields>, ext: number) => {
        const whole = f.ib + f.fb
        const one = whole.indexOf('1')
        if (one < 0) return '0'.repeat(ext + 1)
        return padM(('1' + whole.slice(one + 1)).slice(0, ext + 1), ext + 1)
      }
      const EXT = fmt.manBits + 3            // 多留几位保护位，舍入才有得可看

      const ea = expOf(fa), eb = expOf(fb)
      put({ phase: 'special', bits: unknown,
        detail: {
          [`x = ${a}`]: ea === null ? '0' : `1.${manOf(fa, EXT).slice(1, 13)}… × 2^${ea}`,
          [`y = ${operands[1] ?? 0}${sub ? '（减法当作加负数）' : ''}`]:
            eb === null ? '0' : `1.${manOf(fb, EXT).slice(1, 13)}… × 2^${eb}`,
        },
        log: `先把两个数都写成规格化形式 1.M × 2^E` })

      if (ea === null || eb === null) {
        const keep = ea === null ? b : a
        const r = runEncode(keep, '和就是非零的那个数：')
        put({ phase: 'done', bits: r.bits, log: `一个加数为 0，结果等于另一个加数` })
      } else {
        const hi = ea >= eb ? 'x' : 'y'
        const eBig = Math.max(ea, eb), eSmall = Math.min(ea, eb)
        const shift = eBig - eSmall
        let mA = manOf(fa, EXT), mB = manOf(fb, EXT)
        const shifted = ea < eb ? 'x' : 'y'
        const before = ea < eb ? mA : mB
        //  右移是把整串往右挪，高位补零 —— 这里 padStart 才对
        const after = pad(before.slice(0, before.length - shift), '0', before.length)

        if (ea < eb) mA = after; else mB = after

        put({ phase: 'align', bits: unknown,
          detail: {
            阶差: `${eBig} − ${eSmall} = ${shift}`,
            谁移位: `${shifted}（阶码小的那个）`,
            移位前: before.slice(0, 16) + '…',
            移位后: after.slice(0, 16) + '…',
            对阶原则: '小阶向大阶看齐 —— 反过来会丢掉高位有效数字',
          },
          log: shift === 0 ? '第 1 步 · 对阶：两数阶码相同，不用移位'
            : `第 1 步 · 对阶：${shifted} 的尾数右移 ${shift} 位，阶码统一为 ${eBig}` })

        const sameSign = fa.sign === fb.sign
        let man: string
        let resSign = fa.sign
        let carry = 0
        if (sameSign) {
          const r = addBits(mA, mB)
          man = r.sum; carry = r.carry
        } else {
          //  异号相加 = 大的减小的，结果取大的符号
          const c = cmpBits(mA, mB)
          if (c >= 0) { man = subBits(mA, mB); resSign = fa.sign }
          else { man = subBits(mB, mA); resSign = fb.sign }
        }
        put({ phase: 'addsub', bits: unknown,
          detail: {
            x尾数: mA.slice(0, 18) + '…',
            y尾数: mB.slice(0, 18) + '…',
            运算: sameSign ? '同号 → 尾数相加' : '异号 → 大的减小的，结果取大数的符号',
            结果: (carry ? '1.' : '') + man.slice(0, 18) + '…',
            进位: carry ? '有进位，需要右规' : '无进位',
          },
          log: `第 2 步 · 尾数${sameSign ? '相加' : '相减'}${carry ? '，产生进位' : ''}` })

        //  规格化
        let e = eBig
        if (carry) { man = '1' + man.slice(0, man.length - 1); e += 1 }
        else {
          let lead = man.indexOf('1')
          if (lead < 0) { man = '0'.repeat(man.length); e = -fmt.bias }
          else if (lead > 0) { man = man.slice(lead) + '0'.repeat(lead); e -= lead }
        }
        put({ phase: 'normalize', bits: unknown,
          detail: {
            规格化后: `1.${man.slice(1, 17)}… × 2^${e}`,
            方向: carry ? '右规一位，阶码 +1' : '左规，阶码相应减小',
          },
          log: `第 3 步 · 规格化：${carry ? '有进位则右规' : '首位不是 1 则左规'}，阶码变为 ${e}` })

        const keep = man.slice(1, 1 + fmt.manBits)
        const rest = man.slice(1 + fmt.manBits)
        let manBin = padM(keep, fmt.manBits)
        let up = false
        if (rest.length && rest[0] === '1' &&
            (rest.slice(1).includes('1') || manBin[fmt.manBits - 1] === '1')) {
          manBin = addBits(manBin, pad('1', '0', fmt.manBits)).sum
          up = true
        }
        const expVal = e + fmt.bias
        const bits = String(resSign) + pad(intToBin(expVal).bin, '0', fmt.expBits) + manBin
        put({ phase: 'round', bits, touched: [...Array(fmt.total).keys()],
          detail: {
            保留: manBin.slice(0, 20) + '…',
            舍去: rest.slice(0, 8) || '（无）',
            舍入: rest.length === 0 ? '无需舍入' : up ? '进 1' : '截断',
            最终: `${resSign ? '−' : '+'}1.M × 2^${e}`,
          },
          log: `第 4 步 · 舍入到 ${fmt.manBits} 位${up ? '，末位进 1' : ''}` })
        put({ phase: 'done', bits, log: `${a} ${sub ? '−' : '+'} ${operands[1] ?? 0} 的浮点运算完成` })
      }
    }

    if (frames.length === 0) put({ phase: 'done', bits: unknown, log: '没有操作数' })

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({ i: -1, phase: 'sign', bits: unknown, touched: [], detail: {}, log: '' }),
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
