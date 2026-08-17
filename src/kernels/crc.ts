/**
 * 内核：CRC 循环冗余校验（计算机网络 · 数据链路层）
 * 轴：step —— 每步是模 2 除法的一次上商与异或
 *
 * 模 2 除法与普通除法只差一点：**减法换成异或，不借位**。
 * 所以每一步只看被除数当前最高位是不是 1 —— 是就上商 1 并异或，否则上商 0。
 *
 * 两种模式：
 *   encode  发送端：数据后补 r 个 0，除以生成多项式，余数就是 FCS
 *   check   接收端：整个码字（可能带错）再除一次，余数为 0 才算没错
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type CrcState = {
  i: number
  /** 当前被除数的完整位串（会随异或而变） */
  dividend: string
  /** 本步对齐到哪一位（生成多项式左端所在的下标） */
  at: number
  /** 本步上的商 */
  q: string
  /** 本步异或掉的那几位下标 */
  touched: number[]
  /** 当前累积的商 */
  quotient: string
  /** 走完之后的余数（未结束时为空） */
  remainder: string
  phase: 'init' | 'divide' | 'result' | 'verify'
  log: string
}

export const CRC_VISIBLE = [
  'i', 'dividend', 'at', 'q', 'touched', 'quotient', 'remainder', 'phase', 'log',
] as const

type Frame = Omit<CrcState, 'i'>

/** 位串按位异或（等长） */
const xorAt = (a: string, gen: string, at: number) => {
  const out = a.split('')
  for (let k = 0; k < gen.length; k++) {
    out[at + k] = String(Number(out[at + k]) ^ Number(gen[k]))
  }
  return out.join('')
}

export const crcKernel: Kernel<CrcState> = {
  kind: 'crc',

  compile(doc: SimDocument): CompiledModel<CrcState> {
    const generator = str(doc.params, 'generator').replace(/[^01]/g, '')
    const operation = str(doc.params, 'operation')      // 'encode' | 'check'
    const errorAt = num(doc.params, 'errorAt')          // -1 表示不注入错误
    const data = (doc.streams.find(s => s.name === 'dataBits')?.values ?? [])
      .map(v => String(v)).join('').replace(/[^01]/g, '')

    const r = Math.max(0, generator.length - 1)
    const frames: Frame[] = []
    const put = (f: Partial<Frame> & { phase: Frame['phase']; log: string }) => frames.push({
      dividend: frames.at(-1)?.dividend ?? '',
      at: -1, q: '', touched: [],
      quotient: frames.at(-1)?.quotient ?? '',
      remainder: frames.at(-1)?.remainder ?? '',
      ...f,
    })

    /** 跑一遍模 2 除法，逐步入帧；返回余数 */
    const divide = (input: string, tag: string) => {
      let cur = input
      let quotient = ''
      const limit = input.length - r
      for (let at = 0; at < limit; at++) {
        const lead = cur[at]
        if (lead === '1') {
          const before = cur
          cur = xorAt(cur, generator, at)
          const touched = Array.from({ length: generator.length }, (_, k) => at + k)
          quotient += '1'
          put({
            phase: 'divide', dividend: cur, at, q: '1', touched, quotient,
            log: `${tag}第 ${at + 1} 位是 1 → 上商 1，`
              + `与生成多项式 ${generator} 异或：${before.slice(at, at + generator.length)}`
              + ` ⊕ ${generator} = ${cur.slice(at, at + generator.length)}`,
          })
        } else {
          quotient += '0'
          put({
            phase: 'divide', dividend: cur, at, q: '0', touched: [at], quotient,
            log: `${tag}第 ${at + 1} 位是 0 → 上商 0，本位不做异或（模 2 除法不借位）`,
          })
        }
      }
      return { rem: cur.slice(cur.length - r), quotient, full: cur }
    }

    if (operation === 'encode') {
      const padded = data + '0'.repeat(r)
      put({
        phase: 'init', dividend: padded, quotient: '', remainder: '',
        log: `发送端：数据 ${data}（${data.length} 位），生成多项式 ${generator}（${generator.length} 位）`
          + ` → 数据后面补 ${r} 个 0，得到被除数 ${padded}`,
      })
      const { rem } = divide(padded, '')
      const code = data + rem
      put({
        phase: 'result', dividend: code, remainder: rem, touched:
          Array.from({ length: r }, (_, k) => data.length + k),
        log: `余数（FCS）= ${rem}，把它接在数据后面 → 发送的码字是 ${code}`,
      })
    } else {
      //  接收端：先造出正确码字，再按需要翻转某一位
      const padded = data + '0'.repeat(r)
      const fcs = divide(padded, '（先算出正确的 FCS）').rem
      frames.length = 0                                  // 上面那轮只为拿 FCS，不入帧
      let code = data + fcs
      let flipped = -1
      if (errorAt >= 0 && errorAt < code.length) {
        flipped = errorAt
        code = code.slice(0, errorAt) + (code[errorAt] === '1' ? '0' : '1') + code.slice(errorAt + 1)
      }
      put({
        phase: 'init', dividend: code, quotient: '', remainder: '',
        touched: flipped >= 0 ? [flipped] : [],
        log: flipped >= 0
          ? `接收端收到码字 ${code} —— 传输中第 ${flipped + 1} 位被翻转了`
          : `接收端收到码字 ${code}（传输无差错）`,
      })
      const { rem } = divide(code, '')
      const clean = /^0*$/.test(rem)
      put({
        phase: 'verify', dividend: code, remainder: rem,
        log: clean
          ? `余数为 ${rem}（全 0）→ 判定传输无差错，剥掉后 ${r} 位得到数据 ${code.slice(0, -r)}`
          : `余数为 ${rem}（非 0）→ 检出差错，丢弃这一帧`,
      })
    }

    if (frames.length === 0) put({ phase: 'result', dividend: '', log: '没有数据' })

    return {
      axis: { kind: 'step', label: '除法步骤' },
      initial: () => ({
        i: -1, dividend: '', at: -1, q: '', touched: [],
        quotient: '', remainder: '', phase: 'init', log: '',
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
