/** 小镇地点（游戏像素坐标，1280×720 空间）。第一版只有诊所可点。 */
export type Place = { id: string; name: string; note: string; x: number; y: number; interactive: boolean }

export const PLACES: Place[] = [
  { id: 'clinic',     name: '社区诊所', note: '冷藏柜停了', x: 314, y: 150, interactive: true },
  { id: 'repair',     name: '阿榕修理铺', note: '实验台',   x: 207, y: 474, interactive: false },
  { id: 'waterwheel', name: '水车房',   note: '',          x: 972, y: 230, interactive: false },
  { id: 'greenhouse', name: '温室菜园', note: '',          x: 903, y: 528, interactive: false },
]

/** 第一个委托 */
export const COMMISSION = {
  place: 'clinic',
  title: '冷藏柜停了',
  brief: '诊所的疫苗冷藏柜不制冷了。去看看，别让它变成一段科普题。',
  steps: ['问题', '原理', '实验', '完成'],
}
