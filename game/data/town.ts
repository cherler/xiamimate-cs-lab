/** 小镇地点（游戏像素坐标，1280×720 空间）。第一版只有诊所可点。 */
export type Place = { id: string; name: string; note: string; x: number; y: number; interactive: boolean }

export const PLACES: Place[] = [
  { id: 'clinic',     name: '社区诊所', note: '冷藏柜停了', x: 479, y: 184, interactive: true },
  { id: 'repair',     name: '修理铺',   note: '你的家',     x: 175, y: 285, interactive: false },
  { id: 'greenhouse', name: '温室菜园', note: '',          x: 760, y: 226, interactive: false },
  { id: 'arcade',     name: '游戏厅',   note: '',          x: 620, y: 512, interactive: false },
]

/** 第一个委托 */
export const COMMISSION = {
  place: 'clinic',
  title: '冷藏柜停了',
  brief: '诊所的疫苗冷藏柜不制冷了。去看看，别让它变成一段科普题。',
  steps: ['问题', '原理', '实验', '完成'],
}
