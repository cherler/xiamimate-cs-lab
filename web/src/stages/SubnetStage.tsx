/** 舞台：子网划分 / 最长前缀匹配 —— 位域 + 逐条比较 */
import type { SubnetState } from '@engine/kernels/subnet.ts'
import type { StageProps } from '../types.ts'
import { BitField, type BitSeg } from '../shell/BitField.tsx'

const dotted = (bits: string) =>
  (bits.match(/.{8}/g) ?? []).map(b => parseInt(b, 2)).join('.')

export function SubnetStage({ doc, trace, index, state, tab }: StageProps<SubnetState>) {
  const lpm = doc.params.operation === 'lpm'
  if (tab === 'detail') return <Detail state={state} lpm={lpm} trace={trace} index={index} />
  return <Bits state={state} lpm={lpm} />
}

function Bits({ state, lpm }: { state: SubnetState; lpm: boolean }) {
  //  掩码里 1 的个数就是网络号长度 —— 直接从掩码数，不另外传
  const ones = state.mask.indexOf('0') < 0 ? state.mask.length : state.mask.indexOf('0')
  const segs: BitSeg[] = ones > 0 && ones < 32
    ? [
        { label: `网络号 /${ones}`, from: 0, len: ones, tone: 'tag' },
        { label: `主机号 ${32 - ones} 位`, from: ones, len: 32 - ones, tone: 'off' },
      ]
    : [{ label: ones === 0 ? '尚未确定掩码' : '全部是网络号', from: 0, len: 32, tone: 'dim' }]

  return (
    <div className="card">
      <h3>{lpm ? '目的地址与当前比较的前缀' : '地址位域'}
        <span className="hint">点分十进制 {dotted(state.bits)}</span></h3>
      <div className="body">
        <BitField bits={state.bits} segments={segs} touched={state.touched}
                  caption={`每 8 位一组读成十进制，就是 ${dotted(state.bits)}`} />
        <div className="subline">
          <span className="k">子网掩码</span>
          <div className="sbits">
            {state.mask.split('').map((b, k) => (
              <span key={k} className={`sb ${b === '1' ? 'on' : ''}`}>{b}</span>
            ))}
          </div>
          <span className="v">{dotted(state.mask)}</span>
        </div>
        <div className="phasenow">
          {Object.entries(state.detail).map(([k, v]) => (
            <div className="pr" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 详情：子网模式给四要素；lpm 模式给逐条比较表 */
function Detail({ state, lpm, trace, index }: {
  state: SubnetState; lpm: boolean; trace: SubnetState[]; index: number
}) {
  if (!lpm) {
    const pick = (p: SubnetState['phase']) => trace.find(s => s.phase === p)
    const rows: [string, string][] = [
      ['网络地址', pick('network') ? dotted(pick('network')!.bits) : '—'],
      ['广播地址', pick('broadcast') ? dotted(pick('broadcast')!.bits) : '—'],
      ['可用主机数', pick('hosts')?.detail['可用主机数'] ?? '—'],
      ['地址总数', pick('hosts')?.detail['地址总数'] ?? '—'],
    ]
    const split = pick('split')
    return (
      <div className="card">
        <h3>子网四要素 <span className="hint">考卷上要写的就是这几行</span></h3>
        <div className="body">
          <div className="phasenow">
            {rows.map(([k, v]) => (
              <div className="pr" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
            ))}
          </div>
          {split && (
            <>
              <div className="entcap" style={{ marginTop: 14 }}>再划子网</div>
              <div className="phasenow">
                {Object.entries(split.detail).map(([k, v]) => (
                  <div className="pr" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  const matches = trace.filter(s => s.phase === 'match')
  return (
    <div className="card">
      <h3>逐条比对 <span className="hint">匹配的可能有好几条，取前缀最长的</span></h3>
      <div className="body scroll">
        <table className="ptab">
          <thead><tr><th>路由项</th><th>前缀</th><th>是否匹配</th><th>下一跳</th><th /></tr></thead>
          <tbody>
            {matches.map(s => {
              const [route, hop] = (s.detail['路由项'] ?? '').split(' → ')
              return (
                <tr key={s.i} className={s.i > index ? 'future' : ''}>
                  <th>{s.entry}</th>
                  <td className="seq"><span>{route}</span></td>
                  <td className={s.hit ? 'yes' : 'no'}>{s.hit ? '匹配' : '不匹配'}</td>
                  <td>{hop ?? '—'}</td>
                  <td className="dim">{s.best === s.entry ? '← 当前最长' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="phasenow">
          {Object.entries(state.detail).map(([k, v]) => (
            <div className="pr" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}
