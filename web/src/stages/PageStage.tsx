/** 舞台：页面置换 —— 置换表 / 当前物理块 */
import type { PageState } from '@engine/kernels/page.ts'
import type { StageProps } from '../types.ts'

export function PageStage({ doc, trace, index, state, tab }: StageProps<PageState>) {
  const nFrames = doc.params.frames as number
  if (tab === 'frames') return <Frames state={state} nFrames={nFrames} />
  return <Table trace={trace} index={index} nFrames={nFrames} doc={doc} />
}

/**
 * 置换表 —— 教材上画的就是这个，也是考场上要手画的东西。
 * 列＝每次访问，行＝物理块。做成跟手画一致，学生才能对照。
 */
function Table({ trace, index, nFrames, doc }: {
  trace: PageState[]; index: number; nFrames: number; doc: StageProps<PageState>['doc']
}) {
  const seq = (doc.streams.find(s => s.name === 'referenceString')?.values ?? []) as number[]
  return (
    <div className="card">
      <h3>置换表 <span className="hint">列＝访问序号，行＝物理块</span></h3>
      <div className="body ptwrap">
        <table className="ptable">
          <thead>
            <tr>
              <th className="rowhead">访问页</th>
              {seq.map((p, i) => (
                <th key={i} className={i === index ? 'cur' : ''}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: nFrames }, (_, f) => (
              <tr key={f}>
                <td className="rowhead">块 {f}</td>
                {trace.map((s, i) => {
                  const cell = s.frames[f]
                  const changed = s.frameUsed === f && s.outcome === 'fault'
                  const hitHere = s.frameUsed === f && s.outcome === 'hit'
                  return (
                    <td key={i} className={[
                      i === index ? 'cur' : '',
                      changed ? 'in' : '',
                      hitHere ? 'hit' : '',
                    ].join(' ')}>
                      {cell ? cell.page : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="ptresult">
              <td className="rowhead">结果</td>
              {trace.map((s, i) => (
                <td key={i} className={`${i === index ? 'cur' : ''} ${s.outcome}`}>
                  {s.outcome === 'hit' ? '√' : '×'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="ptnote">
          <b>×</b> 缺页 · <b>√</b> 命中 · 高亮格＝该步换入的位置。
          考场上手画的就是这张表，这里只是让每一步都能停下来看。
        </p>
      </div>
    </div>
  )
}

/** 当前物理块 —— 看清 stamp 与 CLOCK 使用位 */
function Frames({ state, nFrames }: { state: PageState; nFrames: number }) {
  return (
    <div className="card">
      <h3>本步的物理块 <span className="hint">第 {state.i + 1} 次访问</span></h3>
      <div className="body">
        <div className="frames">
          {Array.from({ length: nFrames }, (_, f) => {
            const cell = state.frames[f]
            const touched = state.frameUsed === f
            const fault = state.outcome === 'fault'
            const isHand = state.hand === f
            //  缺页时被换入的那个块：让新页"落进来"（keyframe 见 stage.css）。
            //  key 只在这个块上按步变，才让它每步重播、别的块不动。
            const landing = touched && fault
            return (
              <div key={f} className={`frame ${cell ? '' : 'empty'} ${touched ? 'touched' : ''} ${landing ? 'landing' : ''}`}>
                <div className="fno">块 {f}{isHand && <span className="hand" title="CLOCK 指针">▸</span>}</div>
                <div className="fpage" key={landing ? `p${state.i}` : 'static'}>{cell ? cell.page : '空'}</div>
                <div className="fmeta">
                  {cell ? <>stamp {cell.stamp}　使用位 <b className={cell.use ? 'on' : ''}>{cell.use ? 1 : 0}</b></> : '—'}
                </div>
              </div>
            )
          })}
        </div>
        {state.evictedPage !== null && (
          <p className="evnote" key={state.i}>本步换出页 <b className="evout">{state.evictedPage}</b>，换入页 <b className="evin">{state.page}</b></p>
        )}
      </div>
    </div>
  )
}
