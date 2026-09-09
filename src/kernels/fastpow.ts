/**
 * 内核：快速幂 Fast Power（经典算法 · 指数拆二进制，反复平方 + 挑位相乘，O(log n)）
 * 轴：step —— 从低位到高位扫指数的二进制，这一位是 1 就把当前的平方幂乘进结果
 *
 * ─────────────────────────────────────────────────────────────────
 * 2026-09-09 补厚。老版本写死 3¹³，从头顺到尾。而它自己的注释最后一句是：
 *   「快速幂是**模幂(RSA)**、**矩阵快速幂**(线性递推)的底子」
 * 这两样一个都没出现过 —— 而它们恰恰是快速幂**真正被用到的地方**。
 *
 * 更要命的是：**不取模的快速幂在真实场景里根本用不了**。3¹⁰⁰ ≈ 5×10⁴⁷，
 * 远超 JavaScript（以及 C 的 int64）能精确表示的范围 —— 屏幕上会印出一串
 * **看着挺像回事、但每一位都不对**的数字，而且**不报任何错**。
 * 这才是这个算法最该被看见的一件事，老版本一次都没演过。
 *
 * 这一版：
 * ① **拿 BigInt 当真值**，每一档都把 Number 算出来的结果跟它逐位比 ——
 *    「算出来了」和「算对了」是两件事，屏幕上直接分开印。
 * ② **三级失败**：
 *    - **整数乘法**：n 一大就静默溢出，位数全错。
 *    - **模乘 (mod 1e9+7)**：取了模**照样错** —— 中间乘积能到 10¹⁸ > 2⁵³。
 *      **"取模"治的是结果太大，治不了中间量太大。** 这一条最容易被漏掉。
 *    - **模乘 · BigInt 中间量**：这才对。真实代码里对应的是 __int128 / Montgomery 乘法。
 * ③ **矩阵快速幂**：同一套骨架换个"乘法"就能算斐波那契 ——
 *    快速幂要的只是**可结合**，跟"数"没关系。
 */
import { type SimDocument } from '../core/document.ts'
import type { Kernel, CompiledModel } from '../core/kernel.ts'

// ═══════════════════════════════════════════════════════════════
//  参数
// ═══════════════════════════════════════════════════════════════

const OP_PLAIN = '整数乘法（会溢出）'
const OP_MOD = '模乘 mod 1e9+7（中间量还是会溢出）'
const OP_BIGMOD = '模乘 · BigInt 中间量（对的那版）'
const OP_MATRIX = '矩阵乘法 · 斐波那契'
export const FP_OPS = [OP_PLAIN, OP_MOD, OP_BIGMOD, OP_MATRIX] as const

export const FP_BASES = [2, 3, 7] as const
export const FP_EXPS = [13, 45, 100, 1000] as const

const MOD = 1_000_000_007
const MODB = 1_000_000_007n

/** JS 能精确表示的最大整数 —— 超过它，加减乘除都会静默丢精度 */
const SAFE = Number.MAX_SAFE_INTEGER   // 9007199254740991 ≈ 9.007×10¹⁵

// ═══════════════════════════════════════════════════════════════

export type FastPowState = {
  i: number
  step: number
  a: number
  n: number
  op: string
  bitsMSB: number[]
  k: number
  bit: number
  /** a^(2^k)：本位对应的"平方幂"。矩阵档里印的是矩阵左上角那一项 */
  powK: number
  result: number
  prevResult: number
  mults: number
  squares: number
  picked: number[]
  act: string
  /** 矩阵档：当前的 2×2 矩阵（行优先）与结果矩阵 */
  mat: number[]
  resMat: number[]
  /** 全程乘法总次数，以及朴素做法要多少次 */
  totalOps: number
  naiveOps: number
  /** 用 BigInt 算出来的**真值**（可能极长，这里存成字符串） */
  truth: string
  /** Number 这一路算出来的最终值（同样存字符串，好逐位比） */
  got: string
  /** 两者逐位相同吗 */
  exact: boolean
  /** 中途出现过的最大中间量；超过 2⁵³ 就意味着已经丢精度了 */
  maxInter: number
  overflowed: boolean
  /** 换指数扫一遍：乘法次数随 n 怎么长（对照朴素的 n−1） */
  scale: { n: number; ops: number; naive: number }[]
  phase: 'run' | 'done'
  log: string
}

export const FASTPOW_VISIBLE = [
  'step', 'a', 'n', 'op', 'bitsMSB', 'k', 'bit', 'powK', 'result', 'prevResult',
  'mults', 'squares', 'picked', 'act', 'mat', 'resMat',
  'totalOps', 'naiveOps', 'truth', 'got', 'exact', 'maxInter', 'overflowed', 'scale', 'phase', 'log',
] as const

type Frame = Omit<FastPowState, 'i'>

/**
 * 2×2 矩阵乘（行优先），带模。
 *
 * ⚠️ **内部走 BigInt。** 每一项是 `x·y + x·y`，两个 10⁹ 量级的数相乘就是 **10¹⁸ > 2⁵³** ——
 * 跟「模乘」那一档撞的是**同一个坑**。第一版用 Number 写，n≥100 时矩阵档静默算错
 * （F(100) 得 687995181，真值 687995182，差 1）。
 *
 * 这里修掉它不是为了藏起这个坑，而是因为**矩阵档的活是讲"换个乘法骨架不变"** ——
 * 它自己再演一遍溢出会把那句话盖住。这个坑由「模乘」那一档专门演，
 * 而结语里会点明：**换了运算，那个坑还在**。
 */
const mm = (x: number[], y: number[]) => {
  const b = x.map(BigInt), c = y.map(BigInt)
  const r = [
    (b[0] * c[0] + b[1] * c[2]) % MODB, (b[0] * c[1] + b[1] * c[3]) % MODB,
    (b[2] * c[0] + b[3] * c[2]) % MODB, (b[2] * c[1] + b[3] * c[3]) % MODB,
  ]
  return r.map(Number)
}

/**
 * 只数乘法次数，不出帧 —— 规模验证用。
 *
 * ⚠️ **最后一位之后不用再平方。** 第一版写成"每一位都 +1（平方）、是 1 再 +1（乘入）"，
 * 于是每个 n 都比实际多算 1 次 —— 表里印 10、而读数印 9，**同一屏上两个数打架**。
 * 正确的账：平方 = 位数 − 1，挑位相乘 = 二进制里 1 的个数。
 */
const opsFor = (n: number) => {
  const bits = n.toString(2)
  return (bits.length - 1) + [...bits].filter(c => c === '1').length
}

export const fastpowKernel: Kernel<FastPowState> = {
  kind: 'fastpow',

  compile(doc: SimDocument): CompiledModel<FastPowState> {
    const A = Number(doc.params.base ?? 3)
    const NEXP = Number(doc.params.exp ?? 100)
    const op = String(doc.params.op ?? OP_PLAIN)
    const isMatrix = op === OP_MATRIX
    const bitsMSB = NEXP.toString(2).split('').map(Number)

    /*  ⭐ **真值用 BigInt 算。**「算出来了」和「算对了」是两件事 ——
        没有一个独立的真值，屏幕上那串数字对不对根本无从判断。 */
    const truthBig = isMatrix
      ? (() => {
        //  斐波那契：[[1,1],[1,0]]^n 的右上角就是 F(n)
        let r = [1n, 0n, 0n, 1n], b = [1n, 1n, 1n, 0n]
        const mb = (x: bigint[], y: bigint[]) => [
          (x[0] * y[0] + x[1] * y[2]) % MODB, (x[0] * y[1] + x[1] * y[3]) % MODB,
          (x[2] * y[0] + x[3] * y[2]) % MODB, (x[2] * y[1] + x[3] * y[3]) % MODB,
        ]
        for (let m = NEXP; m > 0; m >>= 1) { if (m & 1) r = mb(r, b); b = mb(b, b) }
        return r[1]
      })()
      : op === OP_PLAIN
        ? BigInt(A) ** BigInt(NEXP)
        : BigInt(A) ** BigInt(NEXP) % MODB

    const frames: Frame[] = []
    const picked: number[] = []
    let result = 1, base = A
    let resMat = [1, 0, 0, 1], mat = [1, 1, 1, 0]
    let mults = 0, squares = 0, maxInter = 0

    const note = (v: number) => { maxInter = Math.max(maxInter, Math.abs(v)) }
    /** 一次"乘法" —— 四档各是各的 */
    const mulNum = (x: number, y: number) => {
      const raw = x * y
      note(raw)
      if (op === OP_PLAIN) return raw
      if (op === OP_MOD) return raw % MOD                       //  ⚠️ raw 可能已经丢精度了
      return Number((BigInt(x) * BigInt(y)) % MODB)             //  BigInt 中间量：这才对
    }

    const shared0 = { a: A, n: NEXP, op, bitsMSB }

    for (let k = 0; k < bitsMSB.length; k++) {
      const bit = (NEXP >> k) & 1
      const prevResult = isMatrix ? resMat[1] : result
      const prevMat = resMat.slice()
      if (bit) {
        if (isMatrix) { resMat = mm(resMat, mat); resMat.forEach(note) } else result = mulNum(result, base)
        mults++
        picked.push(2 ** k)
      }
      frames.push({
        ...shared0, step: frames.length, k, bit,
        powK: isMatrix ? mat[0] : base,
        result: isMatrix ? resMat[1] : result, prevResult,
        mults, squares, picked: picked.slice(), act: bit ? 'mul' : 'skip',
        mat: mat.slice(), resMat: resMat.slice(),
        totalOps: 0, naiveOps: 0, truth: '', got: '', exact: false, maxInter, overflowed: false,
        scale: [], phase: 'run',
        log: bit
          ? `第 ${k} 位是 **1** → 把当前的平方幂乘进结果。` +
            (isMatrix
              ? `矩阵相乘，结果矩阵的右上角（也就是 F 的那一项）从 ${prevMat[1]} 变成 **${resMat[1]}**。`
              : `${prevResult} × ${base} = **${result}**（${op === OP_PLAIN ? '直接乘' : '乘完取模'}）。`)
          : `第 ${k} 位是 **0** → 这个平方幂用不上，**跳过**（省下一次乘法）。`,
      })
      //  再平方一次，供下一位用（最后一位之后就不需要了）
      if (k < bitsMSB.length - 1) {
        if (isMatrix) { mat = mm(mat, mat); mat.forEach(note) } else base = mulNum(base, base)
        squares++
      }
    }

    /*  ⚠️ n 一大（比如 3¹⁰⁰⁰）结果直接变成 **Infinity** —— `BigInt(Infinity)` 会抛。
        这本身就是要演的东西之一：**溢出到最后连"一个错的数"都没有了，只剩 Infinity**。
        所以这里不能想当然地 `BigInt(result)`，得先问它还是不是一个有限的整数。 */
    const finite = Number.isFinite(result)
    const gotBig = isMatrix ? BigInt(resMat[1]) : (finite ? BigInt(Math.round(result)) : null)
    const truth = truthBig.toString()
    const got = isMatrix ? String(resMat[1])
      : !finite ? 'Infinity'
        : Number.isSafeInteger(result) ? String(result) : result.toExponential(6)
    const exact = gotBig !== null && gotBig === truthBig
    const overflowed = maxInter > SAFE
    const totalOps = mults + squares
    const naiveOps = NEXP - 1
    const scale = [...FP_EXPS].map(n => ({ n, ops: opsFor(n), naive: n - 1 }))

    const lf = frames[frames.length - 1]
    const shortTruth = truth.length > 40 ? `${truth.slice(0, 18)}…${truth.slice(-12)}（共 ${truth.length} 位）` : truth
    const shortGot = got.length > 40 ? `${got.slice(0, 18)}…${got.slice(-12)}` : got

    frames.push({
      ...lf, step: frames.length, act: 'done', phase: 'done',
      totalOps, naiveOps, truth, got, exact, maxInter, overflowed, scale,
      log: `**算完了**：${NEXP} = ${bitsMSB.join('')}₂，挑出的位对应 ${picked.join(' + ')} = ${picked.reduce((x, y) => x + y, 0)}。\n\n` +
        `一共 **${totalOps}** 次乘法（${squares} 次平方 + ${mults} 次挑位相乘），而朴素做法要 **${naiveOps}** 次 —— ` +
        `**省了 ${(naiveOps / Math.max(1, totalOps)).toFixed(1)} 倍**，而且这个比例随 n 越拉越大（右边那张表）。\n\n` +
        (exact
          ? `结果 **${shortGot}**，跟 BigInt 独立算出来的真值**逐位相同** ✓。\n\n` +
            (op === OP_BIGMOD
              ? `这一档对，是因为每一次乘法的**中间量**都走 BigInt。` +
                `真实代码里对应的是 \`__int128\`、或者 Montgomery 乘法 —— ` +
                `**取模只保证了结果不大，中间那一步 x·y 照样能撑爆机器字长。**`
              : isMatrix
                ? `⭐ 注意这一档换掉的只是"乘法"这两个字：把数的乘法换成 **2×2 矩阵乘法**，` +
                  `同一套"反复平方 + 挑位"的骨架就算出了斐波那契 F(${NEXP})。\n\n` +
                  `**快速幂要的只是"可结合"**，跟被乘的是不是数没有关系 —— ` +
                  `矩阵、多项式、置换、字符串拼接、甚至"状态转移"都能套。线性递推能 O(log n) 求第 n 项，靠的就是它。\n\n` +
                  `⚠️ 顺带一句：**换了运算，溢出那个坑还在**。矩阵每一项是 x·y + x·y，` +
                  `两个 10⁹ 量级的数一乘就是 10¹⁸ > 2⁵³ —— 所以这一档内部**也**走 BigInt。` +
                  `（写成 Number 的话 F(100) 会算成 687995181，而真值是 687995182，差 1，一句错都不报。）`
                : `n 还小，没撑爆。**把「指数 n」调到 100 或 1000 再看。**`)
          : `⚠️ **算出来了，但算错了。**\n\n` +
            (finite || isMatrix
              ? `屏幕上这串是 **${shortGot}**，而 BigInt 独立算出来的真值是 **${shortTruth}** —— **不是同一个数**。\n\n`
              : `屏幕上印的是 **Infinity** —— 溢出到最后连"一个错的数"都没剩下。` +
                `真值是 **${shortTruth}**。\n\n`) +
            `过程中最大的中间量到过 **${maxInter.toExponential(3)}**，` +
            `而 JavaScript 能精确表示的整数上限是 **${SAFE.toExponential(3)}**（2⁵³−1）。` +
            `超过之后每一次乘法都在悄悄丢低位，**一句错都不报**。\n\n` +
            (op === OP_PLAIN
              ? `**这就是"不取模的快速幂在真实场景里用不了"的意思。** ${A}^${NEXP} 有 ${truth.length} 位，` +
                `任何定宽整数都装不下。RSA 里的指数是几百上千位 —— **所以现实中永远是"模幂"，不是"幂"。**\n\n` +
                `**把「运算」换成模乘再看** —— 会发现取了模**还是错的**。`
              : `⚠️ **注意：这一档已经取模了，结果照样错。**\n\n` +
                `因为取模治的是**结果**太大，治不了**中间量**太大：两个 10⁹ 量级的数相乘就是 **10¹⁸**，` +
                `而 2⁵³ ≈ 9×10¹⁵ —— **在取模之前，那一次乘法就已经丢精度了**。\n\n` +
                `**这是最容易被漏掉的一环。** 换成「${OP_BIGMOD}」才对。`)),
    })

    const base0: Frame = {
      ...shared0, step: -1, k: -1, bit: 0, powK: A, result: 1, prevResult: 1,
      mults: 0, squares: 0, picked: [], act: '', mat: [1, 1, 1, 0], resMat: [1, 0, 0, 1],
      totalOps, naiveOps, truth, got, exact, maxInter: 0, overflowed: false, scale, phase: 'run', log: '',
    }

    return {
      axis: { kind: 'step', label: '扫二进制位' },
      initial: () => ({ i: -1, ...base0 }),
      describe: s => s.log,
      step(prev) {
        const b = prev ?? this.initial()
        const idx = b.i + 1
        if (idx >= frames.length) return null
        return { state: { i: idx, ...frames[idx] }, done: idx === frames.length - 1 }
      },
    }
  },
}
