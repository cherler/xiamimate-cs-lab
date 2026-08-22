/**
 * 房子里的设备（屏幕坐标，1280×720）。
 * 一件设备 = 一个副本。`open` 表示这一版能不能进。
 */
export type Device = {
  id: string; name: string; note: string
  x: number; y: number
  room: string
  open: boolean
}

export const DEVICES: Device[] = [
  { id: 'fridge',   name: '冰箱',   note: '不制冷了',   x: 137, y: 268, room: '厨房',  open: true },
  { id: 'pc',       name: '台式机', note: '卡',         x: 1006, y: 236, room: '书房',  open: false },
  { id: 'router',   name: '路由器', note: '网慢',       x: 797, y: 297, room: '客厅',  open: false },
  { id: 'ac',       name: '空调',   note: '',           x: 723, y: 108, room: '客厅',  open: false },
  { id: 'washer',   name: '洗衣机', note: '',           x: 1002, y: 620, room: '卫生间', open: false },
  { id: 'heater',   name: '热水器', note: '',           x: 1189, y: 448, room: '卫生间', open: false },
]

/** 当前委托：跟着第一个 open 且有 note 的设备走 */
export const COMMISSION = {
  device: 'fridge',
  title: '冰箱不制冷了',
  brief: '疫苗、剩菜都在里面。柜子嗡嗡响着，却是热的 —— 进去看看它把热搬到哪儿去了。',
  steps: ['问题', '原理', '实验', '完成'],
}
