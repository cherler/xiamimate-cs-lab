/**
 * 本机复现线上的单域名分流。
 *
 * ## 为什么需要它
 *
 * 线上只有 `xiamimate.com` 一个域名，主站与 `/lab` 是**同源**的：主站在根上，
 * 本仓在 `/lab/*`，平台页眉制品在 `/chrome/*`，账号与进度接口在 `/v1/*`。
 * 而本机是各跑各的 dev server（主站 :3000、本仓 :5178、后端 :8200），
 * **`:5178` 拿不到 `/chrome` 也拿不到 `/v1`** —— 于是「并入」这件事在本地
 * 根本看不见，只有部署后才暴露，而暴露的方式通常是「点进去一片空白」。
 *
 * 这个网关把线上那套规则原样搬到 :8090，规则与 `deploy/caddy-snippet.conf`
 * 一一对应。**改一边要改另一边。**
 *
 * ## 用法
 *
 *   VITE_BASE=/lab/ npm run web            # 本仓 dev，挂在 /lab/ 下（另开一个终端）
 *   node scripts/local-gateway.mjs         # 网关
 *   node scripts/local-gateway.mjs --lab=static   # 改用 web/dist/（测将来发的东西）
 *
 * 然后开 http://127.0.0.1:8090/lab/ —— 顶上应当出现平台页眉「虾米伙伴 › 虾米做实验」。
 *
 * ⚠️ **直接开 :5178 永远看不到平台页眉**，因为 `/chrome/*` 在主站那个源上。
 * 两个「看起来都对」的地址只有一个是并入后的真形态。
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_REPO = join(ROOT, '..', 'xiamimate-tools-frontend')

const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d
const PORT = Number(arg('port', 8090))
const LAB_MODE = arg('lab', 'dev')
const MAIN_MODE = arg('main', 'dev')
const LAB_DEV = arg('lab-dev', 'http://127.0.0.1:5178')
const MAIN_DEV = arg('main-dev', 'http://127.0.0.1:3000')
const API = arg('api', 'http://127.0.0.1:8200')

const LAB_OUT = join(ROOT, 'web', 'dist')
const MAIN_OUT = join(MAIN_REPO, 'out')
// 主站 dev 服务 public/chrome，构建产物落 out/chrome —— 哪个在就用哪个。
const CHROME_DIR = [join(MAIN_OUT, 'chrome'), join(MAIN_REPO, 'public', 'chrome')]
  .find(existsSync)

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.woff2': 'font/woff2',
}

/** 静态目录。**带扩展名的资源不回退 index.html** —— 回退等于把 404 谎报成 200。 */
async function serveStatic(res, root, p, spa) {
  const asset = /\.[a-z0-9]+$/i.test(p) && !p.endsWith('.html')
  const cands = asset ? [p] : [p, `${p}/index.html`, `${p}.html`, spa]
  for (const c of cands) {
    if (!c) continue
    const f = join(root, c)
    if (!f.startsWith(root) || !existsSync(f) || !extname(f)) continue
    res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' })
    return res.end(await readFile(f))
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found')
}

/** 透传到上游。**原样转发 path** —— 本仓 dev 也跑在 /lab/ 下（VITE_BASE）。 */
async function proxy(req, res, base) {
  try {
    const r = await fetch(base + req.url, {
      method: req.method,
      headers: { ...req.headers, host: new URL(base).host },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
      duplex: 'half',
      redirect: 'manual',
    })
    const h = Object.fromEntries(r.headers)
    // 上游已经解过压/长度变了，原样带过去会让浏览器拿到坏响应
    delete h['content-encoding']
    delete h['content-length']
    res.writeHead(r.status, h)
    res.end(Buffer.from(await r.arrayBuffer()))
  } catch (e) {
    // 上游没起时说清楚是哪一条 —— 「一片空白」最难查的就是不知道谁没起
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`gateway: upstream ${base} unreachable (${e.message})`)
  }
}

const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)

  // ① /chrome/* —— 平台页眉制品，线上与主站同源。只有主站构建过才有。
  if (p.startsWith('/chrome/')) {
    if (!CHROME_DIR) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      return res.end('gateway: 主站还没构建，/chrome 制品不存在 —— '
        + '先在 xiamimate-tools-frontend 跑 node scripts/build-chrome-artifacts.mjs')
    }
    return serveStatic(res, CHROME_DIR, p.slice('/chrome'.length), null)
  }

  // ② /v1/* —— 账号与学习进度，打主站后端。**Cookie 靠同源自动带上**，
  //    所以这一条必须与页面同一个源，不能让前端直接 fetch 到 :8200 去（那是跨源）。
  if (p.startsWith('/v1/')) return proxy(req, res, API)

  // ③ /lab → 308 /lab/（caddy-snippet 的 @labRoot）
  if (p === '/lab') { res.writeHead(308, { location: '/lab/' }); return res.end() }

  // ④ /lab/* → 本仓
  if (p.startsWith('/lab/')) {
    if (LAB_MODE === 'dev') return proxy(req, res, LAB_DEV)
    // 静态模式才剥前缀：handle_path 的行为，产物按根目录摆。
    // **不给 spa 兜底**，与 caddy-snippet 一致 —— 本仓没有前端路由。
    return serveStatic(res, LAB_OUT, p.slice('/lab'.length) || '/index.html', null)
  }

  // ⑤ 其余全归主站
  if (MAIN_MODE === 'dev') return proxy(req, res, MAIN_DEV)
  return serveStatic(res, MAIN_OUT, p, '/index.html')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`本地网关 http://127.0.0.1:${PORT}/lab/`)
  console.log(`  /lab/*    → ${LAB_MODE === 'dev' ? `${LAB_DEV}（记得 VITE_BASE=/lab/）` : LAB_OUT}`)
  console.log(`  /chrome/* → ${CHROME_DIR ?? '（主站未构建，会 404 → 页眉降级为不显示）'}`)
  console.log(`  /v1/*     → ${API}`)
  console.log(`  其余      → ${MAIN_MODE === 'dev' ? MAIN_DEV : MAIN_OUT}`)
  console.log('\n规则与 deploy/caddy-snippet.conf 一一对应 —— 改一边要改另一边。')
})
