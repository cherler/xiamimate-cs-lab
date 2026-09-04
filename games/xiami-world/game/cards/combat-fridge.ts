import type { Domain } from './combat.ts'
import { solveThermal } from '../../solvers/thermal.ts'

const TARGET = 5 // 够凉 = 稳态柜内 ≤ 5℃(由 solveThermal 真算,不是布尔)

/**
 * 冰箱领域 · 冷链 5 环,每环 2 招具名攻防(10 对 = 10 条真制冷知识)+ 通用工具 + 3 张关键词卡。
 * 温控设定 → 制冷压缩 → 散热冷凝 → 风流循环 → 门封保冷。五环全好才够凉。
 * 破坏卡都是真捣蛋:抠门封(捣坏门封漏冷)、糊散热(糊住冷凝片排不出热)、偷制冷剂、累趴压缩机…
 */
export const FRIDGE: Domain = {
  id: 'fridge',
  title: '冰箱不制冷 · 捣蛋鬼在捣乱',
  statusOk: '够凉了 · 东西保住了',
  statusBad: '不制冷 · 东西要坏',
  layers: ['setpoint', 'cool', 'heatsink', 'airflow', 'seal'],
  layerInfo: {
    setpoint: { name: '温控 · 设定', why: '先定好要多冷(目标温度),压缩机才知道该干到几度' },
    cool: { name: '制冷 · 压缩机', why: '压缩机压制冷剂,吸走柜内热量 = 冷从这来' },
    heatsink: { name: '散热 · 冷凝', why: '吸来的热要从背后冷凝片排到屋里,不然越攒越热' },
    airflow: { name: '风流 · 风扇', why: '风扇把冷气吹匀到各层,冷才到得了食物' },
    seal: { name: '密封 · 门封', why: '门封条把冷气关在柜里,漏了就白制冷' },
  },
  attacks: {
    warmset: { layer: 'setpoint', name: '乱调温控', broken: '目标温度被拧到很高,压缩机以为够凉不干活', mode: 'break', counter: 'f-setpoint' },
    sensoroff: { layer: 'setpoint', name: '拔温度探头', broken: '探头掉了,读不到真温度,乱开乱停', mode: 'break', counter: 'f-sensor' },
    leak: { layer: 'cool', name: '偷制冷剂', broken: '制冷剂漏了,冷量不够、压不下温', mode: 'break', counter: 'f-refill' },
    derate: { layer: 'cool', name: '累趴压缩机', broken: '压缩机被逼满负荷过热、越来越使不上劲', mode: 'worsen', counter: 'f-rest' },
    clog: { layer: 'heatsink', name: '糊散热', broken: '冷凝片糊满油灰,热排不出去、越捂越热', mode: 'break', counter: 'f-coils' },
    blockin: { layer: 'heatsink', name: '堵进风', broken: '进风口被堵,冷凝片吹不到风、散不掉热', mode: 'break', counter: 'f-airpath' },
    fanjam: { layer: 'airflow', name: '卡风扇', broken: '风扇被卡住不转,冷气堆在一角吹不匀', mode: 'break', counter: 'f-fan' },
    frost: { layer: 'airflow', name: '冻住风道', broken: '风道结冰越积越厚,冷气慢慢吹不过去', mode: 'worsen', counter: 'f-defrost' },
    gasket: { layer: 'seal', name: '抠门封', broken: '门封条被抠坏,冷气顺着缝往外漏', mode: 'break', counter: 'f-gasket' },
    ajar: { layer: 'seal', name: '虚掩门', broken: '门没关严留条缝,冷气一直往外跑', mode: 'break', counter: 'f-closedoor' },
  },
  cardDef: {
    'f-setpoint': { name: '重设温控', cost: 1, kind: 'fix', atk: 'warmset', layer: 'setpoint', targeted: false, note: '治【乱调温控】:把目标温度调回该有的低温' },
    'f-sensor': { name: '换温度探头', cost: 1, kind: 'fix', atk: 'sensoroff', layer: 'setpoint', targeted: false, note: '治【拔温度探头】:插回/换好探头,读回真温度' },
    'f-refill': { name: '补制冷剂', cost: 1, kind: 'fix', atk: 'leak', layer: 'cool', targeted: false, note: '治【偷制冷剂】:找漏点补上、加回制冷剂' },
    'f-rest': { name: '让压缩机歇口气', cost: 1, kind: 'fix', atk: 'derate', layer: 'cool', targeted: false, note: '治【累趴压缩机】:降负荷散热,别把它逼死' },
    'f-coils': { name: '清散热片', cost: 1, kind: 'fix', atk: 'clog', layer: 'heatsink', targeted: false, note: '治【糊散热】:刷掉冷凝片油灰,热排得出去' },
    'f-airpath': { name: '清进风道', cost: 1, kind: 'fix', atk: 'blockin', layer: 'heatsink', targeted: false, note: '治【堵进风】:清开进风口,让冷凝片吹到风' },
    'f-fan': { name: '修风扇', cost: 1, kind: 'fix', atk: 'fanjam', layer: 'airflow', targeted: false, note: '治【卡风扇】:清掉卡阻/换扇叶,风转起来' },
    'f-defrost': { name: '化霜通风道', cost: 1, kind: 'fix', atk: 'frost', layer: 'airflow', targeted: false, note: '治【冻住风道】:化掉积冰,冷气重新吹得过去' },
    'f-gasket': { name: '换密封条', cost: 1, kind: 'fix', atk: 'gasket', layer: 'seal', targeted: false, note: '治【抠门封】:换上完好门封条,堵住漏缝' },
    'f-closedoor': { name: '关严门', cost: 1, kind: 'fix', atk: 'ajar', layer: 'seal', targeted: false, note: '治【虚掩门】:把门推到位关严实' },
    'shield': { name: '临时顶住', cost: 1, kind: 'shield', targeted: true, note: '先撑住某一环,顶住它下一手(照意图预防)' },
    'foresee': { name: '预判', cost: 0, kind: 'foresee', targeted: false, note: '看清它接下来两波破坏卡' },
    'quickfix': { name: '万能应急', cost: 2, kind: 'quickfix', targeted: true, note: '不挑招,硬修一坏环(应急、贵)' },
    'stabilize': { name: '稳住温度', cost: 1, kind: 'stabilize', targeted: false, note: '压住正在恶化的环(结冰/压缩机过热)' },
    'k-reflect': { name: '回敬护温', cost: 2, kind: 'shield', targeted: true, kw: ['reflect'], note: '顶住一环;挡下它这手→顺手抽一张(反弹)' },
    'k-taunt': { name: '调虎离山', cost: 1, kind: 'taunt', targeted: false, kw: ['taunt'], note: '引开它下一波的一环(Boss 连打就少挨一下)' },
    'k-chain': { name: '连锁抢修', cost: 1, kind: 'quickfix', targeted: true, kw: ['chain'], note: '硬修一坏环,修好顺手再抽一张(连锁)' },
    'k-aoe': { name: '一键除障', cost: 2, kind: 'aoe', targeted: false, kw: ['aoe'], note: '一口气修好所有坏环(专治 Boss 连打)' },
    'k-buffer': { name: '救急保温', cost: 1, kind: 'buffer', targeted: false, kw: ['buffer'], note: '稳住局面:断网条回退 25%' },
    'k-bulwark': { name: '整机护温', cost: 2, kind: 'bulwark', targeted: false, kw: ['bulwark'], note: '五环全顶住它下一波(挡掉一整轮连打)' },
  },
  startDeck: ['f-setpoint', 'f-refill', 'f-coils', 'f-fan', 'f-gasket', 'shield', 'quickfix', 'foresee', 'stabilize', 'f-defrost'],
  rewardPool: ['f-sensor', 'f-rest', 'f-airpath', 'f-closedoor', 'f-defrost', 'f-setpoint', 'f-refill', 'f-coils', 'f-fan', 'f-gasket', 'shield', 'quickfix', 'stabilize', 'foresee', 'k-reflect', 'k-taunt', 'k-chain', 'k-aoe', 'k-buffer', 'k-bulwark'],
  // 够不够凉由 solveThermal 真算:每种破坏卡映射成真实热参数(制冷功率/散热热阻/漏热负荷),多故障会真叠加、算出柜内温度
  judge(snap) {
    const by = Object.fromEntries(snap.map(s => [s.key, s]))
    const fault = (k: string): string | null => { const s = by[k]; return s && (s.broken || s.decay > 0) ? s.active : null }
    const decayOf = (k: string) => by[k]?.decay || 1
    let pump = 150, Rcond = 0.1, load = 5
    const sp = fault('setpoint'); if (sp === 'warmset') pump = 0; else if (sp === 'sensoroff') pump *= 0.5
    const cl = fault('cool'); if (cl === 'leak') pump *= 0.4; else if (cl === 'derate') pump *= Math.max(0.3, 1 - 0.25 * decayOf('cool'))
    const hs = fault('heatsink'); if (hs === 'clog') Rcond += 0.35; else if (hs === 'blockin') Rcond += 0.25
    const af = fault('airflow'); if (af === 'fanjam') { Rcond += 0.15; load += 4 } else if (af === 'frost') Rcond += 0.12 * decayOf('airflow')
    const sl = fault('seal'); if (sl === 'gasket') load += 30; else if (sl === 'ajar') load += 22
    const r = solveThermal({ pumpWatts: pump, Rcond, Tambient: 30, load })
    return { ok: r.Tinside <= TARGET, metric: `柜内 ${r.Tinside.toFixed(1)}℃ · 要 ≤ ${TARGET}℃` }
  },
}
