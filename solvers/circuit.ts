/**
 * 电路求解器 —— 篇章一《灯为什么不亮？》的真理源。
 *
 * ## 为什么是「串并联树」而不是通用节点分析
 *
 * 通用 MNA（改进节点分析）能算任何网络，但它算完只给你一堆节点电压 ——
 * **讲不出来**。而这个产品卖的就是"讲得出来"：
 *
 *     总电阻 12 Ω → 电流 1 A → 灯上分到 12 V → 功率 12 W
 *
 * 串并联树天然是**分层的**，每一层都对应一句人话。教学电路 99% 都能拆成串并联，
 * 剩下那 1%（电桥）等真需要了再说 —— 写在下面的边界里。
 *
 * ## 边界（现在算不了什么）
 *
 * - **只能拆成串并联的网络**。惠斯通电桥这类算不了。
 * - **纯电阻**，没有电容电感 —— 结果是稳态，不是过程。
 *   所以「开灯那一下的冲击电流」算不出来（灯丝冷态电阻只有热态的十分之一左右）。
 * - **理想电源 + 一个内阻**。电池老化建模成内阻变大，够用了。
 * - 断路器是**当前电流**超额定就跳，没有反时限特性。真断路器 1.2 倍能扛很久。
 *
 * 边界不是免责声明：**玩家会问的第一批问题就藏在边界外面**，
 * 要做哪一集，看这段就知道先补什么。
 */

// ─────────────────────────── 元件 ───────────────────────────

export type Wire     = { id: string; kind: 'wire';     broken?: boolean }
export type Switch   = { id: string; kind: 'switch';   closed: boolean }
export type Resistor = { id: string; kind: 'resistor'; ohms: number; name?: string }
export type Lamp     = {
  id: string; kind: 'lamp'
  ohms: number
  ratedWatts: number
  /** 灯丝烧断 —— 电学上等于一段断掉的导线，但玩家肉眼看不出来 */
  burnt?: boolean
}
/** 断路器：电流超过 `ampsRating` 就跳闸。跳了跟开关断开一样 */
export type Breaker  = { id: string; kind: 'breaker'; ampsRating: number; tripped?: boolean }

export type Element = Wire | Switch | Resistor | Lamp | Breaker

/** 电源：理想电压源 + 内阻。电池老化 = 内阻变大 */
export type Source = { id: string; kind: 'source'; volts: number; internalOhms?: number }

// ─────────────────────────── 网络 ───────────────────────────

export type Net =
  | { kind: 'el'; el: Element }
  | { kind: 'series'; of: Net[] }
  | { kind: 'parallel'; of: Net[] }

export const el = (e: Element): Net => ({ kind: 'el', el: e })
export const series = (...of: Net[]): Net => ({ kind: 'series', of })
export const parallel = (...of: Net[]): Net => ({ kind: 'parallel', of })

/** 一个回路：电源 + 挂在它两端的网络 */
export type TreeCircuit = { source: Source; net: Net }

/**
 * 篇章内容最顺手的写法：按实物在桌面上的顺序列出来。
 *
 * 它不是另一套求解器格式。进入 `solve` 前会被转换为一棵串联网络，
 * 所以第一集的场景脚本可以保持像一张维修清单，而复杂篇章仍可直接
 * 使用上面的 `series` / `parallel` 树。
 */
export type ComponentCircuit = { components: Array<Source | Element> }
export type Circuit = TreeCircuit | ComponentCircuit

// ─────────────────────────── 解 ───────────────────────────

/** 每个元件此刻的状态。这是给界面和讲解层看的那张表 */
export type Reading = {
  id: string
  kind: Element['kind']
  ohms: number
  volts: number
  amps: number
  /** 这个元件本身是断的 */
  open: boolean
}

export type Solved = {
  /** 有没有电流流过电源（整条回路通不通） */
  closed: boolean
  /** 断在哪儿。串联断路时是那个元件；并联时可能有支路断但整体仍通，此时为 null */
  brokenAt: string | null
  /** 干路电流（流出电源的），安培 */
  current: number
  supply: number
  /** 外部总电阻。全断时 Infinity */
  totalOhms: number
  /** 短路：外部电阻 0，而且电源没有内阻 */
  short: boolean
  readings: Reading[]
  /** `readings` 的旧名称；保留给篇章脚本和已写好的测试读取。 */
  drops: Reading[]
  lamps: { id: string; watts: number; ratio: number; brightness: number; lit: boolean; over: boolean }[]
  /** 主灯（第一盏）—— 大部分集只关心它 */
  lamp: { id: string; watts: number; ratio: number; brightness: number; lit: boolean; over: boolean } | null
  /** 哪个断路器该跳（电流超了但还没跳）—— 由世界层决定要不要真跳 */
  shouldTrip: string | null
  /** 这一步为什么是这个结果。人话，给 NPC 和讲解层用 */
  notes: string[]
}

function normalize(circuit: Circuit): TreeCircuit {
  if ('source' in circuit) return circuit
  const source = circuit.components.find((part): part is Source => part.kind === 'source')
  if (!source) throw new Error('电路必须包含一个电源。')
  const parts = circuit.components.filter((part): part is Element => part.kind !== 'source')
  return { source, net: series(...parts.map(el)) }
}

/** 低于额定功率这个比例，灯丝热不起来，看着就是不亮 */
export const LIT_THRESHOLD = 0.05
/** 超过额定这个倍数就算过载 —— 再烧下去灯丝要断 */
export const OVER_RATIO = 1.35

const isOpen = (e: Element): boolean =>
  (e.kind === 'switch' && !e.closed) ||
  (e.kind === 'wire' && e.broken === true) ||
  (e.kind === 'lamp' && e.burnt === true) ||
  (e.kind === 'breaker' && e.tripped === true)

const ownOhms = (e: Element): number =>
  e.kind === 'resistor' || e.kind === 'lamp' ? e.ohms : 0

export const labelOf = (k: Element['kind'] | 'source'): string =>
  ({ wire: '导线', switch: '开关', resistor: '电阻', lamp: '灯泡', breaker: '断路器', source: '电源' })[k]

/** 一个网络的等效电阻。断路 = Infinity，短路 = 0 */
function ohmsOfNet(n: Net): number {
  if (n.kind === 'el') return isOpen(n.el) ? Infinity : ownOhms(n.el)
  if (n.kind === 'series') return n.of.reduce((r, c) => r + ohmsOfNet(c), 0)
  //  并联：断掉的支路自动退出（1/∞ = 0），这正是并联的直觉 ——
  //  拔掉一个灯泡，其余的照亮。串联里拔一个全灭，区别就在这一行。
  const g = n.of.reduce((s, c) => s + 1 / ohmsOfNet(c), 0)
  return g === 0 ? Infinity : 1 / g
}

/** 把加在这个网络两端的电压分下去，收集每个元件的读数 */
function distribute(n: Net, volts: number, out: Reading[]) {
  const R = ohmsOfNet(n)

  if (n.kind === 'el') {
    const open = isOpen(n.el)
    //  ⚠️ 断路元件两端压着**全部**加在它身上的电压 —— 这不是细节，
    //  「哪儿有电压哪儿就是断的」这条玩法的全部依据就是它。
    const r = open ? Infinity : ownOhms(n.el)
    const amps = open || !Number.isFinite(R) ? 0 : (r > 0 ? volts / r : Infinity)
    out.push({ id: n.el.id, kind: n.el.kind, ohms: open ? Infinity : r, volts, amps: open ? 0 : amps, open })
    return
  }

  if (n.kind === 'series') {
    if (!Number.isFinite(R)) {
      //  串联里有断点：全部电压压在断的那些元件上，其余为 0。
      //  多处断开时电压怎么分是不确定的（理想元件），约定**第一个断点吃掉全部** ——
      //  现实里也确实是先量到哪个算哪个。
      const firstOpen = n.of.findIndex(c => !Number.isFinite(ohmsOfNet(c)))
      n.of.forEach((c, i) => distribute(c, i === firstOpen ? volts : 0, out))
      return
    }
    const amps = R > 0 ? volts / R : Infinity
    for (const c of n.of) {
      const r = ohmsOfNet(c)
      distribute(c, Number.isFinite(amps) ? amps * r : volts, out)
    }
    return
  }

  //  并联：每条支路两端是同一个电压，各走各的电流
  for (const c of n.of) distribute(c, volts, out)
}

export function solve(circuit: Circuit): Solved {
  const { source, net } = normalize(circuit)
  const notes: string[] = []
  const supply = source.volts
  const rInt = source.internalOhms ?? 0
  const rExt = ohmsOfNet(net)

  const readings: Reading[] = []
  let current = 0
  let short = false

  if (!Number.isFinite(rExt)) {
    // 整条回路断了
    distribute(net, supply, readings)
    const brk = readings.find(r => r.open)
    notes.push(`回路是断的：${labelOf(brk?.kind ?? 'wire')}（${brk?.id}）没接通。`)
    notes.push(`电流走不了，干路电流是 0 A。`)
    notes.push(`${supply.toFixed(1)} V 全部压在断点两端，其余元件上都是 0 V。`)
  } else if (rExt + rInt <= 0) {
    short = true
    current = Infinity
    distribute(net, 0, readings)
    notes.push(`回路里一个电阻都没有 —— 这是短路。`)
    notes.push(`电流不是「很大」，是算不出来：理想电源接零电阻本来就无解。现实里这一下会烧东西。`)
  } else {
    current = supply / (rExt + rInt)
    //  内阻分掉一部分电压 —— 这就是"电池老了灯变暗"的机制
    const vExt = current * rExt
    distribute(net, vExt, readings)
    if (rInt > 0) {
      notes.push(`电源有 ${rInt.toFixed(1)} Ω 内阻，自己先吃掉 ${(supply - vExt).toFixed(1)} V。`)
      notes.push(`真正加到外面的只有 ${vExt.toFixed(1)} V。`)
    }
    notes.push(`外部总电阻 ${rExt.toFixed(1)} Ω，干路电流 I = ${vExt.toFixed(1)} / ${rExt.toFixed(1)} = ${current.toFixed(3)} A。`)
  }

  // 灯
  const lamps = readings
    .filter(r => r.kind === 'lamp')
    .map(r => {
      const src = findEl(net, r.id) as Lamp | null
      const rated = src?.ratedWatts ?? 1
      const watts = r.open || !Number.isFinite(r.amps) ? (Number.isFinite(r.amps) ? 0 : Infinity) : r.amps * r.volts
      const ratio = watts / rated
      return {
        id: r.id, watts, ratio,
        brightness: Math.max(0, Math.min(1, ratio)),
        lit: ratio >= LIT_THRESHOLD,
        over: ratio > OVER_RATIO,
      }
    })

  const lamp = lamps[0] ?? null
  if (lamp && Number.isFinite(lamp.watts)) {
    notes.push(`灯上的功率 P = U·I = ${lamp.watts.toFixed(2)} W —— 额定的 ${(lamp.ratio * 100).toFixed(0)}%。`)
    if (!lamp.lit && lamp.watts > 0) notes.push(`不到额定的 ${LIT_THRESHOLD * 100}%，灯丝热不起来，看着仍然是不亮的。`)
    else if (lamp.over) notes.push(`超过额定 ${(lamp.ratio * 100).toFixed(0)}%，这么烧下去灯丝撑不住。`)
  }

  // 断路器：谁流过的电流超了额定
  let shouldTrip: string | null = null
  for (const r of readings) {
    if (r.kind !== 'breaker' || r.open) continue
    const b = findEl(net, r.id) as Breaker | null
    if (!b) continue
    //  断路器自身没有电阻，`distribute` 给它的 amps 算不出来 ——
    //  它在串联里流过的就是它所在那条支路的电流，这里用干路近似（第一版只放干路）。
    const through = Number.isFinite(current) ? current : Infinity
    if (through > b.ampsRating) {
      shouldTrip = r.id
      notes.push(`断路器额定 ${b.ampsRating} A，现在流过 ${Number.isFinite(through) ? through.toFixed(2) : '∞'} A —— 超了。`)
    }
  }

  const brokenAt = !Number.isFinite(rExt) ? (readings.find(r => r.open)?.id ?? null) : null

  return {
    closed: Number.isFinite(rExt),
    brokenAt,
    current,
    supply,
    totalOhms: rExt,
    short,
    readings,
    drops: readings,
    lamps,
    lamp,
    shouldTrip,
    notes,
  }
}

/** 按 id 在网络里找元件 —— 界面上点了什么、世界要改什么，都靠它 */
export function findEl(n: Net, id: string): Element | null {
  if (n.kind === 'el') return n.el.id === id ? n.el : null
  for (const c of n.of) { const f = findEl(c, id); if (f) return f }
  return null
}

/** 网络里所有元件，按出现顺序 */
export function allEls(n: Net): Element[] {
  if (n.kind === 'el') return [n.el]
  return n.of.flatMap(allEls)
}
