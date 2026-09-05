import { defineConfig, loadEnv } from 'vite'

// dev 代理:浏览器直连 MiniMax 会撞 CORS,开发时把 /partner 转发到真实 base(从 .env 读,不硬编码)。
export default defineConfig(({ mode }) => {
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
    // 收进虾米实验室 monorepo 后挂在 /lab/world/ 下(Caddy handle_path 剥前缀、文件按根目录摆);
    // base 让构建出的资源/入口链接(含 index.html 里的 /game/cards/demo.ts)都带上 /lab/world 前缀。
    base: '/lab/world/',
    server: { port: 5180, proxy },
    build: { target: 'es2022' },
  }
})
