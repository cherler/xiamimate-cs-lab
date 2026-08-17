/**
 * 位域拆解 —— 共享视觉原语。
 *
 * IEEE754 的符号/阶码/尾数、虚地址的 VPN/页内偏移、CRC 的被除数、
 * 海明码的校验位/数据位、子网掩码的网络号/主机号 —— 都是同一件事：
 * **一串位，按语义切成几段，某些位这一步被动过。**
 *
 * 各实验只要给出 segments 与 touched，不必各画一遍。
 */
export type BitSeg = {
  label: string
  /** 起始位下标（从最高位数起，0 开始） */
  from: number
  /** 位数 */
  len: number
  /** 颜色槽：tag/idx/off 三种，对应已有的三色 */
  tone?: 'tag' | 'idx' | 'off' | 'dim'
}

export function BitField({
  bits, segments, touched = [], caption,
}: {
  /** 位串，'?' 表示还没确定 */
  bits: string
  segments: BitSeg[]
  touched?: number[]
  caption?: string
}) {
  const hot = new Set(touched)
  const n = bits.length
  const segOf = (p: number) => segments.find(s => p >= s.from && p < s.from + s.len)
  /**
   * 位段标题与位格用**同一套网格**（repeat(n, 1fr) + 同样的 gap），
   * 段靠 grid-column: span 占位。
   * 第一版标题用 flexGrow 排，"符号 S"这四个字撑出的最小宽度远大于 1/32，
   * 整排标题就跟下面的位错开了 —— 而"哪几位属于哪段"正是这个视觉唯一要说的事。
   */
  const grid = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }

  return (
    <div className={`bf ${n > 40 ? 'dense' : ''}`}>
      <div className="bfsegs" style={grid}>
        {segments.map(s => (
          <div key={s.label} className={`bfseg ${s.tone ?? 'dim'}`}
               style={{ gridColumn: `span ${s.len}` }} title={`${s.label} · ${s.len} 位`}>
            <span className="n">{s.label}</span>
            <span className="w">{s.len} 位</span>
          </div>
        ))}
      </div>

      <div className="bfrow">
        <span className="bfidx">0</span>
        <div className="bfbits" style={grid}>
          {Array.from({ length: n }, (_, p) => {
            const seg = segOf(p)
            const b = bits[p]
            return (
              <span
                key={p}
                className={`bfbit ${seg?.tone ?? 'dim'} ${hot.has(p) ? 'hot' : ''} ${b === '?' ? 'unk' : ''}`}
                title={`第 ${p} 位${seg ? ` · ${seg.label}` : ''}`}
              >{b}</span>
            )
          })}
        </div>
        <span className="bfidx">{n - 1}</span>
      </div>

      {caption ? <p className="bfcap">{caption}</p> : null}
    </div>
  )
}

/** 把位串按段切开显示成一行摘要，如 `0 | 10000010 | 0100…` */
export const segSummary = (bits: string, segments: BitSeg[]) =>
  segments.map(s => bits.slice(s.from, s.from + s.len)).join(' ')
