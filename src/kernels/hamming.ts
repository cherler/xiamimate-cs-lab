/**
 * 内核：海明码（计算机网络 / 组成原理 · 差错控制）
 * 轴：step —— 每步定一个校验位，或做一次校验
 *
 * 核心那件事：**校验位 P_i 放在第 2^(i−1) 位，它负责的是"位号二进制第 i 位为 1"的那些位。**
 * 所以一旦出错，把所有不满足的校验位号加起来，得到的就是出错位的位号 ——
 * 这不是巧合，是编码方式设计出来的。
 */
import { num, str, type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

export type HammingState = {
  i: number
  /** 码字位串（下标 0 对应位号 1） */
  bits: string
  /** 本步涉及的位下标 */
  touched: number[]
  /** 本步正在处理的校验位位号（1/2/4/8…）；校验阶段是被检查的那个 */
  p: number
  /** 该校验位覆盖的位号 */
  covers: number[]
  /** 校验阶段：该校验位是否通过 */
  ok: boolean | null
  /** 校验阶段累积的错误位号 */
  syndrome: number
  phase: 'layout' | 'parity' | 'done' | 'inject' | 'check' | 'locate'
  log: string
}

export const HAMMING_VISIBLE = [
  'i', 'bits', 'touched', 'p', 'covers', 'ok', 'syndrome', 'phase', 'log',
] as const

type Frame = Omit<HammingState, 'i'>

/** 位号 pos（从 1 数）是不是被校验位 p 覆盖 —— 看它的二进制里有没有 p 这一位 */
const covered = (pos: number, p: number) => (pos & p) !== 0

export const hammingKernel: Kernel<HammingState> = {
  kind: 'hamming',

  compile(doc: SimDocument): CompiledModel<HammingState> {
    const operation = str(doc.params, 'operation')       // 'encode' | 'check'
    const errorAt = num(doc.params, 'errorAt')           // 出错位号（1 起）；0 表示不注入
    const even = num(doc.params, 'evenParity') === 1     // 偶校验 / 奇校验
    const data = (doc.streams.find(s => s.name === 'dataBits')?.values ?? [])
      .map(v => String(v)).join('').replace(/[^01]/g, '')

    const k = data.length
    //  校验位个数 r：满足 2^r ≥ k + r + 1 的最小值
    let r = 0
    while (Math.pow(2, r) < k + r + 1) r++
    const n = k + r
    const parityPos = Array.from({ length: r }, (_, x) => Math.pow(2, x))

    const frames: Frame[] = []
    const put = (f: Partial<Frame> & { phase: Frame['phase']; log: string }) => frames.push({
      bits: frames.at(-1)?.bits ?? '?'.repeat(n),
      touched: [], p: 0, covers: [], ok: null,
      syndrome: frames.at(-1)?.syndrome ?? 0, ...f,
    })

    // ── 排位：校验位占 2^i，其余按序填数据位 ────────────
    let bits = '?'.repeat(n).split('')
    let di = 0
    const dataPos: number[] = []
    for (let pos = 1; pos <= n; pos++) {
      if (parityPos.includes(pos)) continue
      bits[pos - 1] = data[di++] ?? '0'
      dataPos.push(pos)
    }
    put({
      phase: 'layout', bits: bits.join(''),
      touched: dataPos.map(p => p - 1),
      log: `${k} 位数据需要 ${r} 位校验位（因为 2^${r} = ${Math.pow(2, r)} ≥ ${k}+${r}+1 = ${k + r + 1}）；`
        + `码字共 ${n} 位，校验位占第 ${parityPos.join('、')} 位，其余按序放数据`,
    })

    // ── 逐个算校验位 ────────────────────────────────────
    for (const p of parityPos) {
      const covers: number[] = []
      for (let pos = 1; pos <= n; pos++) if (pos !== p && covered(pos, p)) covers.push(pos)
      const ones = covers.filter(pos => bits[pos - 1] === '1').length
      //  偶校验：让这一组（含校验位自己）里 1 的个数为偶数
      const v = even ? (ones % 2 === 0 ? '0' : '1') : (ones % 2 === 0 ? '1' : '0')
      bits[p - 1] = v
      put({
        phase: 'parity', bits: bits.join(''), p, covers,
        touched: [p - 1, ...covers.map(x => x - 1)],
        log: `P${p} 管第 ${covers.join('、')} 位（位号二进制里含 ${p} 的那些）；`
          + `其中有 ${ones} 个 1 → ${even ? '偶' : '奇'}校验下 P${p} = ${v}`,
      })
    }
    const codeword = bits.join('')
    put({
      phase: 'done', bits: codeword, touched: parityPos.map(p => p - 1),
      log: `编码完成：${codeword}（数据 ${data} → ${n} 位海明码）`,
    })

    // ── 校验模式：注入一位错，再定位 ────────────────────
    if (operation === 'check') {
      let recv = codeword
      if (errorAt >= 1 && errorAt <= n) {
        recv = recv.slice(0, errorAt - 1)
          + (recv[errorAt - 1] === '1' ? '0' : '1')
          + recv.slice(errorAt)
        put({
          phase: 'inject', bits: recv, touched: [errorAt - 1],
          log: `传输中第 ${errorAt} 位发生翻转 —— 接收端收到 ${recv}（它并不知道哪一位错了）`,
        })
      } else {
        put({ phase: 'inject', bits: recv, log: `传输无差错，接收端收到 ${recv}` })
      }

      let syn = 0
      for (const p of parityPos) {
        const group: number[] = []
        for (let pos = 1; pos <= n; pos++) if (covered(pos, p)) group.push(pos)
        const ones = group.filter(pos => recv[pos - 1] === '1').length
        const pass = even ? ones % 2 === 0 : ones % 2 === 1
        if (!pass) syn += p
        put({
          phase: 'check', bits: recv, p, covers: group, ok: pass, syndrome: syn,
          touched: group.map(x => x - 1),
          log: `校验 P${p}：第 ${group.join('、')} 位里有 ${ones} 个 1 → `
            + `${pass ? '通过' : `不通过，累加位号 ${p}`}；当前累计 ${syn}`,
        })
      }

      const fixed = syn >= 1 && syn <= n
        ? recv.slice(0, syn - 1) + (recv[syn - 1] === '1' ? '0' : '1') + recv.slice(syn)
        : recv
      put({
        phase: 'locate', bits: fixed, syndrome: syn,
        touched: syn >= 1 && syn <= n ? [syn - 1] : [],
        log: syn === 0
          ? '所有校验位都通过 → 没有检出错误'
          : `不通过的校验位号加起来 = ${syn} → **第 ${syn} 位出错**，翻转它即可纠正 → ${fixed}`
            + `（这不是巧合：每一位的位号二进制决定了它被哪些校验位覆盖）`,
      })
    }

    return {
      axis: { kind: 'step', label: '步骤' },
      initial: () => ({
        i: -1, bits: '?'.repeat(n), touched: [], p: 0, covers: [],
        ok: null, syndrome: 0, phase: 'layout', log: '',
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

/** 数据位数 → 校验位个数，供视图与验证器共用 */
export const hammingR = (k: number) => {
  let r = 0
  while (Math.pow(2, r) < k + r + 1) r++
  return r
}
