/** 极简存档：只记"哪些委托修好了"，存 localStorage。掌控感=修好了世界记得。 */
const KEY = 'xiami.progress'
export type Progress = { fixed: string[] }

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return Array.isArray(p?.fixed) ? p : { fixed: [] }
  } catch { return { fixed: [] } }
}
export function isFixed(id: string): boolean {
  return loadProgress().fixed.includes(id)
}
export function markFixed(id: string): void {
  const p = loadProgress()
  if (!p.fixed.includes(id)) p.fixed.push(id)
  localStorage.setItem(KEY, JSON.stringify(p))
}
