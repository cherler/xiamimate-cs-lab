import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * **让 :5178 也能开两个游戏。**
 *
 * 坑:游戏挂在 `/lab/cards`、`/lab/world`,但那两条路由只配在**网关**(:8090)和线上 Caddy 里,
 * Vite 自己不认识。而 Vite 对未知路径会**回退到 index.html** —— 于是
 * `http://127.0.0.1:5178/lab/cards` 返回 **200**、却是实验室主页(标题「虾米看计算机」),
 * 看起来像「游戏打不开」,其实是拿到了另一个页面。**又一次「200 不代表拿到的是那个东西」。**
 *
 * 这条中间件把这两个前缀直接指到各游戏自己的 `dist/`,所以 :5178 和 :8090 都能开,
 * 不用记「游戏得换个端口看」。dist 不存在时给一句人话提示,而不是回退成主页。
 */
function gamesPlugin() {
  const GAMES: Record<string, string> = {
    '/lab/cards': resolve(here, '..', 'games', 'algo-cards', 'dist'),
    '/lab/world': resolve(here, '..', 'games', 'xiami-world', 'dist'),
  }
  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  }
  return {
    name: 'xm-games',
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: import('node:http').ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0]
        const prefix = Object.keys(GAMES).find(p => url === p || url.startsWith(p + '/'))
        if (!prefix) return next()
        if (url === prefix) { res.statusCode = 308; res.setHeader('location', prefix + '/'); return res.end() }
        const { readFile, stat } = await import('node:fs/promises')
        const rel = url.slice(prefix.length) || '/'
        const file = resolve(GAMES[prefix], '.' + (rel === '/' ? '/index.html' : rel))
        try {
          if (!(await stat(file)).isFile()) throw new Error('not a file')
          const ext = file.slice(file.lastIndexOf('.'))
          res.setHeader('content-type', MIME[ext] || 'application/octet-stream')
          return res.end(await readFile(file))
        } catch {
          //  **不回退到实验室主页** —— 那正是这个坑的成因。缺产物就直说。
          res.statusCode = 404
          res.setHeader('content-type', 'text/html; charset=utf-8')
          return res.end(`<meta charset="utf-8"><body style="font:15px/1.7 system-ui;padding:40px;background:#0a141f;color:#e6eef7">`
            + `<h2>这个游戏还没构建</h2><p><code>${url}</code> 要读 <code>games/${prefix.split('/')[2] === 'cards' ? 'algo-cards' : 'xiami-world'}/dist</code>,但那里没有产物。</p>`
            + `<p>先构建一次:<br><code style="color:#f0a94a">cd games/${prefix.split('/')[2] === 'cards' ? 'algo-cards' : 'xiami-world'} &amp;&amp; npm install &amp;&amp; npm run build</code></p></body>`)
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here, 'VITE_')
  /** 端口做成变量，是因为下面的 `hmr.clientPort` 必须跟它是同一个数 —— 见那段注释。 */
  const port = Number(env.VITE_PORT || 5178)
  return {
    plugins: [react(), gamesPlugin()],
    /**
     * 挂在主站子路径下时要设 base，否则产物里的资源链接指向域名根 —— 表现是
     * 「/lab/ 打开一片空白，控制台一堆 404」。线上：`VITE_BASE=/lab/`。
     *
     * 留空（本机 `npm run web`、以及 `web:single` 的单文件产物）就是根挂载。
     * 单文件产物把 css/js 全内联了，base 对它没有影响。
     */
    base: env.VITE_BASE || '/',
    // 引擎在仓库根的 src/ 下 —— 视图直接 import 它，不复制不镜像
    resolve: {
      alias: { '@engine': resolve(here, '..', 'src') },
    },
    server: {
      /**
       * **显式绑 127.0.0.1。** 不写的话 Vite 只监听 IPv6 的 [::1]，
       * 而本地网关连的是 IPv4 的 127.0.0.1 —— 于是 Vite 明明在跑，
       * 网关那边却是「连接被拒绝」，表现成「从主站点进来一片空白」。
       * （虾米看股栽过，见 wiki/27。）
       */
      host: '127.0.0.1',
      port,
      /**
       * **strictPort 必须为真**，否则下面钉死的 `clientPort` 会说谎：
       * 端口被占时 Vite 会悄悄换下一个，而浏览器仍按原来那个去连 HMR。
       * 要换端口就显式 `VITE_PORT=5179`，两处一起动。
       */
      strictPort: true,
      /**
       * **HMR 直连 Vite，不跟着页面的来源走。**
       *
       * 经本地网关（:8090）打开时，页面的源是网关而不是 Vite。Vite 默认让浏览器
       * 按「当前页面的源」去连 HMR，于是 WebSocket 升级要穿过网关那一层；
       * 穿不过去它每秒重连、每次挂住一条连接，六条并发占满后**点击、跳转、
       * 接口全排队**，表现是「页面好好的，但按什么都卡十几秒」。
       */
      hmr: { host: '127.0.0.1', clientPort: port, protocol: 'ws' },
      /**
       * AI 学伴后端是**另一个进程**（server/index.ts，默认 :8300），不在 Vite 里。
       * 页面 fetch 的是同源的 /lab/ai/*，dev 下由这条 proxy 转给它。
       * 线上同样要有对应规则（见 deploy/caddy-snippet：/lab/ai/* → 8300）。
       */
      proxy: {
        '/lab/ai': { target: 'http://127.0.0.1:8300', changeOrigin: false },
      },
    },
    build: { outDir: 'dist', emptyOutDir: true },
  }
})
