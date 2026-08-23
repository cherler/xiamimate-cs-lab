/**
 * 去白底：从四角 flood-fill，只把"跟边缘连通的白/浅色"变透明。
 * 这样不会误伤角色内部的白（信使的脸、信封、门房的浅色）。
 */
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'fs'

const [,, inPath, outPath] = process.argv
const png = PNG.sync.read(readFileSync(inPath))
const { width: W, height: H, data } = png
const idx = (x, y) => (y * W + x) * 4

// 背景判定：够亮且够灰（接近白），才算背景
const isBg = (x, y) => {
  const i = idx(x, y)
  const r = data[i], g = data[i+1], b = data[i+2]
  const mn = Math.min(r,g,b), mx = Math.max(r,g,b)
  return mn > 205 && (mx - mn) < 28
}

const visited = new Uint8Array(W * H)
const stack = []
for (let x = 0; x < W; x++) { stack.push([x,0],[x,H-1]) }
for (let y = 0; y < H; y++) { stack.push([0,y],[W-1,y]) }

let cleared = 0
while (stack.length) {
  const [x, y] = stack.pop()
  if (x < 0 || y < 0 || x >= W || y >= H) continue
  const p = y * W + x
  if (visited[p]) continue
  visited[p] = 1
  if (!isBg(x, y)) continue
  data[idx(x,y)+3] = 0 // 透明
  cleared++
  stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])
}

// 边缘羽化一像素：半透明背景像素也压一压，减少白边
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = idx(x,y)
  if (data[i+3] === 0) continue
  // 邻居有透明的，且自己偏白 → 半透明
  const near = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => {
    const nx=x+dx, ny=y+dy
    return nx>=0&&ny>=0&&nx<W&&ny<H && data[idx(nx,ny)+3]===0
  })
  if (near && isBg(x,y)) data[i+3] = 90
}

writeFileSync(outPath, PNG.sync.write(png))
console.log(`${inPath.split('/').pop()} → 去掉 ${cleared} 背景像素`)
