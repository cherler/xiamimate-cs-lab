import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * **让 :5178 也能开挂在 /lab/ 下的那几个子应用。**
 *
 * 坑:它们挂在 `/lab/cards`、`/lab/world`、`/lab/explainer`,但这些路由只配在
 * **网关**(:8090)和线上 Caddy 里,Vite 自己不认识。而 Vite 对未知路径会**回退到 index.html**
 * —— 于是 `http://127.0.0.1:5178/lab/cards` 返回 **200**、却是实验室主页(标题「虾米课堂」),
 * 看起来像「打不开」,其实是拿到了另一个页面。**又一次「200 不代表拿到的是那个东西」。**
 *
 * 这条中间件把这些前缀直接指到各自的产物目录,所以 :5178 和 :8090 都能开。
 * 目录不存在时给一句人话提示,而不是回退成主页。
 *
 * ⚠️ 2026-09-08 补上 `/lab/explainer`。用户报「Transformer 图解按钮打不开」——
 * 查下来这条路径**全仓只出现在 App.tsx 那颗按钮上**:没有产物、没有部署配置、
 * 也没进这张表,于是一直静静地回退成实验室主页。正是这段注释开头写的那个坑,
 * 只不过当时只把两个游戏挂进来了。它指的那份东西其实一直都在:
 * `experiments/qwen-browser/` —— 一张自带 CDN 依赖的静态页,不需要构建。
 */
function subappsPlugin() {
  const GAMES: Record<string, { dir: string; hint: string }> = {
    '/lab/cards': { dir: resolve(here, '..', 'games', 'algo-cards', 'dist'),
      hint: 'cd games/algo-cards && npm install && npm run build' },
    '/lab/world': { dir: resolve(here, '..', 'games', 'xiami-world', 'dist'),
      hint: 'cd games/xiami-world && npm install && npm run build' },
    /*  Transformer 图解是**两个入口**（用户 2026-09-08：「倾向于两个都保留」）：
        `/lab/explainer` 是门厅，并排摆着"我们这份真模型"和"poloclub 那份真图解"。
        两份都是源码目录、不需要构建（依赖走 CDN、模型走 ModelScope）。 */
    '/lab/explainer': { dir: resolve(here, '..', 'experiments', 'explainer-hub'),
      hint: '它是 experiments/explainer-hub/index.html，不需要构建' },
    '/lab/explainer-live': { dir: resolve(here, '..', 'experiments', 'qwen-browser'),
      hint: '它是 experiments/qwen-browser/index.html，不需要构建 —— 文件要是不见了，去 git 历史里找' },
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
        const file = resolve(GAMES[prefix].dir, '.' + (rel === '/' ? '/index.html' : rel))
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
            + `<h2>这个子应用还没有产物</h2><p><code>${url}</code> 要读 <code>${GAMES[prefix].dir}</code>,但那里没有。</p>`
            + `<p><code style="color:#f0a94a">${GAMES[prefix].hint}</code></p></body>`)
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
    plugins: [react(), subappsPlugin()],
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
