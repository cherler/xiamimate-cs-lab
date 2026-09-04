/**
 * N1 路由 · 玩中懂外壳
 * 每一下都用**真内核** solvers/route/forward.ts 算，不糊假数据。
 */
import { sendPacket, route, type Topology, type Delivery } from '../solvers/route/forward.ts'

const DST = '93.184.216.34'

// 真拓扑：电脑→家里路由器→ISP→服务器
function homeNet(withGateway = true): Topology {
  return { nodes: {
    pc:  { id:'pc', name:'你的电脑', ip:'192.168.1.9', subnet:'192.168.1.0/24', neighbors:['gw'],
           routes:[ route('192.168.1.0/24', null), ...(withGateway ? [route('0.0.0.0/0','gw')] : []) ] },
    gw:  { id:'gw', name:'家里路由器', ip:'192.168.1.1', subnet:'192.168.1.0/24', neighbors:['pc','isp'],
           routes:[ route('192.168.1.0/24', null), route('0.0.0.0/0','isp') ] },
    isp: { id:'isp', name:'ISP 路由器', ip:'203.0.113.1', subnet:'203.0.113.0/24', neighbors:['gw','srv'],
           routes:[ route('93.184.216.0/24','srv'), route('203.0.113.0/24', null) ] },
    srv: { id:'srv', name:'服务器', ip:DST, subnet:'93.184.216.0/24', neighbors:['isp'],
           routes:[ route('93.184.216.0/24', null) ] },
  } }
}

const ORDER = ['pc', 'gw', 'isp', 'srv']
const ICON: Record<string,string> = { pc:'💻', gw:'📡', isp:'🗼', srv:'🖥️' }

let topo = homeNet(true)
let gatewayDeleted = false

const $ = (s: string) => document.querySelector(s)!
const say = (t: string) => { $('#say').textContent = t }
const desk = $('#desk')
function setDesk(btns: {label:string; ghost?:boolean; cb:()=>void}[]) {
  desk.innerHTML = ''
  for (const b of btns) { const el = document.createElement('button'); el.textContent=b.label; if(b.ghost)el.className='ghost'; el.onclick=b.cb; desk.appendChild(el) }
}

// 画拓扑
function drawNet() {
  const net = $('#net'); net.innerHTML = ''
  ORDER.forEach((id, i) => {
    const n = topo.nodes[id]!
    const d = document.createElement('div'); d.className='dev'; d.id='dev-'+id
    d.innerHTML = `<div class="box">${ICON[id]}</div><div class="nm">${n.name}</div><div class="ip">${n.ip}</div>`
    net.appendChild(d)
    if (i < ORDER.length-1) { const l=document.createElement('div'); l.className='link'; l.id='link-'+id; net.appendChild(l) }
  })
}

// 画「你的电脑」的路由表（可删默认网关那行）
function drawRouteTable() {
  const rt = $('#rt') as HTMLElement; rt.style.display='block'
  const body = $('#rtbody'); body.innerHTML=''
  topo.nodes.pc!.routes.forEach(r => {
    const isDef = r.prefix.len === 0
    const tr = document.createElement('tr'); if(isDef) tr.className='def'
    tr.innerHTML = `<td>${r.prefix.text}</td><td>→ ${r.via ? topo.nodes[r.via]!.name : '直连(本段)'}</td>`
      + (isDef ? `<td class="del" id="delgw">✕ 删掉这行</td>` : `<td></td>`)
    body.appendChild(tr)
  })
  const del = document.getElementById('delgw')
  if (del) del.onclick = deleteGateway
}

function clearMarks() { ORDER.forEach(id => document.getElementById('dev-'+id)!.className='dev') }

const pkt = $('#packet') as HTMLElement
function showPacket(devId: string, dstMac: string|null) {
  const el = document.getElementById('dev-'+devId)!.querySelector('.box') as HTMLElement
  const r = el.getBoundingClientRect()
  pkt.style.left = (r.left + r.width/2 - 60) + 'px'
  pkt.style.top = (r.top - 54) + 'px'
  pkt.innerHTML = `<div class="to">收件人 ${DST}</div><div class="mac">门牌 ${dstMac ?? '—'}</div>`
  pkt.style.opacity = '1'
}

// 播一次真内核算出的逐跳轨迹
async function play(d: Delivery, onEnd: ()=>void) {
  clearMarks()
  for (let i=0;i<d.hops.length;i++) {
    const h = d.hops[i]!
    document.getElementById('dev-'+h.at)!.classList.add('here')
    showPacket(h.at, h.dstMac)
    say(h.note)
    await sleep(1300)
    document.getElementById('dev-'+h.at)!.classList.remove('here')
  }
  const last = d.hops[d.hops.length-1]!
  const el = document.getElementById('dev-'+last.at)!
  el.classList.add(d.delivered ? 'ok' : 'dead')
  if (!d.delivered) pkt.style.opacity='0'
  onEnd()
}
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms))

// ── 流程 ──
function start() {
  drawNet()
  setDesk([{ label:'发一个包给服务器', cb: firstSend }])
}

async function firstSend() {
  setDesk([])
  const d = sendPacket(topo, 'pc', DST)  // 真内核算
  await play(d, () => {
    // 撞到啊哈：第一跳门牌是隔壁网关的，不是服务器的
    say('看明白第一跳没有——包的"收件人"写着远方的服务器，可"门牌"(目标MAC)写的是隔壁「家里路由器」！因为你的电脑根本不认识去服务器的路，它只会：本段的直接送，其它一切都甩给默认网关。收件人一路不变，门牌每过一跳被撕掉重贴。')
    setDesk([{ label:'那把"默认网关"这行删了会怎样？看看它的路由表', cb: showTable }])
  })
}

function showTable() {
  drawRouteTable()
  say('这就是你电脑的路由表。第一行：本段(192.168.1.0/24)直连。第二行：0.0.0.0/0 → 家里路由器，意思是"其它任何地方，都甩给它"。把这条默认网关删掉试试——然后再发包。')
  setDesk([])
}

function deleteGateway() {
  topo = homeNet(false); gatewayDeleted = true
  drawRouteTable()
  say('默认网关删了。现在你的电脑只剩一条路由：本段直连。再发个包给服务器，看它还走不走得出去。')
  setDesk([{ label:'再发包给服务器', cb: sendAfterDelete }])
}

async function sendAfterDelete() {
  setDesk([])
  const d = sendPacket(topo, 'pc', DST)  // 真内核算：现在会 no-route
  await play(d, async () => {
    say('送不出去了——「你的电脑」的路由表里，再没有能通向服务器的那条路。包卡在原地。')
    await sleep(300)
    // 对照：同网段还通
    const local = sendPacket(topo, 'pc', '192.168.1.1')
    say('但注意——同网段的「家里路由器」(192.168.1.1)还是连得上（本段直连那条还在）。所以不是"网断了"，是"没人肯替你往下一跳传"。地址不是位置，是问路的钥匙；能连上，靠的是每一跳都认得下一步。')
    setDesk([{ label:'我懂了', ghost:true, cb: whyDone }])
  })
}

function whyDone() {
  say('这个知识点亮了：包能一跳跳送到远方，不是因为谁认得全程，而是每台路由器只回答"往哪个方向再走一格"——无数个本地决策拼出一条全局的路。删掉默认网关那一格，路就断在你家门口。')
  setDesk([])
}

start()

// 给走查读状态
;(window as unknown as {__route:unknown}).__route = () => ({ gatewayDeleted, canReach: sendPacket(topo,'pc',DST).delivered })
