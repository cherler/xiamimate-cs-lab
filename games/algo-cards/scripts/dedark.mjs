/** 去暗底:从四角 flood-fill,把"跟边缘连通的暗色"变透明。保留亮主体+辉光。 */
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'fs'
const [, , inPath, outPath, T = '52'] = process.argv
const thr = +T
const png = PNG.sync.read(readFileSync(inPath))
const { width: W, height: H, data } = png
const idx = (x, y) => (y * W + x) * 4
const lum = (x, y) => { const i = idx(x, y); return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] }
const seen = new Uint8Array(W * H)
const stack = []
const push = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H && !seen[y * W + x]) { seen[y * W + x] = 1; stack.push(x, y) } }
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1) }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y) }
let cleared = 0
while (stack.length) {
  const y = stack.pop(), x = stack.pop()
  if (lum(x, y) >= thr) continue          // 够亮=主体,停
  data[idx(x, y) + 3] = 0; cleared++       // 暗=背景,透明
  push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
}
writeFileSync(outPath, PNG.sync.write(png))
console.log('dedark', outPath, '| 清除', (100 * cleared / (W * H)).toFixed(0) + '% 像素')
