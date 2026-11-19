/**
 * 「现在是不是并入主站的那个形态」—— 一个判断，两处用（平台页眉、进度同步）。
 *
 * ## 判据用**挂载路径**，不是去探一探
 *
 * 抄的是虾米看股那条（wiki/27 · 1）：主机名会把「在本机跑生产形态」误判成开发环境，
 * 而挂载路径直接对应部署形态 —— 本机验证与线上走同一条分支。
 *
 * 本仓这里还有一个更直接的理由：**探测本身会在控制台留下红字**。
 * 第一版是"先 fetch 一下 /chrome/manifest.json，404 就当没有主站"，逻辑没问题，
 * 但浏览器对任何 404 都会打一条 `Failed to load resource` —— 独立跑的时候，
 * 一开页面就是两条红的（另一条是 /v1/session）。而本仓的冒烟有一条判据是
 * **「控制台无错误」**，它立刻就被这两条噪声废掉了。
 *
 * 一个必然失败的请求不该让一条真判据变成噪声。
 *
 * ## 对应关系
 *
 *   npm run web           base = /        独立形态：没有平台页眉、进度只存本地
 *   npm run web:lab       base = /cslab/    并入形态：跟线上一致（配 npm run gateway 看真形态）
 *   npm run web:single    base = /        单文件产物：同独立形态
 *   线上                   base = /cslab/    VITE_BASE=/cslab/ 构建，Caddy handle_path 剥前缀
 */

/**
 * 构建时就定了：`VITE_BASE=/cslab/` 出来的产物才是并入形态。
 *
 * ## 这两处的写法为什么绕
 *
 * 合并规则的单元测试在 **Node** 里直接 import 这条链上的模块（tests/sync-merge.test.ts
 * → sync.ts → 本文件），而仓库根的 tsconfig 是给引擎用的：`lib` 只有 ES2023，
 * 没有 DOM、也没有 vite/client。直接写 `import.meta.env` 和 `window` 会让
 * **引擎的类型检查**在一个跟它毫无关系的文件上失败。
 *
 * 与其把 DOM 塞进引擎的 tsconfig（引擎是纯 Node 的，那会让它以后能悄悄用上 document），
 * 不如在这一处把两个宿主对象显式取出来 —— 顺带也真的兜住了 Node 里没有它们这件事。
 */
const env = (import.meta as { env?: { BASE_URL?: string; VITE_GITHUB_PAGES?: string } }).env
const loc = (globalThis as { location?: { protocol: string } }).location

export const GITHUB_PAGES = env?.VITE_GITHUB_PAGES === 'true'

// A project subpath on Pages is independent hosting, not the Xiami platform.
export function hostSettings(base: string, pages: boolean, protocol: string) {
  return {
    platform: !pages && base === '/cslab/' && ['http:', 'https:'].includes(protocol),
    ai: !pages,
    subappsBase: pages ? base : '/cslab/',
  }
}
const hosting = hostSettings(env?.BASE_URL || '/', GITHUB_PAGES, loc?.protocol || '')
export const subappUrl = (name: 'cards' | 'explainer' | 'explainer-live'): string => `${hosting.subappsBase}${name}/`

/**
 * 现在该不该去打主站的接口（`/chrome/*`、`/v1/*`）。
 *
 * 还要求是 http(s)：单文件产物是拿浏览器直接打开的（`file:`），
 * 那里一个绝对路径都请求不出去。
 */
export const onPlatform = (): boolean =>
  hosting.platform
