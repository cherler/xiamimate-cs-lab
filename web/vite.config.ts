import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here, 'VITE_')
  /** 端口做成变量，是因为下面的 `hmr.clientPort` 必须跟它是同一个数 —— 见那段注释。 */
  const port = Number(env.VITE_PORT || 5178)
  return {
    plugins: [react()],
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
