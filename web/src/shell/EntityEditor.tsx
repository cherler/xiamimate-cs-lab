/**
 * 实体表编辑器 —— 进程表 / 图的边 / 资源矩阵 / 丢包事件。
 *
 * 跟序列编辑器同源，纪律也一样：
 *   1. 半截输入**不喂给仿真**。正在敲的那一格用本地草稿显示，解析通过才提交。
 *   2. 出错时明说，并且编辑器自己**永远不随舞台一起消失** ——
 *      否则学生把进程表改坏了就再也改不回来。
 *
 * 改的仍是 doc.entities，没有绕过文档层（标准 6）。
 */
import { useState } from 'react'
import type { SimDocument, Entity } from '@engine/core/document.ts'
import type { EntitySpec, EntityTableSpec, EntityColumn } from '../types.ts'

/** `id` 与 `at` 是 Entity 的顶层字段，其余列都落在 attrs 里 */
const readCell = (e: Entity, key: string): string => {
  if (key === 'id') return e.id
  if (key === 'at') return String(e.at ?? 0)
  const v = e.attrs[key]
  return v === undefined ? '' : String(v)
}

const writeCell = (e: Entity, col: EntityColumn, raw: string): Entity => {
  if (col.key === 'id') return { ...e, id: raw }
  if (col.key === 'at') return { ...e, at: Number(raw) }
  const v: number | string = col.kind === 'number' ? Number(raw) : raw
  return { ...e, attrs: { ...e.attrs, [col.key]: v } }
}

/** 按 chunk 折栏；不折就是一整块 */
function chunkRows<T>(rows: T[], size?: number): T[][] {
  if (!size || rows.length <= size) return [rows]
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

/** 这一格的输入能不能提交 —— 提交不了就只留在草稿里，不动仿真 */
function cellOk(col: EntityColumn, raw: string): boolean {
  if (col.kind === 'number') return /^-?\d+$/.test(raw.trim())
  return raw.trim().length > 0
}

export function EntityEditor({
  spec, doc, onChange, onReset, dirty,
}: {
  spec: EntitySpec
  doc: SimDocument
  onChange: (entities: Entity[]) => void
  onReset: () => void
  dirty: boolean
}) {
  /** 只有正在敲的那一格需要草稿；失焦即丢弃 */
  const [editing, setEditing] = useState<{ key: string; raw: string } | null>(null)

  const rowsOf = (t: EntityTableSpec) => doc.entities.filter(e => e.type === t.type)

  /**
   * 替换某一类实体，其余类别原样保留 —— 银行家的资源表和进程表共用一个 entities 数组。
   * 整组插回该类实体**首次出现的位置**，这样 Dijkstra 的 node 不会被挤到 edge 后面。
   */
  const replaceType = (type: string, rows: Entity[]) => {
    const out: Entity[] = []
    let put = false
    for (const e of doc.entities) {
      if (e.type === type) {
        if (!put) { out.push(...rows); put = true }
        continue
      }
      out.push(e)
    }
    if (!put) out.push(...rows)
    return out
  }

  const editCell = (t: EntityTableSpec, row: Entity, ri: number, col: EntityColumn, raw: string) => {
    setEditing({ key: `${t.type}:${ri}:${col.key}`, raw })
    if (!cellOk(col, raw)) return                      // 半截输入不提交
    const rows = rowsOf(t).map(e => (e === row ? writeCell(e, col, raw.trim()) : e))
    onChange(replaceType(t.type, rows))
  }

  const addRow = (t: EntityTableSpec) => {
    const rows = rowsOf(t)
    onChange(replaceType(t.type, [...rows, t.newRow(rows.length, doc)]))
    setEditing(null)
  }
  const delRow = (t: EntityTableSpec, row: Entity) => {
    onChange(replaceType(t.type, rowsOf(t).filter(e => e !== row)))
    setEditing(null)
  }

  return (
    <div className="card ent">
      <h3>
        {spec.tables.map(t => t.label).join(' · ')}
        <span className="hint">
          {spec.tables.map(t => `${rowsOf(t).length} ${t.type === 'edge' ? '条' : '个'}`).join(' · ')}
          {dirty ? ' · 已改动' : ''}
        </span>
      </h3>
      <div className="body">
        {spec.tables.map(t => {
          const cols = t.columns(doc)
          const rows = rowsOf(t)
          const canDel = !t.fixedRows && rows.length > (t.minRows ?? 1)
          const canAdd = !t.fixedRows && rows.length < (t.maxRows ?? 12)
          return (
            <div className="enttab" key={t.type}>
              {spec.tables.length > 1 && (
                <div className="entcap">{t.label}{t.hint ? <em>{t.hint}</em> : null}</div>
              )}
              <div className={`entscroll ${t.chunk ? 'chunked' : ''}`}>
                {chunkRows(rows, t.chunk).map((group, gi) => (
                <table key={gi}>
                  <thead>
                    <tr>
                      {cols.map(c => (
                        <th key={c.key} style={c.width ? { minWidth: c.width } : undefined}>
                          {c.label}
                          {c.kind === 'number' && c.unit ? <em>{c.unit}</em> : null}
                        </th>
                      ))}
                      {!t.fixedRows ? <th className="act" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((row, gri) => {
                      const ri = gi * (t.chunk ?? rows.length) + gri
                      return (
                      <tr key={`${t.type}-${ri}`}>
                        {cols.map(c => {
                          //  按下标做 key：编辑 id 那一列时 id 每敲一下就变，
                          //  用 id 当 key 会让输入框被重建、焦点直接丢掉
                          const k = `${t.type}:${ri}:${c.key}`
                          const shown = editing?.key === k ? editing.raw : readCell(row, c.key)
                          const bad = !cellOk(c, shown)
                          if (c.kind === 'enum') {
                            return (
                              <td key={c.key}>
                                <select
                                  style={{ width: c.width ?? 78 }}
                                  value={readCell(row, c.key)}
                                  aria-label={`${row.id} 的${c.label}`}
                                  onChange={e => editCell(t, row, ri, c, e.target.value)}
                                >
                                  {c.options.map((o, oi) => (
                                    <option key={o} value={o}>{c.labels?.[oi] ?? o}</option>
                                  ))}
                                </select>
                              </td>
                            )
                          }
                          return (
                            <td key={c.key}>
                              <input
                                className={bad ? 'bad' : ''}
                                style={{ width: c.width ?? 78 }}
                                value={shown}
                                spellCheck={false}
                                inputMode={c.kind === 'number' ? 'numeric' : 'text'}
                                aria-label={`${row.id} 的${c.label}`}
                                onChange={e => editCell(t, row, ri, c, e.target.value)}
                                onBlur={() => setEditing(null)}
                              />
                            </td>
                          )
                        })}
                        {!t.fixedRows ? (
                          <td className="act">
                            <button
                              disabled={!canDel}
                              title={canDel ? `删除 ${row.id}` : `至少保留 ${t.minRows ?? 1} 行`}
                              aria-label={`删除 ${row.id}`}
                              onClick={() => delRow(t, row)}
                            >−</button>
                          </td>
                        ) : null}
                      </tr>
                      )
                    })}
                    {rows.length === 0 ? (
                      <tr className="none">
                        <td colSpan={cols.length + 1}>暂无 —— 点下面的「加一行」</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                ))}
              </div>
              {!t.fixedRows && (
                <button className="entadd" disabled={!canAdd} onClick={() => addRow(t)}>
                  ＋ 加一{t.type === 'edge' ? '条' : '行'}
                  {canAdd ? '' : `（最多 ${t.maxRows ?? 12}）`}
                </button>
              )}
            </div>
          )
        })}

        <div className="entacts">
          {spec.presets?.length ? (
            <>
              <span className="k">预置</span>
              {spec.presets.map(p => (
                <button key={p.label} title={p.note} onClick={() => { onChange(p.entities); setEditing(null) }}>
                  {p.label}
                </button>
              ))}
            </>
          ) : null}
          <button className="ghost" onClick={() => { onReset(); setEditing(null) }}>恢复默认</button>
        </div>
      </div>
    </div>
  )
}
