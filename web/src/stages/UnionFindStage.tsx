/** 舞台：并查集 —— 7 个点顺着父指针认根，union 并树、find 爬链、路径压缩把链拍平 */
import type { UnionFindState } from '@engine/kernels/unionfind.ts'
import type { StageProps } from '../types.ts'

const HUES = [205, 150, 32, 280, 340, 95, 55]   // 按根染色，同色=一伙

export function UnionFindStage({ state }: StageProps<UnionFindState>) {
  const { n, parent, act, a, b, ra, rb, path, root, comps, depths, phase } = state
  const done = phase === 'done'
  const rootOf = (x: number) => { let g = 0; while (parent[x] !== x && g++ < n) x = parent[x]; return x }
  return (
    <div className="card">
      <h3>并查集 <span className="hint">是不是一伙，只看根同不同</span></h3>
      <div className="body">
        <div className="scdim">
          <div className="scdk"><span className="scdn">{comps}</span><span className="scdl">连通分量</span></div>
          <div className="scdk"><span className="scdn hot">{act === 'union' ? `${a}∪${b}` : act === 'find' || act === 'compress' ? `find(${a})` : '—'}</span><span className="scdl">本步操作</span></div>
          <div className="scdk"><span className="scdn">{Math.max(...depths)}</span><span className="scdl">最深链</span></div>
        </div>

        <div className="ufwrap">
          <div className="ufrow">
            {Array.from({ length: n }, (_, x) => {
              const isRoot = parent[x] === x
              const hue = HUES[rootOf(x) % HUES.length]
              const inPath = (act === 'find' || act === 'compress') && (path.includes(x) || x === root)
              const isRa = act === 'union' && x === ra
              const isRb = act === 'union' && x === rb
              const cls = [
                'ufnode', isRoot ? 'root' : '',
                inPath ? (act === 'compress' ? 'squash' : 'walk') : '',
                isRa ? 'movesrc' : '', isRb ? 'movedst' : '',
              ].filter(Boolean).join(' ')
              return (
                <div key={x} className={cls} style={{ ['--hue' as string]: hue }}>
                  <span className="ufbar" />
                  <span className="ufid">{x}</span>
                  <span className="ufpar">{isRoot ? '根' : `↑${parent[x]}`}</span>
                  <span className="ufdep">深{depths[x]}</span>
                </div>
              )
            })}
          </div>
          <div className="orcap">
            {act === '' ? '按「下一步」开始:7 个散点,各自成团(自己是自己的根)'
              : act === 'union' ? (ra === rb ? `union(${a},${b}):根都是 ${ra},本就一伙,不用并`
                : `union(${a},${b}):根 ${ra}≠根 ${rb} → 把根 ${ra} 挂到根 ${rb} 下,两团并成一团`)
                : act === 'find' ? `find(${a}):顺 ↑ 爬 ${[...path, root].join('→')} 到根 ${root}——爬了 ${path.length} 步(链深 ${path.length})`
                  : act === 'compress' ? `路径压缩:把 ${path.join('、')} 全直接挂到根 ${root} 下——链拍平,深度塌到 1`
                    : `并成 1 个集团;认祖归宗只看根`}
          </div>
        </div>

        {done
          ? <p className="scnote">同色=一伙:union 把散点并成集团(一棵树)、find 顺父指针认根、路径压缩把长链<b>一次拍平</b>(0/1/2/3 从深 4/3/2/1 塌到 1)。"是不是一伙"就是"根同不同"。它是 Kruskal 最小生成树、网络连通性、账号合并、图像连通域的核心零件,配路径压缩+按秩合并<b>均摊近乎 O(1)</b>。</p>
          : <p className="scnote" style={{ opacity: .85 }}>每个格子:大数=编号、↑=父指针(指向谁)、深N=到根几步、顶部色条=属于哪个集团(同色一伙)。union 并两棵树、find 爬到根、压缩把沿途点直接挂到根下。</p>}
      </div>
    </div>
  )
}
