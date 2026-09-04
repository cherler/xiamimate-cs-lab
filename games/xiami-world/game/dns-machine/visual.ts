/** DNS 缓存罐维修 · 单机页壳(dns-machine.html)。真正的场景在 DnsRepair 类里,这里只负责挂到整屏 canvas + 循环 + 输入 + 胜负横幅。 */
import { DnsRepair } from './repair.ts'

const cv = document.getElementById('c') as HTMLCanvasElement
const ctx = cv.getContext('2d')!
let W = 0, H = 0
const DPR = Math.min(2, devicePixelRatio || 1)
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0) }
addEventListener('resize', resize); resize()

let rep = new DnsRepair()
cv.addEventListener('pointerdown', e => {
  if ((rep.won || rep.lost) && e.clientY > H * 0.42 && e.clientY < H * 0.62) { rep = new DnsRepair(); return }
  rep.pointerdown(e.clientX, e.clientY, W, H)
})
function frame() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#241f18'); g.addColorStop(1, '#191510'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  rep.update(); rep.render(ctx, W, H)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  if (rep.won) { ctx.fillStyle = '#9fe8b8'; ctx.font = 'bold 30px system-ui'; ctx.fillText('✅ 修好了!点这里再来一台', W / 2, H * 0.5) }
  else if (rep.lost) { ctx.fillStyle = '#f0a08c'; ctx.font = 'bold 30px system-ui'; ctx.fillText('💀 断网满了…点这里再来一台', W / 2, H * 0.5) }
  else { ctx.fillStyle = '#c9bfae'; ctx.font = '13px system-ui'; ctx.fillText(`选工具 → 点机器上的部件用它 · 三罐都紫=被投毒`, W / 2, H - 92) }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

;(window as unknown as { __state: () => object }).__state = () => rep.snapshot()
;(window as unknown as { __use: (t: string, p: string) => void }).__use = (t, p) => rep.op(t, p)
;(window as unknown as { __force: (k: string) => void }).__force = (k) => rep.boot(k as 'poison' | 'hijack' | 'down')
