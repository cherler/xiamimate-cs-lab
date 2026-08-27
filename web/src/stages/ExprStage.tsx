/** 舞台：栈与表达式求值 —— 中缀带 + 栈（竖着长）+ 后缀带 */
import type { ExprState } from '@engine/kernels/expr.ts'
import type { StageProps } from '../types.ts'
import { rich } from '../shell/rich.tsx'

export function ExprStage({ state }: StageProps<ExprState>) {
  const { infix, at, stack, rpn, phase } = state
  const evalPhase = phase === 'eval'
  return (
    <div className="card">
      <h3>
        {evalPhase ? '后缀求值' : '中缀 → 后缀'}
        <span className="hint">{evalPhase ? '遇数字压栈，遇运算符弹两个算完压回' : '数字直接输出，运算符按优先级弹栈'}</span>
      </h3>
      <div className="body">
        {/* 中缀输入带：当前 token 高亮 */}
        <div className="exline">
          <span className="exlk">中缀</span>
          <span className="extoks">
            {infix.map((t, k) => (
              <span key={k} className={`extok ${!evalPhase && k === at ? 'cur' : ''} ${!evalPhase && k >= 0 && k < at ? 'done' : ''}`}>{t}</span>
            ))}
          </span>
        </div>

        {/* 栈：竖着长，栈顶在上 */}
        <div className="exstackwrap">
          <span className="exlk">栈{evalPhase ? '（数值）' : '（运算符）'}</span>
          <div className="exstack">
            {stack.length === 0
              ? <span className="exempty">空</span>
              : [...stack].reverse().map((t, k) => (
                <span key={k} className={`exs ${k === 0 ? 'top' : ''}`}>{t}{k === 0 ? <em>← 栈顶</em> : null}</span>
              ))}
          </div>
        </div>

        {/* 后缀输出带 */}
        <div className="exline">
          <span className="exlk">后缀</span>
          <span className="extoks">
            {rpn.length === 0
              ? <span className="exempty">还没产出</span>
              : rpn.map((t, k) => (
                <span key={k} className={`extok rpn ${evalPhase && k === at ? 'cur' : ''}`}>{t}</span>
              ))}
            {evalPhase && state.result !== null && state.act === 'done'
              ? <span className="exresult">= {state.result}</span> : null}
          </span>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">本步</span><span className="v">{rich(state.log)}</span></div>
        </div>
      </div>
    </div>
  )
}
