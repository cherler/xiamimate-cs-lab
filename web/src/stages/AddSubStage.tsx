/** 舞台：补码定点加减 —— 竖式逐列相加（进位链）+ 溢出判定 */
import type { AddSubState } from '@engine/kernels/addsub.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function AddSubStage({ state, tab }: StageProps<AddSubState>) {
  if (tab === 'overflow') return <Overflow state={state} />
  return <Columnar state={state} />
}

//  一行位串：pos 高亮当前列
function BitRow({ label, bits, pos, tone }: { label: string; bits: string; pos: number; tone?: string }) {
  return (
    <div className="asrow">
      <span className="aslabel">{label}</span>
      <span className="asbits">
        {bits.split('').map((c, k) => (
          <span key={k} className={`ascell ${k === pos ? 'cur' : ''} ${c === '·' ? 'todo' : ''}`}
            style={tone && c !== '·' ? { color: `var(--${tone})` } : undefined}>{c}</span>
        ))}
      </span>
    </div>
  )
}

function Columnar({ state }: { state: AddSubState }) {
  const { aBits, addend, sum, pos, carries, op, aVal, bVal } = state
  return (
    <div className="card">
      <h3>补码竖式 <span className="hint">符号位一起参与相加，从最低位往上逐列进位</span></h3>
      <div className="body">
        <div className="ascol">
          {/* 进位链：每列产生、送往上一列的进位 */}
          <div className="asrow ascarry">
            <span className="aslabel">进位</span>
            <span className="asbits">
              {carries.map((c, k) => (
                <span key={k} className={`ascell carry ${k === pos ? 'cur' : ''}`}>{state.act === 'setup' || state.act === 'negate' ? '' : c}</span>
              ))}
            </span>
          </div>
          <BitRow label={`[A]补`} bits={aBits} pos={pos} tone="f-tag" />
          <BitRow label={op === 'sub' ? '(−B)补' : '[B]补'} bits={addend} pos={pos} tone="f-idx" />
          <div className="asline" />
          <BitRow label="结果" bits={sum} pos={pos} tone={state.overflow ? 'miss' : 'hit'} />
        </div>

        <div className="ascap">
          {op === 'sub'
            ? <>A − B = A + (−B)　·　A = {aVal}，B = {bVal}</>
            : <>A + B　·　A = {aVal}，B = {bVal}</>}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}

function Overflow({ state }: { state: AddSubState }) {
  const { cInSign, cOutSign, overflow, aVal, bVal, op, sum } = state
  const xor = cInSign ^ cOutSign
  const done = state.act === 'overflow' || state.act === 'done'
  return (
    <div className="card">
      <h3>溢出判定 <span className="hint">两种等价判法</span></h3>
      <div className="body">
        <div className="ovmethod">
          <div className="ovhead">方法一 · 双进位异或</div>
          <div className="ovformula">
            进入符号位的进位 <b className="ci">{done ? cInSign : '?'}</b>
            {'  '}⊕{'  '}移出符号位的进位 <b className="co">{done ? cOutSign : '?'}</b>
            {'  '}={'  '}<b className={xor ? 'bad' : 'good'}>{done ? xor : '?'}</b>
          </div>
          <p className="ovnote">两个进位<b>不相等</b>（异或=1）就溢出。这是硬件最常用的判法。</p>
        </div>

        <div className="ovmethod">
          <div className="ovhead">方法二 · 符号看变化</div>
          <p className="ovsigns">
            {op === 'sub' ? '把减法看成 A + (−B)：' : ''}
            两个加数{sameSign(aVal, op === 'sub' ? -bVal : bVal) ? '同号' : '异号'}
            {sameSign(aVal, op === 'sub' ? -bVal : bVal)
              ? '，若结果符号与它们相反 → 溢出'
              : '，异号相加绝不溢出（结果落在两者之间）'}
          </p>
        </div>

        <div className={`ovverdict ${overflow ? 'bad' : 'good'}`}>
          {done ? (overflow
            ? `⊗ 溢出：${aVal} ${op === 'sub' ? '−' : '+'} ${bVal} = ${op === 'sub' ? aVal - bVal : aVal + bVal}，超出 ${state.bits} 位补码范围 [−${1 << (state.bits - 1)}, ${(1 << (state.bits - 1)) - 1}]`
            : `✓ 无溢出：结果 ${sum} = ${fromComp(sum)}，落在有效范围内`) : '走到最后一步看判定'}
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}

const sameSign = (a: number, b: number) => (a >= 0) === (b >= 0)
const fromComp = (s: string): number => {
  if (s.includes('·')) return NaN
  const v = parseInt(s, 2)
  return s[0] === '1' ? v - (1 << s.length) : v
}
