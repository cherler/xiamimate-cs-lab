import { defineConfig, loadEnv } from 'vite'

// dev 代理:浏览器直连 MiniMax 会撞 CORS,开发时把 /partner 转发到真实 base(从 .env 读,不硬编码)。
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy: Record<string, unknown> = {}
  try {
    const base = env.VITE_PARTNER_BASEURL
    if (base) {
      const u = new URL(base)
      const prefix = u.pathname.replace(/\/$/, '') // 例:/v1
      proxy['/partner'] = {
        target: u.origin,
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/partner/, prefix),
      }
    }
  } catch { /* base 没配就不挂代理,assistant 走兜底 */ }
  return {
    /**
     * **只在构建时加 /lab/world 前缀,dev 保持挂根。**
     *
     * 上线要前缀:收进 monorepo 后本作挂在 /lab/world/ 下(Caddy handle_path 剥前缀、
     * 文件按根目录摆),所以构建出的资源/入口链接都得带 /lab/world。
     *
     * 但 dev 不能跟着加:本作自己的页面(build.html / index.html)和冒烟脚本
     * (scripts/*-check.mjs)都按**根路径**访问。之前 base 写死成 /lab/world/,
     * dev 下 `/build.html` 就变成 404 → Vite 回退 index.html → 页面看着能开、
     * 实际是另一个文档、`window.__*` 钩子全不存在,冒烟报「__level is not a function」。
     * (同一个坑的第三次:**200 不代表拿到的是那个东西**。)
     */
    base: command === 'build' ? '/lab/world/' : '/',
    //  显式绑 127.0.0.1:不写的话 Vite 只监听 IPv6 的 [::1],用 127.0.0.1 访问会连不上。
    server: { host: '127.0.0.1', port: 5180, proxy },
    /* 仓里十几个 .html 都是历史方向的试片,**vite 默认只打包 index.html**。
       主线现在挂在 index.html 上;build.html 挂的是同一个模块,所有冒烟脚本都按它的
       地址走,一并打进来,免得「本地 /build.html 好好的、上了线只有首页」。
       ⚠️ cpu.html(第二台设备的灰盒竖切)**是故意不列进来的** —— 它还没并进主线菜单,
       只在 dev 用 :5183/cpu.html 看。等它成熟了要记得加进这个 input,别又漏一次。 */
    build: { target: 'es2022', rollupOptions: { input: { index: 'index.html', build: 'build.html' } } },
  }
})
