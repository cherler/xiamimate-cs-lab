/** 舞台：排序逐趟 —— 数组条 + 逐趟结果表 */
import type { SortState } from '@engine/kernels/sort.ts'
import type { StageProps } from '../types.ts'

/**
 * 「趟」这个词各算法叫法不同，不能一律写成"第 N 趟"：
 * 快排一趟指的是一次划分，希尔一趟对应一个增量。叫错了学生就对不上教材。
 */
const passWord = (algorithm: string) =>
  algorithm === '快速' ? { head: '划分次序', row: (n: number) => `第 ${n} 次划分` }
  : algorithm === '希尔' ? { head: '增量趟次', row: (n: number) => `第 ${n} 个增量` }
  : { head: '趟次', row: (n: number) => `第 ${n} 趟` }

export function SortStage({ doc, trace, index, state, tab }: StageProps<SortState>) {
  const input = (doc.streams.find(s => s.name === 'array')?.values ?? []) as number[]
  const word = passWord(String(doc.params.algorithm))
  if (tab === 'passes') return <Passes trace={trace} index={index} input={input} word={word} />
  return <Bars state={state} trace={trace} word={word} />
}

type PassWord = ReturnType<typeof passWord>

/**
 * 数组条：高度=值，颜色=角色。
 * 挖坑法的空位画成虚线空格，被端出来的值单独浮在上方 ——
 * 不这么画，学生会以为数组里凭空多了一个数。
 */
function Bars({ state, trace, word }: { state: SortState; trace: SortState[]; word: PassWord }) {
  const all = trace.flatMap(s => s.arr)
  const max = Math.max(1, ...all)
  const settled = new Set(state.settled)
  const sorted = new Set(state.sorted)
  const cmp = new Set(state.compare)
  const chg = new Set(state.changed)

  return (
    <div className="card">
      <h3>数组状态 <span className="hint">高度即数值 · 颜色即角色</span></h3>
      <div className="body">
        <div className="sheld">
          {state.held !== null ? (
            <div className="sheldbox">
              <span className="k">手里端着</span>
              <b>{state.held}</b>
              <span className="k">← 从空位取出，还没放回去</span>
            </div>
          ) : <div className="sheldbox empty">数组内原地操作，没有暂存值</div>}
        </div>

        <div className="sbars">
          {state.arr.map((v, k) => {
            const isHole = k === state.hole
            const cls = [
              'sbar',
              isHole ? 'hole' : '',
              settled.has(k) ? 'settled' : sorted.has(k) ? 'sorted' : '',
              chg.has(k) ? 'chg' : cmp.has(k) ? 'cmp' : '',
            ].filter(Boolean).join(' ')
            return (
              <div key={k} className={cls} title={isHole ? `下标 ${k}：空位（显示的是旧副本）` : `a[${k}] = ${v}`}>
                <div className="sfill" style={{ height: `${(v / max) * 100}%` }} />
                <em className="sval">{isHole ? '—' : v}</em>
                <em className="sidx">{k}</em>
              </div>
            )
          })}
        </div>

        <div className="slegend">
          <span><i className="sw settled" />已定最终位置</span>
          <span><i className="sw sorted" />局部有序（还会动）</span>
          <span><i className="sw cmp" />本步比较</span>
          <span><i className="sw chg" />本步写入</span>
          <span><i className="sw hole" />空位</span>
        </div>

        <div className="phasenow">
          <div className="pr"><span className="k">比较次数</span><span className="v">{state.comparisons}</span></div>
          <div className="pr"><span className="k">移动次数</span><span className="v">{state.moves}</span></div>
          <div className="pr"><span className="k">{word.head}</span>
            <span className="v">{state.pass ? word.row(state.pass) : '—'}</span></div>
        </div>
      </div>
    </div>
  )
}

/**
 * 逐趟结果表 —— 考题几乎都问"第 N 趟排序后的结果"，
 * 所以这张表就是答题现场，不是装饰。
 */
function Passes({ trace, index, input, word }: {
  trace: SortState[]; index: number; input: number[]; word: PassWord
}) {
  const ends = trace.filter(s => s.passEnd)
  const cur = trace[index]
  return (
    <div className="card">
      <h3>逐趟结果 <span className="hint">考题问「第 N 趟后」，指的就是这张表的每一行</span></h3>
      <div className="body scroll">
        <table className="ptab">
          <thead>
            <tr>
              <th>{word.head}</th>
              <th>结束后的序列</th>
              <th>已定位</th>
            </tr>
          </thead>
          <tbody>
            <tr className="init">
              <td>初始</td>
              <td className="seq">{input.map((v, k) => <span key={k}>{v}</span>)}</td>
              <td>—</td>
            </tr>
            {ends.map(s => {
              const done = new Set(s.settled)
              return (
                <tr key={s.i} className={s.i <= cur?.i ? 'past' : 'future'}>
                  <td>{word.row(s.pass)}</td>
                  <td className="seq">
                    {s.arr.map((v, k) => (
                      <span key={k} className={done.has(k) ? 'fixed' : ''}>{v}</span>
                    ))}
                  </td>
                  <td>{done.size ? `${done.size} 个` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
