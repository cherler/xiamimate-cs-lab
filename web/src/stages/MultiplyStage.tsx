/**
 * 舞台：定点乘除 —— 部分积/余数与乘数/商的寄存器逐轮变化
 *
 * 2026-09-08 重画。用户：「把移位动作、加减动作在实验图示的寄存器上可视化体现出来。
 * 而且步骤及结果也需要很清晰才行。」
 *
 * 原来这一屏只有两排位串和一行「本步动作：加」。两个动作都没画：
 *   · **加了什么**看不见 —— 加数（[X]补 / −[X]补 / |X| / 除数）根本不在屏幕上，
 *     只有一个"加"字。这一步的另一半是缺的。
 *   · **移位怎么移**看不见 —— 上一帧和这一帧都是一排 0/1，位往哪边挪、
 *     谁挤进了谁、空出来的那一位补什么，全靠自己两帧对着比。
 *
 * 现在：加减那一步摆成**竖式**（加之前 + 加数 = 加之后，逐位对齐）；
 * 移位那一步把**上一帧摆在上面、这一帧摆在下面**，标出移进/移出的那一位。
 * 两种动作都用引擎给的数（`hiBefore` / `addend`），不是前端猜的。
 */
import type { MulState } from '@engine/kernels/multiply.ts'
import type { StageProps } from '../types.ts'

const ACT: Record<string, string> = {
  init: '初始化', add: '加', sub: '减', none: '不加不减',
  shift: '移位', correct: '修正', done: '完成',
}

export function MultiplyStage({ doc, trace, index, state, tab }: StageProps<MulState>) {
  const isDiv = String(doc.params.algorithm) === '加减交替'
  if (tab === 'table') return <Table trace={trace} index={index} isDiv={isDiv} />
  return <Regs trace={trace} index={index} state={state} isDiv={isDiv}
    algorithm={String(doc.params.algorithm)} />
}

/** 一排位：可以整排点亮、也可以点亮其中一位 */
function Bits({ s, hot, cls = '' }: { s: string; hot?: number; cls?: string }) {
  return (
    <div className={`mbits ${cls}`}>
      {s.split('').map((b, k) => (
        <span key={k} className={`mb ${k === hot ? 'judge' : ''}`}>{b}</span>
      ))}
    </div>
  )
}

/** 寄存器视图：两个寄存器并排，看着位怎么一格格挤过去 */
function Regs({ trace, index, state, isDiv, algorithm }: {
  trace: MulState[]; index: number; state: MulState; isDiv: boolean; algorithm: string
}) {
  const prev = index > 0 ? trace[index - 1] : null
  const isAdd = state.act === 'add' || state.act === 'sub'
  const isShift = state.act === 'shift'
  const hiName = isDiv ? '余数 R' : '部分积（高位）'

  return (
    <div className="card">
      <h3>寄存器 <span className="hint">{isDiv ? '余数 / 商' : '部分积 / 乘数'} · {ACT[state.act] ?? state.act}</span></h3>
      <div className="body">
        <div className="mregs">
          <div className="mreg">
            <span className="k">{hiName}</span>
            <Bits s={state.hi} />
          </div>
          <div className="mreg">
            <span className="k">{isDiv ? '商 Q' : '乘数（低位）'}</span>
            {/*  乘法：乘数末位就是这一轮的判断位，标出来 */}
            <Bits s={state.lo} hot={isDiv ? undefined : state.lo.length - 1} />
          </div>
          {state.extra !== '' && (
            <div className="mreg narrow">
              <span className="k">附加位</span>
              <Bits s={state.extra} hot={0} />
            </div>
          )}
        </div>

        {/*  ① 加减：摆成竖式，把"加的是什么"摆出来 */}
        {isAdd && state.addend && (
          <div className="mwork">
            <div className="mwt">这一步的加法（{hiName}）</div>
            <div className="msum">
              <span className="msl">加之前</span><Bits s={state.hiBefore} cls="dim" />
              <span className="msr" />
            </div>
            <div className="msum">
              <span className="msl">{state.act === 'sub' ? '减' : '加'}上</span><Bits s={state.addend} cls="addend" />
              <span className="msr">{addendName(algorithm, state.act, isDiv)}</span>
            </div>
            <div className="msum sumline">
              <span className="msl">＝</span><Bits s={state.hi} cls="res" />
              <span className="msr">写回{hiName}</span>
            </div>
          </div>
        )}

        {/*  ② 移位：上一帧摆上面、这一帧摆下面，标出挤进来的那一位 */}
        {isShift && prev && (
          <div className="mwork">
            <div className="mwt">这一步的移位（整体右移一位）</div>
            <div className="mshift">
              <span className="msl">移之前</span>
              <Bits s={prev.hi} cls="dim" /><Bits s={prev.lo} cls="dim" />
              <span className="msr" />
            </div>
            <div className="mshift arrowrow"><span className="msl" /><span className="mparrow">↓ 每一位向右挪一格</span></div>
            <div className="mshift">
              <span className="msl">移之后</span>
              <Bits s={state.hi} hot={0} /><Bits s={state.lo} hot={0} />
              <span className="msr">高位补 {state.hi[0]}（{algorithm === '原码一位乘' ? '原码：补 0' : '算术移位：补符号位'}）</span>
            </div>
            <p className="mshiftwhy">
              高位寄存器的最低位 <b>{prev.hi[prev.hi.length - 1]}</b> 挤进了低位寄存器的最高位；
              低位寄存器挤出来的 <b>{prev.lo[prev.lo.length - 1]}</b>
              {state.extra !== '' ? ' 成了新的附加位。' : ' 移出丢弃。'}
            </p>
          </div>
        )}

        <div className="phasenow">
          <div className="pr"><span className="k">算法</span><span className="v">{algorithm}</span></div>
          <div className="pr"><span className="k">轮次</span><span className="v">{state.round || '—'}</span></div>
          <div className="pr"><span className="k">本步动作</span>
            <span className="v">{ACT[state.act] ?? state.act}</span></div>
          {state.judge && (
            <div className="pr"><span className="k">判断位</span><span className="v">{state.judge}</span></div>
          )}
          {isDiv && state.q !== null && (
            <div className="pr"><span className="k">当前商 / 余数</span>
              <span className="v">{state.q} / {state.rem}</span></div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 加数是谁 —— 三个算法各不相同，这一句是"为什么加它"的答案 */
function addendName(algorithm: string, act: string, isDiv: boolean): string {
  if (isDiv) return act === 'sub' ? '−|除数|（上一步余数为正 → 减）' : '+|除数|（上一步余数为负 → 加）'
  if (algorithm === 'Booth') return act === 'sub' ? '−[被乘数]补（判断位 10）' : '+[被乘数]补（判断位 01）'
  return '+|被乘数|（乘数末位是 1）'
}

/** 逐轮表 —— 考卷上要求"写出每一步的部分积"，这张表就是答案 */
function Table({ trace, index, isDiv }: { trace: MulState[]; index: number; isDiv: boolean }) {
  return (
    <div className="card">
      <h3>逐轮表 <span className="hint">考题要求写出每一步的{isDiv ? '余数与商' : '部分积'}</span></h3>
      <div className="body scroll">
        <table className="ptab">
          <thead>
            <tr>
              <th>步</th><th>轮</th><th>动作</th>
              <th>加数</th>
              <th>{isDiv ? '余数' : '部分积'}</th>
              <th>{isDiv ? '商' : '乘数'}</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {trace.map(s => (
              <tr key={s.i} className={s.i === index ? 'past' : s.i > index ? 'future' : ''}>
                <td>{s.i + 1}</td>
                <td>{s.round || '—'}</td>
                <td>{ACT[s.act] ?? s.act}</td>
                {/*  加数单独一列：考卷上"每一步加了什么"跟"部分积变成多少"是两问 */}
                <td className="seq"><span>{s.addend || '—'}</span></td>
                <td className="seq"><span>{s.hi}</span></td>
                <td className="seq"><span>{s.lo}{s.extra ? ` ${s.extra}` : ''}</span></td>
                <td className="dim" style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 260 }}>{s.log}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
